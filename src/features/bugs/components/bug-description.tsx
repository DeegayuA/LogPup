'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * A long bug report, clamped so the queue stays scannable.
 *
 * BugList renders descriptions as plain text server-side; this island exists
 * only for the reports long enough to bury the rows under them (the schema
 * allows 4000 characters, and one verbose report unclamped is a full screen
 * of scroll between two triage decisions). The clamp is three lines — enough
 * to recognise the bug — and the full text is one click away, in place.
 *
 * `aria-expanded` + `aria-controls` on the toggle, so what the button does to
 * which text is announced rather than guessed.
 */
export function BugDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()

  return (
    <div className="flex flex-col items-start gap-1">
      <p
        id={id}
        className={cn(
          'text-sm break-words whitespace-pre-wrap text-muted-foreground',
          !expanded && 'line-clamp-3',
        )}
      >
        {text}
      </p>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((current) => !current)}
        className="rounded-sm text-2xs font-medium text-muted-foreground underline underline-offset-2 outline-none transition-colors duration-150 pointer-coarse:min-h-11 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      >
        {expanded ? 'Show less' : 'Show full report'}
      </button>
    </div>
  )
}
