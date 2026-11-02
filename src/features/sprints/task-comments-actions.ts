'use server'

import { z } from 'zod'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { taskComments, users } from '@/db/schema'
import { liveApps, liveTaskComments, liveTasks } from '@/db/live'
import { requireCapability } from '@/features/auth/actor'
import { appViewers } from '@/features/sprints/app-viewers'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { extractMentionedUserIds, recordMentions } from '@/features/notifications/notify'

/**
 * The discussion on ONE task (PRD Module A "Comments").
 *
 * THE appId NEVER COMES FROM THE CLIENT. Every action takes a task or comment
 * id and derives the project from the live task row, so a forged request can
 * neither read a thread in a project it cannot see nor write one into it. The
 * same read also makes a comment on a trashed task (or a task in a trashed
 * project) "not found" rather than a silent write into the bin.
 *
 * Self-fetched by a client component rather than handed down as props: the
 * thread lives inside the task dialog, which is opened from boards that load
 * dozens of tasks, and loading every thread for every card to show one would
 * be the wrong trade.
 */

const MAX_COMMENT_LENGTH = 4000

/**
 * Trimmed BEFORE the length check, as in apps/comment-actions.ts: 4000 spaces
 * is "write something first", not "too long".
 */
const bodySchema = z
  .string()
  .trim()
  .min(1, 'Write something first')
  .max(MAX_COMMENT_LENGTH, 'Comment is too long')

/**
 * Ids are parsed before they reach the driver: Postgres rejects
 * `uuid = 'not-a-uuid'` at the type level instead of matching no rows, which
 * turns a mangled id into a REJECTED action (an unhandled promise in the
 * caller's transition) rather than an ordinary err().
 */
const idSchema = z.uuid()

export type TaskComment = {
  id: string
  body: string
  createdAt: Date
  editedAt: Date | null
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  /** The viewer wrote it — the only person who may edit it. */
  mine: boolean
}

export type TaskCommentThread = {
  comments: TaskComment[]
  /** Who the composer offers after "@", and whose "@Name" renders as a link. */
  mentionUsers: { id: string; name: string }[]
  /** For the optimistic row: the composer knows who is typing without a second request. */
  viewer: { id: string; name: string; avatarUrl: string | null }
  /** May delete OTHER people's comments (the task.delete moderator override). */
  canModerate: boolean
  /**
   * May post (task.comment). False for a read-only seat — an auditor, or
   * anyone during a maintenance freeze — so the UI can hide the composer
   * instead of offering a box whose every submit is refused.
   */
  canComment: boolean
}

export type AddedTaskComment = {
  comment: TaskComment
  /**
   * One sentence when somebody named could not be notified, else null.
   * Non-fatal by design — shown beside a save that succeeded (mention-rules.ts).
   */
  mentionAdvisory: string | null
}

type TaskContext = {
  id: string
  appId: string
  title: string
  appName: string
  appSlug: string
}

/**
 * The live task plus its live project, in one read. Inner-joined so a task in
 * a trashed project is as gone as a trashed task.
 */
async function taskContext(taskId: string): Promise<TaskContext | null> {
  const [row] = await db
    .select({
      id: liveTasks.id,
      appId: liveTasks.appId,
      title: liveTasks.title,
      appName: liveApps.name,
      appSlug: liveApps.slug,
    })
    .from(liveTasks)
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(liveTasks.id, taskId))
  return row ?? null
}

async function commentById(commentId: string) {
  const [row] = await db
    .select({
      id: liveTaskComments.id,
      taskId: liveTaskComments.taskId,
      authorId: liveTaskComments.authorId,
      body: liveTaskComments.body,
    })
    .from(liveTaskComments)
    .where(eq(liveTaskComments.id, commentId))
  return row ?? null
}

/**
 * The mention pool: the approved, active people who can open THIS project.
 *
 * It used to be every approved person in the workspace, so that naming
 * somebody outside the project would be reported back rather than silently
 * unoffered. But the pool is handed to every viewer of the thread — a
 * stakeholder seat included — and a client seat must not be able to read the
 * studio's whole directory out of a comment box (user.view.directory is
 * 'none' for stakeholder). Limited to app.view's own answer (appViewers), so
 * the composer offers exactly the people a mention can reach.
 */
async function mentionPool(appId: string) {
  return appViewers(appId)
}

