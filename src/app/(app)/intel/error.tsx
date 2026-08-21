'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Scoped to /intel, and narrower than it looks.
 *
 * The page already handles the failures it EXPECTS: getSignals and getBriefing
 * both return ActionResult, and each region renders its own error without
 * taking the others down — a broken signals read still leaves you the ask box,
 * and the briefing degrades to a derived summary rather than failing at all.
 * So this boundary only ever catches what those cannot: a throw during render,
 * or a malformed ?ask= that blows up before any region is reached.
 *
 * It exists anyway because the (app) group boundary is the alternative, and
 * that one's copy names the shell rather than the page — a reader would be
 * told something generic about the workspace when what actually failed was the
 * briefing surface. Naming the page that broke is most of what an error state
 * is for.
 *
 * "Try again" re-renders the SAME url, so a question arriving from the command
 * palette in ?ask= survives the retry. Sending the person back to a bare
 * /intel would make them retype the query ⌘K handed over — the exact retyping
 * the param was added to prevent.
 */
export default function StudioIntelError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[intel] studio intel render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">LogPup 🐾 Intel wouldn&apos;t load.</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Nothing here is a record of its own — every signal is read from your tasks, sprints,
          meetings and work log, so nothing has been lost and none of it is out of date. Trying
          again keeps the question you arrived with.
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
