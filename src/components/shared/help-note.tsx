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
 *
 * A HINT THAT OPENS ON HOVER DOES NOT EXIST ON A TOUCH SCREEN, and `title` is
 * the same trap with worse ergonomics. If something is worth explaining it is
 * worth rendering; if it is not worth the space, it is not worth a hover
 * either. Where width genuinely forbids a sentence, follow the command
 * palette's shortcut chips and gate the hint on `sm` rather than on a pointer.
 *
 * KNOWN VIOLATION, recorded rather than sanctioned: a Tooltip primitive was
 * added in the 2026-08-20 redesign (src/components/ui/tooltip.tsx) and is used
 * on the five icon-only actions in gemini-keys-card.tsx. It does not solve the
 * problem it was added for. Those buttons already carry `sr-only` labels, so
 * screen readers were never the gap; the gap was sighted users, and a tooltip
 * serves the mouse half of them while leaving every touch user exactly where
 * they were. The rule above already prescribes the better answer for that row.
 * Treat the primitive as debt to unwind, not as precedent.
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
 * A plain `<details>`, which is why it is server-component safe: no state, no
 * effect, no client boundary, and it opens with JavaScript disabled. The
 * chevron is a CSS rotation on `group-open`, not a React-held flag — that is
 * what keeps this usable from a server component beside the data it explains,
 * where a client-side disclosure would drag the whole card across the
 * boundary with it.
 *
 * Distinct from `HelpNote` above: that is the rule you cannot guess and must
 * always see; this is the longer derivation you only want when you ask.
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
    <details className={cn('group rounded-xl border border-border/70 bg-card/60 p-2.5 transition-[background-color,border-color] duration-150 motion-reduce:transition-none text-xs backdrop-blur-sm', className)}>
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