/**
 * Notify whoever a body names. Uses the mentions LEDGER (recordMentions), not
 * a bare createNotifications as the older app-comment action does: the
 * ledger's unique index is what makes an edited comment notify nobody twice,
 * and it reports undeliverable names back to the author.
 *
 * Source 'task' with the TASK id, not the comment id: the bell row's entity
 * must resolve to something the notification page can open, and
 * entityKindForSource('task') is 'task'. The cost is that the ledger's
 * once-per-(source, person) guarantee is per TASK — a second comment naming
 * the same person on the same task records nothing new. A dedicated
 * 'task_comment' source would lift that, but needs its own entity mapping.
 */
async function notifyMentions(
  task: TaskContext,
  body: string,
  actorId: string,
): Promise<string | null> {
  try {
    const pool = await mentionPool(task.appId)
    const ids = new Set(extractMentionedUserIds(body, pool))
    if (ids.size === 0) return null
    const result = await recordMentions({
      source: 'task',
      sourceId: task.id,
      sourceLabel: task.title,
      actorId,
      appId: task.appId,
      mentioned: pool.filter((person) => ids.has(person.id)).map((person) => ({
        userId: person.id,
        name: person.name,
      })),
      link: `/apps/${task.appSlug}`,
    })
    return result.advisory
  } catch (error) {
    // The comment is already saved; a lost notification must not report the
    // comment itself as failed.
    console.error('[sprints] task comment mentions failed:', error)
    return null
  }
}

function unexpected(where: string, error: unknown): ActionResult<never> {
  console.error(`[sprints] ${where} failed:`, error)
  return err('Something went wrong — try again')
}

export async function listTaskComments(taskId: string): Promise<ActionResult<TaskCommentThread>> {
  if (!idSchema.safeParse(taskId).success) return err('Task not found')
  try {
    const task = await taskContext(taskId)
    if (!task) return err('Task not found')
    // Same answer for "no such task" and "not yours to see" would be kinder to
    // privacy, but every other task action says 'Not allowed' after the read,
    // and the dialog that calls this has already shown the task.
    const actor = await requireCapability('app.view', { appId: task.appId })
    if (!actor) return err('Not allowed')
    const [moderator, commenter] = await Promise.all([
      requireCapability('task.delete', { appId: task.appId }),
      requireCapability('task.comment', { appId: task.appId }),
    ])

    const [rows, pool, viewerRows] = await Promise.all([
      db
        .select({
          id: liveTaskComments.id,
          body: liveTaskComments.body,
          createdAt: liveTaskComments.createdAt,
          editedAt: liveTaskComments.editedAt,
          authorId: liveTaskComments.authorId,
          authorName: users.name,
          authorAvatarUrl: users.avatarUrl,
        })
        .from(liveTaskComments)
        .innerJoin(users, eq(users.id, liveTaskComments.authorId))
        .where(eq(liveTaskComments.taskId, task.id))
        // Newest LAST — a conversation reads top to bottom. id breaks ties so
        // two comments in the same millisecond never swap between fetches.
        .orderBy(asc(liveTaskComments.createdAt), asc(liveTaskComments.id)),
      mentionPool(task.appId),
      db
        .select({ name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, actor.id)),
    ])

    return ok({
      comments: rows.map((row) => ({ ...row, mine: row.authorId === actor.id })),
      mentionUsers: pool,
      viewer: {
        id: actor.id,
        name: viewerRows[0]?.name ?? 'You',
        avatarUrl: viewerRows[0]?.avatarUrl ?? null,
      },
      canModerate: moderator !== null,
      canComment: commenter !== null,
    })
  } catch (error) {
    return unexpected('listTaskComments', error)
  }
}

