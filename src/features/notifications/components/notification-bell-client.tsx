'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { AtSign, Bell, CalendarPlus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  fetchNotificationSnapshot,
  markAllNotificationsRead,
  type NotificationSnapshot,
} from '@/features/notifications/actions'
import type { NotificationItem } from '@/features/notifications/queries'
import { useSmartPoll } from '@/hooks/use-smart-poll'
import { cn } from '@/lib/utils'

/**
 * Two identities per snapshot, and nothing else, decide "did anything change":
 * the unread count and the newest notification's id. Comparing the objects
 * themselves would report a change on every poll (each server-action response
 * is a fresh array), which would pin the backoff at its fastest cadence
 * forever and defeat the whole point.
 */
function sameSnapshot(a: NotificationSnapshot, b: NotificationSnapshot): boolean {
  return a.unread === b.unread && a.items[0]?.id === b.items[0]?.id
}

const POLL_BASE_MS = 20_000
const POLL_MAX_MS = 5 * 60_000

export function NotificationBellClient({
  items,
  unread,
}: {
  items: NotificationItem[]
  unread: number
}) {
  const [, startTransition] = useTransition()
  /**
   * OPTIMISTIC UPDATE for "I've seen these".
   *
   * Opening the panel is the acknowledgement — the badge has to clear on that
   * click, not a round trip later. This used to be a `seen` boolean that
   * forced the badge to zero, which was fine while the only source of truth
   * was a page load, but is wrong the moment polling exists: a poll landing
   * mid-flight would either resurrect a badge the user just cleared, or (if
   * `seen` kept winning) hide a genuinely new mention behind it.
   *
   * Holding a whole optimistic snapshot instead keeps one story on screen:
   * everything reads as read and the count is zero, immediately. It is plain
   * state rather than `useOptimistic` for the same reason
   * sprints/components/roadmap-timeline.tsx gives — a `useOptimistic` overlay
   * is dropped the instant its transition settles, which here would mean the
   * badge flicking back to its old value in the gap before the next poll
   * confirms the write. This overlay is superseded rather than dropped: the
   * next poll or navigation replaces it with the server's own answer.
   */
  const [acknowledged, setAcknowledged] = useState<NotificationSnapshot | null>(null)

  /**
   * SMART POLLING — a mention should land in the bell without a navigation.
   *
   * Server-rendered props alone mean the bell is only ever as fresh as the
   * last page load: someone @-mentions you and you find out whenever you
   * happen to click something else. Polling fixes that, but a naive
   * `setInterval` would trade one bad behaviour for a worse one — a constant
   * request rate that ignores whether anyone is even looking at the tab.
   *
   * `useSmartPoll` starts at 20s while things are moving, doubles its way out
   * to 5 minutes across a quiet afternoon, stops entirely on a hidden tab or
   * a dropped connection, and catches up immediately on the way back. The
   * request it makes is two indexed queries, not a route refresh.
   */
  const initial = useMemo<NotificationSnapshot>(
    () => acknowledged ?? { items, unread },
    [acknowledged, items, unread],
  )
  const poll = useCallback(() => fetchNotificationSnapshot(), [])
  const snapshot = useSmartPoll(poll, initial, {
    baseMs: POLL_BASE_MS,
    maxMs: POLL_MAX_MS,
    isEqual: sameSnapshot,
  })

  const liveItems = snapshot.items
  const badge = snapshot.unread

  function handleOpenChange(open: boolean) {
    if (open && snapshot.unread > 0) {
      setAcknowledged({
        items: snapshot.items.map((item) => (item.read ? item : { ...item, read: true })),
        unread: 0,
      })
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
        {liveItems.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1">
            {liveItems.map((n) => {
              const Icon = n.type === 'mention' ? AtSign : CalendarPlus
              const inner = (
                <>
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
                </>
              )
              // A notification with a link becomes a real navigating menu item
              // (closes the menu, routes to its source); one without stays inert.
              return n.link ? (
                <DropdownMenuItem
                  key={n.id}
                  render={<Link href={n.link} />}
                  className="cursor-pointer items-start gap-2.5 px-3 py-2"
                >
                  {inner}
                </DropdownMenuItem>
              ) : (
                <div key={n.id} className="flex items-start gap-2.5 px-3 py-2">
                  {inner}
                </div>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
