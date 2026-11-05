import 'server-only'

import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import { docComments, docRevisions, users, workLinks } from '@/db/schema'
import { liveApps, liveAttachments, liveBugReports, liveDocs, liveTasks } from '@/db/live'
import { likePattern } from '@/features/search/registry/limits'
import { appKeyFor, formatTaskKey, parseTaskKey } from '@/features/sprints/task-key'
import { attachmentHref, isUuid } from '@/features/sprints/attachments'
import { DOC_CATEGORIES, quickLineStats, type DocCategory } from '@/features/docs/docs'

/**
 * Reads behind the Docs tab. Server-only and permission-free BY CONTRACT: the
 * caller (DocsTab, a server component) has already asked app.view on the
 * project, and every read here is scoped to that appId AS WELL AS the doc id,
 * so a doc id pasted from another project resolves to nothing instead of to
 * its page. The server actions in actions.ts re-check on every write.
 *
 * Every docs read goes through liveDocs: a trashed page must not appear in the
 * list, behind a link, or in a compare view (db/live.test.ts enforces it).
 */

const DOC_LIST_LIMIT = 500
const REVISION_LIMIT = 200
const LINK_LIMIT = 100

export type DocListRow = {
  id: string
  title: string
  category: DocCategory
  version: number
  updatedAt: Date
  updatedByName: string
}

export async function listDocs(appId: string, query: string): Promise<DocListRow[]> {
  const q = query.trim().slice(0, 100)
  const editor = alias(users, 'doc_editor')
  const rows = await db
    .select({
      id: liveDocs.id,
      title: liveDocs.title,
      category: liveDocs.category,
      version: liveDocs.version,
      updatedAt: liveDocs.updatedAt,
      updatedByName: editor.name,
    })
    .from(liveDocs)
    .leftJoin(editor, eq(editor.id, liveDocs.updatedBy))
    .where(
      and(
        eq(liveDocs.appId, appId),
        q ? or(ilike(liveDocs.title, likePattern(q)), ilike(liveDocs.body, likePattern(q))) : undefined,
      ),
    )
    .orderBy(desc(liveDocs.updatedAt))
    .limit(DOC_LIST_LIMIT)
  return rows.map((r) => ({ ...r, updatedByName: r.updatedByName ?? 'Unknown' }))
}

/** Pages per category, for the hub's sidebar. Unfiltered by the search box on purpose. */
export async function countDocsByCategory(appId: string): Promise<Record<DocCategory, number>> {
  const rows = await db
    .select({ category: liveDocs.category, n: count() })
    .from(liveDocs)
    .where(eq(liveDocs.appId, appId))
    .groupBy(liveDocs.category)
  const counts = Object.fromEntries(DOC_CATEGORIES.map((c) => [c, 0])) as Record<DocCategory, number>
  for (const row of rows) counts[row.category] = row.n
  return counts
}

export type DocDetail = {
  id: string
  appId: string
  title: string
  category: DocCategory
  body: string
  version: number
  createdBy: string
  createdByName: string
  updatedByName: string
  createdAt: Date
  updatedAt: Date
}

export async function getDoc(appId: string, docId: string): Promise<DocDetail | null> {
  if (!isUuid(docId)) return null
  const creator = alias(users, 'doc_creator')
  const editor = alias(users, 'doc_editor')
  const [row] = await db
    .select({
      id: liveDocs.id,
      appId: liveDocs.appId,
      title: liveDocs.title,
      category: liveDocs.category,
      body: liveDocs.body,
      version: liveDocs.version,
      createdBy: liveDocs.createdBy,
      createdByName: creator.name,
      updatedByName: editor.name,
      createdAt: liveDocs.createdAt,
      updatedAt: liveDocs.updatedAt,
    })
    .from(liveDocs)
    .leftJoin(creator, eq(creator.id, liveDocs.createdBy))
    .leftJoin(editor, eq(editor.id, liveDocs.updatedBy))
    .where(and(eq(liveDocs.id, docId), eq(liveDocs.appId, appId)))
    .limit(1)
  if (!row) return null
  return { ...row, createdByName: row.createdByName ?? 'Unknown', updatedByName: row.updatedByName ?? 'Unknown' }
}

export type DocRevisionRow = {
  version: number
  title: string
  summary: string | null
  authorName: string
  createdAt: Date
  added: number
  removed: number
}

