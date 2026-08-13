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

/**
 * Shortest a meeting may be shrunk to by an edge drag. 15 minutes, the same
 * number as `SNAP_MINUTES` — a duration finer than the grid's own snap could
 * never be produced by a drag in the first place, so the floor and the grain
 * share one constant instead of two that happen to agree today and drift
 * tomorrow.
 */
export const MIN_MEETING_MINUTES = SNAP_MINUTES

/**
 * The meeting's new window after dragging its TOP edge by `minuteDelta`
 * (already snapped — see `draggedMinutes`, the same conversion the move path
 * uses).
 *
 * ONLY THE START MOVES. The end comes back as a fresh `Date` built from the
 * input's own time rather than the input reference itself, so nothing a
 * caller does to the result can reach back and mutate the meeting object it
 * read from. The easy bug here is recomputing the duration and shifting the
 * end along with it — done that way, dragging the top edge down also drags
 * the end down, silently shortening a meeting nobody touched the bottom of.
 *
 * CLAMPED, NEVER INVERTED: the start cannot cross past
 * `endsAt - MIN_MEETING_MINUTES`. Dragging the top edge below the bottom one
 * lands the meeting at its shortest legal length instead of putting the end
 * before the start.
 */
export function resizeMeetingStartByDrag(input: {
  startsAt: Date
  endsAt: Date
  minuteDelta: number
}): { startsAt: Date; endsAt: Date } {
  const { startsAt, endsAt, minuteDelta } = input
  const latestStartMs = endsAt.getTime() - MIN_MEETING_MINUTES * 60_000
  const proposedStartMs = startsAt.getTime() + minuteDelta * 60_000
  const clampedStartMs = Math.min(proposedStartMs, latestStartMs)
  return { startsAt: new Date(clampedStartMs), endsAt: new Date(endsAt) }
}

/**
 * The meeting's new window after dragging its BOTTOM edge by `minuteDelta`.
 * The mirror of `resizeMeetingStartByDrag`: only the end moves, returned as a
 * fresh `Date`, and it is clamped to `startsAt + MIN_MEETING_MINUTES` rather
 * than allowed to cross back above the start.
 */
export function resizeMeetingEndByDrag(input: {
  startsAt: Date
  endsAt: Date
  minuteDelta: number
}): { startsAt: Date; endsAt: Date } {
  const { startsAt, endsAt, minuteDelta } = input
  const earliestEndMs = startsAt.getTime() + MIN_MEETING_MINUTES * 60_000
  const proposedEndMs = endsAt.getTime() + minuteDelta * 60_000
  const clampedEndMs = Math.max(proposedEndMs, earliestEndMs)
  return { startsAt: new Date(startsAt), endsAt: new Date(clampedEndMs) }
}

/**
 * True when a resize actually changed the meeting's start or end. A resize
 * needs its own version of `isRealMove`'s guard rather than reusing a
 * pre-clamp `minuteDelta !== 0` check: the minimum-duration clamp above can
 * absorb a nonzero drag entirely (shrinking an edge that is already at the
 * floor produces the same window it started from), and that no-op deserves
 * the same skip a snapped-back move gets.
 */
export function isRealResize(
  before: { startsAt: Date; endsAt: Date },
  after: { startsAt: Date; endsAt: Date },
): boolean {
  return (
    before.startsAt.getTime() !== after.startsAt.getTime() ||
    before.endsAt.getTime() !== after.endsAt.getTime()
  )
}
