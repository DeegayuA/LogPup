'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import {
  listNotifications,
  unreadNotificationCount,
  type NotificationItem,
} from '@/features/notifications/queries'

export type NotificationSnapshot = { items: NotificationItem[]; unread: number }

/**
 * What the header bell polls (see hooks/use-smart-poll.ts).
 *
 * Notifications are the one thing in LogPup that arrives without the viewer
 * doing anything — a mention or a meeting invite lands because someone else
 * acted. Every other surface can wait for a navigation to refresh; a bell that
 * only updates when you happen to click elsewhere is not a bell.
 *
 * Deliberately the smallest possible read rather than a route refresh: two
 * indexed queries scoped to the caller's own rows, no RSC re-render of the
 * page behind it, and no way for a caller to point it at anyone else's
 * notifications. A signed-out poll returns an empty snapshot rather than an
 * error — the bell is not worth an error toast.
 */
export async function fetchNotificationSnapshot(): Promise<NotificationSnapshot> {
  const session = await auth()
  if (!session?.user?.id) return { items: [], unread: 0 }
  const [items, unread] = await Promise.all([
    listNotifications(session.user.id, 20),
    unreadNotificationCount(session.user.id),
  ])
  return { items, unread }
}

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
