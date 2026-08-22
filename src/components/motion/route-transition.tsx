'use client'

import { usePathname } from 'next/navigation'
import { m, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { DURATION, EASE } from './transitions'
import { isHydrated } from './hydrated'

/**
 * The whole page arriving, once per navigation.
 *
 * DELIBERATELY NOT AN `<AnimatePresence>`. The obvious version of this holds
 * the outgoing page on screen with `mode="wait"` until its exit finishes,
 * then reveals the new one — which on the App Router means holding a page
 * that has already streamed, and turning every Suspense boundary and
 * loading.tsx in the app into dead weight behind a 200ms curtain. The exit
 * animation would be paid for in perceived speed on every single navigation.
 * What is left is the half that costs nothing: the new route fades and rises
 * the same 4px as it renders, while the router streams underneath it exactly
 * as it did before.
 *
 * 4px, not the 8px the rest of the app uses: this moves the entire viewport's
 * worth of content, and the same distance that reads as a card settling reads
 * as a lurch at page scale.
 *
 * `key={pathname}` is what makes it fire — the wrapper remounts on each
 * route, replaying `initial`. Query-string changes do not remount, which is
 * correct: a filter change is not an arrival.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const reduced = useReducedMotion() ?? false

  if (reduced) {
    /* Nothing to switch off, in the same spirit as the CSS reveals: for a
       reader who asked for less motion the animation is never declared, so
       there is no fade left running at zero duration and no wrapper doing
       nothing. Same tree shape either way — a plain div in both cases. */
    return <div className="flex flex-1 flex-col">{children}</div>
  }

  return (
    <m.div
      key={pathname}
      className="flex flex-1 flex-col"
      /* The first route of a session was in the server's response and is not
         an arrival; every route after it is. See hydrated.ts. */
      initial={isHydrated() ? { opacity: 0, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        opacity: { duration: DURATION.base, ease: EASE.enter },
        y: { duration: DURATION.slow, ease: EASE.enter },
      }}
    >
      {children}
    </m.div>
  )
}
