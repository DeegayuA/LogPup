'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Bold,
  Code,
  Heading2,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  Table,
  type LucideIcon,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ATTACHMENT_ACCEPT } from '@/features/sprints/attachments'
import {
  DOC_BODY_MAX,
  DOC_CATEGORIES,
  DOC_CATEGORY_LABEL,
  DOC_SUMMARY_MAX,
  DOC_TITLE_MAX,
  applyToolbar,
  attachmentMarkdown,
  docsHref,
  parseDocCategory,
  type DocCategory,
  type ToolbarAction,
} from '@/features/docs/docs'
import { createDoc, updateDoc } from '@/features/docs/actions'
import { MarkdownView } from './markdown-view'
import { uploadDocFile } from './doc-upload'

/**
 * Write or edit one page. A Markdown textarea with a small toolbar (the text
 * edits are applyToolbar in docs.ts, unit tested), a Write/Preview switch that
 * renders with the same MarkdownView readers see, and an optional "What
 * changed?" note stored on the revision.
 *
 * The editor sends the version it opened (baseVersion); a save that lost a
 * race comes back as "Someone else saved this page" and the text stays in
 * the box so nothing typed is lost. Leaving with unsaved text asks first
 * (beforeunload) — the cheapest guard against the one loss an editor must
 * not have. Images and files need a page id, so on a NEW page the insert
 * button creates the page first (insertFile) and the editor continues as an
 * edit of it; the final Save then updates rather than creating a second one.
 */

const TOOLS: { action: ToolbarAction; label: string; icon: LucideIcon }[] = [
  { action: 'bold', label: 'Bold', icon: Bold },
  { action: 'italic', label: 'Italic', icon: Italic },
  { action: 'heading', label: 'Heading', icon: Heading2 },
  { action: 'list', label: 'Bulleted list', icon: List },
  { action: 'checklist', label: 'Checklist', icon: ListChecks },
  { action: 'table', label: 'Table', icon: Table },
  { action: 'code', label: 'Code block', icon: Code },
  { action: 'link', label: 'Link', icon: LinkIcon },
]

type Initial = { title: string; category: DocCategory; body: string }

