import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The route skeleton, shaped like the page it stands in for.
 *
 * The header is the REAL PageHeader with the real words — title and
 * description are static, so there is nothing to wait for and nothing to shift
 * when the sweep lands. Same precedent as meetings/loading.tsx.
 */
export default function MeetingLoadLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Meeting load"
        description="Open items that need the same people, and could be one conversation instead of several. Every card is a question — accepting one opens the meeting form, it never invites anybody."
        actions={<Skeleton className="h-8 w-36" />}
      />
      <div className="flex flex-col gap-4" aria-hidden>
        {[0, 1].map((card) => (
          <div key={card} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-80" />
                <Skeleton className="h-3.5 w-64" />
              </div>
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-4 w-2/3" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
