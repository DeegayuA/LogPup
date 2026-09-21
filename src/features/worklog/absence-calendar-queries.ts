import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/db'
import { absences, assignments, users } from '@/db/schema'
import { can, effectiveGrant, type Actor } from '@/features/auth/capabilities'
import { canReviewAbsence, type AbsenceRow } from '@/features/worklog/absence-queries'
import { getOrgHolidayDays } from '@/features/worklog/queries'

/**
 * The calendar's own reads. `absence-queries.ts` is NOT edited — its `select`
 * shape is re-declared here rather than exported from there, and its
 * `canReviewAbsence` predicate is reused rather than re-asked, so there is
 * still exactly one answer to "may this actor decide this absence".
 */

/** An absence plus the ONE answer the UI may not re-derive: may this actor
 *  decide it. */
export type AbsenceCalendarRow = AbsenceRow & { canReview: boolean }

const select = {
  id: absences.id,
  userId: absences.userId,
  userName: users.name,
  kind: absences.kind,
  status: absences.status,
  startDate: absences.startDate,
  endDate: absences.endDate,
  reason: absences.reason,
}

/**
 * Every absence of every status overlapping `[fromIso, toIso]`, BOTH BOUNDS
 * INCLUSIVE — `startDate <= to AND endDate >= from`, the same overlap
 * predicate `approvedAbsenceUserIds` (absence-queries.ts) documents.
 * Containment would drop a fortnight's leave spanning the whole grid, which
 * is exactly the row that matters to a calendar.
 *
 * VIEW gate: any non-'none' `absence.view` grant may see the range (a
 * stakeholder, 'none', sees nothing). Deliberately NOT `listRecentAbsences`'s
 * literal `can(actor,'absence.view') || can(actor,'absence.view',{appId:
 * null})` — that shape asks `can()` with no resource, which fails closed for
 * EVERY 'scoped' or 'own' grant (manager, editor, member all included), the
 * exact scoped-grant-fails-closed footgun `canReviewAbsence`'s own comment
 * already names and fixes once below. Reusing it here would make a manager's
 * 'scoped' `absence.approve` unreachable from this module — nothing would
 * ever call `canReviewAbsence` with a real 'scoped' actor. VIEW itself is not
 * scoped to rows here (unlike REVIEW): `canReview` decides row-by-row PER the
 * data contract, so there is no second per-row view filter to write.
 *
 * `canReview` is decided PER ROW, never page-wide (the scoped-grant-fails-
 * closed shape this page used to have): a self row asks
 * `request.review.self`; everyone else's asks `canReviewAbsence` against
 * THEIR OWN assignments, batched in one `inArray` read that is paid only
 * when the manager's 'scoped' case actually needs it — `can(actor,
 * 'absence.approve')` already answers true with no appIds for 'all', and
 * `effectiveGrant(...) === 'none'` already answers false with no appIds
 * either, so skipping the read for both costs nothing. Short-circuit copied
 * from `listPendingAbsences`.
 */
export async function listAbsencesForRange(
  actor: Actor,
  fromIso: string,
  toIso: string,
): Promise<AbsenceCalendarRow[]> {
  if (effectiveGrant(actor.role, actor.employmentType, 'absence.view') === 'none') return []

  const rows = await db
    .select(select)
    .from(absences)
    .innerJoin(users, eq(users.id, absences.userId))
    .where(and(lte(absences.startDate, toIso), gte(absences.endDate, fromIso)))
    .orderBy(absences.startDate)

  const approvesAll = can(actor, 'absence.approve')
  const approveGrant = effectiveGrant(actor.role, actor.employmentType, 'absence.approve')

  const appIdsByUser = new Map<string, string[]>()
  if (!approvesAll && approveGrant !== 'none') {
    const otherUserIds = [...new Set(rows.filter((r) => r.userId !== actor.id).map((r) => r.userId))]
    if (otherUserIds.length > 0) {
      const memberships = await db
        .select({ userId: assignments.userId, appId: assignments.appId })
        .from(assignments)
        .where(inArray(assignments.userId, otherUserIds))
      for (const m of memberships) {
        const list = appIdsByUser.get(m.userId)
        if (list) list.push(m.appId)
        else appIdsByUser.set(m.userId, [m.appId])
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    canReview:
      row.userId === actor.id
        ? can(actor, 'request.review.self', { ownerId: actor.id })
        : canReviewAbsence(actor, { userId: row.userId, appIds: appIdsByUser.get(row.userId) ?? [] }),
  }))
}

/**
 * The month's two reads in one round trip. `orgHolidayDays` is
 * `getOrgHolidayDays` (worklog/queries.ts) — revocation is already applied
 * there; this never re-reads the table itself.
 */
export async function loadAbsenceCalendar(
  actor: Actor,
  fromIso: string,
  toIso: string,
): Promise<{ rows: AbsenceCalendarRow[]; orgHolidayDays: string[] }> {
  const [rows, orgHolidayDays] = await Promise.all([
    listAbsencesForRange(actor, fromIso, toIso),
    getOrgHolidayDays(fromIso, toIso),
  ])
  return { rows, orgHolidayDays }
}
