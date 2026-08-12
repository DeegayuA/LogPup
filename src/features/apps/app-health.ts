/**
 * Pure derivation math behind the /apps portfolio: sprint day-progress, the
 * per-app health verdict, and the workspace roll-up shown above the grid.
 *
 * WHY THIS IS ITS OWN MODULE
 * Every number on an app card is an opinion ("is this app in trouble?"), and
 * an opinion nobody can inspect is worse than no opinion at all. Keeping the
 * whole verdict in one dependency-free module means (a) it is unit-tested
 * without a database, and (b) the weights below are in ONE place, so tuning
 * "how bad is an overdue task" is a one-line change rather than an audit of
 * every component that draws a red dot.
 *
 * CALENDAR-DATE SPACE, NOT TIMESTAMPS
 * `sprints.start_date` / `sprints.end_date` / `tasks.due_date` are Postgres
 * `date` columns, and every function here speaks the same plain `yyyy-mm-dd`
 * language. Dates are parsed into y/m/d components and run through `Date.UTC`
 * for arithmetic, then compared as strings where ordering is all that matters
 * (ISO dates sort lexicographically). That "never touch local getters" rule is
 * what stops a sprint ending "yesterday" for a reader in a different timezone.
 * The single exception is `parseCalendarDate`, which exists precisely so the
 * one place that DOES need a Date (date-fns `format`) has a correct, shared
 * implementation instead of the `new Date(iso + 'T12:00:00')` idiom that was
 * previously copy-pasted into three files.
 *
 * `today` is always a caller-supplied `yyyy-mm-dd`. Callers must compute it
 * with `toIsoDateInTimeZone(new Date(), LK_TIMEZONE)` (lib/lk-holidays), which
 * is what the sprint queries already do — passing a machine-local date here
 * would make a server in another region disagree with the rest of the app.
 */

import { isSprintRunningNow, type SprintStatus } from '@/features/sprints/sprint-date-range'

export type AppStatus = 'active' | 'paused' | 'archived'

export type AppTaskCounts = {
  todo: number
  in_progress: number
  done: number
  total: number
  /** Not-done tasks whose `due_date` is strictly before today. */
  overdue: number
}

export type AppSprintSnapshot = {
  id: string
  name: string
  startDate: string
  endDate: string
  status: SprintStatus
}

export type SprintPhase = 'upcoming' | 'running' | 'ended'

export type SprintProgress = {
  /** Inclusive calendar span of the sprint; always >= 1. */
  totalDays: number
  /** Days of that span already consumed, clamped to [0, totalDays]. */
  elapsedDays: number
  /** end − today in whole days: 0 = ends today, negative = already overrun. */
  remainingDays: number
  /** elapsedDays / totalDays as a rounded percentage. */
  pct: number
  phase: SprintPhase
}

// ---------------------------------------------------------------------------
// Calendar-date helpers
// ---------------------------------------------------------------------------

function utcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

const MS_PER_DAY = 86_400_000

/** Whole calendar days from `fromIso` to `toIso`; negative when `to` is earlier. */
export function dayDiff(fromIso: string, toIso: string): number {
  return Math.round((utcMs(toIso) - utcMs(fromIso)) / MS_PER_DAY)
}

/** Inclusive day count spanning `start`..`end` — the same day counts as 1. */
export function inclusiveDayCount(startIso: string, endIso: string): number {
  return dayDiff(startIso, endIso) + 1
}

/**
 * Days elapsed between a past calendar date and `today`. Null in, null out —
 * "never happened" is a distinct answer from "happened 0 days ago", and the
 * health rules below treat them differently.
 */
export function daysSince(iso: string | null, today: string): number | null {
  if (!iso) return null
  return dayDiff(iso, today)
}

/**
 * A `date` column rendered as a Date for date-fns formatting, anchored at
 * LOCAL noon. Handing `new Date('2026-08-11')` to a formatter parses it as UTC
 * midnight, which renders as the 10th anywhere west of Greenwich; noon leaves
 * ~12 hours of slack in both directions, so no real timezone shifts the day.
 */
export function parseCalendarDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

// ---------------------------------------------------------------------------
// Sprint progress
// ---------------------------------------------------------------------------

