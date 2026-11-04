'use client'

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Link2, Paperclip, Trash2, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { MentionText, MentionTextarea } from '@/components/mention-textarea'
import { ATTACHMENT_ACCEPT, formatBytes } from '@/features/sprints/attachments'
import {
  addDocComment,
  deleteDoc,
  deleteDocAttachment,
  deleteDocComment,
  linkDocToTask,
  searchDocLinkTargets,
  unlinkDoc,
} from '@/features/docs/actions'
import type { DocCommentRow, DocLinkedItem } from '@/features/docs/queries'
import { uploadDocFile } from './doc-upload'

/**
 * The interactive islands on a read-mode page. Each one calls a server action
 * and then router.refresh(): the page is server rendered from the database,
 * so a refresh is the one source of truth and nothing here keeps a second
 * copy that could drift.
 *
 * API-skill choices: request dedup (a pending guard on every button, a
 * generation counter on the link search so a slow answer for "lo" cannot
 * overwrite the one for "log"); the comment composer keeps its text on
 * failure (the one loss a comment box must not have). No optimistic rows —
 * the refresh lands in one round trip and a page's discussion is not a chat.
 * No polling or streaming: a page is read, not watched.
 */

function useAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  function run<T>(action: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, onOk?: (data: T) => void) {
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        onOk?.(result.data)
        router.refresh()
      } catch {
        toast.error('Could not reach the server — try again')
      }
    })
  }
  return { pending, run, router }
}

export function DeleteDocButton({ docId, title, hubHref }: { docId: string; title: string; hubHref: string }) {
  const { pending, run, router } = useAction()
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="destructive" disabled={pending} />}>
        <Trash2 aria-hidden />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The page leaves the Docs list for everyone. An admin can bring it back from Trash, with all its history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              run(() => deleteDoc(docId), () => {
                toast.success('Page deleted')
                router.push(hubHref)
              })
            }
          >
            Delete page
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type Target = { id: string; key: string | null; title: string }

