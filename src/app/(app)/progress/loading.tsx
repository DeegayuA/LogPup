import { Skeleton } from '@/components/ui/skeleton'
import { ProgressAppsLaneSkeleton } from '@/features/worklog/components/progress-apps-lane'
import { ProgressMatrixSkeleton } from '@/features/worklog/components/progress-matrix'

/**
 * Route-level loading shape for /progress — the header, the filter row, then
 * the same two skeletons the page's own Suspense fallbacks use, so the first
 * paint and the streamed swap agree about where everything lands.
 */
export default function ProgressLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <span className="sr-only" role="status">
        Loading progress…
      </span>

      <header className="flex flex-col gap-1" aria-hidden>
        <h1 className="text-xl font-semibold tracking-tight">Progress</h1>
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>

      {/* The filter row: range toggle, prev/next, app select, name filter. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-hidden>
        <Skeleton className="h-7 w-40 rounded-lg" />
        <Skeleton className="h-7 w-44 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-8 min-w-40 flex-1 rounded-lg" />
      </div>

      <div className="flex flex-col gap-3" aria-hidden>
        <Skeleton className="h-4 w-32" />
        <ProgressMatrixSkeleton />
      </div>

      <div className="flex flex-col gap-3" aria-hidden>
        <Skeleton className="h-4 w-36" />
        <ProgressAppsLaneSkeleton />
      </div>
    </div>
  )
}
