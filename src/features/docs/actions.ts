'use server'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { attachments, docComments, docRevisions, docs, users, workLinks } from '@/db/schema'
import { liveApps, liveAttachments, liveDocs, liveTasks } from '@/db/live'
import { auth } from '@/lib/auth'
import { requireCapability } from '@/features/auth/actor'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { createNotifications, extractMentionedUserIds } from '@/features/notifications/notify'
import { appViewers } from '@/features/sprints/app-viewers'
import { likePattern } from '@/features/search/registry/limits'
import { appKeyFor, formatTaskKey, parseTaskKey } from '@/features/sprints/task-key'
import { DOC_BODY_MAX, DOC_CATEGORIES, DOC_SUMMARY_MAX, DOC_TITLE_MAX } from '@/features/docs/docs'

/**
 * Writes behind the Docs tab (PRD Module C).
 *
 * THE appId NEVER COMES FROM THE CLIENT except on create, where it is the
 * thing being asked about and is checked against a live project. Every other
 * action takes a doc, comment or link id and derives the project from the
 * live row, so a forged request cannot buy a capability check against a
 * project the page is not in.
 *
 * OPTIMISTIC CONCURRENCY, because pages are long-lived and edited by several
 * people: the editor sends the version it started from. The update is
 * conditional on that version, and the revision row is inserted by an
 * INSERT … SELECT that only finds the page if THIS update bumped it — both in
 * one db.batch (neon-http has no interactive transaction; a batch is one).
 * doc_revisions' unique (doc_id, version) is the backstop for a race between
 * two saves from the same person, and maps to the same "someone else saved"
 * sentence.
 *
 * Never throws: every path returns err() so a transport-level failure is the
 * only rejection a caller's transition can see.
 */

const idSchema = z.uuid()
const titleSchema = z.string().trim().min(1, 'Give the page a title').max(DOC_TITLE_MAX, 'The title is too long')
const bodySchema = z.string().max(DOC_BODY_MAX, 'The page is too long — split it into two pages')
const categorySchema = z.enum(DOC_CATEGORIES, { error: 'Choose a category' })
const summarySchema = z.string().trim().max(DOC_SUMMARY_MAX, 'Keep the change note short').optional()
const commentSchema = z.string().trim().min(1, 'Write something first').max(4000, 'Comment is too long')

const createInput = z.object({ appId: idSchema, title: titleSchema, category: categorySchema, body: bodySchema })
const updateInput = z.object({
  docId: idSchema,
  title: titleSchema,
  category: categorySchema,
  body: bodySchema,
  summary: summarySchema,
  baseVersion: z.number().int().min(1),
})

const STALE = 'Someone else saved this page — reload to see their changes'

function unexpected(where: string, error: unknown): ActionResult<never> {
  console.error(`[docs] ${where} failed:`, error)
  return err('Something went wrong — try again')
}

/** Walks `.cause` for a Postgres unique violation (same ten lines as links-actions.ts). */
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

type DocContext = {
  id: string
  appId: string
  title: string
  category: string
  body: string
  version: number
  createdBy: string
  appName: string
  appSlug: string
}

/** The live doc plus its live project; a page in a trashed project is as gone as a trashed page. */
async function docContext(docId: string): Promise<DocContext | null> {
  const [row] = await db
    .select({
      id: liveDocs.id,
      appId: liveDocs.appId,
      title: liveDocs.title,
      category: liveDocs.category,
      body: liveDocs.body,
      version: liveDocs.version,
      createdBy: liveDocs.createdBy,
      appName: liveApps.name,
      appSlug: liveApps.slug,
    })
    .from(liveDocs)
    .innerJoin(liveApps, eq(liveApps.id, liveDocs.appId))
    .where(eq(liveDocs.id, docId))
    .limit(1)
  return row ?? null
}

const docPath = (slug: string, docId?: string) => `/apps/${slug}?tab=docs${docId ? `&doc=${docId}` : ''}`

function revalidateDocs(slug: string) {
  revalidatePath(`/apps/${slug}`)
}

/**
 * The page write shared by updateDoc and restoreRevision. Returns the new
 * version, null when the page moved under the caller, or 'unchanged'.
 */
