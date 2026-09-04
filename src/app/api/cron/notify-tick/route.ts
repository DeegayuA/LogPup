import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { inArray, lt, or } from 'drizzle-orm'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { createNotifications } from '@/features/notifications/notify'
import { collectWorklogNudgeInputs } from '@/features/worklog/nudge-queries'
import { nudgeBody, planWorklogNudges } from '@/features/worklog/nudge'
import { backfillAutoScores } from '@/features/worklog/auto-score-sync'
import {
  planRetention,
  retentionCutoffs,
  summarizeRetention,
  type PruneReason,
} from '@/features/notifications/retention'

/**
 * The notification tick. Invoked by Vercel Cron (see vercel.json).
 *
 * THIS IS THE ONLY PLACE A NEW SCHEDULED CONCERN MAY GO. LogPup is on Vercel
 * Hobby: two cron jobs, daily granularity, and the daily backup already holds
 * one of them. So everything periodic is an ORDERED STEP inside this handler,
 * never a second job — digest assembly and deadline escalation both land here
 * when they ship. Adding a third entry to vercel.json fails the deploy, and
 * finding that out at deploy time is why this paragraph exists.
 *
 * Three steps today, in this order:
 *
 *   1. Retention pruning — deletes rows that have outlived their window.
 *   2. The worklog nudge — tells people with a real backlog of unlogged days
 *      that they have one, with nobody logged in and nothing to open first.
 *   3. The auto-score backfill — scores days that carry hours and no score.
 *
 * Pruning runs FIRST so the nudge's own rows are never candidates for deletion
 * in the tick that wrote them. The backfill runs LAST because it removes days
 * from the owed list, and doing it before the nudge would mean telling somebody
 * about a backlog this same tick was about to clear.
 *
 * THE NUDGE WRITES NOTIFICATIONS AND NOTHING ELSE. No worklog is drafted,
 * scored or filed on anybody's behalf here — a worklog is a first-person
 * statement, and a background job that wrote one would be a machine's account
 * of somebody's week wearing their name. See features/worklog/nudge.ts.
 *
 * Scheduled 03:30 UTC — half an hour behind the backup, so the morning's
 * snapshot still contains whatever this tick is about to delete, and 09:00 in
 * Colombo, which is where the digest wants to land when it ships. Hobby fires
 * a cron within the hour of its slot, so that ordering is a preference and not
 * a guarantee; nothing here depends on it.
 *
 * Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when
 * CRON_SECRET is set, which we require so the endpoint can't be triggered by
 * anyone else — an unauthenticated tick is a public DELETE button.
 */
// Reading the Authorization header already makes this handler dynamic, and
// Next 16 does not cache GET route handlers by default — this export is here so
// both cron routes read identically, not because anything depends on it.
export const dynamic = 'force-dynamic'
// Well under backup's 300: this handler reads one bounded batch and deletes it.
// A tick that needed minutes would mean the batch cap below is wrong.
export const maxDuration = 60

// Constant-time comparison of the presented header against the expected secret.
// A plain `===` leaks timing information proportional to the matching prefix length,
// letting an attacker recover CRON_SECRET byte-by-byte. Hashing both sides first also
// normalizes their length, so timingSafeEqual (which requires equal-length buffers)
// never throws regardless of what the caller sends.
//
// Byte-for-byte the check in api/cron/backup/route.ts. Left duplicated rather
// than hoisted because the plan above caps this codebase at exactly two cron
// routes forever — a shared module for a two-member set buys a hop, not a
// safeguard. If this check changes, change both.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const providedDigest = createHash('sha256').update(provided).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}

// The most rows one tick will delete. A cap rather than "everything that
// matches" so the first tick after this ships — which meets a table nobody has
// ever pruned — cannot run past maxDuration and leave a half-finished delete
// behind. Anything left over is reported as `hasMore` and taken tomorrow.
const CANDIDATE_LIMIT = 5_000

// Ids per DELETE. `neon-http` sends each statement as a single HTTP request, so
// one five-thousand-parameter IN list is a request large enough to be rejected
// by something between here and Postgres; a few small statements are not.
const DELETE_CHUNK = 500

type PruneResult = {
  /** Rows the retention rule was evaluated against this tick. */
  scanned: number
  deleted: number
  byReason: Record<PruneReason, number>
  /** True when the batch cap was hit and rows remain for the next tick. */
  hasMore: boolean
}

/**
 * Delete notifications that have outlived the retention windows.
 *
 * A real DELETE, on purpose: `notifications` is NOT one of the soft-deleted
 * tables. Its `dismissed_at` is somebody clearing their own inbox, not an
 * admin trashing a record, so there is no trash bin for these rows to sit in
 * and nothing to restore them from. (This function is the one notifications
 * entry in DELETE_ALLOWED_FUNCTIONS in src/db/live.test.ts, with that reason.)
 *
 * The WHERE clause narrows and the pure rule decides. Both halves take their
 * numbers from retention.ts, and the delete names explicit ids rather than
 * re-stating the predicate — so a wrong cutoff can only lose the rows this
 * process already looked at and counted, never everything the predicate would
 * have swept up on the server.
 */
