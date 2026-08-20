import { cache } from 'react'
import { and, asc, desc, eq, gt, gte, ilike, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import { liveApps, liveMeetings, liveSprints, liveTasks } from '@/db/live'
import {
  activityLog,
  appRoleHistory,
  assignmentHistory,
  assignments,
  meetingAttendees,
  meetingFollowups,
  users,
} from '@/db/schema'
import { buildRoleTimeline, type AppRoleKind } from '@/features/apps/role-history'
import {
  EMPTY_NOW,
  RECENT_ACTIONS,
  RECENT_DAYS,
  type PersonNow,
} from '@/features/people/now'
import { summarizeAllocations } from '@/features/people/allocation'
import {
  allocationTotalSeries,
  buildAllocationTimeline,
  capacityAsOf,
  type HistoryRow,
  type PersonAllocationHistoryView,
  type TrendPoint,
} from '@/features/people/allocation-history'
import {
  annotateTeamChanges,
  appLoadRows,
  churnCounts,
  compareCapacities,
  overloadStretches,
  teamLoadStats,
  type AppLoadRow,
  type CapacityDelta,
  type CapacitySnapshotEntry,
  type ChurnCounts,
  type OverloadStretch,
  type TeamChangeEntry,
  type TeamLoadStats,
} from '@/features/people/capacity-compare'
import {
  activityPeak,
  activityTotal,
  buildActivitySeries,
  type ActivityDay,
} from '@/features/people/activity-levels'
import { splitPersonFollowups, type PersonFollowups } from '@/features/people/followup-split'
import { isoDayAdd, isoDayOf, isoWeekStart } from '@/features/people/iso-day'
import { splitPersonMeetings, type PersonMeetings } from '@/features/people/meeting-window'
import {
  summarizeOpenTasks,
  type PersonTaskRow,
  type TaskLoad,
} from '@/features/people/task-workload'
import { LK_TIMEZONE } from '@/lib/lk-holidays'
import type { UserRole } from '@/features/auth/capabilities'

export type TeamMember = {
  assignmentId: string
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  /** Contact number for the call/WhatsApp cluster — teammate-visible by design. */
  phone: string | null
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
    role: UserRole
    orgTags: string[]
  }
  totalPct: number
  overallocated: boolean
  breakdown: CapacityBreakdownEntry[]
}

export type ActiveUser = { id: string; name: string }

/** An app the dashboard's inline "Assign to app" control can target. */
export type AssignableApp = { id: string; name: string; slug: string }

export type PersonAssignment = {
  appId: string
  appName: string
  slug: string
  appStatus: 'active' | 'paused' | 'archived'
  role: string
  allocationPct: number
  /** They lead this app (apps.leadId) — read nowhere else in the product. */
  isLead: boolean
}

export type PersonProfile = {
  id: string
  name: string
  email: string
  personalEmail: string | null
  title: string | null
  phone: string | null
  avatarUrl: string | null
  role: UserRole
  active: boolean
  status: 'pending' | 'approved' | 'rejected'
  orgTags: string[]
  createdAt: Date
}

export type PersonOverview = {
  user: PersonProfile
  totalPct: number
  overallocated: boolean
  assignments: PersonAssignment[]
}

export async function getTeamForApp(appId: string): Promise<TeamMember[]> {
  return db
    .select({
      assignmentId: assignments.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      phone: users.phone,
      role: assignments.role,
      allocationPct: assignments.allocationPct,
    })
    .from(assignments)
    .innerJoin(users, eq(assignments.userId, users.id))
    .where(eq(assignments.appId, appId))
    .orderBy(desc(assignments.allocationPct))
}

