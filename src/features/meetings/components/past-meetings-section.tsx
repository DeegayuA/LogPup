'use client'

import { useId, useState } from 'react'
import { format } from 'date-fns'
import { ChevronDownIcon, InfoIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isoToDisplayDate } from '@/features/meetings/calendar-view'
import { MeetingList } from '@/features/meetings/components/meeting-list'
import { SkeletonBlock } from '@/features/meetings/components/meeting-chips'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

/** Ghost rows swapped in while "Show earlier meetings" fetches — layout-
 *  matched to the docket row: the title block mirrors the real ≥44px title
 *  button and the chip placeholder is the 26px MetaChip box, so the
 *  ghost→real swap does not shift the page. Exported for the "Counting…"
 *  beat the upcoming list shows under a pending glance-backed filter. */
export function GhostRows({ count = 3 }: { count?: number }) {
  return (
    <ul
      aria-hidden
      className="flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border"
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex min-h-14 items-center gap-3 py-2 pr-2 pl-4 sm:pr-3">
          <div className="hidden w-16 shrink-0 flex-col gap-1 sm:flex">
            <SkeletonBlock className="h-3.5 w-12" />
            <SkeletonBlock className="h-3 w-8" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-h-11 items-center">
              <SkeletonBlock className="h-4 w-48 max-w-full" />
            </div>
            <SkeletonBlock className="h-[26px] w-28 rounded-md" />
          </div>
          <SkeletonBlock className="hidden h-6 w-24 md:block" />
        </li>
      ))}
    </ul>
  )
}

export function PastMeetingsSection({
  meetings,
  pastTotal,
  loadedCount,
  currentUserId,
  isAdmin,
  users,
  apps = [],
  dayIso,
  onClearDay,
  filterActive,
  counting = false,
  dayFetchFailed = false,
  onRetryDayFetch,
  onShowEarlier,
  loadingEarlier,
  onOpenMeeting,
  now,
  todayIso,
}: {
  /** The FILTERED visible past rows — day, `?f` and search already applied
   *  by the parent, over everything loaded so far (initial window + earlier
   *  pages + any targeted by-day fetch). */
  meetings: MeetingSummary[]
  /** The true count of past meetings on the server — the h2 must never lie
   *  just because only a page of them is loaded. */
  pastTotal: number
  /** How many past meetings are LOADED (unfiltered) — with pastTotal, this is
   *  what decides whether "Show earlier meetings" has anything left to show. */
  loadedCount: number
  currentUserId: string
  isAdmin: boolean
  /** Mention pool for the row dialogs — all active users. */
  users?: MentionUser[]
  apps?: { id: string; name: string }[]
  /** The `?day=` filter in force, shared with the upcoming list. */
  dayIso?: string
  onClearDay?: () => void
  /** True while `?f` or a search narrows this list — for the empty copy. */
  filterActive: boolean
  /** True while a glance-backed `?f` is applied but the batch is still
   *  counting — the empty copy says so instead of claiming no matches. */
  counting?: boolean
  /** True when the targeted `?day` fetch failed — the empty-day copy is
   *  replaced by a worded notice with Retry, never fake emptiness. */
  dayFetchFailed?: boolean
  onRetryDayFetch?: () => void
  /** Cursor-pages older meetings into the docket (the parent owns the
   *  cursor: the last loaded row's endsAt + id). */
  onShowEarlier: () => void
  loadingEarlier: boolean
  onOpenMeeting: (meeting: MeetingSummary) => void
  /** The shared list clock from useListNow. */
  now: Date
  /** Today in Asia/Colombo, threaded from the server so group labels agree
   *  across hydration. */
  todayIso?: string
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()

  // Expand when rows ARRIVE for the selected day — not merely when `?day`
  // changes. For an out-of-window JumpToDate pick the targeted fetch answers
  // AFTER the param flips, and keying on the param alone left the fetched
  // rows hidden behind a collapsed toggle (it also missed deep-link mounts,
  // where the param never "changes" at all). Adjusting state during render
  // rather than in an effect is React's own guidance for reacting to changed
  // props; keying on the day means a manual collapse afterwards sticks until
  // a DIFFERENT day is chosen, and clearing the day resets so re-picking the
  // same day expands again.
  const dayKey = dayIso ?? null
  const [expandedForDay, setExpandedForDay] = useState<string | null>(null)
  if (dayKey && meetings.length > 0 && expandedForDay !== dayKey) {
    setExpandedForDay(dayKey)
    setOpen(true)
  }
  if (!dayKey && expandedForDay !== null) setExpandedForDay(null)

  // Announces newly paged-in rows: the count is derived from loadedCount
  // rising, synced during render (same pattern as above).
  const [seenLoadedCount, setSeenLoadedCount] = useState(loadedCount)
  const [announcedLoad, setAnnouncedLoad] = useState<number | null>(null)
  if (loadedCount !== seenLoadedCount) {
    setSeenLoadedCount(loadedCount)
    if (loadedCount > seenLoadedCount) setAnnouncedLoad(loadedCount - seenLoadedCount)
  }

  const hasMore = pastTotal > loadedCount
  const selectedDay = dayIso ? isoToDisplayDate(dayIso) : undefined

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
          {/* pastTotal, not meetings.length: only a window is loaded, and a
              heading that counted the window would shrink the archive. */}
          <span className="font-mono text-sm font-normal text-muted-foreground">{pastTotal}</span>
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
                'transition-transform duration-(--dur-quick) motion-reduce:transition-none',
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
      {dayIso && dayFetchFailed ? (
        // The targeted by-day fetch failed — an honest worded notice (with
        // the same shape as the glance batch's) instead of the empty-day copy
        // masquerading as an answer.
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <InfoIcon className="size-4 shrink-0" aria-hidden />
          Could not check that day —
          {onRetryDayFetch ? (
            <Button type="button" variant="outline" size="xs" onClick={onRetryDayFetch}>
              Retry
            </Button>
          ) : null}
        </p>
      ) : meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {counting
            ? 'Counting…'
            : dayIso
              ? 'No past meetings on that day.'
              : filterActive
                ? 'No past meetings match the filter.'
                : 'Nothing has happened yet — past meetings collect here with their notes and follow-ups.'}
        </p>
      ) : null}
      {/* Announces the paged-in rows a "Show earlier meetings" press adds —
          the ghost rows are aria-hidden, so without this the press is silent
          to a screen reader. */}
      <span className="sr-only" role="status">
        {loadingEarlier
          ? 'Loading earlier meetings…'
          : announcedLoad
            ? `${announcedLoad} more meeting${announcedLoad === 1 ? '' : 's'} loaded`
            : null}
      </span>
      <div id={listId} className="flex flex-col gap-3">
        {open && meetings.length > 0 ? (
          <>
            <MeetingList
              meetings={meetings}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              users={users}
              apps={apps}
              groupBy="month"
              now={now}
              todayIso={todayIso}
              onOpenMeeting={onOpenMeeting}
            />
            {loadingEarlier ? <GhostRows /> : null}
            {hasMore ? (
              // Stays MOUNTED while loading (not disabled, not swapped out):
              // unmounting or disabling the pressed button drops keyboard
              // focus to <body> on every page; the parent already ignores a
              // second press while a fetch is in flight.
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="self-start"
                aria-busy={loadingEarlier}
                onClick={onShowEarlier}
              >
                {loadingEarlier ? (
                  'Loading earlier meetings…'
                ) : (
                  <>
                    Show earlier meetings
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {pastTotal - loadedCount} more
                    </span>
                  </>
                )}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
