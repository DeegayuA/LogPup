'use client'

import { m, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { STAGGER_MAX, STAGGER_STEP, TRAVEL_PX, enterVariants } from './transitions'
import { isHydrated } from './hydrated'

/**
 * The elements a group or an item is allowed to be.
 *
 * Not decoration: the two lists this was written for are `<ul>`/`<li>`, and a
 * `<div>` wrapper around an `<li>` is invalid markup that also breaks the
 * list semantics a screen reader announces ("list, 12 items"). A motion
 * primitive that can only be a div would quietly cost that on every list in
 * the app, so it can be the element the markup already needed.
 */
export const MOTION_TAGS = {
  div: m.div,
  ul: m.ul,
  ol: m.ol,
  li: m.li,
  section: m.section,
} as const

export type MotionTag = keyof typeof MOTION_TAGS

type StaggerProps = HTMLMotionProps<'div'> & {
  /** The element to render. Defaults to a div. */
  as?: MotionTag
  /**
   * How many children will be sequenced. Optional, but pass it for any list
   * whose length is not fixed — see the step calculation below.
   */
  count?: number
  inView?: boolean
}

/**
 * A group whose children arrive one after another rather than together.
 *
 * The sequencing is the container's job, not the items': `staggerChildren`
 * hands each child its own delay in DOM order, so `<StaggerItem>` needs no
 * index prop and a list built from `.map()` cannot get its own positions
 * wrong. (`<Reveal index>` still exists for hand-sequenced groups whose
 * members are not siblings in one container.)
 *
 * THE STEP SHRINKS INSTEAD OF THE LIST BEING CAPPED. A fixed 40ms interval
 * over a 60-row table spends 2.4 seconds drawing itself, which stops reading
 * as arrival and starts reading as a slow connection. Past STAGGER_MAX
 * children the interval is divided down so the whole group still finishes
 * inside the same ~480ms budget: long lists keep the direction of the
 * movement and lose only its granularity.
 */
export function Stagger({
  as = 'div',
  count,
  inView = false,
  children,
  ...props
}: StaggerProps) {
  const Component = MOTION_TAGS[as] as typeof m.div
  const reduced = useReducedMotion() ?? false
  const step =
    reduced ? 0
    : count && count > STAGGER_MAX ? (STAGGER_STEP * STAGGER_MAX) / count
    : STAGGER_STEP

  const container = {
    hidden: {},
    visible: { transition: { staggerChildren: step } },
  }

  const trigger = inView
    ? { whileInView: 'visible' as const, viewport: { once: true, amount: 0.1 } }
    : { animate: 'visible' as const }

  return (
    /* Items inherit their variant state from here, so this one `initial` also
       decides whether the children ship hidden — see hydrated.ts. */
    <Component
      variants={container}
      initial={isHydrated() ? 'hidden' : false}
      {...trigger}
      {...props}
    >
      {children}
    </Component>
  )
}

type StaggerItemProps = Omit<HTMLMotionProps<'div'>, 'variants'> & {
  as?: MotionTag
  distance?: number
}

/**
 * One member of a `<Stagger>`. Carries no timing of its own — it inherits
 * both the variant state and its place in the queue from the container, which
 * is what keeps a list's rhythm in one place instead of on every row.
 */
export function StaggerItem({
  as = 'div',
  distance = TRAVEL_PX,
  children,
  ...props
}: StaggerItemProps) {
  const reduced = useReducedMotion() ?? false
  const Component = MOTION_TAGS[as] as typeof m.div
  return (
    <Component variants={enterVariants(reduced, distance)} exit="exit" {...props}>
      {children}
    </Component>
  )
}
