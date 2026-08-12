'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Covers the People directory and the capacity-history view; the person detail
 * page has its own tighter boundary one segment down.
 *
 * Rule 6 asks every surface for three states. People had two — an empty state
 * and a skeleton — so a failed capacity query dropped the user on the
 * framework's crash screen with no route back into the product. This is the
 * third.
 */
export default function PeopleError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[people] directory render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          LogPup couldn&apos;t load your people.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The capacity query failed. This is usually the database being briefly
          unreachable — try again, and if it keeps happening send an admin the reference
          below.
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
