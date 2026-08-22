import { Skeleton } from '@/components/ui/skeleton'
import {
  ActivityControlsSkeleton,
  ActivityTrailSkeleton,
} from '@/features/activity/components/activity-skeleton'

/**
 * Cold entry into the route only.
 *
 * Kept (rather than left to the page's own <Suspense> boundaries) because a
 * dynamic route with no loading.tsx is not partially prefetchable at all —
 * see node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md.
 * Every actor / entity-type / app / day affordance in the trail is now a Link
 * into this same route, so losing that prefetch would make the page's
 * signature interaction feel slower than the filter bar it replaces.
 *
 * The h1 is rendered for real here rather than shimmered: it is a constant, it
 * costs nothing, and a grey box where a known word belongs makes a page feel
 * slower than it is. Once the route is mounted the page renders its header for
 * real and only the two skeletons below stand in — see page.tsx.
 */
export default function LoadingActivity() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      {/* The route change itself is silent to a screen reader — the URL moves
          and the old page's DOM is replaced with placeholders that are all
          aria-hidden. This is the announcement. Same wording pattern as the
          other loading routes so the app says one thing, one way. */}
      <span className="sr-only" role="status">
        Loading the activity trail…
      </span>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
        <Skeleton className="h-5 w-80 max-w-full" />
      </header>
      <ActivityControlsSkeleton />
      <ActivityTrailSkeleton />
    </div>
  )
}
