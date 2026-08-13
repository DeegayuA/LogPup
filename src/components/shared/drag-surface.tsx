'use client'

import type { ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DndContextProps,
} from '@dnd-kit/core'

/**
 * One sensor set, shared by every drag surface in the product (sprint
 * board, roadmap, meetings calendar). Deliberately `MouseSensor` +
 * `TouchSensor` instead of `PointerSensor`: `PointerSensor` claims touch
 * input and can't be given a different activation constraint for mouse vs.
 * touch, which is why a touch drag used to fight the page's own scroller —
 * a long-press has no way to "win" against a plain-swipe-to-scroll
 * `PointerSensor` in time. Splitting the two lets touch require a
 * deliberate hold before it lifts, while mouse still only needs a small
 * travel distance (so a plain click can still open a card without being
 * swallowed as a drag-start).
 */
export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      // Space only, deliberately: every draggable surface here also opens
      // something on click/Enter (a task dialog, a meeting's details), and
      // dnd-kit's default keyboard activator is Space OR Enter. Narrowing
      // to Space alone is what leaves Enter free to open rather than lift —
      // no separate drag handle needed, and still one tab stop per card.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )
}

/**
 * Thin `DndContext` wrapper that owns the shared sensor set. Every other
 * `DndContext` prop (`onDragStart`/`onDragMove`/`onDragEnd`/`onDragCancel`,
 * `accessibility`, `modifiers`, `collisionDetection`, ...) passes straight
 * through — each surface keeps its own drag logic, this just guarantees
 * mouse/touch/keyboard behave identically everywhere.
 */
export function DragSurface({
  children,
  ...props
}: Omit<DndContextProps, 'sensors'> & { children?: ReactNode }) {
  const sensors = useDragSensors()
  return (
    <DndContext sensors={sensors} {...props}>
      {children}
    </DndContext>
  )
}

/**
 * Generalizes the announcements object that originally lived only in the
 * meetings calendar (naming meeting titles and day keys) into something any
 * drag surface can use: hand it one function that turns a dnd-kit id
 * (either the dragged item's id, or whatever it's currently over) into a
 * spoken name, and it produces the full pick-up/over/drop/cancel set.
 */
export function buildDragAnnouncements(nameForId: (id: string) => string): Announcements {
  return {
    onDragStart: ({ active }) => `Picked up ${nameForId(String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameForId(String(active.id))} is over ${nameForId(String(over.id))}.`
        : undefined,
    onDragEnd: ({ active, over }) => {
      const name = nameForId(String(active.id))
      return over
        ? `${name} moved to ${nameForId(String(over.id))}.`
        : `${name} was dropped and did not move.`
    },
    onDragCancel: ({ active }) => `Move cancelled. ${nameForId(String(active.id))} stays where it was.`,
  }
}
