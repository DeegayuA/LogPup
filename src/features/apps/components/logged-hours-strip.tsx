'use client'

import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { LoggedHoursPanel } from '@/features/apps/components/logged-hours-panel'
import { formatHours } from '@/features/worklog/entries'

/**
 * The card's hours band: ONE figure, the project's all-time worklog hours,
 * by the owner's request. The "Hours" label opens the month view
 * (logged-hours-panel.tsx): each person's hours per month, and their days —
 * so the per-person answer is one click away rather than gone.
 *
 * Fixed height (h-5) on every card, so a card with hours and one without
 * line up in the grid (app-card.tsx rule 2).
 *
 * Must sit above the card's stretched-link cover (`relative z-10`), or the
 * cover would swallow the click and focus.
 *
 * The figure arrives already filtered by worklog.view (logged-time-queries.ts),
 * so a member's total is their own hours only. `onlyOwn` says so, and the
 * wording follows: "by you", and an empty card reads "none logged by you",
 * never "nobody did".
 */
export function LoggedHoursStrip({
  appId,
  appName,
  month,
  totalMinutes,
  onlyOwn,
  viewerId,
}: {
  appId: string
  appName: string
  /** `YYYY-MM` the panel opens on. */
  month: string
  /** All-time minutes; 0 when none (visible) were logged. */
  totalMinutes: number
  onlyOwn: boolean
  viewerId: string | null
}) {
  return (
    <div className="relative z-10 flex h-5 min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
      <Popover>
        {/* No aria-label: the visible "Hours" IS the name, so a voice-control
            user saying what they see reaches it. */}
        <PopoverTrigger className="-mx-1 flex shrink-0 items-center gap-0.5 rounded-sm px-1 font-medium hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          Hours
          <ChevronDown aria-hidden className="size-3" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80" aria-label={`Hours on ${appName}`}>
          {/* Keyed on the month so a page that crosses midnight into a new
              month starts the panel over instead of holding the old one. */}
          <LoggedHoursPanel
            key={month}
            appId={appId}
            appName={appName}
            currentMonth={month}
            viewerId={viewerId}
          />
        </PopoverContent>
      </Popover>
      {totalMinutes > 0 ? (
        <span className="min-w-0 truncate">
          <span className="font-mono tabular-nums text-foreground">{formatHours(totalMinutes)}h</span>{' '}
          {onlyOwn ? 'spent by you' : 'spent in total'}
        </span>
      ) : (
        <span className="min-w-0 truncate">{onlyOwn ? 'none logged by you' : 'none logged'}</span>
      )}
    </div>
  )
}