export function DocLinks({ docId, links, canWrite }: { docId: string; links: DocLinkedItem[]; canWrite: boolean }) {
  const { pending, run } = useAction()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Target[]>([])
  const generation = useRef(0)

  useEffect(() => {
    const q = query.trim()
    const mine = ++generation.current
    if (q.length < 2) return
    const timer = setTimeout(() => {
      searchDocLinkTargets(docId, q).then(
        (result) => {
          if (mine === generation.current) setResults(result.ok ? result.data : [])
        },
        () => undefined,
      )
    }, 250)
    return () => clearTimeout(timer)
  }, [docId, query])

  const shown = query.trim().length < 2 ? [] : results.filter((r) => !links.some((l) => l.id === r.id))

  return (
    <section aria-labelledby="doc-links-heading" className="flex flex-col gap-3">
      <h3 id="doc-links-heading" className="flex items-center gap-1.5 font-heading text-sm font-semibold">
        <Link2 aria-hidden className="size-4 text-muted-foreground" />
        Linked work
      </h3>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks or bugs are linked to this page yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {links.map((link) => (
            <li key={link.linkId} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
              <span className="font-mono text-2xs text-muted-foreground">{link.key ?? (link.type === 'bug' ? 'Bug' : 'Task')}</span>
              <Link href={link.href} className="min-w-0 flex-1 truncate hover:underline">
                {link.title}
              </Link>
              <span className="text-2xs text-muted-foreground">{link.status.replace(/_/g, ' ')}</span>
              {canWrite ? (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Unlink ${link.key ?? link.title}`}
                  onClick={() => run(() => unlinkDoc(docId, link.linkId))}
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doc-link-search" className="text-xs text-muted-foreground">
            Link a task this page documents
          </label>
          <Input
            id="doc-link-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a task title or key, e.g. LOG-12"
            autoComplete="off"
            maxLength={100}
          />
          {shown.length > 0 ? (
            <ul className="flex flex-col rounded-lg border bg-card" aria-label="Matching tasks">
              {shown.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={pending}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                    onClick={() =>
                      run(() => linkDocToTask(docId, t.id), () => {
                        setQuery('')
                        setResults([])
                        toast.success('Task linked')
                      })
                    }
                  >
                    <span className="font-mono text-2xs text-muted-foreground">{t.key ?? 'Task'}</span>
                    <span className="truncate">{t.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export type DocFile = {
  id: string
  name: string
  mime: string
  bytes: number
  uploaderName: string
  createdAt: Date
  href: string
  canDelete: boolean
}

export function DocFiles({ docId, files, canWrite }: { docId: string; files: DocFile[]; canWrite: boolean }) {
  const { pending, run, router } = useAction()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onPick(list: FileList | null) {
    const file = list?.[0]
    if (!file || uploading) return
    setUploading(true)
    const result = await uploadDocFile(docId, file)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`${result.name} attached`)
    router.refresh()
  }

  return (
    <section aria-labelledby="doc-files-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="doc-files-heading" className="flex items-center gap-1.5 font-heading text-sm font-semibold">
          <Paperclip aria-hidden className="size-4 text-muted-foreground" />
          Attachments
        </h3>
        {canWrite ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => void onPick(e.target.files)}
            />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? 'Uploading…' : 'Attach a file'}
            </Button>
          </>
        ) : null}
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files on this page.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
              <a href={f.href} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                {f.name}
              </a>
              <span className="text-2xs text-muted-foreground tabular-nums">{formatBytes(f.bytes)}</span>
              {f.canDelete ? (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Remove ${f.name}`}
                  onClick={() => run(() => deleteDocAttachment(f.id), () => toast.success('File removed'))}
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function DocComments({
  docId,
  comments,
  mentionUsers,
  canComment,
}: {
  docId: string
  comments: (DocCommentRow & { canDelete: boolean })[]
  mentionUsers: { id: string; name: string }[]
  canComment: boolean
}) {
  const { pending, run } = useAction()
  const [draft, setDraft] = useState('')

  function post() {
    const text = draft.trim()
    if (!text || pending) return
    run(() => addDocComment(docId, text), () => setDraft(''))
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      post()
    }
  }

  return (
    <section aria-labelledby="doc-comments-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="doc-comments-heading" className="font-heading text-sm font-semibold">
          Comments
        </h3>
        <span className="font-mono text-2xs text-muted-foreground tabular-nums">
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </span>
      </div>
      {comments.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
          No comments yet. Ask a question or suggest a change.
        </p>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="Comments">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar size="sm">
                {c.authorAvatarUrl ? <AvatarImage src={c.authorAvatarUrl} alt="" /> : null}
                <AvatarFallback>{c.authorName.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{c.authorName}</span>
                  <time dateTime={new Date(c.createdAt).toISOString()} className="text-xs text-muted-foreground">
                    {formatDistanceToNow(c.createdAt, { addSuffix: true })}
                  </time>
                  {c.canDelete ? (
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button size="xs" variant="ghost" className="ml-auto" aria-label={`Delete comment by ${c.authorName}`} />
                        }
                      >
                        Delete
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
                          <AlertDialogDescription>It disappears from the page for everyone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => run(() => deleteDocComment(c.id))}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
                <MentionText text={c.body} users={mentionUsers} className="block text-sm whitespace-pre-wrap break-words" />
              </div>
            </li>
          ))}
        </ul>
      )}
      {canComment ? (
        <div className="flex flex-col gap-2">
          <MentionTextarea
            users={mentionUsers}
            value={draft}
            onValueChange={setDraft}
            onKeyDown={onKeyDown}
            rows={3}
            maxLength={4000}
            placeholder="Write a comment… use @ to mention a teammate"
            aria-label="Write a comment"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to post</span>
            <Button size="sm" onClick={post} disabled={pending || !draft.trim()}>
              {pending ? 'Posting…' : 'Comment'}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
