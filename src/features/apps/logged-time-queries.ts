import { and, eq, gte, inArray, isNotNull, lt, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveWorklogEntries } from '@/db/live'
import { users } from '@/db/schema'
import { can, effectiveGrant, type Actor } from '@/features/auth/capabilities'
import { groupLoggedTime, monthRange, type PersonLoggedTime } from '@/features/apps/logged-time'

export type LoggedTimeView = {
  byApp: Map<string, PersonLoggedTime[]>
  /**
   * Whether the viewer's grant reaches EVERY person's rows on this app. When
   * false, an empty list means "you logged none", not "nobody did" — the card
   * must word it that way or it states something false.
   */
  seesWholeApp: (appId: string) => boolean
}

/**
 * Per-person worklog time for the /apps grid, already cut down to what this
 * viewer may read under `worklog.view` (see logged-time.ts).
 *
 * Deliberately NOT a column of `listApps`: that is the cached one-definition
 * read the AI context pack and the meeting planner also call, neither needs
 * hours, and it has no actor to filter by. Folding this in would have charged
 * them a sum over every worklog row and handed them colleagues' hours.
 *
 * Null when the viewer's grant is 'none' (stakeholder), so the card can drop
 * the band entirely rather than print "none logged" on every project — which
 * would be false, not merely hidden.
 */
export async function loadLoggedTimeByApp(
  actor: Actor | null,
  /** `YYYY-MM`, Asia/Colombo — the card shows one month, named on it. */
  month: string,
): Promise<LoggedTimeView | null> {
  if (!actor) return null
  const grant = effectiveGrant(actor.role, actor.employmentType, 'worklog.view')
  const { start, end } = monthRange(month)
  if (grant === 'none') return null

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
        isNotNull(liveWorklogEntries.appId),
        gte(liveWorklogEntries.day, start),
        lt(liveWorklogEntries.day, end),
        // Rows the viewer cannot read never leave the database: 'own' is
        // their rows only, 'scoped' is their in-scope apps plus their own
        // rows anywhere. The per-row can() below still decides.
        grant === 'own'
          ? eq(liveWorklogEntries.userId, actor.id)
          : grant === 'scoped'
            ? actor.scopeAppIds.size > 0
              ? or(
                  inArray(liveWorklogEntries.appId, [...actor.scopeAppIds]),
                  eq(liveWorklogEntries.userId, actor.id),
                )
              : eq(liveWorklogEntries.userId, actor.id)
            : undefined,
      ),
    )
    .groupBy(liveWorklogEntries.appId, users.id, users.name, users.avatarUrl)

  return {
    byApp: groupLoggedTime(rows, (row) =>
      can(actor, 'worklog.view', { ownerId: row.userId, appId: row.appId }),
    ),
    // No ownerId: true only when the grant reaches the whole app ('all', or
    // 'scoped' with the app in scope) — never for an 'own' grant.
    seesWholeApp: (appId) => can(actor, 'worklog.view', { appId }),
  }
}
