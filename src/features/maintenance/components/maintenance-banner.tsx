'use client'

import { useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KIND_HEADINGS, formatCountdown, isUrgent, type MaintenanceWindow } from '../window'
import { KIND_ICONS } from './maintenance-chrome'

/**
 * The slim strip that says maintenance is coming.
 *
 * IT RESERVES ITS OWN HEIGHT. A fixed bar at the top of the viewport is the
 * only thing that stays put while the app scrolls, and it is also the only
 * thing that will sit on top of the app header if nothing makes room for it.
 * So the bar measures itself and pushes the document down by exactly that
 * much — measured rather than hard-coded, because the text wraps to two lines
 * on a narrow phone and a guessed 40px would then cover the header it was
 * supposed to clear.
 *
 * IT PUBLISHES ITS HEIGHT, TOO. The app header is `sticky top-0`, so body
 * padding alone does not save it: the header would slide under this bar the
 * moment anyone scrolled. `--maintenance-banner-h` is what the header sticks
 * to instead. `--shell-header-h` is the variable the activity feed's sticky
 * day markers already read (with a 3.5rem fallback nothing had ever set) —
 * with a bar on screen, "below the header" is 3.5rem plus this.
 */
export function MaintenanceBanner({
  state,
  msRemaining,
  onOpenDetails,
}: {
  state: MaintenanceWindow
  msRemaining: number
  onOpenDetails: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const root = document.documentElement

    const apply = () => {
      const height = element.getBoundingClientRect().height
      document.body.style.paddingTop = `${height}px`
      root.style.setProperty('--maintenance-banner-h', `${height}px`)
      root.style.setProperty('--shell-header-h', `calc(${height}px + 3.5rem)`)
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(element)
    return () => {
      observer.disconnect()
      // Everything this set is undone on the way out. The padding is an inline
      // style, so leaving it behind would keep a gap at the top of the app for
      // the rest of the session after the window was cancelled.
      document.body.style.paddingTop = ''
      root.style.removeProperty('--maintenance-banner-h')
      root.style.removeProperty('--shell-header-h')
    }
  }, [])

  const urgent = isUrgent(msRemaining)
  const Icon = KIND_ICONS[state.kind]

  return (
    <div
      ref={ref}
      data-maintenance
      className="fixed inset-x-0 top-0 z-30 print:hidden"
    >
      <button
        type="button"
        onClick={onOpenDetails}
        aria-label={`${KIND_HEADINGS[state.kind]} in ${formatCountdown(msRemaining)}. Open details.`}
        className={cn(
          'flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset motion-reduce:transition-none',
          // Amber for "this is coming", red for "stop typing". One colour for
          // both would teach people to ignore the one that matters.
          urgent
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : 'bg-[var(--chart-1)] text-background hover:brightness-105',
        )}
      >
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{KIND_HEADINGS[state.kind]} in</span>
        <span className="font-mono tabular-nums">{formatCountdown(msRemaining)}</span>
        <span className="hidden opacity-80 sm:inline">— what this means</span>
        <ChevronRight aria-hidden className="size-3.5 shrink-0 opacity-80" />
      </button>
    </div>
  )
}
