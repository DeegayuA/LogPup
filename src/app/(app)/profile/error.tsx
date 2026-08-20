'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Profile reads the database (passkeys, phone, avatar, job role) before it
 * can render, so it can fail — and until this file existed, failure landed
 * on the framework's default screen with no retry and no reference.
 *
 * `retry` (not `reset`) is the Next 16 prop name; it re-runs the server
 * render for this segment, which is the right first move because the usual
 * cause is a transient database hiccup rather than a bad request. Same shape
 * as settings/error.tsx next door.
 */
export default function ProfileError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[profile] render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          LogPup couldn&apos;t load your profile.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Nothing was changed — your details are safe on the server; only reading them
          failed. Try again, and if it keeps happening send an admin the reference below.
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
