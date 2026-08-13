'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The third state /activity never had.
 *
 * The trail runs a keyset scan, and a search that misses runs a second query
 * behind it; before this, either failing dropped the reader on the framework's
 * crash screen with no route back into the product. "Start over" points at the
 * bare route rather than reloading the current URL, because the most likely
 * cause reachable from here is a filter combination the reader can simply
 * abandon.
 */
export default function ActivityError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[activity] trail render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          LogPup lost the scent of the trail.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The activity query failed. This is usually the database being briefly unreachable —
          try again, and if it keeps happening send an admin the reference below.
        </p>
      </div>
      {error.digest ? (
        <p className="font-mono text-2xs tabular-nums text-muted-foreground">
          Reference {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" render={<Link href="/activity" />}>
          Start over
        </Button>
      </div>
    </div>
  )
}
