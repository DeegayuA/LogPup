import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { and, eq, exists, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveSprints, liveTasks } from '@/db/live'
import { taskAssignees } from '@/db/schema'
import { bridgeKeyValid, resolveBridgeUser } from '@/lib/bridge-auth'
import { applyTaskStatusChange } from '@/features/sprints/task-status-write'
import { MaintenanceFreezeError } from '@/features/maintenance/write-freeze'
import { externalBaseUrl, serializeTask } from '@/app/api/external/serialize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const input = z.object({
  email: z.string().min(3),
  status: z.enum(['todo', 'in_progress', 'done']),
  note: z.string().max(500).optional(),
})

/**
 * The Attendance Web App moving one task's status on a person's behalf.
 *
 * THE PERMISSION RULE IS NARROWER THAN LOGPUP'S OWN, ON PURPOSE. `updateTask` lets an admin
 * edit anyone's task; this lets ONLY AN ASSIGNEE move their own. Admin reach is a LogPup-UI
 * power exercised with the board in view, and an API key that also carried it would mean a
 * compromised Attendance deployment could rewrite the whole workspace. Do not "fix" this
 * asymmetry by adding the admin branch.
 *
 * The write itself goes through applyTaskStatusChange, which is the single writer that also
 * decides `completed_at`, syncs linked meeting follow-ups and logs the activity row. A handler
 * that issued its own UPDATE would silently skip three of those four.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!bridgeKeyValid(req.headers.get('x-api-key'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  // Shape-check BEFORE the DB: a non-UUID makes Postgres raise 22P02, which would throw out of
  // this handler as a 500 rather than the 404 it actually is.
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
  }

  const parsed = input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  // ONE refusal body for every "no" that is not a malformed request.
  //
  // An unknown address, an out-of-domain one, a deactivated / pending / removed account, a task
  // that does not exist, and a task that is not yours all answer IDENTICALLY. Two different 403
  // sentences would be an oracle: a key holder could PATCH a random uuid with a guessed address
  // and read which sentence came back to learn whether that person has a live LogPup account —
  // sweeping a name list to map the staff directory, which is exactly what the list route's 200
  // is there to prevent. The GET route then volunteers id, email and name for every hit.
  const refuse = () =>
    NextResponse.json({ success: false, error: 'Not allowed' }, { status: 403 })

  try {
    const user = await resolveBridgeUser(parsed.data.email)
    if (!user) return refuse()

    // Assignee-or-nothing — and "assignee" means EITHER place, for the reason spelled out in
    // the list route: `task_assignees` is only written when a caller sends the assigneeIds
    // array, which the board composer and the task dialog never do. A join-only check would
    // 403 the named assignee off their own card for every task created through the normal UI.
    const [membership] = await db
      .select({ id: liveTasks.id })
      .from(liveTasks)
      .where(
        and(
          eq(liveTasks.id, id),
          or(
            eq(liveTasks.assigneeId, user.id),
            exists(
              db
                .select({ one: sql`1` })
                .from(taskAssignees)
                .where(
                  and(eq(taskAssignees.taskId, liveTasks.id), eq(taskAssignees.userId, user.id)),
                ),
            ),
          ),
        ),
      )
      .limit(1)
    if (!membership) return refuse()

    const result = await applyTaskStatusChange({
      taskId: id,
      actorId: user.id,
      next: parsed.data.status,
      note: parsed.data.note,
    })
    if (!result.ok && result.reason === 'not-found') {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
    }

    // 'unchanged' is NOT an error — re-sending the status a task already has is what a
    // double-tap looks like, and the honest answer is the task as it stands.
    const task = await readTask(id, user.id)
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, task }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    // A maintenance freeze is refused at the database boundary by src/db/write-gate.ts, which
    // `tasks` is deliberately NOT exempt from. Without this branch the gate's throw would reach
    // an Attendance user as "something went wrong"; the window is a fact they can act on.
    if (isFrozen(error)) {
      return NextResponse.json(
        { success: false, error: 'LogPup is in a maintenance window — try again shortly' },
        { status: 503 },
      )
    }
    console.error('[external/tasks/status] write failed', error)
    return NextResponse.json(
      { success: false, error: 'Could not update the task' },
      { status: 500 },
    )
  }
}

/**
 * The freeze, identified by its CLASS rather than by its wording.
 *
 * `MaintenanceFreezeError` exists — write-freeze.ts says it is "a named class rather than a bare
 * Error so a call site that wants to say something specific can". Matching the message text
 * instead would report any unrelated failure whose message happened to contain "maintenance" or
 * "read-only" as a maintenance window, telling Attendance to retry a write that will never
 * succeed — and the message can carry user-supplied text.
 */
function isFrozen(error: unknown): boolean {
  return error instanceof MaintenanceFreezeError
}

/** Re-read the row in the list route's shape, so both endpoints answer identically. */
async function readTask(taskId: string, userId: string) {
  const [row] = await db
    .select({
      id: liveTasks.id,
      title: liveTasks.title,
      description: liveTasks.description,
      status: liveTasks.status,
      priority: liveTasks.priority,
      dueDate: liveTasks.dueDate,
      dueKind: liveTasks.dueKind,
      dueCommitmentNote: liveTasks.dueCommitmentNote,
      originalDueDate: liveTasks.originalDueDate,
      completedAt: liveTasks.completedAt,
      createdAt: liveTasks.createdAt,
      appId: liveApps.id,
      appName: liveApps.name,
      appSlug: liveApps.slug,
      sprintId: liveSprints.id,
      sprintName: liveSprints.name,
      sprintEndDate: liveSprints.endDate,
      assigneeId: liveTasks.assigneeId,
    })
    .from(liveTasks)
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .leftJoin(liveSprints, eq(liveSprints.id, liveTasks.sprintId))
    .where(eq(liveTasks.id, taskId))
    .limit(1)
  if (!row) return null

  const people = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, taskId))

  return serializeTask(
    {
      ...row,
      isPrimaryAssignee: row.assigneeId === userId,
      assigneeCount: people.length || 1,
    },
    externalBaseUrl(),
  )
}
