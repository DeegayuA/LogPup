import { auth } from '@/lib/auth'
import { getUserCapacities } from '@/features/people/queries'
import { getActiveSprints } from '@/features/sprints/queries'
import { getUpcomingMeetingsForUser } from '@/features/meetings/queries'
import { CapacityHeat } from '@/features/dashboard/components/capacity-heat'
import { ActiveSprints } from '@/features/dashboard/components/active-sprints'
import { UpcomingMeetings } from '@/features/dashboard/components/upcoming-meetings'

const UPCOMING_MEETING_WINDOW_DAYS = 7

export default async function DashboardPage() {
  const session = await auth()
  const [capacities, activeSprints, upcomingMeetings] = await Promise.all([
    getUserCapacities(),
    getActiveSprints(),
    session?.user
      ? getUpcomingMeetingsForUser(session.user.id, UPCOMING_MEETING_WINDOW_DAYS)
      : Promise.resolve([]),
  ])

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="font-heading text-xl font-medium">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <CapacityHeat capacities={capacities} />
        </div>
        <ActiveSprints sprints={activeSprints} />
        <UpcomingMeetings meetings={upcomingMeetings} />
      </div>
    </div>
  )
}
