import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { listMeetings } from '@/features/meetings/queries'
import { listApps } from '@/features/apps/queries'
import { listActiveUsers } from '@/features/people/queries'
import { StatTile } from '@/features/meetings/components/meeting-chips'
import { summarizeMeetings } from '@/features/meetings/components/meeting-glance'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { MeetingsViews } from '@/features/meetings/components/meetings-views'
import { splitByUpcoming } from '@/features/meetings/split-upcoming'

export default async function MeetingsPage(props: { searchParams: Promise<{ new?: string }> }) {
  const [{ new: newParam }, session, allMeetings, apps, activeUsers] = await Promise.all([
    props.searchParams,
    auth(),
    listMeetings(),
    listApps(),
    listActiveUsers(),
  ])

  // `allMeetings` is already ordered newest-first, which is what the past
  // section wants (most recent past meeting first); splitByUpcoming
  // re-sorts only the upcoming half to soonest-first.
  const { upcoming, past } = splitByUpcoming(allMeetings)

  const currentUserId = session?.user?.id ?? ''
  const isAdmin = session?.user?.role === 'admin'
  const appOptions = apps.map((app) => ({ id: app.id, name: app.name }))
  // Computed on the server, where reading the clock is free of the hydration
  // and purity constraints the client components live under.
  const overview = summarizeMeetings(upcoming, past, currentUserId, new Date())

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Same header shape as Apps/People (and as meetings/loading.tsx, which
          already rendered the 2xl-bold version) — the title used to visibly
          shrink and de-bold the moment data arrived. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Everything the pack has scheduled — upcoming and past.
          </p>
        </div>
        <MeetingForm
          apps={appOptions}
          activeUsers={activeUsers}
          trigger={<Button>New meeting</Button>}
          defaultOpen={newParam === '1'}
        />
      </div>

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
      ) : null}

      <MeetingsViews
        upcoming={upcoming}
        past={past}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        users={activeUsers}
      />
    </div>
  )
}
