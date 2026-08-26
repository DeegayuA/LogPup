import { cache } from 'react'
import { and, asc, count, eq, gte, inArray, isNotNull, lt, max, notInArray, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { addDays, startOfWeek } from 'date-fns'
import { db } from '@/db'
import { liveAppColumns, liveApps, liveMeetings, liveSprints, liveTasks } from '@/db/live'
import { appComments, appRoleHistory, apps, assignments, meetingApps, users } from '@/db/schema'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import {
  appHealth,
  pickCurrentSprint,
  pickNextSprint,
  type AppHealth,
  type AppSprintSnapshot,
  type AppTaskCounts,
} from '@/features/apps/app-health'
import { buildRoleTimeline, type AppRoleKind } from '@/features/apps/role-history'
import { OPEN_STATUSES } from '@/features/sprints/board-view'

export type AppMember = {
  userId: string
  name: string
  avatarUrl: string | null
  role: string
  allocationPct: number
}

export type AppStats = {
  tasks: AppTaskCounts
  sprints: { total: number; planned: number; running: number; done: number }
  /** The sprint that is running now (see `pickCurrentSprint`), or null. */
  currentSprint: AppSprintSnapshot | null
  /** Only meaningful when `currentSprint` is null — the next one on the books. */
  nextSprint: AppSprintSnapshot | null
  meetings: { total: number; thisWeek: number }
  comments: number
  /**
   * The most recent thing that happened on this app across tasks, comments
   * and meetings. Null means literally nothing has ever been recorded — a
   * distinct state from "quiet lately", and one the health rules treat
   * differently (see `appHealth`).
   */
  lastActivityAt: Date | null
}

export type AppPortfolioEntry = typeof apps.$inferSelect & {
  leadName: string | null
  leadAvatarUrl: string | null
  // Left-joined the same way as lead, even though pm_id is NOT NULL at the
  // column level: soft deletes mean the user row itself is never gone, but a
  // left join is the same defensive shape the lead columns already use and
  // costs nothing extra.
  pmName: string | null
  pmAvatarUrl: string | null
  members: AppMember[]
  stats: AppStats
  health: AppHealth
}

/**
 * @deprecated Kept as an alias because /admin and /meetings still type against
 * this name. New code should say `AppPortfolioEntry`.
 */
export type AppWithMembers = AppPortfolioEntry

/**
 * `count(*) FILTER (WHERE …)` as one grouped column. This is the whole trick
 * that keeps the portfolio a fixed number of queries: every per-app number
 * the grid needs is a conditional aggregate over a table we were already
 * scanning, so adding "overdue tasks" or "meetings this week" costs a column,
 * not a round trip. The obvious alternative — one query per app, or a
 * per-status GROUP BY reduced in JS — is what turns a 40-app workspace into
 * 200 queries the first time someone adds a metric.
 *
 * `.mapWith(Number)` because Postgres returns count() as bigint, which the
 * driver hands back as a string.
 */
function countWhere(condition: SQL | undefined) {
  return sql<number>`count(*) filter (where ${condition})`.mapWith(Number)
}

const emptyTaskCounts = (): AppTaskCounts => ({
  todo: 0,
  in_progress: 0,
  done: 0,
  total: 0,
  overdue: 0,
})

/** Newest of a set of possibly-null timestamps; null when they all are. */
function latest(...dates: (Date | null | undefined)[]): Date | null {
  let best: Date | null = null
  for (const date of dates) {
    if (!date) continue
    if (!best || date.getTime() > best.getTime()) best = date
  }
  return best
}

/**
 * Everything the /apps portfolio grid and its header strip need, in ONE
 * parallel batch of six aggregate queries regardless of how many apps exist.
 *
 * Ordering is deliberately left to `sortApps` (browse.ts) rather than done in
 * SQL: the interesting orders ("riskiest first", "most recently touched") are
 * derived from columns that don't exist — they're computed here — so sorting
 * server-side would only be half the job and would then have to be redone in
 * JS anyway.
 */
export const listApps = cache(async function listApps(): Promise<AppPortfolioEntry[]> {
  const today = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
  const now = new Date()
  // "This week" is the calendar week you are standing in (Mon–Sun), not a
  // rolling 7 days: someone reading the strip on Friday is asking "what is
  // left of this week", not "what happens before next Friday".
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 7)

  const lead = alias(users, 'lead')
  const pm = alias(users, 'pm')

  const [appRows, memberRows, taskRows, sprintRows, meetingRows, commentRows] =
    await Promise.all([
      db
        .select({
          ...liveAppColumns,
          leadName: lead.name,
          leadAvatarUrl: lead.avatarUrl,
          pmName: pm.name,
          pmAvatarUrl: pm.avatarUrl,
        })
        .from(liveApps)
        // Left join: an app whose lead row was deleted must still list.
        .leftJoin(lead, eq(liveApps.leadId, lead.id))
        .leftJoin(pm, eq(liveApps.pmId, pm.id))
        .orderBy(asc(liveApps.name)),
      db
        .select({
          appId: assignments.appId,
          userId: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
          role: assignments.role,
          allocationPct: assignments.allocationPct,
        })
        .from(assignments)
        .innerJoin(users, eq(assignments.userId, users.id)),
      db
        .select({
          appId: liveTasks.appId,
          todo: countWhere(eq(liveTasks.status, 'todo')),
          inProgress: countWhere(eq(liveTasks.status, 'in_progress')),
          done: countWhere(notInArray(liveTasks.status, [...OPEN_STATUSES])),
          // An overdue task is one that is NOT done and whose due date has
          // already passed. `tasks.due_date` is a plain calendar day, so this
          // compares against today-in-Colombo rather than a UTC instant.
          overdue: countWhere(
            and(inArray(liveTasks.status, OPEN_STATUSES), isNotNull(liveTasks.dueDate), lt(liveTasks.dueDate, today)),
          ),
          lastCreatedAt: max(liveTasks.createdAt),
        })
        .from(liveTasks)
        .groupBy(liveTasks.appId),
      db
        .select({
          appId: liveSprints.appId,
          id: liveSprints.id,
          name: liveSprints.name,
          startDate: liveSprints.startDate,
          endDate: liveSprints.endDate,
          status: liveSprints.status,
        })
        .from(liveSprints),
      // Counted through meeting_apps, not meetings.app_id: a meeting can be on
      // several projects and each of them ran it, so it counts 1 toward each.
      // Reading the deprecated single column here would leave this number
      // disagreeing with the very list it labels (getMeetingsForApp, which
      // reads the join table) on every joint meeting.
      //
      // meetingApps has no deletedAt of its own — live iff its meeting is — so
      // the innerJoin is to liveMeetings, never the raw table (see
      // MEETING_CHILD_TABLES in src/db/live.ts). `isNotNull` is gone with the
      // column: a row only exists for a real project.
      db
        .select({
          appId: meetingApps.appId,
          total: count(),
          thisWeek: countWhere(
            and(gte(liveMeetings.startsAt, weekStart), lt(liveMeetings.startsAt, weekEnd)),
          ),
          lastCreatedAt: max(liveMeetings.createdAt),
        })
        .from(meetingApps)
        .innerJoin(liveMeetings, eq(meetingApps.meetingId, liveMeetings.id))
        .groupBy(meetingApps.appId),
      db
        .select({
          appId: appComments.appId,
          total: count(),
          lastCreatedAt: max(appComments.createdAt),
        })
        .from(appComments)
        .groupBy(appComments.appId),
    ])

  const membersByApp = new Map<string, AppMember[]>()
  for (const row of memberRows) {
    const members = membersByApp.get(row.appId) ?? []
    members.push({
      userId: row.userId,
      name: row.name,
      avatarUrl: row.avatarUrl,
      role: row.role,
      allocationPct: row.allocationPct,
    })
    membersByApp.set(row.appId, members)
  }

  const tasksByApp = new Map<string, { counts: AppTaskCounts; lastAt: Date | null }>()
  for (const row of taskRows) {
    const counts: AppTaskCounts = {
      todo: row.todo,
      in_progress: row.inProgress,
      done: row.done,
      total: row.todo + row.inProgress + row.done,
      overdue: row.overdue,
    }
    tasksByApp.set(row.appId, { counts, lastAt: row.lastCreatedAt })
  }

  const sprintsByApp = new Map<string, AppSprintSnapshot[]>()
  for (const row of sprintRows) {
    const list = sprintsByApp.get(row.appId) ?? []
    list.push({
      id: row.id,
      name: row.name,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
    })
    sprintsByApp.set(row.appId, list)
  }

  const meetingsByApp = new Map<
    string,
    { total: number; thisWeek: number; lastAt: Date | null }
  >()
  for (const row of meetingRows) {
    if (!row.appId) continue
    meetingsByApp.set(row.appId, {
      total: row.total,
      thisWeek: row.thisWeek,
      lastAt: row.lastCreatedAt,
    })
  }

  const commentsByApp = new Map<string, { total: number; lastAt: Date | null }>()
  for (const row of commentRows) {
    commentsByApp.set(row.appId, { total: row.total, lastAt: row.lastCreatedAt })
  }

  return appRows.map((app) => {
    const members = membersByApp.get(app.id) ?? []
    const taskEntry = tasksByApp.get(app.id)
    const taskCounts = taskEntry?.counts ?? emptyTaskCounts()
    const appSprints = sprintsByApp.get(app.id) ?? []
    const meetingEntry = meetingsByApp.get(app.id)
    const commentEntry = commentsByApp.get(app.id)

    const currentSprint = pickCurrentSprint(appSprints, today)
    const lastActivityAt = latest(
      taskEntry?.lastAt,
      meetingEntry?.lastAt,
      commentEntry?.lastAt,
    )

    const stats: AppStats = {
      tasks: taskCounts,
      sprints: {
        total: appSprints.length,
        planned: appSprints.filter((s) => s.status === 'planned').length,
        running: appSprints.filter((s) => s.status === 'active').length,
        done: appSprints.filter((s) => s.status === 'done').length,
      },
      currentSprint,
      nextSprint: currentSprint ? null : pickNextSprint(appSprints, today),
      meetings: {
        total: meetingEntry?.total ?? 0,
        thisWeek: meetingEntry?.thisWeek ?? 0,
      },
      comments: commentEntry?.total ?? 0,
      lastActivityAt,
    }

    return {
      ...app,
      members,
      stats,
      health: appHealth(
        {
          status: app.status,
          tasks: taskCounts,
          currentSprint,
          sprintCount: appSprints.length,
          memberCount: members.length,
          leadId: app.leadId,
          lastActivityOn: lastActivityAt
            ? toIsoDateInTimeZone(lastActivityAt, LK_TIMEZONE)
            : null,
        },
        today,
      ),
    }
  })
})

