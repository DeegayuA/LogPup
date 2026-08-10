import { getUserCapacities } from '@/features/people/queries'
import { getActiveSprints } from '@/features/sprints/queries'
import { CapacityHeat } from '@/features/dashboard/components/capacity-heat'
import { ActiveSprints } from '@/features/dashboard/components/active-sprints'

export default async function DashboardPage() {
  const [capacities, activeSprints] = await Promise.all([
    getUserCapacities(),
    getActiveSprints(),
  ])

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="font-heading text-xl font-medium">Dashboard</h1>
      {/* Grid holds room for the upcoming-meetings widget (Task 14): capacity
          heat spans both columns, active sprints takes the first slot below it. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <CapacityHeat capacities={capacities} />
        </div>
        <ActiveSprints sprints={activeSprints} />
      </div>
    </div>
  )
}
