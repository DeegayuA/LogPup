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
