'use server'

import { del, put } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'

// The client resizes to a 512px square WebP before uploading (see
// avatar-upload.tsx), so anything approaching this cap is either a client that
// skipped the resize or a hand-crafted request.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/webp', 'image/png', 'image/jpeg']

/** Best-effort cleanup of a replaced avatar; never fails the new upload. */
async function deleteIfBlob(url: string | null): Promise<void> {
  if (!url?.includes('.blob.vercel-storage.com')) return
  try {
    await del(url)
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
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, session.user.id))

  let url: string
  try {
    // addRandomSuffix keeps the URL unguessable and avoids the CDN serving a
    // stale avatar from a reused path.
    const blob = await put(`avatars/${session.user.id}.webp`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    })
    url = blob.url
  } catch {
    return err('Upload failed — try again')
  }

  await db.update(users).set({ avatarUrl: url }).where(eq(users.id, session.user.id))
  await deleteIfBlob(current?.avatarUrl ?? null)

  revalidatePath('/profile')
  revalidatePath('/people')
  revalidatePath('/', 'layout')
  return ok({ url })
}

export async function removeOwnAvatar(): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Not signed in')

  const [current] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, session.user.id))

  await db.update(users).set({ avatarUrl: null }).where(eq(users.id, session.user.id))
  await deleteIfBlob(current?.avatarUrl ?? null)

  revalidatePath('/profile')
  revalidatePath('/people')
  revalidatePath('/', 'layout')
  return ok(undefined)
}