export const getUserCapacities = cache(async function getUserCapacities(q?: string): Promise<UserCapacity[]> {
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
      appId: liveApps.id,
      appName: liveApps.name,
      slug: liveApps.slug,
      role: assignments.role,
      allocationPct: assignments.allocationPct,
    })
    .from(users)
    .leftJoin(assignments, eq(assignments.userId, users.id))
    .leftJoin(liveApps, eq(assignments.appId, liveApps.id))
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
})

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
        appId: liveApps.id,
        appName: liveApps.name,
        slug: liveApps.slug,
        role: assignmentHistory.role,
        allocationPct: assignmentHistory.allocationPct,
        changeKind: assignmentHistory.changeKind,
        effectiveFrom: assignmentHistory.effectiveFrom,
        effectiveTo: assignmentHistory.effectiveTo,
      })
      .from(assignmentHistory)
      .innerJoin(liveApps, eq(assignmentHistory.appId, liveApps.id))
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

/**
 * Everything the capacity-history page renders for a window [from, to]:
 * where the team stood at each end, what moved, what was reshuffled and by
 * whom, and how the total tracked across the window.
 *
 * ONE history read serves all of it. The rows are fetched once (bounded only
 * by the window's outer edge) and every derivation — both snapshots, the
 * trend, the overload stretches — is a pure function over that same array,
 * in capacity-compare.ts / allocation-history.ts. Fetching per derivation
 * would be four round trips that could disagree with one another.
 */
export type CapacityHistoryOverview = {
  /** The roster, with capacity as it stood at the window's end (`to`). */
  current: UserCapacity[]
  /** Per-person movement between `from` and `to`, biggest move first. */
  deltas: CapacityDelta[]
  /** Team totals at `to`. */
  stats: TeamLoadStats
  /** The same at `from`, so the page can show which way each number moved. */
  previousStats: TeamLoadStats
  /** Where the effort went at `to`, heaviest app first. */
  apps: AppLoadRow[]
  /** Team-wide total allocation at every instant it changed inside the window. */
  trend: TrendPoint[]
  /** Every allocation change inside the window, newest first, with who and why. */
  changes: TeamChangeEntry[]
  churn: ChurnCounts
  /** Stretches spent over 100% inside the window, longest first. */
  overloads: (OverloadStretch & { name: string })[]
}

