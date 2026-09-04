import { and, eq, gte, isNull, lte } from 'drizzle-orm'
import { db } from '@/db'
import { dailyWorklogs } from '@/db/schema'
import { liveWorklogEntries } from '@/db/live'
import { absenceDays } from '@/features/worklog/absence-days'
import { exemptingAbsences } from '@/features/worklog/absence-kinds'
import { autoScoreFromHours, mayAutoScore } from '@/features/worklog/auto-score'
import { computeCoverage } from '@/features/worklog/coverage'
import { totalMinutes } from '@/features/worklog/entries'
import { buildHolidayCalendar, closesTheStudio } from '@/features/worklog/holiday-listing'
import { listOrgHolidays } from '@/features/worklog/org-holiday-queries'
import { isoDayAdd } from '@/features/people/iso-day'
import { getMyApprovedAbsences, getMyWorkSchedule } from '@/features/worklog/queries'
import { patternForDay, scheduledMinutesForFraction } from '@/features/worklog/schedules'
import { resolveWorkDay } from '@/features/worklog/worklog-day'

/**
 * Keep one day's score in step with the hours on it.
 *
 * Called after every entry write. See auto-score.ts for WHY this exists and
 * what it costs — in short, the studio chose a derived score over days that sat
 * unscored on the catch-up ledger forever, and this is the write half of that
 * decision.
 *
 * NOT a `'use server'` module and deliberately not an action: it is called from
 * inside entry-actions.ts, where every export must be an async action, and it
 * is not something a client may invoke on its own. Nothing here takes a
 * `targetUserId` — the caller passes its own actor id, and there is no path
 * that scores somebody else's day.
 *
 * BEST EFFORT, ALWAYS. The hours have already been saved by the time this runs,
 * so a failure here must never be what reports a saved entry as failed. Every
 * path swallows, logs, and returns — the same contract createNotifications
 * holds, for the same reason.
 */

/**
 * How long this person's day was scheduled to be, or null when it cannot be
 * said.
 *
 * Folds the three things that make a day shorter or empty, in the same order
 * and from the same sources as computeCoverage: the person's own schedule, a
 * company or gazetted closure, and approved whole-day leave. A day any of those
 * empties has NO scheduled length, so no score can be derived from its hours —
 * which is correct: an hour worked on a Sunday is extra, not a percentage of a
 * plan nobody made.
 */
async function scheduledMinutesFor(userId: string, day: string): Promise<number | null> {
  const [schedule, orgRows, approved] = await Promise.all([
    getMyWorkSchedule(userId),
    listOrgHolidays(),
    getMyApprovedAbsences(userId, day, day),
  ])

  const to = isoDayAdd(day, 1)

  /* THE FRACTION COMES FROM computeCoverage, over a window of exactly one day.
     Folding the weekday pattern, the holiday and the leave by hand here would
     be a second opinion about the one question this page already answers in
     exactly one place — and the copy would drift on the case nobody tests, like
     a revoked company holiday. `weekdayKey` is private to coverage.ts for the
     same reason. */
  const coverage = computeCoverage({
    from: day,
    to,
    loggedDays: new Set<string>(),
    // Whole-day kinds only — a half day or a short leave leaves the day owed,
    // and the hours actually worked on it should still score it.
    exemptDays: absenceDays(exemptingAbsences(approved), day, to),
    // `closesTheStudio`, not every holiday row: a REVOKED company holiday must
    // not zero a day the denominator still counts.
    isHoliday: (iso) =>
      buildHolidayCalendar(orgRows).some((row) => row.day === iso && closesTheStudio(row)),
    patternFor: (iso) => patternForDay(schedule, iso),
    // The day itself, so it can never fall out as before-they-joined or
    // not-yet-due — this is a day they have already logged hours against.
    joinedOn: day,
    today: day,
  })

  const fraction = coverage.days[0]?.fraction ?? 0
  if (fraction <= 0) return null
  return scheduledMinutesForFraction(fraction)
}

/**
 * Recompute and store one day's derived score.
 *
 * Returns what it did, so a caller that wants to report it can — nothing
 * depends on the value, and the entry write has already succeeded either way.
 */
