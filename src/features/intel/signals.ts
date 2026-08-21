import { capacityBand } from '@/features/people/components/capacity-bar'
import { FOLLOWUP_STALE_DAYS } from '@/features/people/followup-split'
import { isoDayDiff, isoDayOf, isoDayRange } from '@/features/people/iso-day'
import { workingDayFraction } from '@/lib/working-days'

/**
 * Everything /intel can say without spending a Gemini call.
 *
 * This module exists so the page has a spine that does not depend on anyone
 * having an API key. A reader with AI switched off, or a key that just got
 * rejected, still gets the whole list of things that need them — the AI
 * briefing on top is a nicer paragraph over these same rows, never the only
 * way to learn that a sprint is not going to land.
 *
 * It is also the grounding. The briefing prompt is built from these signals,
 * so when the model and a row disagree the row wins: it is the one a test can
 * pin, and the one whose number came from the database rather than a sentence.
 *
 * PURE by construction — no `@/db`, no server imports, and no `new Date()`.
 * The day arrives as `todayIso` (Asia/Colombo, resolved once by the caller),
 * because two detectors that each asked the clock could straddle midnight and
 * disagree about whether the same task is late.
 */

export type SignalSeverity = 'alert' | 'watch' | 'info'

export type SignalKind =
  | 'task.overdue'
  | 'followup.stale'
  | 'capacity.over'
  | 'capacity.near'
  | 'sprint.at-risk'
  | 'worklog.gap'
  | 'meeting.unwritten'
  | 'meeting.mergeable'
  | 'app.quiet'

export type Signal = {
  /** Stable and unique: `<kind>:<entity>`, e.g. `capacity.over:<userId>`. */
  id: string
  kind: SignalKind
  severity: SignalSeverity
  /** Names the thing, at most MAX_TITLE characters. */
  title: string
  /** One sentence that restates every number it decided on, in words. */
  detail: string
  /** A route that really exists, or null. */
  href: string | null
  /** The number the severity was decided on. */
  count: number
}

export type SignalInput = {
  todayIso: string
  me: { id: string; name: string }
  tasks: { overdue: number; oldestOverdueDays: number | null; dueSoon: number }
  followupsOwed: number
  oldestOwedDays: number | null
  capacities: { userId: string; name: string; pct: number }[]
  sprints: {
    id: string
    appSlug: string
    name: string
    endsOn: string
    openTasks: number
    totalTasks: number
  }[]
  worklogGapDays: string[]
  unwrittenMeetings: { id: string; title: string; endedIso: string }[]
  /**
   * What R6 COVER-TOGETHER found, or null when the reader may not see it.
   *
   * NULL AND ZERO ARE DIFFERENT and must stay that way: null is "this reader
   * does not get a workspace-wide reading of everybody's open work", zero is
   * "nothing worth combining". Collapsing them would put a reassuring row in
   * front of somebody who was never shown the question.
   */
  mergeableMeetings: { groups: number; items: number; savedPersonMinutes: number } | null
  quietApps: { slug: string; name: string; lastActivityIso: string | null }[]
}

/**
 * When "late" stops being a slip and starts being a problem. Two days late is
 * a bad week; three is a task nobody is actually holding.
 */
export const OVERDUE_ALERT_DAYS = 3

/** One unlogged day is a reminder; three is a habit that has lapsed. */
export const WORKLOG_GAP_ALERT_DAYS = 3

/** A fortnight with nothing at all recorded against an app. */
export const QUIET_APP_DAYS = 14

/**
 * How close to the edge a sprint has to be before it is worth saying so.
 * A sprint carrying 80% of the work its remaining working days can absorb has
 * no slack left for a single sick day, which is the point at which a lead
 * would rather hear about it than not.
 */
export const SPRINT_WATCH_RATIO = 0.8

const MAX_TITLE = 60

/**
 * Titles sit in a fixed-width list, so the contract caps them. Names are the
 * only unbounded part of one — an app or a person with a very long name would
 * otherwise push a row's title past the width every other row respects.
 */
