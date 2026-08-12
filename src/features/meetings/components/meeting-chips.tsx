import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The shared visual vocabulary for the meetings surfaces: one chip, one
 * section heading, one stat tile, one skeleton — used by the list row, the
 * notes panel, the calendar's detail dialog and the page header so those four
 * places stop inventing their own.
 *
 * COLOUR RULE, enforced by this file having only these five tones: colour
 * here means state, never decoration and never identity.
 *   danger  — overdue, or an open item that has been carried past its welcome
 *   warning — carried forward / waiting on somebody / needs attention
 *   success — settled: resolved, answered, done
 *   active  — happening right now (the only "informational" colour, and it is
 *             always paired with a live indicator or the word "now")
 *   neutral — everything else, which is most things
 * There is deliberately no per-app, per-person or per-category tone: hue that
 * encodes identity collides the moment two apps hash to the same colour, and
 * it competes with the four tones above that a reader actually has to notice.
 */
export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'active'

/**
 * Prose that may be code-switched Sinhala/English mid-sentence — meeting
 * notes, transcripts, agendas, follow-up text. Sinhala's stacked vowel signs
 * and loops occupy far more vertical space than Latin lowercase, so at the
 * 1.43 line-height `text-sm` ships with, consecutive Sinhala lines visually
 * collide while the Latin ones look fine: the paragraph reads as broken only
 * for the Sinhala half of it. These set leading from the taller script's
 * needs (~1.7) instead.
 *
 * Written with Tailwind's `text-<size>/<leading>` syntax on purpose. A custom
 * `.text-bilingual` class cannot do this reliably — `text-sm` sets a
 * line-height of its own, and Tailwind's utilities layer outranks anything in
 * the base layer whatever the specificity, so the class would silently lose
 * wherever the two were used together (which is everywhere).
 *
 * Deliberately NOT a font-family override either: --font-sans already ends in
 * `system-ui, sans-serif`, so Sinhala families appended after it would sit
 * behind a generic that always resolves, and every platform this ships to
 * carries a Sinhala face in its own per-character fallback. The one thing CSS
 * has to supply is the room to render it — plus `break-words`, so a long
 * unbroken transliterated token cannot push a note card wider than a 375px
 * viewport.
 */
export const bilingualText = 'text-sm/6 break-words'
/** The same, for the one paragraph allowed to lead at body-plus size. */
export const bilingualLead = 'text-base/7 break-words'

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: 'border-border text-muted-foreground',
  success: 'border-success/35 bg-success/8 text-success',
  warning: 'border-warning/40 bg-warning/8 text-warning',
  danger: 'border-destructive/40 bg-destructive/8 text-destructive',
  active: 'border-primary/40 bg-primary/8 text-primary',
}

/**
 * A small bordered fact. Always renders its own text — the tone is a second,
 * redundant signal, never the only one (WCAG 1.4.1), which is why there is no
 * icon-only variant.
 */
export function MetaChip({
  tone = 'neutral',
  icon: Icon,
  children,
  className,
}: {
  tone?: ChipTone
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs leading-5 font-medium whitespace-nowrap',
        CHIP_TONE[tone],
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {children}
    </span>
  )
}

/**
 * A count plus its unit, with the number in tabular figures so a column of
 * these does not jitter as values change. `tone` is for the count that means
 * something is wrong (overdue, stale) — not for every number on screen.
 */
export function CountChip({
  value,
  unit,
  tone = 'neutral',
  icon,
}: {
  value: number
  /** Singular; an "s" is appended for any count that is not exactly 1. */
  unit: string
  tone?: ChipTone
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}) {
  return (
    <MetaChip tone={tone} icon={icon}>
      <span className="font-mono">{value}</span> {unit}
      {value === 1 ? '' : 's'}
    </MetaChip>
  )
}

/**
 * A section heading inside the notes panel. The level is passed in rather than
 * fixed so the outline stays h1 (page) → h2 (Upcoming/Past) → h3 (meeting
 * title) → h4 (notes section) with nothing skipped; before this the list view
 * jumped straight from h2 to h4 and half the page had no heading at all.
 *
 * The icon is muted, never coloured: an icon that is decorative should not be
 * spending one of the five state tones.
 */
export function SectionHeading({
  as: Tag = 'h4',
  icon: Icon,
  title,
  count,
  action,
  id,
}: {
  as?: 'h3' | 'h4' | 'h5'
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  count?: number
  action?: ReactNode
  id?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Tag id={id} className="flex items-center gap-1.5 font-heading text-sm font-semibold">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {title}
        {count !== undefined ? (
          <span className="font-mono text-xs font-normal text-muted-foreground">{count}</span>
        ) : null}
      </Tag>
      {action}
    </div>
  )
}

/**
 * One number in the page header's at-a-glance strip. The value leads at a size
 * nothing else on the page uses, because scanning four of these is the first
 * thing anyone does on arrival.
 */
export function StatTile({
  value,
  label,
  tone = 'neutral',
}: {
  value: number
  label: string
  tone?: ChipTone
}) {
  const highlight = tone !== 'neutral' && value > 0
  return (
    <div
      className={cn(
        'flex min-w-16 flex-col rounded-lg border px-2.5 py-1.5',
        highlight ? CHIP_TONE[tone] : 'border-border',
      )}
    >
      <span
        className={cn(
          'font-mono text-xl leading-tight font-semibold',
          highlight ? undefined : 'text-foreground',
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          'text-2xs leading-4 font-medium tracking-wide uppercase',
          highlight ? undefined : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * Skeleton block for a surface whose shape is known. Used instead of a
 * spinner wherever the thing being waited on is a list of cards, per the
 * project rule — a spinner in a card-shaped hole tells the reader nothing
 * about what is coming.
 */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted motion-reduce:animate-none', className)} aria-hidden />
}
