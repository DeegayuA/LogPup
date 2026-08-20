import { StatTile } from '@/components/ui/stat-tile'

/**
 * The month in four numbers, each one a StatTile: what the studio expected,
 * what was filed, how those two compare so far, and the current run.
 *
 * DAYS, NEVER HOURS. The percent in a worklog is a self-score of "how much of
 * what I planned", not time — multiplying it into hours would print a lie
 * with two decimal places. Every value here is a day count or a ratio of day
 * counts, and halves are shown as halves ("21.5") because Saturday is half a
 * working day at this studio.
 *
 * Purely presentational; the page's summary zone computes the inputs through
 * computeCoverage so this file can never hold a second opinion about what a
 * day was worth.
 */

/** At most one decimal, no trailing `.0` — the same shape formatCoverage prints. */
const num = (n: number) => String(Math.round(n * 10) / 10)

export function MonthSummary({
  monthLabel,
  expected,
  loggedCount,
  coveragePct,
  coverageDetail,
  streak,
}: {
  /** "August 2026" — captions the tiles so the numbers name their window. */
  monthLabel: string
  /** Owed day-fractions across the WHOLE month: working days after
   *  studio-closing holidays and approved absences. Can be x.5. */
  expected: number
  /** Days with an entry this month — a count of filings, not fractions. */
  loggedCount: number
  /** logged/expected over the days due SO FAR, or null when nothing is due
   *  yet (a fresh month, a mid-month joiner, a not-required seat). */
  coveragePct: number | null
  /** formatCoverage's sentence for the same window — the denominator always
   *  travels with the percentage. */
  coverageDetail: string
  /** Consecutive owed days logged, counting back from today. */
  streak: number
}) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatTile
        label={`Expected in ${monthLabel}`}
        value={num(expected)}
        meta="working days, after holidays and approved leave"
      />
      <StatTile
        label="Logged"
        value={String(loggedCount)}
        meta={loggedCount === 1 ? 'day has an entry this month' : 'days have entries this month'}
      />
      <StatTile
        label="Coverage so far"
        value={coveragePct === null ? '—' : `${coveragePct}%`}
        meta={coverageDetail}
        tone={coveragePct !== null && coveragePct < 60 ? 'attention' : 'default'}
      />
      <StatTile
        label="Streak"
        value={String(streak)}
        meta={
          streak === 0
            ? 'owed days in a row — log today to start one'
            : streak === 1
              ? 'owed day in a row, counting back from today'
              : 'owed days in a row, counting back from today'
        }
        tone={streak >= 5 ? 'positive' : 'default'}
      />
    </div>
  )
}