export async function getCapacityHistoryOverview(
  from: Date,
  to: Date,
): Promise<CapacityHistoryOverview> {
  const changer = alias(users, 'history_changer')
  const subject = alias(users, 'history_subject')

  const [roster, historyRows, changeRows] = await Promise.all([
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
    // Every interval in force at ANY point inside [from, to]. Deliberately
    // wider than "in force at `to`" — the window's opening snapshot and the
    // trend both need intervals that have since closed — but bounded on both
    // sides, because an unbounded read would grow with the company's whole
    // history to serve a 7-day question.
    db
      .select({
        userId: assignmentHistory.userId,
        appId: liveApps.id,
        appName: liveApps.name,
        slug: liveApps.slug,
        role: assignmentHistory.role,
        allocationPct: assignmentHistory.allocationPct,
        changeKind: assignmentHistory.changeKind,
        effectiveFrom: assignmentHistory.effectiveFrom,
        effectiveTo: assignmentHistory.effectiveTo,
      })
      .from(assignmentHistory)
      .innerJoin(liveApps, eq(assignmentHistory.appId, liveApps.id))
      .where(
        and(
          lte(assignmentHistory.effectiveFrom, to),
          or(isNull(assignmentHistory.effectiveTo), gt(assignmentHistory.effectiveTo, from)),
        ),
      ),
    // The audit trail for the window itself — who changed what, and the note
    // they left. Left join on the changer so a since-deleted admin cannot
    // erase their own changes from the record.
    db
      .select({
        id: assignmentHistory.id,
        userId: assignmentHistory.userId,
        userName: subject.name,
        appId: liveApps.id,
        appName: liveApps.name,
        slug: liveApps.slug,
        role: assignmentHistory.role,
        allocationPct: assignmentHistory.allocationPct,
        changeKind: assignmentHistory.changeKind,
        effectiveFrom: assignmentHistory.effectiveFrom,
        changedByName: changer.name,
        note: assignmentHistory.note,
      })
      .from(assignmentHistory)
      .innerJoin(liveApps, eq(assignmentHistory.appId, liveApps.id))
      .leftJoin(subject, eq(assignmentHistory.userId, subject.id))
      .leftJoin(changer, eq(assignmentHistory.changedBy, changer.id))
      .where(
        and(gte(assignmentHistory.effectiveFrom, from), lte(assignmentHistory.effectiveFrom, to)),
      )
      .orderBy(desc(assignmentHistory.effectiveFrom)),
  ])

  const nameById = new Map(roster.map((user) => [user.id, user.name]))
  // EVERY derivation below runs on the same roster-scoped row set. The
  // snapshots are laid over the roster and so already exclude anyone who has
  // since left; a trend or an overload list built from the unfiltered rows
  // would count those people, and the page would contradict its own footnote
  // (and its own stat tiles) about who is being described.
  const rows = (historyRows satisfies HistoryRow[]).filter((row) => nameById.has(row.userId))

  // Both ends of the window, laid over the FULL roster so someone with no
  // history at all is a real 0% row rather than a gap.
  const snapshotAt = (at: Date): CapacitySnapshotEntry[] => {
    const byUser = new Map(capacityAsOf(rows, at).map((entry) => [entry.userId, entry]))
    return roster.map((user) => ({
      userId: user.id,
      name: user.name,
      totalPct: byUser.get(user.id)?.totalPct ?? 0,
      breakdown: byUser.get(user.id)?.breakdown ?? [],
    }))
  }

  const before = snapshotAt(from)
  const after = snapshotAt(to)
  const breakdownAt = new Map(
    capacityAsOf(rows, to).map((entry) => [entry.userId, entry.breakdown]),
  )

  // `after` is already roster-ordered and roster-complete (snapshotAt maps over
  // the roster), so the snapshot entry for row i IS user i — no lookup, and no
  // way for the two lists to fall out of step.
  const current: UserCapacity[] = roster.map((user, index) => ({
    user: {
      id: user.id,
      name: user.name,
      title: user.title,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      orgTags: user.orgTags,
    },
    totalPct: after[index].totalPct,
    overallocated: after[index].totalPct > 100,
    // A past interval is not something the edit actions can target — the same
    // read-only contract getTeamCapacityAsOf makes.
    breakdown: (breakdownAt.get(user.id) ?? []).map((row) => ({ ...row, assignmentId: null })),
  }))

  // The trend is clamped to the window by dropping POINTS outside it — never
  // by filtering the rows first. Each point's value is recomputed from every
  // interval in force at that instant, so a row set narrowed to "started
  // inside the window" would silently omit every allocation that began
  // earlier and is still running, and draw a team-wide total far below the
  // real one.
  const trendSeed: TrendPoint = {
    at: from,
    totalPct: before.reduce((sum, entry) => sum + entry.totalPct, 0),
  }
  const windowPoints = allocationTotalSeries(rows).filter(
    (point) => point.at.getTime() > from.getTime() && point.at.getTime() <= to.getTime(),
  )

  return {
    current,
    deltas: compareCapacities(before, after),
    stats: teamLoadStats(after),
    previousStats: teamLoadStats(before),
    apps: appLoadRows(after),
    // Seeded with where the window STARTED: without it, a window whose first
    // change lands on day 20 draws a line beginning at day 20, which reads as
    // "the team carried nothing until then".
    trend: [trendSeed, ...windowPoints],
    changes: annotateTeamChanges(changeRows),
    churn: churnCounts(changeRows),
    overloads: overloadStretches(rows, from, to).map((stretch) => ({
      ...stretch,
      // Non-null by construction — `rows` is filtered to the roster above.
      name: nameById.get(stretch.userId) ?? 'Unknown',
    })),
  }
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
      appId: liveApps.id,
      appName: liveApps.name,
      slug: liveApps.slug,
      role: assignmentHistory.role,
      allocationPct: assignmentHistory.allocationPct,
      changeKind: assignmentHistory.changeKind,
      effectiveFrom: assignmentHistory.effectiveFrom,
      effectiveTo: assignmentHistory.effectiveTo,
      changedByName: changer.name,
      note: assignmentHistory.note,
    })
    .from(assignmentHistory)
    .innerJoin(liveApps, eq(assignmentHistory.appId, liveApps.id))
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

