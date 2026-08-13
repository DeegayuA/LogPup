'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Settings reads the database (Gemini keys, avatar, job role) before it can
 * render, so it can fail — and a settings page that drops you on the
 * framework's error screen is a bad place to lose someone, because the way
 * back into the product is exactly what they came here to find.
 *
 * `retry` (not `reset`) is the Next 16 prop name; it re-runs the server
 * render for this segment, which is the right first move because the usual
 * cause is a transient database hiccup rather than a bad request. Same shape
 * as app/(app)/apps/error.tsx.
 */
export default function SettingsError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[settings] render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          LogPup couldn&apos;t load your settings.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your theme is unaffected — it lives in this browser, not on the server. Only the
          account and AI details failed to load. Try again, and if it keeps happening send
          an admin the reference below.
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
