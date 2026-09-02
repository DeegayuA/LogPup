import { Suspense } from 'react'
import { getSession } from '@/lib/session'
import { PageHeader } from '@/components/ui/page-header'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { getMeetingSummaryById, listMeetingsWindowed } from '@/features/meetings/queries'
import { listApps } from '@/features/apps/queries'
import { listActiveUsers } from '@/features/people/queries'
import { managedAppIdsFor } from '@/features/apps/project-manager'
import { parseCalendarView, parseFocusedDate } from '@/features/meetings/calendar-view'
import { getMeetingGlancesChunked } from '@/features/meetings/glance-batch'
import { SkeletonBlock } from '@/features/meetings/components/meeting-chips'
import { MeetingHeaderActions } from '@/features/meetings/components/meeting-header-actions'
import { MeetingsViews } from '@/features/meetings/components/meetings-views'
import { MeetingGlanceProvider } from '@/features/meetings/components/use-glance-map'
import { TriageRail } from '@/features/meetings/components/triage-rail'
import {
  MeetingLoadLink, MeetingLoadLinkFallback,
} from '@/features/meetings/components/meeting-load-link'
import { isAdminRole, type UserRole } from '@/features/auth/capabilities'
import { getWeeklyLoadTable } from '@/features/meeting-load/queries'
import { getSuggestionsForOrganizer } from '@/features/meeting-load/admin-queries'
import { YourSeriesCard } from '@/features/meeting-load/components/your-series-card'

export const metadata = { title: 'Meetings & Intelligence' }

// glance-actions' rule, applied before the by-id read: a hand-mangled ?open=
// must degrade to "no such meeting", not become a Postgres uuid-cast error.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function MeetingsPage(props: {
  searchParams: Promise<{
    new?: string
    'new-note'?: string
    view?: string
    date?: string
    open?: string
    day?: string
    f?: string
  }>
}) {
  const [search, session, { upcoming, past, pastTotal }, apps, activeUsers, managedAppIds] =
    await (async () => {
      // Session FIRST: everything below is viewer-scoped (attendees-only
      // meetings exist), so no query can start before we know who is asking.
      const session = await getSession()
      const viewerId = session?.user?.id ?? ''
      const [search, windowed, apps, users, managed] = await Promise.all([
        props.searchParams,
        // The windowed read: every not-yet-ended meeting plus one page of
        // past — where the old listMeetings fetched the viewer's entire
        // history on every load, forever.
        listMeetingsWindowed(viewerId),
        listApps(),
        listActiveUsers(),
        // The PM arm of canReadMeetingIntel, resolved once for the whole
        // page — MeetingsViews re-decides the gate per opened meeting via
        // decideIntelReadable without another query.
        managedAppIdsFor(viewerId),
      ])
      return [search, session, windowed, apps, users, managed] as const
    })()

  const currentUserId = session?.user?.id ?? ''
  const isAdmin = session?.user ? isAdminRole(session.user.role) : false
  const viewerRole = (session?.user?.role ?? 'member') as UserRole
  const appOptions = apps.map((app) => ({ id: app.id, name: app.name }))

  // Today in Asia/Colombo, not UTC: an evening here is already tomorrow in
  // UTC, so a UTC-derived "today" would open the calendar on the wrong day
  // for half the working week. The view and date the URL asked for are parsed
  // HERE, from the awaited searchParams, so every value the calendar starts
  // from is resolved in one place rather than re-derived per component.
  const todayIso = toIsoDateInTimeZone(new Date())
  // A bare `?open=` (palette, briefing and context-pack links — frozen
  // producers that write no `view`) implies the LIST view: the Dossier sheet
  // only mounts there, and landing such a link on the default week grid
  // would open nothing. An explicit `?view=` keeps its meaning.
  const initialView =
    search.open && !search.view ? 'list' : parseCalendarView(search.view)
  const initialDate = parseFocusedDate(search.date, todayIso)

  // A ?open= naming a meeting outside the loaded window (a deep link into
  // deep history) is resolved by id so the sheet can still show it — the
  // docket deliberately does not grow a row for it.
  const loadedIds = new Set([...upcoming, ...past].map((meeting) => meeting.id))
  const openParam = search.open
  const extraOpenMeeting =
    openParam && !loadedIds.has(openParam) && UUID_RE.test(openParam)
      ? await getMeetingSummaryById(currentUserId, openParam)
      : null

  // THE glance batch: fired once, over every id on the page, and NOT awaited
  // — the docket paints from list facts immediately and the whole page's
  // intelligence (tiles + row chips) fills in one repaint when this lands.
  // Computed-only by page contract: nothing in it can reach Gemini.
  const glanceIds = [
    ...upcoming.map((meeting) => meeting.id),
    ...past.map((meeting) => meeting.id),
    ...(extraOpenMeeting ? [extraOpenMeeting.id] : []),
  ]
  // Chunked: getMeetingGlances caps one call at 100 ids and silently answers
  // null past the cap — a heavy workspace's overflow rows would render
  // chip-less forever without the split-and-merge wrapper.
  const glancesPromise = getMeetingGlancesChunked(glanceIds)

  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Meeting Intelligence"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Right-aligned mono summary — the one number the deleted
                stat-card strip earned its keep with. Suspended: it is a
                sweep, and this page must not wait on it to draw. */}
            <Suspense fallback={<SkeletonBlock className="h-4 w-44" />}>
              <WeekSummaryLine />
            </Suspense>
            {/* Suspended on purpose: the label is a finding the sweep has to
                compute, and this page must not wait on it to draw. */}
            <Suspense fallback={<MeetingLoadLinkFallback />}>
              <MeetingLoadLink />
            </Suspense>
            {/* One split pill for both creation gestures — quick note and
                scheduled meeting. ?new=1 opens the form, ?new-note=1 fires
                the quick-note gesture (the ⌘K row's only way in). */}
            <MeetingHeaderActions
              apps={appOptions}
              activeUsers={activeUsers}
              currentUserId={currentUserId}
              defaultOpenNewMeeting={search.new === '1'}
              defaultQuickNote={search['new-note'] === '1'}
            />
          </div>
        }
      />

      {/* ONE provider for the whole page's intelligence: the triage rail's
          tiles and every row's chip line read the same store, so a tile can
          never say "3 overdue" while the rows it filters to say nothing. */}
      <MeetingGlanceProvider glancesPromise={glancesPromise} meetingIds={glanceIds}>
        {upcoming.length + pastTotal > 0 ? (
          <TriageRail upcoming={upcoming} past={past} currentUserId={currentUserId} />
        ) : null}

        {/* Suspended so a sweep over six months of meetings never delays the
            docket somebody came here to look at. Organizer-private, and one
            LINE until opened — the governance card no longer sits between
            the header and the meetings on every visit. */}
        <Suspense fallback={null}>
          <YourSeries userId={currentUserId} />
        </Suspense>

        <MeetingsViews
          upcoming={upcoming}
          past={past}
          pastTotal={pastTotal}
          extraOpenMeeting={extraOpenMeeting}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          viewerRole={viewerRole}
          managedAppIds={managedAppIds}
          users={activeUsers}
          apps={appOptions}
          initialView={initialView}
          initialDate={initialDate}
          todayIso={todayIso}
        />
      </MeetingGlanceProvider>
    </div>
  )
}

