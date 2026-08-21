/**
 * How much a series' invite list moves between occurrences.
 *
 * A COUNT, NEVER NAMES. Churn says "this series has not settled on who it is
 * for" — a property of the series. Which specific people came and went is a
 * different claim about individuals, and at nine people it de-anonymises
 * instantly, so it is not computed here and not available to render.
 *
 * Pure, and it never indexes past its input: the caller hands over a clean
 * newest-first array, and a series with one occurrence has no consecutive pair
 * rather than a crash.
 */

export interface OccurrenceInvites { meetingId: string; inviteUserIds: string[] }

/** The symmetric difference: everyone who joined plus everyone who left. */
export function inviteChurnBetween(older: OccurrenceInvites, newer: OccurrenceInvites): number {
  const before = new Set(older.inviteUserIds)
  const after = new Set(newer.inviteUserIds)
  let changed = 0
  for (const id of before) if (!after.has(id)) changed += 1
  for (const id of after) if (!before.has(id)) changed += 1
  return changed
}

/** Summed over every consecutive pair. Zero for a single occurrence — there is
 *  no pair to compare, which is not the same as a settled invite list, and the
 *  surface says which by showing the occurrence count beside it. */
export function seriesChurnCount(occurrencesNewestFirst: OccurrenceInvites[]): number {
  let total = 0
  for (let i = 0; i + 1 < occurrencesNewestFirst.length; i += 1) {
    total += inviteChurnBetween(occurrencesNewestFirst[i + 1], occurrencesNewestFirst[i])
  }
  return total
}
