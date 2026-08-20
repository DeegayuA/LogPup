'use client'

import { useRef, useState, useTransition } from 'react'
import { Loader2Icon, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loadMoreTriageBugs } from '@/features/bugs/actions'
import { BugList } from '@/features/bugs/components/bug-list'
import type { BugQueueRow } from '@/features/bugs/queries'
import type { BugFilters } from '@/features/bugs/report-input'

/**
 * "Load more" for the triage queue: APPENDS pages, never replaces them.
 *
 * The alternative — a link carrying the cursor — throws away everything on
 * screen with each click, so reaching the fourth page means reading the first
 * three again and going back re-fetches them. The activity trail replaced
 * exactly that (activity-trail-pager.tsx) and this follows it.
 *
 * THE FIRST PAGE IS STILL SERVER-RENDERED. Only the pages after it arrive
 * through the action, so a reader who never clicks pays nothing for this and
 * the queue's first screen is not behind a fetch.
 *
 * The filters travel with the cursor. Page two of a filtered queue drawn from
 * the unfiltered one would quietly widen the slice — both the easiest mistake
 * here and the hardest to notice.
 */
export function TriageQueuePager({
  initialCursor,
  filters,
  canTriage,
  canDelete,
  assignableUsers,
}: {
  /** Cursor after the server-rendered page, or null when it was the last. */
  initialCursor: string | null
  filters: BugFilters
  canTriage: (bug: BugQueueRow) => boolean
  canDelete: (bug: BugQueueRow) => boolean
  assignableUsers: readonly { id: string; name: string }[]
}) {
  const [appended, setAppended] = useState<BugQueueRow[]>([])
  const [cursor, setCursor] = useState(initialCursor)
  const [error, setError] = useState<string | null>(null)
  const [pending, startLoading] = useTransition()

  // One page in flight at a time: a double-click must not fetch the same
  // cursor twice and append the same rows twice. The pending flag disables the
  // button, but the ref is what closes the window between the two clicks.
  const inFlight = useRef(false)

  function loadMore() {
    if (inFlight.current || !cursor) return
    inFlight.current = true
    setError(null)
    startLoading(async () => {
      try {
        const res = await loadMoreTriageBugs({ before: cursor, filters })
        if (!res.ok) {
          setError(res.error)
          return
        }
        // Deduplicated by id even though the keyset walk should not repeat a
        // row: a bug triaged to a closed status between two clicks changes what
        // page two contains, and a duplicate key in a list is a React error
        // rather than a cosmetic one.
        setAppended((current) => {
          const seen = new Set(current.map((bug) => bug.id))
          return [...current, ...res.data.rows.filter((bug) => !seen.has(bug.id))]
        })
        setCursor(res.data.nextCursor)
      } catch {
        setError('Could not load more — try again.')
      } finally {
        inFlight.current = false
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {appended.length > 0 ? (
        <BugList
          bugs={appended}
          emptyHint=""
          statusChoices={[]}
          showApp
          assignableUsers={assignableUsers}
          canTriage={(bug) => canTriage(bug as BugQueueRow)}
          canDelete={(bug) => canDelete(bug as BugQueueRow)}
        />
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-2xs text-destructive">
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {/* Announced, because appending rows below the fold is a change a screen
          reader is otherwise never told about. */}
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? 'Loading more bugs' : appended.length > 0 ? `${appended.length} more loaded` : ''}
      </span>

      {cursor ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={pending}
          onClick={loadMore}
        >
          {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
          {error ? 'Try again' : 'Load more'}
        </Button>
      ) : appended.length > 0 ? (
        // Only after the reader has actually walked the queue. Printing "end of
        // the queue" under a single short page would be stating the obvious.
        <p className="text-2xs text-muted-foreground">That is the end of the queue.</p>
      ) : null}
    </div>
  )
}
