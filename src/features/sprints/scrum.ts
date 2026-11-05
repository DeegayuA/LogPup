/**
 * Vocabulary and pure rules for the Scrum tab (PRD Module B, B3–B4).
 */

export const RETRO_KINDS = ['went_well', 'improve', 'action'] as const
export type RetroKind = (typeof RETRO_KINDS)[number]
export const RETRO_KIND_LABEL: Record<RetroKind, string> = {
  went_well: 'Went well',
  improve: 'To improve',
  action: 'Action items',
}

export const CEREMONIES = ['planning', 'standup', 'refinement', 'review', 'retro'] as const
export type Ceremony = (typeof CEREMONIES)[number]
export const CEREMONY_LABEL: Record<Ceremony, string> = {
  planning: 'Sprint planning',
  standup: 'Daily standup',
  refinement: 'Backlog refinement',
  review: 'Sprint review',
  retro: 'Retrospective',
}

export const SCRUM_VIEWS = ['standup', 'refinement', 'review', 'retro'] as const
export type ScrumView = (typeof SCRUM_VIEWS)[number]
export const SCRUM_VIEW_LABEL: Record<ScrumView, string> = {
  standup: 'Standup',
  refinement: 'Refinement',
  review: 'Review',
  retro: 'Retro',
}

export function parseScrumView(raw: string | string[] | undefined): ScrumView {
  const value = Array.isArray(raw) ? raw[0] : raw
  return (SCRUM_VIEWS as readonly string[]).includes(value ?? '') ? (value as ScrumView) : 'standup'
}

export function parseCeremony(raw: unknown): Ceremony | null {
  return typeof raw === 'string' && (CEREMONIES as readonly string[]).includes(raw) ? (raw as Ceremony) : null
}

/** A standup line worth showing: at least one of the three answers written. */
export function hasStandupContent(e: { yesterday: string | null; today: string | null; blockers: string | null }): boolean {
  return [e.yesterday, e.today, e.blockers].some((v) => (v ?? '').trim().length > 0)
}

/** Standup "blockers" text that actually says something ("none" and "-" do not). */
export function isRealBlocker(text: string | null): boolean {
  const t = (text ?? '').trim().toLowerCase()
  return t.length > 0 && !['none', 'no', 'nothing', 'n/a', 'na', '-', 'nil'].includes(t)
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar day in yyyy-mm-dd form ("2026-02-30" is not one). */
export function isIsoDay(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !ISO_DAY.test(raw)) return false
  const d = new Date(`${raw}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw
}

/**
 * Whether a standup may be written for `day`: inside the sprint's own dates
 * and not after today. Today is passed in (Sri Lanka's day, from the caller)
 * rather than read here, so the rule is testable and the server and the form
 * agree on one clock. ISO strings compare correctly as plain strings.
 */
export function isStandupDayAllowed(
  day: string,
  sprint: { startDate: string; endDate: string },
  today: string,
): boolean {
  return isIsoDay(day) && day >= sprint.startDate && day <= sprint.endDate && day <= today
}

/**
 * The day the standup view opens on: today while the sprint runs, its last
 * day once it has ended, its first day before it starts (nothing can be
 * written then, but the page still has a day to show).
 */
export function defaultStandupDay(sprint: { startDate: string; endDate: string }, today: string): string {
  if (today < sprint.startDate) return sprint.startDate
  if (today > sprint.endDate) return sprint.endDate
  return today
}

/**
 * Statuses the review counts as "with QA": everything between "built" and
 * "ready to ship", including the two rework loops.
 */
export const REVIEW_QA_STATUSES = ['in_review', 'ready_for_qa', 'qa', 'qa_failed', 'rework'] as const
export type ReviewQaStatus = (typeof REVIEW_QA_STATUSES)[number]
const RELEASED_STATUSES = new Set(['released', 'ready_for_release'])

/**
 * Split one sprint's tasks into the review's lists. Completed is 'done' only;
 * Released is a slice OF Incomplete (shipped or ready to ship, but not yet
 * closed), so a task can sit in both lists on purpose. Bugs are listed
 * whatever their status.
 */
export function splitReviewTasks<T extends { status: string; type: string }>(tasks: readonly T[]): {
  completed: T[]
  incomplete: T[]
  released: T[]
  bugs: T[]
  qaCounts: { status: ReviewQaStatus; count: number }[]
} {
  const completed: T[] = []
  const incomplete: T[] = []
  const released: T[] = []
  const bugs: T[] = []
  const counts = new Map<string, number>()
  for (const t of tasks) {
    if (t.status === 'done') completed.push(t)
    else incomplete.push(t)
    if (RELEASED_STATUSES.has(t.status)) released.push(t)
    if (t.type === 'bug') bugs.push(t)
    counts.set(t.status, (counts.get(t.status) ?? 0) + 1)
  }
  return {
    completed,
    incomplete,
    released,
    bugs,
    qaCounts: REVIEW_QA_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 })),
  }
}

/** A retro action's text as a task title: one line, at most 140 characters. */
export function retroTaskTitle(body: string): string {
  const line = body.replace(/\s+/g, ' ').trim()
  return line.length > 140 ? `${line.slice(0, 139)}…` : line
}