'use server'

import { del, put } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'

// The client resizes to a 512px square WebP before uploading (see
// avatar-upload.tsx), so anything approaching this cap is either a client that
// skipped the resize or a hand-crafted request.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/webp', 'image/png', 'image/jpeg']

// Uploads live in a PRIVATE blob store (the same store holds encrypted DB
// backups, so it must never be public). avatarUrl therefore holds our own
// proxy path rather than a blob URL: /api/avatar/<pathname>. The route streams
// the object to signed-in users only, and every existing <img src={avatarUrl}>
// keeps working untouched.
const AVATAR_PROXY_PREFIX = '/api/avatar/'

/** Best-effort cleanup of a replaced avatar; never fails the new upload. */
async function deleteUploadedAvatar(avatarUrl: string | null): Promise<void> {
  if (!avatarUrl?.startsWith(AVATAR_PROXY_PREFIX)) return
  const pathname = decodeURIComponent(avatarUrl.slice(AVATAR_PROXY_PREFIX.length))
  try {
    await del(pathname)
  } catch {
    /* Already gone, or the token lost access — the new avatar still stands. */
  }
}

export async function uploadOwnAvatar(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const session = await auth()
  if (!session?.user?.id) return err('Not signed in')

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return err('Image storage is not configured — set BLOB_READ_WRITE_TOKEN to enable uploads')
  }

  const file = formData.get('avatar')
  if (!(file instanceof File) || file.size === 0) return err('No image received')
  if (!ALLOWED_TYPES.includes(file.type)) return err('Use a PNG, JPEG or WebP image')
  if (file.size > MAX_AVATAR_BYTES) return err('Image is too large — keep it under 2MB')

  const [current] = await db
    .select({ avatarUrl: users.avatarUrl, name: users.name })
    .from(users)
    .where(eq(users.id, session.user.id))

  let url: string
  try {
    // addRandomSuffix gives each upload its own pathname, so a replaced avatar
    // can never be served from a cached copy of the old one.
    const blob = await put(`avatars/${session.user.id}.webp`, file, {
      access: 'private',
      addRandomSuffix: true,
      contentType: file.type,
    })
    url = AVATAR_PROXY_PREFIX + encodeURIComponent(blob.pathname)
  } catch {
    return err('Upload failed — try again')
  }

  await db.update(users).set({ avatarUrl: url }).where(eq(users.id, session.user.id))
  await deleteUploadedAvatar(current?.avatarUrl ?? null)
  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'user',
    entityId: session.user.id,
    entityLabel: current?.name ?? session.user.name ?? 'Unknown user',
    pagePath: `/people/${session.user.id}`,
    detail: 'avatar',
  })

  revalidatePath('/profile')
  revalidatePath('/people')
  revalidatePath('/', 'layout')
  return ok({ url })
}

export async function removeOwnAvatar(): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Not signed in')

  const [current] = await db
    .select({ avatarUrl: users.avatarUrl, name: users.name })
    .from(users)
    .where(eq(users.id, session.user.id))

  await db.update(users).set({ avatarUrl: null }).where(eq(users.id, session.user.id))
  await deleteUploadedAvatar(current?.avatarUrl ?? null)
  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'user',
    entityId: session.user.id,
    entityLabel: current?.name ?? session.user.name ?? 'Unknown user',
    pagePath: `/people/${session.user.id}`,
    detail: 'avatar',
  })

  revalidatePath('/profile')
  revalidatePath('/people')
  revalidatePath('/', 'layout')
  return ok(undefined)
}
