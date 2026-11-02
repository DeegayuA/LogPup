import { randomUUID } from 'node:crypto'
import { del, put } from '@vercel/blob'
import { and, count, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { canAccessApp } from '@/lib/access-gate'
import { db } from '@/db'
import { attachments } from '@/db/schema'
import { liveApps, liveAttachments, liveTasks } from '@/db/live'
import { requireCapability } from '@/features/auth/actor'
import { logActivity } from '@/features/activity/log'
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TASK,
  SNIFF_BYTES,
  checkAttachmentMeta,
  formatBytes,
  isUuid,
  sanitizeFileName,
  sniffMatches,
} from '@/features/sprints/attachments'

/**
 * Upload one file onto a task.
 *
 * A route handler rather than a server action because the client needs a
 * plain HTTP status to branch on (413 vs 415 vs 503) and because server
 * actions carry a 1 MB body limit by default that would need raising
 * app-wide to fit a MAX_ATTACHMENT_BYTES file.
 *
 * Every refusal is JSON `{ error }` — the client renders the sentence as is.
 * src/proxy.ts EXCLUDES /api/attachments from its matcher, so this route owns
 * every refusal, signed-out included: a 307 to the HTML sign-in page is not
 * something a fetch() can branch on. Hence the full gate below — session,
 * deactivation, and approval (canAccessApp), the same trio the .ics route
 * checks for the same reason.
 *
 * WHAT THIS DOES NOT TRUST: the task's app (read from the task row), the
 * filename (sanitised for display, never part of the storage path), the
 * declared type (cross-checked against the extension, then replaced by our
 * canonical type) or the bytes (sniffed). The blob store is PRIVATE — the same
 * store holds encrypted DB backups — and the blob URL never leaves the server;
 * downloads go through /api/attachments/<id>.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.active === false) return fail('Not signed in', 401)
  // A pending signup holds a real session (to reach /pending) but no access to
  // the workspace; the proxy's pending gate never runs for /api.
  if (!canAccessApp(session.user.status ?? 'pending', session.user.active)) return fail('Not signed in', 401)
  const userId = session.user.id

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return fail('File storage is not configured — set BLOB_READ_WRITE_TOKEN to enable attachments', 503)
  }

  // Refuse an oversized body BEFORE formData() buffers it into memory. A
  // missing length is refused too: without it formData() would read a
  // chunked body of any size before the File's own size check below ever
  // ran. Browsers always send one for a FormData fetch, so only a hand-made
  // request lands here. The slack covers the multipart boundaries and the
  // taskId field. The header can still lie low; the File size check below
  // stays as the backstop.
  const declaredLength = Number(request.headers.get('content-length'))
  if (
    !request.headers.has('content-length') ||
    !Number.isFinite(declaredLength) ||
    declaredLength > MAX_ATTACHMENT_BYTES + MULTIPART_SLACK_BYTES
  ) {
    return fail(`That file is too large — the limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}`, 413)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail('Expected a multipart form with taskId and file', 400)
  }
  const taskId = form.get('taskId')
  const file = form.get('file')
  if (!isUuid(taskId) || !(file instanceof File)) return fail('Expected a multipart form with taskId and file', 400)

  // Inner-joined to liveApps: a task in a trashed project is read-only, like
  // the project itself.
  const [task] = await db
    .select({ id: liveTasks.id, appId: liveTasks.appId, assigneeId: liveTasks.assigneeId, title: liveTasks.title })
    .from(liveTasks)
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(liveTasks.id, taskId))
    .limit(1)
  // Not found and not allowed answer identically, so the endpoint cannot be
  // used to probe which task ids exist.
  if (!task) return fail('Task not found', 404)
  const actor = await requireCapability('task.edit', { appId: task.appId, ownerId: task.assigneeId })
  if (!actor) return fail('Task not found', 404)

  const meta = checkAttachmentMeta({ name: file.name, type: file.type, size: file.size })
  if (!meta.ok) return fail(meta.error, meta.status)

  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())
  if (!sniffMatches(meta.ext, head)) {
    return fail(`That file's contents don't look like a .${meta.ext} file`, 415)
  }

  // Counted before the upload, so two simultaneous uploads at 19 can both
  // land (21). Accepted: the cap is about keeping a task readable, not a
  // quota anybody is billed against, and a transaction is not available on
  // neon-http.
  const [{ n }] = await db
    .select({ n: count() })
    .from(liveAttachments)
    .where(and(eq(liveAttachments.ownerType, 'task'), eq(liveAttachments.ownerId, task.id)))
  if (n >= MAX_ATTACHMENTS_PER_TASK) {
    return fail(`A task can hold ${MAX_ATTACHMENTS_PER_TASK} attachments — remove one first`, 409)
  }

  const name = sanitizeFileName(file.name)
  // Random, and nothing user-typed in it: a filename in the path would let a
  // name collide with or traverse onto another object, and would leak the
  // name into storage logs.
  const blobPath = `attachments/${task.appId}/${randomUUID()}`
  try {
    await put(blobPath, file, { access: 'private', addRandomSuffix: false, contentType: meta.mime })
  } catch (error) {
    console.error('[attachments] blob put failed', error)
    return fail('Upload failed — try again', 502)
  }

  let created: { id: string; createdAt: Date } | undefined
  try {
    const rows = await db
      .insert(attachments)
      .values({
        appId: task.appId,
        ownerType: 'task',
        ownerId: task.id,
        blobPath,
        name,
        mime: meta.mime,
        bytes: file.size,
        uploadedBy: userId,
      })
      .returning({ id: attachments.id, createdAt: attachments.createdAt })
    created = rows[0]
  } catch (error) {
    console.error('[attachments] insert failed', error)
  }
  if (!created) {
    // No row points at the blob, so nothing could ever serve or delete it.
    await del(blobPath).catch(() => undefined)
    return fail('Upload failed — try again', 500)
  }

  await logActivity({
    actorId: userId,
    verb: 'updated',
    entityType: 'task',
    entityId: task.id,
    entityLabel: task.title,
    appId: task.appId,
    detail: `attached ${name}`,
    metadata: { attachmentId: created.id, bytes: file.size, mime: meta.mime },
  })

  return Response.json(
    { id: created.id, name, mime: meta.mime, bytes: file.size, createdAt: created.createdAt },
    { status: 201 },
  )
}

/** Multipart framing plus the taskId field — generous, but bounded. */
const MULTIPART_SLACK_BYTES = 64 * 1024

function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}