/**
 * One app by slug, with its lead and PM both resolved. Their NAMEs are what
 * the header actually shows, and looking them up by scanning
 * `listActiveUsers()` (what the page used to do for the lead) quietly fails
 * for someone who has since been deactivated — the app then renders as
 * having no lead/PM at all, which is a different and wrong statement.
 */
export async function getAppBySlug(slug: string) {
  const lead = alias(users, 'lead')
  const pm = alias(users, 'pm')
  const [app] = await db
    .select({
      ...liveAppColumns,
      leadName: lead.name,
      leadAvatarUrl: lead.avatarUrl,
      pmName: pm.name,
      pmAvatarUrl: pm.avatarUrl,
    })
    .from(liveApps)
    .leftJoin(lead, eq(liveApps.leadId, lead.id))
    .leftJoin(pm, eq(liveApps.pmId, pm.id))
    .where(eq(liveApps.slug, slug))
  return app ?? null
}

export type AppRoleHistoryEntry = {
  id: string
  role: AppRoleKind
  userId: string
  userName: string | null
  effectiveFrom: Date
  effectiveTo: Date | null
  changedByName: string | null
  note: string | null
  backfilled: boolean
}

/**
 * Every PM/lead this app has ever had, newest first — the per-app half of
 * "who was PM/lead of this app, and when", answered from app_role_history
 * (an as-of index) rather than replayed from activity_log (an audit trail
 * that can only say a change happened, not who held the role in between).
 *
 * Left joins throughout: a since-deleted holder or changer must not erase
 * their row from the record, the same defensive shape getPersonAllocationHistory
 * uses for assignment_history.
 */
