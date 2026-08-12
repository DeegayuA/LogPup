import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { AtSign, Bell, CalendarPlus, PawPrint } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { NotificationItem } from '@/features/notifications/queries'
import { cn } from '@/lib/utils'

/**
 * What pinged you — the same items as the header bell, on the page you
 * actually start the day from. Read-only on purpose: opening the bell is
 * what marks things read (see notification-bell-client.tsx), and duplicating
 * that mutation here would race it for no benefit. Unread rows are simply
 * bolder, with unreadness carried in words for screen readers.
 */
function RowBody({ item }: { item: NotificationItem }) {
  const Icon = item.type === 'mention' ? AtSign : CalendarPlus
  return (
    <>
      <Icon
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          item.read ? 'text-muted-foreground/60' : 'text-chart-1',
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'truncate text-sm leading-snug',
            item.read ? 'text-muted-foreground' : 'font-medium',
          )}
        >
          {!item.read ? <span className="sr-only">Unread: </span> : null}
          {item.title}
        </span>
        {item.body ? (
          <span className="truncate text-xs text-muted-foreground">{item.body}</span>
        ) : null}
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatDistanceToNow(item.createdAt, { addSuffix: true })}
        </span>
      </span>
    </>
  )
}

export function NotificationsCard({ items }: { items: NotificationItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4" aria-hidden /> Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <PawPrint className="size-5 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">All caught up.</p>
            <p className="text-xs text-muted-foreground">
              Mentions and meeting invites land here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="py-2">
                {item.link ? (
                  <Link href={item.link} className="flex items-start gap-2.5 hover:opacity-80">
                    <RowBody item={item} />
                  </Link>
                ) : (
                  <span className="flex items-start gap-2.5">
                    <RowBody item={item} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
