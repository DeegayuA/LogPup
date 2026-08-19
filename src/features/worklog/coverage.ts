import { STUDIO_DEFAULT_PATTERN, type SchedulePattern } from '@/features/worklog/schedules'

/**
 * Turns "there is no worklog row for this date" into a defensible answer.
 *
 * Today that absence means five different things — on leave, on a public
 * holiday, allocated elsewhere, part-time and not expected, or genuinely
 * missing — and the panel cannot tell them apart, so every coverage number it
 * could show is wrong for anyone who does not log daily.
 *
 * PURE AND SYNCHRONOUS. Every input arrives as data, so the whole module is
 * testable without a database. `coverage-queries.ts` does the fetching.
 *
 * It does not re-derive day maths. `workingDayFraction` already returns
 * 1 / 0.5 / 0 and already folds holidays to 0, with "a holiday always wins
 * over Saturday" documented there. This generalizes that one function to a
 * per-user pattern and duplicates none of it.
 */

export type CoverageStatus = 'logged' | 'off' | 'exempt' | 'not-yet-due' | 'missing'

export type CoverageInput = {
  /** Half-open [from, to) as Asia/Colombo ISO days. */
  from: string
  to: string
  /** Days the person actually logged. */
  loggedDays: ReadonlySet<string>
  /** APPROVED absences only. A pending absence never exempts a day. */
  exemptDays: ReadonlySet<string>
  /** Gazetted holidays merged with org_holidays by the caller. */
  isHoliday: (iso: string) => boolean
  /** Effective-dated schedule lookup; the studio default when no row covers the day. */
  patternFor: (iso: string) => SchedulePattern
  /** First day the person owed work. Earlier days never count. */
  joinedOn: string
  /** Today in Asia/Colombo. Today and later are never 'missing'. */
  today: string
}

export type CoverageDay = {
  day: string
  status: CoverageStatus
  /** The day's owed fraction — 0 when off. Carried so the UI never recomputes it. */
  fraction: number
}

export type CoverageSummary = {
  days: CoverageDay[]
  /** Owed day-fractions. INVARIANT: expected === logged + missing. */
  expected: number
  logged: number
  missing: number
  /** Fractions an approved absence removed from the denominator. */
  exempt: number
  /** Whole days nobody owed — Sunday, holiday, schedule zero. A count. */
  off: number
  notYetDue: number
  /** Logs filed on days that were not owed. A count; never enters `expected`. */
  extra: number
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function weekdayKey(iso: string): keyof SchedulePattern {
  // Midday UTC: far enough from either boundary that the +05:30 Colombo offset
  // cannot tip the weekday to its neighbour. Same guard as working-days.ts.
  return WEEKDAY_KEYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  for (let d = new Date(`${from}T12:00:00Z`); ; d = new Date(d.getTime() + 86_400_000)) {
    const iso = d.toISOString().slice(0, 10)
    if (iso >= to) break
    days.push(iso)
  }
  return days
}

/** Floating-point guard: 0.5 sums drift, and a denominator that reads 3.9999 is a bug. */
const round = (n: number) => Math.round(n * 100) / 100

export function computeCoverage(input: CoverageInput): CoverageSummary {
  const days: CoverageDay[] = []
  let expected = 0
  let logged = 0
  let missing = 0
  let exempt = 0
  let off = 0
  let notYetDue = 0
  let extra = 0

  for (const day of eachDay(input.from, input.to)) {
    const pattern = input.patternFor(day) ?? STUDIO_DEFAULT_PATTERN
    // A holiday folds the fraction to 0, exactly as workingDayFraction does,
    // which is why one rule below covers Sunday, gazetted holiday, org holiday
    // and a schedule that says zero.
    const fraction = input.isHoliday(day) ? 0 : pattern[weekdayKey(day)]

    const isLogged = input.loggedDays.has(day)
    const isExempt = input.exemptDays.has(day)
    const isDue = day >= input.joinedOn && day < input.today
    // Owed = the studio actually expected a log. Everything else is excluded
    // from the denominator, which is the entire point of this module.
    const owed = isDue && fraction > 0 && !isExempt

    let status: CoverageStatus
    if (!isDue) {
      // 1 + 2. Nobody owes work before they start, and today is still in
      // progress — counting it missing accuses the whole team every morning.
      status = 'not-yet-due'
      notYetDue += 1
    } else if (isLogged) {
      // 3. LOGGED OUTRANKS OFF AND EXEMPT. Someone who worked a public holiday,
      // or worked during approved leave, has that work counted. The opposite
      // order silently discards real work.
      status = 'logged'
      if (owed) {
        expected += fraction
        logged += fraction
      } else {
        extra += 1
      }
    } else if (fraction === 0) {
      status = 'off'
      off += 1
    } else if (isExempt) {
      status = 'exempt'
      exempt += fraction
    } else {
      status = 'missing'
      expected += fraction
      missing += fraction
    }

    days.push({ day, status, fraction })
  }

  return {
    days,
    expected: round(expected),
    logged: round(logged),
    missing: round(missing),
    exempt: round(exempt),
    off,
    notYetDue,
    extra,
  }
}

/** At most one decimal, no trailing `.0`. `3.5` stays, `4.0` becomes `4`. */
const num = (n: number) => String(Math.round(n * 10) / 10)

/**
 * The ONLY way a coverage figure reaches a screen.
 *
 * There is deliberately no parameter that produces a bare percentage: a
 * percentage without its denominator is the exact bug this feature exists to
 * fix, so the shape that caused it is not expressible here.
 */
export function formatCoverage(s: CoverageSummary): string {
  const parts = [`${num(s.logged)}/${num(s.expected)} expected days logged`]
  parts.push(`${num(s.exempt)} exempt`)
  if (s.extra > 0) parts.push(`${s.extra} extra`)
  return parts.join(' · ')
}
