'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Scoped to /people/history. The parent boundary used to cover this route
 * too, but its copy was directory-specific ("couldn't load your people") and
 * its recovery link went to the dashboard — so a failed history query
 * mislabeled itself AND threw away the date and comparison window the user
 * had dialed in. This boundary names the page that actually failed, and
 * "Try again" re-renders the SAME URL, so ?at/?window/?view/?q all survive
 * the retry.
 */
export default function CapacityHistoryError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[people] capacity history render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          Capacity history wouldn&apos;t load.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The history query failed — usually the database being briefly unreachable. Trying
          again keeps the date and window you had picked; nothing you chose is lost.
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
