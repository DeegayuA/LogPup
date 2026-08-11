import { and, asc, desc, eq, gt, gte, ilike, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import {
  apps,
  assignmentHistory,
  assignments,
  meetingAttendees,
  meetings,
  tasks,
  users,
} from '@/db/schema'
import { summarizeAllocations } from '@/features/people/allocation'
import {
  allocationTotalSeries,
  buildAllocationTimeline,
  capacityAsOf,
  type HistoryRow,
  type PersonAllocationHistoryView,
} from '@/features/people/allocation-history'

export type TeamMember = {
  assignmentId: string
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  role: string
  allocationPct: number
}

export type CapacityBreakdownEntry = {
  appId: string
  appName: string
  slug: string
  role: string
  allocationPct: number
  /**
   * The live `assignments` row this entry came from, so the dashboard can
   * edit it in place through the existing actions. Null for a historical
   * ("as of") read: those entries describe an interval that may no longer
   * have — or never had — a live row, and are read-only by construction.
   */
  assignmentId: string | null
}

export type UserCapacity = {
  user: {
    id: string
    name: string
    title: string | null
    phone: string | null
    avatarUrl: string | null
    role: 'admin' | 'member'
    orgTags: string[]
  }
  totalPct: number
  overallocated: boolean
  breakdown: CapacityBreakdownEntry[]
}

export type ActiveUser = { id: string; name: string }

/** An app the dashboard's inline "Assign to app" control can target. */
export type AssignableApp = { id: string; name: string; slug: string }

export type PersonBreakdownEntry = {
  appId: string
  appName: string
  slug: string
  role: string
  allocationPct: number
}

export type PersonTask = {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  appName: string
  appSlug: string
}

export type PersonMeeting = { id: string; title: string; startsAt: Date }

export type PersonDetail = {
  user: {
    id: string
    name: string
    email: string
    title: string | null
    phone: string | null
    avatarUrl: string | null
    role: 'admin' | 'member'
    active: boolean
  }
  totalPct: number
  overallocated: boolean
  breakdown: PersonBreakdownEntry[]
  tasks: PersonTask[]
  meetings: PersonMeeting[]
}

export async function getTeamForApp(appId: string): Promise<TeamMember[]> {
  return db
    .select({
      assignmentId: assignments.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: assignments.role,
      allocationPct: assignments.allocationPct,
    })
    .from(assignments)
    .innerJoin(users, eq(assignments.userId, users.id))
    .where(eq(assignments.appId, appId))
    .orderBy(desc(assignments.allocationPct))
}

export async function getUserCapacities(q?: string): Promise<UserCapacity[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      title: users.title,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      userRole: users.role,
      orgTags: users.orgTags,
      assignmentId: assignments.id,
      appId: apps.id,
      appName: apps.name,
      slug: apps.slug,
      role: assignments.role,
      allocationPct: assignments.allocationPct,
    })
    .from(users)
    .leftJoin(assignments, eq(assignments.userId, users.id))
    .leftJoin(apps, eq(assignments.appId, apps.id))
    .where(
      and(
        eq(users.active, true),
        // Excludes self-signed-up users still awaiting admin approval.
        eq(users.status, 'approved'),
        // Escape LIKE metacharacters so "%"/"_" in the search box match literally.
        q ? ilike(users.name, `%${q.replace(/[\\%_]/g, '\\$&')}%`) : undefined,
      ),
    )
    .orderBy(asc(users.name))

  const totalsByUser = new Map(
    summarizeAllocations(
      rows
        .filter((r): r is typeof r & { allocationPct: number } => r.allocationPct != null)
        .map((r) => ({ userId: r.userId, allocationPct: r.allocationPct })),
    ).map((s) => [s.userId, s]),
  )

  const byUser = new Map<string, UserCapacity>()
  for (const row of rows) {
    let entry = byUser.get(row.userId)
    if (!entry) {
      const summary = totalsByUser.get(row.userId)
      entry = {
        user: {
          id: row.userId,
          name: row.name,
          title: row.title,
          phone: row.phone,
          avatarUrl: row.avatarUrl,
          role: row.userRole,
          orgTags: row.orgTags,
        },
        totalPct: summary?.totalPct ?? 0,
        overallocated: summary?.overallocated ?? false,
        breakdown: [],
      }
      byUser.set(row.userId, entry)
    }
    if (row.appId && row.appName && row.slug && row.role != null && row.allocationPct != null) {
      entry.breakdown.push({
        appId: row.appId,
        appName: row.appName,
        slug: row.slug,
        role: row.role,
        allocationPct: row.allocationPct,
        assignmentId: row.assignmentId,
      })
    }
  }

  return [...byUser.values()]
}

