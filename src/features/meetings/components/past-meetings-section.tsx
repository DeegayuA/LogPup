'use client'

import { useId, useState } from 'react'
import { format } from 'date-fns'
import { ChevronDownIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MeetingList } from '@/features/meetings/components/meeting-list'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

export function PastMeetingsSection({
  meetings,
  currentUserId,
  isAdmin,
  users,
  apps = [],
  openMeetingId,
  selectedDay,
  onClearDay,
}: {
  /** Already filtered to `selectedDay` by the parent, when one is set. */
  meetings: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  /** Mention pool for the notes editor — all active users. */
  users?: MentionUser[]
  apps?: { id: string; name: string }[]
  openMeetingId?: string
  /**
   * The day filter currently in force, shared with the upcoming list. Set
   * when somebody arrives here from the calendar — opening the write-up of a
   * PAST meeting used to switch to the list view, filter the upcoming list to
   * a day it can never contain, and leave this section collapsed: a button
   * labelled "Open the write-up, transcript and follow-ups" that landed on
   * "No meetings that day".
   */
  selectedDay?: Date
  onClearDay?: () => void
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()

  // Expand when a day filter arrives that this section can actually answer.
  // Adjusting state during render rather than in an effect is React's own
  // guidance for reacting to a changed prop; keying on the day means a manual
  // collapse afterwards sticks until a DIFFERENT day is chosen.
  const dayKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null
  const [syncedDay, setSyncedDay] = useState(dayKey)
  if (dayKey !== syncedDay) {
    setSyncedDay(dayKey)
    if (dayKey && meetings.length > 0) setOpen(true)
  }

  // The same trick for a meeting opened directly. `openMeetingId` reaches the
  // list below, but the list only exists while `open` — so asking to open a
  // PAST meeting mounted nothing at all unless a day filter happened to arrive
  // with it. Expanding here is what makes "open the full meeting" also press
  // "Show past meetings", instead of leaving the write-up behind a collapsed
  // section. Membership-tested rather than assumed: this section also renders
  // for days it has no meetings on, and opening an UPCOMING meeting must not
  // expand it. Keyed on the id, so a manual collapse afterwards sticks until a
  // DIFFERENT meeting is opened.
  const [syncedOpenId, setSyncedOpenId] = useState(openMeetingId)
  if (openMeetingId !== syncedOpenId) {
    setSyncedOpenId(openMeetingId)
    if (openMeetingId && meetings.some((meeting) => meeting.id === openMeetingId)) setOpen(true)
  }

  return (
    <section className="flex flex-col gap-3">
      {/* This half of the page used to be a bare ghost button with no heading
          element at all, so "Past meetings" was unreachable by heading
          navigation and sat a level below its own content visually. It is now
          an h2 like "Upcoming", with the toggle as a separate control beside
          it — a heading is a landmark, not a button. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="flex items-baseline gap-2 font-heading text-lg font-semibold">
          Past
          <span className="font-mono text-sm font-normal text-muted-foreground">
            {meetings.length}
          </span>
        </h2>
        {meetings.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDownIcon
              className={cn(
                'transition-transform duration-150 motion-reduce:transition-none',
                open && 'rotate-180',
              )}
              aria-hidden
            />
            {open ? 'Hide' : 'Show'} past meetings
          </Button>
        ) : null}
        {selectedDay && onClearDay ? (
          <Button variant="ghost" size="sm" type="button" onClick={onClearDay}>
            <XIcon aria-hidden />
            <span className="font-mono">{format(selectedDay, 'MMM d')}</span> only — show all
          </Button>
        ) : null}
      </div>
      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {selectedDay
            ? 'No past meetings on that day.'
            : 'Nothing has happened yet — past meetings collect here with their notes and follow-ups.'}
        </p>
      ) : null}
      <div id={listId}>
        {open && meetings.length > 0 ? (
          <MeetingList
            meetings={meetings}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            users={users}
          apps={apps}

          openMeetingId={openMeetingId}
          />
        ) : null}
      </div>
    </section>
  )
}
