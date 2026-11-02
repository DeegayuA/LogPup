'use server'

import { and, asc, eq, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { attachments, users } from '@/db/schema'
import { liveApps, liveAttachments, liveTasks } from '@/db/live'
import { requireCapability } from '@/features/auth/actor'
import { logActivity } from '@/features/activity/log'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { attachmentHref, isUuid } from '@/features/sprints/attachments'

// Reading and removing task attachments. Uploading is the route handler at
// src/app/api/attachments/route.ts (it needs a raw multipart body and HTTP
// statuses); downloading is /api/attachments/[id].
//
// blobPath is NEVER selected into anything returned from here. The store is
// private, and the only way to a file is the download route, which re-checks
// access on every request — a blob path in the client would be a capability
// that outlives the permission that granted it.
//
// Every task read inner-joins liveApps on the task's own appId: a task in a
// trashed project is as gone as a trashed task, so its files can be neither
// listed nor removed (removing would be a write into the bin), the same rule
// task-comments-actions.ts applies.

export type TaskAttachment = {
  id: string
  name: string
  mime: string
  bytes: number
  uploaderName: string
  createdAt: Date
  /** The viewer uploaded it. */
  mine: boolean
  /** The viewer may remove it: their own upload, or they hold task.delete. */
  canDelete: boolean
  href: string
}

export async function listTaskAttachments(taskId: string): Promise<ActionResult<TaskAttachment[]>> {
  const session = await auth()
  if (!session?.user?.id) return err('Not signed in')
  if (!isUuid(taskId)) return err('Task not found')

  const [task] = await db
    .select({ appId: liveTasks.appId })
    .from(liveTasks)
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(liveTasks.id, taskId))
    .limit(1)
  if (!task) return err('Task not found')
  const viewer = await requireCapability('app.view', { appId: task.appId })
  if (!viewer) return err('Task not found')

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
    .where(and(eq(liveAttachments.ownerType, 'task'), eq(liveAttachments.ownerId, taskId)))
    .orderBy(asc(liveAttachments.createdAt))

  // Asked once for the list rather than per row: the answer does not depend
  // on the row, and each call can cost a scope query.
  const deletesAny = rows.some((r) => r.uploadedBy !== viewer.id)
    ? (await requireCapability('task.delete', { appId: task.appId })) !== null
    : false

  return ok(
    rows.map((r) => {
      const mine = r.uploadedBy === viewer.id
      return {
        id: r.id,
        name: r.name,
        mime: r.mime,
        bytes: r.bytes,
        uploaderName: r.uploaderName ?? 'Unknown user',
        createdAt: r.createdAt,
        mine,
        canDelete: mine || deletesAny,
        href: attachmentHref(r.id),
      }
    }),
  )
}

/**
 * Soft delete: deletedAt/deletedBy, blob kept, so the admin Trash can restore
 * it like every other soft-deleted row.
 *
 * The uploader removes their own file under `task.edit` with themselves as
 * owner — the file is theirs in the same sense a task assigned to them is —
 * which still refuses a deactivated account, a seat without task.edit, and a
 * write during a maintenance freeze. Anybody else needs `task.delete` on the
 * app, the same bar as removing the task itself.
 */
export async function deleteTaskAttachment(id: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Not signed in')
  if (!isUuid(id)) return err('Attachment not found')

  const [row] = await db
    .select({
      appId: liveAttachments.appId,
      ownerType: liveAttachments.ownerType,
      ownerId: liveAttachments.ownerId,
      name: liveAttachments.name,
      uploadedBy: liveAttachments.uploadedBy,
    })
    .from(liveAttachments)
    .where(eq(liveAttachments.id, id))
    .limit(1)
  if (!row || row.ownerType !== 'task') return err('Attachment not found')

  // Visibility BEFORE the uploader shortcut. task.edit at 'own' is decided
  // from ownerId alone, so without this somebody taken off the project could
  // still remove files they once uploaded to it.
  if (!(await requireCapability('app.view', { appId: row.appId }))) return err('Attachment not found')

  const actor =
    row.uploadedBy === session.user.id
      ? await requireCapability('task.edit', { appId: row.appId, ownerId: session.user.id })
      : await requireCapability('task.delete', { appId: row.appId })
  if (!actor) return err("You can't remove this attachment")

  const [task] = await db
    .select({ title: liveTasks.title })
    .from(liveTasks)
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(liveTasks.id, row.ownerId))
    .limit(1)
  if (!task) return err('Attachment not found')

  // isNull guard: a double-click must not move deletedAt/deletedBy to the
  // second click's values.
  await db
    .update(attachments)
    .set({ deletedAt: new Date(), deletedBy: actor.id })
    .where(and(eq(attachments.id, id), isNull(attachments.deletedAt)))

  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'task',
    entityId: row.ownerId,
    entityLabel: task.title,
    appId: row.appId,
    detail: `removed attachment ${row.name}`,
    metadata: { attachmentId: id },
  })
  return ok(undefined)
}
