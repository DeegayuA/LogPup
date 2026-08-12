import { cache } from 'react'
import { and, asc, desc, eq, gt, gte, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { apps, sprints, tasks, users } from '@/db/schema'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import type { TaskStatus } from '@/features/sprints/board-view'

export type Sprint = typeof sprints.$inferSelect

export type TaskWithAssignee = {
  id: string
  title: string
  description: string | null
  // Narrowed from `string` to the pg enum's own union: the board groups,
  // filters and drag-drop all switch on this, and every one of them had to
  // cast before. The DB column is already `task_status`, so nothing widens.
  status: TaskStatus
  priority: number
  sortOrder: number
  /** Null = the app backlog. Carried so a card can say which sprint it is in
   *  when the board is showing more than one. */
  sprintId: string | null
  /** Plain yyyy-mm-dd, as stored. Compared as a string against an ISO
   *  "today" — never parsed into a Date for the overdue check. */
  dueDate: string | null
  /** Needed on the client: it is the first tiebreaker whenever two cards
   *  share a rank, which is the normal case (see task-rank.ts). */
  createdAt: Date
  assignee: { id: string; name: string; avatarUrl: string | null } | null
}

export type Board = {
  todo: TaskWithAssignee[]
  in_progress: TaskWithAssignee[]
  done: TaskWithAssignee[]
}

export type ActiveSprintSummary = {
  sprintId: string
  sprintName: string
  appName: string
  appSlug: string
  startDate: string
  endDate: string
  // 'active' | 'planned' only — a 'done' sprint never reaches this shape
  // (see getActiveSprints). A 'planned' row here is running by date but
  // hasn't been flipped to 'active' yet; the dashboard card badges that
  // case rather than silently presenting it as identical to a real
  // 'active' sprint.
  status: 'active' | 'planned'
  counts: { todo: number; in_progress: number; done: number }
}

export type UpcomingSprintSummary = {
  sprintId: string
  sprintName: string
  appName: string
  appSlug: string
  startDate: string
}

export async function getSprintsForApp(appId: string): Promise<Sprint[]> {
  return db
    .select()
    .from(sprints)
    .where(eq(sprints.appId, appId))
    .orderBy(desc(sprints.startDate))
}

/**
 * Sprints a human would call "running now": status 'active', PLUS sprints
 * still marked 'planned' whose date range already contains today
 * (defensive — covers rows created before sprints started auto-activating
 * on create, and anything a user forgets to flip manually). A 'done'
 * sprint is never included, even if its range still technically contains
 * today. Mirrors `isSprintRunningNow` in sprint-date-range.ts, expressed
 * as a SQL predicate instead of a per-row JS filter so the query stays
 * narrow.
 */
export const getActiveSprints = cache(async function getActiveSprints(): Promise<ActiveSprintSummary[]> {
  const today = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
  const rows = await db
    .select({
      sprintId: sprints.id,
      sprintName: sprints.name,
      appName: apps.name,
      appSlug: apps.slug,
      startDate: sprints.startDate,
      endDate: sprints.endDate,
      status: sprints.status,
      taskStatus: tasks.status,
    })
    .from(sprints)
    .innerJoin(apps, eq(sprints.appId, apps.id))
    .leftJoin(tasks, eq(tasks.sprintId, sprints.id))
    .where(
      or(
        eq(sprints.status, 'active'),
        and(eq(sprints.status, 'planned'), lte(sprints.startDate, today), gte(sprints.endDate, today)),
      ),
    )
    .orderBy(asc(sprints.startDate))

  const bySprint = new Map<string, ActiveSprintSummary>()
  for (const row of rows) {
    let entry = bySprint.get(row.sprintId)
    if (!entry) {
      entry = {
        sprintId: row.sprintId,
        sprintName: row.sprintName,
        appName: row.appName,
        appSlug: row.appSlug,
        startDate: row.startDate,
        endDate: row.endDate,
        // The WHERE clause above only ever admits 'active' or 'planned' rows.
        status: row.status as 'active' | 'planned',
        counts: { todo: 0, in_progress: 0, done: 0 },
      }
      bySprint.set(row.sprintId, entry)
    }
    // LEFT joined: a sprint with no tasks yields one row with taskStatus
    // null, which we skip so the sprint still appears with all-zero counts.
    if (row.taskStatus) entry.counts[row.taskStatus] += 1
  }

  return [...bySprint.values()]
})

/**
 * The single soonest sprint that hasn't started yet (startDate strictly
 * after today), across all apps — used by the dashboard card to say
 * "starts in N days" instead of implying nothing exists when a user has
 * sprints on the books but none of them are current. Null when there is no
 * such sprint (including when there are no sprints at all).
 */
export async function getNextUpcomingSprint(): Promise<UpcomingSprintSummary | null> {
  const today = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
  const [row] = await db
    .select({
      sprintId: sprints.id,
      sprintName: sprints.name,
      appName: apps.name,
      appSlug: apps.slug,
      startDate: sprints.startDate,
    })
    .from(sprints)
    .innerJoin(apps, eq(sprints.appId, apps.id))
    .where(gt(sprints.startDate, today))
    .orderBy(asc(sprints.startDate))
    .limit(1)

  return row ?? null
}

/**
 * Task counts per sprint for one app, plus the backlog under the `null` key.
 *
 * The unified Roadmap needs a count for EVERY bar on the spine, and getBoard
 * answers for exactly one sprint — which is why the old Board tab could only
 * show progress for the sprint you had already selected. One grouped query
 * answers the whole spine instead of N round trips.
 *
 * getActiveSprints is not a substitute: it is cross-app, cached, and
 * deliberately excludes finished sprints, which the spine still has to draw.
 */
export type SprintTaskCounts = { todo: number; in_progress: number; done: number }

export async function getSprintTaskCounts(
  appId: string,
): Promise<Map<string | null, SprintTaskCounts>> {
  const rows = await db
    .select({
      sprintId: tasks.sprintId,
      status: tasks.status,
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(eq(tasks.appId, appId))
    .groupBy(tasks.sprintId, tasks.status)

  const bySprint = new Map<string | null, SprintTaskCounts>()
  for (const row of rows) {
    const counts = bySprint.get(row.sprintId) ?? { todo: 0, in_progress: 0, done: 0 }
    // `count(*)` comes back as a string through some driver versions; Number()
    // keeps the arithmetic downstream integer maths rather than string
    // concatenation.
    counts[row.status as keyof SprintTaskCounts] = Number(row.count)
    bySprint.set(row.sprintId, counts)
  }
  return bySprint
}

export async function getBoard(appId: string, sprintId: string | null): Promise<Board> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      sortOrder: tasks.sortOrder,
      sprintId: tasks.sprintId,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      assigneeId: users.id,
      assigneeName: users.name,
      assigneeAvatarUrl: users.avatarUrl,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(
      and(
        eq(tasks.appId, appId),
        // null sprintId means the app's backlog: tasks not assigned to any sprint.
        sprintId === null ? isNull(tasks.sprintId) : eq(tasks.sprintId, sprintId),
      ),
    )
    // THREE keys, not one. `sort_order` defaults to 0 and writers outside the
    // board (the ⌘K quick-add) insert without a rank, so ties are the normal
    // case, not an edge case — `ORDER BY sort_order` alone returns tied rows
    // in whatever order Postgres feels like, which is a board that silently
    // reshuffles itself between two renders of identical data. `created_at`
    // then `id` make the order total. Mirrors compareRanked in task-rank.ts,
    // which the client applies to its optimistic copy for the same reason.
    .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt), asc(tasks.id))

  const board: Board = { todo: [], in_progress: [], done: [] }
  for (const row of rows) {
    board[row.status].push({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      sortOrder: row.sortOrder,
      sprintId: row.sprintId,
      dueDate: row.dueDate,
      createdAt: row.createdAt,
      assignee: row.assigneeId
        ? { id: row.assigneeId, name: row.assigneeName as string, avatarUrl: row.assigneeAvatarUrl }
        : null,
    })
  }
  return board
}
