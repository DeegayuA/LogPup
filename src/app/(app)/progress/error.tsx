'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The third state for /progress — same shape as the People boundary: name
 * what failed, offer the retry, keep a route back into the product, and
 * surface the digest so an admin has something to search the logs with.
 */
export default function ProgressError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[progress] render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          LogPup couldn&apos;t load the progress view.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          One of the matrix or app queries failed. This is usually the database being briefly
          unreachable — try again, and if it keeps happening send an admin the reference below.
        </p>
      </div>
      {error.digest ? (
        <p className="font-mono text-2xs tabular-nums text-muted-foreground">
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
