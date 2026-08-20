import { Skeleton } from '@/components/ui/skeleton'

/**
 * The DATA half of the capacity-history page — stat tiles, the trend/overload
 * pair, and the table. Deliberately not the header or the pickers: those are
 * rendered for real straight away (the page awaits nothing before them), so a
 * skeleton standing in for them would replace working controls with grey
 * boxes and make the page feel slower than it is.
 *
 * Shared by loading.tsx (cold entry into the route) and the page's own
 * <Suspense> boundary (every later date/window change) so the two can never
 * drift into showing different shapes for the same wait. Built on the shared
 * <Skeleton> primitive for the same no-drift reason.
 */
export function HistoryDataSkeleton() {
  return (
    <>
      <span className="sr-only" role="status">
        Loading capacity history
      </span>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((tile) => (
          <Skeleton key={tile} className="h-[4.75rem]" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>

      <Skeleton className="h-96" />
    </>
  )
}

/** The controls above the data, for cold entry only — see loading.tsx. */
export function HistoryShellSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((chip) => (
          <Skeleton key={chip} className="h-8 w-28" />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((tab) => (
          <Skeleton key={tab} className="h-8 w-24" />
        ))}
      </div>
    </div>
  )
}
