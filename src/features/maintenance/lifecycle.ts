import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { maintenanceWindow } from '@/db/schema'
import { listActiveUsers } from '@/features/people/queries'
import { createNotifications } from '@/features/notifications/notify'
import { LK_TIMEZONE } from '@/lib/lk-holidays'
import { readMaintenanceRow } from './freeze'
import {
  MAINTENANCE_SINGLETON_ID,
  KIND_HEADINGS,
  backOnlineMessage,
  formatWindowRange,
  maintenancePhase,
  parseMaintenanceWindow,
  startedTitle,
  type MaintenanceKind,
  type MaintenanceWindow,
} from './window'

/**
 * THE LIFECYCLE, DRIVEN BY REQUESTS RATHER THAN BY A CRON.
 *
 * The obvious shape is a job every five minutes. This app cannot have one:
 * Vercel Hobby allows two cron entries at DAILY granularity, one is the
 * nightly backup, and docs/superpowers/plans/2026-08-20-work-substrate.md
 * reserves the other — and a daily job would announce a 20:00→06:00 window up
 * to twenty-four hours late, which is worse than not announcing it.
 *
 * So the announcements ride the requests that were happening anyway. The
 * window row is already read on every render (the root layout mounts the
 * banner from it), so noticing "this has started" costs no extra query: the
 * stamps come back with the same row, and the common case — already announced,
 * or nothing armed — returns before touching the database again.
 *
 * WHAT THIS TRADES AWAY: the "we're back online" announcement and the
 * enabled:false flip wait for the first person to load a page after the window
 * ends. The window is over either way — the phase is wall-clock arithmetic, so
 * the app unlocks itself at endAtMs whether or not anyone was there to see it
 * — but the notification is late by however long the workspace stays empty.
 * For a studio whose maintenance windows end at 06:00 on a working day, that
 * is minutes.
 *
 * SAFE UNDER CONCURRENCY. Two requests landing in the same millisecond both
 * try to claim the announcement with a conditional UPDATE, and Postgres lets
 * exactly one of them match a row. The loser gets an empty `returning()` and
 * says nothing, so nobody is notified twice.
 */

/**
 * The stamps hold a startAtMs, not a timestamp.
 *
 * "Have we announced?" is meaningless on its own — announced for WHICH window?
 * Storing the window's own start instant makes the comparison total: equal
 * means this window has been announced, different means a window has been
 * re-armed since and owes a fresh announcement. A plain boolean, or a
 * "notified at" timestamp, would both leave a re-armed window silent.
 */
async function claim(
  field: 'startNotifiedAtMs' | 'endNotifiedAtMs',
  window: MaintenanceWindow,
  alsoDisable: boolean,
): Promise<boolean> {
  const column =
    field === 'startNotifiedAtMs'
      ? maintenanceWindow.startNotifiedAtMs
      : maintenanceWindow.endNotifiedAtMs
  try {
    const claimed = await db
      .update(maintenanceWindow)
      .set(
        alsoDisable
          ? { [field]: window.startAtMs, enabled: false }
          : { [field]: window.startAtMs },
      )
      .where(
        and(
          eq(maintenanceWindow.id, MAINTENANCE_SINGLETON_ID),
          eq(maintenanceWindow.enabled, true),
          // IS DISTINCT FROM, not <>: the stamp starts NULL, and `NULL <> 5`
          // is NULL rather than true, so a plain inequality would match no row
          // and the very first announcement would never be claimed.
          sql`${column} is distinct from ${window.startAtMs}`,
        ),
      )
      .returning({ id: maintenanceWindow.id })
    return claimed.length > 0
  } catch (error) {
    console.error('[maintenance] lifecycle claim', field, error)
    return false
  }
}

/**
 * One row per person, to everyone who can still be handed work.
 *
 * listActiveUsers is the roster every picker in the app is built from, so a
 * maintenance notice reaches exactly the set of people the app considers
 * present — no removed accounts, no pending sign-ups.
 */
export async function announceToEveryone(
  kind: MaintenanceKind,
  title: string,
  body: string,
): Promise<void> {
  try {
    const people = await listActiveUsers()
    await createNotifications(
      people.map((person) => ({ userId: person.id, type: 'system' as const, title, body })),
    )
  } catch (error) {
    // Best-effort, like every other notification write in this codebase: an
    // announcement that fails must not be what stops the window working.
    console.error('[maintenance] announce', kind, error)
  }
}

/** "It has started" / "we're back", each announced exactly once per window. */
export async function runMaintenanceLifecycle(): Promise<void> {
  const row = await readMaintenanceRow()
  const window = parseMaintenanceWindow(row)
  if (!row || !window || !window.enabled) return

  const phase = maintenancePhase(window, Date.now())
  if (phase === 'off' || phase === 'scheduled') return

  if (phase === 'active') {
    if (row.startNotifiedAtMs === window.startAtMs) return
    if (!(await claim('startNotifiedAtMs', window, false))) return
    await announceToEveryone(
      window.kind,
      startedTitle(window.kind),
      window.message ||
        `LogPup is unavailable until ${formatWindowRange(window.startAtMs, window.endAtMs, LK_TIMEZONE)}.`,
    )
    return
  }

  // phase === 'ended'. The same UPDATE that claims the announcement also flips
  // `enabled` off, so the row settles into the inert state the next arming
  // overwrites — one write, not two, and no window where the announcement has
  // been claimed but the switch is still on.
  if (row.endNotifiedAtMs === window.startAtMs) return
  if (!(await claim('endNotifiedAtMs', window, true))) return
  await announceToEveryone(window.kind, 'LogPup is back online', backOnlineMessage(window.kind))
}

/** The "we have scheduled one" notice, sent from the control popup on arming. */
export async function announceScheduled(window: MaintenanceWindow): Promise<void> {
  await announceToEveryone(
    window.kind,
    `${KIND_HEADINGS[window.kind]} scheduled`,
    window.message ||
      `LogPup will be unavailable ${formatWindowRange(window.startAtMs, window.endAtMs, LK_TIMEZONE)}.`,
  )
}
