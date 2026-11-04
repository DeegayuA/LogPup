import 'server-only'

import { randomUUID } from 'node:crypto'
import { del, put } from '@vercel/blob'
import { db } from '@/db'
import { attachments, channelMembers, messages } from '@/db/schema'
import { loadActor } from '@/features/auth/actor'
import { SNIFF_BYTES, checkAttachmentMeta, sanitizeFileName, sniffMatches } from '@/features/sprints/attachments'
import { loadChannelAccess } from './access'
import { UPLOAD_WINDOW_MS, fileMessageBody, uploadLimitError } from './rules'
import { getMessageRow, recentUploadCount } from './queries'

/**
 * Share one file into a conversation: the /api/attachments POST hands the
 * multipart body here when it carries `channelId` (after its own session,
 * approval and size gates). The file becomes its OWN message, whose body is
 * a Markdown link (or image) to /api/attachments/<id> — so it renders,
 * threads, reacts and deletes like any other message.
 *
 * The message and the attachment row land in ONE db.batch with ids minted
 * here, so there is never a message pointing at a missing file or a file no
 * message shows. owner_type 'message', owner_id = the message.
 *
 * EVERY CONVERSATION: a DM or group has no project, so its files carry
 * app_id NULL (allowed for owner_type 'message' only, migration 0084) and
 * live under attachments/chat/<channel>/ in the store. The download route
 * gates them on canReadMessageFile alone — membership, not app.view.
 *
 * RATE LIMITED per person per conversation (UPLOAD_LIMIT_PER_HOUR), counted
 * from the attachment rows themselves before the blob is written — no new
 * column, and a refused upload costs no storage. A soft cap: two uploads in
 * the same instant can both pass the count, which overshoots by one, never
 * by a flood.
 */
export async function uploadChatFile(input: { channelId: string; file: File; userId: string }): Promise<Response> {
  const actor = await loadActor()
  if (!actor || actor.id !== input.userId) return fail('Not signed in', 401)
  const ch = await loadChannelAccess(actor, input.channelId)
  if (!ch || !ch.perms.read) return fail('Conversation not found', 404)
  if (!ch.perms.write) return fail('You can read this conversation but not post in it', 403)

  const file = input.file
  const meta = checkAttachmentMeta({ name: file.name, type: file.type, size: file.size })
  if (!meta.ok) return fail(meta.error, meta.status)
  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())
  if (!sniffMatches(meta.ext, head)) return fail(`That file's contents don't look like a .${meta.ext} file`, 415)

  let recent: number
  try {
    recent = await recentUploadCount(ch.id, actor.id, new Date(Date.now() - UPLOAD_WINDOW_MS))
  } catch (error) {
    console.error('[chat] upload count failed', error)
    return fail('Upload failed — try again', 500)
  }
  const limited = uploadLimitError(recent)
  if (limited) return fail(limited, 429)

  const name = sanitizeFileName(file.name)
  const blobPath = ch.app ? `attachments/${ch.app.id}/${randomUUID()}` : `attachments/chat/${ch.id}/${randomUUID()}`
  try {
    await put(blobPath, file, { access: 'private', addRandomSuffix: false, contentType: meta.mime })
  } catch (error) {
    console.error('[chat] blob put failed', error)
    return fail('Upload failed — try again', 502)
  }

  const messageId = randomUUID()
  const attachmentId = randomUUID()
  try {
    await db.batch([
      db.insert(messages).values({
        id: messageId,
        channelId: ch.id,
        authorId: actor.id,
        body: fileMessageBody(attachmentId, name, meta.mime.startsWith('image/')),
      }),
      db.insert(attachments).values({
        id: attachmentId,
        appId: ch.app?.id ?? null,
        ownerType: 'message',
        ownerId: messageId,
        blobPath,
        name,
        mime: meta.mime,
        bytes: file.size,
        uploadedBy: actor.id,
      }),
      db.insert(channelMembers).values({ channelId: ch.id, userId: actor.id }).onConflictDoNothing(),
    ])
  } catch (error) {
    console.error('[chat] file message insert failed', error)
    // Nothing points at the blob, so nothing could ever serve or delete it.
    await del(blobPath).catch(() => undefined)
    return fail('Upload failed — try again', 500)
  }

  return Response.json({ messageId, attachmentId, name, mime: meta.mime }, { status: 201 })
}

/** Download gate: the message is live and the viewer can read its conversation. */
export async function canReadMessageFile(messageId: string): Promise<boolean> {
  const actor = await loadActor()
  if (!actor) return false
  const row = await getMessageRow(messageId)
  if (!row || row.deletedAt) return false
  const ch = await loadChannelAccess(actor, row.channelId)
  return ch?.perms.read === true
}

function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}
