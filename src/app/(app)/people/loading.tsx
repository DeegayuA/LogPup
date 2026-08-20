import { Skeleton } from '@/components/ui/skeleton'

/**
 * Cold entry into /people only — once the route is mounted, the page renders
 * its header and view switch for real and only the data half stands in (see
 * the Suspense boundary in page.tsx).
 *
 * Models the page's ALWAYS-TRUE furniture exactly: the PageHeader row, the
 * history button, and the CohortNav chip row the real page renders on every
 * view (the previous version omitted the chips, so the whole page jumped down
 * a row when they appeared). The data half models the directory — the default
 * view and the only one a bare /people URL can resolve to. A cold entry on a
 * ?view= URL still gets this shape for the first paint: loading.tsx cannot
 * read search params, and deleting it would disable partial prefetch for the
 * whole route (see people/history/loading.tsx for the reference).
 */
export default function PeopleLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <span className="sr-only" role="status">
        Loading people…
      </span>
      <div className="flex flex-col gap-4" aria-hidden>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">People</h1>
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
        {/* The CohortNav chip row — four view chips, same h-8 as the real
            Buttons, so the switch doesn't appear from nowhere. */}
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3" aria-hidden>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-9 w-full max-w-xs rounded-lg" />
          <Skeleton className="h-8 w-44 rounded-lg" />
        </div>
        <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-2 w-40 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
