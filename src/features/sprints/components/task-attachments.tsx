'use client'

/**
 * Files attached to a task, inside the task dialog.
 *
 * RENDERS INSIDE THE TASK DIALOG'S <form>, like acceptance-criteria.tsx: no
 * <form> here, every button is type="button", and the upload is a fetch with
 * its own FormData — a nested form, or a submit button, would post the task.
 *
 * The size/type pre-check here is a courtesy (a wrong file fails instantly,
 * with a sentence, instead of after a 4 MB upload). The route re-runs it and
 * also sniffs the bytes; nothing here is the security boundary.
 *
 * Links point at /api/attachments/<id>, never a blob URL — the store is
 * private and every download re-checks access.
 */
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Paperclip,
  Presentation,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  deleteTaskAttachment,
  listTaskAttachments,
  type TaskAttachment,
} from '@/features/sprints/attachments-actions'
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS_PER_TASK,
  attachmentKind,
  checkAttachmentMeta,
  formatBytes,
  type AttachmentKind,
} from '@/features/sprints/attachments'

type Load = { key: string; error: string | null }
type Pending = { id: string; file: File; error: string | null }

const KIND_ICON: Record<AttachmentKind, typeof FileIcon> = {
  image: FileImage,
  pdf: FileText,
  text: FileText,
  archive: FileArchive,
  doc: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  file: FileIcon,
}

/** POST one file; resolves to an error sentence, or null on success. */
async function uploadFile(taskId: string, file: File): Promise<string | null> {
  const body = new FormData()
  body.append('taskId', taskId)
  body.append('file', file)
  let response: Response
  try {
    response = await fetch('/api/attachments', { method: 'POST', body })
  } catch {
    return 'Network error — check your connection'
  }
  // A signed-out request is redirected to /sign-in by the proxy, and fetch
  // follows it to a 200 HTML page. That is not a success.
  const isJson = response.headers.get('content-type')?.includes('application/json')
  if (response.redirected || !isJson) return 'Your session has expired — sign in again'
  if (response.ok) return null
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null
  return typeof payload?.error === 'string' ? payload.error : 'Upload failed — try again'
}

