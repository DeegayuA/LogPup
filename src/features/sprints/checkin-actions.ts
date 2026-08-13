'use server'

import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { liveSprints } from '@/db/live'
import { apps, sprintCheckins, users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'

const checkinInput = z.object({
  sprintId: z.uuid(),
  /**
   * Whose check-in this is. Omitted → the caller's own, the only thing a
   * member may ever write. An admin may name someone else (see the PERMISSION
   * note on upsertSprintCheckin for what that costs and how it is recorded).
   */
  targetUserId: z.uuid().optional(),
  // Whole points only, matching the integer column — see the WHY on
  // sprint_checkins in db/schema.ts.
  percent: z.number().int().min(0, 'Percent must be 0–100').max(100, 'Percent must be 0–100'),
  // Trim BEFORE the length check so 280 real characters padded with
  // whitespace isn't rejected. A note is one standup sentence, not a status
  // report — anything longer belongs on the task or in the meeting notes.
  note: z.string().trim().max(280, 'Keep the note under 280 characters').optional(),
})

/** Same contract as actions.ts/task-actions.ts: a server action returns
 *  err(), it never rejects — the caller renders a sentence, not a crash. */
function unexpected(context: string, error: unknown): ActionResult<never> {
  console.error(`[sprints] ${context}`, error)
  return err('Something went wrong — try again')
}

/**
 * Records (or re-records) the caller's own progress check-in for a sprint:
 * "I'm at N%", optionally with a sentence of context. Upsert on
 * (sprintId, userId) — saying it again replaces the old answer, it never
 * accumulates rows (see the current-state-not-history WHY in db/schema.ts).
 *
 * PERMISSION: any signed-in, approved user for THEMSELVES; an ADMIN may also
 * record or correct someone else's, by passing `targetUserId`.
 *
 * That admin path was deliberately absent before, and the objection behind
 * that still stands: this surface exists to compare what a person SAYS
 * against what their board computes (checkinGap in checkins.ts), and a number
 * typed by someone else is not what they said. It is allowed now because the
 * workspace asked for full CRUD here, and the mitigation is audit rather than
 * prohibition — an admin-entered check-in logs `on behalf of <name>` and
 * carries `enteredByAdmin` in its activity metadata, so a corrected number is
 * always distinguishable from a self-reported one in the trail. What it
 * cannot do is make the row itself say so; read the trail before treating a
 * number as first-hand.
 */
export async function upsertSprintCheckin(
  sprintId: string,
  percent: number,
  note?: string,
  targetUserId?: string,
): Promise<ActionResult<{ percent: number }>> {
  const session = await auth()
  if (!session?.user) return err('Sign in required')
  // Holding a session already implies active=true (the jwt callback in
  // src/lib/auth.ts refuses tokens to deactivated/rejected accounts), so
  // 'approved' is the one gate left to check here — same rule as
  // canAccessApp in src/lib/access-gate.ts, which only the proxy can apply.
  if (session.user.status !== 'approved') return err('Your account is pending approval')

  const parsed = checkinInput.safeParse({ sprintId, percent, note, targetUserId })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const isAdmin = session.user.role === 'admin'
  const subjectId = parsed.data.targetUserId ?? session.user.id
  const onBehalf = subjectId !== session.user.id
  if (onBehalf && !isAdmin) return err('You can only check in for yourself')

  // Existence check doubles as the appId lookup revalidation needs — a
  // random UUID would otherwise surface as an FK violation in the catch.
  const [sprint] = await db
    .select({ appId: liveSprints.appId, name: liveSprints.name })
    .from(liveSprints)
    .where(eq(liveSprints.id, parsed.data.sprintId))
  if (!sprint) return err('Sprint not found')

  // '' from a cleared textarea means "no note", not a note of empty string —
  // same convention as createSprint's `goal || null`.
  const noteValue = parsed.data.note || null
  const values = {
    percent: parsed.data.percent,
    note: noteValue,
    // Explicit on the conflict path: defaultNow() only fires on INSERT, and
    // a re-check-in that kept the old timestamp would lie to the staleness
    // signal the meeting surface reads.
    updatedAt: new Date(),
  }

  try {
    await db
      .insert(sprintCheckins)
      .values({ sprintId: parsed.data.sprintId, userId: subjectId, ...values })
      .onConflictDoUpdate({
        target: [sprintCheckins.sprintId, sprintCheckins.userId],
        set: values,
      })
  } catch (error) {
    return unexpected('upsertSprintCheckin', error)
  }

  const [app] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, sprint.appId))
  await logActivity({
    actorId: session.user.id,
    verb: 'checked in',
    entityType: 'sprint',
    entityId: parsed.data.sprintId,
    entityLabel: sprint.name,
    appId: sprint.appId,
    pagePath: app ? '/apps/' + app.slug : null,
    detail: onBehalf
      ? `at ${parsed.data.percent}% on behalf of ${await nameOf(subjectId)}`
      : `at ${parsed.data.percent}%`,
    metadata: { percent: parsed.data.percent, note: noteValue, enteredByAdmin: onBehalf },
  })

  if (app) revalidatePath('/apps/' + app.slug)
  // Check-ins feed the meeting-prep surface, which lives outside the app page.
  revalidatePath('/meetings')
  return ok({ percent: parsed.data.percent })
}

