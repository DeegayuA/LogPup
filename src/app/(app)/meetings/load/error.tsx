'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The board's own boundary, so a failed sweep does not take the whole (app)
 * shell's generic crash screen.
 *
 * Worth its own file because the exit is different: everything this page shows
 * is derived, nothing on it is stored, and the meetings list is a complete
 * answer to "what did I come here for" while the sweep is unavailable.
 */
export default function MeetingLoadError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[meetings/load] sweep failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          LogPup could not work out the meeting load.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Nothing on this page is stored — it is worked out fresh from open follow-ups and
          deadlines each time — so a failure here has changed nothing and lost nothing.
        </p>
      </div>
      {error.digest ? (
        <p className="font-mono text-2xs tabular-nums text-muted-foreground">
          Reference {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" render={<Link href="/meetings" />}>
          Back to meetings
        </Button>
      </div>
    </div>
  )
}
