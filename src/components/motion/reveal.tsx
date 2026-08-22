'use client'

import { m, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import {
  STAGGER_MAX,
  STAGGER_STEP,
  TRAVEL_PX,
  enterVariants,
} from './transitions'
import { MOTION_TAGS, type MotionTag } from './stagger'
import { isHydrated } from './hydrated'

type RevealProps = Omit<
  HTMLMotionProps<'div'>,
  'variants' | 'initial' | 'animate' | 'whileInView'
> & {
  /**
   * Position in a sequence, mirroring the `--reveal-index` custom property
   * the public page's CSS reveals already use. Anything without one is simply
   * first, so an element that forgets to declare a position still behaves.
   */
  index?: number
  /** Travel distance in px. Defaults to the app-wide 0.5rem. */
  distance?: number
  /**
   * Wait until the element is in the viewport instead of animating on mount.
   * Off by default: most app surfaces are above the fold on arrival, and a
   * scroll trigger there means content that never appears for a reader who
   * lands mid-page via an anchor.
   */
  inView?: boolean
  /** The element to render. Defaults to a div. See MOTION_TAGS. */
  as?: MotionTag
}

/**
 * One element arriving. The JS counterpart of `[data-reveal]` in globals.css.
 *
 * The two do the same thing at different speeds on purpose: /home reveals
 * editorial blocks over 760ms because it wants to be read, the app chrome
 * arrives in 320ms because it wants to be used. Same curve family, same
 * distance, same opacity-finishes-first split — see transitions.ts.
 *
 * `once` is not configurable. A reveal that replays every time the element
 * re-enters the viewport turns a page into an aquarium, and there is no
 * surface in this app where that is the right answer.
 */
export function Reveal({
  as = 'div',
  index = 0,
  distance = TRAVEL_PX,
  inView = false,
  children,
  ...props
}: RevealProps) {
  const Component = MOTION_TAGS[as] as typeof m.div
  const reduced = useReducedMotion() ?? false
  /* `false` rather than 'hidden' before hydration: the server must not ship
     an invisible element. See hydrated.ts for the whole argument. */
  const initial = isHydrated() ? 'hidden' : false
  // Capped rather than unbounded: past STAGGER_MAX the tail arrives so long
  // after the head that the list reads as loading rather than as arriving.
  const delay = reduced ? 0 : Math.min(index, STAGGER_MAX) * STAGGER_STEP
  const variants = enterVariants(reduced, distance, delay)

  const trigger = inView
    ? { whileInView: 'visible' as const, viewport: { once: true, amount: 0.15 } }
    : { animate: 'visible' as const }

  return (
    /* `exit` is named here rather than only defined in the variants: outside
       an <AnimatePresence> it is inert, and inside one it is the difference
       between a row leaving and a row vanishing. Declaring it always means a
       component does not have to be rewritten the day it lands in a list. */
    <Component variants={variants} initial={initial} exit="exit" {...trigger} {...props}>
      {children}
    </Component>
  )
}