export async function addTaskComment(
  taskId: string,
  body: string,
): Promise<ActionResult<AddedTaskComment>> {
  if (!idSchema.safeParse(taskId).success) return err('Task not found')
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const text = parsed.data

  try {
    const task = await taskContext(taskId)
    if (!task) return err('Task not found')
    // task.comment, not app.view: app.view is a read, so gating a write on it
    // let the read-only auditor post and walked straight through a
    // maintenance freeze (which never stops a `.view`).
    const actor = await requireCapability('task.comment', { appId: task.appId })
    if (!actor) return err('Not allowed')

    const [created] = await db
      .insert(taskComments)
      .values({ taskId: task.id, authorId: actor.id, body: text })
      .returning({ id: taskComments.id, createdAt: taskComments.createdAt })

    const [author] = await db
      .select({ name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, actor.id))

    await logActivity({
      actorId: actor.id,
      verb: 'commented',
      entityType: 'task',
      entityId: task.id,
      entityLabel: task.title,
      appId: task.appId,
      appName: task.appName,
      pagePath: `/apps/${task.appSlug}`,
      detail: text.length > 60 ? `${text.slice(0, 59)}…` : text,
    })

    const mentionAdvisory = await notifyMentions(task, text, actor.id)

    return ok({
      comment: {
        id: created.id,
        body: text,
        createdAt: created.createdAt,
        editedAt: null,
        authorId: actor.id,
        authorName: author?.name ?? 'You',
        authorAvatarUrl: author?.avatarUrl ?? null,
        mine: true,
      },
      mentionAdvisory,
    })
  } catch (error) {
    return unexpected('addTaskComment', error)
  }
}

export async function editTaskComment(
  commentId: string,
  body: string,
): Promise<ActionResult<{ editedAt: Date; mentionAdvisory: string | null }>> {
  if (!idSchema.safeParse(commentId).success) return err('Comment not found')
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const text = parsed.data

  try {
    const comment = await commentById(commentId)
    if (!comment) return err('Comment not found')
    const task = await taskContext(comment.taskId)
    if (!task) return err('Comment not found')
    // The write gate first: somebody moved off the project (or into a
    // read-only seat, or behind a freeze) keeps authorship of what they wrote
    // but loses the right to rewrite it there.
    const actor = await requireCapability('task.comment', { appId: task.appId })
    if (!actor) return err('Not allowed')
    // Author only, with no moderator override. Putting words in somebody
    // else's mouth is not moderation; deleting is.
    if (comment.authorId !== actor.id) return err('Only the author can edit a comment')

    const editedAt = new Date()
    const updated = await db
      .update(taskComments)
      .set({ body: text, editedAt })
      .where(and(eq(taskComments.id, comment.id), isNull(taskComments.deletedAt)))
      .returning({ id: taskComments.id })
    // Trashed between the read and the write.
    if (updated.length === 0) return err('Comment not found')

    // Safe to re-run on every edit: the ledger's unique index notifies a
    // person once, so only a name ADDED by this edit reaches anyone.
    const mentionAdvisory = await notifyMentions(task, text, actor.id)
    return ok({ editedAt, mentionAdvisory })
  } catch (error) {
    return unexpected('editTaskComment', error)
  }
}

export async function deleteTaskComment(commentId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(commentId).success) return err('Comment not found')

  try {
    const comment = await commentById(commentId)
    if (!comment) return err('Comment not found')
    const task = await taskContext(comment.taskId)
    if (!task) return err('Comment not found')

    // An author withdraws their own words under the same write gate as posting
    // them; anybody else needs the task.delete moderator override below.
    const viewer = await requireCapability('task.comment', { appId: task.appId })
    const isAuthor = viewer !== null && viewer.id === comment.authorId
    // The moderator override is asked only when it is needed, so an author
    // deleting their own words never pays for the scope read.
    const actor = isAuthor ? viewer : await requireCapability('task.delete', { appId: task.appId })
    if (!actor) return err('Not allowed')

    // SOFT delete — task_comments is in SOFT_TABLES, so the row goes to the
    // admin Trash rather than away (live.test.ts check 4 forbids db.delete).
    const marked = await db
      .update(taskComments)
      .set({ deletedAt: new Date(), deletedBy: actor.id })
      .where(and(eq(taskComments.id, comment.id), isNull(taskComments.deletedAt)))
      .returning({ id: taskComments.id })
    if (marked.length === 0) return err('Comment not found')

    // Only a moderator removing somebody ELSE's words is worth a trail row: it
    // is the one delete the author did not choose and may later ask about.
    // entityType 'comment' (the comment's id), not 'task': "deleted <task>"
    // in the feed would read as the task itself being binned.
    if (!isAuthor) {
      await logActivity({
        actorId: actor.id,
        verb: 'deleted',
        entityType: 'comment',
        entityId: comment.id,
        entityLabel: task.title,
        appId: task.appId,
        appName: task.appName,
        pagePath: `/apps/${task.appSlug}`,
        detail: 'Removed a comment on this task',
      })
    }
    return ok(undefined)
  } catch (error) {
    return unexpected('deleteTaskComment', error)
  }
}
