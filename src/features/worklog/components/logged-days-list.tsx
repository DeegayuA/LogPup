import Link from 'next/link'
import { format } from 'date-fns'
import { CalendarCheck } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { bilingualText } from '@/features/meetings/components/meeting-chips'
import { loggedTone } from '@/features/worklog/day-state'
import { formatHours } from '@/features/worklog/entries'
import type { ScoreSource } from '@/features/worklog/auto-score'

/**
 * THE DAYS THAT HAVE A RECORD, AND ONLY THOSE.
 *
 * The calendar answers "what does my month look like", which means painting
 * every square — weekends, holidays, days nobody expected work on, and the
 * gaps. That is the right shape for spotting a hole and the wrong one for
 * reading back what you actually logged: a filled month and an empty one differ
 * by colour alone, and the days with something in them are scattered across
 * five rows of squares that mostly say nothing.
 *
 * This is the other question. One row per day that has a score, newest first,
 * with the number, where the number came from, the hours behind it and the
 * words. Nothing else — a day with no record is simply absent, which is the
 * whole point and why it needs no "empty" styling.
 *
 * SERVER-RENDERED, and the view lives in the URL (`?view=logged`) exactly as
 * the month and the selected day do, so this list is linkable and needs no
 * client state to hold which view somebody is on.
 */

export type LoggedDay = {
  day: string
  percent: number
  scoreSource: ScoreSource
  note: string | null
  /** Minutes recorded against the day, 0 when none. */
  minutes: number
  entryCount: number
  /** The projects those hours went to. Empty when the time named none. */
  apps: { id: string; name: string; slug: string }[]
}

export function LoggedDaysList({
  days,
  month,
  monthLabel,
}: {
  /** Days WITH a score, any order — sorted newest first here. */
  days: LoggedDay[]
  /** For the day links, so clicking one opens it in the calendar view. */
  month: string
  monthLabel: string
}) {
  if (days.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title={`Nothing logged in ${monthLabel} yet`}
        description="Days appear here as soon as they have a score — your own, or one worked out from the hours you log."
        className="rounded-xl border border-dashed"
      />
    )
  }

  const sorted = [...days].sort((a, b) => (a.day < b.day ? 1 : -1))
  const total = sorted.reduce((sum, day) => sum + day.minutes, 0)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-2xs text-muted-foreground">
        <span className="font-mono tabular-nums text-foreground">{sorted.length}</span>{' '}
        {sorted.length === 1 ? 'day' : 'days'} logged in {monthLabel}
        {total > 0 ? (
          <>
            {' · '}
            <span className="font-mono tabular-nums text-foreground">{formatHours(total)}h</span>{' '}
            recorded
          </>
        ) : null}
      </p>

      <ul className="flex flex-col gap-1.5">
        {sorted.map((entry) => (
          <li key={entry.day}>
            <Link
              href={`/worklog?month=${month}&day=${entry.day}`}
              className={cn(
                'flex flex-col gap-1 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5',
                'outline-none transition-colors motion-reduce:transition-none',
                'hover:border-border hover:bg-card focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-heading text-xs font-bold text-foreground">
                  {format(new Date(`${entry.day}T12:00:00`), 'EEE, MMM d')}
                </span>
                {/* The same tone the calendar paints the day with, so a square
                    and its row here can never disagree about how the day went. */}
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 font-mono text-2xs font-semibold',
                    loggedTone(entry.percent),
                  )}
                >
                  {entry.percent}%
                </span>
                {/* A derived score says so wherever it is shown — see
                    auto-score.ts. A division rendered exactly like a person's
                    own judgement is the one real cost of auto-scoring. */}
                {entry.scoreSource === 'from_hours' ? (
                  <span className="rounded bg-chart-1/15 px-1.5 py-0.5 font-sans text-2xs text-chart-1">
                    from hours
                  </span>
                ) : null}
                {entry.minutes > 0 ? (
                  <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                    {formatHours(entry.minutes)}h · {entry.entryCount}{' '}
                    {entry.entryCount === 1 ? 'entry' : 'entries'}
                  </span>
                ) : null}
              </div>
              {entry.note ? (
                <p className={cn(bilingualText, 'text-2xs text-muted-foreground')}>{entry.note}</p>
              ) : null}
              {/* WHERE THE HOURS WENT, from the entries' own app_id. Not parsed
                  out of the note: a day logged through the box sets the project
                  and writes no `[Project]` tag, so reading the text would show
                  nothing for exactly the days this list is mostly made of. */}
              {entry.apps.length > 0 ? (
                <span className="flex flex-wrap items-center gap-1">
                  {entry.apps.map((app) => (
                    <span
                      key={app.id}
                      className="rounded border border-event-3/40 bg-event-3/15 px-1.5 py-px font-mono text-2xs text-foreground"
                    >
                      {app.name}
                    </span>
                  ))}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
