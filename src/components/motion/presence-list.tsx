'use client'

import { AnimatePresence } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Add and remove, animated. Wrap a list; give every child a stable `key`.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: reorder. Animating a row from one
 * position to another means putting `layout` on every row, and the shell's
 * LazyMotion does carry layout projection (see motion-provider.tsx), so this
 * is a choice rather than a limitation. Two reasons it is the right one here:
 * the only real reordering surface in the app is dnd-kit's, which already
 * animates its own transforms and would fight a second engine for the same
 * element; and every other list reorders on a sort change, where a row
 * sliding across the screen obscures the fact that the whole table just
 * re-sorted. Added and removed rows are the ones a reader needs help
 * noticing, and those are the ones this animates.
 *
 * `sync` is the default: exits are 120ms, and overlapping them with the
 * entrance is what keeps a delete from leaving a hole in the list while it
 * plays. `popLayout` is available for the case `sync` handles badly — a
 * single-column list where the removed row's space collapsing is itself the
 * jarring part — but it takes the leaving row out of flow, which reflows
 * everything below it, so reach for it deliberately rather than by default.
 */
export function PresenceList({
  children,
  mode = 'sync',
}: {
  children: ReactNode
  /**
   * `wait` holds the incoming content until the outgoing one has left;
   * `popLayout` takes the leaving child out of flow so its neighbours close
   * the gap while it goes. See the note above before choosing either.
   */
  mode?: 'sync' | 'wait' | 'popLayout'
}) {
  /* `initial={false}` so the list does not play its entrance on first paint.
     The rows were already there when the page arrived — animating them in
     would claim they had just been added. */
  return (
    <AnimatePresence mode={mode} initial={false}>
      {children}
    </AnimatePresence>
  )
}
