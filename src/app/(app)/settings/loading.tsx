import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Settings reads five rows off the database (keys, pool health, usage,
 * avatar, job role) before it can render, so it owes a designed loading
 * state like every other async surface here. Same skeleton grammar as the
 * dashboard's: a live-region announcement for screen readers, `aria-hidden`
 * shapes for everyone else, and the REAL header (both lines are static
 * text) in the same stack the real page uses so nothing jumps on swap.
 */
export default function SettingsLoading() {
  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      <span className="sr-only" role="status">
        Loading your settings…
      </span>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageHeader
          title="Settings"
          description="How LogPup behaves for you. Nothing here changes anything for your teammates."
        />

        <div className="flex flex-col gap-6" aria-hidden>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
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
