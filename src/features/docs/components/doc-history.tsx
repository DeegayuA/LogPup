'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { docsHref } from '@/features/docs/docs'
import type { DocRevisionRow } from '@/features/docs/queries'

/**
 * Every saved version of a page, newest first. Tick two to compare them; with
 * one ticked, Compare uses it against the current version. Compare is a URL
 * (?mode=compare&from&to), so a diff can be linked to from a comment.
 */
export function DocHistory({
  slug,
  docId,
  title,
  currentVersion,
  revisions,
}: {
  slug: string
  docId: string
  title: string
  currentVersion: number
  revisions: DocRevisionRow[]
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<number[]>([])

  function toggle(version: number) {
    setPicked((current) =>
      current.includes(version)
        ? current.filter((v) => v !== version)
        // Two at most: a third tick replaces the older pick.
        : [...current, version].slice(-2),
    )
  }

  const pair: [number, number] | null =
    picked.length === 2
      ? [Math.min(...picked), Math.max(...picked)]
      : picked.length === 1 && picked[0] !== currentVersion
        ? [Math.min(picked[0], currentVersion), Math.max(picked[0], currentVersion)]
        : null

  return (
    <section aria-labelledby="doc-history-title" className="flex flex-col gap-4">
      <Link
        href={docsHref(slug, { doc: docId })}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to the page
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="doc-history-title" className="font-heading text-lg font-semibold">
            History of “{title}”
          </h2>
          <p className="text-sm text-muted-foreground">Tick two versions to see what changed between them.</p>
        </div>
        <Button
          disabled={!pair}
          onClick={() => pair && router.push(docsHref(slug, { doc: docId, mode: 'compare', from: pair[0], to: pair[1] }))}
        >
          {pair ? `Compare v${pair[0]} with v${pair[1]}` : 'Compare'}
        </Button>
      </div>

      {revisions.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">No saved versions yet.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {revisions.map((rev) => {
            const id = `rev-${rev.version}`
            return (
              <li key={rev.version} className="flex items-start gap-3 px-4 py-3">
                <input
                  id={id}
                  type="checkbox"
                  checked={picked.includes(rev.version)}
                  onChange={() => toggle(rev.version)}
                  className="mt-1 size-4 accent-[var(--primary)]"
                  aria-describedby={`${id}-meta`}
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">Version {rev.version}</span>
                    {rev.version === currentVersion ? (
                      <span className="rounded-full bg-primary/10 px-2 text-2xs text-foreground">current</span>
                    ) : null}
                    <span className="truncate text-muted-foreground">{rev.summary ?? 'No note'}</span>
                  </label>
                  <p id={`${id}-meta`} className="text-xs text-muted-foreground">
                    {rev.authorName} · <time dateTime={new Date(rev.createdAt).toISOString()}>{format(rev.createdAt, 'MMM d, yyyy h:mm a')}</time> ·{' '}
                    <span className="tabular-nums">
                      +{rev.added}
                      <span className="sr-only"> lines added</span> −{rev.removed}
                      <span className="sr-only"> lines removed</span>
                    </span>
                  </p>
                </div>
                {rev.version > 1 ? (
                  <Link
                    href={docsHref(slug, { doc: docId, mode: 'compare', from: rev.version - 1, to: rev.version })}
                    className="shrink-0 text-xs text-primary underline-offset-2 hover:underline"
                    aria-label={`See what changed in version ${rev.version}`}
                  >
                    What changed
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
