import { Skeleton } from '@/components/ui/skeleton'
import {
  MyDayZoneSkeleton,
  PortfolioZoneSkeleton,
  TeamZoneSkeleton,
  ZoneLabel,
} from '@/features/dashboard/components/dashboard-zones'

/**
 * Cold entry into the dashboard route only — later visits stream through the
 * page's own <Suspense> zones. Kept because a dynamic route with no
 * loading.tsx is not partially prefetchable at all (see the note on
 * /activity's loading.tsx).
 *
 * Built FROM the page's real zone skeletons rather than redrawing them: the
 * previous version here still drew the pre-redesign layout (one two-column
 * grid of three cards), so the first paint swapped to a completely different
 * shape — a skeleton that lies about the coming layout is a layout shift
 * with extra steps. Importing the same skeletons the page's Suspense
 * boundaries use means the two can never drift apart again.
 *
 * The h1 and zone labels are constants rendered for real; only the greeting
 * (whose wording depends on the session and the Colombo clock) shimmers. The
 * h1 carries PageHeader's classes rather than PageHeader itself because the
 * greeting slot is a shimmer div, and PageHeader's description renders in a
 * <p> — a div inside a p is invalid HTML and a hydration warning.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <span className="sr-only" role="status">
        Loading dashboard…
      </span>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <Skeleton className="h-5 w-64" />
      </header>
      <MyDayZoneSkeleton />
      <ZoneLabel>Team</ZoneLabel>
      <TeamZoneSkeleton />
      <ZoneLabel>Portfolio</ZoneLabel>
      <PortfolioZoneSkeleton />
    </div>
  )
}