async function pruneExpiredNotifications(now: Date): Promise<PruneResult> {
  const cutoffs = retentionCutoffs(now)

  // `created_at` is timestamp WITHOUT time zone here while `dismissed_at` has
  // one, so this comparison is only as aligned as the database session's zone.
  // It does not matter at this scale: the tightest window is 30 days and the
  // worst possible skew is a few hours.
  const candidates = await db
    .select({
      id: notifications.id,
      createdAt: notifications.createdAt,
      dismissedAt: notifications.dismissedAt,
    })
    .from(notifications)
    .where(or(
      lt(notifications.dismissedAt, cutoffs.dismissedBefore),
      lt(notifications.createdAt, cutoffs.createdBefore),
    ))
    // Oldest first, so a capped tick clears the rows that have waited longest
    // instead of an arbitrary slice Postgres happened to return.
    .orderBy(notifications.createdAt)
    .limit(CANDIDATE_LIMIT + 1)

  const hasMore = candidates.length > CANDIDATE_LIMIT
  const batch = hasMore ? candidates.slice(0, CANDIDATE_LIMIT) : candidates

  const { prune } = planRetention(batch, now)
  const ids = prune.map((decision) => decision.row.id)
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    await db.delete(notifications).where(inArray(notifications.id, ids.slice(i, i + DELETE_CHUNK)))
  }

  return {
    scanned: batch.length,
    deleted: ids.length,
    byReason: summarizeRetention(prune),
    hasMore,
  }
}

/**
 * Tell people with a real backlog of unlogged days that they have one.
 *
 * WHY A CRON AND NOT A BANNER. The catch-up ledger only reaches somebody who
 * opens /worklog, and the people it exists for are precisely the ones who have
 * not opened it in a week. Nothing in the app could reach them until this step.
 *
 * ONE MESSAGE PER BACKLOG, NOT ONE PER NIGHT. The rung is armed on the oldest
 * unlogged day (nudge.ts), so `createNotifications`' ladder dedupe collapses a
 * re-run over an unchanged backlog to nothing at all, while a new gap opening
 * in front of the old one re-arms it. Without that this handler would mail
 * everybody behind, every night, forever.
 *
 * `createNotifications` is best-effort by contract and swallows its own
 * failures, so this step cannot be what fails the tick — but the counts it
 * returns are computed here, from what was actually planned, rather than
 * assumed from the roster size.
 */
async function nudgeUnloggedDays(now: Date): Promise<{ considered: number; nudged: number }> {
  const inputs = await collectWorklogNudgeInputs(now)
  const nudges = planWorklogNudges(inputs)
  if (nudges.length === 0) return { considered: inputs.length, nudged: 0 }

  await createNotifications(
    nudges.map((nudge) => ({
      userId: nudge.userId,
      // 'system' — the legacy discriminator. Nobody DID this; it is a fact
      // about the person's own record, which is also why there is no actorId.
      type: 'system' as const,
      kind: 'worklog.gap',
      title: `${nudge.owed} ${nudge.owed === 1 ? 'day' : 'days'} to log`,
      body: nudgeBody(nudge, (iso) =>
        format(new Date(`${iso}T12:00:00`), 'EEEE, MMMM d'),
      ),
      link: '/worklog',
      // No `entity`: this is about the person, not about a row that could be
      // trashed underneath them — which is also why it needs no visibility
      // gate. dropDeadEntities would otherwise have nothing to check and
      // `can()` nothing to ask about.
      dedupe: {
        mode: 'ladder' as const,
        ladder: 'worklog.gap',
        // The person is the subject, so they are the entity the ladder is
        // keyed on. One ladder per person, one rung per oldest-unlogged-day.
        entityId: nudge.userId,
        step: 'backlog',
        armedOn: nudge.armedOn,
      },
    })),
    now,
  )

  return { considered: inputs.length, nudged: nudges.length }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // The clock is read ONCE, here, and passed down. Every step this handler
  // grows shares the instant, so a tick that straddles midnight cannot have
  // its steps disagree about which day it is.
  const ranAt = new Date()

  try {
    const retention = await pruneExpiredNotifications(ranAt)
    /* STEP TWO. Its own try/catch: a nudge that cannot be planned — one bad
       schedule row, one unreachable read — must not throw away a prune that
       already succeeded and already deleted rows. The tick reports what each
       half did rather than reporting the whole thing failed. */
    let nudge: { considered: number; nudged: number } | { error: true } = { error: true }
    try {
      nudge = await nudgeUnloggedDays(ranAt)
    } catch (e) {
      console.error('[notify-tick] worklog nudge failed:', e)
    }

    /* STEP THREE: score the days that carry hours and no score.
       syncAutoScore runs on entry writes, so a day logged last week is never
       touched again — this is what stops it sitting on the ledger reading
       "hours in, no score" forever. Idempotent and capped, so a partial run
       costs a day's delay and nothing else. Its own try/catch for the same
       reason as the nudge: one failing step must not discard two that
       already succeeded and already wrote. */
    let scores: { found: number; scored: number } | { error: true } = { error: true }
    try {
      scores = await backfillAutoScores(ranAt)
    } catch (e) {
      console.error('[notify-tick] auto-score backfill failed:', e)
    }

    return NextResponse.json({ ok: true, ranAt: ranAt.toISOString(), retention, nudge, scores })
  } catch (e) {
    console.error('[notify-tick] failed:', e)
    return NextResponse.json({ error: 'Notify tick failed' }, { status: 500 })
  }
}