export function sprintDayProgress(
  startDate: string,
  endDate: string,
  today: string,
): SprintProgress {
  // A malformed/inverted range would otherwise divide by zero and produce
  // Infinity% — clamp to a single day so the bar renders as "day 1 of 1"
  // rather than blowing up the layout.
  const totalDays = Math.max(inclusiveDayCount(startDate, endDate), 1)
  const remainingDays = dayDiff(today, endDate)
  const phase: SprintPhase =
    today < startDate ? 'upcoming' : today > endDate ? 'ended' : 'running'
  // Clamped rather than branched on `phase`: before the sprint starts the
  // inclusive count is zero or negative, after it ends it overshoots
  // `totalDays`, and both ends want to be pinned to the bar's edge anyway.
  const elapsedDays = Math.min(Math.max(inclusiveDayCount(startDate, today), 0), totalDays)
  return {
    totalDays,
    elapsedDays,
    remainingDays,
    pct: Math.round((elapsedDays / totalDays) * 100),
    phase,
  }
}

/** Share of an app's tasks that are done, 0 when it has no tasks at all. */
export function completionPct(tasks: AppTaskCounts): number {
  if (tasks.total <= 0) return 0
  return Math.round((tasks.done / tasks.total) * 100)
}

/**
 * The sprint a human would point at and call "the one we're in". Reuses
 * `isSprintRunningNow` (sprint-date-range.ts) so this page and the dashboard
 * can never disagree about what "running" means — notably, a sprint still
 * flagged 'active' whose end date has passed IS current, which is exactly the
 * case `appHealth` needs to see in order to flag it.
 *
 * Ties are broken by the soonest end date: when two sprints are running, the
 * one about to close is the one with a deadline attached to it.
 */
export function pickCurrentSprint(
  sprints: readonly AppSprintSnapshot[],
  today: string,
): AppSprintSnapshot | null {
  let best: AppSprintSnapshot | null = null
  for (const sprint of sprints) {
    if (!isSprintRunningNow(sprint.status, sprint.startDate, sprint.endDate, today)) continue
    if (!best || sprint.endDate < best.endDate) best = sprint
  }
  return best
}

/** The soonest sprint that has not started yet — what to show when nothing is running. */
export function pickNextSprint(
  sprints: readonly AppSprintSnapshot[],
  today: string,
): AppSprintSnapshot | null {
  let best: AppSprintSnapshot | null = null
  for (const sprint of sprints) {
    if (sprint.status === 'done') continue
    if (sprint.startDate <= today) continue
    if (!best || sprint.startDate < best.startDate) best = sprint
  }
  return best
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export type HealthLevel = 'at-risk' | 'watch' | 'on-track' | 'dormant'

export type AppHealth = {
  level: HealthLevel
  /** Higher is worse. Exposed so the grid can sort by it. */
  score: number
  /** Plain-language reasons, strongest first. Rendered verbatim in the UI. */
  reasons: string[]
}

export type AppHealthInput = {
  status: AppStatus
  tasks: AppTaskCounts
  currentSprint: AppSprintSnapshot | null
  sprintCount: number
  memberCount: number
  leadId: string | null
  /** Calendar date of the most recent thing that happened, or null. */
  lastActivityOn: string | null
}

/**
 * WEIGHTS — deliberately coarse. These are not a model, they are a way to get
 * the three or four apps that need a human onto the top of the grid. Anything
 * finer-grained would be false precision, and would make the "why is this
 * card red" explanation below impossible to write honestly.
 */
const SPRINT_OVERRUN_POINTS = 40
const OVERDUE_POINTS_EACH = 5
const OVERDUE_POINTS_CAP = 30
const BURN_GAP_POINTS = 15
const NO_SPRINT_POINTS = 10
const NO_TEAM_POINTS = 10
const NO_LEAD_POINTS = 5
const STALE_POINTS = 10

/** Time-elapsed minus work-done, in percentage points, before it reads as a problem. */
export const BURN_GAP_THRESHOLD = 25
/** An active app with nothing happening for this long is drifting. */
export const STALE_ACTIVITY_DAYS = 21

const AT_RISK_SCORE = 30
const WATCH_SCORE = 10

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  'at-risk': 'At risk',
  watch: 'Watch',
  'on-track': 'On track',
  dormant: 'Archived',
}

