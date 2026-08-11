import { auth } from '@/lib/auth'
import { listNotifications, unreadNotificationCount } from '@/features/notifications/queries'
import { NotificationBellClient } from '@/features/notifications/components/notification-bell-client'

export async function NotificationBell() {
  const session = await auth()
  if (!session?.user?.id) return null

  const [items, unread] = await Promise.all([
    listNotifications(session.user.id, 20),
    unreadNotificationCount(session.user.id),
  ])

  return <NotificationBellClient items={items} unread={unread} />
}
