/**
 * Which occurrences belong to the same series, and whether that series is
 * established enough to judge.
 *
 * A "series" is never stored — LogPup's schema has no recurrence concept. It is
 * INFERRED by normalising titles through `seriesKey`, which is the single
 * authority for that and is imported here rather than reimplemented. Every gate
 * the suggestion engine applies starts from this grouping, so a second opinion
 * about which meetings belong together would make every rule's verdict
 * unverifiable.
 *
 * Pure: `now` is injected, never read from the clock.
 */

import { seriesKey } from '@/features/meetings/series-key'

/** At most six occurrences are ever considered, however many exist. */
export const ESTABLISHMENT_WINDOW_OCCURRENCES = 6
/** And never any older than this. */
export const ESTABLISHMENT_WINDOW_DAYS = 180
/** A series with nothing in the last 45 days is not a live series. This is what
 *  ages out the strays a title edit forks off — see `groupIntoSeries`. */
export const ACTIVITY_GATE_DAYS = 45

const DAY_MS = 24 * 60 * 60 * 1000

export interface SeriesOccurrenceInput {
  meetingId: string
  title: string
  appId: string | null
  startsAt: Date
  endsAt: Date
  createdBy: string
  /** ALL invited, UNFILTERED by response. Churn and R3's Jaccard both want the
   *  raw invite set: who was asked is the fact, and who replied is a different
   *  question this feature deliberately does not treat as a signal. */
  inviteUserIds: string[]
}

export interface SeriesGroup {
  groupKey: string
  seriesKey: string
  appId: string | null
  /** A null-app series can never be an R3 SHARE-A-SLOT candidate: with no
   *  project in common there is nothing to say two meetings are two halves of. */
  mergeable: boolean
  /** Newest first, windowed to at most 6 within 180 days of `now`. */
  occurrences: SeriesOccurrenceInput[]
  established: boolean
  activeRecently: boolean
  /** Whoever created the most recent occurrence. Suggestions are
   *  organizer-private, so this is who gets to see them. */
  organizerId: string
}

/**
 * Group occurrences into inferred series.
 *
 * THE `'__none__'` KEY IS DELIBERATE. Two app-less meetings with the same
 * normalised title are ONE series here, because JS `Map` equality says so —
 * unlike SQL, where `NULL != NULL` would have split them into singletons that
 * could never establish. Grouping in JS and grouping in SQL disagreeing about
 * this exact case is the trap; the string sentinel is how this side avoids it.
 *
 * A TITLE EDIT MINTS A NEW SERIES, and that is intended rather than tolerated.
 * "Vela standup" renamed to "Vela retro" normalises to a different key, so the
 * old occurrences and the new ones form two groups, each judged on its own
 * count. It is also the only reason `ACTIVITY_GATE_DAYS` exists: the abandoned
 * half ages out instead of sitting there forever as an established series
 * nobody holds any more.
 *
 * A title that reduces to null (a bare date, "#12") joins no group at all. It
 * is not a series with one occurrence — it is a title this product cannot read.
 */
export function groupIntoSeries(all: SeriesOccurrenceInput[], now: Date): SeriesGroup[] {
  const cutoff = now.getTime() - ESTABLISHMENT_WINDOW_DAYS * DAY_MS
  const activeCutoff = now.getTime() - ACTIVITY_GATE_DAYS * DAY_MS
  const byGroup = new Map<string, { key: string; appId: string | null; rows: SeriesOccurrenceInput[] }>()

  for (const occurrence of all) {
    const key = seriesKey(occurrence.title)
    if (key === null) continue
    const groupKey = `${key}|${occurrence.appId ?? '__none__'}`
    const bucket = byGroup.get(groupKey) ?? { key, appId: occurrence.appId, rows: [] }
    bucket.rows.push(occurrence)
    byGroup.set(groupKey, bucket)
  }

  const groups: SeriesGroup[] = []
  for (const [groupKey, bucket] of byGroup) {
    // Windowed AFTER grouping, not before: an occurrence outside the window
    // still proves the group exists, it just does not count toward
    // establishment. Sorted newest-first because every consumer — churn chains,
    // the last-4 coverage window, R3's last-3 invite sets — reads it that way.
    const occurrences = bucket.rows
      .filter((row) => row.startsAt.getTime() >= cutoff)
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .slice(0, ESTABLISHMENT_WINDOW_OCCURRENCES)

    if (occurrences.length === 0) continue

    groups.push({
      groupKey,
      seriesKey: bucket.key,
      appId: bucket.appId,
      mergeable: bucket.appId !== null,
      occurrences,
      established: occurrences.length >= 2,
      activeRecently: occurrences[0].startsAt.getTime() >= activeCutoff,
      organizerId: occurrences[0].createdBy,
    })
  }

  // Total order, so two renders of unchanged data list series identically.
  return groups.sort((a, b) => a.groupKey.localeCompare(b.groupKey))
}