/**
 * Newest first, with +/− line counts against the revision before. The counts
 * use quickLineStats (a line multiset difference), not the LCS diff: the full
 * diff is O(n·m) per pair and this list can hold two hundred pairs; the exact
 * diff is reserved for the one pair somebody opens in Compare.
 */
export async function listRevisions(docId: string): Promise<DocRevisionRow[]> {
  const rows = await db
    .select({
      version: docRevisions.version,
      title: docRevisions.title,
      body: docRevisions.body,
      summary: docRevisions.summary,
      authorName: users.name,
      createdAt: docRevisions.createdAt,
    })
    .from(docRevisions)
    .innerJoin(liveDocs, eq(liveDocs.id, docRevisions.docId))
    .leftJoin(users, eq(users.id, docRevisions.authorId))
    .where(eq(docRevisions.docId, docId))
    .orderBy(desc(docRevisions.version))
    .limit(REVISION_LIMIT)
  return rows.map((row, index) => {
    const previous = rows[index + 1]
    const stats = quickLineStats(previous ? previous.body : '', row.body)
    return {
      version: row.version,
      title: row.title,
      summary: row.summary,
      authorName: row.authorName ?? 'Unknown',
      createdAt: row.createdAt,
      added: stats.added,
      removed: stats.removed,
    }
  })
}

export type DocRevisionContent = { version: number; title: string; body: string; authorName: string; createdAt: Date }

/** Two revisions of one live doc, for Compare. Null when either is missing. */
export async function getRevisionPair(
  docId: string,
  from: number,
  to: number,
): Promise<{ from: DocRevisionContent; to: DocRevisionContent } | null> {
  const rows = await db
    .select({
      version: docRevisions.version,
      title: docRevisions.title,
      body: docRevisions.body,
      authorName: users.name,
      createdAt: docRevisions.createdAt,
    })
    .from(docRevisions)
    .innerJoin(liveDocs, eq(liveDocs.id, docRevisions.docId))
    .leftJoin(users, eq(users.id, docRevisions.authorId))
    .where(and(eq(docRevisions.docId, docId), inArray(docRevisions.version, [from, to])))
  const byVersion = new Map(rows.map((r) => [r.version, { ...r, authorName: r.authorName ?? 'Unknown' }]))
  const a = byVersion.get(from)
  const b = byVersion.get(to)
  return a && b ? { from: a, to: b } : null
}

export type DocCommentRow = {
  id: string
  body: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  createdAt: Date
}

export async function listDocComments(docId: string): Promise<DocCommentRow[]> {
  const rows = await db
    .select({
      id: docComments.id,
      body: docComments.body,
      authorId: docComments.authorId,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      createdAt: docComments.createdAt,
    })
    .from(docComments)
    .innerJoin(liveDocs, eq(liveDocs.id, docComments.docId))
    .leftJoin(users, eq(users.id, docComments.authorId))
    .where(eq(docComments.docId, docId))
    // Newest last — a conversation reads top to bottom; id breaks ties.
    .orderBy(asc(docComments.createdAt), asc(docComments.id))
  return rows.map((r) => ({ ...r, authorName: r.authorName ?? 'Unknown' }))
}

export type DocLinkedItem = {
  linkId: string
  type: 'task' | 'bug'
  id: string
  /** "LOG-12" for a task; null for a bug. */
  key: string | null
  title: string
  status: string
  href: string
}

/**
 * Work items linked to this page, in either direction. work_links has no FKs
 * on its ends, so each far end is resolved through its live subquery AND this
 * project: a trashed task, or one moved to another project, drops out here.
 */
