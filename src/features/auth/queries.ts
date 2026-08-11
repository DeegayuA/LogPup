import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

/**
 * The signed-in user's own contact number. Read from the row rather than the
 * session because the JWT is not re-minted when a user edits their profile.
 */
export async function getOwnPhone(userId: string): Promise<string | null> {
  const [row] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, userId))
  return row?.phone ?? null
}

/**
 * The signed-in user's own avatar. Read from the row, not the session: the JWT
 * carries whatever the picture was when the token was minted, so an upload
 * would keep showing the old image until the next sign-in.
 */
export async function getOwnAvatarUrl(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
  return row?.avatarUrl ?? null
}

/**
 * The signed-in user's own job role (users.title) — read from the row, not
 * the session/JWT, for the same reason as getOwnAvatarUrl: setOwnTitle
 * doesn't re-mint the token, so the session copy would go stale immediately.
 */
export async function getOwnTitle(userId: string): Promise<string | null> {
  const [row] = await db.select({ title: users.title }).from(users).where(eq(users.id, userId))
  return row?.title ?? null
}
