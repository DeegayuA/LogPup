/**
 * The shared rules for one worklog time entry — totals, display formatting,
 * and the category/task rule.
 *
 * PURE AND SYNCHRONOUS, the same contract as coverage.ts: every input arrives
 * as data, so the whole module is testable without a database and without a
 * clock. `entry-actions.ts` does the writing and `entry-check.ts` does the
 * cross-checking; neither re-derives anything defined here.
 */

/**
 * What KIND of work an hour was. Mirrors the `worklog_entry_category` pg enum
 * — the schema is the source of truth for the values, and this array exists
 * so zod and the UI can iterate them without importing the database schema
 * into a client bundle.
 */
export const ENTRY_CATEGORIES = [
  'task', 'meeting', 'review', 'support', 'admin', 'learning', 'other',
] as const
export type EntryCategory = (typeof ENTRY_CATEGORIES)[number]

/** Mirrors the `worklog_entry_source` pg enum. */
export const ENTRY_SOURCES = ['manual', 'ai_suggested'] as const
export type EntrySource = (typeof ENTRY_SOURCES)[number]

/**
 * An entry of zero minutes is not a record of anything, and 24 hours is the
 * hard ceiling a single calendar day can contain. Both are sanity rails on a
 * typo (90 typed as 900), NOT a policy about how long a day should be — see
 * the note on accountedFraction.
 */
export const ENTRY_MINUTES_MIN = 1
export const ENTRY_MINUTES_MAX = 24 * 60

export const ENTRY_NOTE_MAX = 500

/** The shape every total in this module is computed over. */
export type EntryMinutes = { minutes: number }

/**
 * What a day adds up to.
 *
 * Callers pass LIVE entries only — soft-deleted rows are filtered at the
 * query layer through `liveWorklogEntries` (src/db/live.ts), never here, so
 * this function never has to know what a deleted entry is.
 */
export function totalMinutes(entries: readonly EntryMinutes[]): number {
  return entries.reduce((sum, entry) => sum + entry.minutes, 0)
}

/**
 * Minutes as hours for display: at most one decimal, no trailing `.0`.
 * `390` reads `6.5`, `480` reads `8`, `100` reads `1.7`.
 *
 * The rounding rule deliberately MATCHES `num()` in coverage.ts, which is how
 * every other worklog figure already reaches a screen. It is duplicated
 * rather than imported because that one is module-private; if coverage.ts
 * ever exports it, this should call it instead of keeping a second copy.
 *
 * Returns the bare number, never a unit — the caller supplies "h" or "hours"
 * so a figure and its denominator ("6.5 / 8") can be formatted as one phrase
 * instead of "6.5h / 8h".
 */
export function formatHours(minutes: number): string {
  return String(Math.round((minutes / 60) * 10) / 10)
}

/**
 * How much of a scheduled day is accounted for, as a fraction — the number
 * the UI renders as "Accounted".
 *
 * NEVER CALL THIS "PERCENT", and never put its output on a tile beside
 * `daily_worklogs.percent`. That column is a JUDGEMENT ("of what I set out to
 * do, how much did I get done"); this is COVERAGE ("how much of my scheduled
 * day is accounted for"). A good day can be 1.0 here and 0.6 there. Two
 * numbers under two names is healthy; two numbers under one name is how this
 * repo already ended up with FOLLOWUP_STALE_DAYS exported twice as 14 and 21.
 *
 * `scheduledMinutes` IS REQUIRED AND HAS NO DEFAULT, on purpose.
 *
 * THERE IS NO MINUTES-PER-FULL-DAY CONSTANT IN THIS REPO, AND THIS MODULE
 * MUST NOT INVENT ONE. `patternForDay` (schedules.ts) returns a FRACTION per
 * weekday — mon–fri 1, sat 0.5, sun 0 — and coverage is computed in fractions
 * end to end. Nothing anywhere states how many minutes a fraction of 1 is
 * worth. Whether a full day is 8h, 8.5h or 9h is a PRODUCT DECISION that
 * belongs to the studio and is still pending; it is not this function's to
 * pick, and a `?? 480` here would quietly become the answer for the whole app
 * without anybody deciding it.
 *
 * When that decision lands it belongs in ONE place, beside
 * STUDIO_DEFAULT_PATTERN in schedules.ts — the pattern and the day length
 * together are the whole definition of "how long is this person's day", and
 * splitting them across two files is how the two halves start disagreeing.
 *
 * Returns NULL, meaning "cannot say", when no day length is known or the day
 * is scheduled to zero (Sunday, a holiday, approved leave). A zero
 * denominator must never divide, and a day nobody owed work on has no
 * fraction to report — 0, 1 and Infinity are all lies about it. The null is
 * in the return type so a caller has to handle "we don't know" explicitly
 * rather than rendering a number computed against an assumption.
 *
 * NOT clamped at 1. Logging ten hours against an eight-hour day genuinely
 * returns 1.25, and that is information — clamping would hide the long day
 * this check exists partly to notice. The UI caps the BAR, not the number.
 */
