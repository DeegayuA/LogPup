'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The admin area's own boundary. Before this file existed, one failed query on
 * any section — People, Approvals, Trash, the Overview's four reads — bubbled
 * to the root boundary and took the whole shell down with it.
 *
 * Renders inside the admin layout, so the section nav stays standing and the
 * admin can move to a section whose queries are still healthy instead of
 * being dropped out of the area entirely.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[admin] section render failed:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border p-8 text-center">
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold">
          LogPup couldn&apos;t load this admin section.
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          A query behind this section failed. This is usually the database being briefly
          unreachable — try again, and if it keeps happening send an admin the reference
          below. Nothing was changed by the failure.
        </p>
      </div>
      {error.digest ? (
        <p className="font-mono text-2xs tabular-nums text-muted-foreground">
          Reference {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" render={<Link href="/admin" />}>
          Admin overview
        </Button>
      </div>
    </div>
  )
}
