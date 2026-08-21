import { Suspense } from 'react'
import { CalendarDaysIcon } from 'lucide-react'
import { getSession } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { listMeetings } from '@/features/meetings/queries'
import { listApps } from '@/features/apps/queries'
import { listActiveUsers } from '@/features/people/queries'
import { parseCalendarView, parseFocusedDate } from '@/features/meetings/calendar-view'
import { StatTile } from '@/features/meetings/components/meeting-chips'
import { summarizeMeetings } from '@/features/meetings/components/meeting-glance'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { MeetingsViews } from '@/features/meetings/components/meetings-views'
import {
  MeetingLoadLink, MeetingLoadLinkFallback,
} from '@/features/meetings/components/meeting-load-link'
import { splitByUpcoming } from '@/features/meetings/split-upcoming'
import { isAdminRole } from '@/features/auth/capabilities'
import { getMyPendingInvites, getWeeklyLoadTable } from '@/features/meeting-load/queries'
import { getSuggestionsForOrganizer } from '@/features/meeting-load/admin-queries'
import { YourSeriesCard } from '@/features/meeting-load/components/your-series-card'

export const metadata = { title: 'Meetings & Intelligence' }

export default async function MeetingsPage(props: {
  searchParams: Promise<{ new?: string; view?: string; date?: string; open?: string }>
}) {
  const [
    { new: newParam, view: viewParam, date: dateParam, open: openParam },
    session,
    allMeetings,
    apps,
    activeUsers,
  ] = await Promise.all([
    props.searchParams,
    getSession(),
    listMeetings(),
    listApps(),
    listActiveUsers(),
  ])

  // `allMeetings` arrives newest-first, which is what the past side wants and
  // the reverse of what upcoming does — splitByUpcoming owns that flip. Sorting
  // either half again here would silently undo it.
  const { upcoming, past } = splitByUpcoming(allMeetings)

  const currentUserId = session?.user?.id ?? ''
  const isAdmin = session?.user ? isAdminRole(session.user.role) : false
  const appOptions = apps.map((app) => ({ id: app.id, name: app.name }))
  const overview = summarizeMeetings(upcoming, past, currentUserId, new Date())

  // Today in Asia/Colombo, not UTC: an evening here is already tomorrow in
  // UTC, so a UTC-derived "today" would open the calendar on the wrong day
  // for half the working week. The view and date the URL asked for are parsed
  // HERE, from the awaited searchParams, so every value the calendar starts
  // from is resolved in one place rather than re-derived per component.
  const todayIso = toIsoDateInTimeZone(new Date())
  const initialView = parseCalendarView(viewParam)
  const initialDate = parseFocusedDate(dateParam, todayIso)
  const initialOpenMeetingId =
    openParam && allMeetings.some((meeting) => meeting.id === openParam) ? openParam : undefined

  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8 overflow-hidden">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-[450px] w-[600px] rounded-full bg-primary/8 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 -left-40 -z-10 h-[400px] w-[500px] rounded-full bg-chart-1/5 blur-3xl"
        aria-hidden
      />

      <PageHeader
        title="Meeting Intelligence"
        description="Everything the pack has scheduled — Google Calendar synced with Gemini 2.5 transcripts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Suspended on purpose: the label is a finding the sweep has to
                compute, and this page must not wait on it to draw. */}
            <Suspense fallback={<MeetingLoadLinkFallback />}>
              <MeetingLoadLink />
            </Suspense>
            <MeetingForm
              apps={appOptions}
              activeUsers={activeUsers}
              trigger={<Button className="shadow-sm font-semibold">New meeting</Button>}
              defaultOpen={newParam === '1'}
            />
          </div>
        }
      />

      {overview.total > 0 ? (
        <div className="flex flex-wrap gap-2.5 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs backdrop-blur-sm">
          <StatTile value={overview.today} label="Today" />
          <StatTile value={overview.week} label="Next 7 days" />
          <StatTile value={overview.awaitingYou} label="Waiting on you" tone="warning" />
          {overview.live > 0 ? <StatTile value={overview.live} label="Now" tone="active" /> : null}
          <StatTile value={overview.past} label="Past" />
          {/* Suspended: the invited-hours figure is a sweep, and the tiles it
              sits beside are already computed. */}
          <Suspense fallback={<StatTile value={0} label="Invited hours" />}>
            <InvitedHoursTile />
          </Suspense>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 backdrop-blur-sm">
          <EmptyState
            icon={CalendarDaysIcon}
            title="Nothing scheduled yet."
            description="A meeting keeps its notes, transcript and follow-ups long after it ends — schedule the first one and everyone invited gets a notification."
            action={
              <MeetingForm
                apps={appOptions}
                activeUsers={activeUsers}
                trigger={
                  <Button variant="outline" size="sm">
                    Schedule the first meeting
                  </Button>
                }
              />
            }
          />
        </div>
      )}

      {/* Suspended so a sweep over six months of meetings never delays the
          calendar somebody came here to look at. */}
      <Suspense fallback={null}>
        <YourSeries userId={currentUserId} />
      </Suspense>

      <MeetingsViews
        upcoming={upcoming}
        past={past}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        users={activeUsers}
        apps={appOptions}
        initialView={initialView}
        initialDate={initialDate}
        todayIso={todayIso}
        initialOpenMeetingId={initialOpenMeetingId}
      />
    </div>
  )
}

/**
 * How much of this week is already spoken for.
 *
 * Warning tone above 1.25x the trailing four-week MEDIAN — median, so one
 * workshop week does not leave the tile amber for a month. Computed server-side
 * here, above the client MeetingsViews boundary, so the number and the meetings
 * it summarises come from the same render.
 */
async function InvitedHoursTile() {
  const rows = await getWeeklyLoadTable(new Date())
  if (rows.length === 0) return <StatTile value={0} label="Invited hours" />

  const thisWeek = rows[rows.length - 1]
  const trailing = rows.slice(-5, -1).map((row) => row.invitedHours).sort((a, b) => a - b)
  const median = trailing.length === 0
    ? 0
    : trailing.length % 2 === 0
      ? (trailing[trailing.length / 2 - 1] + trailing[trailing.length / 2]) / 2
      : trailing[Math.floor(trailing.length / 2)]

  return (
    <StatTile
      value={Math.round(thisWeek.invitedHours)}
      label="Invited hours"
      tone={median > 0 && thisWeek.invitedHours > 1.25 * median ? 'warning' : undefined}
    />
  )
}

/**
 * The organizer's own queue, and their own pending invitations.
 *
 * ORGANIZER-PRIVATE. `getSuggestionsForOrganizer` checks eligibility before it
 * reads any evidence, so a non-organizer's payload never contains the data at
 * all — filtering at render time would mean it had already been fetched.
 */
async function YourSeries({ userId }: { userId: string }) {
  if (!userId) return null
  const [suggestions, pending] = await Promise.all([
    getSuggestionsForOrganizer(userId, new Date()),
    getMyPendingInvites(userId),
  ])

  return (
    <div className="flex flex-col gap-4">
      <YourSeriesCard suggestions={suggestions} />
      {pending.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {pending.length} invite{pending.length === 1 ? '' : 's'} without an in-app reply —
          replies may live in Google Calendar; a tap here helps planning.
        </p>
      ) : null}
    </div>
  )
}
