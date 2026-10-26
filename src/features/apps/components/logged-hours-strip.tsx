'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { LoggedHoursPanel } from '@/features/apps/components/logged-hours-panel'
import { monthLabel, type PersonLoggedTime } from '@/features/apps/logged-time'
import { formatHours } from '@/features/worklog/entries'

/**
 * The card's hours band: EVERY person who logged time on the project THIS
 * MONTH, as a one-row strip you scroll sideways, so all the hours are on the
 * card itself. The label names the month ("Hours · Oct 2026") and opens the
 * month view (logged-hours-panel.tsx): other months, and each person's days.
 *
 * Fixed height on every card. The native scrollbar is hidden because a
 * horizontal bar appears only on cards that overflow, and its ~10px would make
 * those cards taller than their neighbours (app-card.tsx rule 2). The edge fade
 * takes over the "there is more" job, shown only on a side that can scroll.
 *
 * A vertical mouse wheel is turned into sideways scroll, but ONLY while the
 * strip can still move that way; at either end the wheel falls through to the
 * page, so the grid never traps a scroll. A plain React onWheel cannot do
 * this — React registers wheel listeners as passive, so preventDefault is
 * ignored — hence the manual listener.
 *
 * Must sit above the card's stretched-link cover (`relative z-10`), or the
 * cover would swallow the wheel, touch and focus.
 *
 * The list arrives already filtered by worklog.view (logged-time-queries.ts),
 * so a member sees only their own row here; nothing is hidden client-side.
 * `onlyOwn` says the list is that partial view, which changes what an EMPTY
 * list means: "you logged none", never "nobody did".
 */
export function LoggedHoursStrip({
  appId,
  appName,
  month,
  people,
  onlyOwn,
  viewerId,
}: {
  appId: string
  appName: string
  /** `YYYY-MM` the strip's figures cover, named on the label. */
  month: string
  people: PersonLoggedTime[]
  onlyOwn: boolean
  viewerId: string | null
}) {
  const scroller = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth
      const left = el.scrollLeft > 1
      const right = el.scrollLeft < max - 1
      // Same object when nothing changed, so scrolling does not re-render.
      setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
    }
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return // pinch / ctrl+wheel is page zoom
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return // trackpad: native
      const max = el.scrollWidth - el.clientWidth
      const canMove =
        (event.deltaY > 0 && el.scrollLeft < max - 1) || (event.deltaY < 0 && el.scrollLeft > 1)
      if (!canMove) return
      event.preventDefault()
      el.scrollLeft += event.deltaY
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(el)
    // The chips too: a font swap widens the content without resizing the ul.
    for (const chip of Array.from(el.children)) resize.observe(chip)
    el.addEventListener('scroll', measure, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      resize.disconnect()
      el.removeEventListener('scroll', measure)
      el.removeEventListener('wheel', onWheel)
    }
  }, [people])

  // The label IS the door to the panel, on empty cards too — an app with no
  // hours this month may well have had them last month.
  const trigger = (
    <Popover>
      {/* No aria-label: the visible "Hours · Oct 2026" IS the name, so a
          voice-control user saying what they see reaches it. */}
      <PopoverTrigger
        className="-mx-1 flex shrink-0 items-center gap-0.5 rounded-sm px-1 font-medium hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Hours · {monthLabel(month, 'short')}
        <ChevronDown aria-hidden className="size-3" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80" aria-label={`Hours on ${appName}`}>
        {/* Keyed on the month so a page that crosses midnight into a new
            month starts the panel over instead of holding the old one. */}
        <LoggedHoursPanel
          key={month}
          appId={appId}
          appName={appName}
          currentMonth={month}
          viewerId={viewerId}
        />
      </PopoverContent>
    </Popover>
  )

  if (people.length === 0) {
    return (
      <div className="relative z-10 flex h-5 min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
        {trigger}
        <span className="min-w-0 truncate">{onlyOwn ? 'none logged by you' : 'none logged'}</span>
      </div>
    )
  }

  const label = (p: PersonLoggedTime) => (p.userId === viewerId ? 'You' : p.name.split(' ')[0])

  const scrollable = edges.left || edges.right

  return (
    // The focus ring lives HERE, not on the ul: the ul's mask-image clips
    // anything outside its box, so its own ring would vanish exactly when the
    // strip overflows — the only time keyboard scrolling matters.
    <div className="relative z-10 flex h-5 min-w-0 items-center gap-1.5 rounded-sm text-2xs text-muted-foreground has-[ul:focus-visible]:ring-2 has-[ul:focus-visible]:ring-ring">
      {trigger}
      <ul
        ref={scroller}
        // Focusable only when there is something to scroll, so a keyboard
        // user can arrow along it without a dead tab stop on every card.
        tabIndex={scrollable ? 0 : undefined}
        aria-label={`Hours on ${appName}${onlyOwn ? ', your own only' : ''}`}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          edges.left && edges.right
            ? '[mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1rem),transparent)]'
            : edges.right
              ? '[mask-image:linear-gradient(to_right,black_calc(100%-1rem),transparent)]'
              : edges.left
                ? '[mask-image:linear-gradient(to_right,transparent,black_1rem)]'
                : null,
        )}
      >
        {people.map((p) => (
          <li
            key={p.userId}
            // Full name restated for a pointer user; the visible first name is
            // the same person, so this carries nothing hover-only.
            title={`${p.name} · ${formatHours(p.minutes)}h`}
            className="flex h-5 shrink-0 items-center gap-1 rounded-full bg-muted py-0.5 pr-2 pl-0.5"
          >
            {/* Decorative: the name beside it is the label, and an unhidden
                fallback initial would be read as "S Shanika". */}
            <Avatar aria-hidden className="size-4">
              {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-[9px]">{p.name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span>{label(p)}</span>
            <span className="font-mono tabular-nums text-foreground">
              {formatHours(p.minutes)}
              h
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
