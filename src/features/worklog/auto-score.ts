import { PERCENT_MAX, PERCENT_MIN } from '@/features/worklog/worklog-day'

/**
 * THE DAY'S SCORE, DERIVED FROM THE HOURS ON IT.
 *
 * ============================================================================
 * READ THIS BEFORE CHANGING ANYTHING HERE.
 * ============================================================================
 * This module deliberately does the thing the rest of the worklog code was
 * built to prevent, because the studio asked for it explicitly. The comment on
 * `accountedFraction` (entries.ts) and the one on `daily_worklogs.percent`
 * (schema.ts) both say the two numbers answer different questions:
 *
 *   percent   a JUDGEMENT — "of what I set out to do, how much did I get done"
 *   hours     a MEASUREMENT — where the time actually went
 *
 * A day of firefighting can honestly be eight hours logged and 30% of what was
 * planned. Deriving the first from the second turns a self-assessment into a
 * clock reading, and a manager reading "100%" is then reading a number nobody
 * asserted. That trade was made knowingly: days with hours and no score sat on
 * the catch-up ledger forever, and an unclearable backlog is worse than an
 * imprecise score.
 *
 * TWO THINGS KEEP IT HONEST, and neither is optional:
 *
 *   1. IT NEVER OVERWRITES A PERSON'S OWN NUMBER. `daily_worklogs.score_source`
 *      records who said it. A row written by a person is 'self' and this code
 *      may not touch it, ever — a measurement silently replacing somebody's own
 *      judgement of their day is strictly worse than the gap it was fixing.
 *   2. IT SAYS SO ON SCREEN. Every surface rendering a derived score labels it
 *      as derived. A number presented as a self-assessment when it is a
 *      division is the actual harm here, and it costs one chip to avoid.
 *
 * PURE AND SYNCHRONOUS. No database, no clock. The rule is one function so the
 * edge cases below are pinned by tests rather than rediscovered in somebody's
 * month-end average.
 */

/** Who put the number there. Mirrors the `worklog_score_source` pg enum. */
export const SCORE_SOURCES = ['self', 'from_hours'] as const
export type ScoreSource = (typeof SCORE_SOURCES)[number]

/**
 * The score a day's hours imply, or null when they imply nothing.
 *
 * NULL IS A REAL ANSWER AND THE CALLER MUST HANDLE IT. Three ways to get it:
 *
 *   - NO SCHEDULED LENGTH. `scheduledMinutes` is null on a day nobody expected
 *     work — a Sunday, a public holiday, approved leave — and on any day
 *     outside the window the caller loaded a schedule for. There is
 *     deliberately no `?? 480` anywhere in this repo: how long a full day is
 *     remains an undecided product question (see accountedFraction), and
 *     inventing eight hours here would quietly answer it for the whole app.
 *   - NOTHING LOGGED. Zero minutes is not a 0% day, it is an unlogged day. A
 *     derived 0% would clear it off the ledger while asserting the person got
 *     none of what they planned done, which is a worse lie than silence.
 *   - A DAY SCHEDULED TO ZERO. Same as the first, and it must never divide.
 */
export function autoScoreFromHours(
  loggedMinutes: number,
  scheduledMinutes: number | null,
): number | null {
  if (scheduledMinutes === null) return null
  if (!Number.isFinite(scheduledMinutes) || scheduledMinutes <= 0) return null
  if (!Number.isFinite(loggedMinutes) || loggedMinutes <= 0) return null

  const raw = (loggedMinutes / scheduledMinutes) * 100

  /* SNAPPED TO FIVES, like every other score in the product. Nobody means the
     difference between 62% and 65%, and an unsnapped derived number would be
     instantly distinguishable from a human one — which would make the derived
     ones look like the precise ones. They are the opposite. */
  const snapped = Math.round(raw / 5) * 5

  /* CLAMPED AT 100. Ten hours against an eight-hour day is a real and
     interesting fact, and `accountedFraction` deliberately reports it as 1.25
     — but `percent` means "of what I planned", the column is validated 0..100,
     and 125% of a plan is not something anybody can mean. The long day shows up
     in the hours, where it belongs and where nothing hides it. */
  return Math.min(PERCENT_MAX, Math.max(PERCENT_MIN, snapped))
}

/**
 * Whether this day's score may be rewritten from its hours.
 *
 * THE ONE GUARD THAT MATTERS. Called before every derived write, so a person
 * who scored their own Tuesday keeps that number no matter how many hours they
 * add to it afterwards. A missing row is fair game — nobody has said anything
 * yet — and a row somebody typed is not, forever.
 */
export function mayAutoScore(existing: { source: ScoreSource } | null): boolean {
  if (existing === null) return true
  return existing.source === 'from_hours'
}

/** What the UI puts beside a score so a derived one is never read as a claim. */
export function scoreSourceLabel(source: ScoreSource): string {
  return source === 'from_hours' ? 'from your hours' : 'your own score'
}
