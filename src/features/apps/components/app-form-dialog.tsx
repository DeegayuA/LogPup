'use client'

import { useState, useTransition, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createApp, updateApp } from '@/features/apps/actions'

type Status = 'active' | 'paused' | 'archived'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
]

const MAX_TECH_TAGS = 10
const TECH_TAGS_WARNING_THRESHOLD = MAX_TECH_TAGS - 2
const DESCRIPTION_MAX = 500
const DESCRIPTION_WARNING_THRESHOLD = 400

// Matches an explicit scheme (https://, git://, ssh://…) so a bare
// "github.com/org/repo" gets an https:// prefix without mangling a URL the
// user already typed correctly.
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//

type FormState = {
  name: string
  description: string
  repoUrl: string
  techTags: string[]
  status: Status
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const emptyState: FormState = {
  name: '',
  description: '',
  repoUrl: '',
  techTags: [],
  status: 'active',
}

export type AppFormInitialValues = {
  name: string
  description?: string | null
  repoUrl?: string | null
  techTags: string[]
  status: Status
}

function toFormState(values?: AppFormInitialValues): FormState {
  if (!values) return emptyState
  return {
    name: values.name,
    description: values.description ?? '',
    repoUrl: values.repoUrl ?? '',
    techTags: [...values.techTags],
    status: values.status,
  }
}

/** If the URL has no scheme, assume https:// — "github.com/org/repo" is a
 * far more common paste than a relative path. */
function normalizeRepoUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || URL_SCHEME_RE.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function repoUrlError(value: string): string | null {
  if (!value) return null
  try {
    new URL(value)
    return null
  } catch {
    return 'Enter a valid URL, e.g. https://github.com/org/repo'
  }
}

// The server only returns a single zod message string (no field path), so
// map it back to a field by the parts of the message that are unique to
// that field's constraint. Falls back to a toast when nothing matches.
function identifyField(message: string): keyof FormState | null {
  if (/url/i.test(message)) return 'repoUrl'
  if (/>=2 characters|<=80 characters/.test(message)) return 'name'
  if (/<=500 characters/.test(message)) return 'description'
  if (/<=10 items/.test(message)) return 'techTags'
  if (/expected one of/i.test(message)) return 'status'
  return null
}

function TechTagsInput({
  id,
  value,
  onChange,
  error,
}: {
  id: string
  value: string[]
  onChange: (tags: string[]) => void
  error?: string
}) {
  const [draft, setDraft] = useState('')
  const atLimit = value.length >= MAX_TECH_TAGS

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag || atLimit) return
    setDraft('')
    if (value.includes(tag)) return
    onChange([...value, tag])
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      // Swallow both so a comma never lands in the field and Enter never
      // submits the enclosing form.
      event.preventDefault()
      addTag(draft)
      return
    }
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="rounded-full p-0.5 outline-none transition-colors duration-150 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={atLimit}
        placeholder={atLimit ? 'Tag limit reached' : 'next.js, postgres…'}
        className="hover:border-ring/40"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : value.length >= TECH_TAGS_WARNING_THRESHOLD ? (
        <p
          className={`font-mono text-2xs tabular-nums ${atLimit ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {value.length}/{MAX_TECH_TAGS}
        </p>
      ) : null}
    </div>
  )
}

export function AppFormDialog({
  appId,
  initialValues,
  defaultOpen,
}: {
  appId?: string
  initialValues?: AppFormInitialValues
  defaultOpen?: boolean
} = {}) {
  const isEdit = Boolean(appId)
  const submitLabel = isEdit ? 'Save changes' : 'Create app'
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FieldErrors>({})

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Resync from the latest props whenever the dialog opens: `form` is
    // otherwise a stale closure over whatever `initialValues` looked like
    // at mount time, so a save-then-reopen would show pre-edit values and
    // a second save would silently revert the first one.
    setForm(toFormState(initialValues))
    setErrors({})
  }

  function handleRepoUrlBlur() {
    const normalized = normalizeRepoUrl(form.repoUrl)
    setForm((f) => ({ ...f, repoUrl: normalized }))
    setErrors((e) => ({ ...e, repoUrl: repoUrlError(normalized) ?? undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedRepoUrl = normalizeRepoUrl(form.repoUrl)
    const urlError = repoUrlError(normalizedRepoUrl)
    if (urlError) {
      setForm((f) => ({ ...f, repoUrl: normalizedRepoUrl }))
      setErrors((e) => ({ ...e, repoUrl: urlError }))
      return
    }
    startTransition(async () => {
      try {
        const res = isEdit
          ? await updateApp(appId as string, {
              name: form.name,
              // Edit mode must send description even when cleared to '' —
              // buildAppUpdate maps '' to null and persists it. Sending
              // `undefined` here would drop the key entirely and silently
              // keep the old description (see update-input.ts).
              description: form.description,
              repoUrl: normalizedRepoUrl || undefined,
              techTags: form.techTags,
              status: form.status,
            })
          : await createApp({
              name: form.name,
              description: form.description || undefined,
              repoUrl: normalizedRepoUrl || undefined,
              techTags: form.techTags,
              status: form.status,
            })
        if (!res.ok) {
          const field = identifyField(res.error)
          if (field) {
            setErrors((e) => ({ ...e, [field]: res.error }))
          } else {
            toast.error(res.error)
          }
          return
        }
        toast.success(isEdit ? 'App updated' : 'App created')
        handleOpenChange(false)
        router.refresh()
      } catch {
        // `updateApp` wraps nothing and `createApp` wraps only its insert, so
        // a driver-level failure rejects instead of returning `{ ok: false }`.
        // Without this catch Save would clear its spinner and do nothing.
        toast.error('Something went wrong — try again')
      }
    })
  }

  const descriptionLength = form.description.length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>{isEdit ? 'Edit app' : 'New app'}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit app' : 'New app'}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this app's details." : 'Add a new app for the team to track.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-name">
              Name <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input
              id="app-name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              minLength={2}
              maxLength={80}
              required
              className="hover:border-ring/40"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'app-name-error' : undefined}
            />
            {errors.name ? (
              <p id="app-name-error" role="alert" className="text-xs text-destructive">
                {errors.name}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-description">Description</Label>
            <Textarea
              id="app-description"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              maxLength={DESCRIPTION_MAX}
              rows={3}
              className="hover:border-ring/40"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description
                  ? 'app-description-error'
                  : descriptionLength > DESCRIPTION_WARNING_THRESHOLD
                    ? 'app-description-count'
                    : undefined
              }
            />
            {errors.description ? (
              <p id="app-description-error" role="alert" className="text-xs text-destructive">
                {errors.description}
              </p>
            ) : descriptionLength > DESCRIPTION_WARNING_THRESHOLD ? (
              <p
                id="app-description-count"
                className="self-end font-mono text-2xs tabular-nums text-muted-foreground"
              >
                {descriptionLength}/{DESCRIPTION_MAX}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-repo-url">Repo URL</Label>
            <Input
              id="app-repo-url"
              placeholder="https://github.com/org/repo"
              value={form.repoUrl}
              onChange={(e) => setField('repoUrl', e.target.value)}
              onBlur={handleRepoUrlBlur}
              className="hover:border-ring/40"
              aria-invalid={Boolean(errors.repoUrl)}
              aria-describedby={errors.repoUrl ? 'app-repo-url-error' : undefined}
            />
            {errors.repoUrl ? (
              <p id="app-repo-url-error" role="alert" className="text-xs text-destructive">
                {errors.repoUrl}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-tech-tags">Tech tags</Label>
            <TechTagsInput
              id="app-tech-tags"
              value={form.techTags}
              onChange={(tags) => setField('techTags', tags)}
              error={errors.techTags}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label id="app-status-label" htmlFor="app-status">
              Status
            </Label>
            <Select
              value={form.status}
              onValueChange={(value) => setField('status', value as Status)}
            >
              <SelectTrigger
                id="app-status"
                aria-labelledby="app-status-label"
                className="w-full hover:border-ring/40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.status ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.status}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" disabled={isPending} />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {isPending ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
