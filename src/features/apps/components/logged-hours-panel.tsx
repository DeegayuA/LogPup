'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAppMonthHours, type AppMonthHours } from '@/features/apps/logged-time-actions'
import { monthLabel, shiftMonth } from '@/features/apps/logged-time'
import { formatHours } from '@/features/worklog/entries'

/**
 * The Hours panel: one month of an app's worklog hours, one figure per
 * person. Month only, no day list — by request, the question is how long each
 * person spent that month. Summed from the worklog at read time, so a day
 * logged this morning is already in it.
 *
 * Months are fetched on demand through `getAppMonthHours`, which re-checks
 * worklog.view server-side, and cached while the popover is open so paging
 * back and forth does not re-ask. The popup unmounts on close (base-ui's
 * keepMounted defaults off), so reopening refetches — fresh figures, by
 * design. Future months are not offered: nobody has logged them, and an
 * empty page there reads as a bug.
 */
export function LoggedHoursPanel({
  appId,
  appName,
  currentMonth,
  viewerId,
}: {
  appId: string
  appName: string
  /** `YYYY-MM`, the month the card shows and the panel opens on. */
  currentMonth: string
  viewerId: string | null
}) {
  const [month, setMonth] = useState(currentMonth)
  const [data, setData] = useState<AppMonthHours | null>(null)
  const [error, setError] = useState<string | null>(null)
  // No `isPending`: it stays true while ANY month is in flight, so paging back
  // to a cached month would sit under a skeleton. "Loading" is `!shown`.
  const [, startTransition] = useTransition()
  const cache = useRef(new Map<string, AppMonthHours>())
  // The month the reader is on NOW. A slow reply for a month they already
  // paged away from must not overwrite the one they are looking at.
  const wanted = useRef(currentMonth)

  const fetchMonth = useCallback(
    (target: string) => {
      startTransition(async () => {
        // The action returns its failures, but a dropped connection still
        // rejects — and a rejection inside a transition goes to the error
        // boundary, taking the whole /apps page down over one popover.
        let result: Awaited<ReturnType<typeof getAppMonthHours>>
        try {
          result = await getAppMonthHours({ appId, month: target })
        } catch {
          result = { ok: false, error: 'Could not load hours. Check your connection.' }
        }
        if (result.ok) cache.current.set(target, result.data)
        if (wanted.current !== target) return
        startTransition(() => {
          if (result.ok) setData(result.data)
          else setError(result.error)
        })
      })
    },
    [appId],
  )

  // The panel mounts when the popover opens, so this is "fetch on open".
  useEffect(() => {
    fetchMonth(currentMonth)
  }, [fetchMonth, currentMonth])

  function go(target: string) {
    wanted.current = target
    setMonth(target)
    setError(null)
    const hit = cache.current.get(target)
    if (hit) setData(hit)
    else fetchMonth(target)
  }

  const shown = data && data.month === month ? data : null
  const label = (userId: string, name: string) => (userId === viewerId ? 'You' : name)
  const atLatest = month >= currentMonth
  // One polite announcement per state change, so a screen reader hears the
  // result of paging, not just the new month name.
  const status = error
    ? ''
    : !shown
      ? `Loading hours for ${monthLabel(month)}`
      : shown.people.length === 0
        ? `No hours logged in ${monthLabel(month)}`
        : `${monthLabel(month)}: ${shown.people.length} ${shown.people.length === 1 ? 'person' : 'people'}`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => go(shiftMonth(month, -1))}
          aria-label="Previous month"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <p className="min-w-0 truncate text-center">
          <span className="font-heading font-semibold">{monthLabel(month)}</span>
          <span className="sr-only"> hours on {appName}</span>
        </p>
        <button
          type="button"
          // aria-disabled, not disabled: a disabled button drops the focus it
          // holds to <body>, stranding a keyboard user who just paged here.
          onClick={() => {
            if (!atLatest) go(shiftMonth(month, 1))
          }}
          aria-disabled={atLatest}
          aria-label="Next month"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {shown?.onlyOwn
          ? 'Your own hours only, totalled from each day you logged.'
          : 'Totalled from each day in the work log.'}
      </p>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      {error ? (
        <p role="alert" className="py-4 text-center text-sm text-destructive">
          {error}
        </p>
      ) : !shown ? (
        <ul aria-hidden className="flex flex-col gap-1.5 py-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-2 px-1">
              <span className="size-6 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
              <span className="h-3 flex-1 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <span className="h-3 w-10 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            </li>
          ))}
        </ul>
      ) : shown.people.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {shown.onlyOwn ? 'You logged no hours here' : 'No hours logged'} in {monthLabel(month)}.
        </p>
      ) : (
        <ul className="-mx-1 flex max-h-80 flex-col overflow-y-auto">
          {shown.people.map((p) => (
            <li key={p.userId} className="flex items-center gap-2 rounded-md px-1 py-1">
              {/* Decorative: the name beside it is the label. */}
              <Avatar size="sm" aria-hidden>
                {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                <AvatarFallback>{p.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm">{label(p.userId, p.name)}</span>
              <span className="shrink-0 font-mono text-sm tabular-nums">{formatHours(p.minutes)}h</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