export function appHealth(input: AppHealthInput, today: string): AppHealth {
  // An archived app is not "healthy" or "unhealthy", it is finished. Scoring
  // it would flood the at-risk count with projects nobody is working on.
  if (input.status === 'archived') {
    return { level: 'dormant', score: 0, reasons: [] }
  }

  // A brand-new app trips almost every rule below at once (no sprint, no team,
  // no lead, no activity) and would open life as the reddest card on the page
  // — which teaches people to ignore the colour. "Nothing has ever happened
  // here" is its own state, and it is a setup prompt, not an alarm.
  const untouched =
    input.tasks.total === 0 && input.sprintCount === 0 && input.lastActivityOn === null
  if (untouched) {
    return { level: 'watch', score: 0, reasons: ['Nothing tracked here yet'] }
  }

  let score = 0
  const reasons: string[] = []

  const current = input.currentSprint
  const progress = current
    ? sprintDayProgress(current.startDate, current.endDate, today)
    : null

  // `pickCurrentSprint` already refuses to return a closed sprint, but
  // `appHealth` is callable on its own, so the guard lives here too rather
  // than depending on the caller having used the right selector.
  if (current && current.status !== 'done' && progress?.phase === 'ended') {
    const daysOver = -progress.remainingDays
    score += SPRINT_OVERRUN_POINTS
    reasons.push(
      `Sprint “${current.name}” ended ${daysOver} day${daysOver === 1 ? '' : 's'} ago and is still open`,
    )
  }

  if (input.tasks.overdue > 0) {
    score += Math.min(input.tasks.overdue * OVERDUE_POINTS_EACH, OVERDUE_POINTS_CAP)
    reasons.push(
      `${input.tasks.overdue} task${input.tasks.overdue === 1 ? '' : 's'} past their due date`,
    )
  }

  if (progress?.phase === 'running') {
    const done = completionPct(input.tasks)
    const gap = progress.pct - done
    if (gap >= BURN_GAP_THRESHOLD) {
      score += BURN_GAP_POINTS
      reasons.push(`${progress.pct}% of the sprint gone, ${done}% of tasks done`)
    }
  }

  // Only an ACTIVE app owes anyone a sprint or recent movement — that is the
  // whole point of marking one paused.
  if (input.status === 'active') {
    if (input.sprintCount === 0) {
      score += NO_SPRINT_POINTS
      reasons.push('No sprint planned')
    }
    const idleDays = daysSince(input.lastActivityOn, today)
    if (idleDays === null) {
      score += STALE_POINTS
      reasons.push('No activity recorded yet')
    } else if (idleDays > STALE_ACTIVITY_DAYS) {
      score += STALE_POINTS
      reasons.push(`Nothing has happened for ${idleDays} days`)
    }
  }

  if (input.memberCount === 0) {
    score += NO_TEAM_POINTS
    reasons.push('Nobody is assigned')
  }

  if (!input.leadId) {
    score += NO_LEAD_POINTS
    reasons.push('No lead')
  }

  const level: HealthLevel =
    score >= AT_RISK_SCORE ? 'at-risk' : score >= WATCH_SCORE ? 'watch' : 'on-track'

  return { level, score, reasons }
}

// ---------------------------------------------------------------------------
// Workspace roll-up
// ---------------------------------------------------------------------------

/** The minimum an entry must expose to be summarized — `AppPortfolioEntry`
 *  satisfies it structurally, and tests can build one by hand. */
export type SummarizableApp = {
  status: AppStatus
  health: AppHealth
  members: readonly unknown[]
  stats: {
    tasks: AppTaskCounts
    currentSprint: AppSprintSnapshot | null
    meetings: { thisWeek: number }
  }
}

export type PortfolioSummary = {
  apps: number
  live: number
  openTasks: number
  overdueTasks: number
  activeSprints: number
  meetingsThisWeek: number
  atRisk: number
  unassigned: number
}

/**
 * The header strip's numbers. Deliberately computed from the SAME entries the
 * grid was built from rather than from their own queries: a header that can
 * disagree with the cards underneath it is worse than no header, and the
 * whole point of the one-pass query layer is that this is free.
 *
 * Note these describe the WHOLE workspace, not the current filter — the strip
 * is the thing you check before you decide what to filter to, so hiding
 * archived apps must not make the overdue count drop.
 */
export function summarizePortfolio(entries: readonly SummarizableApp[]): PortfolioSummary {
  const summary: PortfolioSummary = {
    apps: entries.length,
    live: 0,
    openTasks: 0,
    overdueTasks: 0,
    activeSprints: 0,
    meetingsThisWeek: 0,
    atRisk: 0,
    unassigned: 0,
  }

  for (const entry of entries) {
    // Meetings are counted for ARCHIVED apps too, unlike every figure below
    // this line. That asymmetry is deliberate, not an oversight: a meeting on
    // Thursday is on somebody's calendar on Thursday whatever the project's
    // status says, whereas an archived app's overdue tasks and empty sprint
    // slate are exactly the noise archiving exists to silence.
    summary.meetingsThisWeek += entry.stats.meetings.thisWeek
    if (entry.status === 'archived') continue

    summary.live += 1
    summary.openTasks += entry.stats.tasks.todo + entry.stats.tasks.in_progress
    summary.overdueTasks += entry.stats.tasks.overdue
    if (entry.stats.currentSprint) summary.activeSprints += 1
    if (entry.health.level === 'at-risk') summary.atRisk += 1
    if (entry.members.length === 0) summary.unassigned += 1
  }

  return summary
}