export async function getAppRoleHistory(appId: string): Promise<AppRoleHistoryEntry[]> {
  const holder = alias(users, 'app_role_holder')
  const changer = alias(users, 'app_role_changer')
  const rows = await db
    .select({
      id: appRoleHistory.id,
      role: appRoleHistory.role,
      userId: appRoleHistory.userId,
      userName: holder.name,
      effectiveFrom: appRoleHistory.effectiveFrom,
      effectiveTo: appRoleHistory.effectiveTo,
      changedByName: changer.name,
      note: appRoleHistory.note,
    })
    .from(appRoleHistory)
    .leftJoin(holder, eq(appRoleHistory.userId, holder.id))
    .leftJoin(changer, eq(appRoleHistory.changedBy, changer.id))
    .where(eq(appRoleHistory.appId, appId))

  return buildRoleTimeline(rows)
}

export type AppCounts = {
  tasks: AppTaskCounts
  meetings: number
  comments: number
  /**
   * Newest of the three sources, or null when nothing has ever happened.
   * Same three tables `listApps` folds into `stats.lastActivityAt`, so an
   * app's card and its header cannot disagree about when it last moved.
   */
  lastActivityAt: Date | null
}

/**
 * The counters ONE app's header shows, on every tab.
 *
 * They have to be their own query rather than a slice of whatever the open
 * tab already fetched: the header is always on screen, and deriving
 * "meetings: 12" from a meeting list that is only loaded on the Meetings tab
 * would print 0 everywhere else — a wrong number, not a missing one.
 *
 * The task half reuses the same conditional-aggregate shape as `listApps`, so
 * the "Overdue" figure in this header and the one on that app's card in the
 * grid are computed by identical SQL and cannot drift apart. `getBoard` can't
 * answer it at all: it only ever selects one sprint's tasks, and never
 * selects `due_date`.
 *
 * `lastActivityAt` rides along as a `max()` COLUMN on the three aggregates
 * that were already being run, rather than as its own trio of queries. It was
 * briefly the latter (`getAppLastActivityAt`), which meant every visit to
 * every tab of every app scanned tasks, meetings and comments twice — six
 * round trips where three do the job. That is the same "extra column, not an
 * extra round trip" argument `listApps` is built on; splitting it here was
 * simply an oversight, and the two must not be allowed to diverge because the
 * health verdict is computed from this value.
 */
