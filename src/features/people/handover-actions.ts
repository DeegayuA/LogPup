'use server'

import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { activityLog, appRoleHistory, assignments, tasks, workSchedules } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { requireCapability } from '@/features/auth/actor'
import { splitAllocation, type Share } from '@/features/people/handover-inventory'

const shareInput = z.object({ userId: z.string().uuid(), pct: z.number() })

const applyInput = z.object({
  leaverId: z.string().uuid(),
  /** The last day they worked, Colombo. Their schedule closes the day after. */
  lastWorkingDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** One successor for every task, or none to leave them unassigned. */
  taskSuccessorId: z.string().uuid().nullable(),
  /** Per-app allocation splits. An empty list leaves that app unassigned. */
  allocations: z.array(z.object({
    appId: z.string().uuid(),
    total: z.number(),
    // The leaver's own project-role string, carried across rather than
    // invented: assignments.role is free text the studio chose, and guessing
    // a replacement here would quietly relabel somebody's job.
    role: z.string().trim().min(1).max(120),
    shares: z.array(shareInput),
  })),
  /** Who takes each open pm/lead role. */
  appRoles: z.array(z.object({
    historyId: z.string().uuid(),
    appId: z.string().uuid(),
    role: z.enum(['pm', 'lead']),
    successorId: z.string().uuid().nullable(),
  })),
})

/**
 * Move a departing person's open work to their successors.
 *
 * ONE db.batch — neon-http has no transaction(), and a handover that applied
 * half its moves would leave the workspace in a state nobody chose.
 *
 * As-of intervals CLOSE AND REOPEN; they are never overwritten. Rewriting
 * app_role_history.user_id in place would erase the fact that the leaver ever
 * held the role, which is exactly the loss migration 0034 was written to
 * prevent.
 *
 * logActivity is not used: it swallows its own errors and issues its own
 * insert, so a handover whose trail silently failed would be untraceable. The
 * audit rows are inlined and fail with the write.
 */
export async function applyHandover(
  raw: z.input<typeof applyInput>,
): Promise<ActionResult<{ moved: number }>> {
  const parsed = applyInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const input = parsed.data

  const actor = await requireCapability('user.offboard', { ownerId: input.leaverId })
  if (!actor) return err('Not allowed')
  if (input.leaverId === actor.id) return err('Somebody else has to hand over your work')

  // Validated BEFORE any statement is built: a split that does not add up must
  // stop the whole handover, not leave half of it applied.
  let validated: { appId: string; role: string; shares: Share[] }[]
  try {
    validated = input.allocations.map((a) => ({
      appId: a.appId,
      role: a.role,
      shares: splitAllocation(a.total, a.shares),
    }))
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Check the allocation split')
  }

  const now = new Date()
  // The day AFTER their last working day: the schedule interval is half-open,
  // so an effectiveTo of the last day itself would stop expecting work one day
  // early and quietly forgive a real gap.
  const scheduleEnds = new Date(`${input.lastWorkingDay}T12:00:00Z`)
  scheduleEnds.setUTCDate(scheduleEnds.getUTCDate() + 1)

  const statements: unknown[] = []
  let moved = 0

  for (const role of input.appRoles) {
    statements.push(
      db.update(appRoleHistory).set({ effectiveTo: now }).where(eq(appRoleHistory.id, role.historyId)),
    )
    if (role.successorId) {
      statements.push(
        db.insert(appRoleHistory).values({
          appId: role.appId,
          userId: role.successorId,
          role: role.role,
          effectiveFrom: now,
          changedBy: actor.id,
          note: 'handover',
        }),
      )
      moved += 1
    }
  }

  for (const allocation of validated) {
    statements.push(
      db.delete(assignments).where(
        and(eq(assignments.userId, input.leaverId), eq(assignments.appId, allocation.appId)),
      ),
    )
    for (const share of allocation.shares) {
      statements.push(
        db.insert(assignments).values({
          userId: share.userId,
          appId: allocation.appId,
          role: allocation.role,
          allocationPct: share.pct,
        }),
      )
      moved += 1
    }
  }

  if (input.taskSuccessorId) {
    statements.push(
      db.update(tasks).set({ assigneeId: input.taskSuccessorId }).where(eq(tasks.assigneeId, input.leaverId)),
    )
    moved += 1
  }

  // THE COVERAGE RULE. Without this the leaver accrues a `missing` day every
  // working day forever, and one wrong row drags every org-level number with
  // it. Closing the open schedule and opening nothing means computeCoverage
  // finds no expected days past this date.
  statements.push(
    db
      .update(workSchedules)
      .set({ effectiveTo: scheduleEnds })
      .where(and(eq(workSchedules.userId, input.leaverId), isNull(workSchedules.effectiveTo))),
  )

  statements.push(
    db.insert(activityLog).values({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'handover',
      entityId: input.leaverId,
      entityLabel: 'work handed over',
      metadata: {
        lastWorkingDay: input.lastWorkingDay,
        taskSuccessorId: input.taskSuccessorId,
        appRoles: input.appRoles.length,
        allocations: validated.length,
      },
    }),
  )

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.batch(statements as any)
    revalidatePath('/admin', 'layout')
    revalidatePath('/people')
    return ok({ moved })
  } catch (error) {
    console.error('[handover] applyHandover', error)
    return err('Something went wrong — nothing was moved')
  }
}
