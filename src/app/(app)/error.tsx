'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The error boundary the app's most-visited page never had.
 *
 * The dashboard streams three zones, each a batch of queries — a thrown read
 * in any of them escalates past its Suspense boundary, and before this file
 * existed it landed on the framework's default crash screen with no route
 * back into the product. Same pattern as /activity's error.tsx: retry the
 * render, offer the bare route as an exit, and print the digest in mono so
 * "it broke" can become a greppable report.
 *
 * This boundary also backstops every (app) route without its own error.tsx —
 * the copy names nothing dashboard-specific for exactly that reason.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[app] page render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          LogPup stumbled loading this page.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          A query behind this page failed. This is usually the database being briefly
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
          Go to the dashboard
        </Button>
      </div>
    </div>
  )
}
