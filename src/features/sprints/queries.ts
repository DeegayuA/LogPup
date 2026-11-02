import { cache } from 'react'
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveSprints, liveTasks } from '@/db/live'
import { sprints, users } from '@/db/schema'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { backlogJoinCondition, sprintOrBacklogCondition } from '@/features/sprints/backlog'
import { TASK_STATUSES, statusBucket, type TaskStatus } from '@/features/sprints/board-view'
import type { TaskType } from '@/features/sprints/hierarchy'
import { formatTaskKey } from '@/features/sprints/task-key'

// Row shape only (typeof ...$inferSelect) — the actual reads below go
// through liveSprints/liveTasks (src/db/live.ts), never `sprints`/`tasks`
// directly.
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
  // ---- PRD Module A (migration 0077) ----
  /** "LOG-245", or "P12-3" for a project with no key. Built server-side so
   *  the card never needs the app row. Null only if the row has no number. */
  taskKey: string | null
  type: TaskType
  parentId: string | null
  /** The parent's ID and title, so a card can say what it belongs to. Null
   *  when there is no parent, or the parent is trashed (parentId may then
   *  still be set — the row is not a parent any more). */
  parent: { taskKey: string | null; title: string } | null
  /** Items directly under this one, wherever they are scheduled — a story's
   *  tasks are often in a later sprint, and the card still owns them. */
  children: BoardChild[]
  /** Null = not estimated, which is not the same as 0. */
  storyPoints: number | null
  startDate: string | null
  reporterId: string | null
  environment: string | null
}

export type BoardChild = {
  id: string
  taskKey: string | null
  title: string
  status: TaskStatus
  type: TaskType
}

/** Every workflow status, each its own list (empty ones included). */
export type Board = Record<TaskStatus, TaskWithAssignee[]>

export function emptyBoard(): Board {
  return Object.fromEntries(TASK_STATUSES.map((s) => [s, []])) as unknown as Board
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
  // Ordered by `sortOrder`, not `startDate`: the roadmap is drag-reorderable
  // and its row order is independent of dates. Migration 0029 seeded the
  // column chronologically per app, so a fresh app still reads oldest-first
  // until somebody actually reorders it.
  return db
    .select()
    .from(liveSprints)
    .where(eq(liveSprints.appId, appId))
    .orderBy(asc(liveSprints.sortOrder))
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
      sprintId: liveSprints.id,
      sprintName: liveSprints.name,
      appName: liveApps.name,
      appSlug: liveApps.slug,
      startDate: liveSprints.startDate,
      endDate: liveSprints.endDate,
      status: liveSprints.status,
      taskStatus: liveTasks.status,
    })
    .from(liveSprints)
    .innerJoin(liveApps, eq(liveSprints.appId, liveApps.id))
    .leftJoin(liveTasks, eq(liveTasks.sprintId, liveSprints.id))
    .where(
      or(
        eq(liveSprints.status, 'active'),
        and(
          eq(liveSprints.status, 'planned'),
          lte(liveSprints.startDate, today),
          gte(liveSprints.endDate, today),
        ),
      ),
    )
    .orderBy(asc(liveSprints.startDate))

  // drizzle-orm's column types collapse to `never` once a query leftJoins
  // two `.as()` subqueries together (liveSprints + liveTasks here) — a
  // type-inference gap in this drizzle-orm version, not a runtime one: the
  // generated SQL and the actual row shape are exactly what's selected above
  // (see backlog.test.ts's toSQL() assertion on the same join shape).
  // Recast to the shape the select object above actually produces.
  const typedRows = rows as {
    sprintId: string
    sprintName: string
    appName: string
    appSlug: string
    startDate: string
    endDate: string
    status: 'planned' | 'active' | 'done'
    taskStatus: TaskStatus | null
  }[]

  const bySprint = new Map<string, ActiveSprintSummary>()
  for (const row of typedRows) {
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
    if (row.taskStatus) entry.counts[statusBucket(row.taskStatus)] += 1
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
      sprintId: liveSprints.id,
      sprintName: liveSprints.name,
      appName: liveApps.name,
      appSlug: liveApps.slug,
      startDate: liveSprints.startDate,
    })
    .from(liveSprints)
    .innerJoin(liveApps, eq(liveSprints.appId, liveApps.id))
    .where(gt(liveSprints.startDate, today))
    .orderBy(asc(liveSprints.startDate))
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
      sprintId: liveTasks.sprintId,
      status: liveTasks.status,
      count: sql<number>`count(*)`,
    })
    .from(liveTasks)
    .where(eq(liveTasks.appId, appId))
    .groupBy(liveTasks.sprintId, liveTasks.status)

  const bySprint = new Map<string | null, SprintTaskCounts>()
  for (const row of rows) {
    const counts = bySprint.get(row.sprintId) ?? { todo: 0, in_progress: 0, done: 0 }
    // `count(*)` comes back as a string through some driver versions; Number()
    // keeps the arithmetic downstream integer maths rather than string
    // concatenation. += into the three-way bucket, not = into the raw status:
    // several workflow states (review, QA, rework…) share "in progress".
    counts[statusBucket(row.status)] += Number(row.count)
    bySprint.set(row.sprintId, counts)
  }
  return bySprint
}

