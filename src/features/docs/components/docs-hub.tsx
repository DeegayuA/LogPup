import Link from 'next/link'
import { format } from 'date-fns'
import { FileText, Plus, Search } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { DOC_CATEGORIES, DOC_CATEGORY_LABEL, docsHref, type DocCategory } from '@/features/docs/docs'
import type { DocListRow } from '@/features/docs/queries'

/**
 * The Docs landing view: categories down the side, the pages on the right.
 * Server rendered with no client JS — the search box is a GET form and every
 * category is a link, so the URL owns the state and a filtered list can be
 * shared or bookmarked.
 */
export function DocsHub({
  slug,
  rows,
  counts,
  category,
  query,
  canWrite,
}: {
  slug: string
  rows: DocListRow[]
  counts: Record<DocCategory, number>
  category: DocCategory | null
  query: string
  canWrite: boolean
}) {
  const total = DOC_CATEGORIES.reduce((sum, c) => sum + counts[c], 0)
  const linkClass = (active: boolean) =>
    cn(
      'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active ? 'bg-primary/10 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    )

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start">
      <h2 className="sr-only">Docs</h2>
      <aside className="flex flex-col gap-4 md:w-60 md:shrink-0">
        {canWrite ? (
          <Link
            href={docsHref(slug, { doc: 'new', category: category ?? undefined })}
            className={cn(buttonVariants(), 'w-full')}
          >
            <Plus aria-hidden />
            New page
          </Link>
        ) : null}

        <form action={`/apps/${slug}`} method="get" role="search" className="relative">
          <input type="hidden" name="tab" value="docs" />
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Search pages…"
            aria-label="Search page titles and text"
            maxLength={100}
            className="pl-8"
          />
        </form>

        <nav aria-label="Doc categories">
          <ul className="flex flex-col gap-0.5">
            <li>
              <Link
                href={docsHref(slug, { q: query || undefined })}
                aria-current={category === null ? 'page' : undefined}
                className={linkClass(category === null)}
              >
                <span>All pages</span>
                <span className="font-mono text-2xs tabular-nums">{total}</span>
              </Link>
            </li>
            {DOC_CATEGORIES.map((c) => (
              <li key={c}>
                <Link
                  href={docsHref(slug, { category: c, q: query || undefined })}
                  aria-current={category === c ? 'page' : undefined}
                  className={linkClass(category === c)}
                >
                  <span className="truncate">{DOC_CATEGORY_LABEL[c]}</span>
                  <span className="font-mono text-2xs tabular-nums">{counts[c]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <section aria-labelledby="docs-list-heading" className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="docs-list-heading" className="font-heading text-base font-semibold">
            {category ? DOC_CATEGORY_LABEL[category] : 'All pages'}
          </h3>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {query ? `${rows.length} ${rows.length === 1 ? 'page matches' : 'pages match'} “${query}”` : `${rows.length} ${rows.length === 1 ? 'page' : 'pages'}`}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={query ? 'No pages match your search' : total === 0 ? 'No pages yet' : 'No pages in this category'}
            description={
              query
                ? 'Try different words, or clear the search.'
                : 'Docs keep the team’s know-how in one place: requirements, setup steps, runbooks and notes.'
            }
            action={
              query ? (
                <Link href={docsHref(slug, { category: category ?? undefined })} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Clear search
                </Link>
              ) : canWrite ? (
                <Link href={docsHref(slug, { doc: 'new', category: category ?? undefined })} className={buttonVariants({ size: 'sm' })}>
                  Write the first page
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={docsHref(slug, { doc: row.id })}
                  className="flex items-start gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {DOC_CATEGORY_LABEL[row.category]} · v{row.version} · edited by {row.updatedByName},{' '}
                      <time dateTime={row.updatedAt.toISOString()}>{format(row.updatedAt, 'MMM d, yyyy')}</time>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
