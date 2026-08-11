'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { AtSign, Bell, CalendarPlus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { markAllNotificationsRead } from '@/features/notifications/actions'
import type { NotificationItem } from '@/features/notifications/queries'
import { cn } from '@/lib/utils'

export function NotificationBellClient({
  items,
  unread,
}: {
  items: NotificationItem[]
  unread: number
}) {
  const [, startTransition] = useTransition()
  const [seen, setSeen] = useState(false)
  const badge = seen ? 0 : unread

  function handleOpenChange(open: boolean) {
    if (open && unread > 0 && !seen) {
      setSeen(true)
      startTransition(() => {
        markAllNotificationsRead()
      })
    }
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <button
            aria-label={badge > 0 ? `Notifications, ${badge} unread` : 'Notifications'}
            className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Bell className="size-5" aria-hidden />
            {badge > 0 ? (
              <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {badge > 9 ? '9+' : badge}
              </span>
            ) : null}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2 text-sm font-medium">Notifications</div>
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {items.map((n) => {
              const Icon = n.type === 'mention' ? AtSign : CalendarPlus
              const body = (
                <div className="flex items-start gap-2.5 px-3 py-2">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm leading-snug', !n.read && 'font-medium')}>{n.title}</p>
                    {n.body ? (
                      <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read ? (
                    <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </div>
              )
              return (
                <li key={n.id} className="hover:bg-accent/60">
                  {n.link ? (
                    <Link href={n.link} className="block">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
