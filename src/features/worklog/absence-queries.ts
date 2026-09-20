import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/db'
import { absences, assignments, users } from '@/db/schema'
import { can, effectiveGrant, type Actor } from '@/features/auth/capabilities'

export type AbsenceRow = {
  id: string
  userId: string
  userName: string
  kind: string
  status: string
  startDate: string
  endDate: string
  reason: string | null
}

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
 * Absences waiting on this actor.
 *
 * A `manager` sees their scope; admin and above see everything. Their OWN
 * pending absence is excluded unless they are a superadmin — nobody reviews
 * their own, and showing a row you cannot action is just noise.
 *
 * The SEAT check is `effectiveGrant`, not `can()` with no resource:
 * absence.approve is 'scoped' for manager, and a scoped grant asked with no
 * resource — `{ appId: null }` included, `appId` is nullish either way —
 * always fails closed, which used to return [] for every manager regardless
 * of who they actually manage. The real scoping happens per row below,
 * against the absent person's OWN apps (assignments, same scope source
 * worklog.review uses) — not the actor's — because the question here is
 * "is this person on a project I run", not "do I reach this app".
 */
export async function listPendingAbsences(actor: Actor): Promise<AbsenceRow[]> {
  if (effectiveGrant(actor.role, actor.employmentType, 'absence.approve') === 'none') return []

  const rows = await db
    .select(select)
    .from(absences)
    .innerJoin(users, eq(users.id, absences.userId))
    .where(eq(absences.status, 'pending'))
    .orderBy(absences.startDate)

  const canReviewOwn = can(actor, 'request.review.self', { ownerId: actor.id })
  const ownFiltered = rows.filter((r) => canReviewOwn || r.userId !== actor.id)

  // `absence.approve` is 'all' for admin and up — can() answers true with no
  // resource there, so the assignments read below is paid only by the
  // 'scoped' case (manager) that actually needs it.
  if (can(actor, 'absence.approve')) return ownFiltered

  const userIds = [...new Set(ownFiltered.map((r) => r.userId))]
  if (userIds.length === 0) return []

  const memberships = await db
    .select({ userId: assignments.userId, appId: assignments.appId })
    .from(assignments)
    .where(inArray(assignments.userId, userIds))
  const appIdsByUser = new Map<string, string[]>()
  for (const m of memberships) {
    const list = appIdsByUser.get(m.userId)
    if (list) list.push(m.appId)
    else appIdsByUser.set(m.userId, [m.appId])
  }

  return ownFiltered.filter((r) =>
    canReviewAbsence(actor, { userId: r.userId, appIds: appIdsByUser.get(r.userId) ?? [] }),
  )
}

/**
 * The ONE predicate for "may `actor` decide someone else's absence" — shared
 * by the filter above and `review()` in absence-actions.ts, which used to ask
 * a different question (`can(actor, 'absence.approve', { ownerId: row.userId
 * })`, no appId at all). `absence.approve` is 'scoped' for manager, and a
 * scoped grant asked with no appId/appIds always fails closed, so every
 * manager saw the row here and then had review() refuse it.
 *
 * Scoped against the ABSENT PERSON's own apps (assignments), same as above —
 * never the actor's — because the question is "is this person on a project I
 * run", not "do I reach this app".
 */
export function canReviewAbsence(
  actor: Actor,
  target: { userId: string; appIds: readonly string[] },
): boolean {
  // Self-review is request.review.self's job, not this one's — callers gate
  // isSelf separately before ever reaching here. A defensive `false`, not an
  // assumption: this predicate must never be the thing that lets a 'scoped'
  // grant's owns-shortcut turn into a manager signing their own row.
  if (target.userId === actor.id) return false
  return can(actor, 'absence.approve') || can(actor, 'absence.approve', { appIds: target.appIds })
}

/** Recent absences of every status, for the admin calendar view. */
export async function listRecentAbsences(actor: Actor, limit = 50): Promise<AbsenceRow[]> {
  if (!can(actor, 'absence.view') && !can(actor, 'absence.view', { appId: null })) return []
  return db
    .select(select)
    .from(absences)
    .innerJoin(users, eq(users.id, absences.userId))
    .orderBy(desc(absences.startDate))
    .limit(limit)
}

/**
 * The set of days an APPROVED absence covers, for one person and window.
 *
 * Pending absences are deliberately absent: a person cannot lower their own
 * denominator by typing. Both bounds inclusive, matching the column comment.
 */
export async function approvedAbsenceDays(
  userId: string,
  from: string,
  to: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ startDate: absences.startDate, endDate: absences.endDate })
    .from(absences)
    .where(and(eq(absences.userId, userId), eq(absences.status, 'approved'), gte(absences.endDate, from)))

  const days = new Set<string>()
  for (const row of rows) {
    const cursor = new Date(`${row.startDate}T12:00:00Z`)
    const end = new Date(`${row.endDate}T12:00:00Z`)
    while (cursor <= end) {
      const iso = cursor.toISOString().slice(0, 10)
      if (iso >= from && iso < to) days.add(iso)
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }
  return days
}

/**
 * Everyone with an APPROVED absence overlapping [from, to].
 *
 * Batched, unlike `approvedAbsenceDays` above: the meeting-load sweep asks
 * "who cannot be in a room this week" about the whole workspace at once, and a
 * per-person call would issue one round trip per candidate on a driver where
 * every await is a full one.
 *
 * BOTH BOUNDS INCLUSIVE, matching the column comment and the sibling function
 * — an absence that ends on the first day of the window still covers that day.
 * Overlap is therefore `startDate <= to AND endDate >= from`, not containment;
 * a fortnight's leave spanning the whole window has neither bound inside it
 * and is exactly the row that must not be missed.
 *
 * Pending absences are deliberately absent, for the same reason as above: a
 * person cannot excuse themselves from a room by typing.
 */
export async function approvedAbsenceUserIds(from: string, to: string): Promise<Set<string>> {
  const rows = await db
    .select({ userId: absences.userId })
    .from(absences)
    .where(and(
      eq(absences.status, 'approved'),
      lte(absences.startDate, to),
      gte(absences.endDate, from),
    ))
  return new Set(rows.map((row) => row.userId))
}
