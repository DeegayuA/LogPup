'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * /pending is outside the (app) group, so before this file existed a failed
 * phone/session read dropped an UNAPPROVED user — the person least equipped
 * to recover — onto the framework's raw error screen.
 *
 * `retry` (not `reset`) is the Next 16 prop name; it re-runs the server
 * render for this segment. Same shape as settings/error.tsx.
 */
export default function PendingError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[pending] render failed:', error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          LogPup couldn&apos;t check your approval status.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your sign-in worked — only this page failed to load, usually from a brief
          database hiccup. Try again, and if it keeps happening tell whoever invited you
          and mention the reference below.
        </p>
      </div>
      {error.digest ? (
        <p className="font-mono text-2xs tabular-nums text-muted-foreground">
          Reference {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" render={<Link href="/sign-in" />}>
          Back to sign-in
        </Button>
      </div>
    </main>
  )
}