/** "4h 30m" from a float of hours — mono-friendly, no decimals. */
function hoursLabel(invitedHours: number): string {
  const minutes = Math.round(invitedHours * 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

/**
 * This week, in one mono line. The last row of the weekly load table is the
 * current week (rows sort ascending and the sweep runs to `now`) — the same
 * read the deleted InvitedHoursTile leaned on, minus the tile.
 */
async function WeekSummaryLine() {
  const rows = await getWeeklyLoadTable(new Date())
  const thisWeek = rows[rows.length - 1]
  if (!thisWeek) return null

  return (
    <p className="font-mono text-xs text-muted-foreground tabular-nums">
      This week: {thisWeek.meetingCount} meeting{thisWeek.meetingCount === 1 ? '' : 's'} ·{' '}
      {hoursLabel(thisWeek.invitedHours)} invited
    </p>
  )
}

/**
 * The organizer's own queue, demoted to a one-line disclosure.
 *
 * ORGANIZER-PRIVATE. `getSuggestionsForOrganizer` checks eligibility before it
 * reads any evidence, so a non-organizer's payload never contains the data at
 * all — filtering at render time would mean it had already been fetched.
 * Renders nothing when there is nothing to ask (an empty governance card on
 * every visit would be a standing reminder that the app is watching).
 *
 * The pending-invites paragraph that used to render here is gone: the triage
 * rail's "Waiting on you" tile counts the same debt from the same attendee
 * rows (isAwaitingViewerRsvp), so a second differently-sourced number could
 * only ever agree or confuse.
 */
async function YourSeries({ userId }: { userId: string }) {
  if (!userId) return null
  const suggestions = await getSuggestionsForOrganizer(userId, new Date())
  if (suggestions.length === 0) return null

  return (
    <details className="group w-fit">
      <summary className="cursor-pointer list-none rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        Series suggestions{' '}
        <span className="font-mono tabular-nums">({suggestions.length})</span>
        <span className="ml-1 font-medium text-primary group-open:hidden"> — Review</span>
        <span className="ml-1 hidden font-medium group-open:inline"> — Hide</span>
      </summary>
      <div className="pt-3">
        <YourSeriesCard suggestions={suggestions} />
      </div>
    </details>
  )
}
