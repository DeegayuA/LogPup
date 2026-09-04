import { MAX_BACKFILL_DAYS } from '@/features/worklog/missing-days'

/**
 * WHO GETS TOLD THEY ARE BEHIND, AND WHEN TO SAY NOTHING.
 *
 * The catch-up ledger only works on somebody who opens /worklog. The people it
 * is for are exactly the people not opening it — five days go by, the backlog
 * stops looking clearable, and an unclearable backlog is indistinguishable from
 * having given up. This is the half that runs with nobody logged in.
 *
 * PURE. No database, no clock, no model. The cron step gathers the days and
 * this decides, so "does this person get a message tonight" is answered by a
 * test rather than discovered in somebody's inbox.
 *
 * IT NOTIFIES; IT NEVER WRITES A WORKLOG. There is deliberately no draft, no
 * pre-filled score and no row created on anybody's behalf anywhere in this
 * module or its caller. A worklog is a first-person statement, and a background
 * job that filed one would be a machine's account of somebody's week wearing
 * their name — the same rule that keeps `worklog.write.any` out of every seat.
 *
 * THE THREE WAYS IT STAYS QUIET, in order of how much damage the alternative
 * does:
 *
 *   1. ONE MISSING DAY IS NOT A BACKLOG. Yesterday gets logged this morning by
 *      most people most of the time. A nightly message about it trains everyone
 *      to ignore the channel before the message that matters ever arrives.
 *   2. THE SAME BACKLOG IS ONE MESSAGE, NOT ONE PER NIGHT. The rung is armed on
 *      the OLDEST unlogged day, so a re-run over an unchanged backlog dedupes
 *      to silence and a NEW gap opening re-arms it. That is the ladder mode in
 *      notify-rules.ts, used for exactly this.
 *   3. NOBODY IS TOLD ABOUT DAYS THEY DID NOT OWE. Weekends, holidays and
 *      approved whole-day leave never reach this function — coverage.ts has
 *      already dropped them — so the count in the message is the count on the
 *      page.
 */

/** One person's unlogged days, as coverage reported them. */
export type NudgeInput = {
  userId: string
  name: string
  /** Days with status 'missing', OLDEST FIRST. Empty for somebody up to date. */
  owed: readonly string[]
}

/**
 * The backlog worth a message.
 *
 * TWO, NOT ONE. Logging yesterday this morning is the normal rhythm, and a
 * nightly nudge about a single day is the message people learn to dismiss
 * without reading — after which the five-day one arrives into a channel they
 * have already tuned out.
 */
export const NUDGE_MIN_OWED = 2

export type WorklogNudge = {
  userId: string
  name: string
  /** How many days are unlogged, capped the way the ledger caps its own list. */
  owed: number
  /** The oldest unlogged day — what the message leads with, and the rung. */
  oldestDay: string
  /**
   * The ladder rung this nudge is armed on.
   *
   * The oldest unlogged day, DELIBERATELY, rather than the count or the date
   * the tick ran. Armed on the count, clearing one old day and gaining one new
   * one would look unchanged and stay silent. Armed on the run date, the same
   * untouched backlog would send a fresh message every single night. Armed on
   * the oldest day, a person hears once about a backlog and again only when it
   * grows a new front edge — which is the only thing that has actually changed
   * about their situation.
   */
  armedOn: string
}

/**
 * Who to notify tonight.
 *
 * Returns them in the order they were given; the caller's roster order is
 * already a stable sort by name, and re-sorting here would be a second opinion
 * about something that does not need one.
 */
export function planWorklogNudges(
  rows: readonly NudgeInput[],
  options: { minOwed?: number } = {},
): WorklogNudge[] {
  const minOwed = options.minOwed ?? NUDGE_MIN_OWED
  const out: WorklogNudge[] = []

  for (const row of rows) {
    if (row.owed.length < minOwed) continue

    // Oldest first is the contract, but a caller that sorted the other way
    // would otherwise arm every rung on the newest day and re-fire nightly.
    // Cheap to be certain about the one value the dedupe depends on.
    const oldestDay = [...row.owed].sort()[0]

    out.push({
      userId: row.userId,
      name: row.name,
      // Capped at what the ledger itself will show. Telling somebody they are
      // 60 days behind when the page offers them 14 to fill in is a number they
      // cannot act on.
      owed: Math.min(row.owed.length, MAX_BACKFILL_DAYS),
      oldestDay,
      armedOn: oldestDay,
    })
  }

  return out
}

/**
 * The message body, in the studio's own voice.
 *
 * Written here rather than in the route so the wording is covered by the same
 * test as the rule that produces it — and so it stays honest at every value:
 * "2 days" and "14 days" are different situations and neither reads as a
 * telling-off. People take leave and spend days on other work; a blank day is
 * not a fault, and this is a reminder, not a reprimand.
 */
export function nudgeBody(nudge: WorklogNudge, dayLabel: (iso: string) => string): string {
  const days = `${nudge.owed} ${nudge.owed === 1 ? 'day' : 'days'}`
  return (
    `${days} without a log, oldest is ${dayLabel(nudge.oldestDay)}. ` +
    'Write them all out in one go — LogPup reads dates, projects and hours out of a paragraph.'
  )
}