export async function getAppCounts(appId: string): Promise<AppCounts> {
  const today = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
  const [taskRows, meetingRows, commentRows] = await Promise.all([
    db
      .select({
        todo: countWhere(eq(liveTasks.status, 'todo')),
        inProgress: countWhere(eq(liveTasks.status, 'in_progress')),
        done: countWhere(notInArray(liveTasks.status, [...OPEN_STATUSES])),
        overdue: countWhere(
          and(inArray(liveTasks.status, OPEN_STATUSES), isNotNull(liveTasks.dueDate), lt(liveTasks.dueDate, today)),
        ),
        lastCreatedAt: max(liveTasks.createdAt),
      })
      .from(liveTasks)
      .where(eq(liveTasks.appId, appId)),
    // Through meeting_apps for the same reason as listApps above: this number
    // labels the app page's Meetings tab, and the tab itself is
    // getMeetingsForApp — which reads the join table. Reading the deprecated
    // meetings.app_id here would print "3" over a list of 5.
    db
      .select({ total: count(), lastCreatedAt: max(liveMeetings.createdAt) })
      .from(meetingApps)
      .innerJoin(liveMeetings, eq(meetingApps.meetingId, liveMeetings.id))
      .where(eq(meetingApps.appId, appId)),
    db
      .select({ total: count(), lastCreatedAt: max(appComments.createdAt) })
      .from(appComments)
      .where(eq(appComments.appId, appId)),
  ])

  const row = taskRows[0]
  return {
    tasks: row
      ? {
          todo: row.todo,
          in_progress: row.inProgress,
          done: row.done,
          total: row.todo + row.inProgress + row.done,
          overdue: row.overdue,
        }
      : emptyTaskCounts(),
    meetings: meetingRows[0]?.total ?? 0,
    comments: commentRows[0]?.total ?? 0,
    lastActivityAt: latest(
      row?.lastCreatedAt,
      meetingRows[0]?.lastCreatedAt,
      commentRows[0]?.lastCreatedAt,
    ),
  }
}

/**
 * Distinct tech tags already in use across every app, for the Tech tags
 * combobox's suggestion pool (merged with the curated list in
 * src/lib/tech-tags.ts). Selects just the array column rather than full
 * rows, then de-dupes in JS — at our row counts that's simpler than an
 * unnest/aggregate-distinct query and just as cheap.
 */
export async function listDistinctTechTags(): Promise<string[]> {
  const rows = await db.select({ techTags: liveApps.techTags }).from(liveApps)
  const tags = new Set<string>()
  for (const row of rows) {
    for (const tag of row.techTags) {
      const trimmed = tag.trim()
      if (trimmed) tags.add(trimmed)
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b))
}