export type PersonAppRoleEntry = {
  id: string
  appId: string
  appName: string
  slug: string
  role: AppRoleKind
  effectiveFrom: Date
  effectiveTo: Date | null
  changedByName: string | null
  note: string | null
  backfilled: boolean
}

/**
 * "Who did which project, and when" from the PERSON's side — every app this
 * person has been PM or lead of, newest first, straight from app_role_history
 * (features/apps/role-history.ts owns the shaping, shared with the per-app
 * read in features/apps/queries.ts so the two surfaces cannot disagree about
 * what "backfilled" means).
 *
 * Inner-joined to apps (a role can't outlive the app it was on: app_id
 * cascades), left-joined to the changer so a since-deleted admin doesn't
 * erase their own change from the record — same shape as the allocation
 * history read above.
 */
export async function getPersonAppRoleHistory(userId: string): Promise<PersonAppRoleEntry[]> {
  const changer = alias(users, 'app_role_changer')
  const rows = await db
    .select({
      id: appRoleHistory.id,
      appId: liveApps.id,
      appName: liveApps.name,
      slug: liveApps.slug,
      role: appRoleHistory.role,
      effectiveFrom: appRoleHistory.effectiveFrom,
      effectiveTo: appRoleHistory.effectiveTo,
      changedByName: changer.name,
      note: appRoleHistory.note,
    })
    .from(appRoleHistory)
    .innerJoin(liveApps, eq(appRoleHistory.appId, liveApps.id))
    .leftJoin(changer, eq(appRoleHistory.changedBy, changer.id))
    .where(eq(appRoleHistory.userId, userId))
    .orderBy(desc(appRoleHistory.effectiveFrom))

  return buildRoleTimeline(rows)
}

/**
 * Apps the dashboard's inline assign control offers. Archived apps are
 * excluded — assigning fresh capacity to a shut-down app is never the intent
 * — but paused ones stay, since work resuming there is normal.
 */
export const listAssignableApps = cache(async function listAssignableApps(): Promise<AssignableApp[]> {
  return db
    .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug })
    .from(liveApps)
    .where(ne(liveApps.status, 'archived'))
    .orderBy(asc(liveApps.name))
})

export type PersonActivity = {
  days: ActivityDay[]
  total: number
  /** Busiest single day — the top of the scale the legend describes. */
  peak: number
  fromIso: string
  toIso: string
}

/**
 * At least 26 weeks, then rounded back to the Sunday that starts the week, so
 * the grid's left edge is square. Rounding OUT means the window is 26 or 27
 * columns depending on which weekday it lands on; it can only ever add history,
 * never clip it.
 */
const ACTIVITY_WEEKS = 26

/**
 * The timezone literal, inlined into SQL rather than bound as a parameter.
 * `AT TIME ZONE $1` gives Postgres nothing to infer the parameter's type from,
 * and the value is a compile-time constant of ours — never user input — so
 * `sql.raw` here carries no injection surface.
 */
const LK_TZ_SQL = sql.raw(`'${LK_TIMEZONE}'`)