async function writeRevision(
  doc: DocContext,
  actorId: string,
  next: { title: string; category: DocContext['category']; body: string; summary: string | null },
  baseVersion: number,
): Promise<number | null> {
  const newVersion = baseVersion + 1
  const now = new Date()
  try {
    const [updated] = await db.batch([
      db
        .update(docs)
        .set({
          title: next.title,
          category: next.category as (typeof DOC_CATEGORIES)[number],
          body: next.body,
          version: newVersion,
          updatedBy: actorId,
          updatedAt: now,
        })
        .where(and(eq(docs.id, doc.id), eq(docs.version, baseVersion), isNull(docs.deletedAt)))
        .returning({ id: docs.id }),
      // Copies the page AS STORED by the statement above, and finds it only
      // if that statement bumped it to newVersion for this author — a stale
      // or trashed page inserts nothing. Raw SQL because it is a write-path
      // INSERT … SELECT on the row just updated, not a read of the table.
      db.execute(sql`
        insert into ${docRevisions} (doc_id, version, title, body, summary, author_id)
        select d.id, d.version, d.title, d.body, ${next.summary}::text, d.updated_by
        from ${docs} d
        where d.id = ${doc.id} and d.version = ${newVersion} and d.updated_by = ${actorId}
          and d.deleted_at is null
      `),
    ])
    return updated.length === 0 ? null : newVersion
  } catch (error) {
    if (isUniqueViolation(error)) return null
    throw error
  }
}

export async function createDoc(input: {
  appId: string
  title: string
  category: string
  body: string
}): Promise<ActionResult<{ docId: string }>> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  const parsed = createInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { appId, title, category, body } = parsed.data

  try {
    const [app] = await db
      .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug })
      .from(liveApps)
      .where(eq(liveApps.id, appId))
      .limit(1)
    if (!app) return err('Project not found')
    const actor = await requireCapability('task.create', { appId: app.id })
    if (!actor) return err('Not allowed')

    // The id is minted here so the page and its revision 1 land in ONE batch.
    const docId = randomUUID()
    await db.batch([
      db.insert(docs).values({
        id: docId,
        appId: app.id,
        title,
        category,
        body,
        version: 1,
        createdBy: actor.id,
        updatedBy: actor.id,
      }),
      db.insert(docRevisions).values({ docId, version: 1, title, body, summary: 'Created the page', authorId: actor.id }),
    ])

    await logActivity({
      actorId: actor.id,
      verb: 'created',
      entityType: 'doc',
      entityId: docId,
      entityLabel: title,
      appId: app.id,
      appName: app.name,
      pagePath: docPath(app.slug, docId),
    })
    revalidateDocs(app.slug)
    return ok({ docId })
  } catch (error) {
    return unexpected('createDoc', error)
  }
}

export async function updateDoc(input: {
  docId: string
  title: string
  category: string
  body: string
  summary?: string
  baseVersion: number
}): Promise<ActionResult<{ version: number; changed: boolean }>> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  const parsed = updateInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { docId, title, category, body, summary, baseVersion } = parsed.data

  try {
    const doc = await docContext(docId)
    if (!doc) return err('Page not found')
    const actor = await requireCapability('task.create', { appId: doc.appId })
    if (!actor) return err('Not allowed')
    if (doc.version !== baseVersion) return err(STALE)
    // Nothing changed: no revision, so History lists only real edits.
    if (doc.title === title && doc.category === category && doc.body === body) {
      return ok({ version: doc.version, changed: false })
    }

    const version = await writeRevision(doc, actor.id, { title, category, body, summary: summary || null }, baseVersion)
    if (version === null) return err(STALE)

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'doc',
      entityId: doc.id,
      entityLabel: title,
      appId: doc.appId,
      appName: doc.appName,
      pagePath: docPath(doc.appSlug, doc.id),
      detail: summary ? summary : `saved version ${version}`,
      metadata: { version },
    })
    revalidateDocs(doc.appSlug)
    return ok({ version, changed: true })
  } catch (error) {
    return unexpected('updateDoc', error)
  }
}

