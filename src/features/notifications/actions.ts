'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'

// Mark every unread notification for the signed-in user as read. Scoped to the
// caller's own rows — a user can never mutate someone else's notifications.
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)))
  revalidatePath('/', 'layout')
  return ok(undefined)
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, session.user.id)))
  revalidatePath('/', 'layout')
  return ok(undefined)
}