/**
 * Per-day task activity — tasks CREATED with this person as the assignee —
 * over the last 26-or-27 whole weeks (see ACTIVITY_WEEKS), dense, for the
 * contribution graph.
 *
 * DAY BOUNDARIES ARE ASIA/COLOMBO ON BOTH SIDES. `tasks.created_at` is a naive
 * `timestamp`; every writer stores UTC (drizzle serialises JS Dates as UTC, and
 * `now()` on Neon is UTC), so it is re-interpreted as UTC and then converted to
 * the business timezone before bucketing. The JS side fills the same Colombo
 * days. The previous version bucketed in the server's zone in SQL and keyed the
 * fill loop off UTC, which silently shifted counts by one cell on any non-UTC
 * server — and disagreed with as-of-date.ts and the sprint calendar, which have
 * always resolved days in Colombo.
 *
 * The SQL lower bound is deliberately a day LOOSE (a plain UTC midnight one day
 * before the window starts, rather than the exact Colombo instant): a few extra
 * rows cost nothing and buildActivitySeries drops any day outside the range,
 * whereas a bound computed a few hours tight would silently clip the oldest
 * column.
 */
export async function getPersonActivity(userId: string): Promise<PersonActivity> {
  const toIso = isoDayOf(new Date())
  // Week-aligned on the LEFT ONLY. The grid is a seven-row calendar, and a
  // window that starts mid-week leaves its first column holding just the days
  // from that weekday onward — the empty slots above render as literally
  // nothing, so the bottom rows begin one column further left than the rows
  // above them and the whole graph looks ragged at its corner. Deliberately NOT
  // rounding the right edge up to Saturday: that would paint days that have not
  // happened yet as level-0 cells, indistinguishable from "no tasks assigned",
  // which is the same good-faith lie the caption below refuses to tell. The
  // notch at the bottom-right is the current week being unfinished, and it
  // should stay legible as exactly that.
  const fromIso = isoWeekStart(isoDayAdd(toIso, -(ACTIVITY_WEEKS * 7 - 1)))
  const since = new Date(`${isoDayAdd(fromIso, -1)}T00:00:00.000Z`)

  const day = sql<string>`to_char((${liveTasks.createdAt} at time zone 'UTC') at time zone ${LK_TZ_SQL}, 'YYYY-MM-DD')`
  const rows = await db
    .select({ day, count: sql<number>`count(*)::int` })
    .from(liveTasks)
    .where(and(eq(liveTasks.assigneeId, userId), gte(liveTasks.createdAt, since)))
    .groupBy(day)

  const days = buildActivitySeries(rows, fromIso, toIso)
  return { days, total: activityTotal(days), peak: activityPeak(days), fromIso, toIso }
}

export async function listActiveUsers(): Promise<ActiveUser[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    // Excludes self-signed-up users still awaiting admin approval.
    .where(and(eq(users.active, true), eq(users.status, 'approved')))
    .orderBy(asc(users.name))
}

/**
 * Identity + live allocation. Looked up by id ALONE, with no active/approved
 * filter: an admin has to be able to open the page of someone deactivated or
 * still pending, precisely to see what they were carrying. The header states
 * the account state instead of the page 404ing.
 *
 * Callers must have validated the id as a UUID first — every query in this
 * section compares against a `uuid` column, and Postgres raises
 * "invalid input syntax for type uuid" (an exception, not an empty result) for
 * anything else.
 *
 * WRAPPED IN React `cache` because `generateMetadata` and the page body both
 * need this person's name, and they are two separate invocations of the same
 * render. Without memoisation the page would run this pair of queries twice on
 * every load purely to title the browser tab. `cache` is per-request, so it
 * neither leaks one viewer's data into another's render nor holds anything
 * between requests — it is deduplication, not caching in the stale-data sense.
 * Only this function is wrapped: it is the one read on the path twice.
 */
export const getPersonOverview = cache(async function getPersonOverview(
  userId: string,
): Promise<PersonOverview | null> {
  const [userRows, assignmentRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        personalEmail: users.personalEmail,
        title: users.title,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        role: users.role,
        active: users.active,
        status: users.status,
        orgTags: users.orgTags,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId)),
    db
      .select({
        appId: liveApps.id,
        appName: liveApps.name,
        slug: liveApps.slug,
        appStatus: liveApps.status,
        role: assignments.role,
        allocationPct: assignments.allocationPct,
        leadId: liveApps.leadId,
      })
      .from(assignments)
      .innerJoin(liveApps, eq(assignments.appId, liveApps.id))
      .where(eq(assignments.userId, userId))
      .orderBy(desc(assignments.allocationPct), asc(liveApps.name)),
  ])

  const [userRow] = userRows
  if (!userRow) return null

  const [summary] = summarizeAllocations(
    assignmentRows.map((row) => ({ userId, allocationPct: row.allocationPct })),
  )

  return {
    user: userRow,
    totalPct: summary?.totalPct ?? 0,
    overallocated: summary?.overallocated ?? false,
    assignments: assignmentRows.map(({ leadId, ...row }) => ({ ...row, isLead: leadId === userId })),
  }
})