/** History is never rewritten: restoring version N writes a NEW revision holding N's content. */
export async function restoreRevision(input: { docId: string; version: number }): Promise<ActionResult<{ version: number }>> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (!idSchema.safeParse(input?.docId).success) return err('Page not found')
  if (!Number.isInteger(input.version) || input.version < 1) return err('Version not found')

  try {
    const doc = await docContext(input.docId)
    if (!doc) return err('Page not found')
    const actor = await requireCapability('task.create', { appId: doc.appId })
    if (!actor) return err('Not allowed')

    const [revision] = await db
      .select({ title: docRevisions.title, body: docRevisions.body })
      .from(docRevisions)
      .where(and(eq(docRevisions.docId, doc.id), eq(docRevisions.version, input.version)))
      .limit(1)
    if (!revision) return err('Version not found')
    if (revision.title === doc.title && revision.body === doc.body) return err('The page already matches that version')

    const version = await writeRevision(
      doc,
      actor.id,
      { title: revision.title, category: doc.category, body: revision.body, summary: `Restored version ${input.version}` },
      doc.version,
    )
    if (version === null) return err(STALE)

    await logActivity({
      actorId: actor.id,
      verb: 'restored',
      entityType: 'doc',
      entityId: doc.id,
      entityLabel: revision.title,
      appId: doc.appId,
      appName: doc.appName,
      pagePath: docPath(doc.appSlug, doc.id),
      detail: `version ${input.version} as version ${version}`,
      metadata: { from: input.version, version },
    })
    revalidateDocs(doc.appSlug)
    return ok({ version })
  } catch (error) {
    return unexpected('restoreRevision', error)
  }
}

/**
 * Soft delete — docs is in SOFT_TABLES, so the page goes to the admin Trash.
 * Its creator may remove it while they can still write pages here; anybody
 * else needs sprint.manage (the project's PM/lead).
 */
export async function deleteDoc(docId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (!idSchema.safeParse(docId).success) return err('Page not found')

  try {
    const doc = await docContext(docId)
    if (!doc) return err('Page not found')
    const creator = doc.createdBy === session.user.id
      ? await requireCapability('task.create', { appId: doc.appId })
      : null
    const actor = creator ?? (await requireCapability('sprint.manage', { appId: doc.appId }))
    if (!actor) return err('Only the page’s author or the project lead can delete it')

    const marked = await db
      .update(docs)
      .set({ deletedAt: new Date(), deletedBy: actor.id })
      .where(and(eq(docs.id, doc.id), isNull(docs.deletedAt)))
      .returning({ id: docs.id })
    if (marked.length === 0) return err('Page not found')

    await logActivity({
      actorId: actor.id,
      verb: 'deleted',
      entityType: 'doc',
      entityId: doc.id,
      entityLabel: doc.title,
      appId: doc.appId,
      appName: doc.appName,
      pagePath: docPath(doc.appSlug),
    })
    revalidateDocs(doc.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('deleteDoc', error)
  }
}

export async function addDocComment(
  docId: string,
  body: string,
): Promise<ActionResult<{ mentionCount: number }>> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (!idSchema.safeParse(docId).success) return err('Page not found')
  const parsed = commentSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const text = parsed.data

  try {
    const doc = await docContext(docId)
    if (!doc) return err('Page not found')
    const actor = await requireCapability('task.comment', { appId: doc.appId })
    if (!actor) return err('Not allowed')

    await db.insert(docComments).values({ docId: doc.id, authorId: actor.id, body: text })

    await logActivity({
      actorId: actor.id,
      verb: 'commented',
      entityType: 'doc',
      entityId: doc.id,
      entityLabel: doc.title,
      appId: doc.appId,
      appName: doc.appName,
      pagePath: docPath(doc.appSlug, doc.id),
      detail: text.length > 60 ? `${text.slice(0, 59)}…` : text,
    })

    // Best effort and separately caught: the comment is saved; a lost
    // notification must not report it as failed. The pool is the project's
    // own viewers (appViewers), so naming an outsider notifies nobody.
    let mentionCount = 0
    try {
      const pool = await appViewers(doc.appId)
      const ids = extractMentionedUserIds(text, pool).filter((id) => id !== actor.id)
      if (ids.length > 0) {
        const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, actor.id))
        const delivered = await createNotifications(
          ids.map((userId) => ({
            userId,
            actorId: actor.id,
            type: 'mention' as const,
            title: `${me?.name ?? 'Someone'} mentioned you on “${doc.title}”`,
            body: `In ${doc.appName} docs`,
            link: docPath(doc.appSlug, doc.id),
            entity: { type: 'app', id: doc.appId },
            visibility: { action: 'app.view' as const, resource: { appId: doc.appId } },
          })),
        )
        mentionCount = delivered.length
      }
    } catch (error) {
      console.error('[docs] comment mentions failed:', error)
    }

    revalidateDocs(doc.appSlug)
    return ok({ mentionCount })
  } catch (error) {
    return unexpected('addDocComment', error)
  }
}

