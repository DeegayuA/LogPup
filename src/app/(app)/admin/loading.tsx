import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading state for every admin section that does not stream its own
 * (audit and danger carry their own Suspense skeletons inside the page).
 *
 * Before this file existed, navigating to Overview, People, Approvals, Apps,
 * Trash, Absences, Holidays or Handover blocked the whole route on 1–4 serial
 * queries with a frozen screen. This renders inside the admin layout's main
 * slot, so the "Admin" header and section nav stay live while a section's
 * reads land.
 *
 * Shape: a card with a title row, a description line and a handful of rows —
 * the one silhouette every section resolves into (each is a Card holding a
 * list or table).
 */
export default function AdminSectionLoading() {
  return (
    <div className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        Loading this admin section…
      </span>
      <div
        aria-hidden
        className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-3/4 max-w-md" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="hidden h-8 w-28 shrink-0 rounded-lg sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
