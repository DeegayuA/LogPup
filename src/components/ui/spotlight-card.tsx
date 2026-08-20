'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The app-shell twin of the landing page's spotlight card: a surface whose
 * light follows the cursor. Three deliberate divergences from the /home
 * version, all of them house rules the marketing page predates.
 *
 * 1. Named transition properties. `transition-all` on a card also animates
 *    its own layout when a sibling's number changes width, which is the
 *    jitter a dense board is most prone to.
 * 2. No tracking under `prefers-reduced-motion` — a gradient that chases the
 *    pointer is motion, even though nothing translates.
 * 3. No tracking on a coarse pointer. A phone has no hover; the mousemove
 *    listener, the re-render per frame and the repaint are all pure waste,
 *    so the glow layer is not even mounted there.
 *
 * The default colour is mixed from `--primary` rather than written as an
 * rgba literal: the glow has to be the working colour in both themes, and a
 * fixed emerald is neither token nor theme-aware.
 */

/**
 * matchMedia IS an external system, so it is read through React's contract
 * for one. The server snapshot is `false` (track nothing), which costs a
 * frame at most: no pointer event can arrive before hydration anyway.
 */
function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    [query],
  )
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

function SpotlightCard({
  children,
  className,
  spotlightColor = 'color-mix(in oklch, var(--primary) 16%, transparent)',
}: {
  children: React.ReactNode
  className?: string
  spotlightColor?: string
}) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  const tracks = !reducedMotion && !coarsePointer

  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const [hovered, setHovered] = React.useState(false)

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  return (
    <div
      data-slot="spotlight-card"
      onMouseMove={tracks ? handleMouseMove : undefined}
      onMouseEnter={tracks ? () => setHovered(true) : undefined}
      onMouseLeave={tracks ? () => setHovered(false) : undefined}
      className={cn(
        'relative overflow-hidden transition-[border-color,box-shadow] duration-(--dur-base) ease-out motion-reduce:transition-none',
        className,
      )}
    >
      {tracks ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px transition-opacity duration-(--dur-slow) ease-out will-change-[background]"
          style={{
            opacity: hovered ? 1 : 0,
            background: `radial-gradient(24rem circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
          }}
        />
      ) : null}
      {children}
    </div>
  )
}

export { SpotlightCard }
