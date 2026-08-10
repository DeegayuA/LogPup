import { auth } from '@/lib/auth'
import { getUserCapacities } from '@/features/people/queries'
import { CapacityHeat } from '@/features/dashboard/components/capacity-heat'
import { DbClearButton } from '@/features/admin/components/db-clear-button'
import { SetPasswordForm } from '@/features/auth/components/set-password-form'

export default async function DashboardPage() {
  const [capacities, session] = await Promise.all([getUserCapacities(), auth()])
  const showDbClear = process.env.ENABLE_DB_CLEAR === '1' && session?.user?.role === 'admin'

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
      {/* Gives any signed-in user (Google, Notion, dev login) a way to add password
          login for their own account — the only UI path that can set a passwordHash. */}
      <div className="lg:max-w-xs">
        <SetPasswordForm />
      </div>
      {showDbClear && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-dashed p-4">
          <p className="text-sm font-medium">Testing tools</p>
          <DbClearButton />
        </div>
      )}
    </div>
  )
}
