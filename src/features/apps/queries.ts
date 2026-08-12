import { and, asc, count, eq, getTableColumns, gte, isNotNull, lt, max, ne, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { addDays, startOfWeek } from 'date-fns'
import { db } from '@/db'
import { appComments, apps, assignments, meetings, sprints, tasks, users } from '@/db/schema'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import {
  appHealth,
  pickCurrentSprint,
  pickNextSprint,
  type AppHealth,
  type AppSprintSnapshot,
  type AppTaskCounts,
} from '@/features/apps/app-health'

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
export async function listApps(): Promise<AppPortfolioEntry[]> {
  const today = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
  const now = new Date()
  // "This week" is the calendar week you are standing in (Mon–Sun), not a
  // rolling 7 days: someone reading the strip on Friday is asking "what is
  // left of this week", not "what happens before next Friday".
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 7)

  const lead = alias(users, 'lead')

  const [appRows, memberRows, taskRows, sprintRows, meetingRows, commentRows] =
    await Promise.all([
      db
        .select({
          ...getTableColumns(apps),
          leadName: lead.name,
          leadAvatarUrl: lead.avatarUrl,
        })
        .from(apps)
        // Left join: an app whose lead row was deleted must still list.
        .leftJoin(lead, eq(apps.leadId, lead.id))
        .orderBy(asc(apps.name)),
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
          appId: tasks.appId,
          todo: countWhere(eq(tasks.status, 'todo')),
          inProgress: countWhere(eq(tasks.status, 'in_progress')),
          done: countWhere(eq(tasks.status, 'done')),
          // An overdue task is one that is NOT done and whose due date has
          // already passed. `tasks.due_date` is a plain calendar day, so this
          // compares against today-in-Colombo rather than a UTC instant.
          overdue: countWhere(
            and(ne(tasks.status, 'done'), isNotNull(tasks.dueDate), lt(tasks.dueDate, today)),
          ),
          lastCreatedAt: max(tasks.createdAt),
        })
        .from(tasks)
        .groupBy(tasks.appId),
      db
        .select({
          appId: sprints.appId,
          id: sprints.id,
          name: sprints.name,
          startDate: sprints.startDate,
          endDate: sprints.endDate,
          status: sprints.status,
        })
        .from(sprints),
      db
        .select({
          appId: meetings.appId,
          total: count(),
          thisWeek: countWhere(
            and(gte(meetings.startsAt, weekStart), lt(meetings.startsAt, weekEnd)),
          ),
          lastCreatedAt: max(meetings.createdAt),
        })
        .from(meetings)
        .where(isNotNull(meetings.appId))
        .groupBy(meetings.appId),
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
}

/**
 * One app by slug, with its lead resolved. The lead's NAME is the thing the
 * header actually shows, and looking it up by scanning `listActiveUsers()`
 * (what the page used to do) quietly fails for a lead who has since been
 * deactivated — the app then renders as having no lead at all, which is a
 * different and wrong statement.
 */
export async function getAppBySlug(slug: string) {
  const lead = alias(users, 'lead')
  const [app] = await db
    .select({
      ...getTableColumns(apps),
      leadName: lead.name,
      leadAvatarUrl: lead.avatarUrl,
    })
    .from(apps)
    .leftJoin(lead, eq(apps.leadId, lead.id))
    .where(eq(apps.slug, slug))
  return app ?? null
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
        todo: countWhere(eq(tasks.status, 'todo')),
        inProgress: countWhere(eq(tasks.status, 'in_progress')),
        done: countWhere(eq(tasks.status, 'done')),
        overdue: countWhere(
          and(ne(tasks.status, 'done'), isNotNull(tasks.dueDate), lt(tasks.dueDate, today)),
        ),
        lastCreatedAt: max(tasks.createdAt),
      })
      .from(tasks)
      .where(eq(tasks.appId, appId)),
    db
      .select({ total: count(), lastCreatedAt: max(meetings.createdAt) })
      .from(meetings)
      .where(eq(meetings.appId, appId)),
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
  const rows = await db.select({ techTags: apps.techTags }).from(apps)
  const tags = new Set<string>()
  for (const row of rows) {
    for (const tag of row.techTags) {
      const trimmed = tag.trim()
      if (trimmed) tags.add(trimmed)
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b))
}