/**
 * The team capacity list exactly as it stood at `at`, in the SAME shape as
 * getUserCapacities so the identical UI renders it.
 *
 * Two deliberate limits, both about scope rather than accuracy:
 *  - the ROSTER is today's roster (active, approved users). There is no user
 *    history table, so this answers "how were today's people loaded back
 *    then", not "who worked here back then". Someone deactivated since is
 *    absent even if they carried work on that date.
 *  - `assignmentId` is null throughout: a past interval is not something the
 *    edit actions can target, and the read-only view is the point.
 *
 * The interval predicate is applied in SQL (so a long history doesn't ship
 * wholesale to the server) and again by capacityAsOf, which is the tested
 * definition of "in force". Applying it twice is free — the predicate is
 * idempotent — and keeps one source of truth for the boundary rule.
 */
export async function getTeamCapacityAsOf(at: Date): Promise<UserCapacity[]> {
  const [roster, historyRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        title: users.title,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        role: users.role,
        orgTags: users.orgTags,
      })
      .from(users)
      .where(and(eq(users.active, true), eq(users.status, 'approved')))
      .orderBy(asc(users.name)),
    db
      .select({
        userId: assignmentHistory.userId,
        appId: apps.id,
        appName: apps.name,
        slug: apps.slug,
        role: assignmentHistory.role,
        allocationPct: assignmentHistory.allocationPct,
        changeKind: assignmentHistory.changeKind,
        effectiveFrom: assignmentHistory.effectiveFrom,
        effectiveTo: assignmentHistory.effectiveTo,
      })
      .from(assignmentHistory)
      .innerJoin(apps, eq(assignmentHistory.appId, apps.id))
      .where(
        and(
          lte(assignmentHistory.effectiveFrom, at),
          or(isNull(assignmentHistory.effectiveTo), gt(assignmentHistory.effectiveTo, at)),
        ),
      ),
  ])

  const byUser = new Map(
    capacityAsOf(historyRows satisfies HistoryRow[], at).map((entry) => [entry.userId, entry]),
  )

  return roster.map((user) => {
    const capacity = byUser.get(user.id)
    return {
      user: {
        id: user.id,
        name: user.name,
        title: user.title,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        orgTags: user.orgTags,
      },
      totalPct: capacity?.totalPct ?? 0,
      overallocated: capacity?.overallocated ?? false,
      breakdown: (capacity?.breakdown ?? []).map((entry) => ({ ...entry, assignmentId: null })),
    }
  })
}

export type PersonAllocationHistory = PersonAllocationHistoryView

/**
 * Everything the person page's history card needs: the annotated change
 * timeline (newest first, each entry knowing what it replaced) and the total
 * allocation trend. One query, two pure derivations — the shaping lives in
 * allocation-history.ts so it is unit-tested without a database.
 */
export async function getPersonAllocationHistory(
  userId: string,
): Promise<PersonAllocationHistory> {
  const changer = alias(users, 'changer')
  const rows = await db
    .select({
      id: assignmentHistory.id,
      appId: apps.id,
      appName: apps.name,
      slug: apps.slug,
      role: assignmentHistory.role,
      allocationPct: assignmentHistory.allocationPct,
      changeKind: assignmentHistory.changeKind,
      effectiveFrom: assignmentHistory.effectiveFrom,
      effectiveTo: assignmentHistory.effectiveTo,
      changedByName: changer.name,
      note: assignmentHistory.note,
    })
    .from(assignmentHistory)
    .innerJoin(apps, eq(assignmentHistory.appId, apps.id))
    // Left join: an admin account deleted since must not make their changes
    // vanish from the audit trail.
    .leftJoin(changer, eq(assignmentHistory.changedBy, changer.id))
    .where(eq(assignmentHistory.userId, userId))
    .orderBy(desc(assignmentHistory.effectiveFrom))

  return {
    timeline: buildAllocationTimeline(rows),
    trend: allocationTotalSeries(rows),
  }
}

