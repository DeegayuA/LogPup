'use client'

import * as React from 'react'
import { CountingNumber } from '@/components/animate-ui/primitives/texts/counting-number'

// Near-critically-damped spring that settles in roughly 200ms, so the
// count-up reads as polish rather than a loading effect.
const statTransition = { stiffness: 550, damping: 45 }

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

function subscribeToReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(reducedMotionQuery)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/**
 * True whenever the count-up must stay static: during SSR/hydration (so the
 * server HTML carries the real value, not a transient 0) and whenever the
 * user prefers reduced motion — tracked live, not just at mount.
 */
function useStaticNumber() {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => true,
  )
}

/**
 * Reduced-motion-aware wrapper around the animate-ui CountingNumber
 * primitive. The primitive drives text via Motion's useSpring, which is not
 * governed by MotionConfig's reducedMotion setting, so the media query is
 * honored here instead: static value when reduced motion is set, count-up
 * after hydration otherwise. Safe to render from server components.
 */
export function StatNumber({ value, className }: { value: number; className?: string }) {
  const isStatic = useStaticNumber()

  if (isStatic) {
    return <span className={className}>{value}</span>
  }

  return <CountingNumber number={value} transition={statTransition} className={className} />
}
