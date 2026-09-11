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
