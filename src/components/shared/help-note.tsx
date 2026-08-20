import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The two ways this app explains itself, so it stops inventing a third.
 *
 * Before this, every surface grew its own muted paragraph — different sizes,
 * different spacing, the same job. These are those paragraphs with one shape.
 *
 * WHEN TO USE `HelpNote`: a rule the reader cannot guess and will be wrong
 * about — that both date bounds are inclusive, that a pending absence still
 * counts as unlogged, that a percentage is self-scored rather than derived.
 * One or two lines, always visible, sitting with the control it explains.
 *
 * WHEN TO USE `HelpDetail`: the longer "how is this number worked out" answer
 * that would bury the control if it were always on screen. Closed by default,
 * keyboard-operable, and its summary has to say what opening it gets you.
 *
 * WHEN TO USE NEITHER, which is most of the time:
 * - the label already says it. A note repeating its own control is noise, and
 *   noise is what makes people stop reading the notes that matter;
 * - the fact belongs to the page rather than the control — put it under the
 *   page heading once, not beside every instance. A page-level rule rendered
 *   inside a repeated component prints eleven times down one screen;
 * - you have not read the code that makes it true. Every sentence here is a
 *   claim, and a wrong one is worse than silence.
 *
 * THERE IS DELIBERATELY NO TOOLTIP COMPONENT. A hint that opens on hover does
 * not exist on a touch screen, and `title` is the same trap with worse
 * ergonomics. If something is worth explaining it is worth rendering; if it is
 * not worth the space, it is not worth a hover either. Where width genuinely
 * forbids a sentence, follow the command palette's shortcut chips and gate the
 * hint on `sm` rather than on a pointer.
 */
export function HelpNote({
  children,
  icon: Icon,
  id,
  className,
}: {
  children: React.ReactNode
  /** Only when the note stands alone; beside a labelled control it is chrome. */
  icon?: LucideIcon
  /** Pass when a control points at this note with aria-describedby. */
  id?: string
  className?: string
}) {
  return (
    <p
      id={id}
      className={cn('flex items-start gap-1.5 text-2xs text-muted-foreground', className)}
    >
      {Icon ? <Icon aria-hidden className="mt-0.5 size-3 shrink-0" /> : null}
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/**
 * A plain `<details>`, not the LazyDisclosure next door: that one exists to
 * defer MOUNTING for children that measure themselves, and help text measures
 * nothing. Server-component safe, and open/closed is the browser's own state
 * rather than React's, so it costs no client bundle at all.
 */
export function HelpDetail({
  summary,
  children,
  className,
}: {
  /** Say what opening it gets you — never "More", never "Learn more". */
  summary: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <details className={cn('group', className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-2xs text-muted-foreground underline decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        {summary}
      </summary>
      <div className="mt-1 flex flex-col gap-1 text-2xs text-muted-foreground">{children}</div>
    </details>
  )
}
