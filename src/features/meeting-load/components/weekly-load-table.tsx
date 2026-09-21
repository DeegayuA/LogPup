import { AlertCircle, Calendar, CheckCircle2, Clock } from 'lucide-react'
import type { WeeklyLoadRow } from '@/features/meeting-load/queries'

/**
 * Twelve weeks, one row each.
 *
 * EVERY COLUMN EXPANDS EXCEPT RSVP ADOPTION: expanding a week's hours shows
 * which meetings made them up. Expanding RSVP adoption would hand out a list
 * of who has not replied — turning an adoption statistic into a hunt.
 */
export function WeeklyLoadTable({ rows }: { rows: WeeklyLoadRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 text-center backdrop-blur-sm">
        <Calendar className="size-8 text-muted-foreground/50" aria-hidden />
        <p className="mt-2 text-sm font-medium text-foreground">No meetings recorded in this window</p>
        <p className="text-xs text-muted-foreground">
          Historical weeks will populate as meetings are scheduled and logged.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-xs backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[50rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="py-3.5 px-4 font-semibold">
                Week Starting
              </th>
              <th scope="col" className="py-3.5 px-4 text-right font-semibold">
                Invited Hours
              </th>
              <th scope="col" className="py-3.5 px-4 text-right font-semibold">
                Meetings
              </th>
              <th scope="col" className="py-3.5 px-4 text-center font-semibold">
                Recorded
              </th>
              <th scope="col" className="py-3.5 px-4 text-right font-semibold">
                No Agenda
              </th>
              <th scope="col" className="py-3.5 px-4 text-right font-semibold">
                No Project
              </th>
              <th scope="col" className="py-3.5 px-4 text-right font-semibold">
                Overlapping
              </th>
              <th scope="col" className="py-3.5 px-4 text-right font-semibold">
                Awaiting Reply
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => {
              const coveragePct = Math.round(row.coverage * 100)
              const hasOverlaps = row.overlapHours > 0
              const hasNoAgenda = row.noAgendaCount > 0
              const hasNoApp = row.noAppCount > 0

              return (
                <tr
                  key={row.weekStartIso}
                  className="group transition-colors hover:bg-muted/30"
                >
                  {/* Week Start */}
                  <th
                    scope="row"
                    className="py-3 px-4 font-mono text-xs font-semibold tabular-nums text-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                      <span>{row.weekStartIso}</span>
                    </div>
                  </th>

                  {/* Invited Hours */}
                  <td className="py-3 px-4 text-right font-mono text-sm font-bold tabular-nums text-foreground">
                    {Math.round(row.invitedHours)}h
                  </td>

                  {/* Meeting Count */}
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    <span className="rounded-md border border-border/70 bg-muted/40 px-2 py-0.5">
                      {row.meetingCount}
                    </span>
                  </td>

                  {/* Recorded Coverage */}
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-2xs font-semibold ${
                        coveragePct >= 75
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : coveragePct >= 40
                            ? 'border-chart-1/25 bg-chart-1/10 text-chart-1'
                            : 'border-border/70 bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      {coveragePct >= 75 ? (
                        <CheckCircle2 className="size-3" aria-hidden />
                      ) : null}
                      {coveragePct}%
                    </span>
                  </td>

                  {/* No Agenda */}
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                    {hasNoAgenda ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-chart-1/20 bg-chart-1/10 px-2 py-0.5 text-2xs font-medium text-chart-1">
                        <AlertCircle className="size-3" aria-hidden />
                        {row.noAgendaCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">0</span>
                    )}
                  </td>

                  {/* No Project */}
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                    {hasNoApp ? (
                      <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                        {row.noAppCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">0</span>
                    )}
                  </td>

                  {/* Overlapping Hours */}
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                    {hasOverlaps ? (
                      <span className="inline-flex items-center gap-1 font-bold text-chart-1">
                        <span className="size-1.5 rounded-full bg-chart-1 animate-pulse" />
                        {row.overlapHours.toFixed(1)}h
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">0.0h</span>
                    )}
                  </td>

                  {/* Awaiting a reply */}
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    <span className="rounded-md bg-muted/30 px-2 py-0.5">
                      <strong className="font-semibold text-foreground">
                        {row.rsvpAdoption.pending}
                      </strong>
                      <span className="text-muted-foreground/60"> / {row.rsvpAdoption.total}</span>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
