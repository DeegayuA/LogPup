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
import { splitByUpcoming } from '@/features/meetings/split-upcoming'
import { isAdminRole } from '@/features/auth/capabilities'

export default async function MeetingsPage(props: {
  /** `view` and `date` drive the calendar surface (see calendar-view.ts);
   *  `open` deep-links one meeting's write-up — a ⌘K hit or a shared link
   *  lands with that meeting's panel already open instead of on a list with
   *  the meeting collapsed somewhere down the page. */
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

  // `allMeetings` is already ordered newest-first, which is what the past
  // section wants (most recent past meeting first); splitByUpcoming
  // re-sorts only the upcoming half to soonest-first.
  const { upcoming, past } = splitByUpcoming(allMeetings)

  const currentUserId = session?.user?.id ?? ''
  const isAdmin = session?.user ? isAdminRole(session.user.role) : false
  const appOptions = apps.map((app) => ({ id: app.id, name: app.name }))
  // Computed on the server, where reading the clock is free of the hydration
  // and purity constraints the client components live under.
  const overview = summarizeMeetings(upcoming, past, currentUserId, new Date())

  // Today in Asia/Colombo, and the view/date the URL asked for — parsed HERE,
  // from the awaited searchParams, so the very first server paint is already
  // the right view on the right week. Sending "today" down as a value rather
  // than letting each side read its own clock is what stops the highlight
  // landing on two different squares across hydration.
  const todayIso = toIsoDateInTimeZone(new Date())
  const initialView = parseCalendarView(viewParam)
  const initialDate = parseFocusedDate(dateParam, todayIso)
  // Validated by membership, not by shape: an id that names no meeting here
  // simply opens nothing, so the param needs no parsing beyond existence.
  const initialOpenMeetingId =
    openParam && allMeetings.some((meeting) => meeting.id === openParam) ? openParam : undefined

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* The shared h1 row — same component as every other (app) page, so the
          heading level, size and action placement cannot drift per page.
          meetings/loading.tsx renders the identical header, so nothing shrinks
          or de-bolds when data arrives. */}
      <PageHeader
        title="Meetings"
        description="Everything the pack has scheduled — upcoming and past."
        actions={
          <MeetingForm
            apps={appOptions}
            activeUsers={activeUsers}
            trigger={<Button>New meeting</Button>}
            defaultOpen={newParam === '1'}
          />
        }
      />

      {/* The page's at-a-glance row. The only number here used to be a bare
          total of every meeting ever held, which answers no question anyone
          arrives with; these four do. "Waiting on you" and "Now" are the two
          that carry a colour, because they are the two you can act on. */}
      {overview.total > 0 ? (
        <div className="flex flex-wrap gap-2">
          <StatTile value={overview.today} label="Today" />
          {/* "Next 7 days", not "This week": the number is a rolling window
              from today, and a tile that said "This week" on a Friday would be
              read as "two days left" when it means "through next Thursday". */}
          <StatTile value={overview.week} label="Next 7 days" />
          <StatTile value={overview.awaitingYou} label="Waiting on you" tone="warning" />
          {overview.live > 0 ? <StatTile value={overview.live} label="Now" tone="active" /> : null}
          <StatTile value={overview.past} label="Past" />
        </div>
      ) : (
        /* Nothing has ever been scheduled here. Five tiles reading zero would
           be the page's most prominent element saying nothing at all, so the
           slot teaches the next step instead — and RENDERS it, rather than
           describing the header button in prose ("New meeting above") that
           made the reader go find it. Anyone here can act on this button:
           createMeeting checks for a session and nothing else, so a member
           schedules meetings on exactly the same terms as an admin. */
        <div className="rounded-xl border border-dashed border-border">
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
