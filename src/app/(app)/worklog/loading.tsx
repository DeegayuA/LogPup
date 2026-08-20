import { Skeleton } from '@/components/ui/skeleton'

/**
 * The whole page's first paint, shaped like what replaces it — header, stat
 * strip, the two-pane calendar + day panel, the catch-up slot — so the swap
 * is a fill-in, not a layout shift. The per-zone Suspense fallbacks inside
 * page.tsx take over from here once the shell has streamed.
 */
export default function WorklogLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <span className="sr-only" role="status">
        Loading your work log…
      </span>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-lg" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-7 w-28" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, i) => (
              <Skeleton key={i} className="min-h-10 rounded-md sm:min-h-12" />
            ))}
          </div>
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>

      <Skeleton className="h-24 rounded-xl" />
    </div>
  )
}
