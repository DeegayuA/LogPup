'use client'

import { LazyMotion, MotionConfig, domMax } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { markHydrated } from './hydrated'

/**
 * The one mount of the animation runtime, wrapped around the authed shell.
 *
 * WHY `LazyMotion` RATHER THAN THE PLAIN `motion` IMPORT. Importing
 * `motion.div` anywhere pulls the library's full feature set into that
 * route's bundle, again per route. Behind LazyMotion the feature set is named
 * once, loaded once, and shared by everything under it.
 *
 * WHY `domMax` AND NOT `domAnimation`, which is the smaller and more obvious
 * choice. The AI meter dock — mounted in this same shell, on every authed
 * page — animates with `layout`, and layout projection is precisely what
 * `domAnimation` leaves out. With the smaller bundle the dock would not error;
 * it would silently stop animating its resize, which is the worst of the
 * three outcomes. This is still less code than the app shipped before, because
 * the dock's plain `motion` import was already pulling everything, per route.
 * The primitives in this directory need none of it, so if the dock ever stops
 * using `layout`, drop to `domAnimation` and the shell gets ~10kb lighter.
 *
 * `strict` is the enforcement half: with it, any component that reaches for
 * `motion.div` instead of `m.div` throws immediately in development rather
 * than silently re-inflating the bundle. That failure is the point — it is
 * the only thing standing between this decision and the first person who
 * copies a snippet off the docs site.
 *
 * `reducedMotion="user"` is the floor, not the whole story: it suppresses
 * transform and layout animation for a reader who asked for less motion, but
 * leaves opacity running. The primitives in this directory also drop the fade
 * (see enterVariants in transitions.ts), because a fade is still motion to
 * someone it makes ill. Both layers exist so that a component written without
 * the primitives still degrades correctly.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  /* The one place the hydration flag is set. A plain effect, not a layout
     effect: it must land AFTER the first paint, because anything that painted
     with it is by definition not an arrival. See hydrated.ts. */
  useEffect(() => {
    markHydrated()
  }, [])

  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
