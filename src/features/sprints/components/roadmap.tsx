import { auth } from '@/lib/auth'
import { RoadmapTimeline } from '@/features/sprints/components/roadmap-timeline'
import type { Sprint } from '@/features/sprints/queries'

/**
 * Server shell for the roadmap.
 *
 * The timeline itself has to be a client component — it is direct
 * manipulation, and there is no server-only way to drag a bar. This wrapper
 * exists so the ONE thing the timeline needs from the session, "may this
 * person reschedule sprints?", is resolved on the server rather than trusted
 * from the client. It is only an affordance either way: `updateSprint` and
 * `deleteSprint` both re-check for admin themselves, so hiding the handles
 * here is a courtesy, not the permission.
 *
 * Keeping the `{ sprints, slug }` prop shape means the host route renders
 * this exactly as it did when the roadmap was a static chart.
 */
export async function Roadmap({ sprints, slug }: { sprints: Sprint[]; slug: string }) {
  const session = await auth()
  const isAdmin = session?.user?.role === 'admin'

  return <RoadmapTimeline sprints={sprints} slug={slug} isAdmin={isAdmin} />
}
