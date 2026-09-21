import { Skeleton } from '@/components/ui/skeleton'

/**
 * The grid's own loading shape, painted while `loadAbsenceCalendar` resolves
 * behind the page's `<Suspense>`. MATCHES THE RESOLVED GEOMETRY — same 7
 * columns, same `min-h` as `absence-month-grid.tsx` — so the swap from
 * skeleton to real grid is not a layout shift with extra steps (see the
 * `Skeleton` module comment). 6 rows: the longest a Monday-started month grid
 * ever runs (28/35/42 days), so this never comes up short for a wide month.
 */
export function AbsenceCalendarSkeleton() {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return (
    <div aria-hidden className="flex flex-col gap-1">
      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((day) => (
          <div key={day} className="text-center text-2xs text-muted-foreground">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }, (_, i) => (
          <Skeleton key={i} className="min-h-[64px] sm:min-h-[92px]" />
        ))}
      </div>
    </div>
  )
}
