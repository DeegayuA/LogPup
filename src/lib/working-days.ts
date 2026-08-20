import { isMercantileHoliday } from '@/lib/lk-holidays'

/**
 * What counts as a working day at this studio, in one place.
 *
 * THE ONE DEFINITION. Three separate features need to answer "how many
 * working days was that" — the work log's missed-day backfill, the people
 * KPI baseline (docs/superpowers/plans/…people-kpis.md, which computes a
 * weekly baseline from qualifying weeks) and the invited-hours metric
 * (…meeting-load-reduction.md, which buckets by Colombo week). If each
 * decides for itself, the studio ends up with three different answers to
 * the same question, and the first person to notice will be the one whose
 * number looks wrong.
 *
 * A sibling module rather than an addition to lk-holidays.ts: that file is
 * the gazetted-holiday DATA and its formatters, whereas this is studio
 * POLICY about which days are worked. They change for different reasons and
 * at different times — the holiday map is updated when the government
 * gazettes, this is updated when the studio changes its week.
 */

/** Saturday is a half day here; Sunday is off. */
export type WorkingDayFraction = 0 | 0.5 | 1

/**
 * How much of a working day `iso` is.
 *
 *   1    Monday to Friday
 *   0.5  Saturday — a half day at this studio
 *   0    Sunday, and any holiday that excuses work
 *
 * "Excuses work" is `isMercantileHoliday`, NOT "appears in the gazette": only
 * the Mercantile list closes shops and offices, so the bank closing days are
 * full working days here and always were — the studio just used to be told
 * otherwise. Callers that COMPOSE holidays (org_holidays stacked on the
 * gazette) build their predicate from that same function, so there is one
 * answer to "is this a day off" rather than one per feature.
 *
 * A holiday always wins over Saturday: a Saturday mercantile holiday is a
 * holiday, not a half day, and treating it as half would leave an entry in
 * everyone's backfill list that they were never expected to work.
 */
export function workingDayFraction(
  iso: string,
  isHoliday: (iso: string) => boolean = isMercantileHoliday,
): WorkingDayFraction {
  if (isHoliday(iso)) return 0
  // Midday UTC: far enough from either boundary that the ±05:30 Colombo
  // offset cannot tip the weekday to its neighbour.
  const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay()
  if (weekday === 0) return 0
  if (weekday === 6) return 0.5
  return 1
}

/** Whether any work is expected on `iso` at all — a half day still counts. */
export function isWorkingDay(
  iso: string,
  isHoliday: (iso: string) => boolean = isMercantileHoliday,
): boolean {
  return workingDayFraction(iso, isHoliday) > 0
}

/** Whether `iso` is one of the half days, for UI that should say so. */
export function isHalfWorkingDay(
  iso: string,
  isHoliday: (iso: string) => boolean = isMercantileHoliday,
): boolean {
  return workingDayFraction(iso, isHoliday) === 0.5
}
