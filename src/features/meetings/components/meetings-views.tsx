'use client'

import { useState } from 'react'
import { CalendarDays, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UpcomingMeetingsFiltered } from '@/features/meetings/components/upcoming-filter'
import { PastMeetingsSection } from '@/features/meetings/components/past-meetings-section'
import { MeetingsMonthCalendar } from '@/features/meetings/components/meetings-month-calendar'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

const VIEWS = [
  { id: 'list', label: 'List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
] as const

type ViewId = (typeof VIEWS)[number]['id']

/** List/calendar switcher for the meetings page — calendar is the month event grid. */
export function MeetingsViews({
  upcoming,
  past,
  currentUserId,
  isAdmin,
  users,
}: {
  upcoming: MeetingSummary[]
  past: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  users: MentionUser[]
}) {
  const [view, setView] = useState<ViewId>('list')

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Meetings view"
        className="flex w-fit items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5"
      >
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            type="button"
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={cn(
              'h-7 px-2.5',
              view === id && 'bg-card text-foreground shadow-xs hover:bg-card',
            )}
          >
            <Icon /> {label}
          </Button>
        ))}
      </div>

      {view === 'list' ? (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-base font-medium">Upcoming</h2>
            <UpcomingMeetingsFiltered
              meetings={upcoming}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              users={users}
            />
          </section>
          <PastMeetingsSection
            meetings={past}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            users={users}
          />
        </div>
      ) : (
        <MeetingsMonthCalendar upcoming={upcoming} past={past} />
      )}
    </div>
  )
}
