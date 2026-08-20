import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
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
      {Icon ? <Icon aria-hidden className="mt-0.5 size-3 shrink-0 text-primary" /> : null}
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/**
 * A styled disclosure container for policies and guidelines.
 * Server-component safe, with animated chevron and clean card presentation.
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
    <details className={cn('group rounded-xl border border-border/70 bg-card/60 p-2.5 transition-all text-xs backdrop-blur-sm', className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium text-muted-foreground transition-colors hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary select-none">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-primary" />
          <span className="text-2xs sm:text-xs">{summary}</span>
        </span>
        <ChevronRight className="size-3.5 transition-transform duration-200 group-open:rotate-90 text-muted-foreground shrink-0" />
      </summary>
      <div className="mt-2.5 pt-2.5 border-t border-border/40 flex flex-col gap-2 text-2xs text-muted-foreground leading-relaxed">
        {children}
      </div>
    </details>
  )
}
