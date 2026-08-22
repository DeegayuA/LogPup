/**
 * How long a notification row is kept, and which rows a tick may delete.
 *
 * A notification is an ephemeral operational record, not user content: it is
 * the only table in this schema whose "delete" is a real DELETE (see the
 * `dismissed_at`-is-deliberately-not-`deletedAt` comment in schema.ts). That
 * makes the retention rule the one thing standing between a scheduled job and
 * rows nobody meant to lose, so it lives here — by value, testable, with no
 * database and no clock of its own — rather than as a WHERE clause inside the
 * cron route where the only way to check it is to run it.
 *
 * PURE by construction: no `@/db`, no `new Date()`. `now` is a parameter
 * because the two windows below must be measured from the same instant. A
 * function that asked the clock twice could put the same row on both sides of
 * its own cutoff.
 *
 * Deliberately NOT built on `iso-day.ts`: a retention window is a duration,
 * not a calendar bucket. There is no weekday grid to line up with, and
 * rounding to Colombo calendar days would make the cutoff jump by up to a day
 * depending on what hour the tick happened to fire.
 */

export type RetentionPolicy = {
  /**
   * Days a DISMISSED row survives after the reader cleared it. Short, but not
   * zero: dismissing is a one-click action with no confirmation, so the row
   * has to stay readable in the inbox long enough for "I cleared that by
   * mistake" to be recoverable.
   */
  dismissedDays: number
  /**
   * Days ANY row survives after it was created — dismissed, read, or never
   * opened. This is the ceiling that keeps an inactive account's bell from
   * accruing forever. It applies to unread rows too, and that is a decision
   * rather than an oversight: a notification nobody acted on in three months
   * is not one they are going to act on, and the fact it described still sits
   * on its own surface (the task, the meeting, the promises list).
   */
  maxAgeDays: number
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  dismissedDays: 30,
  maxAgeDays: 90,
}

const DAY_MS = 86_400_000

/** The two instants a row's timestamps are compared against. */
export type RetentionCutoffs = {
  /** A row dismissed strictly before this is prunable. */
  dismissedBefore: Date
  /** A row created strictly before this is prunable whatever its state. */
  createdBefore: Date
}

/** Why a row was chosen for deletion. `null` from `pruneReason` means keep. */
export type PruneReason = 'dismissed' | 'aged-out'

/** The columns the decision actually reads. Anything else may ride along. */
export type RetentionCandidate = {
  createdAt: Date
  dismissedAt: Date | null
}

export type RetentionDecision<T> = {
  row: T
  reason: PruneReason
}

export type RetentionPlan<T> = {
  /** Rows to delete, each carrying the rule that condemned it. */
  prune: RetentionDecision<T>[]
  /** Rows the caller passed in that survive this tick. */
  keep: T[]
}

function assertUsable(now: Date, policy: RetentionPolicy): void {
  // An Invalid Date propagates into both cutoffs, every comparison against it
  // is false, and the tick then reports "0 pruned" forever while looking
  // healthy. A policy of 0 days is the opposite failure and much worse: it
  // makes every row written today older than its own cutoff. Both are bugs in
  // the caller, and both are silent unless this throws.
  if (Number.isNaN(now.getTime())) throw new RangeError('retention: `now` is an Invalid Date')
  if (!(policy.dismissedDays > 0)) {
    throw new RangeError(`retention: dismissedDays must be > 0, got ${policy.dismissedDays}`)
  }
  if (!(policy.maxAgeDays > 0)) {
    throw new RangeError(`retention: maxAgeDays must be > 0, got ${policy.maxAgeDays}`)
  }
}

/**
 * The cutoffs for a tick running at `now`.
 *
 * Exported so the cron route can pre-filter in SQL with the same numbers the
 * per-row decision uses. One source for both halves is the point: a SQL
 * predicate and a JS predicate that drift apart is a job that deletes rows its
 * own tests say it keeps.
 */
export function retentionCutoffs(
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): RetentionCutoffs {
  assertUsable(now, policy)
  return {
    dismissedBefore: new Date(now.getTime() - policy.dismissedDays * DAY_MS),
    createdBefore: new Date(now.getTime() - policy.maxAgeDays * DAY_MS),
  }
}

/**
 * Why this row should go, or `null` to keep it.
 *
 * Both windows are strict (`<`), so a row sitting exactly on its cutoff
 * survives one more tick. That direction is chosen on purpose: the cost of
 * keeping a row a day longer is a row, and the cost of the other rounding is a
 * row somebody could still have read.
 *
 * `dismissed` is reported ahead of `aged-out` for a row that satisfies both,
 * so the tick's counts read as "how much work the normal path is doing" rather
 * than shifting between reasons as old rows drift past the ceiling.
 */
export function pruneReason(
  row: RetentionCandidate,
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): PruneReason | null {
  const cutoffs = retentionCutoffs(now, policy)
  if (row.dismissedAt !== null && row.dismissedAt.getTime() < cutoffs.dismissedBefore.getTime()) {
    return 'dismissed'
  }
  if (row.createdAt.getTime() < cutoffs.createdBefore.getTime()) return 'aged-out'
  return null
}

/**
 * Split candidate rows into what a tick deletes and what it leaves.
 *
 * Returns the decision, never performs it — the caller holds the database
 * handle, and keeping the two apart is what lets the whole rule be asserted
 * against real timestamps in a unit test.
 */
export function planRetention<T extends RetentionCandidate>(
  rows: readonly T[],
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): RetentionPlan<T> {
  // Resolved once for the whole batch rather than per row: pruneReason would
  // rebuild the same two cutoffs for every candidate, and a batch is thousands
  // of rows on the first tick after this ships.
  const cutoffs = retentionCutoffs(now, policy)
  const prune: RetentionDecision<T>[] = []
  const keep: T[] = []
  for (const row of rows) {
    if (row.dismissedAt !== null && row.dismissedAt.getTime() < cutoffs.dismissedBefore.getTime()) {
      prune.push({ row, reason: 'dismissed' })
    } else if (row.createdAt.getTime() < cutoffs.createdBefore.getTime()) {
      prune.push({ row, reason: 'aged-out' })
    } else {
      keep.push(row)
    }
  }
  return { prune, keep }
}

/**
 * How many rows each rule condemned.
 *
 * Every reason is present with an explicit 0 rather than omitted, because a
 * tick that pruned nothing under a rule and a tick that never evaluated the
 * rule are different facts, and the response is the only place either one is
 * ever visible.
 */
export function summarizeRetention(
  decisions: readonly RetentionDecision<unknown>[],
): Record<PruneReason, number> {
  const counts: Record<PruneReason, number> = { dismissed: 0, 'aged-out': 0 }
  for (const decision of decisions) counts[decision.reason] += 1
  return counts
}
