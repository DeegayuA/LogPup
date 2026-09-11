import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { liveTasks } from '@/db/live'
import { meetingFollowups, taskAssignees, tasks, users } from '@/db/schema'
import { isTerminal, type TaskStatus } from '@/features/sprints/board-view'
import { transitionTaskStatus } from '@/features/sprints/task-status'
import { decideFollowupResolutionOnTaskStatusChange } from '@/features/meetings/followups'
import { logActivity } from '@/features/activity/log'
import { createNotifications } from '@/features/notifications/notify'

/**
 * EVERYTHING a task status change has to do, in one place.
 *
 * A status change is NOT one UPDATE. It is four things, and three of them are invisible unless
 * you have already read the code:
 *
 *   1. `transitionTaskStatus` decides `completed_at` as well as `status`. Skip it and you get a
 *      row that reads "done" and answers "never completed" — a hole, not a wrong value, because
 *      nothing can reconstruct the time afterwards.
 *   2. The UPDATE.
 *   3. `syncLinkedFollowups` resolves or reopens the meeting follow-up the task came from. Skip
 *      it and the meeting → task → resolution loop silently stops closing.
 *   4. `logActivity`, which is the authority that outranks `tasks.completed_at` when the two
 *      disagree.
 *
 * This module exists because a SECOND writer that does step 2 and forgets 1, 3 and 4 is the
 * realistic failure of the Attendance bridge, and it fails quietly. `updateTask` and
 * `moveTaskOnBoard` keep their own shape — they interleave status with sprint, assignee and
 * rank edits — but they now share the two pieces that were literally duplicated between them
 * (`syncLinkedFollowups`, `statusActivity`), and `applyTaskStatusChange` is the whole sequence
 * for a caller that is changing ONLY the status.
 *
 * NO `'use server'` DIRECTIVE, deliberately. That directive turns every export into a POST
 * endpoint; a route handler importing from such a file is how server-action internals become
 * reachable from a browser. `task-actions.ts` keeps its directive; this file must never have
 * one.
 */

/** How a status reads inside an activity detail: "moved X to In progress". */
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

/**
 * The other half of closing the loop between meeting follow-ups and tasks (see
 * meetings/ai-actions.ts's linkFollowupToTask, which sets
 * meeting_followups.resolved_by_task_id when a task is created from a suggestion that matches
 * an open follow-up). A task moving TO 'done' resolves the follow-up it's linked to; moving
 * back OUT of 'done' reopens it — decideFollowupResolutionOnTaskStatusChange is the pure
 * decision, this is just wiring it to a write.
 *
 * Called from every path that can change a task's status (updateTask, moveTaskOnBoard,
 * applyTaskStatusChange) AFTER that write has already succeeded, and always wrapped in its own
 * try/catch by the caller: follow-up bookkeeping must NEVER fail the task move it's riding on.
 * A task with no linked follow-up (the overwhelming majority) costs one no-op UPDATE that
 * matches zero rows.
 */
export async function syncLinkedFollowups(
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
): Promise<void> {
  const decision = decideFollowupResolutionOnTaskStatusChange(fromStatus, toStatus)
  if (decision === 'none') return

  if (decision === 'resolve') {
    await db
      .update(meetingFollowups)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolutionNote: 'Resolved automatically — the linked task was completed',
      })
      .where(and(eq(meetingFollowups.resolvedByTaskId, taskId), eq(meetingFollowups.status, 'open')))
    return
  }

  // reopen: only undo what THIS auto-resolve did, not a manual resolve that happens to share
  // the same linked task — resolutionNote is the marker.
  await db
    .update(meetingFollowups)
    .set({ status: 'open', resolvedAt: null, resolutionNote: null })
    .where(
      and(
        eq(meetingFollowups.resolvedByTaskId, taskId),
        eq(meetingFollowups.status, 'resolved'),
        eq(meetingFollowups.resolutionNote, 'Resolved automatically — the linked task was completed'),
      ),
    )
}

export type StatusActivity = {
  verb: string
  detail: string | null
  metadata: Record<string, unknown>
}

/**
 * The activity row a status change deserves, as a pure function.
 *
 * Extracted because `updateTask` and `moveTaskOnBoard` carried byte-identical copies of this
 * ladder, and a third caller was about to make three. The verb distinction matters downstream:
 * the activity feed and every throughput reader tell "completed" from "moved", and getting
 * `reopened` wrong makes a reopened task look like a fresh completion.
 */
export function statusActivity(from: TaskStatus, to: TaskStatus): StatusActivity {
  const verb = isTerminal(to) ? 'completed' : isTerminal(from) ? 'reopened' : 'moved'
  return {
    verb,
    detail: verb === 'moved' ? `to ${STATUS_LABELS[to]}` : null,
    metadata: { status: { from, to } },
  }
}

export type ApplyStatusResult =
  | { ok: true; from: TaskStatus; to: TaskStatus; appId: string; title: string }
  | { ok: false; reason: 'not-found' | 'unchanged' }

