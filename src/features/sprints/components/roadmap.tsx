import { RoadmapTimeline } from '@/features/sprints/components/roadmap-timeline'
import type { StatusCounts } from '@/features/sprints/plan-read'
import type { Sprint } from '@/features/sprints/queries'

/**
 * Server shell for the roadmap.
 *
 * The timeline itself has to be a client component — it is direct
 * manipulation, and there is no server-only way to drag a bar. This wrapper
 * exists so the ONE thing the timeline needs from the session, "may this
 * person reschedule sprints?", is resolved on the server rather than trusted
 * from the client. It is only an affordance either way: `updateSprint` and
 * `deleteSprint` both re-check `sprint.manage` themselves, so hiding the
 * handles here is a courtesy, not the permission.
 *
 * `canManageSprints` is taken as a prop rather than resolved here from its
 * own `getSession()` call — that used to mean `isAdminRole`, which excludes
 * the scoped manager/PM `sprint.manage` actually grants. The page already
 * computes it with the real appId (`can(actor, 'sprint.manage', {appId})`),
 * so this stays the one place that answer is asked.
 *
 * `counts` is passed through RAW rather than as a precomputed read, and that
 * is deliberate. A sprint's read is a function of its DATES, and the dates the
 * timeline is showing are optimistically overridden the moment a bar is
 * dragged or nudged — a read scored here on the server would go on saying "On
 * track" for the whole debounce window after a bar has been pulled past today
 * and is already overdue, then flip when revalidation caught up. Handing down
 * the numbers and letting the client score them against the range it is
 * actually painting is the same rule the drag date chip follows.
 *
 * The page fetches those counts for the spine already, so this costs no extra
 * query; taking them as a prop rather than fetching them here is what keeps
 * the route's single `Promise.all` the one place data is loaded.
 */
export function Roadmap({
  sprints,
  slug,
  counts,
  canManageSprints,
}: {
  sprints: Sprint[]
  slug: string
  /** Board counts per sprint id. Every sprint on the page must have an entry —
   *  the grouped query returns no row for a sprint with no tasks, and the gap
   *  is filled by the caller so no consumer has to invent an empty literal. */
  counts: Record<string, StatusCounts>
  canManageSprints: boolean
}) {
  return (
    <RoadmapTimeline
      sprints={sprints}
      slug={slug}
      canManageSprints={canManageSprints}
      counts={counts}
    />
  )
}
