import { isoDayAdd } from '@/features/people/iso-day'

/**
 * Every day an absence covers that falls inside the half-open window
 * `[from, to)`.
 *
 * An absence's own bounds are INCLUSIVE on both ends — they are dates a
 * person stated in words — so the two conventions are clipped against each
 * other in exactly one place rather than wherever a day could be gained or
 * lost.
 *
 * LIFTED OUT OF /worklog's page ON PURPOSE. It lived as a private function
 * there, which meant /intel could not ask the same question and answered a
 * different one instead: it counted days covered by a PENDING absence as
 * work-log gaps, so somebody waiting on leave approval saw an alert they had
 * no way to clear, on days /worklog was simultaneously treating as excused.
 * Two surfaces disagreeing about the same days is worse than either answer
 * alone, because the reader cannot tell which one is lying.
 *
 * WHICH ABSENCES TO PASS IS THE CALLER'S DECISION, and the reason this takes
 * ranges rather than fetching them: "approved only" is right for a coverage
 * denominator (a pending request is not yet a fact) and wrong for an alert
 * (telling someone to fill a day they have already asked to be away for is
 * noise they cannot act on). This clips days; it does not decide which
 * absences count.
 */
export function absenceDays(
  ranges: readonly { startDate: string; endDate: string }[],
  from: string,
  to: string,
): Set<string> {
  const days = new Set<string>()
  for (const range of ranges) {
    let day = range.startDate < from ? from : range.startDate
    // isoDayAdd rather than a local date walk: this repo already had three
    // day-shift helpers (isoDayAdd, addDaysIso, and the private shiftDay this
    // replaced), and a fourth would be one more place for the Colombo/UTC
    // boundary to be got wrong independently.
    for (; day <= range.endDate && day < to; day = isoDayAdd(day, 1)) days.add(day)
  }
  return days
}
