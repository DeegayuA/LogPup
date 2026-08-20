'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { loadOlderActivity } from '@/features/activity/actions'
import { ActivityTrail } from '@/features/activity/components/activity-feed'
import { activityParams, type ActivityParamState } from '@/features/activity/filters'
import type { ActivityRow } from '@/features/activity/types'

/**
 * The trail plus a "Load older" that APPENDS.
 *
 * The old control was a cursor link that replaced the page: each click threw
 * away every row already read, the scroll position among them, and cost a
 * full navigation per page walked. This pager keeps the server-rendered first
 * page as its seed and accumulates later pages from the loadOlderActivity
 * server action, re-grouping the WHOLE accumulated list each time — so a day
 * split across two pages merges under one day marker instead of printing two.
 *
 * The URL still carries the cursor — history.replaceState after each append —
 * so a reload or a shared link deep-links to "where I had read to" exactly as
 * the link version did. It just no longer costs the rows above it.
 *
 * The PARENT keys this component by the canonical filter querystring: any
 * real navigation (filter change, back button) remounts it with a fresh seed,
 * which is what guarantees accumulated pages can never leak across filters.
 */
export function ActivityTrailPager({
  initialRows,
  initialHasMore,
  initialCursor,
  state,
  grouped,
  now,
}: {
  initialRows: ActivityRow[]
  initialHasMore: boolean
  /** Keyset cursor after the last PRIMARY-ordered row, or null at the end. */
  initialCursor: string | null
  state: ActivityParamState
  grouped: boolean
  /** The server render's clock, so day bucketing agrees with the day markers. */
  now: Date
}) {
  const [olderRows, setOlderRows] = useState<ActivityRow[]>([])
  const [cursor, setCursor] = useState(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedCount, setLoadedCount] = useState(0)
  // Request dedup: one page in flight at a time — a double-click must not
  // fetch the same cursor twice and append the page twice.
  const inFlight = useRef(false)

  async function loadOlder() {
    if (inFlight.current || !cursor) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      const result = await loadOlderActivity({
        person: state.person || undefined,
        type: state.type || undefined,
        app: state.app || undefined,
        from: state.from || undefined,
        to: state.to || undefined,
        q: state.q || undefined,
        before: cursor,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOlderRows((rows) => [...rows, ...result.data.rows])
      setLoadedCount(result.data.rows.length)
      setHasMore(result.data.hasMore)
      setCursor(result.data.nextCursor)
      // Keep the cursor in the URL for deep-linking WITHOUT a navigation — a
      // navigation is exactly what appending exists to avoid. A reload or a
      // shared link resumes from this cursor, same as the old link version.
      const qs = activityParams(state, result.data.nextCursor ?? undefined).toString()
      window.history.replaceState(null, '', qs ? `/activity?${qs}` : '/activity')
    } catch {
      setError('Loading older changes failed — check your connection and try again.')
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  const rows = olderRows.length > 0 ? [...initialRows, ...olderRows] : initialRows

  return (
    <div className="flex flex-col gap-5">
      <ActivityTrail rows={rows} now={now} grouped={grouped} current={state} />

      {/* Announce appends politely: the new rows land ABOVE this control, so
          a screen-reader user who activated the button needs told that
          anything happened at all. */}
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? 'Loading older changes…' : null}
        {!pending && loadedCount > 0
          ? `Loaded ${loadedCount} older ${loadedCount === 1 ? 'change' : 'changes'}.`
          : null}
      </span>

      {error ? (
        <div className="flex flex-col items-center gap-2">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={() => void loadOlder()}>
            Try again
          </Button>
        </div>
      ) : hasMore ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadOlder()}
            aria-busy={pending || undefined}
            // aria-disabled + the inFlight guard rather than `disabled`: a
            // disabled button drops keyboard focus to the body at the exact
            // moment the rows arrive.
            aria-disabled={pending || undefined}
          >
            {pending ? 'Loading…' : 'Load older'}
          </Button>
        </div>
      ) : olderRows.length > 0 ? (
        // The button unmounts once the trail is exhausted; say so rather than
        // vanishing (and only when this pager actually walked pages — a
        // one-page trail needs no epitaph).
        <p className="text-center font-mono text-2xs tabular-nums text-muted-foreground">
          End of the trail.
        </p>
      ) : null}
    </div>
  )
}
