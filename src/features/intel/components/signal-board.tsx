'use client'

import * as React from 'react'
import Link from 'next/link'
import { Eye, Info, PawPrint, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Kbd } from '@/components/ui/kbd'
import type { Signal, SignalSeverity } from '@/features/intel/signals'
import { cn } from '@/lib/utils'

/**
 * The ranked signals, as a keyboard-first list.
 *
 * The highlight IS the focus ring. There is no painted-on "selected" row and
 * no aria-activedescendant shim: j/k and the arrows move real DOM focus
 * between the rows, so a screen reader reads whatever the sighted user is
 * looking at, and Enter is the browser opening a link rather than a handler
 * imitating one. Roving tabindex keeps the whole board a single tab stop.
 */

const SEVERITY_ORDER = ['alert', 'watch', 'info'] as const

/**
 * Tones are the ones the kit already assigns (see ui/stat-tile.tsx):
 * destructive for "this is wrong now", ember `--chart-1` for attention, and
 * the quiet default for information. No new hue enters the app here.
 *
 * Never hue alone (WCAG 1.4.1): each severity also carries its own glyph and
 * its own word in the group heading, so the colourblind read and the colour
 * read agree.
 */
const SEVERITY: Record<
  SignalSeverity,
  { label: string; icon: typeof TriangleAlert; rail: string; ink: string }
> = {
  alert: {
    label: 'Needs action',
    icon: TriangleAlert,
    rail: 'bg-destructive',
    ink: 'text-destructive',
  },
  watch: {
    label: 'Worth watching',
    icon: Eye,
    rail: 'bg-chart-1',
    ink: 'text-chart-1',
  },
  info: {
    label: 'For information',
    icon: Info,
    rail: 'bg-border',
    ink: 'text-muted-foreground',
  },
}

type Filter = SignalSeverity | 'all'

