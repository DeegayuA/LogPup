import { BellOff } from 'lucide-react'
import { toast } from 'sonner'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * The one notification action that needs no target row: clear the whole
 * unread count. markNotificationRead(id) is per-row and stays on the bell.
 */
export const commands: CommandDescriptor[] = [
  {
    id: 'notifications.mark-all-read',
    label: 'Mark all notifications read',
    keywords: ['clear notifications', 'dismiss all', 'inbox zero', 'unread'],
    group: 'command',
    icon: BellOff,
    run: async ({ close }) => {
      close()
      /* Imported at call time so this module stays pure data at load: a static
         import of a 'use server' module pulls the whole server graph into
         anything that reads the registry, including the node test that guards
         it. */
      const { markAllNotificationsRead } = await import('@/features/notifications/actions')
      const res = await markAllNotificationsRead()
      /* The action revalidates the layout, so the bell's count updates on its
         own; the toast is here because a palette command that changes
         something off-screen is otherwise indistinguishable from one that
         silently failed. */
      if (res.ok) toast.success('Notifications cleared')
      else toast.error(res.error)
    },
  },
]
