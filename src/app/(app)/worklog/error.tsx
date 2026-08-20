'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The work log's backstop. Each zone on the page catches its own query
 * failures inline, so this boundary should almost never fire — it exists for
 * what the zones cannot catch (a render bug, a failure in the page shell
 * itself), because the alternative is the framework's crash screen with no
 * route back into the product. Same shape as people/error.tsx.
 */
export default function WorklogError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[worklog] page render failed:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          LogPup couldn&apos;t load your work log.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Nothing you logged is lost — entries live on the server, not in this page. Try again,
          and if it keeps happening send an admin the reference below.
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
