'use server'

// Links between a task and other work items (work_links). Every end is read
// back through its live subquery: the table has no FKs on from/to (the ends
// live in different tables), so a trashed task or bug is still referenced by
// its edges and must drop out at READ time. The appId is always derived from
// the task row, never taken from the caller — a forged appId would otherwise
// buy a capability check against a project the task is not in.

import { z } from 'zod'
import { and, desc, eq, ilike, inArray, ne, or, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveBugReports, liveTasks } from '@/db/live'
import { workLinks } from '@/db/schema'
import { auth } from '@/lib/auth'
import { requireCapability } from '@/features/auth/actor'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { appKeyFor, formatTaskKey, parseTaskKey } from '@/features/sprints/task-key'
import type { TaskType } from '@/features/sprints/hierarchy'
import {
  LINK_END_TYPES,
  LINK_KINDS,
  LINK_KIND_LABEL,
  describeLink,
  edgeFor,
  escapeLike,
  linkConflict,
  mergeTargets,
  type LinkEndType,
} from '@/features/sprints/links'

export type LinkedItem = {
  type: LinkEndType
  id: string
  /** "LOG-245" for a task; null for a bug (bugs have no per-project number). */
  key: string | null
  title: string
  status: string
  /** Tasks only: what the board link opens on, and which icon to draw. */
  sprintId: string | null
  taskType: TaskType | null
}

export type TaskLink = { linkId: string; label: string; other: LinkedItem }
export type LinkTarget = LinkedItem & { exact?: boolean }

const MAX_LINKS_READ = 200

const uuid = z.uuid()
const queryInput = z.string().trim().max(100)
const addInput = z.object({
  kind: z.enum(LINK_KINDS),
  toType: z.enum(LINK_END_TYPES),
  toId: z.uuid(),
  // Optional so a caller that only knows "blocks" still means "this task blocks that".
  direction: z.enum(['outgoing', 'incoming']).default('outgoing'),
})

/**
 * Walks an error's `.cause` chain for a Postgres unique violation. Another
 * copy of the ten lines in admin/actions.ts, for the reason given there:
 * reaching into another feature's private helper couples modules for nothing.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const e = current as { code?: unknown; message?: unknown; cause?: unknown }
    if (e.code === '23505') return true
    if (typeof e.message === 'string' && e.message.includes('duplicate key')) return true
    current = e.cause
  }
  return false
}

async function taskById(taskId: string) {
  const [task] = await db
    .select({
      id: liveTasks.id,
      appId: liveTasks.appId,
      assigneeId: liveTasks.assigneeId,
      title: liveTasks.title,
    })
    .from(liveTasks)
    // A task in a trashed project reads as not found, so its links can be
    // neither listed nor changed while the project sits in Trash.
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(liveTasks.id, taskId))
    .limit(1)
  return task ?? null
}

async function appKeyById(appId: string) {
  const [app] = await db
    .select({ key: liveApps.key, number: liveApps.number })
    .from(liveApps)
    .where(eq(liveApps.id, appId))
    .limit(1)
  return app ?? null
}

const taskColumns = {
  id: liveTasks.id,
  title: liveTasks.title,
  status: liveTasks.status,
  number: liveTasks.number,
  sprintId: liveTasks.sprintId,
  type: liveTasks.type,
}
const bugColumns = { id: liveBugReports.id, title: liveBugReports.title, status: liveBugReports.status }

type TaskEndRow = { id: string; title: string; status: string; number: number | null; sprintId: string | null; type: TaskType }
type BugEndRow = { id: string; title: string; status: string }
type AppKey = { key: string | null; number: number } | null

function taskItem(row: TaskEndRow, app: AppKey): LinkedItem {
  return {
    type: 'task',
    id: row.id,
    key: app && row.number != null ? formatTaskKey(app, row.number) : null,
    title: row.title,
    status: row.status,
    sprintId: row.sprintId,
    taskType: row.type,
  }
}

function bugItem(row: BugEndRow): LinkedItem {
  return { type: 'bug', id: row.id, key: null, title: row.title, status: row.status, sprintId: null, taskType: null }
}

/** Both directions of a task's links, each other end resolved and live, in the task's project. */
export async function listTaskLinks(taskId: string): Promise<ActionResult<TaskLink[]>> {
  if (!uuid.safeParse(taskId).success) return err('Task not found')
  const task = await taskById(taskId)
  if (!task) return err('Task not found')
  if (!(await requireCapability('app.view', { appId: task.appId }))) return err('Not allowed')

  try {
    const rows = await db
      .select({
        id: workLinks.id,
        fromType: workLinks.fromType,
        fromId: workLinks.fromId,
        toType: workLinks.toType,
        toId: workLinks.toId,
        kind: workLinks.kind,
      })
      .from(workLinks)
      .where(or(
        and(eq(workLinks.fromType, 'task'), eq(workLinks.fromId, taskId)),
        and(eq(workLinks.toType, 'task'), eq(workLinks.toId, taskId)),
      ))
      .orderBy(desc(workLinks.createdAt))
      .limit(MAX_LINKS_READ)

    const described = rows
      .map((row) => ({ row, view: describeLink(row, { type: 'task', id: taskId }) }))
      .filter((d): d is { row: typeof d.row; view: NonNullable<typeof d.view> } => d.view !== null)

    const taskIds = described.filter((d) => d.view.other.type === 'task').map((d) => d.view.other.id)
    const bugIds = described.filter((d) => d.view.other.type === 'bug').map((d) => d.view.other.id)

    // Scoped to the task's project as well as to live rows: a task moved to
    // another project keeps its old edges, and the viewer's app.view says
    // nothing about the project at the far end.
    const [taskEnds, bugEnds, app] = await Promise.all([
      taskIds.length === 0
        ? Promise.resolve([] as TaskEndRow[])
        : db.select(taskColumns).from(liveTasks)
            .where(and(inArray(liveTasks.id, taskIds), eq(liveTasks.appId, task.appId))),
      bugIds.length === 0
        ? Promise.resolve([] as BugEndRow[])
        : db.select(bugColumns).from(liveBugReports)
            .where(and(inArray(liveBugReports.id, bugIds), eq(liveBugReports.appId, task.appId))),
      appKeyById(task.appId),
    ])

    const tasksById = new Map((taskEnds as TaskEndRow[]).map((t) => [t.id, taskItem(t, app)]))
    const bugsById = new Map((bugEnds as BugEndRow[]).map((b) => [b.id, bugItem(b)]))

    const out: TaskLink[] = []
    for (const { row, view } of described) {
      const other = view.other.type === 'task' ? tasksById.get(view.other.id) : bugsById.get(view.other.id)
      if (other) out.push({ linkId: row.id, label: view.label, other })
    }
    return ok(out)
  } catch (error) {
    console.error('[links] list failed', taskId, error)
    return err('Could not load links')
  }
}