export type PersonWorkload = {
  /** Open work only, unsorted — bucketOpenTasks owns the ordering. */
  openTasks: PersonTaskRow[]
  load: TaskLoad
  doneCount: number
  totalCount: number
  /** Today in the business timezone, so components never call `new Date()`. */
  todayIso: string
}

/**
 * A person's open work, with the two columns the product has been writing and
 * never showing: `dueDate` (set by the ⌘K quick-add and accepted meeting
 * suggestions) and `priority`. The sprint is joined in as well, so a task reads
 * as "Alpha · Sprint 14 · due Friday" rather than as a bare title.
 *
 * TWO QUERIES, NEVER N+1: the open rows, and one aggregate for the lifetime
 * counts. Done tasks are counted but not listed — every one ever closed used to
 * render in full, so a long-tenured person's page grew without limit, and
 * without a completion timestamp on `tasks` there is no meaningful way to order
 * or window them anyway (see task-workload.ts).
 */
export const getPersonWorkload = cache(async function getPersonWorkload(userId: string): Promise<PersonWorkload> {
  const todayIso = isoDayOf(new Date())

  const [openTaskRows, counts] = await Promise.all([
    db
      .select({
        id: liveTasks.id,
        title: liveTasks.title,
        status: liveTasks.status,
        priority: liveTasks.priority,
        dueDate: liveTasks.dueDate,
        createdAt: liveTasks.createdAt,
        appName: liveApps.name,
        appSlug: liveApps.slug,
        sprintName: liveSprints.name,
      })
      .from(liveTasks)
      .innerJoin(liveApps, eq(liveTasks.appId, liveApps.id))
      // Left: a task in the backlog has no sprint, and dropping those would
      // hide exactly the work nobody has scheduled yet.
      .leftJoin(liveSprints, eq(liveTasks.sprintId, liveSprints.id))
      .where(and(eq(liveTasks.assigneeId, userId), ne(liveTasks.status, 'done')))
      .orderBy(asc(liveTasks.dueDate), desc(liveTasks.priority)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${liveTasks.status} = 'done')::int`,
      })
      .from(liveTasks)
      .where(eq(liveTasks.assigneeId, userId)),
  ])

  // drizzle-orm's column types collapse to `never` once a query leftJoins
  // two `.as()` subqueries together (liveTasks + liveSprints here) — a
  // type-inference gap in this drizzle-orm version, not a runtime one (see
  // the same note in sprints/queries.ts). Recast to the shape actually
  // selected above, which is exactly PersonTaskRow.
  const openTasks = openTaskRows as PersonTaskRow[]

  return {
    openTasks,
    load: summarizeOpenTasks(openTasks, todayIso),
    doneCount: counts[0]?.done ?? 0,
    totalCount: counts[0]?.total ?? 0,
    todayIso,
  }
})

export type PersonFollowupsView = PersonFollowups & { todayIso: string }

/**
 * Open meeting follow-ups in both directions — what this person owes, and what
 * they are waiting on from someone else — in ONE query, split by the tested
 * rules in followup-split.ts.
 *
 * Bounded by `status = 'open'` rather than by a LIMIT on purpose: a limit would
 * have to be ordered, and any ordering that fits in SQL (newest source meeting
 * first) truncates from the wrong end — the OLDEST debt is the item that must
 * never fall off the page. Resolved items are excluded entirely; they live on
 * the meeting they were resolved in.
 */
export const getPersonFollowups = cache(async function getPersonFollowups(userId: string): Promise<PersonFollowupsView> {
  const owner = alias(users, 'followup_owner')
  const creator = alias(users, 'followup_creator')

  const rows = await db
    .select({
      id: meetingFollowups.id,
      text: meetingFollowups.text,
      kind: meetingFollowups.kind,
      ownerUserId: meetingFollowups.userId,
      ownerUserName: owner.name,
      personName: meetingFollowups.personName,
      createdById: meetingFollowups.createdBy,
      createdByName: creator.name,
      meetingId: liveMeetings.id,
      meetingTitle: liveMeetings.title,
      meetingStartsAt: liveMeetings.startsAt,
      responseNote: meetingFollowups.responseNote,
      deferReason: meetingFollowups.deferReason,
    })
    .from(meetingFollowups)
    // meetingFollowups has no deletedAt of its own — live iff its source
    // meeting is live (see MEETING_CHILD_TABLES in src/db/live.ts). An inner
    // join against liveMeetings is what drops a trashed meeting's follow-ups.
    .innerJoin(liveMeetings, eq(meetingFollowups.sourceMeetingId, liveMeetings.id))
    // Left joins throughout: userId is null when the AI couldn't match the
    // spoken name to exactly one attendee, and createdBy is null for every
    // AI-derived row. Inner joins here would drop precisely those items.
    .leftJoin(owner, eq(meetingFollowups.userId, owner.id))
    .leftJoin(creator, eq(meetingFollowups.createdBy, creator.id))
    .where(
      and(
        eq(meetingFollowups.status, 'open'),
        or(eq(meetingFollowups.userId, userId), eq(meetingFollowups.createdBy, userId)),
      ),
    )
    .orderBy(asc(liveMeetings.startsAt))

  const todayIso = isoDayOf(new Date())
  const split = splitPersonFollowups(
    rows.map(({ ownerUserName, personName, ...row }) => ({
      ...row,
      // The resolved user's name when there is one, else the raw as-spoken
      // name — which is kept on every row precisely so nothing is lost when
      // the match failed.
      ownerName: ownerUserName ?? personName,
    })),
    userId,
    todayIso,
  )

  return { ...split, todayIso }
})

export type PersonMeetingsView = PersonMeetings & { now: Date }

/** How far either side of now the meetings section reads. */
const MEETING_WINDOW_DAYS = 60

/**
 * Meetings this person attends, upcoming and recent, with their RSVP — one
 * query over a bounded window either side of now, split by splitPersonMeetings.
 *
 * The window is what keeps this O(1)-ish for someone with three years of
 * standups behind them; the split caps what renders inside it and reports the
 * full in-window totals so the UI can say how much it is not showing.
 */
export const getPersonMeetings = cache(async function getPersonMeetings(userId: string): Promise<PersonMeetingsView> {
  const now = new Date()
  const from = new Date(now.getTime() - MEETING_WINDOW_DAYS * 86_400_000)
  const until = new Date(now.getTime() + MEETING_WINDOW_DAYS * 86_400_000)

  const rows = await db
    .select({
      id: liveMeetings.id,
      title: liveMeetings.title,
      startsAt: liveMeetings.startsAt,
      endsAt: liveMeetings.endsAt,
      meetingUrl: liveMeetings.meetingUrl,
      appName: liveApps.name,
      appSlug: liveApps.slug,
      response: meetingAttendees.response,
    })
    .from(meetingAttendees)
    // meetingAttendees has no deletedAt of its own — live iff its meeting is
    // live (see MEETING_CHILD_TABLES in src/db/live.ts).
    .innerJoin(liveMeetings, eq(meetingAttendees.meetingId, liveMeetings.id))
    .leftJoin(liveApps, eq(liveMeetings.appId, liveApps.id))
    .where(
      and(
        eq(meetingAttendees.userId, userId),
        gte(liveMeetings.startsAt, from),
        lte(liveMeetings.startsAt, until),
      ),
    )
    .orderBy(asc(liveMeetings.startsAt))

  return { ...splitPersonMeetings(rows, now), now }
})

/**
 * "What is everyone doing now, and what have they been doing?" for the whole
 * directory, in TWO queries — never one per person.
 *
 * The directory renders every member of the workspace, so anything shaped as a
 * per-person call is an N+1 the moment the team grows. getPersonWorkload and
 * getPersonActivity already answer richer versions of these questions for ONE
 * person on their own page; this is the batched, deliberately thinner pair the
 * list needs.
 *
 * NOW is in-progress tasks only — see the note on now.ts for why the todo
 * backlog is excluded rather than folded in.
 *
 * HISTORY is the activity log, windowed per person with row_number() so each
 * one gets their own most recent handful. A plain `limit` here would return
 * the busiest person's actions and nothing for anybody else.
 */
export const getPeopleNow = cache(async function getPeopleNow(
  userIds: string[],
): Promise<Record<string, PersonNow>> {
  if (userIds.length === 0) return {}

  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000)

  // Ranked in a subquery, then filtered on the rank — Postgres forbids a
  // window function in WHERE, since windows are computed after it.
  const ranked = db
    .select({
      id: activityLog.id,
      actorId: activityLog.actorId,
      verb: activityLog.verb,
      entityType: activityLog.entityType,
      entityLabel: activityLog.entityLabel,
      appName: activityLog.appName,
      detail: activityLog.detail,
      pagePath: activityLog.pagePath,
      at: activityLog.createdAt,
      rank: sql<number>`row_number() over (
        partition by ${activityLog.actorId}
        order by ${activityLog.createdAt} desc
      )`.as('rank'),
    })
    .from(activityLog)
    .where(and(inArray(activityLog.actorId, userIds), gte(activityLog.createdAt, since)))
    .as('ranked')

  const [taskRows, actionRows] = await Promise.all([
    db
      .select({
        id: liveTasks.id,
        assigneeId: liveTasks.assigneeId,
        title: liveTasks.title,
        appName: liveApps.name,
        appSlug: liveApps.slug,
        sprintName: liveSprints.name,
        dueDate: liveTasks.dueDate,
        priority: liveTasks.priority,
      })
      .from(liveTasks)
      .leftJoin(liveApps, eq(liveTasks.appId, liveApps.id))
      .leftJoin(liveSprints, eq(liveTasks.sprintId, liveSprints.id))
      .where(
        and(
          inArray(liveTasks.assigneeId, userIds),
          eq(liveTasks.status, 'in_progress'),
        ),
      ),
    db.select().from(ranked).where(lte(ranked.rank, RECENT_ACTIONS)).orderBy(desc(ranked.at)),
  ])

  const byUser: Record<string, PersonNow> = {}
  const forUser = (userId: string): PersonNow => {
    const existing = byUser[userId]
    if (existing) return existing
    const fresh: PersonNow = { doing: [], recent: [] }
    byUser[userId] = fresh
    return fresh
  }

  for (const row of taskRows) {
    // assigneeId is non-null by the WHERE above; the column is nullable in the
    // schema (an unassigned task) so TypeScript cannot know that.
    if (!row.assigneeId) continue
    forUser(row.assigneeId).doing.push({
      id: row.id,
      title: row.title,
      appName: row.appName,
      appSlug: row.appSlug,
      sprintName: row.sprintName,
      dueDate: row.dueDate,
      priority: row.priority,
    })
  }

  for (const row of actionRows) {
    forUser(row.actorId).recent.push({
      id: row.id,
      verb: row.verb,
      entityType: row.entityType,
      entityLabel: row.entityLabel,
      appName: row.appName,
      detail: row.detail,
      pagePath: row.pagePath,
      at: row.at,
    })
  }

  return byUser
})

/** The shared empty value, so callers never branch on a missing key. */
export { EMPTY_NOW }
