'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// One expandable row of the Backlog tree. A real button with aria-expanded,
// rather than <summary>: the row also carries a link to the task, and an
// interactive element nested inside a summary's implicit button role is
// flattened or dropped by screen readers (axe nested-interactive). Here the
// toggle and the link are siblings — two clear controls, two names.

export function TreeBranch({
  label, defaultOpen, row, children,
}: {
  /** The toggle's accessible name, e.g. "Show 4 items under LOG-1". */
  label: string
  defaultOpen: boolean
  row: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const listId = useId()
  return (
    <li>
      <div className="flex items-center gap-1 rounded-md py-1.5 pr-2 hover:bg-muted/50">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={label}
          onClick={() => setOpen((o) => !o)}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight aria-hidden className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        </button>
        {row}
      </div>
      <ul id={listId} role="list" hidden={!open} className="ml-4 border-l pl-2">
        {children}
      </ul>
    </li>
  )
}