/** Up to 10 tasks and bugs in the task's project matching a title fragment or a task key. */
export async function searchLinkTargets(taskId: string, query: string): Promise<ActionResult<LinkTarget[]>> {
  if (!uuid.safeParse(taskId).success) return err('Task not found')
  const parsedQuery = queryInput.safeParse(query)
  if (!parsedQuery.success) return err('Search is too long')
  const q = parsedQuery.data
  if (q === '') return ok([])

  const task = await taskById(taskId)
  if (!task) return err('Task not found')
  if (!(await requireCapability('app.view', { appId: task.appId }))) return err('Not allowed')

  try {
    const app = await appKeyById(task.appId)
    const pattern = `%${escapeLike(q)}%`
    // A key only counts when it names THIS project: "OPS-12" typed on a LOG
    // task must not quietly match LOG-12.
    const key = parseTaskKey(q)
    const keyNumber = key && app && key.appKey === appKeyFor(app) ? key.number : null

    const taskMatch: SQL | undefined = keyNumber === null
      ? ilike(liveTasks.title, pattern)
      : or(ilike(liveTasks.title, pattern), eq(liveTasks.number, keyNumber))

    const [taskRows, bugRows] = await Promise.all([
      db.select(taskColumns).from(liveTasks)
        .where(and(eq(liveTasks.appId, task.appId), ne(liveTasks.id, taskId), taskMatch))
        .orderBy(desc(liveTasks.number))
        .limit(10),
      db.select(bugColumns).from(liveBugReports)
        .where(and(eq(liveBugReports.appId, task.appId), ilike(liveBugReports.title, pattern)))
        .orderBy(desc(liveBugReports.createdAt))
        .limit(10),
    ])

    const tasks: LinkTarget[] = (taskRows as TaskEndRow[]).map((t) => ({
      ...taskItem(t, app),
      exact: keyNumber !== null && t.number === keyNumber,
    }))
    const bugs: LinkTarget[] = (bugRows as BugEndRow[]).map(bugItem)
    return ok(mergeTargets(tasks, bugs, 10))
  } catch (error) {
    console.error('[links] search failed', taskId, error)
    return err('Search failed')
  }
}