export async function syncAutoScore(
  userId: string,
  day: string,
): Promise<{ wrote: number } | { skipped: 'self' | 'no-basis' | 'error' }> {
  try {
    const [entries, existingRows] = await Promise.all([
      db
        .select({ minutes: liveWorklogEntries.minutes })
        .from(liveWorklogEntries)
        .where(and(eq(liveWorklogEntries.userId, userId), eq(liveWorklogEntries.day, day))),
      db
        .select({ percent: dailyWorklogs.percent, source: dailyWorklogs.scoreSource })
        .from(dailyWorklogs)
        .where(and(eq(dailyWorklogs.userId, userId), eq(dailyWorklogs.day, day)))
        .limit(1),
    ])

    const existing = existingRows[0] ?? null

    // THE GUARD, BEFORE ANY WORK. A score the person typed is theirs, forever,
    // however many hours they add to the day afterwards.
    if (!mayAutoScore(existing)) return { skipped: 'self' }

    const scheduled = await scheduledMinutesFor(userId, day)
    const percent = autoScoreFromHours(totalMinutes(entries), scheduled)

    /* NO BASIS, NO WRITE — and no erase either. This is reached when the day
       has no scheduled length (a Sunday, a holiday, approved leave) or when
       every entry has been removed from it. An earlier derived score is left
       standing rather than deleted: `daily_worklogs` is not a soft-delete
       table, so removing the row would be a hard delete of a record the
       calendar, the streak and the month's average all read, in order to react
       to somebody clearing a day they may be about to re-enter. The stale case
       is visible and correctable — the person can score the day themselves,
       which also moves it permanently out of this function's reach. */
    if (percent === null) return { skipped: 'no-basis' }

    // Nothing to do when the derived number has not moved. Skipping the write
    // keeps `updatedAt` honest: it marks when the day last CHANGED, not when an
    // entry was last touched.
    if (existing && existing.percent === percent) return { wrote: percent }

    await db
      .insert(dailyWorklogs)
      .values({ userId, day, percent, scoreSource: 'from_hours', note: null })
      .onConflictDoUpdate({
        target: [dailyWorklogs.userId, dailyWorklogs.day],
        /* THE NOTE IS NOT TOUCHED. Somebody may have written a line about the
           day without scoring it; deriving the score must not take their words
           with it. Only the two columns this function owns are set. */
        set: { percent, scoreSource: 'from_hours', updatedAt: new Date() },
      })

    return { wrote: percent }
  } catch (error) {
    // The hours are already saved. A failure here costs the score, never the
    // entry, and must never surface as "your entry did not save".
    console.error('[worklog] auto-score failed', { day }, error)
    return { skipped: 'error' }
  }
}

/**
 * How many days one nightly pass will score. A cap rather than "everything",
 * so the FIRST run — which meets every day anybody ever logged hours against
 * without scoring — cannot run past the tick's 60-second ceiling. What is left
 * over is taken tomorrow, and the pass is idempotent, so a partial run costs
 * nothing but a day's delay.
 */
const BACKFILL_LIMIT = 200

/**
 * Score the days that already had hours before auto-scoring existed.
 *
 * WITHOUT THIS THE FEATURE LOOKS BROKEN ON DAY ONE. `syncAutoScore` runs on
 * entry writes, so a day whose hours were logged last week is never touched
 * again and sits on the ledger reading "hours in, no score" forever — which is
 * the exact state this whole change was asked for to clear.
 *
 * Also self-healing: any day whose score write failed (the sync swallows its
 * own errors, by contract) is picked up on a later night with no intervention.
 *
 * ONLY DAYS WITH NO ROW AT ALL. A day already carrying a score is left alone
 * whoever wrote it — `syncAutoScore` would refuse a 'self' row anyway, and not
 * asking is cheaper than asking and being refused.
 */
export async function backfillAutoScores(
  now: Date,
  limit: number = BACKFILL_LIMIT,
): Promise<{ found: number; scored: number }> {
  const today = resolveWorkDay(now)
  const from = isoDayAdd(today, -BACKFILL_WINDOW_DAYS)

  const candidates = await db
    .selectDistinct({ userId: liveWorklogEntries.userId, day: liveWorklogEntries.day })
    .from(liveWorklogEntries)
    .leftJoin(
      dailyWorklogs,
      and(
        eq(dailyWorklogs.userId, liveWorklogEntries.userId),
        eq(dailyWorklogs.day, liveWorklogEntries.day),
      ),
    )
    .where(
      and(
        gte(liveWorklogEntries.day, from),
        lte(liveWorklogEntries.day, today),
        // The whole point: hours exist and no day record does.
        isNull(dailyWorklogs.id),
      ),
    )
    // Oldest first, so a capped run clears the days that have waited longest
    // rather than an arbitrary slice Postgres happened to return.
    .orderBy(liveWorklogEntries.day)
    .limit(limit)

  let scored = 0
  for (const candidate of candidates) {
    const result = await syncAutoScore(candidate.userId, candidate.day)
    if ('wrote' in result) scored += 1
  }

  return { found: candidates.length, scored }
}

/** Matches the nudge's own window — see nudge-queries.ts. */
const BACKFILL_WINDOW_DAYS = 60