export type WorkTreeRow = {
  id: string
  number: number | null
  taskKey: string | null
  title: string
  type: TaskType
  status: TaskStatus
  parentId: string | null
  storyPoints: number | null
  sprintId: string | null
  assigneeName: string | null
}

/** A project past this many items needs filters, not a longer page. */
export const WORK_TREE_LIMIT = 2000

/**
 * Every live work item in the project, flat, for the Backlog tab's tree
 * (features/sprints/tree.ts nests it). One read regardless of depth. Sprint
 * is carried, not joined: a row links to its board, and a trashed sprint
 * already resolves to the backlog there (backlog.ts).
 */
export async function getWorkTree(appId: string): Promise<{ rows: WorkTreeRow[]; truncated: boolean }> {
  const [[app], rows] = await Promise.all([
    db.select({ key: liveApps.key, number: liveApps.number }).from(liveApps).where(eq(liveApps.id, appId)),
    db
      .select({
        id: liveTasks.id,
        number: liveTasks.number,
        title: liveTasks.title,
        type: liveTasks.type,
        status: liveTasks.status,
        parentId: liveTasks.parentId,
        storyPoints: liveTasks.storyPoints,
        sprintId: liveTasks.sprintId,
        assigneeName: users.name,
      })
      .from(liveTasks)
      .leftJoin(users, eq(liveTasks.assigneeId, users.id))
      .where(eq(liveTasks.appId, appId))
      .orderBy(asc(liveTasks.number), asc(liveTasks.id))
      .limit(WORK_TREE_LIMIT + 1),
  ])
  return {
    truncated: rows.length > WORK_TREE_LIMIT,
    rows: rows.slice(0, WORK_TREE_LIMIT).map((r) => ({
      ...r,
      storyPoints: r.storyPoints === null ? null : Number(r.storyPoints),
      taskKey: app && r.number !== null ? formatTaskKey(app, r.number) : null,
    })),
  }
}