/** Name for an activity line; the id itself says nothing to a human reader. */
async function nameOf(userId: string): Promise<string> {
  const [row] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId))
  return row?.name ?? 'someone'
}

/**
 * Removes a check-in entirely — the D of the CRUD this surface was missing.
 *
 * Distinct from checking in at 0%: 0% is an answer ("I have not started"),
 * absence is the lack of one ("they have not reported"). The prep table
 * renders those differently on purpose, so a mistaken entry has to be
 * removable rather than only overwritable.
 *
 * Self always; an admin may clear anyone's. Logged either way, because a
 * disappearing number that leaves no trace is indistinguishable from one that
 * was never given.
 */
export async function deleteSprintCheckin(
  sprintId: string,
  targetUserId?: string,
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Sign in required')
  if (session.user.status !== 'approved') return err('Your account is pending approval')

  const parsedSprint = z.uuid().safeParse(sprintId)
  const parsedTarget = targetUserId ? z.uuid().safeParse(targetUserId) : null
  if (!parsedSprint.success || (parsedTarget && !parsedTarget.success)) return err('Not found')

  const subjectId = parsedTarget?.success ? parsedTarget.data : session.user.id
  const onBehalf = subjectId !== session.user.id
  if (onBehalf && session.user.role !== 'admin') {
    return err('Only an admin can clear someone else’s check-in')
  }

  const [sprint] = await db
    .select({ appId: liveSprints.appId, name: liveSprints.name })
    .from(liveSprints)
    .where(eq(liveSprints.id, parsedSprint.data))
  if (!sprint) return err('Sprint not found')

  const removed = await db
    .delete(sprintCheckins)
    .where(
      and(eq(sprintCheckins.sprintId, parsedSprint.data), eq(sprintCheckins.userId, subjectId)),
    )
    .returning({ percent: sprintCheckins.percent })
  if (removed.length === 0) return err('There is no check-in to clear')

  const [app] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, sprint.appId))
  await logActivity({
    actorId: session.user.id,
    verb: 'cleared',
    entityType: 'sprint',
    entityId: parsedSprint.data,
    entityLabel: sprint.name,
    appId: sprint.appId,
    pagePath: app ? '/apps/' + app.slug : null,
    detail: onBehalf ? `check-in for ${await nameOf(subjectId)}` : 'their check-in',
    metadata: { clearedPercent: removed[0].percent, enteredByAdmin: onBehalf },
  })

  if (app) revalidatePath('/apps/' + app.slug)
  revalidatePath('/meetings')
  return ok(undefined)
}
