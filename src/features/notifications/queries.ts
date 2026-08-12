import { cache } from 'react'
import { and, count, desc, eq, isNotNull, isNull, or } from 'drizzle-orm'
import { db } from '@/db'
import { liveMeetings } from '@/db/live'
import { notifications, users } from '@/db/schema'

// A notification's meetingId is nullable (mentions never carry one; meeting
// invites/moves do) — so a trashed meeting must hide only the notifications
// tied to it, never the ones that were never about a meeting at all. Left
// joining liveMeetings and requiring "no meetingId at all" OR "the meeting
// it names is still live" is what keeps both halves true at once.
const notificationMeetingIsLiveOrAbsent = or(
  isNull(notifications.meetingId),
  isNotNull(liveMeetings.id),
)

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

/**
 * Both wrapped in React `cache` — per-request deduplication, not caching in the
 * stale-data sense (see lib/session.ts for the same reasoning applied to the
 * session read). The header bell renders in the (app) layout while the
 * dashboard renders its own notifications card, so a single dashboard load
 * asks for this user's unread count twice; with the page split across
 * `<Suspense>` boundaries the same list can be requested from more than one
 * streamed section. Memoised, the first caller in a render pays and the rest
 * are free. Nothing survives the request, so no viewer can be served another's
 * notifications.
 *
 * `limit` is part of the memo key: the bell asks for 20 and the dashboard card
 * for 8, so those stay two reads — matching them up is a caller-side decision,
 * not something to fake here.
 */
export const listNotifications = cache(async function listNotifications(
  userId: string,
  limit = 20,
): Promise<NotificationItem[]> {
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
    .leftJoin(liveMeetings, eq(notifications.meetingId, liveMeetings.id))
    .where(and(eq(notifications.userId, userId), notificationMeetingIsLiveOrAbsent))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
})

export const unreadNotificationCount = cache(async function unreadNotificationCount(
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .leftJoin(liveMeetings, eq(notifications.meetingId, liveMeetings.id))
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.read, false),
        notificationMeetingIsLiveOrAbsent,
      ),
    )
  return row?.value ?? 0
})
