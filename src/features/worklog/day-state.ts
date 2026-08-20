import { workingDayFraction } from '@/lib/working-days'

/**
 * THE one visual vocabulary for "what kind of day is this" — shared by the
 * /worklog month calendar and the /progress people×days matrix so the two
 * surfaces cannot drift into different colours for the same fact.
 *
 * Pure classification + literal class maps (literal so Tailwind's scanner
 * sees every class — same rule as event-color.ts). No React in here.
 *
 * Priority order, and why it is this order:
 *   holiday   — a day the studio closed excuses everything else on it
 *   absence   — an approved absence excuses logging even on a working day
 *   off       — Sunday: never expected
 *   logged    — an answer exists
 *   owed      — a working day with no answer, today or earlier
 *   future    — not yet askable (upsertDailyWorklog rejects future days)
 *   outside   — before the person joined, or outside the asked range
 */
export type DayState =
  | 'holiday'
  | 'absence'
  | 'off'
  | 'logged'
  | 'owed'
  | 'future'
  | 'outside'

export type DayInput = {
  /** ISO day (YYYY-MM-DD), Asia/Colombo semantics — same contract as the
   *  rest of the worklog feature (see worklog-day.ts). */
  iso: string
  /** Self-scored percent, when the day was logged. */
  percent?: number
  /** Day is covered by an APPROVED absence. Pending ones don't excuse. */
  absent?: boolean
  /** Day closes the studio: gazetted mercantile OR org holiday that
   *  `closesTheStudio` — compose upstream, pass one boolean here. */
  holiday?: boolean
  /** Today, as an ISO day in Asia/Colombo (resolveWorkDay(new Date())). */
  today: string
  /** First day the person is expected to log, if known (join day). */
  joinDay?: string | null
}

export function classifyDay(d: DayInput): DayState {
  if (d.joinDay && d.iso < d.joinDay) return 'outside'
  if (d.holiday) return 'holiday'
  if (d.absent) return 'absence'
  const fraction = workingDayFraction(d.iso, () => d.holiday ?? false)
  if (fraction === 0) return 'off'
  if (d.percent !== undefined) return 'logged'
  if (d.iso > d.today) return 'future'
  return 'owed'
}

/** Whether the day is a half working day (Saturday) — a MODIFIER on top of
 *  the state, never a state itself: a logged half day is still logged. */
export function isHalfDay(iso: string, holiday = false): boolean {
  return workingDayFraction(iso, () => holiday) === 0.5
}

/**
 * Cell classes per state. Colour never carries the state alone — every cell
 * also renders `dayStateLabel` for screen readers, and logged cells show
 * their percent as text at md+. Logged opacity comes from `loggedTone`.
 */
export const DAY_STATE_CLASS: Record<DayState, string> = {
  // Fill applied via loggedTone; this is the shared chrome.
  logged: 'text-primary-foreground',
  owed: 'ring-1 ring-inset ring-chart-1/70 text-chart-1',
  absence: 'bg-tag-discussion/15 text-tag-discussion',
  holiday: 'bg-holiday/15 text-holiday',
  off: 'bg-muted/40 text-muted-foreground/60',
  future: 'text-muted-foreground/50',
  outside: 'text-muted-foreground/30',
}

/**
 * Logged fill in four legible steps rather than a continuous alpha —
 * continuous opacity below ~35% stops being distinguishable from the page
 * and would make a 10% day read as "not logged" at a glance.
 */
export function loggedTone(percent: number): string {
  if (percent >= 80) return 'bg-primary'
  if (percent >= 50) return 'bg-primary/75'
  if (percent >= 25) return 'bg-primary/55'
  return 'bg-primary/35'
}

export const DAY_STATE_LABEL: Record<DayState, string> = {
  logged: 'Logged',
  owed: 'Not logged yet',
  absence: 'On approved absence',
  holiday: 'Holiday',
  off: 'Day off',
  future: 'Upcoming',
  outside: 'Before joining',
}

/** Screen-reader sentence for one cell: "12 — Logged, 80%" / "14 — Holiday". */
export function dayStateText(d: DayInput): string {
  const state = classifyDay(d)
  const day = Number(d.iso.slice(8, 10))
  const base = `${day} — ${DAY_STATE_LABEL[state]}`
  if (state === 'logged' && d.percent !== undefined) return `${base}, ${d.percent}%`
  if (isHalfDay(d.iso, d.holiday)) return `${base}, half day`
  return base
}
