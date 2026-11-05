import Link from 'next/link'
import { can, type Actor } from '@/features/auth/capabilities'
import { appViewers } from '@/features/sprints/app-viewers'
import { DOC_CATEGORY_LABEL, diffLines, docsHref, extractTaskKeys, parseDocCategory } from '@/features/docs/docs'
import {
  countDocsByCategory,
  getDoc,
  getRevisionPair,
  listDocAttachments,
  listDocComments,
  listDocLinks,
  listDocs,
  listRevisions,
  resolveTaskKeyLinks,
} from '@/features/docs/queries'
import { DocsHub } from './docs-hub'
import { DocPage } from './doc-page'
import { DocEditor } from './doc-editor'
import { DocHistory } from './doc-history'
import { DocCompare } from './doc-compare'

/**
 * The Docs tab (PRD Module C). A server component that reads its own URL
 * state and loads only what the chosen view needs, so app/[slug]/page.tsx
 * stays a one-line mount and pays nothing on other tabs.
 *
 *   ?tab=docs                          hub (categories, search, list)
 *   &doc=<id>                          one page
 *   &doc=<id>&mode=edit|history        its editor / its history
 *   &doc=<id>&mode=compare&from&to     two revisions side by side as a diff
 *   &doc=new&category=<c>              editor for a new page
 *
 * The page has already decided the viewer holds app.view on this project
 * (the tab is gated on it). Write controls are shown from `can()` here and
 * re-checked by every server action.
 */

type Search = Record<string, string | string[] | undefined>

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

function positiveInt(raw: string | undefined): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function DocsTab({
  app,
  actor,
  search,
}: {
  app: { id: string; slug: string; name: string }
  actor: Actor
  search: Search
}) {
  const resource = { appId: app.id }
  const canWrite = can(actor, 'task.create', resource)
  const canComment = can(actor, 'task.comment', resource)
  const canManage = can(actor, 'sprint.manage', resource)

  const docParam = one(search.doc)
  const mode = one(search.mode)
  const category = parseDocCategory(one(search.category))
  const q = (one(search.q) ?? '').slice(0, 100)

  if (docParam === 'new') {
    if (!canWrite) return <Notice slug={app.slug} text="You can read this project’s docs, but not add pages." />
    return (
      <DocEditor
        mode="create"
        appId={app.id}
        slug={app.slug}
        initial={{ title: '', category: category ?? 'project', body: '' }}
      />
    )
  }

  if (!docParam) {
    const [rows, counts] = await Promise.all([listDocs(app.id, q), countDocsByCategory(app.id)])
    return (
      <DocsHub
        slug={app.slug}
        rows={category ? rows.filter((r) => r.category === category) : rows}
        counts={counts}
        category={category}
        query={q}
        canWrite={canWrite}
      />
    )
  }

  const doc = await getDoc(app.id, docParam)
  if (!doc) return <Notice slug={app.slug} text="This page doesn’t exist or was deleted." />

  if (mode === 'edit') {
    if (!canWrite) return <Notice slug={app.slug} text="You can read this page, but not edit it." />
    const taskLinks = await resolveTaskKeyLinks(app.id, app.slug, extractTaskKeys(doc.body))
    return (
      <DocEditor
        mode="edit"
        appId={app.id}
        slug={app.slug}
        docId={doc.id}
        baseVersion={doc.version}
        initial={{ title: doc.title, category: doc.category, body: doc.body }}
        taskLinks={taskLinks}
      />
    )
  }

  if (mode === 'history') {
    const revisions = await listRevisions(doc.id)
    return <DocHistory slug={app.slug} docId={doc.id} title={doc.title} currentVersion={doc.version} revisions={revisions} />
  }

  if (mode === 'compare') {
    const from = positiveInt(one(search.from))
    const to = positiveInt(one(search.to))
    const pair = from && to ? await getRevisionPair(doc.id, Math.min(from, to), Math.max(from, to)) : null
    if (!pair) return <Notice slug={app.slug} text="Those two versions could not be found." backHref={docsHref(app.slug, { doc: doc.id, mode: 'history' })} />
    return (
      <DocCompare
        slug={app.slug}
        docId={doc.id}
        title={doc.title}
        currentVersion={doc.version}
        from={{ version: pair.from.version, authorName: pair.from.authorName, createdAt: pair.from.createdAt, title: pair.from.title }}
        to={{ version: pair.to.version, authorName: pair.to.authorName, createdAt: pair.to.createdAt, title: pair.to.title }}
        lines={diffLines(pair.from.body, pair.to.body)}
        canRestore={canWrite}
      />
    )
  }

  const [taskLinks, links, files, comments, mentionUsers] = await Promise.all([
    resolveTaskKeyLinks(app.id, app.slug, extractTaskKeys(doc.body)),
    listDocLinks(app.id, app.slug, doc.id),
    listDocAttachments(doc.id),
    listDocComments(doc.id),
    appViewers(app.id),
  ])
  return (
    <DocPage
      slug={app.slug}
      doc={{
        id: doc.id,
        title: doc.title,
        category: doc.category,
        categoryLabel: DOC_CATEGORY_LABEL[doc.category],
        body: doc.body,
        version: doc.version,
        updatedByName: doc.updatedByName,
        updatedAt: doc.updatedAt,
      }}
      taskLinks={taskLinks}
      links={links}
      files={files.map((f) => ({ ...f, canDelete: (f.uploadedBy === actor.id && canWrite) || canManage }))}
      comments={comments.map((c) => ({ ...c, canDelete: (c.authorId === actor.id && canComment) || canManage }))}
      mentionUsers={mentionUsers}
      canWrite={canWrite}
      canComment={canComment}
      canDelete={(doc.createdBy === actor.id && canWrite) || canManage}
    />
  )
}

function Notice({ slug, text, backHref }: { slug: string; text: string; backHref?: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
      <p>{text}</p>
      <Link href={backHref ?? docsHref(slug)} className="text-primary underline underline-offset-2">
        Back to Docs
      </Link>
    </div>
  )
}
