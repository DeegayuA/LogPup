import { CheckCircle2, Mic, Repeat, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SeriesTableRow } from '@/features/meeting-load/queries'

/** Below this, an agenda is not really expected, so the agenda rate would read
 *  as a failing grade for meetings that never needed one. Excluded at DISPLAY
 *  time so the row still renders every other column intact. */
const AGENDA_RATE_MIN_MINUTES = 20

/**
 * One row per inferred series.
 *
 * NO PERSON IS NAMED ANYWHERE ON THIS TABLE. Churn is a COUNT — it says a
 * series has not settled on who it is for, which is a property of the series.
 */
export function SeriesLoadTable({ rows }: { rows: SeriesTableRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 text-center backdrop-blur-sm">
        <Repeat className="size-8 text-muted-foreground/50" aria-hidden />
        <p className="mt-2 text-sm font-medium text-foreground">No recurring series established yet</p>
        <p className="text-xs text-muted-foreground">
          A title must repeat at least twice within a 6-month window before a pattern is identified.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-xs backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="py-3.5 px-4 font-semibold">
                Series Title
              </th>
              <th scope="col" className="py-3.5 px-4 text-center font-semibold">
                Occurrences
              </th>
              <th scope="col" className="py-3.5 px-4 text-right font-semibold">
                Hours Each
              </th>
              <th scope="col" className="py-3.5 px-4 text-right font-semibold">
                Median Length
              </th>
              <th scope="col" className="py-3.5 px-4 text-center font-semibold">
                Invite Churn
              </th>
              <th scope="col" className="py-3.5 px-4 text-center font-semibold">
                Outputs (AI / Manual)
              </th>
              <th scope="col" className="py-3.5 px-4 text-center font-semibold">
                Speakers &amp; Turns
              </th>
              <th scope="col" className="py-3.5 px-4 text-center font-semibold">
                Recorded
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => {
              const coveragePct = Math.round(row.coverage * 100)
              const isShort = row.medianDurationMinutes < AGENDA_RATE_MIN_MINUTES

              return (
                <tr
                  key={row.groupKey}
                  className="group transition-colors hover:bg-muted/30"
                >
                  {/* Series Name */}
                  <th scope="row" className="py-3 px-4 font-normal text-foreground">
                    <div className="flex items-center gap-2">
                      <Repeat className="size-3.5 shrink-0 text-primary" aria-hidden />
                      <span className="font-semibold text-foreground tracking-tight">
                        {row.seriesKey}
                      </span>
                    </div>
                  </th>

                  {/* Occurrences */}
                  <td className="py-3 px-4 text-center">
                    <Badge variant="secondary" className="font-mono text-2xs font-medium">
                      {row.occurrenceCount} sessions
                    </Badge>
                  </td>

                  {/* Hours Each */}
                  <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                    {row.invitedHoursPerOccurrence.toFixed(1)}h
                  </td>

                  {/* Median Length */}
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {isShort ? (
                      <span
                        title="Short duration session"
                        className="inline-flex items-center rounded-md bg-muted/50 px-1.5 py-0.5 text-2xs"
                      >
                        {Math.round(row.medianDurationMinutes)}m
                      </span>
                    ) : (
                      <span className="font-medium text-foreground">
                        {Math.round(row.medianDurationMinutes)}m
                      </span>
                    )}
                  </td>

                  {/* Invite Churn */}
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-2xs font-medium ${
                        row.churnCount > 3
                          ? 'border-chart-1/25 bg-chart-1/10 text-chart-1'
                          : row.churnCount > 0
                            ? 'border-border/70 bg-muted/40 text-muted-foreground'
                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {row.churnCount === 0 ? 'Stable' : `${row.churnCount} changes`}
                    </span>
                  </td>

                  {/* Outputs (AI / Manual) */}
                  <td className="py-3 px-4 text-center font-mono text-xs tabular-nums">
                    <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-0.5 shadow-2xs">
                      <Sparkles className="size-3 text-primary" aria-hidden />
                      <strong className="text-primary">{row.aiDerivedOutputs}</strong>
                      <span className="text-muted-foreground/60">/</span>
                      <span className="text-muted-foreground">{row.manualOutputs}</span>
                    </span>
                  </td>

                  {/* Speakers / Turns */}
                  <td className="py-3 px-4 text-center font-mono text-xs tabular-nums text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Mic className="size-3 text-muted-foreground/60" aria-hidden />
                      <strong className="font-medium text-foreground">
                        {row.medianMappedSpeakers}
                      </strong>
                      <span className="text-muted-foreground/50">spk</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{row.medianVoiceTurns} turns</span>
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
