import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { createNotifications } from '@/features/notifications/notify'
import {
  newEventId,
  postEventsToAttendance,
  type AttendanceEvent,
} from '@/features/notifications/attendance-webhook'
import {
  buildAssignmentNotice,
  shouldNotifyAssignee,
} from '@/features/sprints/assignment-notice'
import type { DueKind } from '@/features/sprints/due-date'

/**
 * Telling somebody that work has landed on their board.
 *
 * `assignment-notice.ts` — the wording, the rules about which deadlines get named, and its
 * tests — has existed for a while and was called from NOWHERE. LogPup did not notify on
 * assignment at all. This is the wiring it was missing, and the Attendance fan-out rides on the
 * same event rather than being a parallel path, so the two can never disagree about who was
 * told what.
 *
 * BEST EFFORT, ALWAYS. Called after the assignment has already been written. Every failure is
 * swallowed and logged: losing a notification must never report a saved assignment as failed.
 * `createNotifications` keeps that contract itself; this wrapper keeps it for the parts around
 * it (the name lookup, the webhook).
 *
 * NOT called from inside `setTaskAssignees`. That helper returns the diff and writes nothing
 * else; a notification fired from inside a batch helper would be a side effect none of its four
 * callers could see or suppress.
 */
export async function notifyNewAssignees(input: {
  taskId: string
  taskTitle: string
  appId: string
  appName: string
  appSlug: string
  dueDate: string | null
  dueKind: DueKind
  /** Who did the assigning. Never notified — see shouldNotifyAssignee. */
  actorId: string
  actorName: string
  /** Only the people NEWLY put on the task. `diffAssignees` already computes this. */
  assigneeIds: readonly string[]
}): Promise<void> {
  try {
    // shouldNotifyAssignee owns the "not yourself, not nobody" rule; do not re-test it here.
    const recipients = input.assigneeIds.filter((id) => shouldNotifyAssignee(id, input.actorId))
    if (recipients.length === 0) return

    const notice = buildAssignmentNotice({
      taskTitle: input.taskTitle,
      assignerName: input.actorName,
      appName: input.appName,
      appSlug: input.appSlug,
      dueDate: input.dueDate,
      dueKind: input.dueKind,
    })

    // The in-app row first: it is the record, and the webhook is a courtesy on top of it.
    const notified = await createNotifications(
      recipients.map((userId) => ({
        userId,
        actorId: input.actorId,
        // 'system' is a COMPROMISE and worth naming. The legacy enum's three values are
        // mention / meeting / system, and an assignment is a person talking to a person, so
        // none of them fits. Adding a value means a pgEnum migration, which this repo avoids
        // for the documented reason (Postgres forbids using a freshly ADD VALUE'd member in
        // the same transaction — why activity_log.verb is text). `kind` below is the real
        // discriminator and needs no migration.
        type: 'system' as const,
        kind: 'task.assigned',
        title: notice.title,
        body: notice.body,
        link: notice.link,
        entity: { type: 'task', id: input.taskId },
        // IDS, NEVER NAMES: freezing actorName into jsonb is how an inbox ends up asserting
        // something that stopped being true the moment somebody was renamed.
        params: { taskId: input.taskId, appId: input.appId, actorId: input.actorId },
        // A notification is a read of the thing it names. Without this gate, one that opens a
        // page the reader may not see is a permission leak that arrives by itself.
        visibility: { action: 'app.view' as const, resource: { appId: input.appId } },
      })),
    )

    // THE GATED SET, never the raw one. createNotifications drops anyone deactivated,
    // unapproved, removed, or without `app.view` on this app — and a push carries the same task
    // title and link as the in-app row it withheld. Passing `recipients` here would push to
    // somebody's phone exactly what the inbox deliberately refused them.
    await fanOutToAttendance(input, notified, notice)
  } catch (error) {
    console.error(`[sprints] assignment notification failed for task ${input.taskId}:`, error)
  }
}

async function fanOutToAttendance(
  input: { taskId: string; appSlug: string; actorName: string },
  recipients: readonly string[],
  notice: { title: string; body: string | null; link: string },
): Promise<void> {
  // The webhook addresses people by EMAIL — Attendance has no LogPup uuid, and LogPup has no
  // EPF number, so the work email is the only handle both systems hold for the same human.
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, [...recipients]))

  const occurredAt = new Date().toISOString()
  const events: AttendanceEvent[] = rows.map((row) => ({
    // One id PER RECIPIENT, not per event: Attendance keys its notification document off this,
    // and a shared id across recipients is a duplicate-notification bug its register route
    // already documents having been bitten by.
    eventId: newEventId(),
    kind: 'task.assigned',
    occurredAt,
    recipientEmail: row.email,
    actorName: input.actorName,
    title: notice.title,
    body: notice.body,
    link: notice.link,
    taskId: input.taskId,
    appSlug: input.appSlug,
  }))

  await postEventsToAttendance(events)
}