export function TaskAttachments({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const [rows, setRows] = useState<TaskAttachment[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const [load, setLoad] = useState<Load | null>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [dragging, setDragging] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestKey = `${taskId}:${reloadKey}`

  // Same derived-loading shape as acceptance-criteria.tsx: no synchronous
  // setState in the effect to flip back to the skeleton.
  useEffect(() => {
    let cancelled = false
    listTaskAttachments(taskId).then(
      (result) => {
        if (cancelled) return
        if (result.ok) setRows(result.data)
        setLoad({ key: requestKey, error: result.ok ? null : result.error })
      },
      () => {
        if (!cancelled) setLoad({ key: requestKey, error: 'Could not load the attachments' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [taskId, requestKey])

  const status = load?.key !== requestKey ? 'loading' : load.error ? 'error' : 'ready'
  const uploading = pending.some((p) => p.error === null)

  /** Re-read the list without flashing the skeleton. */
  async function refresh() {
    const result = await listTaskAttachments(taskId).catch(() => null)
    if (result?.ok) setRows(result.data)
  }

  async function runUpload(entry: Pending) {
    setPending((current) => current.map((p) => (p.id === entry.id ? { ...p, error: null } : p)))
    const error = await uploadFile(taskId, entry.file)
    if (error) {
      setPending((current) => current.map((p) => (p.id === entry.id ? { ...p, error } : p)))
      return
    }
    await refresh()
    setPending((current) => current.filter((p) => p.id !== entry.id))
  }

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list)
    if (files.length === 0) return
    const room = MAX_ATTACHMENTS_PER_TASK - rows.length - pending.length
    if (files.length > room) {
      toast.error(
        room <= 0
          ? `A task can hold ${MAX_ATTACHMENTS_PER_TASK} attachments — remove one first`
          : `Only ${room} more file${room === 1 ? '' : 's'} fit on this task`,
      )
      if (room <= 0) return
    }
    const accepted: Pending[] = []
    for (const file of files.slice(0, Math.max(room, 0))) {
      const check = checkAttachmentMeta({ name: file.name, type: file.type, size: file.size })
      if (!check.ok) toast.error(`${file.name}: ${check.error}`)
      else accepted.push({ id: crypto.randomUUID(), file, error: null })
    }
    if (accepted.length === 0) return
    setPending((current) => [...current, ...accepted])
    // One at a time: each is up to 4 MB, and parallel uploads would race
    // the per-task cap on the server.
    for (const entry of accepted) await runUpload(entry)
  }

  async function remove(row: TaskAttachment) {
    setConfirmId(null)
    setRemoving(row.id)
    const result = await deleteTaskAttachment(row.id).catch(() => null)
    setRemoving(null)
    if (result?.ok) setRows((current) => current.filter((r) => r.id !== row.id))
    else toast.error(result?.error ?? 'Could not remove the attachment')
  }

  function onDragOver(event: DragEvent<HTMLElement>) {
    if (!canEdit || !event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (!dragging) setDragging(true)
  }

  function onDragLeave(event: DragEvent<HTMLElement>) {
    // Leaving for a child element is not leaving the area.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragging(false)
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    if (!canEdit) return
    event.preventDefault()
    setDragging(false)
    void addFiles(event.dataTransfer.files)
  }

  const headingId = `attachments-${taskId}`

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'space-y-2 rounded-md border border-transparent transition-colors',
        dragging && 'border-dashed border-primary bg-primary/5',
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="text-sm font-medium">
          Attachments
          {status === 'ready' && rows.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">{rows.length}</span>
          )}
        </h3>
        {canEdit && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={status !== 'ready'}
            >
              <Paperclip aria-hidden="true" />
              Attach file
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const files = event.currentTarget.files
                if (files) void addFiles(Array.from(files))
                // Reset so choosing the same file again (after a failure)
                // still fires change.
                event.currentTarget.value = ''
              }}
            />
          </>
        )}
      </div>

      {status === 'loading' && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading attachments">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm">
          <span className="text-destructive">{load?.error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      )}

      {status === 'ready' && rows.length === 0 && pending.length === 0 && (
        <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
          {canEdit ? 'No files yet. Attach one, or drop it here — up to 4 MB each.' : 'No files attached.'}
        </p>
      )}

      {status === 'ready' && (rows.length > 0 || pending.length > 0) && (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((row) => {
            const Icon = KIND_ICON[attachmentKind(row.mime)]
            const created = new Date(row.createdAt)
            return (
              <li key={row.id} className="flex items-center gap-2 px-3 py-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-medium underline-offset-2 hover:underline focus-visible:underline"
                    title={row.name}
                  >
                    {row.name}
                  </a>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatBytes(row.bytes)} · {row.uploaderName} ·{' '}
                    <time dateTime={created.toISOString()} title={created.toLocaleString()}>
                      {formatDistanceToNow(created, { addSuffix: true })}
                    </time>
                  </p>
                </div>
                {row.canDelete &&
                  (confirmId === row.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="text-xs text-muted-foreground">Remove?</span>
                      <Button type="button" size="xs" variant="destructive" onClick={() => void remove(row)}>
                        Remove
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label="Keep attachment"
                        onClick={() => setConfirmId(null)}
                      >
                        <X aria-hidden />
                      </Button>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Remove ${row.name}`}
                      disabled={removing === row.id}
                      onClick={() => setConfirmId(row.id)}
                    >
                      {removing === row.id ? <Loader2 aria-hidden className="animate-spin" /> : <Trash2 aria-hidden />}
                    </Button>
                  ))}
              </li>
            )
          })}
          {pending.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 px-3 py-2" aria-live="polite">
              {entry.error === null ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
              ) : (
                <FileIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{entry.file.name}</p>
                <p className={cn('truncate text-xs', entry.error ? 'text-destructive' : 'text-muted-foreground')}>
                  {entry.error ?? `Uploading ${formatBytes(entry.file.size)}…`}
                </p>
              </div>
              {entry.error !== null && (
                <span className="flex shrink-0 items-center gap-1">
                  <Button type="button" size="xs" variant="outline" disabled={uploading} onClick={() => void runUpload(entry)}>
                    <RotateCcw aria-hidden="true" />
                    Retry
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Dismiss ${entry.file.name}`}
                    onClick={() => setPending((current) => current.filter((p) => p.id !== entry.id))}
                  >
                    <X aria-hidden />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
