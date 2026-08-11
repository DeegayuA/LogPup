'use client'

import {
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
  ContributionGraphFooter,
  ContributionGraphLegend,
  ContributionGraphTotalCount,
} from '@/components/kibo-ui/contribution-graph'
import type { ActivityDay } from '@/features/people/queries'

/* Pine ramp on the shared token scale — level 0 stays muted. */
const LEVEL_CLASSES = [
  'data-[level="0"]:fill-muted',
  'data-[level="1"]:fill-primary/25',
  'data-[level="2"]:fill-primary/50',
  'data-[level="3"]:fill-primary/75',
  'data-[level="4"]:fill-primary',
].join(' ')

export function ActivityGraph({ data }: { data: ActivityDay[] }) {
  const total = data.reduce((sum, day) => sum + day.count, 0)
  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No task activity yet — assignments will light this up.
      </p>
    )
  }
  return (
    <ContributionGraph data={data} blockSize={10} fontSize={12}>
      <ContributionGraphCalendar>
        {({ activity, dayIndex, weekIndex }) => (
          <ContributionGraphBlock
            activity={activity}
            dayIndex={dayIndex}
            weekIndex={weekIndex}
            className={LEVEL_CLASSES}
          />
        )}
      </ContributionGraphCalendar>
      <ContributionGraphFooter className="text-xs">
        <ContributionGraphTotalCount>
          {({ totalCount }) => (
            <span className="text-muted-foreground">
              <span className="font-mono">{totalCount}</span> tasks in the last 6 months
            </span>
          )}
        </ContributionGraphTotalCount>
        <ContributionGraphLegend className={LEVEL_CLASSES} />
      </ContributionGraphFooter>
    </ContributionGraph>
  )
}
