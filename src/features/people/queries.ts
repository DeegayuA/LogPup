import { cache } from 'react'
import { and, asc, desc, eq, gt, gte, ilike, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import { liveMeetings, liveSprints, liveTasks } from '@/db/live'
import {
  apps,
  assignmentHistory,
  assignments,
  meetingAttendees,
  meetingFollowups,
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
import {
  activityPeak,
  activityTotal,
  buildActivitySeries,
  type ActivityDay,
} from '@/features/people/activity-levels'
import { splitPersonFollowups, type PersonFollowups } from '@/features/people/followup-split'
import { isoDayAdd, isoDayOf } from '@/features/people/iso-day'
import { splitPersonMeetings, type PersonMeetings } from '@/features/people/meeting-window'
import {
  summarizeOpenTasks,
  type PersonTaskRow,
  type TaskLoad,
} from '@/features/people/task-workload'
import { LK_TIMEZONE } from '@/lib/lk-holidays'

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
  role: 'admin' | 'member'
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
export const listAssignableApps = cache(async function listAssignableApps(): Promise<AssignableApp[]> {
  return db
    .select({ id: apps.id, name: apps.name, slug: apps.slug })
    .from(apps)
    .where(ne(apps.status, 'archived'))
    .orderBy(asc(apps.name))
})

export type PersonActivity = {
  days: ActivityDay[]
  total: number
  /** Busiest single day — the top of the scale the legend describes. */
  peak: number
  fromIso: string
  toIso: string
}

/** 26 weeks, the window the contribution grid is sized for. */
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
 * over the last 26 weeks, dense, for the contribution graph.
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
  const fromIso = isoDayAdd(toIso, -(ACTIVITY_WEEKS * 7 - 1))
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
        appId: apps.id,
        appName: apps.name,
        slug: apps.slug,
        appStatus: apps.status,
        role: assignments.role,
        allocationPct: assignments.allocationPct,
        leadId: apps.leadId,
      })
      .from(assignments)
      .innerJoin(apps, eq(assignments.appId, apps.id))
      .where(eq(assignments.userId, userId))
      .orderBy(desc(assignments.allocationPct), asc(apps.name)),
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
        appName: apps.name,
        appSlug: apps.slug,
        sprintName: liveSprints.name,
      })
      .from(liveTasks)
      .innerJoin(apps, eq(liveTasks.appId, apps.id))
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
      appName: apps.name,
      appSlug: apps.slug,
      response: meetingAttendees.response,
    })
    .from(meetingAttendees)
    // meetingAttendees has no deletedAt of its own — live iff its meeting is
    // live (see MEETING_CHILD_TABLES in src/db/live.ts).
    .innerJoin(liveMeetings, eq(meetingAttendees.meetingId, liveMeetings.id))
    .leftJoin(apps, eq(liveMeetings.appId, apps.id))
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
