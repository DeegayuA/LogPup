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
