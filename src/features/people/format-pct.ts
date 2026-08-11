/**
 * One place where an allocation percentage becomes text, so the dashboard,
 * the person page, the timeline and the "as of" view can never drift into
 * "60%" / "60 %" / "60.0%".
 *
 * PCT_CLASS goes on whatever element renders the result: mono + tabular-nums
 * keeps digits the same width, which is what stops a column of percentages
 * from jittering as values change (and stops the optimistic dashboard edit
 * from visibly reflowing its row).
 */
export const PCT_CLASS = 'font-mono tabular-nums'

export function formatPct(value: number): string {
  return `${Math.round(value)}%`
}
