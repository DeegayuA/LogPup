'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A `<details>` disclosure whose contents are not MOUNTED until it is opened.
 *
 * The distinction matters for anything inside that measures itself. A plain
 * `<details>` renders its children immediately and merely hides them, so a
 * component that sizes or scrolls itself on mount does so against a box with
 * no dimensions. The roadmap timeline scrolls to today when it mounts; inside
 * a closed `<details>` that resolves to scrollLeft 0, so opening the
 * disclosure would show the oldest sprints instead of the current ones.
 *
 * Children are still RENDERED on the server — they arrive here as an
 * already-evaluated element. What is deferred is inserting them into the DOM,
 * which is precisely the part that needs a real box.
 */
export function LazyDisclosure({
  summary,
  hint,
  defaultOpen = false,
  children,
  className,
}: {
  summary: string
  /** One short line beside the label — what opening this gets you. */
  hint?: string
  /**
   * Start open. For a disclosure hiding the only way to DO something, rather
   * than extra detail about something already on screen: a collapsed control
   * that the surface above it resembles reads as a missing feature, not as a
   * tidy default. Still lazy in the sense that matters — children mount with
   * a real box, because the box is open on first paint.
   */
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      className={cn('group rounded-xl border border-border bg-card', className)}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
        {summary}
        {hint ? <span className="text-2xs font-normal text-muted-foreground">{hint}</span> : null}
      </summary>
      {open ? <div className="border-t border-border p-3">{children}</div> : null}
    </details>
  )
}
