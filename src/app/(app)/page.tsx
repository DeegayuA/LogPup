import { format } from 'date-fns'
import { auth } from '@/lib/auth'
import { getUserCapacities } from '@/features/people/queries'
import { getActiveSprints, getNextUpcomingSprint } from '@/features/sprints/queries'
import { getUpcomingMeetingsForUser } from '@/features/meetings/queries'
import { CapacityHeat } from '@/features/dashboard/components/capacity-heat'
import { ActiveSprints } from '@/features/dashboard/components/active-sprints'
import { UpcomingMeetings } from '@/features/dashboard/components/upcoming-meetings'

const UPCOMING_MEETING_WINDOW_DAYS = 7

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardPage() {
  const session = await auth()
  const [capacities, activeSprints, upcomingMeetings] = await Promise.all([
    getUserCapacities(),
    getActiveSprints(),
    session?.user
      ? getUpcomingMeetingsForUser(session.user.id, UPCOMING_MEETING_WINDOW_DAYS)
      : Promise.resolve([]),
  ])
  // Only needed for the card's empty-but-not-really state, so it's fetched
  // after we already know whether anything is running now rather than
  // joining the Promise.all above unconditionally.
  const nextSprint = activeSprints.length === 0 ? await getNextUpcomingSprint() : null

  const now = new Date()
  const firstName = session?.user?.name?.trim().split(/\s+/)[0]
  const greeting = firstName
    ? `${greetingFor(now.getHours())}, ${firstName}`
    : greetingFor(now.getHours())

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {greeting} · {format(now, 'EEEE, MMMM d')}
        </p>
      </header>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <CapacityHeat capacities={capacities} />
        <div className="flex flex-col gap-6">
          <ActiveSprints sprints={activeSprints} nextSprint={nextSprint} />
          <UpcomingMeetings meetings={upcomingMeetings} />
        </div>
      </div>
    </div>
  )
}
