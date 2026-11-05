import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, History, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { docsHref, type DocCategory } from '@/features/docs/docs'
import type { DocCommentRow, DocLinkedItem } from '@/features/docs/queries'
import { MarkdownView } from './markdown-view'
import { DiscussButton } from '@/features/chat/components/discuss-button'
import { DeleteDocButton, DocComments, DocFiles, DocLinks, type DocFile } from './doc-page-parts'

/**
 * One page, read mode. Server rendered: the body is Markdown rendered on the
 * server (no editor JS shipped to readers). The interactive parts — delete,
 * links, files, comments — are small client islands in doc-page-parts.tsx
 * that call a server action and refresh the route.
 */
export function DocPage({
  slug,
  doc,
  taskLinks,
  links,
  files,
  comments,
  mentionUsers,
  canWrite,
  canComment,
  canDelete,
}: {
  slug: string
  doc: {
    id: string
    title: string
    category: DocCategory
    categoryLabel: string
    body: string
    version: number
    updatedByName: string
    updatedAt: Date
  }
  taskLinks: Record<string, string>
  links: DocLinkedItem[]
  files: DocFile[]
  comments: (DocCommentRow & { canDelete: boolean })[]
  mentionUsers: { id: string; name: string }[]
  canWrite: boolean
  canComment: boolean
  canDelete: boolean
}) {
  return (
    <article className="flex flex-col gap-6" aria-labelledby="doc-title">
      <div className="flex flex-col gap-3">
        <Link
          href={docsHref(slug, { category: doc.category })}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          All {doc.categoryLabel.toLowerCase()}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 id="doc-title" className="font-heading text-xl font-semibold break-words">
              {doc.title}
            </h2>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{doc.categoryLabel}</Badge>
              <span>
                v{doc.version} · edited by {doc.updatedByName},{' '}
                <time dateTime={doc.updatedAt.toISOString()}>{format(doc.updatedAt, 'MMM d, yyyy h:mm a')}</time>
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canWrite ? (
              <Link href={docsHref(slug, { doc: doc.id, mode: 'edit' })} className={buttonVariants({ size: 'sm' })}>
                <Pencil aria-hidden />
                Edit
              </Link>
            ) : null}
            <Link
              href={docsHref(slug, { doc: doc.id, mode: 'history' })}
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              <History aria-hidden />
              History
            </Link>
            <DiscussButton type="doc" id={doc.id} />
            {canDelete ? <DeleteDocButton docId={doc.id} title={doc.title} hubHref={docsHref(slug)} /> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card px-5 py-5 sm:px-7">
        {doc.body.trim() === '' ? (
          <p className="text-sm text-muted-foreground">This page is empty.{canWrite ? ' Choose Edit to write it.' : ''}</p>
        ) : (
          <MarkdownView markdown={doc.body} taskLinks={taskLinks} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DocLinks docId={doc.id} links={links} canWrite={canWrite} />
        <DocFiles docId={doc.id} files={files} canWrite={canWrite} />
      </div>

      <DocComments docId={doc.id} comments={comments} mentionUsers={mentionUsers} canComment={canComment} />
    </article>
  )
}
