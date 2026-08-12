'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Scoped to the [id] segment so one person's failed render doesn't take the
 * People directory down with it — the parent boundary stays mounted and "Back
 * to people" is a route the user can actually reach from here.
 *
 * DELIBERATELY NOT A 404. A malformed id is already a `notFound()` (the page
 * zod-parses the param before touching the database), so anything arriving at
 * this boundary is a genuine failure — a timed-out query, not a person who
 * doesn't exist. Telling someone their teammate has been deleted because the
 * follow-ups query hiccuped would be a much worse lie than saying nothing.
 *
 * `retry` (not `reset`) is the Next 16 prop name; it re-runs the server render
 * for this segment, which is the right first move when the usual cause is a
 * transient database blip.
 */
export default function PersonDetailError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[people] person detail render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          This profile wouldn&apos;t load.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Something failed while fetching their workload, tasks or meetings. Nothing was
          changed — their allocations and follow-ups are exactly as they were. Try again, or
          head back to the directory.
        </p>
      </div>
      {error.digest ? (
        <p className="font-mono text-2xs tabular-nums text-muted-foreground">
          Reference {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" render={<Link href="/people" />}>
          Back to people
        </Button>
      </div>
    </div>
  )
}
