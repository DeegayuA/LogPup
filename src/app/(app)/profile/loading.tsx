import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Profile blocks on four reads (passkeys, phone, avatar, job role) before it
 * can render. Without this file it fell back to the (app) group's boundary,
 * whose skeleton announces "Loading dashboard…" and renders an h1 of
 * "Dashboard" — the wrong page identity for the whole load. The header here
 * is the real one (both lines are static), so only the cards shimmer and
 * nothing jumps on swap.
 */
export default function ProfileLoading() {
  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      <span className="sr-only" role="status">
        Loading your profile…
      </span>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageHeader
          title="Profile"
          description="Your name and photo as teammates see them, and the credentials you sign in with."
        />

        <div className="flex flex-col gap-6" aria-hidden>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="size-16 rounded-full" />
            </CardContent>
          </Card>

          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-60 max-w-full" />
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
