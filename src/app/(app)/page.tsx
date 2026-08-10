import { getUserCapacities } from '@/features/people/queries'
import { CapacityHeat } from '@/features/dashboard/components/capacity-heat'

export default async function DashboardPage() {
  const capacities = await getUserCapacities()

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="font-heading text-xl font-medium">Dashboard</h1>
      {/* Grid holds room for future widgets (Tasks 13/14): capacity heat is
          section 1 of 3, spanning full width until the others land. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <CapacityHeat capacities={capacities} />
        </div>
      </div>
    </div>
  )
}
