import { CircleAlert, CircleHelp, FileQuestion } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Figure } from '@/features/signals/figure'
import type { PersonSignals } from '@/features/signals/queries'
import type { Scorecard } from '@/features/signals/roles/shared'

/**
 * What this page is careful NOT to draw.
 *
 * There is no progress bar anywhere below, and there cannot be one. A bar
 * needs a denominator somebody measured, and the two a productivity page would
 * reach for are both unavailable: there is no honest conversion from hours to
 * output, and nobody knows what a person's week "should" contain. Every figure
 * here is therefore a number beside its own words, and the verdict strip is
 * four counts rather than a filled track — because a filled track would say
 * "72% productive", which is a sentence this app has no right to.
 *
 * The other rule the layout enforces: `quiet` and `unclaimed` render as
 * siblings, in that order, and neither is conditional on the other. A page
 * that showed only the first would be a tool for catching people; showing both
 * is a tool for finding out what happened.
 */

const VERDICT_COPY: Record<string, { label: string; help: string }> = {
  strong: { label: 'Something finished', help: 'A task closed, a commit landed, a question got answered.' },
  partial: { label: 'Present and engaged', help: 'Cards moved, meetings attended, spoke up, wrote the day down.' },
  none: { label: 'No trace found', help: 'Nothing on any of the channels below. Not the same as nothing happening.' },
  notApplicable: { label: 'Not a working day', help: 'Leave, a weekend, or a holiday.' },
}

export function SignalsView({
  signals,
  scorecards,
  personName,
  isSelf,
}: {
  signals: PersonSignals
  scorecards: Scorecard<string>[]
  personName: string
  isSelf: boolean
}) {
  const { summary } = signals

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-3">
        <div className="px-4">
          <h2 className="text-sm font-medium">
            {signals.window.from} to {signals.window.to}
          </h2>
          <p className="text-xs text-muted-foreground">
            {signals.window.workingDays} working {signals.window.workingDays === 1 ? 'day' : 'days'} in
            this window, after weekends, holidays and approved leave. Every rate below divides by
            that, never by calendar days.
          </p>
        </div>

        {/* Four counts, deliberately not a bar. A filled track here would read
            as "N% productive" — a claim nothing in this app can support. */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-4">
          {(['strong', 'partial', 'none', 'notApplicable'] as const).map((key) => (
            <div key={key} className="bg-card px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{VERDICT_COPY[key].label}</dt>
              <dd className="font-heading text-xl tabular-nums">{summary[key]}</dd>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {VERDICT_COPY[key].help}
              </p>
            </div>
          ))}
        </dl>
      </Card>

      <section id="quiet" className="flex flex-col gap-3 scroll-mt-20">
        <h2 className="font-heading text-lg">Quiet stretches</h2>
        {signals.quiet.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No run of {' '}
            <strong className="font-medium text-foreground">three or more</strong> working days
            without a trace. A single quiet day is normal and is never raised here.
          </p>
        ) : (
          signals.quiet.map((run) => (
            <Card key={`${run.from}-${run.to}`} className="gap-2 ring-warning/40">
              <div className="flex items-start gap-2 px-4">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="text-sm font-medium">
                    {run.days} working days with nothing recorded — {run.from} to {run.to}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(run.claimedMinutes / 60)} hours were logged across them.
                  </p>
                </div>
              </div>
              {/* "Nothing was found" is a claim about the observer too. The
                  person it is said about is entitled to the list of places
                  that were searched — not least so they can point at the one
                  that is missing. */}
              <details className="px-4 text-xs text-muted-foreground">
                <summary className="cursor-pointer">What was checked</summary>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                  {run.checkedChannels.map((channel) => (
                    <li key={channel}>{channel}</li>
                  ))}
                </ul>
                <p className="mt-2 leading-relaxed">
                  Reading, thinking, pairing at somebody else&rsquo;s desk and the hours before a
                  hard bug gives way all leave no trace on any of these. This is a prompt to ask
                  {isSelf ? '' : ` ${personName}`}, not a finding about
                  {isSelf ? ' you' : ' them'}.
                </p>
              </details>
            </Card>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg">Worked, never logged</h2>
        {signals.unclaimed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every day with visible work has hours against it.
          </p>
        ) : (
          <Card className="gap-2">
            <div className="flex items-start gap-2 px-4">
              <FileQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {signals.unclaimed.length}{' '}
                  {signals.unclaimed.length === 1 ? 'day has' : 'days have'} activity but no worklog
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {signals.unclaimed.map((day) => (
                    <li key={day.day}>
                      <span className="tabular-nums">{day.day}</span> — {day.observations}{' '}
                      {day.observations === 1 ? 'thing' : 'things'} recorded, no hours
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}
      </section>

      {scorecards.map((card) => (
        <section key={card.role} className="flex flex-col gap-3">
          <h2 className="font-heading text-lg capitalize">{card.role} signals</h2>
          {card.caveat ? (
            /* Rendered WITH the numbers, not as a tooltip. Somebody deciding
               something about a person needs the caveat in the same eyeful as
               the figures, or the figures read as complete. */
            <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {card.caveat}
            </p>
          ) : null}
          <div className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2">
            {card.figures.map((figure) => (
              <FigureCell key={figure.key} figure={figure} figures={card.figures} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function FigureCell({ figure, figures }: { figure: Figure; figures: Figure[] }) {
  const counter = figure.counter ? figures.find((f) => f.key === figure.counter) : undefined

  return (
    <div className="bg-card px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {figure.label}
        {/* A proxy and a count are different claims, and a reader deciding
            something about somebody's week is entitled to know which one is
            on screen. */}
        {figure.basis === 'inferred' ? (
          <span className="rounded bg-muted px-1 text-[10px] tracking-wide uppercase">proxy</span>
        ) : null}
      </p>
      {figure.value === null ? (
        <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
          <CircleHelp className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {figure.unavailable}
        </p>
      ) : (
        <p className="font-heading text-xl tabular-nums">
          {formatFigure(figure)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {unitSuffix(figure)}
          </span>
        </p>
      )}
      {counter ? (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Read with <span className="text-foreground">{counter.label}</span> —{' '}
          {counter.value === null ? 'not available' : `${formatFigure(counter)}${unitSuffix(counter)}`}
        </p>
      ) : null}
    </div>
  )
}

function formatFigure(figure: Figure): string {
  if (figure.value === null) return '—'
  if (figure.unit === 'percent') return String(figure.value)
  return String(figure.value)
}

function unitSuffix(figure: Figure): string {
  switch (figure.unit) {
    case 'percent':
      return '%'
    case 'days':
      return figure.value === 1 ? ' day' : ' days'
    case 'perWorkingDay':
      return ' / day'
    default:
      return ''
  }
}

export function SignalsHelp({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs leading-relaxed text-muted-foreground', className)}>
      Nothing on this page is a productivity score, and there is no single number to rank anyone
      by. Each figure sits beside the one that gets worse if it is gamed, and anything this
      workspace cannot observe says so rather than showing a zero.
    </p>
  )
}
