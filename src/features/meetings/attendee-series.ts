/**
 * Whether two meeting rows belong to the same inferred series.
 *
 * The NORMALISER that answers "what is this meeting called, ignoring which
 * occurrence it is" moved to `series-key.ts` — it grew a second and third
 * caller (R3 SHARE-A-SLOT, R6 COVER-TOGETHER) that have nothing to do with
 * attendee recommendation, and a shared rule living inside one of its
 * callers is how a copy gets made. What stayed here is the COMPARISON, which
 * is the recommender's own question: two rows, same series or not.
 */

import { seriesKey } from '@/features/meetings/series-key'

/** Minimal shape `sameSeries` needs from a meeting row. */
export interface SeriesCandidate {
  title: string
  /** The app the meeting belongs to, or `null` when unlinked. */
  appId: string | null
}

/**
 * Whether two meetings belong to the same inferred series: equal, non-null
 * `seriesKey` AND equal `appId` (both `null` counts as equal).
 *
 * A `null` key never matches anything, even against another `null` key —
 * two titles that don't reduce to anything nameable are not evidence of a
 * shared series, they're just two titles LogPup can't parse.
 */
export function sameSeries(a: SeriesCandidate, b: SeriesCandidate): boolean {
  const keyA = seriesKey(a.title)
  const keyB = seriesKey(b.title)
  if (keyA === null || keyB === null) return false
  return keyA === keyB && a.appId === b.appId
}
