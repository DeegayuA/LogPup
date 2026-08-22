/**
 * "Somebody logged four hours and produced nothing — how would I know?"
 *
 * This module is the whole answer, and most of it is about what it refuses to
 * conclude.
 *
 * IT NEVER DIVIDES HOURS BY EVENTS. There is no honest conversion between
 * "three hours" and "two commits", so a ratio would be a number this app
 * invented and then presented as a measurement. What it produces instead is a
 * graded verdict per day, and — only for a sustained run of genuinely silent
 * days — a prompt to go and ask.
 *
 * UNCORROBORATED IS NOT IDLE, and that sentence is the design. Reading a
 * codebase, thinking through an architecture, pairing at somebody else's desk,
 * and the four hours before a hard bug gives way all leave no trace whatever.
 * A single quiet day is noise. The only thing here that ever escalates is a
 * RUN of quiet working days, by somebody who is not on leave and does have
 * work allocated — and even that resolves to "ask them", never to a finding.
 *
 * IT ALSO LOOKS THE OTHER WAY. `findUnclaimedDays` finds people whose work is
 * visible but whose worklog is empty. It ships from the same pass, in the same
 * object, so no surface can show one direction without having the other to
 * hand. A tool that only ever detects under-reporting of effort is not a
 * measurement tool.
 */

import type { WorkingDayFraction } from '@/lib/working-days'
import { isOutcome, userDayKey, type Observation, type ObservationKind } from './observe'

export type DayVerdict =
  /** At least one thing finished, was answered, or was decided. */
  | 'strong'
  /** Present and engaged — attended, moved, spoke, wrote an account. */
  | 'partial'
  /** Minutes claimed, and not one trace on any channel. */
  | 'none'
  /** Nothing claimed and nothing expected: leave, weekend, holiday. */
  | 'not-applicable'

export type DayInput = {
  userId: string
  /** `YYYY-MM-DD`, Asia/Colombo. */
  day: string
  claimedMinutes: number
  /** Approved leave only — a pending request is not yet a day off. */
  onLeave: boolean
  /** From working-days.ts: Saturday is 0.5, a mercantile holiday is 0. */
  workingFraction: WorkingDayFraction
  /**
   * This person's total allocation across projects, as a percentage.
   *
   * Zero means nobody has given them anything to do, and a silence detector
   * that fired on them would be reporting a management failure as a personal
   * one.
   */
  allocationPct: number
}

export type DayCorroboration = {
  userId: string
  day: string
  claimedMinutes: number
  verdict: DayVerdict
  outcomes: number
  presence: number
  /** Distinct kinds seen, so a reader can tell WHAT the day consisted of. */
  kinds: ObservationKind[]
  /** Was any work expected of this person on this day at all. */
  expected: boolean
}

/**
 * Every channel this module looks at, in the words a person would use.
 *
 * Exported and rendered, not merely documented. "Nothing was found" is a claim
 * about the observer as much as the observed, and somebody being asked why
 * their week looks empty is entitled to see the list of places that were
 * searched — including so they can point at the one that is missing.
 */
export const CHECKED_CHANNELS: readonly string[] = [
  'Tasks completed, moved or created',
  'Commits, for anyone with a linked GitHub account',
  'Meetings attended',
  'Speaking in a recorded meeting',
  'Follow-ups resolved or answered',
  'Comments on projects',
  'Change requests approved or rejected',
  'Bug triage',
  'Sprint check-ins',
  'A worklog note written for the day',
]

/**
 * How many consecutive quiet WORKING days before this is worth raising.
 *
 * Three, and the reasoning is asymmetric on purpose. One quiet day is
 * completely normal — it is Wednesday of a hard bug. Two is a long stretch of
 * thinking, or a week where somebody's whole contribution went into a
 * colleague's branch. Three consecutive working days with real hours claimed
 * and NOTHING on any of ten channels is rare enough to be worth a sentence,
 * and still resolves only to a question.
 *
 * Raising this makes the tool useless; lowering it makes it hostile. It is a
 * constant with a test rather than a setting, because the argument for the
 * number belongs next to the number.
 */
export const QUIET_RUN_DAYS = 3

/** One person, one day, against everything the workspace saw them do. */
export function corroborateDay(
  input: DayInput,
  observations: readonly Observation[],
): DayCorroboration {
  const outcomes = observations.filter((o) => isOutcome(o.kind)).length
  const presence = observations.length - outcomes
  const kinds = [...new Set(observations.map((o) => o.kind))]

  // "Expected" is computed HERE rather than trusted from the caller, because
  // it carries two of this feature's three fairness rules. A design that took
  // a boolean would let one forgetful call site flag somebody who filed their
  // leave correctly — the single worst thing this feature could do.
  const expected = input.workingFraction > 0 && !input.onLeave && input.allocationPct > 0

  let verdict: DayVerdict
  if (outcomes > 0) verdict = 'strong'
  else if (presence > 0) verdict = 'partial'
  else if (input.claimedMinutes > 0) verdict = 'none'
  else if (!expected) verdict = 'not-applicable'
  // Nothing claimed, nothing seen, but the day WAS expected. Still 'none':
  // an empty working day is exactly the thing worth noticing, and calling it
  // not-applicable because the worklog is also blank would make the detector
  // blind to the one person who logs nothing at all.
  else verdict = 'none'

  return {
    userId: input.userId,
    day: input.day,
    claimedMinutes: input.claimedMinutes,
    verdict,
    outcomes,
    presence,
    kinds,
    expected,
  }
}

