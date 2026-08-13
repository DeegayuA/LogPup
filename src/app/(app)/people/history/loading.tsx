import {
  HistoryDataSkeleton,
  HistoryShellSkeleton,
} from '@/features/people/components/history-skeleton'

/**
 * Cold entry into the route only.
 *
 * Kept (rather than deleted in favour of the page's own <Suspense>) because
 * a dynamic route with no loading.tsx is not partially prefetchable at all —
 * see node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md.
 * Removing it would silently disable the hover prefetch the as-of presets
 * rely on.
 *
 * Both halves are shimmer here because on a cold load there is genuinely
 * nothing real to show yet. Once the route is mounted, the page renders its
 * header and pickers for real and only HistoryDataSkeleton stands in — see
 * the Suspense boundary in page.tsx.
 */
export default function LoadingCapacityHistory() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <HistoryShellSkeleton />
      <HistoryDataSkeleton />
    </div>
  )
}
