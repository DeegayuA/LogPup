import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { diffStats, docsHref, type DiffLine } from '@/features/docs/docs'
import { RestoreRevisionButton } from './restore-revision-button'

/**
 * Two versions of a page as a line diff. Added and removed lines are told
 * apart by a visible + / − prefix and a screen-reader word as well as by
 * colour, so the diff reads the same without colour vision or a screen.
 */

type Side = { version: number; title: string; authorName: string; createdAt: Date }

export function DocCompare({
  slug,
  docId,
  title,
  currentVersion,
  from,
  to,
  lines,
  canRestore,
}: {
  slug: string
  docId: string
  title: string
  currentVersion: number
  from: Side
  to: Side
  lines: DiffLine[]
  canRestore: boolean
}) {
  const stats = diffStats(lines)
  const titleChanged = from.title !== to.title
  return (
    <section aria-labelledby="doc-compare-title" className="flex flex-col gap-4">
      <Link
        href={docsHref(slug, { doc: docId, mode: 'history' })}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to history
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="doc-compare-title" className="font-heading text-lg font-semibold">
            “{title}”: version {from.version} → version {to.version}
          </h2>
          <p className="text-sm text-muted-foreground">
            v{from.version} by {from.authorName}, {format(from.createdAt, 'MMM d, yyyy')} · v{to.version} by {to.authorName},{' '}
            {format(to.createdAt, 'MMM d, yyyy')} ·{' '}
            <span className="tabular-nums">
              {stats.added} {stats.added === 1 ? 'line' : 'lines'} added, {stats.removed} removed
            </span>
          </p>
          {titleChanged ? (
            <p className="text-sm text-muted-foreground">
              Title changed from “{from.title}” to “{to.title}”.
            </p>
          ) : null}
        </div>
        {canRestore ? (
          <div className="flex flex-wrap gap-2">
            {from.version !== currentVersion ? <RestoreRevisionButton slug={slug} docId={docId} version={from.version} /> : null}
            {to.version !== currentVersion ? <RestoreRevisionButton slug={slug} docId={docId} version={to.version} /> : null}
          </div>
        ) : null}
      </div>

      {stats.added === 0 && stats.removed === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
          The text of these two versions is the same.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <ol className="min-w-full py-2 font-mono text-xs leading-6" aria-label="Line by line changes">
            {lines.map((line, index) => (
              <li
                key={index}
                className={cn(
                  'flex gap-3 px-3 whitespace-pre-wrap break-words',
                  line.kind === 'added' && 'bg-success/10',
                  line.kind === 'removed' && 'bg-destructive/10',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'w-3 shrink-0 select-none text-center font-semibold',
                    line.kind === 'added' && 'text-success',
                    line.kind === 'removed' && 'text-destructive',
                  )}
                >
                  {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '}
                </span>
                <span className="min-w-0 flex-1">
                  {line.kind !== 'same' ? <span className="sr-only">{line.kind === 'added' ? 'Added: ' : 'Removed: '}</span> : null}
                  {line.text === '' ? ' ' : line.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