/**
 * Change ONE task's status and nothing else, doing all four steps.
 *
 * For callers that hold only a status — today the Attendance bridge's PATCH endpoint. The board
 * and the dialog go through `updateTask` / `moveTaskOnBoard`, which have their own patches to
 * assemble but share `statusActivity` and `syncLinkedFollowups` with this.
 *
 * AUTHORIZATION IS THE CALLER'S. This writes; it does not decide who may. The bridge's rule
 * (assignees only, never an admin acting for someone else) is narrower than LogPup's own and
 * lives with the endpoint that enforces it.
 *
 * `now` is a parameter for the reason task-status.ts gives: a completion time is the one field
 * where "whatever the clock said when this module ran" is not good enough.
 */
export async function applyTaskStatusChange(input: {
  taskId: string
  actorId: string
  next: TaskStatus
  now?: Date
  /** Free text from the acting person. Lands in the activity row, which is the only record. */
  note?: string | null
}): Promise<ApplyStatusResult> {
  const [existing] = await db
    .select({
      id: liveTasks.id,
      status: liveTasks.status,
      appId: liveTasks.appId,
      title: liveTasks.title,
    })
    .from(liveTasks)
    .where(eq(liveTasks.id, input.taskId))
    .limit(1)
  if (!existing) return { ok: false, reason: 'not-found' }

  const from = existing.status
  if (from === input.next) return { ok: false, reason: 'unchanged' }

  // The status the caller sent never reaches the UPDATE on its own: the helper's patch decides
  // completed_at too.
  const patch = transitionTaskStatus(from, input.next, input.now ?? new Date())
  await db.update(tasks).set(patch).where(eq(tasks.id, input.taskId))

  const activity = statusActivity(from, input.next)
  const trimmed = input.note?.trim()
  await logActivity({
    actorId: input.actorId,
    verb: activity.verb,
    entityType: 'task',
    entityId: input.taskId,
    entityLabel: existing.title,
    appId: existing.appId,
    // The note is appended to the verb's own detail rather than replacing it, so "to In
    // progress" survives alongside whatever the person typed.
    detail: [activity.detail, trimmed || null].filter(Boolean).join(' — ') || null,
    metadata: { ...activity.metadata, via: 'attendance' },
  })

  // Best-effort, exactly as in the two server actions: the status write already succeeded, and
  // follow-up bookkeeping must never turn it into a reported failure.
  try {
    await syncLinkedFollowups(input.taskId, from, input.next)
  } catch (error) {
    console.error(`[sprints] follow-up sync failed for task ${input.taskId}:`, error)
  }

  await notifyStatusChange({
    taskId: input.taskId,
    taskTitle: existing.title,
    appId: existing.appId,
    actorId: input.actorId,
    from,
    to: input.next,
    label: activity.verb === 'completed' ? 'completed' : `moved to ${STATUS_LABELS[input.next]}`,
    note: trimmed || null,
  })

  return { ok: true, from, to: input.next, appId: existing.appId, title: existing.title }
}

/**
 * Tell the other people on a task that its status moved.
 *
 * Recipients: everyone else on `task_assignees`, plus whoever put them there (`added_by`) —
 * the nearest thing this schema has to "who is waiting on this". Never the actor;
 * `recipientsFor` drops them automatically, so the full set is passed and the one door does its
 * job.
 *
 * COLLAPSE-WHILE-UNREAD DEDUPE IS THE LOAD-BEARING CHOICE. Somebody dragging a task from todo
 * to in_progress to done in one sitting is three events; without dedupe that is three bell rows
 * about one task. The non-permanent mode collapses them while unread and resets once seen,
 * which is exactly what notifications_dedupe_collapse_idx enforces in the database.
 *
 * Best effort, and deliberately last: the status write has already committed.
 */
async function notifyStatusChange(input: {
  taskId: string
  taskTitle: string
  appId: string
  actorId: string
  from: TaskStatus
  to: TaskStatus
  label: string
  note: string | null
}): Promise<void> {
  try {
    const rows = await db
      .select({ userId: taskAssignees.userId, addedBy: taskAssignees.addedBy })
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, input.taskId))

    const recipients = new Set<string>()
    for (const row of rows) {
      recipients.add(row.userId)
      // Nullable by design — the 0064 backfill had no actor to name — so guard rather than
      // inserting a null into the set.
      if (row.addedBy) recipients.add(row.addedBy)
    }
    recipients.delete(input.actorId)
    if (recipients.size === 0) return

    const [actor] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, input.actorId))
      .limit(1)
    const who = actor?.name ?? 'Someone'

    await createNotifications(
      [...recipients].map((userId) => ({
        userId,
        actorId: input.actorId,
        type: 'system' as const,
        kind: 'task.status_changed',
        title: `${who} ${input.label} “${input.taskTitle}”`,
        body: input.note,
        link: `/apps`,
        entity: { type: 'task', id: input.taskId },
        params: {
          taskId: input.taskId,
          appId: input.appId,
          actorId: input.actorId,
          from: input.from,
          to: input.to,
        },
        dedupe: {
          mode: 'entity' as const,
          entityType: 'task',
          entityId: input.taskId,
          event: 'status',
        },
        visibility: { action: 'app.view' as const, resource: { appId: input.appId } },
      })),
    )
  } catch (error) {
    console.error(`[sprints] status notification failed for task ${input.taskId}:`, error)
  }
}
