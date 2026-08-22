import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { dailyWorklogs, meetings, sprints, tasks } from '@/db/schema'
import type { TaskStatus } from '@/features/sprints/board-view'
import { applyDueDate, type DueKind, type DueState } from '@/features/sprints/due-date'
import { transitionTaskStatus } from '@/features/sprints/task-status'

/**
 * Applying an approved change request.
 *
 * A CLOSED REGISTRY, one applier per entity type, not a generic "apply any
 * diff". Two reasons, both structural rather than stylistic:
 *
 *  - `src/db/index.ts` is neon-http, so `db.transaction()` does not exist.
 *    The house substitute is `db.batch([...])`, which needs a statically
 *    built array of statements — a diff of arbitrary shape cannot produce one.
 *  - An unsupported entity type must fail loudly when the request is FILED,
 *    not silently when someone approves it a week later.
 */
export const SUPPORTED_ENTITY_TYPES = ['task', 'sprint', 'meeting', 'worklog'] as const
export type SupportedEntityType = (typeof SUPPORTED_ENTITY_TYPES)[number]

export function isSupportedEntityType(value: string): value is SupportedEntityType {
  return (SUPPORTED_ENTITY_TYPES as readonly string[]).includes(value)
}

/**
 * Whether the target still looks the way it did when the request was filed.
 *
 * Returns the name of the first field that moved, or null if the row still
 * matches. This is field-by-field against a stored pre-image rather than a
 * version column because NONE of the target tables has an `updatedAt` to
 * compare — `apps`, `tasks`, `sprints` and `meetings` all lack one.
 *
 * Approving a stale request must fail loudly. The alternative is silently
 * clobbering whatever someone else changed in the meantime, which is the one
 * outcome an approval workflow exists to prevent.
 */
export function detectConflict(
  before: Record<string, unknown>,
  current: Record<string, unknown> | null,
): string | null {
  if (current === null) return 'row no longer exists'
  for (const [field, was] of Object.entries(before)) {
    const now = current[field]
    // Dates arrive as Date from the driver and as ISO strings from jsonb.
    const a = was instanceof Date ? was.toISOString() : was
    const b = now instanceof Date ? now.toISOString() : now
    if (JSON.stringify(a) !== JSON.stringify(b)) return field
  }
  return null
}

const TABLES = {
  task: tasks,
  sprint: sprints,
  meeting: meetings,
  worklog: dailyWorklogs,
} as const

/**
 * A task's deadline fields, rebuilt through the one helper that owns them.
 *
 * WHY THIS EXISTS AT ALL. The generic spread below writes `after` verbatim,
 * which is right for every table whose columns carry no invariants between
 * them. `tasks` is not one: due_date, due_kind, due_commitment_note,
 * original_due_date and due_changed_count are five columns describing ONE
 * fact, and `applyDueDate` (features/sprints/due-date.ts) is what keeps them
 * consistent — stamping the original date the first time, counting the moves,
 * and refusing a commitment with no note naming who it was promised to.
 *
 * An approved change request carrying a dueDate went straight to the spread,
 * making it the one write path that skipped all of that — and the only one
 * with a reviewer's name attached. It would have produced a committed deadline
 * with no note, an original date never stamped, and a slip counter that
 * disagreed with the row's own history, arriving through the very workflow
 * that exists to make changes accountable.
 *
 * `current` is the row as it stands, which the caller already fetched for its
 * conflict check — no extra read.
 */
export function buildTaskDeadlineSet(
  after: Record<string, unknown>,
  current: Record<string, unknown> | null,
): Record<string, unknown> {
  // Only a request that actually touches the deadline goes through the helper.
  // A title-only edit must not restate a due date, because applyDueDate counts
  // every change it is handed and a rename is not a slip.
  if (!('dueDate' in after) || current === null) return after

  const state: DueState = {
    dueDate: asIsoDate(current.dueDate),
    dueKind: (current.dueKind as DueKind) ?? 'target',
    originalDueDate: asIsoDate(current.originalDueDate),
    dueChangedCount: typeof current.dueChangedCount === 'number' ? current.dueChangedCount : 0,
  }

  // Throws DueDateError on a commitment with no note or no date. That
  // propagates to approveChangeRequest's catch and becomes err(), which is the
  // point: an approval that cannot satisfy the invariant must fail in front of
  // the reviewer rather than quietly downgrade to 'target'.
  const patch = applyDueDate(state, {
    dueDate: asIsoDate(after.dueDate),
    dueKind: after.dueKind as DueKind | undefined,
    note: (after.dueCommitmentNote as string | null | undefined) ?? undefined,
  })

  // The rest of the edit still applies; the deadline half is replaced wholesale
  // by what the helper decided.
  const rest = { ...after }
  delete rest.dueDate
  delete rest.dueKind
  delete rest.dueCommitmentNote
  delete rest.originalDueDate
  delete rest.dueChangedCount
  return { ...rest, ...patch }
}

/**
 * A task's status and `completed_at`, rebuilt through the one helper that owns
 * them — the other half of the same argument buildTaskDeadlineSet makes.
 *
 * THIS IS THE FOURTH WRITER OF tasks.status, and the one nobody remembers.
 * createTask, updateTask, moveTaskOnBoard and bulkUpdateTasks all route
 * through `transitionTaskStatus`; an approved change request reached the row
 * through the generic spread below instead, writing `status: 'done'` and
 * leaving `completed_at` NULL. That is worse than a missing value: the row
 * then reads "finished" while answering "never completed", and every
 * throughput and cycle-time reader believes the timestamp. It arrived, of all
 * the ways it could, through the one door with a reviewer's name attached.
 *
 * `now` is a parameter for the same reason it is one in the helper — the
 * completion time belongs to the approval, not to whenever this function
 * happens to run.
 */
export function buildTaskStatusSet(
  after: Record<string, unknown>,
  current: Record<string, unknown> | null,
  now: Date,
): Record<string, unknown> {
  // Only a request that actually moves the status. An edit that never
  // mentions it must not restate the current status, because a restated
  // 'done' is still a transition as far as anything downstream can tell.
  if (!('status' in after) || current === null) return after

  const next = asTaskStatus(after.status)
  // A payload whose status is not one of the three is left exactly as it was
  // so it still reaches the DB and is refused by the enum column. Deriving a
  // completion time from a value we cannot read would be inventing one.
  if (next === null) return after

  return { ...after, ...transitionTaskStatus(asTaskStatus(current.status), next, now) }
}

const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'done']

/** jsonb carries whatever was filed; the enum column is the only guarantee. */
function asTaskStatus(value: unknown): TaskStatus | null {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value)
    ? (value as TaskStatus)
    : null
}

/** jsonb hands back strings, the driver hands back Date. Both mean a day. */
function asIsoDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return typeof value === 'string' && value ? value.slice(0, 10) : null
}

/** The one statement that applies an approved edit. Fed straight into db.batch. */
export function buildApplyStatement(
  entityType: SupportedEntityType,
  entityId: string,
  after: Record<string, unknown>,
  current: Record<string, unknown> | null = null,
  now: Date = new Date(),
) {
  const table = TABLES[entityType]
  // `task` is the only supported entity whose columns carry invariants across
  // each other — deadlines and completion — so it is the only one that does
  // not go out as a faithful spread of what was approved. Both halves compose:
  // a request may move the date, the status, or both.
  const set =
    entityType === 'task'
      ? buildTaskStatusSet(buildTaskDeadlineSet(after, current), current, now)
      : after
  return db.update(table).set(set).where(eq(table.id, entityId))
}
