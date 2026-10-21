/**
 * The task shape the Attendance Web App receives, in one place.
 *
 * Both external routes return it — the list and the status write — and a write route that
 * returned a subtly different shape is the kind of drift that surfaces weeks later as a blank
 * field in another application. One mapper, one type.
 *
 * Contract: docs/attendance-task-bridge.md, mirrored in
 * Attendance-Web-App/LOGPUP_TASKS_INTEGRATION.md.
 */

export type ExternalTaskRow = {
  id: string
  title: string
  description: string | null
  status: string
  priority: number
  dueDate: string | null
  dueKind: 'target' | 'committed'
  dueCommitmentNote: string | null
  originalDueDate: string | null
  completedAt: Date | null
  createdAt: Date
  appId: string | null
  appName: string | null
  appSlug: string | null
  sprintId: string | null
  sprintName: string | null
  sprintEndDate: string | null
  /** True when this person is `tasks.assignee_id`, not merely on `task_assignees`. */
  isPrimaryAssignee: boolean
  /** True when this person is on the task at all (owner or co-assignee). False for a task that
   *  is only here because it sits in one of their projects (`scope=projects`). Only an assignee
   *  can move its status, so the receiving app shows the others read-only. */
  isAssignee: boolean
  /** Display name of `tasks.assignee_id`, or null when the task has no owner. */
  assigneeName: string | null
  /** True when the task is done and this person made the latest completion (activity_log).
   *  Can be true while isAssignee is false: they finished somebody else's task. */
  completedByMe: boolean
  assigneeCount: number
}

export type ExternalTask = ReturnType<typeof serializeTask>

/**
 * `dueDate` and `sprintEndDate` LEAVE AS THE STRINGS THEY ARE.
 *
 * They are Postgres `date` columns, and the schema comment on `tasks.due_date` is explicit
 * about why they must not become Date objects: `new Date('2026-08-12')` is midnight UTC, which
 * is still the 11th west of Greenwich. The receiving app renders in Asia/Colombo and compares
 * these as strings against its own local today, so a round trip through Date would move every
 * deadline a day for half the world.
 *
 * Timestamps are different and DO become ISO strings — they are instants, not calendar days.
 */
export function serializeTask(row: ExternalTaskRow, baseUrl: string) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    dueKind: row.dueKind,
    dueCommitmentNote: row.dueCommitmentNote,
    originalDueDate: row.originalDueDate,
    isPrimaryAssignee: row.isPrimaryAssignee,
    isAssignee: row.isAssignee,
    completedByMe: row.completedByMe,
    assignee: row.assigneeName ? { name: row.assigneeName } : null,
    assigneeCount: row.assigneeCount,
    app: row.appId ? { id: row.appId, name: row.appName ?? '', slug: row.appSlug ?? '' } : null,
    sprint: row.sprintId
      ? { id: row.sprintId, name: row.sprintName ?? '', endDate: row.sprintEndDate }
      : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    // The BOARD, not the task: there is no per-task route in this product, and a link that 404s
    // is worse than a link to the list the task is on. Same decision assignment-notice.ts makes.
    url: row.appSlug ? `${baseUrl}/apps/${row.appSlug}` : null,
  }
}

/**
 * The origin to build click-through links from.
 *
 * `AUTH_URL` is the one variable this deployment already has to get right — every OAuth
 * callback depends on it — so it is a better source than a second variable that could drift.
 * Falls back to the public host rather than to localhost, which would ship an unusable link.
 */
export function externalBaseUrl(): string {
  const raw = process.env.AUTH_URL || process.env.LOGPUP_PUBLIC_URL || 'https://logpup.altavision.lk'
  return raw.replace(/\/$/, '')
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export type TaskListScope = 'assigned' | 'projects'

/**
 * The list route's query string, parsed in one pure place so it can be tested without a database.
 *
 * `scope` defaults to 'assigned' — tasks the person is on — so a caller that predates the
 * parameter gets exactly what it always got. 'projects' adds every task in the apps the person
 * belongs to. Anything else reads as 'assigned': an unrecognised value must never widen a read.
 */
export function parseTaskListParams(params: URLSearchParams): {
  email: string
  openOnly: boolean
  scope: TaskListScope
  limit: number
} {
  return {
    email: (params.get('email') ?? '').trim().toLowerCase(),
    openOnly: params.get('status') !== 'all',
    scope: params.get('scope') === 'projects' ? 'projects' : 'assigned',
    limit: Math.min(Math.max(Number(params.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT),
  }
}
