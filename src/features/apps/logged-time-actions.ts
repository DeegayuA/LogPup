'use server'

import { z } from 'zod'
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveWorklogEntries } from '@/db/live'
import { users } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { loadActor } from '@/features/auth/actor'
import { can, effectiveGrant } from '@/features/auth/capabilities'
import {
  MONTH_PATTERN,
  groupLoggedTime,
  monthRange,
  type PersonLoggedTime,
} from '@/features/apps/logged-time'

/**
 * Bounded both ways on the SERVER, not just by the panel's disabled button:
 * the action is callable directly, `0000-01` is a date Postgres refuses (a
 * throw, not an empty month), and nobody has logged a future month.
 */
const input = z.object({
  appId: z.string().uuid('That is not a project'),
  month: z
    .string()
    .regex(MONTH_PATTERN, 'That is not a month')
    .refine((m) => m >= '2000-01', 'That month is too early')
    .refine(
      (m) => m <= toIsoDateInTimeZone(new Date(), LK_TIMEZONE).slice(0, 7),
      'That month has not happened yet',
    ),
})

export type AppMonthHours = {
  month: string
  people: PersonLoggedTime[]
  /** The viewer's grant stops at their own rows on this app — see logged-time.ts. */
  onlyOwn: boolean
}

/**
 * One app's hours for one month, one figure per person — what the card's
 * Hours panel shows when it is opened or moved to another month.
 *
 * A READ, but a server action rather than a route because it is called from
 * a client component in reply to a click, and it re-checks `worklog.view`
 * itself: the month and app arrive from the browser, so nothing the page
 * filtered earlier can be assumed here. Same rules as the card loader
 * (logged-time-queries.ts): where the grant stops at the viewer's own rows on
 * this app, only those rows leave the database, and every row still passes
 * `can()`.
 *
 * Never throws: a rejected action inside the panel's transition would take
 * the whole /apps segment to its error boundary over one popover.
 */
export async function getAppMonthHours(raw: {
  appId: string
  month: string
}): Promise<ActionResult<AppMonthHours>> {
  const parsed = input.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid request')
  const { appId, month } = parsed.data

  try {
    const actor = await loadActor()
    if (!actor) return err('Sign in to see hours')
    if (effectiveGrant(actor.role, actor.employmentType, 'worklog.view') === 'none') {
      return err('Not allowed')
    }
    const onlyOwn = !can(actor, 'worklog.view', { appId })

    const { start, end } = monthRange(month)
    const rows = await db
      .select({
        appId: liveWorklogEntries.appId,
        userId: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        // sum() of an integer is bigint, which the driver returns as a string.
        minutes: sql<number>`sum(${liveWorklogEntries.minutes})`.mapWith(Number),
      })
      .from(liveWorklogEntries)
      .innerJoin(users, eq(liveWorklogEntries.userId, users.id))
      .where(
        and(
          eq(liveWorklogEntries.appId, appId),
          gte(liveWorklogEntries.day, start),
          lt(liveWorklogEntries.day, end),
          onlyOwn ? eq(liveWorklogEntries.userId, actor.id) : undefined,
        ),
      )
      .groupBy(liveWorklogEntries.appId, users.id, users.name, users.avatarUrl)

    return ok({
      month,
      // Same grouping as the card strip, so the panel's current month and
      // the strip beside it can never disagree.
      people:
        groupLoggedTime(rows, (row) =>
          can(actor, 'worklog.view', { ownerId: row.userId, appId }),
        ).get(appId) ?? [],
      onlyOwn,
    })
  } catch (error) {
    console.error('[apps] getAppMonthHours failed', error)
    return err('Could not load hours. Try again.')
  }
}
