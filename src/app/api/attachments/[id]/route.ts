import { get } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { canAccessApp } from '@/lib/access-gate'
import { db } from '@/db'
import { liveApps, liveAttachments, liveDocs, liveTasks } from '@/db/live'
import { requireCapability } from '@/features/auth/actor'
import { contentDisposition, isUuid } from '@/features/sprints/attachments'

/**
 * Stream one task attachment out of the PRIVATE blob store.
 *
 * Same proxy shape as /api/avatar and /api/meeting-keyframes: the store also
 * holds encrypted DB backups, so it can never be public, and the blob URL is
 * never handed to a browser. The id is the only thing the client ever sees;
 * blobPath comes from our own row, so this cannot be turned into an open
 * proxy onto other objects in the store.
 *
 * Every refusal — no session, malformed id, unknown id, trashed attachment,
 * trashed task, no access to the app, blob gone — is the SAME 404, so a probe
 * cannot tell "doesn't exist" from "not yours".
 *
 * The headers are the XSS defence for content we did not write:
 * - Content-Type is the canonical type stored at upload, never re-derived;
 * - nosniff stops the browser second-guessing it into text/html;
 * - only images and PDF are inline, everything else downloads;
 * - the CSP sandbox keeps even a mis-rendered response from running script on
 *   our origin. PDF is left out of it because Chrome's viewer refuses to load
 *   inside a sandboxed document, and a PDF is not rendered by our origin's
 *   script engine in the first place.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id || session.user.active === false) return notFound()
  // The proxy excludes /api/attachments (and never pins /api to /pending), so
  // the approval gate is this route's own: a pending signup holds a session
  // but must not read project files.
  if (!canAccessApp(session.user.status ?? 'pending', session.user.active)) return notFound()

  const { id } = await params
  if (!isUuid(id)) return notFound()

  const [row] = await db
    .select({
      appId: liveAttachments.appId,
      ownerType: liveAttachments.ownerType,
      ownerId: liveAttachments.ownerId,
      blobPath: liveAttachments.blobPath,
      name: liveAttachments.name,
      mime: liveAttachments.mime,
    })
    .from(liveAttachments)
    .where(eq(liveAttachments.id, id))
    .limit(1)
  if (!row) return notFound()

  // A chat file in a DM or group has no project (0084), so app.view cannot be
  // its gate; the message branch below is. Every other owner type names one.
  if (row.appId) {
    const actor = await requireCapability('app.view', { appId: row.appId })
    if (!actor) return notFound()
  } else if (row.ownerType !== 'message') {
    return notFound()
  }

  // A trashed task takes its files with it: the task page is gone, so the
  // attachment should be too, until an admin restores the task. Joined to
  // liveApps so a trashed PROJECT does the same for every task in it.
  if (row.ownerType === 'task') {
    const [task] = await db
      .select({ id: liveTasks.id })
      .from(liveTasks)
      .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
      .where(eq(liveTasks.id, row.ownerId))
      .limit(1)
    if (!task) return notFound()
  }
  // A file shared in chat (PRD Module D) is readable exactly when its
  // message's conversation is — a private channel's file is members-only even
  // though app.view above already passed — and a deleted message takes its
  // file with it. Imported lazily so this route's tests never load chat.
  if (row.ownerType === 'message') {
    const { canReadMessageFile } = await import('@/features/chat/chat-upload')
    if (!(await canReadMessageFile(row.ownerId))) return notFound()
  }
  // The same rule for a Docs page: a trashed page (or project) takes its
  // images and files with it until an admin restores it.
  if (row.ownerType === 'doc') {
    const [doc] = await db
      .select({ id: liveDocs.id })
      .from(liveDocs)
      .innerJoin(liveApps, eq(liveApps.id, liveDocs.appId))
      .where(eq(liveDocs.id, row.ownerId))
      .limit(1)
    if (!doc) return notFound()
  }

  let blob: Awaited<ReturnType<typeof get>>
  try {
    blob = await get(row.blobPath, { access: 'private' })
  } catch {
    return notFound()
  }
  if (!blob || blob.statusCode !== 200) return notFound()

  const headers = new Headers({
    'Content-Type': row.mime,
    'Content-Disposition': contentDisposition(row.name, row.mime),
    'X-Content-Type-Options': 'nosniff',
    // Per-user content behind auth, and a soft delete must stop serving it on
    // the next request — so never a shared cache, and not even the browser's.
    'Cache-Control': 'private, no-store',
    'Content-Length': String(blob.blob.size),
  })
  if (row.mime !== 'application/pdf') {
    headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox")
  }

  return new Response(blob.stream, { status: 200, headers })
}

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
}