function clip(text: string): string {
  return text.length <= MAX_TITLE ? text : `${text.slice(0, MAX_TITLE - 1).trimEnd()}…`
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * How to refer to somebody in their own briefing. "Nuwan is over capacity"
 * reads as a report about a third party even when Nuwan is the one reading it,
 * which is exactly the row he is most likely to act on.
 */
function nameFor(userId: string, name: string, me: SignalInput['me']) {
  return userId === me.id ? { name: 'You', be: 'are' } : { name, be: 'is' }
}

/**
 * The day an instant falls on, in the business timezone.
 *
 * Never `iso.slice(0, 10)`: a meeting that ended at 22:00 UTC ended the NEXT
 * day in Colombo, and slicing would file it under yesterday for every reader
 * in the office.
 */
function dayOf(iso: string): string {
  return isoDayOf(new Date(iso))
}

/**
 * Working days left to spend on a sprint, today included, counted by the
 * studio's own week — Saturday is half a day, Sunday and mercantile holidays
 * are none. Zero once `endsOn` has passed.
 *
 * This is the whole reason the sprint detector is not a naive calendar-day
 * subtraction: a sprint ending Saturday has half the runway a Wednesday one
 * does, and calling both "1 day left" is how a sprint gets marked healthy on
 * the Friday before it misses.
 */
export function remainingWorkingDays(todayIso: string, endsOn: string): number {
  return isoDayRange(todayIso, endsOn).reduce((sum, iso) => sum + workingDayFraction(iso), 0)
}

/** Overdue work assigned to the reader. */
export function overdueTaskSignal(input: SignalInput): Signal | null {
  const { overdue, oldestOverdueDays } = input.tasks
  if (overdue <= 0) return null

  const severity: SignalSeverity =
    oldestOverdueDays !== null && oldestOverdueDays >= OVERDUE_ALERT_DAYS ? 'alert' : 'watch'

  let detail: string
  if (oldestOverdueDays === null) {
    // No due date arithmetic came back with the count; say only what is known
    // rather than invent an age for it.
    detail = `You have ${plural(overdue, 'task', 'tasks')} past ${overdue === 1 ? 'its' : 'their'} due date.`
  } else if (overdue === 1) {
    detail = `Your one overdue task is ${plural(oldestOverdueDays, 'day', 'days')} late.`
  } else {
    detail = `You have ${overdue} overdue tasks, and the oldest is ${plural(oldestOverdueDays, 'day', 'days')} late.`
  }

  return {
    id: `task.overdue:${input.me.id}`,
    kind: 'task.overdue',
    severity,
    title: clip(plural(overdue, 'task is overdue', 'tasks are overdue')),
    detail,
    href: `/people/${input.me.id}`,
    count: overdue,
  }
}

/**
 * Follow-ups the reader owes that have gone stale.
 *
 * The threshold is imported, never restated: `FOLLOWUP_STALE_DAYS` already
 * decides when the person page turns a follow-up red, and a second opinion
 * here would put a calm row on /intel beside an alarmed one on /people for
 * the same item.
 */
export function staleFollowupSignal(input: SignalInput): Signal | null {
  const { followupsOwed, oldestOwedDays } = input
  if (followupsOwed <= 0 || oldestOwedDays === null) return null
  if (oldestOwedDays < FOLLOWUP_STALE_DAYS) return null

  const severity: SignalSeverity = oldestOwedDays >= FOLLOWUP_STALE_DAYS * 2 ? 'alert' : 'watch'
  const age = plural(oldestOwedDays, 'day', 'days')

  return {
    id: `followup.stale:${input.me.id}`,
    kind: 'followup.stale',
    severity,
    title: clip(`${plural(followupsOwed, 'follow-up', 'follow-ups')} waiting on you`),
    detail:
      followupsOwed === 1
        ? `The one follow-up you owe has been open ${age}, past the ${FOLLOWUP_STALE_DAYS}-day mark.`
        : `You owe ${followupsOwed} follow-ups, and the oldest has been open ${age} — past the ${FOLLOWUP_STALE_DAYS}-day mark.`,
    href: `/people/${input.me.id}`,
    count: followupsOwed,
  }
}

/**
 * One row per person who is at or over the line.
 *
 * Bands come from `capacityBand`, the same function the meter and the stat
 * tile use, so /intel cannot call somebody "near capacity" while their person
 * page still draws them green.
 */
export function capacitySignals(input: SignalInput): Signal[] {
  const signals: Signal[] = []
  for (const person of input.capacities) {
    const band = capacityBand(person.pct)
    if (band === 'normal') continue
    const who = nameFor(person.userId, person.name, input.me)

    if (band === 'over') {
      signals.push({
        id: `capacity.over:${person.userId}`,
        kind: 'capacity.over',
        severity: 'alert',
        title: clip(`${who.name} ${who.be} over capacity`),
        detail: `${who.name} ${who.be} allocated ${person.pct}% across apps, ${person.pct - 100}% past a full workload.`,
        href: `/people/${person.userId}`,
        count: person.pct,
      })
      continue
    }

    signals.push({
      id: `capacity.near:${person.userId}`,
      kind: 'capacity.near',
      severity: 'watch',
      title: clip(`${who.name} ${who.be} near capacity`),
      detail:
        person.pct === 100
          ? `${who.name} ${who.be} allocated 100% across apps, with no room left.`
          : `${who.name} ${who.be} allocated ${person.pct}% across apps, with ${100 - person.pct}% left.`,
      href: `/people/${person.userId}`,
      count: person.pct,
    })
  }
  return signals
}

/**
 * Sprints carrying more open work than the working days left can absorb.
 *
 * The yardstick is one task per working day. It is crude on purpose: the point
 * is not to estimate the sprint, it is to notice when the arithmetic has
 * stopped being possible at all — twelve tasks and four days is a conversation
 * whatever the tasks are.
 */
export function sprintRiskSignals(input: SignalInput): Signal[] {
  const signals: Signal[] = []
  for (const sprint of input.sprints) {
    // A finished sprint with nothing open is the normal end of a sprint, not a
    // risk — and without this guard it would qualify, since zero open tasks is
    // trivially "within 20% of" zero remaining capacity.
    if (sprint.openTasks <= 0) continue

    const capacity = remainingWorkingDays(input.todayIso, sprint.endsOn)
    const ended = sprint.endsOn < input.todayIso
    const over = sprint.openTasks > capacity
    if (!over && sprint.openTasks < capacity * SPRINT_WATCH_RATIO) continue

    const open = plural(sprint.openTasks, 'task', 'tasks')
    signals.push({
      id: `sprint.at-risk:${sprint.id}`,
      kind: 'sprint.at-risk',
      severity: over ? 'alert' : 'watch',
      title: clip(ended ? `${sprint.name} ended with work open` : `${sprint.name} may not land in time`),
      detail: ended
        ? `${sprint.name} ended on ${sprint.endsOn} with ${open} of ${sprint.totalTasks} still open.`
        : `${sprint.name} has ${open} open of ${sprint.totalTasks}, with ${plural(capacity, 'working day', 'working days')} left before it ends on ${sprint.endsOn}.`,
      href: `/apps/${sprint.appSlug}`,
      count: sprint.openTasks,
    })
  }
  return signals
}

/** Working days the reader never logged. */
export function worklogGapSignal(input: SignalInput): Signal | null {
  const gaps = input.worklogGapDays
  if (gaps.length === 0) return null

  // Lexicographic order on YYYY-MM-DD is chronological, so the smallest string
  // is the oldest day — no parsing, and no dependence on the caller's ordering.
  const oldest = [...gaps].sort()[0]

  return {
    id: `worklog.gap:${input.me.id}`,
    kind: 'worklog.gap',
    severity: gaps.length >= WORKLOG_GAP_ALERT_DAYS ? 'alert' : 'watch',
    title: clip(`${plural(gaps.length, 'working day', 'working days')} not logged`),
    detail:
      gaps.length === 1
        ? `You have not logged ${oldest} yet.`
        : `You have ${gaps.length} working days with no work log entry, the oldest of them ${oldest}.`,
    href: '/worklog',
    count: gaps.length,
  }
}

/**
 * Past meetings still without notes, as one row rather than one per meeting.
 *
 * Aggregated because the severity is a property of the SET: a single meeting
 * that finished this morning is a reminder, whereas the same meeting still
 * unwritten next to three others is a backlog.
 */
/**
 * How many unwritten meetings the pack carries — declared HERE, in the pure
 * module that words the signal, and imported by context-pack rather than the
 * other way round.
 *
 * The wording depends on the cap: a list that came back full is a floor, not
 * a count, and only the module that knows the ceiling can say "at least".
 * Splitting the two apart is how a capped list starts being reported as a
 * total.
 */
export const UNWRITTEN_MEETING_LIMIT = 10

export function unwrittenMeetingSignal(input: SignalInput): Signal | null {
  const meetings = input.unwrittenMeetings
  if (meetings.length === 0) return null

  const oldest = meetings.reduce((worst, meeting) =>
    dayOf(meeting.endedIso) < dayOf(worst.endedIso) ? meeting : worst,
  )
  const endedToday = dayOf(oldest.endedIso) === input.todayIso
  const onlyOneFromToday = meetings.length === 1 && endedToday
  // The pack asks for the OLDEST unwritten meetings and stops at the cap, so a
  // full list means "this many and probably more". Saying a bare number there
  // would quietly convert a floor into a total, and the reader would clear ten
  // meetings and expect to be done.
  const atCap = meetings.length >= UNWRITTEN_MEETING_LIMIT
  const howMany = atCap ? `At least ${meetings.length}` : `${meetings.length}`

  return {
    id: `meeting.unwritten:${input.me.id}`,
    kind: 'meeting.unwritten',
    severity: onlyOneFromToday ? 'info' : 'watch',
    title: clip(
      atCap
        ? `${meetings.length}+ meetings have no notes`
        : `${plural(meetings.length, 'meeting has', 'meetings have')} no notes`,
    ),
    detail: onlyOneFromToday
      ? `One meeting from today, “${oldest.title}”, still has no notes.`
      : meetings.length === 1
        ? `One past meeting, “${oldest.title}” on ${dayOf(oldest.endedIso)}, still has no notes.`
        : `${howMany} past meetings still have no notes, the oldest “${oldest.title}” on ${dayOf(oldest.endedIso)}.`,
    href: '/meetings',
    count: meetings.length,
  }
}

/**
 * Apps nothing has happened on in a fortnight.
 *
 * An app whose `lastActivityIso` is null is skipped deliberately. Null means
 * nothing has EVER been recorded against it, which is indistinguishable here
 * from an app someone created five minutes ago — and there is no elapsed time
 * to report. Calling a brand-new app neglected on its first day is the one
 * way this detector could be plainly wrong, so it says nothing instead.
 */
export function quietAppSignals(input: SignalInput): Signal[] {
  const signals: Signal[] = []
  for (const app of input.quietApps) {
    if (app.lastActivityIso === null) continue
    const lastDay = dayOf(app.lastActivityIso)
    const days = isoDayDiff(input.todayIso, lastDay)
    if (days < QUIET_APP_DAYS) continue

    signals.push({
      id: `app.quiet:${app.slug}`,
      kind: 'app.quiet',
      severity: 'info',
      title: clip(`${app.name} has gone quiet`),
      detail: `${app.name} has had no activity for ${plural(days, 'day', 'days')}, since ${lastDay}.`,
      href: `/apps/${app.slug}`,
      count: days,
    })
  }
  return signals
}

/**
 * Meetings that have not been scheduled yet, and need not all be.
 *
 * The only INFO-severity row that is an opportunity rather than a problem —
 * every other signal here reports something already going wrong. It earns its
 * place on the board because this is how somebody finds the load page without
 * knowing it exists: nobody searches for a rule they have never heard of.
 *
 * A question, never a value claim. The rule cannot know whether one room is
 * better than several; it knows only that it costs fewer person-minutes, and
 * that is exactly what the sentence says.
 */
export function mergeableMeetingSignal(input: SignalInput): Signal | null {
  const found = input.mergeableMeetings
  if (found === null) return null
  if (found.groups === 0) return null

  const saved = found.savedPersonMinutes
  return {
    // Workspace-scoped, not personal: unlike the overdue and follow-up rows,
    // this is not about the reader's own work, and keying it to them would
    // make two people's boards disagree about a fact neither of them owns.
    id: 'meeting.mergeable:workspace',
    kind: 'meeting.mergeable',
    severity: 'info',
    title: clip(`${found.items} meetings could be ${found.groups}`),
    detail:
      `${plural(found.items, 'open item', 'open items')} need the same people and could be `
      + `${plural(found.groups, 'conversation', 'conversations')} instead of ${found.items}`
      + `${saved > 0 ? `, ${saved} person-minutes less` : ''}. `
      + 'Each one is a suggestion: scheduling it still opens the meeting form.',
    href: '/meetings/load',
    count: found.items,
  }
}

const SEVERITY_RANK: Record<SignalSeverity, number> = { alert: 0, watch: 1, info: 2 }

/**
 * Total and stable: severity, then the size of the number behind it, then the
 * id. Ids are unique, so no two signals can ever compare equal — the list
 * cannot reshuffle between two renders of the same data, which is what makes
 * "the top three" a thing a briefing can quote.
 */
export function compareSignals(a: Signal, b: Signal): number {
  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  if (bySeverity !== 0) return bySeverity
  const byCount = b.count - a.count
  if (byCount !== 0) return byCount
  return a.id.localeCompare(b.id)
}

export function buildSignals(input: SignalInput): Signal[] {
  return [
    overdueTaskSignal(input),
    staleFollowupSignal(input),
    ...capacitySignals(input),
    ...sprintRiskSignals(input),
    worklogGapSignal(input),
    unwrittenMeetingSignal(input),
    mergeableMeetingSignal(input),
    ...quietAppSignals(input),
  ]
    .filter((signal): signal is Signal => signal !== null)
    .sort(compareSignals)
}
