import { and, asc, desc, eq, gt, gte, isNull, lte, or } from 'drizzle-orm'
import { db } from '@/db'
import { apps, sprints, tasks, users } from '@/db/schema'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'

export type Sprint = typeof sprints.$inferSelect

export type TaskWithAssignee = {
  id: string
  title: string
  description: string | null
  status: string
  priority: number
  sortOrder: number
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
export async function getActiveSprints(): Promise<ActiveSprintSummary[]> {
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
}

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

export async function getBoard(appId: string, sprintId: string | null): Promise<Board> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      sortOrder: tasks.sortOrder,
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
    .orderBy(asc(tasks.sortOrder))

  const board: Board = { todo: [], in_progress: [], done: [] }
  for (const row of rows) {
    board[row.status].push({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      sortOrder: row.sortOrder,
      assignee: row.assigneeId
        ? { id: row.assigneeId, name: row.assigneeName as string, avatarUrl: row.assigneeAvatarUrl }
        : null,
    })
  }
  return board
}
