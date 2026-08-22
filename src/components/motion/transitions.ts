/**
 * The app's motion vocabulary, expressed in the numbers `motion/react` needs.
 *
 * WHY THIS FILE EXISTS RATHER THAN INLINE NUMBERS. The durations and curves
 * below are already declared once, as CSS custom properties in
 * src/app/globals.css (--dur-quick/base/slow, --ease-enter/exit/editorial),
 * and roughly seventy components consume them through Tailwind. A JS
 * animation library cannot read a custom property without getComputedStyle,
 * which is unavailable during SSR and wrong during the first client render —
 * so the values are mirrored here instead, and transitions.test.ts parses
 * globals.css and fails the build if the two ever disagree. Mirrored with a
 * guard, not duplicated and hoped for.
 *
 * Consequence worth knowing: change a duration in globals.css and the test
 * tells you to change it here too. That is the intended cost. The alternative
 * — a component that fades over 200ms next to one that fades over 240ms
 * because a token moved and JS never heard about it — is the drift this
 * whole file is here to prevent.
 */

/** A cubic-bezier control-point tuple, the shape `motion` wants for `ease`. */
type Cubic = [number, number, number, number]

/**
 * Seconds, because that is `motion`'s unit. globals.css states these in ms.
 * quick = hover/press feedback, base = enter/reveal, slow = large surfaces.
 */
export const DURATION = {
  quick: 0.12,
  base: 0.2,
  slow: 0.32,
} as const

/**
 * enter decelerates hard (arrives, settles); exit accelerates (leaves,
 * doesn't linger); editorial is the public page's single brand curve for
 * content that READS. The app chrome uses the first two — see the note above
 * the same three values in globals.css for why they are deliberately not one
 * shared curve.
 */
export const EASE: Record<'enter' | 'exit' | 'editorial', Cubic> = {
  enter: [0.16, 1, 0.3, 1],
  exit: [0.7, 0, 0.84, 0],
  editorial: [0.22, 0.68, 0.2, 1],
}

/**
 * How far anything travels on the way in. 0.5rem, in pixels.
 *
 * The public page settled on this distance and wrote down why (globals.css,
 * the [data-reveal][data-pending] rule): a longer travel is what makes a
 * fade-up read as every other landing page. The app chrome uses the same
 * number so a card arriving in the dashboard and a paragraph arriving on
 * /home are recognisably one system, differing in speed rather than in
 * distance.
 */
export const TRAVEL_PX = 8

/**
 * OPACITY FINISHES FIRST — the same split the public page's reveals use.
 *
 * Fading and moving over one duration means the element is still translucent
 * while it is still travelling, and it lands and solidifies in the same
 * instant, which is what makes a reveal read as mushy. Opacity lands at
 * --dur-base while the movement is still settling until --dur-slow, so the
 * text is legible before it stops moving and the eye starts reading through
 * the tail of the animation rather than after it.
 */
export const enterTransition = {
  opacity: { duration: DURATION.base, ease: EASE.enter },
  y: { duration: DURATION.slow, ease: EASE.enter },
  x: { duration: DURATION.slow, ease: EASE.enter },
  scale: { duration: DURATION.slow, ease: EASE.enter },
} as const

/**
 * Exit is one duration for everything, and the short one.
 *
 * Nothing about a leaving element needs to be read, so the split above would
 * only make it linger. --dur-quick with the accelerating curve is the app
 * saying "this is gone" rather than performing its departure.
 */
export const exitTransition = {
  duration: DURATION.quick,
  ease: EASE.exit,
} as const

/**
 * The interval between siblings in a stagger, in seconds.
 *
 * 40ms rather than the public page's 65ms: /home reveals a handful of
 * editorial blocks and can afford a visible cadence, while an app list is
 * routinely twenty rows and the same interval would take most of a second to
 * finish drawing a table. Fast enough to read as one movement with a
 * direction, slow enough not to be a single flash.
 */
export const STAGGER_STEP = 0.04

/**
 * The most siblings a stagger will ever sequence.
 *
 * Past this the tail is arriving so long after the head that the list reads
 * as loading rather than as arriving — and a 200-row table would spend eight
 * seconds animating. Beyond the cap every remaining child uses the last
 * delay, so a long list still fades in as a body instead of item by item.
 */
export const STAGGER_MAX = 12

/**
 * The one place "is motion switched off" turns into actual values.
 *
 * `useReducedMotion()` covers the JS side of the same rule the CSS side
 * states as `@media (prefers-reduced-motion: reduce)`. Returning a variant
 * pair that is identical in both states — rather than skipping the animation
 * — keeps every call site's markup the same in both worlds, so a reduced
 * reader and a full-motion reader are looking at the same DOM.
 *
 * Note this drops the OPACITY animation too. `<MotionConfig reducedMotion>`
 * only suppresses transform and layout animation; a fade left running is
 * still motion to a reader who is nauseated by it, and the WCAG 2.3.3
 * expectation is that non-essential motion goes away, not that it gets
 * quieter.
 */
export function enterVariants(
  reduced: boolean,
  distance: number = TRAVEL_PX,
  delay = 0,
) {
  if (reduced) {
    return {
      hidden: { opacity: 1, y: 0 },
      visible: { opacity: 1, y: 0, transition: { duration: 0 } },
      exit: { opacity: 1, y: 0, transition: { duration: 0 } },
    }
  }
  return {
    hidden: { opacity: 0, y: distance },
    visible: {
      opacity: 1,
      y: 0,
      /* The delay is written into each property rather than left at the root
         of the transition object. A root-level option only reaches properties
         that declare no config of their own, and both of these declare one —
         so a root delay here would be silently dropped and every item in a
         staggered list would arrive at once. */
      transition: {
        opacity: { ...enterTransition.opacity, delay },
        y: { ...enterTransition.y, delay },
      },
    },
    exit: { opacity: 0, y: -distance / 2, transition: exitTransition },
  }
}