/**
 * A hard delete: doc_comments has no deletedAt (the page is the soft-deleted
 * thing and cascades). The author withdraws their own words under the same
 * gate as posting; anybody else needs sprint.manage.
 */
export async function deleteDocComment(commentId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (!idSchema.safeParse(commentId).success) return err('Comment not found')

  try {
    const [comment] = await db
      .select({ id: docComments.id, docId: docComments.docId, authorId: docComments.authorId })
      .from(docComments)
      .innerJoin(liveDocs, eq(liveDocs.id, docComments.docId))
      .where(eq(docComments.id, commentId))
      .limit(1)
    if (!comment) return err('Comment not found')
    const doc = await docContext(comment.docId)
    if (!doc) return err('Comment not found')

    const author = comment.authorId === session.user.id
      ? await requireCapability('task.comment', { appId: doc.appId })
      : null
    const actor = author ?? (await requireCapability('sprint.manage', { appId: doc.appId }))
    if (!actor) return err('Not allowed')

    await db.delete(docComments).where(eq(docComments.id, comment.id))

    if (!author) {
      await logActivity({
        actorId: actor.id,
        verb: 'deleted',
        entityType: 'comment',
        entityId: comment.id,
        entityLabel: doc.title,
        appId: doc.appId,
        appName: doc.appName,
        pagePath: docPath(doc.appSlug, doc.id),
        detail: 'Removed a comment on this page',
      })
    }
    revalidateDocs(doc.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('deleteDocComment', error)
  }
}

/**
 * "This page documents LOG-12": a work_links row doc → task, kind
 * 'documents'. Same project only — the row is filed under the doc's appId.
 */
export async function linkDocToTask(docId: string, taskId: string): Promise<ActionResult<{ linkId: string }>> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (!idSchema.safeParse(docId).success) return err('Page not found')
  if (!idSchema.safeParse(taskId).success) return err('Task not found')

  try {
    const doc = await docContext(docId)
    if (!doc) return err('Page not found')
    const actor = await requireCapability('task.create', { appId: doc.appId })
    if (!actor) return err('Not allowed')

    const [task] = await db
      .select({ id: liveTasks.id, title: liveTasks.title })
      .from(liveTasks)
      .where(and(eq(liveTasks.id, taskId), eq(liveTasks.appId, doc.appId)))
      .limit(1)
    if (!task) return err('That task is not in this project')

    let linkId: string
    try {
      const [row] = await db
        .insert(workLinks)
        .values({
          appId: doc.appId,
          fromType: 'doc',
          fromId: doc.id,
          toType: 'task',
          toId: task.id,
          kind: 'documents',
          createdBy: actor.id,
        })
        .returning({ id: workLinks.id })
      linkId = row.id
    } catch (error) {
      if (isUniqueViolation(error)) return err('That task is already linked')
      throw error
    }

    await logActivity({
      actorId: actor.id,
      verb: 'linked',
      entityType: 'doc',
      entityId: doc.id,
      entityLabel: doc.title,
      appId: doc.appId,
      appName: doc.appName,
      pagePath: docPath(doc.appSlug, doc.id),
      detail: `documents task "${task.title}"`,
      metadata: { linkId, taskId: task.id },
    })
    revalidateDocs(doc.appSlug)
    return ok({ linkId })
  } catch (error) {
    return unexpected('linkDocToTask', error)
  }
}