export function SignalBoard({
  signals,
  className,
}: {
  signals: Signal[]
  className?: string
}) {
  const [filter, setFilter] = React.useState<Filter>('all')
  /* The row that currently owns tabindex 0. Null means "nobody has entered
     the board yet", and Escape puts it back there so the next Tab re-enters
     at the top instead of resuming mid-list. */
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const rowRefs = React.useRef(new Map<string, HTMLAnchorElement>())

  const counts = React.useMemo(() => tally(signals), [signals])
  const visible = React.useMemo(
    () => (filter === 'all' ? signals : signals.filter((s) => s.severity === filter)),
    [signals, filter],
  )

  /* Only signals with a destination take part in the roving order. A row
     with a null href has nothing for Enter to do, and letting the cursor
     land on it would advertise an activation that never happens. Screen
     readers still read those rows — they are list content, not tab stops. */
  const navigable = React.useMemo(
    () => visible.filter((signal) => signal.href !== null).map((signal) => signal.id),
    [visible],
  )

  /* Derived, never stored: a filter change can hide the row that held focus,
     and a stale id would leave the board with no tabindex 0 at all. */
  const rovingId =
    activeId !== null && navigable.includes(activeId) ? activeId : (navigable[0] ?? null)

  function move(delta: number) {
    if (navigable.length === 0) return
    const from = rovingId === null ? -1 : navigable.indexOf(rovingId)
    const next = Math.min(Math.max(from + delta, 0), navigable.length - 1)
    const id = navigable[next]
    setActiveId(id)
    rowRefs.current.get(id)?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    /* Chips live in this container too; their own Space/Enter must survive,
       and a modifier combination belongs to the browser. */
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const key = event.key
    if (key === 'j' || key === 'ArrowDown') {
      event.preventDefault()
      move(1)
      return
    }
    if (key === 'k' || key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
      return
    }
    if (key === 'Escape') {
      /* Rows only. The filter chips live in this same container, and an
         Escape pressed on one of them used to eject the reader from the whole
         lower half of the page. */
      if (!(event.target instanceof HTMLElement) || !event.target.closest('[data-signal-row]')) {
        return
      }
      /* No blur. Blurring hands focus to <body>, which resets the sequential
         navigation start to the top of the DOCUMENT — the next Tab lands on
         the skip link, not back in the board, and nothing on screen wears a
         ring to say where focus went (WCAG 2.4.3, 2.4.7). Clearing activeId
         alone already achieves the intent: the roving tabindex returns to the
         first row, so tabbing back INTO the board re-enters at the top. */
      setActiveId(null)
    }
  }

  if (signals.length === 0) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-dashed border-border bg-card/40',
          className,
        )}
      >
        <EmptyState
          icon={PawPrint}
          title="Nothing is barking."
          description="No overdue tasks, no owed follow-ups, no sprint running short and no app gone quiet. LogPup re-checks every time you open this page."
        />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)} onKeyDown={handleKeyDown}>
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', ...SEVERITY_ORDER] as const).map((value) => {
          const count = value === 'all' ? signals.length : counts[value]
          if (value !== 'all' && count === 0) return null
          const active = filter === value
          return (
            <Button
              key={value}
              type="button"
              size="xs"
              variant={active ? 'secondary' : 'ghost'}
              aria-pressed={active}
              onClick={() => setFilter(value)}
              className={cn(!active && 'text-muted-foreground')}
            >
              {value === 'all' ? 'Everything' : SEVERITY[value].label}
              <span className="font-mono text-2xs tabular-nums">{count}</span>
            </Button>
          )
        })}
        <span className="ml-auto hidden items-center gap-1 text-2xs text-muted-foreground sm:flex">
          <Kbd>j</Kbd>
          <Kbd>k</Kbd>
          to move, <Kbd>Enter</Kbd> to open
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40">
          <EmptyState
            icon={PawPrint}
            title={`Nothing under "${filter === 'all' ? 'that filter' : SEVERITY[filter].label}".`}
            description="The other severities still have signals waiting."
            action={
              <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                Show everything
              </Button>
            }
          />
        </div>
      ) : (
        SEVERITY_ORDER.map((severity) => {
          const group = visible.filter((signal) => signal.severity === severity)
          if (group.length === 0) return null
          return (
            <section key={severity} className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {SEVERITY[severity].label}
                <span className="font-mono text-2xs tabular-nums normal-case">
                  {group.length}
                </span>
              </h3>
              <ul className="flex flex-col gap-2">
                {group.map((signal) => (
                  <li key={signal.id}>
                    <SignalRow
                      signal={signal}
                      roving={signal.id === rovingId}
                      onFocus={() => setActiveId(signal.id)}
                      register={(node) => {
                        if (node) rowRefs.current.set(signal.id, node)
                        else rowRefs.current.delete(signal.id)
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}

function SignalRow({
  signal,
  roving,
  onFocus,
  register,
}: {
  signal: Signal
  roving: boolean
  onFocus: () => void
  register: (node: HTMLAnchorElement | null) => void
}) {
  const tone = SEVERITY[signal.severity]
  const Icon = tone.icon

  const body = (
    <>
      <span aria-hidden className={cn('w-0.5 shrink-0 self-stretch rounded-full', tone.rail)} />
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', tone.ink)} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{signal.title}</span>
        <span className="text-sm text-muted-foreground">{signal.detail}</span>
      </span>
      {/* Deliberately NOT tone.ink. At text-base/bold this is 16px, which is
          not WCAG "large text" (that starts at 18.66px bold), so it owes the
          full 4.5:1 — and light-theme --chart-1 on this card surface measures
          3.65:1. Darkening the token is not an option: it is shared. Severity
          is already carried by the rail, the icon, the group heading and the
          sr-only word, so the number loses nothing by being plain. */}
      <span className="shrink-0 font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
        {signal.count}
      </span>
    </>
  )

  const shared =
    'flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-xs backdrop-blur-sm transition-[background-color,border-color,box-shadow] duration-(--dur-base) ease-out motion-reduce:transition-none'

  if (signal.href === null) {
    /* No destination, so no link, no tab stop and no hover affordance —
       nothing here may look like it can be opened. */
    return (
      <div className={shared}>
        <span className="sr-only">{tone.label}, nowhere to open.</span>
        {body}
      </div>
    )
  }

  return (
    <Link
      ref={register}
      href={signal.href}
      // The marker the container's Escape branch scopes itself to, so the
      // filter chips above cannot trigger it.
      data-signal-row
      tabIndex={roving ? 0 : -1}
      onFocus={onFocus}
      className={cn(
        shared,
        'outline-none hover:border-border hover:bg-card focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40',
      )}
    >
      <span className="sr-only">{tone.label}.</span>
      {body}
    </Link>
  )
}

function tally(signals: Signal[]): Record<SignalSeverity, number> {
  const counts: Record<SignalSeverity, number> = { alert: 0, watch: 0, info: 0 }
  for (const signal of signals) counts[signal.severity] += 1
  return counts
}
