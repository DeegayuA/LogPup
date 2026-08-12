'use client'

import {
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
} from '@/components/kibo-ui/contribution-graph'
import type { ActivityDay } from '@/features/people/activity-levels'

/**
 * The 26-week grid, and NOTHING ELSE.
 *
 * This used to render the card's copy, the total and the legend too, all inside
 * the client bundle, even though every one of those is static text the server
 * could have emitted. The graph itself genuinely needs a client component — the
 * kibo primitive builds its week matrix in `useMemo` behind a context — so the
 * boundary is drawn as tightly as possible around it and PersonActivityCard
 * (a server component) owns everything around it. That is rule 7 applied
 * literally: the interactive part ships, the prose does not.
 *
 * `fillClassName` arrives as a prop rather than being defined here so the level
 * ramp lives in ONE file next to the legend that explains it — a legend that
 * can drift from the grid it describes is worse than no legend at all.
 *
 * The grid is `aria-hidden`: 182 rects announced one at a time is not a way
 * anyone reads six months of activity. PersonActivityCard states the same
 * information as a sentence for assistive tech instead.
 */
export function ActivityGraph({
  days,
  fillClassName,
}: {
  days: ActivityDay[]
  fillClassName: string
}) {
  return (
    <div aria-hidden>
      <ContributionGraph data={days} blockSize={10} fontSize={11}>
        {/*
          `tabIndex={-1}` on the calendar because it is the element carrying
          `overflow-x-auto`, and at 375px the 26-week grid is wider than the
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
              className={fillClassName}
            />
          )}
        </ContributionGraphCalendar>
      </ContributionGraph>
    </div>
  )
}