/** Removes one link that has this page at either end. work_links has no deletedAt. */
export async function unlinkDoc(docId: string, linkId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (!idSchema.safeParse(docId).success) return err('Page not found')
  if (!idSchema.safeParse(linkId).success) return err('Link not found')

  try {
    const doc = await docContext(docId)
    if (!doc) return err('Page not found')
    const actor = await requireCapability('task.create', { appId: doc.appId })
    if (!actor) return err('Not allowed')

    const removed = await db
      .delete(workLinks)
      .where(
        and(
          eq(workLinks.id, linkId),
          eq(workLinks.appId, doc.appId),
          sql`((${workLinks.fromType} = 'doc' and ${workLinks.fromId} = ${doc.id}) or (${workLinks.toType} = 'doc' and ${workLinks.toId} = ${doc.id}))`,
        ),
      )
      .returning({ id: workLinks.id })
    if (removed.length === 0) return err('Link not found')

    await logActivity({
      actorId: actor.id,
      verb: 'unlinked',
      entityType: 'doc',
      entityId: doc.id,
      entityLabel: doc.title,
      appId: doc.appId,
      appName: doc.appName,
      pagePath: docPath(doc.appSlug, doc.id),
      metadata: { linkId },
    })
    revalidateDocs(doc.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('unlinkDoc', error)
  }
}

/**
 * Soft delete of a file on a page (attachments is in SOFT_TABLES). Its
 * uploader may remove it while they can still write pages here; anybody else
 * needs sprint.manage. A Markdown reference to it in the page simply stops
 * resolving — the download route answers 404 for a trashed file.
 */
export async function deleteDocAttachment(attachmentId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (!idSchema.safeParse(attachmentId).success) return err('File not found')

  try {
    const [row] = await db
      .select({
        ownerType: liveAttachments.ownerType,
        ownerId: liveAttachments.ownerId,
        name: liveAttachments.name,
        uploadedBy: liveAttachments.uploadedBy,
      })
      .from(liveAttachments)
      .where(eq(liveAttachments.id, attachmentId))
      .limit(1)
    if (!row || row.ownerType !== 'doc') return err('File not found')
    const doc = await docContext(row.ownerId)
    if (!doc) return err('File not found')

    const uploader = row.uploadedBy === session.user.id
      ? await requireCapability('task.create', { appId: doc.appId })
      : null
    const actor = uploader ?? (await requireCapability('sprint.manage', { appId: doc.appId }))
    if (!actor) return err('You can’t remove this file')

    await db
      .update(attachments)
      .set({ deletedAt: new Date(), deletedBy: actor.id })
      .where(and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt)))

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'doc',
      entityId: doc.id,
      entityLabel: doc.title,
      appId: doc.appId,
      appName: doc.appName,
      pagePath: docPath(doc.appSlug, doc.id),
      detail: `removed file ${row.name}`,
      metadata: { attachmentId },
    })
    revalidateDocs(doc.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('deleteDocAttachment', error)
  }
}

/** Up to 10 live tasks in the page's project matching a title fragment, for the link picker. */
export async function searchDocLinkTargets(
  docId: string,
  query: string,
): Promise<ActionResult<{ id: string; key: string | null; title: string }[]>> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (!idSchema.safeParse(docId).success) return err('Page not found')
  const q = typeof query === 'string' ? query.trim().slice(0, 100) : ''
  if (q === '') return ok([])

  try {
    const doc = await docContext(docId)
    if (!doc) return err('Page not found')
    if (!(await requireCapability('app.view', { appId: doc.appId }))) return err('Not allowed')
    const [app] = await db
      .select({ key: liveApps.key, number: liveApps.number })
      .from(liveApps)
      .where(eq(liveApps.id, doc.appId))
      .limit(1)
    // A key only counts when it names THIS project, as in links-actions.ts.
    const parsedKey = parseTaskKey(q)
    const keyNumber = parsedKey && app && parsedKey.appKey === appKeyFor(app) ? parsedKey.number : null
    const rows = await db
      .select({ id: liveTasks.id, title: liveTasks.title, number: liveTasks.number })
      .from(liveTasks)
      .where(
        and(
          eq(liveTasks.appId, doc.appId),
          keyNumber === null
            ? ilike(liveTasks.title, likePattern(q))
            : or(ilike(liveTasks.title, likePattern(q)), eq(liveTasks.number, keyNumber)),
        ),
      )
      .orderBy(desc(liveTasks.number))
      .limit(10)
    return ok(
      rows.map((r) => ({
        id: r.id,
        key: app && r.number != null ? formatTaskKey(app, r.number) : null,
        title: r.title,
      })),
    )
  } catch (error) {
    return unexpected('searchDocLinkTargets', error)
  }
}
