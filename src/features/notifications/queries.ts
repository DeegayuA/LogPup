import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { notifications, users } from '@/db/schema'

export type NotificationItem = {
  id: string
  type: 'mention' | 'meeting'
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: Date
  actorName: string | null
  actorAvatarUrl: string | null
}

export async function listNotifications(userId: string, limit = 20): Promise<NotificationItem[]> {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      read: notifications.read,
      createdAt: notifications.createdAt,
      actorName: users.name,
      actorAvatarUrl: users.avatarUrl,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
  return row?.value ?? 0
}
