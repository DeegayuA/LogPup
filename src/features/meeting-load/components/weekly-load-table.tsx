import type { WeeklyLoadRow } from '@/features/meeting-load/queries'

/**
 * Twelve weeks, one row each.
 *
 * EVERY COLUMN EXPANDS EXCEPT RSVP ADOPTION, and that exception is the point
 * rather than an oversight. Expanding a week's hours shows which meetings made
 * them up, which is how somebody checks the number. Expanding RSVP adoption
 * would hand out a list of who has not replied — turning an adoption statistic
 * into a hunt. The aggregate stays, the drill-down does not.
 */
export function WeeklyLoadTable({ rows }: { rows: WeeklyLoadRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No meetings recorded in this window.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full min-w-[46rem] text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="p-2 text-left font-medium">Week</th>
            <th scope="col" className="p-2 text-right font-medium">Invited hours</th>
            <th scope="col" className="p-2 text-right font-medium">Meetings</th>
            <th scope="col" className="p-2 text-right font-medium">Recorded</th>
            <th scope="col" className="p-2 text-right font-medium">No agenda</th>
            <th scope="col" className="p-2 text-right font-medium">No project</th>
            <th scope="col" className="p-2 text-right font-medium">Overlapping</th>
            <th scope="col" className="p-2 text-right font-medium">Awaiting a reply</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.weekStartIso} className="border-t border-border/60">
              <th scope="row" className="p-2 text-left font-normal tabular-nums">
                {row.weekStartIso}
              </th>
              <td className="p-2 text-right tabular-nums">{Math.round(row.invitedHours)}h</td>
              <td className="p-2 text-right tabular-nums">{row.meetingCount}</td>
              <td className="p-2 text-right tabular-nums">{Math.round(row.coverage * 100)}%</td>
              <td className="p-2 text-right tabular-nums">{row.noAgendaCount}</td>
              <td className="p-2 text-right tabular-nums">{row.noAppCount}</td>
              <td className="p-2 text-right tabular-nums">{row.overlapHours.toFixed(1)}h</td>
              {/* A count, and nothing to open. */}
              <td className="p-2 text-right tabular-nums text-muted-foreground">
                {row.rsvpAdoption.pending}/{row.rsvpAdoption.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
