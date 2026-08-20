/**
 * THE one place a task's deadline fields are computed.
 *
 * `due_date` had three independent writers — createTask, updateTask and the
 * palette's quickAssignTask — and grading it adds three invariants that each of
 * them would otherwise have to get right separately:
 *
 *   - `original_due_date` is stamped on the FIRST null -> non-null transition
 *     and never again
 *   - `due_changed_count` increments only on non-null -> DIFFERENT non-null
 *   - `committed` requires a note naming the counterparty
 *
 * Three writers times three invariants is nine places to be wrong, and the
 * first one that is wrong makes the other eight untrustworthy: an
 * `original_due_date` that is right most of the time cannot answer "what did we
 * originally promise", which is the only question it exists for.
 *
 * Pure on purpose — it takes the row's current fields and returns the patch, so
 * it is testable without a database and cannot be bypassed by a caller that
 * happens to hold its own update statement.
 *
 * DATES ARE STRINGS HERE and stay strings. `task-workload.ts` documents why: a
 * `YYYY-MM-DD` compared against a business-timezone today is correct, while
 * `new Date('2026-08-12')` is midnight UTC — still the 11th west of Greenwich.
 * Nothing in this module parses a date.
 */

/**
 * TASKS THAT PREDATE MIGRATION 0049 NEVER GET AN ORIGINAL, AND THAT IS
 * CORRECT.
 *
 * 0049 added `original_due_date` as NULL for every existing row, including the
 * dated ones. Since the stamp fires only on a null -> non-null transition of
 * `due_date`, a task that already had a date when the column arrived will
 * never receive one — so `hasSlipped` answers false for those tasks forever.
 *
 * The alternative was backfilling `original_due_date = due_date`, and it is
 * worse for a reason worth stating: for a task whose date had already moved
 * three times, that backfill asserts it never moved. It would not be a missing
 * answer, it would be a confident wrong one, and it would be indistinguishable
 * from a real first promise ever after. The first promise is genuinely
 * unknowable after the fact, and a column whose whole purpose is "what did we
 * originally say" must not be seeded with a guess.
 *
 * So: no original means no answer, not "no slip". Any UI reading these fields
 * must render the absence as unknown rather than as on-time.
 */
export type DueKind = 'target' | 'committed'

/** The deadline fields as they currently stand on the row. */
export type DueState = {
  dueDate: string | null
  dueKind: DueKind
  originalDueDate: string | null
  dueChangedCount: number
}

/** What the caller is asking for. `note` is only meaningful for 'committed'. */
export type DueChange = {
  dueDate: string | null
  dueKind?: DueKind
  note?: string | null
}

export type DuePatch = {
  dueDate: string | null
  dueKind: DueKind
  dueCommitmentNote: string | null
  originalDueDate: string | null
  dueChangedCount: number
}

export class DueDateError extends Error {}

/**
 * The patch to write for a deadline change.
 *
 * Throws rather than returning a result union because every caller is a server
 * action that already funnels thrown errors into `err()`, and a silent
 * downgrade — quietly writing 'target' because the note was missing — is
 * exactly the failure that would make `committed` meaningless.
 */
export function applyDueDate(current: DueState, change: DueChange): DuePatch {
  const nextDate = change.dueDate
  const nextKind: DueKind = change.dueKind ?? (nextDate === null ? 'target' : current.dueKind)
  const note = change.note?.trim() ? change.note.trim() : null

  // A commitment names who it was made to. Without this, 'committed' decays
  // into a seniority badge — "my manager cares about this one" — which is the
  // failure the grade exists to prevent.
  if (nextKind === 'committed') {
    if (nextDate === null) {
      throw new DueDateError(
        'A commitment needs a date. Clear the commitment first, or give it a day.',
      )
    }
    if (!note) {
      throw new DueDateError('A committed date needs a note naming who it was promised to.')
    }
  }

  // Stamped once, on the first date this task ever had — and NOT re-stamped
  // when a date is cleared and set again. The original promise is the first
  // one; clearing a date is not a new beginning, it is the same task losing
  // its date for a while.
  const originalDueDate =
    current.originalDueDate ?? (current.dueDate === null && nextDate !== null ? nextDate : null)

  // Only a real move counts. First-set is not a move (nothing to move from),
  // clearing is not a move (nothing to move to), and re-writing the same date
  // is not a move at all — a form that saves an unchanged field must not
  // inflate the count.
  const moved = current.dueDate !== null && nextDate !== null && current.dueDate !== nextDate
  const dueChangedCount = current.dueChangedCount + (moved ? 1 : 0)

  return {
    dueDate: nextDate,
    dueKind: nextKind,
    // Dropping to 'target' drops the note with it: a note left behind would
    // name a counterparty for a promise that no longer exists.
    dueCommitmentNote: nextKind === 'committed' ? note : null,
    originalDueDate,
    dueChangedCount,
  }
}

/**
 * Whether a task's deadline has slipped from what was first promised.
 *
 * String comparison, same rule as everywhere else in this feature. Returns
 * false when there is nothing to compare rather than guessing.
 */
export function hasSlipped(state: Pick<DueState, 'dueDate' | 'originalDueDate'>): boolean {
  if (!state.dueDate || !state.originalDueDate) return false
  return state.dueDate > state.originalDueDate
}