export function accountedFraction(
  totalMinutesLogged: number,
  scheduledMinutes: number,
): number | null {
  if (!Number.isFinite(scheduledMinutes) || scheduledMinutes <= 0) return null
  return totalMinutesLogged / scheduledMinutes
}

/** What `validateEntry` is asked about. `taskId` absent and null both mean "no task". */
export type EntryInput = {
  minutes: number
  category: EntryCategory | (string & {})
  taskId?: string | null
  note?: string | null
}

export type EntryProblem =
  | 'unknown-category'
  | 'minutes-not-whole'
  | 'minutes-too-small'
  | 'minutes-too-large'
  | 'task-required'
  | 'task-forbidden'
  | 'note-too-long'

export type EntryValidation =
  | { ok: true }
  | { ok: false; problem: EntryProblem; message: string }

/**
 * The category/task rule, plus the sanity rails on minutes.
 *
 * `category === 'task'` REQUIRES a taskId; every other category FORBIDS one.
 * A meeting is not a task and must not borrow a task's identity, or every
 * per-task hour total silently absorbs the meetings held about that task.
 *
 * ENFORCED HERE, IN CODE, DELIBERATELY NOT AS A CHECK CONSTRAINT. task_id is
 * ON DELETE SET NULL, so a task deleted next year would retroactively turn an
 * old `('task', <id>)` row into `('task', null)` and a constraint would make
 * that stored row unsavable — a rule about what you may WRITE becoming a rule
 * about what may continue to EXIST. The hours were still worked.
 *
 * Messages are the ones a person reads, so the action can return them
 * verbatim rather than inventing a second set of words for the same rule.
 */
export function validateEntry(input: EntryInput): EntryValidation {
  const fail = (problem: EntryProblem, message: string): EntryValidation =>
    ({ ok: false, problem, message })

  if (!(ENTRY_CATEGORIES as readonly string[]).includes(input.category)) {
    return fail('unknown-category', 'Pick what kind of work that was')
  }

  if (!Number.isInteger(input.minutes)) {
    return fail('minutes-not-whole', 'Enter the time in whole minutes')
  }
  if (input.minutes < ENTRY_MINUTES_MIN) {
    return fail('minutes-too-small', 'That entry has no time on it')
  }
  if (input.minutes > ENTRY_MINUTES_MAX) {
    return fail('minutes-too-large', 'A single entry cannot be longer than a day')
  }

  const hasTask = input.taskId != null && input.taskId !== ''
  if (input.category === 'task' && !hasTask) {
    return fail('task-required', 'Pick the task that time went to')
  }
  if (input.category !== 'task' && hasTask) {
    return fail('task-forbidden', 'Only task entries can name a task')
  }

  if ((input.note?.length ?? 0) > ENTRY_NOTE_MAX) {
    return fail('note-too-long', 'That note is too long')
  }

  return { ok: true }
}