/**
 * Apps the dashboard's inline assign control offers. Archived apps are
 * excluded — assigning fresh capacity to a shut-down app is never the intent
 * — but paused ones stay, since work resuming there is normal.
 */
export async function listAssignableApps(): Promise<AssignableApp[]> {
  return db
    .select({ id: apps.id, name: apps.name, slug: apps.slug })
    .from(apps)
    .where(ne(apps.status, 'archived'))
    .orderBy(asc(apps.name))
}

export type ActivityDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }

/**
 * Per-day task activity (tasks created for + assigned to the user) over the
 * last ~26 weeks, as a dense series for the contribution graph. Level ramp:
 * 0 = none, 1 = 1, 2 = 2–3, 3 = 4–5, 4 = 6+.
 */
export async function getPersonActivity(userId: string): Promise<ActivityDay[]> {
  const since = new Date()
  since.setDate(since.getDate() - 26 * 7)
  since.setHours(0, 0, 0, 0)

  const rows = await db
    .select({
      day: sql<string>`to_char(${tasks.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .where(and(eq(tasks.assigneeId, userId), gte(tasks.createdAt, since)))
    .groupBy(sql`to_char(${tasks.createdAt}, 'YYYY-MM-DD')`)

  const byDay = new Map(rows.map((row) => [row.day, row.count]))
  const series: ActivityDay[] = []
  const cursor = new Date(since)
  const today = new Date()
  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10)
    const count = byDay.get(key) ?? 0
    const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4
    series.push({ date: key, count, level })
    cursor.setDate(cursor.getDate() + 1)
  }
  return series
}

export async function listActiveUsers(): Promise<ActiveUser[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    // Excludes self-signed-up users still awaiting admin approval.
    .where(and(eq(users.active, true), eq(users.status, 'approved')))
    .orderBy(asc(users.name))
}

export async function getPersonDetail(userId: string): Promise<PersonDetail | null> {
  const [userRow] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      title: users.title,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .where(eq(users.id, userId))
  if (!userRow) return null

  const [breakdown, taskRows, meetingRows] = await Promise.all([
    db
      .select({
        appId: apps.id,
        appName: apps.name,
        slug: apps.slug,
        role: assignments.role,
        allocationPct: assignments.allocationPct,
      })
      .from(assignments)
      .innerJoin(apps, eq(assignments.appId, apps.id))
      .where(eq(assignments.userId, userId))
      .orderBy(desc(assignments.allocationPct)),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        appName: apps.name,
        appSlug: apps.slug,
      })
      .from(tasks)
      .innerJoin(apps, eq(tasks.appId, apps.id))
      .where(eq(tasks.assigneeId, userId))
      .orderBy(asc(tasks.status), desc(tasks.createdAt)),
    db
      .select({
        id: meetings.id,
        title: meetings.title,
        startsAt: meetings.startsAt,
      })
      .from(meetingAttendees)
      .innerJoin(meetings, eq(meetingAttendees.meetingId, meetings.id))
      .where(and(eq(meetingAttendees.userId, userId), gte(meetings.startsAt, new Date())))
      .orderBy(asc(meetings.startsAt)),
  ])

  const [summary] = summarizeAllocations(
    breakdown.map((b) => ({ userId, allocationPct: b.allocationPct })),
  )

  return {
    user: userRow,
    totalPct: summary?.totalPct ?? 0,
    overallocated: summary?.overallocated ?? false,
    breakdown,
    tasks: taskRows,
    meetings: meetingRows,
  }
}
