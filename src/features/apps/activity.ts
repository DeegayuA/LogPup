/**
 * Merging and day-grouping for an app's activity feed.
 *
 * The feed is assembled from four independent tables (comments, tasks,
 * meetings, allocation history) that share nothing but a timestamp, so the
 * interleaving happens here rather than in SQL. A UNION would need every
 * branch to agree on a column list and would still have to be re-shaped in
 * JS; four small indexed queries in parallel are cheaper to write, cheaper to
 * read, and each one can be limited independently.
 *
 * Kept free of React and of the db layer so the ordering rules — which are
 * the only part with any real behaviour — are unit-tested directly.
 */

import { dayDiff } from '@/features/apps/app-health'

export type AppActivityKind = 'comment' | 'task' | 'meeting' | 'assignment'

export type AppActivityItem = {
  /** Unique within the merged feed: source table id, prefixed by kind. */
  id: string
  kind: AppActivityKind
  at: Date
  actorName: string | null
  actorAvatarUrl: string | null
  /** One line, already phrased for a human. Rendered verbatim. */
  title: string
  /** Optional second line — a quote, a goal, the thing that changed. */
  detail: string | null
  href: string | null
}

/**
 * Newest first, with a deterministic tie-break. Timestamps collide constantly
 * here — a batch of tasks created by one meeting-analysis pass all carry the
 * same `created_at` to the second — and an unstable order would make the feed
 * visibly reshuffle between two renders of the same data. Falling back to
 * kind then id gives one fixed answer for any input.
 */
export function mergeActivity(
  groups: readonly (readonly AppActivityItem[])[],
  limit: number,
): AppActivityItem[] {
  const all = groups.flat()
  all.sort((a, b) => {
    const delta = b.at.getTime() - a.at.getTime()
    if (delta !== 0) return delta
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
    return a.id.localeCompare(b.id)
  })
  return limit >= 0 ? all.slice(0, limit) : all
}

export type ActivityDayGroup = {
  /** `yyyy-mm-dd` in the viewer-independent form the caller passed in. */
  day: string
  items: AppActivityItem[]
}

/**
 * Groups an already-sorted feed into calendar days, preserving order.
 *
 * `toDay` is injected rather than computed here so the caller decides which
 * timezone the day boundary falls in — the rest of LogPup answers that with
 * `toIsoDateInTimeZone(date, LK_TIMEZONE)`, and hard-coding the server's
 * local midnight would put a 9pm Colombo comment under "yesterday".
 */
export function groupActivityByDay(
  items: readonly AppActivityItem[],
  toDay: (date: Date) => string,
): ActivityDayGroup[] {
  const groups: ActivityDayGroup[] = []
  for (const item of items) {
    const day = toDay(item.at)
    const last = groups.at(-1)
    if (last && last.day === day) last.items.push(item)
    else groups.push({ day, items: [item] })
  }
  return groups
}

/**
 * Heading for a day group. BOTH arguments are `yyyy-mm-dd` in the SAME
 * timezone the grouping used (Colombo, everywhere in LogPup).
 *
 * This lives here, taking `today` as an argument, because the previous version
 * asked date-fns `isToday(new Date(day + 'T12:00:00'))` — which answers "is
 * this today in the RENDERING MACHINE's timezone" while the group key had been
 * computed in Colombo. On a UTC server the two disagree for 5½ hours out of
 * every 24: anything after 18:30 UTC is already tomorrow in Colombo, gets
 * filed under tomorrow's key, then fails `isToday` and renders as a bare
 * weekday name at the very top of the feed. Comparing two ISO strings has no
 * second timezone to disagree with.
 */
export function relativeDayLabel(day: string, today: string): 'Today' | 'Yesterday' | null {
  if (day === today) return 'Today'
  // `dayDiff` is calendar-date arithmetic through Date.UTC (app-health.ts) —
  // no local getters, so this gives the same answer in every deploy region.
  if (dayDiff(day, today) === 1) return 'Yesterday'
  // Null, not a formatted date: choosing the format is the renderer's job, and
  // this module is deliberately free of presentation concerns.
  return null
}

/** Phrasing for an allocation change, shared by the feed and its tests. */
export function assignmentActivityTitle(
  changeKind: 'assigned' | 'updated' | 'removed',
  personName: string,
  allocationPct: number,
): string {
  if (changeKind === 'removed') return `${personName} came off the app`
  if (changeKind === 'assigned') return `${personName} joined at ${allocationPct}%`
  return `${personName} moved to ${allocationPct}%`
}
