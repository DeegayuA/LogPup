'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * The spine's horizontal scroll container, opened at today.
 *
 * A year of sprints is a ~2900px axis at month zoom, and a plain
 * `overflow-x-auto` box opens hard against its left edge — showing the oldest
 * sprints the app ever ran, which is the least useful view of a plan. The
 * full timeline has always scrolled itself to today on mount; the spine is a
 * server component, so it needs this sliver of client to do the same.
 *
 * Scrolls ONCE per mount and per zoom change (the caller keys on zoom), never
 * in response to anything the user does afterwards — a container that
 * re-centres itself while you are reading it is worse than one that started
 * in the wrong place.
 */
export function SpineScroller({
  todayLeftPx,
  children,
  className,
}: {
  /** Where the today marker sits inside the scrolled content. */
  todayLeftPx: number
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  // Layout effect, not effect: it runs before paint, so the spine is never
  // briefly shown scrolled to the far left and then visibly jumped.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    // Nothing to do when the whole axis already fits.
    if (element.scrollWidth <= element.clientWidth) return
    // Today a third of the way in rather than centred: what people look at
    // next is mostly to the RIGHT of today, so this spends the visible width
    // where the answer usually is — the same choice the full timeline makes.
    element.scrollLeft = Math.max(0, todayLeftPx - element.clientWidth / 3)
  }, [todayLeftPx])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
