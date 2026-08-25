/**
 * THE one place a task's status and `completed_at` are decided together.
 *
 * `status` says THAT a task is finished; `completed_at` says WHEN. They are
 * two columns describing one fact, and the second is derivable from nothing —
 * once a status write lands without it, the completion time is gone and
 * cannot be reconstructed. That is what makes this different from an ordinary
 * pair of fields: `due_date` written badly can be corrected by looking at the
 * row, `completed_at` written badly is a hole.
 *
 * There are FOUR writers of tasks.status, and the fourth is the one nobody
 * remembers: createTask, updateTask, moveTaskOnBoard, bulkUpdateTasks — and
 * an APPROVED CHANGE REQUEST, which reaches the row through
 * admin/change-request-appliers.ts's generic spread with a reviewer's name
 * attached to it. A writer that sets `status` and not `completed_at` does not
 * fail; it produces a row that reads "done" and answers "never completed",
 * and every throughput, cycle-time and streak reader downstream believes it.
 *
 * So the shape here is the same one `due-date.ts` uses for exactly this class
 * of problem: pure, takes the row's current value, returns THE PATCH. No
 * caller holds its own idea of what `completed_at` should be, and a caller
 * that forgets to route through this writes a status with no completion time —
 * which is at least a visible omission in a diff rather than a silent one.
 *
 * `now` IS A PARAMETER. A completion time is the one field where "whatever
 * the clock said when this module happened to run" is not good enough: the
 * caller already knows the instant it is writing, and the tests need to name
 * it.
 */
import { isTerminal } from '@/features/sprints/board-view'
import type { TaskStatus } from '@/features/sprints/board-view'

// Re-exported so the module that owns the completed_at rule also offers the
// terminal test, and callers need not know the helpers are declared next door
// in board-view.ts (which owns TASK_STATUSES). See the comment there for why
// they are not declared in this file.
export { isTerminal, OPEN_STATUSES, TERMINAL_STATUSES } from '@/features/sprints/board-view'

/**
 * The status half of a task UPDATE.
 *
 * `completedAt` ABSENT and `completedAt: null` are deliberately different
 * answers, and the difference is load-bearing:
 *
 *   - absent  — do not touch the column. Fed to Drizzle's `.set()`, an absent
 *     key writes nothing, which is how a re-save of an unchanged 'done'
 *     leaves the ORIGINAL completion time standing.
 *   - null    — clear it. The task left 'done'; it has no completion time any
 *     more, and leaving the old one behind would make a reopened task claim
 *     it finished last Tuesday.
 *
 * Collapsing the two into `Date | null` would force every non-status edit to
 * decide something about `completed_at`, and the wrong decision — writing
 * null — silently erases the completion time of every done task somebody
 * renames.
 */
export type TaskStatusPatch = {
  status: TaskStatus
  completedAt?: Date | null
}

/**
 * The patch to write for a status change.
 *
 * `current` is null for an INSERT — there is no previous status, and a task
 * born 'done' (the ⌘K "log something I already finished" path) still needs
 * its stamp. Modelling that as null rather than passing 'todo' keeps the
 * caller from asserting a state the row never had.
 *
 * Never throws: unlike a committed deadline, there is no status pair a person
 * can ask for that is illegal. Every one of the nine transitions has an
 * answer, and three of them are "leave the column alone".
 */
export function transitionTaskStatus(
  current: TaskStatus | null,
  next: TaskStatus,
  now: Date,
): TaskStatusPatch {
  // ASYMMETRIC ON PURPOSE, and the asymmetry is the whole decision.
  //
  // Leaving a terminal state is REOPENING, whatever the terminal state was —
  // so the clear condition asks isTerminal. Entering one is only a COMPLETION
  // when the state entered is 'done' specifically — so the stamp condition
  // keeps the literal.
  //
  // Route the stamp through isTerminal too and `todo -> cancelled` writes a
  // completion time onto work that was never completed, which every
  // throughput, cycle-time and streak reader downstream would then believe.
  // `done -> cancelled` falls through both branches and KEEPS its original
  // stamp: the task really was finished on that date, and this column is the
  // only place that fact is recorded.
  const wasTerminal = current !== null && isTerminal(current)
  const isCompletion = next === 'done'

  // Entering 'done' — including straight from an insert.
  if (isCompletion && !wasTerminal) return { status: next, completedAt: now }

  // Leaving a terminal state. Reopened work has no completion time; keeping
  // the old one is how a task that is visibly in progress reports as
  // finished to every reader that trusts the timestamp over the status.
  if (!isTerminal(next) && wasTerminal) return { status: next, completedAt: null }

  // done -> done, terminal -> terminal, and every transition between open
  // states. The column is not mentioned at all, so the UPDATE does not carry
  // it: a dialog that re-sends 'done' on every save (which the task dialog
  // does) must not keep pushing the completion time forward to the last time
  // somebody edited the title.
  return { status: next }
}
