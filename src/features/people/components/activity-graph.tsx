'use client'

import { format } from 'date-fns'
import {
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
} from '@/components/kibo-ui/contribution-graph'
import type { ActivityDay } from '@/features/people/activity-levels'

/** `YYYY-MM-DD` at local noon — the bare string parses as midnight UTC, which
 *  renders as the previous day west of Greenwich. */
function tooltip(iso: string, count: number): string {
  const day = format(new Date(`${iso}T12:00:00`), 'd MMM yyyy')
  if (count === 0) return `${day} — no tasks`
  return `${day} — ${count} ${count === 1 ? 'task' : 'tasks'}`
}

/**
 * The half-year grid, and NOTHING ELSE.
 *
 * This used to render the card's copy, the total and the legend too, all inside
 * the client bundle, even though every one of those is static text the server
 * could have emitted. The graph itself genuinely needs a client component — the
 * kibo primitive builds its week matrix in `useMemo` behind a context — so the
 * boundary is drawn as tightly as possible around it and PersonActivityCard
 * (a server component) owns everything around it. That is rule 7 applied
 * literally: the interactive part ships, the prose does not.
 *
 * `cellClassName` arrives as a prop rather than being defined here so the level
 * ramp lives in ONE file next to the legend that explains it — a legend that
 * can drift from the grid it describes is worse than no legend at all.
 *
 * The grid is `aria-hidden`: 180-odd rects announced one at a time is not a way
 * anyone reads six months of activity. PersonActivityCard states the same
 * information as a sentence for assistive tech instead. The per-cell `<title>`
 * below is therefore NOT an accessibility affordance — aria-hidden hides it
 * from the same tree the rects live in — it exists purely so a sighted reader
 * can hover a mark and learn which day it was, which is the one thing the
 * sr-only sentence gives screen readers and the picture did not give anyone
 * else.
 */
export function ActivityGraph({
  days,
  cellClassName,
}: {
  days: ActivityDay[]
  cellClassName: string
}) {
  return (
    <div aria-hidden>
      {/*
        blockSize is the primitive's own default rather than the 10 this used to
        pass: the card spans the full page width at `lg`, and a 10px block left
        the grid ~374px wide inside it, so a handful of small marks floated in a
        large empty card. Contrast does not change with size, but a 1.5:1 step
        is far easier to resolve across 144px² than across 100px².
      */}
      <ContributionGraph data={days} blockSize={12} fontSize={11}>
        {/*
          `tabIndex={-1}` on the calendar because it is the element carrying
          `overflow-x-auto`, and at 375px the half-year grid is wider than the
          card. Chrome puts keyboard-scrollable containers into the sequential
          focus order, which would have put a focus stop INSIDE an aria-hidden
          subtree — the aria-hidden-focus violation, where a keyboard user
          tabs onto something a screen reader insists is not there. Nothing is
          lost by removing it: the grid carries no information the sr-only
          sentence in PersonActivityCard does not state in full.
        */}
        <ContributionGraphCalendar
          tabIndex={-1}
          className="text-2xs text-muted-foreground"
        >
          {({ activity, dayIndex, weekIndex }) => (
            <ContributionGraphBlock
              activity={activity}
              dayIndex={dayIndex}
              weekIndex={weekIndex}
              className={cellClassName}
            >
              {/* `ContributionGraphBlock` spreads its props onto the `<rect>`,
                  so this child lands inside it. `<rect><title>…</title></rect>`
                  is valid SVG and gives a native tooltip with no wrapper `<g>`
                  and no change to the primitive. */}
              <title>{tooltip(activity.date, activity.count)}</title>
            </ContributionGraphBlock>
          )}
        </ContributionGraphCalendar>
      </ContributionGraph>
    </div>
  )
}
