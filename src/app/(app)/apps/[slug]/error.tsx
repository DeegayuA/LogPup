'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Scoped to the [slug] segment so a failure inside one app doesn't take the
 * Apps index down with it — the parent boundary stays available, and "Back to
 * all apps" is a route the user can actually reach from here.
 *
 * Deliberately not a 404: `notFound()` already handles "no such app", so
 * anything reaching this boundary is a genuine failure, and telling someone
 * their app doesn't exist when the board query merely timed out is worse than
 * saying nothing.
 */
export default function AppDetailError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[apps] detail render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">This app wouldn&apos;t load.</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Something failed while fetching this app&apos;s data. The app itself is fine —
          nothing was changed. Try again, or head back to the list.
        </p>
      </div>
      {error.digest ? (
        <p className="font-mono text-2xs text-muted-foreground tabular-nums">
          Reference {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" render={<Link href="/apps" />}>
          Back to all apps
        </Button>
      </div>
    </div>
  )
}