export function DocEditor(
  props:
    | { mode: 'create'; appId: string; slug: string; initial: Initial; taskLinks?: Record<string, string> }
    | {
        mode: 'edit'
        appId: string
        slug: string
        docId: string
        baseVersion: number
        initial: Initial
        taskLinks?: Record<string, string>
      },
) {
  const router = useRouter()
  const [title, setTitle] = useState(props.initial.title)
  const [category, setCategory] = useState<DocCategory>(props.initial.category)
  const [body, setBody] = useState(props.initial.body)
  const [summary, setSummary] = useState('')
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [saving, startSaving] = useTransition()
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const savedRef = useRef(false)

  // A NEW page gets an id the first time someone inserts a file: files belong
  // to a page, so the page is created right then and the editor carries on as
  // an edit of it (version 1). Without this the button sat disabled on every
  // new page, which read as broken.
  const [created, setCreated] = useState<{ id: string; version: number } | null>(null)
  const docId = props.mode === 'edit' ? props.docId : (created?.id ?? null)
  const baseVersion = props.mode === 'edit' ? props.baseVersion : (created?.version ?? 1)
  const dirty =
    title !== props.initial.title || category !== props.initial.category || body !== props.initial.body
  const cancelHref = docId ? docsHref(props.slug, { doc: docId }) : docsHref(props.slug, { category: props.initial.category })

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (savedRef.current) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  /** Replace the textarea's text and restore a selection after React commits it. */
  function setBodyWithSelection(text: string, start: number, end: number) {
    setBody(text)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(start, end)
    })
  }

  function onTool(action: ToolbarAction) {
    const el = textareaRef.current
    const start = el?.selectionStart ?? body.length
    const end = el?.selectionEnd ?? body.length
    const next = applyToolbar(action, body, start, end)
    setTab('write')
    setBodyWithSelection(next.text, next.selectionStart, next.selectionEnd)
  }

  /** Insert on a page with no id yet: create it with what is typed so far, then open the picker. */
  async function insertFile() {
    if (docId) {
      fileRef.current?.click()
      return
    }
    if (!title.trim()) {
      toast.error('Give the page a title first, then add images and files')
      return
    }
    setUploading(true)
    try {
      const result = await createDoc({ appId: props.appId, title, category, body })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setCreated({ id: result.data.docId, version: 1 })
      toast.success('Page saved as a draft — now choose your image or file')
      // Still inside the click's user activation in practice; if a browser
      // refuses, the button is enabled now and a second click opens it.
      fileRef.current?.click()
    } catch {
      toast.error('Could not reach the server — try again')
    } finally {
      setUploading(false)
    }
  }

  async function onPickFile(list: FileList | null) {
    const file = list?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file || !docId || uploading) return
    setUploading(true)
    const result = await uploadDocFile(docId, file)
    setUploading(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    const snippet = attachmentMarkdown(result.name, result.id, result.mime.startsWith('image/'))
    const el = textareaRef.current
    const at = el?.selectionEnd ?? body.length
    const text = body.slice(0, at) + snippet + body.slice(at)
    setTab('write')
    setBodyWithSelection(text, at + snippet.length, at + snippet.length)
    toast.success(`${result.name} uploaded and inserted`)
  }

  function save() {
    if (saving) return
    if (!title.trim()) {
      toast.error('Give the page a title')
      return
    }
    startSaving(async () => {
      try {
        if (props.mode === 'create' && !docId) {
          const result = await createDoc({ appId: props.appId, title, category, body })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          savedRef.current = true
          toast.success('Page created')
          router.push(docsHref(props.slug, { doc: result.data.docId }))
          return
        }
        if (!docId) return
        const result = await updateDoc({
          docId,
          title,
          category,
          body,
          summary: summary.trim() || undefined,
          baseVersion,
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        savedRef.current = true
        toast.success(
          props.mode === 'create'
            ? 'Page created'
            : result.data.changed
              ? `Saved as version ${result.data.version}`
              : 'No changes to save',
        )
        router.push(docsHref(props.slug, { doc: docId }))
      } catch {
        toast.error('Could not reach the server — your text is still here, try again')
      }
    })
  }

  return (
    <form
      className="flex flex-col gap-4"
      aria-label={props.mode === 'create' ? 'New page' : 'Edit page'}
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <h2 className="font-heading text-lg font-semibold">{props.mode === 'create' ? 'New page' : 'Edit page'}</h2>

      <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="doc-title">Title</Label>
          <Input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={DOC_TITLE_MAX}
            placeholder="e.g. How to set up the project on your laptop"
            required
            autoFocus={props.mode === 'create'}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label id="doc-category-label">Category</Label>
          <Select value={category} onValueChange={(value) => setCategory(parseDocCategory(value) ?? 'project')}>
            <SelectTrigger className="w-full" aria-labelledby="doc-category-label">
              <SelectValue>{(value: string) => DOC_CATEGORY_LABEL[parseDocCategory(value) ?? 'project']}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DOC_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {DOC_CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Editor view" className="flex gap-1 rounded-lg border p-0.5">
            {(['write', 'preview'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                aria-controls={`doc-editor-${t}`}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  tab === t ? 'bg-primary/10 font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'write' ? 'Write' : 'Preview'}
              </button>
            ))}
          </div>
          <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
            {TOOLS.map(({ action, label, icon: Icon }) => (
              <Button
                key={action}
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={label}
                title={label}
                onClick={() => onTool(action)}
              >
                <Icon aria-hidden />
              </Button>
            ))}
            <input
              ref={fileRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => void onPickFile(e.target.files)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              title="Upload an image or file and insert it here"
              onClick={() => void insertFile()}
            >
              <ImagePlus aria-hidden />
              {uploading ? 'Uploading…' : 'Insert image/file'}
            </Button>
          </div>
        </div>
        {!docId ? (
          <p className="text-xs text-muted-foreground">
            Inserting an image saves this new page as a draft first, so the file has a page to belong to.
          </p>
        ) : null}

        {tab === 'write' ? (
          <div id="doc-editor-write" role="tabpanel" className="flex flex-col gap-1">
            <Label htmlFor="doc-body" className="sr-only">
              Page text (Markdown)
            </Label>
            <Textarea
              id="doc-body"
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={DOC_BODY_MAX}
              rows={22}
              spellCheck
              placeholder={'Write in Markdown. For example:\n\n## Steps\n- [ ] Install Node\n- [ ] Copy .env.example to .env.local\n\nMention a task by its key, like LOG-12.'}
              className="min-h-[24rem] font-mono text-sm"
            />
          </div>
        ) : (
          <div id="doc-editor-preview" role="tabpanel" className="min-h-[24rem] rounded-xl border bg-card px-5 py-5">
            {body.trim() ? (
              <MarkdownView markdown={body} taskLinks={props.taskLinks} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>

      {props.mode === 'edit' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="doc-summary">What changed? (optional)</Label>
          <Input
            id="doc-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={DOC_SUMMARY_MAX}
            placeholder="e.g. Added the staging deploy steps"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href={cancelHref}
          onClick={(event) => {
            if (dirty && !window.confirm('Leave without saving? Your changes will be lost.')) event.preventDefault()
            else savedRef.current = true
          }}
          className={buttonVariants({ variant: 'ghost' })}
        >
          Cancel
        </a>
        <Button type="submit" disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : props.mode === 'create' ? 'Create page' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
