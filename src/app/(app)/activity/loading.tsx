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
    <div className="flex flex-1 flex-col gap-5 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
        <div className="h-5 w-80 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </header>
      <ActivityControlsSkeleton />
      <ActivityTrailSkeleton />
    </div>
  )
}
