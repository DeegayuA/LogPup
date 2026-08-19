import { notFound } from 'next/navigation'
import { AdminNav } from '@/features/admin/components/admin-nav'
import { visibleSections } from '@/features/admin/sections'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'

/**
 * The admin area's shell and its outer guard.
 *
 * notFound(), not a refusal page: a stakeholder probing /admin must not learn
 * it exists. `forbidden()`/`unauthorized()` would be the expressive answer but
 * both are experimental in Next 16.3 and need experimental.authInterrupts in
 * next.config.ts, which is out of scope for this work.
 *
 * Each section guards again on its own. This is the cheap first gate, not the
 * enforcement point.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await loadActor()
  if (!actor || !can(actor, 'admin.view')) notFound()

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Workspace tools. These act on everyone&apos;s data — tread carefully.
          </p>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <AdminNav sections={visibleSections(actor)} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