export async function getBoard(appId: string, sprintId: string | null): Promise<Board> {
  // The app's key and number, for the task IDs. Its own read rather than a
  // join: this query already leftJoins one subquery, and a second collapses
  // drizzle's column inference (see the recast below).
  const appKeyRead = db
    .select({ key: liveApps.key, number: liveApps.number })
    .from(liveApps)
    .where(eq(liveApps.id, appId))
  const rowsRead = db
    .select({
      id: liveTasks.id,
      title: liveTasks.title,
      description: liveTasks.description,
      status: liveTasks.status,
      priority: liveTasks.priority,
      sortOrder: liveTasks.sortOrder,
      sprintId: liveTasks.sprintId,
      dueDate: liveTasks.dueDate,
      createdAt: liveTasks.createdAt,
      assigneeId: users.id,
      assigneeName: users.name,
      assigneeAvatarUrl: users.avatarUrl,
      number: liveTasks.number,
      type: liveTasks.type,
      parentId: liveTasks.parentId,
      storyPoints: liveTasks.storyPoints,
      startDate: liveTasks.startDate,
      reporterId: liveTasks.reporterId,
      environment: liveTasks.environment,
    })
    .from(liveTasks)
    .leftJoin(users, eq(liveTasks.assigneeId, users.id))
    // Backlog rule (no sprint, or the sprint is trashed) lives in
    // backlog.ts — this join + sprintOrBacklogCondition is what that file's
    // "composable select builder" is for.
    .leftJoin(liveSprints, backlogJoinCondition)
    .where(and(eq(liveTasks.appId, appId), sprintOrBacklogCondition(sprintId)))
    // THREE keys, not one. `sort_order` defaults to 0 and writers outside the
    // board (the ⌘K quick-add) insert without a rank, so ties are the normal
    // case, not an edge case — `ORDER BY sort_order` alone returns tied rows
    // in whatever order Postgres feels like, which is a board that silently
    // reshuffles itself between two renders of identical data. `created_at`
    // then `id` make the order total. Mirrors compareRanked in task-rank.ts,
    // which the client applies to its optimistic copy for the same reason.
    .orderBy(asc(liveTasks.sortOrder), asc(liveTasks.createdAt), asc(liveTasks.id))
  const [[app], rows] = await Promise.all([appKeyRead, rowsRead])

  // Same drizzle-orm subquery-leftJoin-subquery type-inference gap as
  // getActiveSprints above (see the comment there) — this query leftJoins
  // liveSprints (a second `.as()` subquery) purely for the backlog
  // predicate and never selects a column off it, but every selected column
  // still collapses to `never`. Recast to the shape actually selected.
  const typedRows = rows as {
    id: string
    title: string
    description: string | null
    status: TaskStatus
    priority: number
    sortOrder: number
    sprintId: string | null
    dueDate: string | null
    createdAt: Date
    assigneeId: string | null
    assigneeName: string | null
    assigneeAvatarUrl: string | null
    number: number | null
    type: TaskType
    parentId: string | null
    storyPoints: number | null
    startDate: string | null
    reporterId: string | null
    environment: string | null
  }[]

  // Parents and children in ONE read each, not one per card. Either end is
  // often on no board at all (an epic in the backlog, a task in next sprint),
  // so neither can be found among `rows`.
  const keyOf = (n: number | null) => (app && n !== null ? formatTaskKey(app, n) : null)
  const parentIds = [...new Set(typedRows.flatMap((r) => (r.parentId ? [r.parentId] : [])))]
  const boardIds = typedRows.map((r) => r.id)
  const [parentRows, childRows] = await Promise.all([
    parentIds.length > 0
      ? db
          .select({ id: liveTasks.id, number: liveTasks.number, title: liveTasks.title })
          .from(liveTasks)
          .where(and(eq(liveTasks.appId, appId), inArray(liveTasks.id, parentIds)))
      : Promise.resolve([]),
    boardIds.length > 0
      ? db
          .select({
            id: liveTasks.id,
            parentId: liveTasks.parentId,
            number: liveTasks.number,
            title: liveTasks.title,
            status: liveTasks.status,
            type: liveTasks.type,
          })
          .from(liveTasks)
          .where(and(eq(liveTasks.appId, appId), inArray(liveTasks.parentId, boardIds)))
          .orderBy(asc(liveTasks.number))
      : Promise.resolve([]),
  ])
  const parents = new Map<string, { taskKey: string | null; title: string }>()
  for (const p of parentRows) parents.set(p.id, { taskKey: keyOf(p.number), title: p.title })
  const childrenOf = new Map<string, BoardChild[]>()
  for (const c of childRows) {
    if (!c.parentId) continue
    const list = childrenOf.get(c.parentId) ?? []
    list.push({ id: c.id, taskKey: keyOf(c.number), title: c.title, status: c.status, type: c.type })
    childrenOf.set(c.parentId, list)
  }

  const board = emptyBoard()
  for (const row of typedRows) {
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
      taskKey: app && row.number !== null ? formatTaskKey(app, row.number) : null,
      type: row.type,
      parentId: row.parentId,
      parent: row.parentId ? (parents.get(row.parentId) ?? null) : null,
      children: childrenOf.get(row.id) ?? [],
      // Number(): the recast above means drizzle's mode:'number' mapping is
      // not guaranteed through the subquery join; a "3.0" string would print
      // "3.0 pts" and never equal 1.
      storyPoints: row.storyPoints === null ? null : Number(row.storyPoints),
      startDate: row.startDate,
      reporterId: row.reporterId,
      environment: row.environment,
    })
  }
  return board
}
