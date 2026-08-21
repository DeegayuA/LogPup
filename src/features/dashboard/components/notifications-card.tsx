import Link from 'next/link'
import { formatDistance } from 'date-fns'
import { AtSign, Bell, CalendarPlus, PawPrint, Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { NotificationItem } from '@/features/notifications/queries'
import { cn } from '@/lib/utils'

const ICONS: Record<NotificationItem['type'], typeof AtSign> = {
  mention: AtSign,
  meeting: CalendarPlus,
  system: Wrench,
}

/**
 * What pinged you — the same items as the header bell, on the page you
 * actually start the day from. Read-only on purpose: opening the bell is
 * what marks things read (see notification-bell-client.tsx), and duplicating
 * that mutation here would race it for no benefit. Unread rows are simply
 * bolder, with unreadness carried in words for screen readers.
 */
function RowBody({ item, now }: { item: NotificationItem; now: Date }) {
  // Keyed lookup, not a ternary — see the note in notification-bell-client.tsx:
  // the two-arm form quietly gave every non-mention kind a calendar icon.
  const Icon = ICONS[item.type] ?? CalendarPlus
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
          {/* formatDistance against the zone's injected `now`, NOT
              formatDistanceToNow: the grid-mate RecentActivityCard counts back
              from an injected clock, and two "ago" conventions on one page can
              visibly disagree about the same minute. */}
          {formatDistance(item.createdAt, now, { addSuffix: true })}
        </span>
      </span>
    </>
  )
}

export function NotificationsCard({
  items,
  now,
}: {
  items: NotificationItem[]
  /** Passed in so every relative timestamp on the page agrees on "ago". */
  now: Date
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3" className="flex items-center gap-2">
          <Bell className="size-4" aria-hidden /> Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title="All caught up."
            description="Mentions and meeting invites land here on their own — nothing to do."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="py-2">
                {item.link ? (
                  <Link
                    href={item.link}
                    className="flex items-start gap-2.5 rounded-md outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <RowBody item={item} now={now} />
                  </Link>
                ) : (
                  <span className="flex items-start gap-2.5">
                    <RowBody item={item} now={now} />
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