/** Link this task to another task or bug in the same project. */
export async function addTaskLink(taskId: string, input: unknown): Promise<ActionResult<{ linkId: string }>> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (!uuid.safeParse(taskId).success) return err('Task not found')
  const parsed = addInput.safeParse(input)
  if (!parsed.success) return err('Choose a link type and an item')
  const { kind, toType, toId, direction } = parsed.data

  const task = await taskById(taskId)
  if (!task) return err('Task not found')
  const actor = await requireCapability('task.edit', { appId: task.appId, ownerId: task.assigneeId })
  if (!actor) return err('Not allowed')

  if (toType === 'task' && toId === taskId) return err('A task cannot be linked to itself')

  // The far end must be live AND in the same project: the row is stored under
  // the task's appId, so a cross-project end would be filed in a project that
  // does not hold it (and listTaskLinks would never show it).
  const otherRows = toType === 'task'
    ? await db.select({ id: liveTasks.id, title: liveTasks.title }).from(liveTasks)
        .where(and(eq(liveTasks.id, toId), eq(liveTasks.appId, task.appId))).limit(1)
    : await db.select({ id: liveBugReports.id, title: liveBugReports.title }).from(liveBugReports)
        .where(and(eq(liveBugReports.id, toId), eq(liveBugReports.appId, task.appId))).limit(1)
  const other = otherRows[0]
  if (!other) return err('That item is not in this project')

  const self = { type: 'task', id: taskId }
  const target = { type: toType, id: toId }
  const edge = edgeFor(self, target, kind, direction)

  const between = await db
    .select({
      id: workLinks.id,
      fromType: workLinks.fromType,
      fromId: workLinks.fromId,
      toType: workLinks.toType,
      toId: workLinks.toId,
      kind: workLinks.kind,
    })
    .from(workLinks)
    .where(or(
      and(eq(workLinks.fromType, self.type), eq(workLinks.fromId, self.id),
        eq(workLinks.toType, target.type), eq(workLinks.toId, target.id)),
      and(eq(workLinks.fromType, target.type), eq(workLinks.fromId, target.id),
        eq(workLinks.toType, self.type), eq(workLinks.toId, self.id)),
    ))
  const conflict = linkConflict(edge, between)
  if (conflict) return err(conflict)

  let linkId: string
  try {
    const [row] = await db
      .insert(workLinks)
      .values({ ...edge, appId: task.appId, createdBy: actor.id })
      .returning({ id: workLinks.id })
    linkId = row.id
  } catch (error) {
    // The pre-check above races a concurrent identical add; the unique index
    // is what actually decides, and its answer is the same sentence.
    if (isUniqueViolation(error)) return err('Those are already linked')
    console.error('[links] add failed', taskId, error)
    return err('Could not save the link')
  }

  await logActivity({
    actorId: actor.id,
    verb: 'linked',
    entityType: 'task',
    entityId: taskId,
    entityLabel: task.title,
    appId: task.appId,
    detail: `${LINK_KIND_LABEL[kind][direction]} ${toType} "${other.title}"`,
    metadata: { linkId, kind, direction, toType, toId },
  })
  return ok({ linkId })
}

/**
 * Remove one link. A real DELETE: work_links has no deletedAt, an edge's
 * absence is the fact, and activity_log keeps who removed what.
 *
 * Allowed when the caller may edit EITHER task end — a member who owns the
 * blocked task must be able to clear "is blocked by" without owning the
 * blocker.
 */
export async function removeTaskLink(linkId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (!uuid.safeParse(linkId).success) return err('Link not found')

  const [link] = await db
    .select({
      id: workLinks.id,
      fromType: workLinks.fromType,
      fromId: workLinks.fromId,
      toType: workLinks.toType,
      toId: workLinks.toId,
      kind: workLinks.kind,
    })
    .from(workLinks)
    .where(eq(workLinks.id, linkId))
    .limit(1)
  if (!link) return err('Link not found')

  const taskEndIds = [
    link.fromType === 'task' ? link.fromId : null,
    link.toType === 'task' ? link.toId : null,
  ].filter((id): id is string => id !== null)

  let allowedVia: { id: string; appId: string; title: string } | null = null
  let actorId: string | null = null
  for (const id of taskEndIds) {
    const task = await taskById(id)
    if (!task) continue
    const actor = await requireCapability('task.edit', { appId: task.appId, ownerId: task.assigneeId })
    if (actor) {
      allowedVia = task
      actorId = actor.id
      break
    }
  }
  if (!allowedVia || !actorId) return err('Not allowed')

  try {
    await db.delete(workLinks).where(eq(workLinks.id, linkId))
  } catch (error) {
    console.error('[links] remove failed', linkId, error)
    return err('Could not remove the link')
  }

  const view = describeLink(link, { type: 'task', id: allowedVia.id })
  await logActivity({
    actorId,
    verb: 'unlinked',
    entityType: 'task',
    entityId: allowedVia.id,
    entityLabel: allowedVia.title,
    appId: allowedVia.appId,
    detail: view ? `${view.label} ${view.other.type}` : link.kind,
    metadata: { linkId, kind: link.kind, fromType: link.fromType, fromId: link.fromId, toType: link.toType, toId: link.toId },
  })
  return ok(undefined)
}
