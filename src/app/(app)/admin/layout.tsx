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
    <div className="flex flex-1 flex-col p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {/* The ONE h1 the admin area renders. Section pages title themselves
            with CardTitle as="h2" (or an h2 header), so the outline reads
            h1 Admin → h2 section → h3 groups — /admin/danger used to add a
            second h1 of its own, and every other section skipped from this h1
            straight to h3s. */}
        <PageHeader
          title="Admin"
          description="Workspace tools. These act on everyone's data — tread carefully."
        />
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <AdminNav sections={visibleSections(actor)} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
