import type { SeriesTableRow } from '@/features/meeting-load/queries'

/** Below this, an agenda is not really expected, so the agenda rate would read
 *  as a failing grade for meetings that never needed one. Excluded at DISPLAY
 *  time so the row still renders every other column intact. */
const AGENDA_RATE_MIN_MINUTES = 20

/**
 * One row per inferred series.
 *
 * NO PERSON IS NAMED ANYWHERE ON THIS TABLE. Churn is a COUNT — it says a
 * series has not settled on who it is for, which is a property of the series;
 * who joined and who left is a claim about individuals and at nine people
 * de-anonymises instantly.
 *
 * The model is shown beside the output counts because it changes what those
 * counts mean: two Gemini versions do not extract at the same rate, so a reader
 * comparing two series has to be able to see whether they are even comparable.
 */
export function SeriesLoadTable({ rows }: { rows: SeriesTableRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No series established yet — a title has to repeat at least twice inside six months
        before there is a pattern to read.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full min-w-[52rem] text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="p-2 text-left font-medium">Series</th>
            <th scope="col" className="p-2 text-right font-medium">Occurrences</th>
            <th scope="col" className="p-2 text-right font-medium">Hours each</th>
            <th scope="col" className="p-2 text-right font-medium">Median length</th>
            <th scope="col" className="p-2 text-right font-medium">Invite churn</th>
            <th scope="col" className="p-2 text-right font-medium">Outputs (AI / manual)</th>
            <th scope="col" className="p-2 text-right font-medium">Speakers / turns</th>
            <th scope="col" className="p-2 text-right font-medium">Recorded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.groupKey} className="border-t border-border/60">
              <th scope="row" className="p-2 text-left font-normal">{row.seriesKey}</th>
              <td className="p-2 text-right tabular-nums">{row.occurrenceCount}</td>
              <td className="p-2 text-right tabular-nums">
                {row.invitedHoursPerOccurrence.toFixed(1)}h
              </td>
              <td className="p-2 text-right tabular-nums">
                {row.medianDurationMinutes < AGENDA_RATE_MIN_MINUTES ? (
                  <span title="Too short for an agenda to be expected">
                    {Math.round(row.medianDurationMinutes)}m
                  </span>
                ) : (
                  `${Math.round(row.medianDurationMinutes)}m`
                )}
              </td>
              <td className="p-2 text-right tabular-nums">{row.churnCount}</td>
              <td className="p-2 text-right tabular-nums">
                {row.aiDerivedOutputs} / {row.manualOutputs}
              </td>
              <td className="p-2 text-right tabular-nums">
                {row.medianMappedSpeakers} / {row.medianVoiceTurns}
              </td>
              <td className="p-2 text-right tabular-nums">
                {Math.round(row.coverage * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