export function corroborateRange(
  days: readonly DayInput[],
  observations: readonly Observation[],
): DayCorroboration[] {
  const byUserDay = new Map<string, Observation[]>()
  for (const observation of observations) {
    const key = userDayKey(observation.userId, observation.day)
    const bucket = byUserDay.get(key)
    if (bucket) bucket.push(observation)
    else byUserDay.set(key, [observation])
  }
  return days.map((day) =>
    corroborateDay(day, byUserDay.get(userDayKey(day.userId, day.day)) ?? []),
  )
}

export type QuietRun = {
  userId: string
  /** First and last quiet working day, inclusive. */
  from: string
  to: string
  days: number
  claimedMinutes: number
  /** Always CHECKED_CHANNELS — carried so a UI cannot render the run without it. */
  checkedChannels: readonly string[]
}

/**
 * Runs of consecutive quiet WORKING days.
 *
 * "Consecutive working days", not consecutive dates: a Friday and the
 * following Monday are consecutive for this purpose, and the weekend between
 * them must not reset the count or somebody could never accumulate one. Days
 * that were not expected — leave, Sunday, a holiday, nobody allocated — are
 * skipped entirely rather than treated as either quiet or busy. Skipping is
 * the only correct move: they are not evidence in either direction.
 *
 * Input need not be sorted; it is sorted here, because a caller passing days
 * grouped by user rather than by date would otherwise produce runs made of
 * unrelated dates and nothing would fail.
 */
export function findQuietRuns(
  corroborations: readonly DayCorroboration[],
  opts: { minDays?: number } = {},
): QuietRun[] {
  const minDays = opts.minDays ?? QUIET_RUN_DAYS
  const byUser = new Map<string, DayCorroboration[]>()
  for (const day of corroborations) {
    const bucket = byUser.get(day.userId)
    if (bucket) bucket.push(day)
    else byUser.set(day.userId, [day])
  }

  const runs: QuietRun[] = []
  for (const [userId, days] of byUser) {
    const expected = days
      .filter((d) => d.expected)
      .sort((a, b) => a.day.localeCompare(b.day))

    let current: DayCorroboration[] = []
    const flush = () => {
      if (current.length >= minDays) {
        runs.push({
          userId,
          from: current[0].day,
          to: current[current.length - 1].day,
          days: current.length,
          claimedMinutes: current.reduce((sum, d) => sum + d.claimedMinutes, 0),
          checkedChannels: CHECKED_CHANNELS,
        })
      }
      current = []
    }

    for (const day of expected) {
      if (day.verdict === 'none') current.push(day)
      else flush()
    }
    flush()
  }
  return runs.sort((a, b) => a.from.localeCompare(b.from) || a.userId.localeCompare(b.userId))
}

export type UnclaimedDay = {
  userId: string
  day: string
  kinds: ObservationKind[]
  observations: number
}

/**
 * Days where the work is visible and the worklog is empty.
 *
 * The mirror of `findQuietRuns`, and it exists for the same reason a scale
 * needs both pans. Somebody who shipped all week and logged nothing looks,
 * to every hours-based report in this product, exactly like somebody who did
 * nothing — and they are the person most likely to be doing the work.
 *
 * No run threshold here, unlike quiet days: a single unclaimed day is
 * immediately actionable ("your Tuesday is blank, want to fill it in?") and
 * costs nobody anything to be wrong about.
 */
export function findUnclaimedDays(
  corroborations: readonly DayCorroboration[],
): UnclaimedDay[] {
  return corroborations
    .filter((d) => d.expected && d.claimedMinutes === 0 && d.outcomes + d.presence > 0)
    .map((d) => ({
      userId: d.userId,
      day: d.day,
      kinds: d.kinds,
      observations: d.outcomes + d.presence,
    }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.userId.localeCompare(b.userId))
}

export type CorroborationSummary = {
  strong: number
  partial: number
  none: number
  notApplicable: number
  /** Expected working days in the window, the denominator for everything else. */
  expectedDays: number
}

export function summarize(corroborations: readonly DayCorroboration[]): CorroborationSummary {
  return {
    strong: corroborations.filter((d) => d.verdict === 'strong').length,
    partial: corroborations.filter((d) => d.verdict === 'partial').length,
    none: corroborations.filter((d) => d.verdict === 'none').length,
    notApplicable: corroborations.filter((d) => d.verdict === 'not-applicable').length,
    expectedDays: corroborations.filter((d) => d.expected).length,
  }
}
