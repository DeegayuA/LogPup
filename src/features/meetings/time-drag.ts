/**
 * Pixels-dragged -> a new meeting time, for the week/day time grid.
 *
 * The inverse of the geometry that draws a block: `eventGeometry` turns a
 * minute offset into `top` using `pxPerHour`, so a drag turns a pixel delta
 * back into minutes with `deltaPx * 60 / pxPerHour`. Kept out of the
 * component for the same reason as reschedule.ts — this is the part worth
 * unit-testing, and it must not need a DOM to be tested.
 */

/**
 * Drags land on a quarter hour. Free-form dragging produces times like 10:07
 * that nobody meant and every calendar in the world rounds away; 15 minutes
 * is also the finest snap that stays grabbable at the shortest zoom level.
 */
export const SNAP_MINUTES = 15

/**
 * Vertical pixels -> snapped minutes. Returns 0 for a nonsensical scale
 * rather than Infinity/NaN: a zero or negative `pxPerHour` should mean "no
 * movement", never a time jump to the epoch.
 */
export function draggedMinutes(
  deltaPx: number,
  pxPerHour: number,
  snapMinutes: number = SNAP_MINUTES,
): number {
  if (!Number.isFinite(deltaPx) || !Number.isFinite(pxPerHour) || pxPerHour <= 0) return 0
  if (snapMinutes <= 0) return Math.round((deltaPx * 60) / pxPerHour)
  const rawMinutes = (deltaPx * 60) / pxPerHour
  return Math.round(rawMinutes / snapMinutes) * snapMinutes
}

/**
 * The meeting's new window after a drag of `dayDelta` columns and
 * `minuteDelta` minutes.
 *
 * DURATION IS PRESERVED BY MILLISECONDS, not by re-stamping the end's clock
 * time — the same rule (and the same DST trade) as moveMeetingToDay: an hour
 * stays an hour even when the move crosses a boundary.
 *
 * The START IS CLAMPED into the visible hour window, and the whole meeting
 * with it. Without this, one over-enthusiastic drag files a meeting at 03:00
 * on a grid that begins at 07:00 — the write succeeds, the block vanishes,
 * and the only way back is the detail dialog. Clamping keeps a drag
 * reversible by another drag. The end is deliberately NOT clamped: a long
 * meeting may run past the grid's last hour, exactly as one scheduled that
 * way already does.
 */
export function moveMeetingByDrag(input: {
  startsAt: Date
  endsAt: Date
  dayDelta: number
  minuteDelta: number
  gridStartHour: number
  gridEndHour: number
}): { startsAt: Date; endsAt: Date } {
  const { startsAt, endsAt, dayDelta, minuteDelta, gridStartHour, gridEndHour } = input
  const durationMs = endsAt.getTime() - startsAt.getTime()

  // THE DAY COMES FROM THE COLUMN, THE TIME FROM THE VERTICAL DRAG, and the
  // two are resolved separately on purpose. Adding both deltas to one Date
  // and clamping the result lets a large vertical drag spill past midnight
  // and silently change the day — so dropping a block inside its own column
  // could file it on the next one. The grid's model is that a column IS a
  // day; only `dayDelta` may change it.
  const day = new Date(startsAt)
  day.setDate(day.getDate() + dayDelta)

  const minutesOfDay = startsAt.getHours() * 60 + startsAt.getMinutes() + minuteDelta
  // The latest a meeting may START is the final minute of the grid's last
  // hour — not the boundary itself, which is the next day's first row.
  const earliest = gridStartHour * 60
  const latest = gridEndHour * 60 - 1
  const clampedMinutes = Math.min(Math.max(minutesOfDay, earliest), latest)

  const nextStart = new Date(day)
  nextStart.setHours(Math.floor(clampedMinutes / 60), clampedMinutes % 60, 0, 0)

  return { startsAt: nextStart, endsAt: new Date(nextStart.getTime() + durationMs) }
}

/**
 * True when a drag actually moved the meeting. dnd-kit fires a drag-end for
 * every press that travelled past the activation distance, including one
 * that snapped back to where it started — writing that would be a no-op
 * UPDATE, a revalidate, and an activity-trail row claiming a meeting moved
 * to the time it was already at.
 */
export function isRealMove(dayDelta: number, minuteDelta: number): boolean {
  return dayDelta !== 0 || minuteDelta !== 0
}
