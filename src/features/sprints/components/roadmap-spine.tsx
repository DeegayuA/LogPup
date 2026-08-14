import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  PX_PER_DAY,
  ZOOM_LABEL,
  ZOOM_LEVELS,
  barGeometry,
  offsetOfDate,
  packRows,
  rowCount,
  timelineWindow,
  type Zoom,
} from '@/features/sprints/roadmap-layout'
import { isoDayAdd } from '@/features/people/iso-day'
import { SpineScroller } from '@/features/sprints/components/spine-scroller'
import {
  HEALTH_WORD,
  completionCount,
  type SprintHealth,
  type SprintRead,
} from '@/features/sprints/plan-read'

/**
 * The spine: this app's sprints on one line of time, and the control that
 * picks which one the board below is showing.
 *
 * The schedule and the selector are the SAME object. That is the whole idea
 * of the merged surface — a sprint dropdown sitting next to a timeline would
 * be two controls for one decision, which is what having a Board tab and a
 * Roadmap tab was.
 *
 * Each bar carries its own progress as a fill, against a today-marker drawn
 * across every row. The distance between the two IS the answer to "are we
 * going to make it": a fill trailing the marker is behind, and it looks
 * behind before any number is read. This is the one place on the surface
 * where colour carries a quantity (design spec §4) — and the judgement it
 * paints comes from readSprint, which scores it on the same
 * BURN_GAP_THRESHOLD the app card's health verdict uses.
 *
 * Server component: pure layout over data the page already has.
 */
export type SpineSprint = {
  id: string
  name: string
  startDate: string
  endDate: string
  read: SprintRead
}

/**
 * Health lives in the FILL and nowhere else.
 *
 * The first version painted it three times over — border, background and fill
 * — which was both noisy and a direct clash with the full timeline below,
 * where the same bars are coloured by sprint STATUS (planned / active / done)
 * in a different palette. Two colour languages for one row of bars on one
 * page is how a reader learns to trust neither.
 *
 * So: the bar itself is neutral structure, and the one coloured thing is the
 * quantity — exactly what the design spec asked for ("the bar is the one
 * place colour carries a quantity"). Status stays the timeline's language;
 * progress-against-time is the spine's.
 *
 * Colour is never alone either way: HEALTH_WORD renders beside the name and
 * the whole judgement is in each bar's aria-label (WCAG 1.4.1 — "behind" vs
 * "overdue" is precisely the pair a red-green reader would otherwise lose).
 */
const HEALTH_FILL: Record<SprintHealth, string> = {
  'not-started': 'bg-muted-foreground/20',
  'on-track': 'bg-primary/30',
  behind: 'bg-warning/35',
  overdue: 'bg-destructive/30',
  complete: 'bg-success/30',
}

const ROW_HEIGHT_PX = 44
const ROW_GAP_PX = 8
/** Bars are drawn a shade narrow so two back-to-back sprints never read as
 *  one continuous block — the same trick the old roadmap used. */
const BAR_INSET_PX = 2

/**
 * Floor on a bar's width.
 *
 * The spine is a SELECTOR before it is a chart: a one-day sprint is 8px wide
 * at month zoom and 3px at quarter, which is an unclickable target carrying
 * an unreadable label. Positional truth is worth less here than being able to
 * hit the thing — and the bar still starts on its real start date, so what
 * bends is only the right edge of the shortest bars.
 */
const MIN_BAR_PX = 132

/**
 * `remainingDays` is "end − today", so 0 means the sprint ends TODAY rather
 * than that it is out of time. Same wording as readSprint's own summary.
 */
function remainingLabel(progress: SprintRead['progress']): string {
  return progress.remainingDays <= 0 ? 'ends today' : `${progress.remainingDays}d left`
}

