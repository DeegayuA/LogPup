'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The Apps index had no error boundary at all, so a failed portfolio query
 * dropped the user on the framework's error page with no way back into the
 * product. Every list in this codebase owes three states — empty, loading,
 * error — and this is the third one.
 *
 * `retry` (not `reset`) is the Next 16 prop name; it re-runs the server
 * render for this segment, which is the right first move because the usual
 * cause here is a transient database hiccup rather than a bad request.
 */
export default function AppsError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[apps] index render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          LogPup couldn&apos;t fetch your apps.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The portfolio query failed. This is usually the database being briefly
          unreachable — try again, and if it keeps happening send an admin the
          reference below.
        </p>
      </div>
      {error.digest ? (
        <p className="font-mono text-2xs text-muted-foreground tabular-nums">
          Reference {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" render={<Link href="/" />}>
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}
