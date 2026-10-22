import { and, eq, exists, inArray, or, sql, type SQL } from 'drizzle-orm'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { liveTasks } from '@/db/live'
import { activityLog, taskAssignees } from '@/db/schema'

/**
 * Which tasks are a person's own, as WHERE conditions over `liveTasks`.
 *
 * Connection-free (QueryBuilder, like src/db/live.ts) so the SQL can be compiled and checked in
 * a unit test, and shared by both external routes so the list and the status write agree.
 */
const qb = new QueryBuilder()

/**
 * On the task: the owner column OR a `task_assignees` row. Either, because neither is complete
 * on its own — see the long note in tasks/route.ts. `EXISTS` so a task never returns twice.
 */
export function assignedTo(userId: string): SQL {
  return or(
    eq(liveTasks.assigneeId, userId),
    exists(
      qb
        .select({ one: sql`1` })
        .from(taskAssignees)
        .where(and(eq(taskAssignees.taskId, liveTasks.id), eq(taskAssignees.userId, userId))),
    ),
  ) as SQL
}

/**
 * Completed by this person: the task is done NOW, and the LATEST `completed` activity row for it
 * names them as the actor.
 *
 * `tasks` has `completed_at` but no "completed by", so activity_log is the only record. Every
 * completion path writes one — `updateTask`, `moveTaskOnBoard` and the bridge's
 * applyTaskStatusChange all log `statusActivity()`'s verb with `entity_type = 'task'`. The latest
 * row decides, so a task finished, reopened and finished by someone else is theirs, and a task
 * that has since been reopened is nobody's (the status check). Served by
 * `activity_log_entity_idx` (entity_type, entity_id, created_at).
 */
export function completedBy(userId: string): SQL {
  return sql`(${liveTasks.status} = 'done' and (
    select ${activityLog.actorId} from ${activityLog}
    where ${activityLog.entityType} = 'task'
      and ${activityLog.entityId} = ${liveTasks.id}
      and ${activityLog.verb} = 'completed'
    order by ${activityLog.createdAt} desc limit 1
  ) = ${userId})`
}

/** assignedTo for several people: on the task as owner or co-assignee, for ANY of `userIds`. */
export function assignedToAny(userIds: string[]): SQL {
  return or(
    inArray(liveTasks.assigneeId, userIds),
    exists(
      qb
        .select({ one: sql`1` })
        .from(taskAssignees)
        .where(and(eq(taskAssignees.taskId, liveTasks.id), inArray(taskAssignees.userId, userIds))),
    ),
  ) as SQL
}

/** completedBy for several people: done now, and the latest completion row names ANY of them. */
export function completedByAny(userIds: string[]): SQL {
  return sql`(${liveTasks.status} = 'done' and (
    select ${activityLog.actorId} from ${activityLog}
    where ${activityLog.entityType} = 'task'
      and ${activityLog.entityId} = ${liveTasks.id}
      and ${activityLog.verb} = 'completed'
    order by ${activityLog.createdAt} desc limit 1
  ) in (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)}))`
}

/**
 * The calendar day a task is SHOWN on in Attendance, bounded by an inclusive range: the
 * Asia/Colombo day it was completed, else its due date, else the Colombo day it was created.
 *
 * Mirrored by `logpupTaskDate` in Attendance-Web-App/src/lib/logpupWorklogTasks.ts — the batch
 * filters with this, the single-person list is placed with that, and the two must agree.
 *
 * The two timestamps are different types and need different conversions: `completed_at` is
 * timestamptz (an instant — `at time zone` gives Colombo wall time), `created_at` is a plain
 * timestamp holding the database's UTC wall time (defaultNow under a UTC session), so it is
 * first read AS UTC and then converted. `due_date` is already a calendar day.
 */
export function taskDayBetween(fromIso: string, toIso: string): SQL {
  return sql`coalesce((${liveTasks.completedAt} at time zone 'Asia/Colombo')::date, ${liveTasks.dueDate}, ((${liveTasks.createdAt} at time zone 'UTC') at time zone 'Asia/Colombo')::date) between ${fromIso}::date and ${toIso}::date`
}
