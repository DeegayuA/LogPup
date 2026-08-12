'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * OPTIMISTIC PRELOADING — start fetching the moment someone looks like they
 * are about to go somewhere, not when they commit.
 *
 * Next already prefetches `<Link>`s that scroll into view, which covers most
 * of this app. It does not cover the places that navigate imperatively — the
 * ⌘K palette pushes with `router.push`, so its results are the one list in
 * LogPup where every single pick pays a cold server round trip, and it is the
 * list people use precisely when they are in a hurry.
 *
 * There is a second, quieter reason to call `router.prefetch` by hand even for
 * a real `<Link>`: a viewport prefetch of a dynamic route is cached under
 * `staleTimes.dynamic` (30s here), while an explicit `router.prefetch()` is
 * cached under `staleTimes.static` (300s). Deliberate intent earns the longer
 * window.
 *
 * Two guards keep this from being a bandwidth leak:
 *
 * - **Once per href.** Hovering the same row five times is one prefetch. This
 *   is the same in-flight discipline as lib/dedupe.ts, applied to navigation.
 * - **Intent, not proximity.** Nothing fires until the pointer has rested for
 *   `delayMs`; a cursor sweeping across a list on its way somewhere else
 *   leaves without costing anything. Keyboard focus and touch skip the delay —
 *   both are already deliberate.
 */
export function usePrefetchIntent(delayMs = 80) {
  const router = useRouter()
  const prefetched = useRef(new Set<string>())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const prefetchNow = useCallback(
    (href: string) => {
      if (!href || href.startsWith('#') || prefetched.current.has(href)) return
      prefetched.current.add(href)
      try {
        router.prefetch(href)
      } catch {
        // A prefetch is an optimisation and nothing more: a route that cannot
        // be warmed early must still be navigable by clicking it.
        prefetched.current.delete(href)
      }
    },
    [router],
  )

  /**
   * Spread onto whatever the person is about to activate. Works on a `<Link>`,
   * a `<button>`, or a cmdk `CommandItem` alike — these are plain DOM events,
   * not a component contract.
   */
  const intentProps = useCallback(
    (href: string) => ({
      onMouseEnter: () => {
        cancel()
        timerRef.current = setTimeout(() => prefetchNow(href), delayMs)
      },
      onMouseLeave: cancel,
      // Focus and touch are commitments in a way that hover is not — a
      // keyboard user arrowing onto a row, or a thumb landing on it, is
      // already most of the way to selecting it.
      onFocus: () => prefetchNow(href),
      onTouchStart: () => prefetchNow(href),
    }),
    [cancel, delayMs, prefetchNow],
  )

  return { intentProps, prefetchNow }
}
