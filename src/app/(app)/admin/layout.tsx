import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
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
    <div className="relative flex flex-1 flex-col p-6 md:p-8 overflow-hidden">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-[450px] w-[600px] rounded-full bg-primary/8 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 -left-40 -z-10 h-[400px] w-[500px] rounded-full bg-chart-1/5 blur-3xl"
        aria-hidden
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          title="Admin Console"
          description="Workspace management tools. These act on everyone's data — tread carefully."
        />
        {/* No second sidebar. Every admin section is now a row in the main
            sidebar's Manage block, capability-filtered by the same
            visibleSections() call — so moving between them no longer starts by
            navigating somewhere else, and the page gets its full width back.
            AdminNav is kept for the mobile sheet, which has no Manage block. */}
        <AdminNav sections={visibleSections(actor)} className="lg:hidden" />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