export function RoadmapSpine({
  sprints,
  selectedId,
  todayIso,
  zoom,
  hrefFor,
  zoomHrefFor,
}: {
  /** Any order — the packer sorts and lays them out. */
  sprints: SpineSprint[]
  selectedId: string | null
  todayIso: string
  zoom: Zoom
  /** Where selecting a sprint goes. The page owns URL shape, not this. */
  hrefFor: (sprintId: string) => string
  /**
   * Where a zoom level goes. Server-rendered links, not the timeline's
   * `history.replaceState` control: the spine is a server component, so a URL
   * written without a navigation would leave it rendering at the old scale
   * forever — the control would appear to do nothing.
   */
  zoomHrefFor: (zoom: Zoom) => string
}) {
  if (sprints.length === 0) return null

  const spans = sprints.map((sprint) => ({
    id: sprint.id,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
  }))
  const window = timelineWindow(spans, todayIso)

  // The packer has to see the widths that will actually be DRAWN, not the
  // ones the dates imply. MIN_BAR_PX stretches a short bar rightwards while
  // its `left` stays truthful, so packing on raw dates would put a stretched
  // bar on the same row as the sprint that follows it — and since the bars
  // are absolutely positioned with no z-index, the one later in the DOM
  // (older, because sprints arrive newest-first) paints over the newer one,
  // hiding its name and eating the clicks that land on it. Padding each span
  // to its minimum drawn length first is what keeps a stretched bar from
  // being packed on top of its neighbour.
  //
  // gapDays stays 0: passing 1 requires a gap GREATER than a day to share a
  // row, so the normal cadence (one ends the 14th, the next starts the 15th)
  // could never pack and a year of sprints would zig-zag across two rows.
  const minBarDays = Math.max(1, Math.ceil(MIN_BAR_PX / PX_PER_DAY[zoom]))
  const packingSpans = spans.map((span) => {
    const minEnd = isoDayAdd(span.startDate, minBarDays - 1)
    // ISO dates compare correctly as strings — the whole codebase relies on
    // that rather than parsing them into Date objects.
    return { ...span, endDate: minEnd > span.endDate ? minEnd : span.endDate }
  })
  const rows = packRows(packingSpans)
  const totalRows = Math.max(1, rowCount(rows))
  const widthPx = window.totalDays * PX_PER_DAY[zoom]
  // +0.5 puts the line through the MIDDLE of today's column rather than on
  // the yesterday/today boundary — the same expression the full timeline
  // uses, so the two markers line up when both are on screen.
  const todayLeft = (offsetOfDate(window, todayIso) + 0.5) * PX_PER_DAY[zoom]
  const heightPx = totalRows * ROW_HEIGHT_PX + (totalRows - 1) * ROW_GAP_PX

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-2xs text-muted-foreground">
          Each bar fills with work done. The line is today.
        </p>
        <nav aria-label="Timeline scale" className="flex items-center gap-1">
          {ZOOM_LEVELS.map((level) => (
            <Link
              key={level}
              href={zoomHrefFor(level)}
              aria-current={level === zoom ? 'true' : undefined}
              className={cn(
                'rounded-md px-1.5 py-0.5 text-2xs outline-none',
                'transition-colors duration-150 motion-reduce:transition-none',
                'focus-visible:ring-2 focus-visible:ring-ring',
                level === zoom
                  ? 'bg-secondary font-medium text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {ZOOM_LABEL[level]}
            </Link>
          ))}
        </nav>
      </div>

      {/* Keyed by zoom so changing the scale re-runs the scroll: every pixel
          position changes with it, and a scrollLeft carried over from the
          previous scale lands somewhere arbitrary. */}
      <SpineScroller key={zoom} todayLeftPx={todayLeft} className="overflow-x-auto">
      <div className="relative" style={{ width: `${widthPx}px`, minWidth: '100%', height: `${heightPx}px` }}>
        {/* Today, once, across every row — the reference each fill is judged
            against. Decorative: the same fact is in every bar's accessible
            label, where it can be read out rather than merely seen. */}
        <div
          aria-hidden
          // pointer-events-none: it sits above the bars, and a 1px line that
          // eats clicks on whichever sprint is running today would break
          // selection for the one bar people reach for most.
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground/40"
          style={{ left: `${todayLeft}px` }}
        />

        {/* The list is the positioning context, and it is a real box.
            `display: contents` here would have been tidier CSS and is what
            this reached for first — but several browsers still drop the list
            role from an element with `display: contents`, which would take
            "list of N sprints" away from a screen reader for a purely visual
            convenience. */}
        <ul className="relative m-0 h-full list-none p-0">
          {sprints.map((sprint) => {
            const geometry = barGeometry(
              { id: sprint.id, startDate: sprint.startDate, endDate: sprint.endDate },
              window,
              zoom,
            )
            const row = rows.get(sprint.id) ?? 0
            const selected = sprint.id === selectedId
            const { health, donePct, progress } = sprint.read

            return (
              <li
                key={sprint.id}
                className="absolute"
                style={{
                  left: `${geometry.left + BAR_INSET_PX}px`,
                  width: `${Math.max(MIN_BAR_PX, geometry.width - BAR_INSET_PX * 2)}px`,
                  top: `${row * (ROW_HEIGHT_PX + ROW_GAP_PX)}px`,
                  height: `${ROW_HEIGHT_PX}px`,
                }}
              >
                <Link
                  href={hrefFor(sprint.id)}
                  data-selected={selected ? 'true' : undefined}
                  aria-current={selected ? 'true' : undefined}
                  // Everything the bar says visually, in words: which sprint,
                  // what state, the dates, and both sides of the
                  // time-versus-work comparison the fill encodes.
                  aria-label={`${sprint.name}. ${HEALTH_WORD[health]}. ${sprint.startDate} to ${sprint.endDate}. ${sprint.read.summary}`}
                  className={cn(
                    'group relative flex h-full w-full items-center overflow-hidden rounded-lg px-2',
                    'border border-border bg-muted/30',
                    'outline-none transition-colors duration-150 motion-reduce:transition-none',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    selected ? 'ring-2 ring-ring' : 'hover:border-foreground/30',
                  )}
                >
                  {/* Work done, as a share of this sprint's own width. */}
                  <span
                    aria-hidden
                    className={cn('absolute inset-y-0 left-0', HEALTH_FILL[health])}
                    style={{ width: `${donePct}%` }}
                  />
                  {/* Two lines: the NAME alone on the first, everything else
                      on the second. The health word shares the second line
                      rather than competing with the name for the first,
                      which is what lets it render unconditionally — it is
                      the partner that keeps the fill's colour from being the
                      only signal, so it must never be the thing that drops
                      out on a narrow bar. */}
                  <span className="relative flex min-w-0 flex-col leading-tight">
                    <span
                      className={cn(
                        'truncate text-sm',
                        selected ? 'font-semibold text-foreground' : 'font-medium',
                      )}
                    >
                      {sprint.name}
                    </span>
                    <span className="truncate text-2xs text-muted-foreground">
                      {HEALTH_WORD[health]}
                      <span className="font-mono tabular-nums">
                        {` · ${completionCount(sprint.read)}`}
                        {progress.phase === 'running' ? ` · ${remainingLabel(progress)}` : null}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        </div>
      </SpineScroller>
    </div>
  )
}