export async function listDocLinks(appId: string, appSlug: string, docId: string): Promise<DocLinkedItem[]> {
  const rows = await db
    .select({
      id: workLinks.id,
      fromType: workLinks.fromType,
      fromId: workLinks.fromId,
      toType: workLinks.toType,
      toId: workLinks.toId,
    })
    .from(workLinks)
    .where(
      or(
        and(eq(workLinks.fromType, 'doc'), eq(workLinks.fromId, docId)),
        and(eq(workLinks.toType, 'doc'), eq(workLinks.toId, docId)),
      ),
    )
    .orderBy(desc(workLinks.createdAt))
    .limit(LINK_LIMIT)

  const ends = rows.map((r) =>
    r.fromType === 'doc' && r.fromId === docId
      ? { linkId: r.id, type: r.toType, id: r.toId }
      : { linkId: r.id, type: r.fromType, id: r.fromId },
  )
  const taskIds = ends.filter((e) => e.type === 'task').map((e) => e.id)
  const bugIds = ends.filter((e) => e.type === 'bug').map((e) => e.id)

  const [taskRows, bugRows, app] = await Promise.all([
    taskIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: liveTasks.id,
            title: liveTasks.title,
            status: liveTasks.status,
            number: liveTasks.number,
            sprintId: liveTasks.sprintId,
          })
          .from(liveTasks)
          .where(and(inArray(liveTasks.id, taskIds), eq(liveTasks.appId, appId))),
    bugIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: liveBugReports.id, title: liveBugReports.title, status: liveBugReports.status })
          .from(liveBugReports)
          .where(and(inArray(liveBugReports.id, bugIds), eq(liveBugReports.appId, appId))),
    appKey(appId),
  ])
  const tasks = new Map(taskRows.map((t) => [t.id, t]))
  const bugs = new Map(bugRows.map((b) => [b.id, b]))

  const out: DocLinkedItem[] = []
  for (const end of ends) {
    if (end.type === 'task') {
      const t = tasks.get(end.id)
      if (!t) continue
      out.push({
        linkId: end.linkId,
        type: 'task',
        id: t.id,
        key: app && t.number != null ? formatTaskKey(app, t.number) : null,
        title: t.title,
        status: t.status,
        href: taskBoardHref(appSlug, t.sprintId, t.title),
      })
    } else if (end.type === 'bug') {
      const b = bugs.get(end.id)
      if (!b) continue
      out.push({ linkId: end.linkId, type: 'bug', id: b.id, key: null, title: b.title, status: b.status, href: `/apps/${appSlug}?tab=bugs` })
    }
  }
  return out
}

export type DocAttachmentRow = { id: string; name: string; mime: string; bytes: number; uploadedBy: string; uploaderName: string; createdAt: Date; href: string }

export async function listDocAttachments(docId: string): Promise<DocAttachmentRow[]> {
  const rows = await db
    .select({
      id: liveAttachments.id,
      name: liveAttachments.name,
      mime: liveAttachments.mime,
      bytes: liveAttachments.bytes,
      uploadedBy: liveAttachments.uploadedBy,
      uploaderName: users.name,
      createdAt: liveAttachments.createdAt,
    })
    .from(liveAttachments)
    .leftJoin(users, eq(users.id, liveAttachments.uploadedBy))
    .where(and(eq(liveAttachments.ownerType, 'doc'), eq(liveAttachments.ownerId, docId)))
    .orderBy(asc(liveAttachments.createdAt))
  return rows.map((r) => ({ ...r, uploaderName: r.uploaderName ?? 'Unknown', href: attachmentHref(r.id) }))
}

async function appKey(appId: string) {
  const [app] = await db
    .select({ key: liveApps.key, number: liveApps.number })
    .from(liveApps)
    .where(eq(liveApps.id, appId))
    .limit(1)
  return app ?? null
}

/**
 * The board has no per-task URL, so a task link opens the plan on the task's
 * own sprint (or the backlog) filtered by its title — the board's `q` filter
 * matches titles, not keys.
 */
function taskBoardHref(slug: string, sprintId: string | null, title: string): string {
  const params = new URLSearchParams({ tab: 'roadmap', sprint: sprintId ?? 'backlog', q: title.slice(0, 80) })
  return `/apps/${slug}?${params.toString()}`
}

/**
 * Board links for the task keys a page mentions. Only keys naming THIS
 * project and a live task in it resolve; the rest stay plain text.
 */
export async function resolveTaskKeyLinks(
  appId: string,
  appSlug: string,
  keys: readonly string[],
): Promise<Record<string, string>> {
  if (keys.length === 0) return {}
  const app = await appKey(appId)
  if (!app) return {}
  const ownKey = appKeyFor(app)
  const numbers = new Map<number, string>()
  for (const key of keys) {
    const parsed = parseTaskKey(key)
    if (parsed && parsed.appKey === ownKey) numbers.set(parsed.number, key)
  }
  if (numbers.size === 0) return {}
  const rows = await db
    .select({ number: liveTasks.number, title: liveTasks.title, sprintId: liveTasks.sprintId })
    .from(liveTasks)
    .where(and(eq(liveTasks.appId, appId), inArray(liveTasks.number, [...numbers.keys()])))
  const out: Record<string, string> = {}
  for (const row of rows) {
    const key = row.number != null ? numbers.get(row.number) : undefined
    if (key) out[key] = taskBoardHref(appSlug, row.sprintId, row.title)
  }
  return out
}
