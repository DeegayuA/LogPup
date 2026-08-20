'use client'

import {
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactElement,
} from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
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
import {
  createApp,
  generateAppFromReadme,
  generateAppFromRepo,
  updateApp,
} from '@/features/apps/actions'
import { TechTagsInput } from '@/features/apps/components/tech-tags-input'
import { CURATED_TECH_TAGS, mergeTagSources } from '@/lib/tech-tags'
import type { ActiveUser } from '@/features/people/queries'

type Status = 'active' | 'paused' | 'archived'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
]

/** Select needs a non-empty sentinel for "no lead"; the actions layer maps it
 *  back to a real null so the column is cleared rather than left alone. */
const NO_LEAD = 'none'

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
  /** `NO_LEAD` sentinel or a user id — never an empty string. */
  leadId: string
  /** A user id, or '' meaning "not chosen yet". Unlike leadId there is no
   *  sentinel for "none" — the PM is required, so '' is only ever a
   *  transient state that handleSubmit refuses to send. */
  pmId: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const emptyState: FormState = {
  name: '',
  description: '',
  repoUrl: '',
  techTags: [],
  status: 'active',
  leadId: NO_LEAD,
  pmId: '',
}

export type AppFormInitialValues = {
  name: string
  description?: string | null
  repoUrl?: string | null
  techTags: string[]
  status: Status
  leadId?: string | null
  /** Always present in practice — apps.pm_id is NOT NULL — but not typed as
   *  such here so a caller that forgets to select it fails loudly (an empty
   *  select) rather than the type system assuming a value that isn't there. */
  pmId: string
}

function toFormState(values?: AppFormInitialValues): FormState {
  if (!values) return emptyState
  return {
    name: values.name,
    description: values.description ?? '',
    repoUrl: values.repoUrl ?? '',
    techTags: [...values.techTags],
    status: values.status,
    leadId: values.leadId ?? NO_LEAD,
    pmId: values.pmId,
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

/**
 * Mirrors README_PASTE_LIMIT in features/apps/actions.ts, which is the value
 * that actually truncates. Duplicated rather than imported because that module
 * is `'use server'` — every export there has to be an async function, so a
 * plain constant cannot cross the boundary. Keep the two in step; the cost of
 * drift is a notice that lies about where the cut falls, not a broken request.
 */
const README_PASTE_LIMIT = 8000

export function AppFormDialog({
  appId,
  initialValues,
  defaultOpen,
  workspaceTechTags = [],
  activeUsers = [],
  trigger,
  aiGenerateEnabled,
}: {
  appId?: string
  initialValues?: AppFormInitialValues
  defaultOpen?: boolean
  /** Distinct tags already used across the workspace (features/apps/queries.ts
   * `listDistinctTechTags`), merged with the curated list into the combobox's
   * suggestion pool. Fetched once server-side by the page — never refetched
   * client-side, so typing never triggers a network call. */
  workspaceTechTags?: string[]
  /** Candidates for the Lead and PM selects. Lead just hides its field when
   * this is empty — the lead is optional, and a picker with nothing in it is
   * worse than no picker. The PM select has no such escape hatch: it is
   * required, so it stays rendered (empty) even then rather than making a
   * required field impossible to reach. */
  activeUsers?: ActiveUser[]
  /** Overrides the default "New app" / "Edit app" button, so a page can put
   * this behind its own toolbar control without a second dialog. */
  trigger?: ReactElement
  /** From getAiPrefs(userId)['app-metadata'] — hides the repo-URL Generate
   *  button, its caption, and the whole README-paste fallback (button and
   *  captions together) when the user has switched it off. */
  aiGenerateEnabled: boolean
}) {
  const isEdit = Boolean(appId)
  const submitLabel = isEdit ? 'Save changes' : 'Create app'
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [generating, setGenerating] = useState(false)
  // Non-null once GitHub has refused to hand over a repo that does exist; holds
  // the reason so the paste box can say why it appeared rather than materializing
  // unexplained.
  const [needsReadme, setNeedsReadme] = useState<string | null>(null)
  const [readme, setReadme] = useState('')
  const knownTechTags = useMemo(
    () => mergeTagSources(CURATED_TECH_TAGS, workspaceTechTags),
    [workspaceTechTags],
  )
  // `items` is required on the Lead select: Base UI's <Select.Value> renders
  // the raw value (a UUID here) unless the Root gets a value → label map.
  //
  // The orphan entry matters. `activeUsers` is exactly that — active — so an
  // app whose lead has since been deactivated holds a leadId with no matching
  // item, and the trigger rendered the bare UUID at the user. Carrying a
  // placeholder for that id keeps the field readable and, just as importantly,
  // keeps the value selectable: without a matching item, opening the dialog to
  // change any other field would silently drop the lead on save.
  const orphanLeadId =
    initialValues?.leadId && !activeUsers.some((user) => user.id === initialValues.leadId)
      ? initialValues.leadId
      : null

  const leadItems = useMemo(
    () => [
      { value: NO_LEAD, label: 'No lead' },
      ...activeUsers.map((user) => ({ value: user.id, label: user.name })),
      ...(orphanLeadId ? [{ value: orphanLeadId, label: 'Former member' }] : []),
    ],
    [activeUsers, orphanLeadId],
  )

  // Same orphan-preservation reasoning as leadId above, minus the "No PM"
  // entry — the PM select never offers a way to clear the field.
  const orphanPmId =
    initialValues?.pmId && !activeUsers.some((user) => user.id === initialValues.pmId)
      ? initialValues.pmId
      : null

  const pmItems = useMemo(
    () => [
      ...activeUsers.map((user) => ({ value: user.id, label: user.name })),
      ...(orphanPmId ? [{ value: orphanPmId, label: 'Former member' }] : []),
    ],
    [activeUsers, orphanPmId],
  )

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
    // Resets with everything else: a paste box left open from a previous repo,
    // still holding that repo's README, is worse than no paste box at all.
    setNeedsReadme(null)
    setReadme('')
  }

  function handleRepoUrlBlur() {
    const normalized = normalizeRepoUrl(form.repoUrl)
    setForm((f) => ({ ...f, repoUrl: normalized }))
    setErrors((e) => ({ ...e, repoUrl: repoUrlError(normalized) ?? undefined }))
  }

  async function handleGenerateFromRepo() {
    const normalized = normalizeRepoUrl(form.repoUrl)
    const urlError = repoUrlError(normalized)
    if (urlError) {
      setForm((f) => ({ ...f, repoUrl: normalized }))
      setErrors((e) => ({ ...e, repoUrl: urlError }))
      return
    }

    // Kept out of startTransition: that transition drives the submit button's
    // pending state, and reading a repo can take several seconds — borrowing it
    // here would disable "Create app" while the user is still writing.
    setGenerating(true)
    try {
      const res = await generateAppFromRepo(normalized)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.data.status === 'needs-readme') {
        // Private repo (or a rate limit). Not an error the admin can act on by
        // reading it — so open the paste box and point at it instead.
        setNeedsReadme(res.data.reason)
        return
      }
      applyGenerated(normalized, res.data)
    } catch {
      toast.error('Could not read that repository')
    } finally {
      setGenerating(false)
    }
  }

  /** Every generated field lands at once, and the repo URL is normalized in the
      same update — one setState so the form never renders half-filled. */
  function applyGenerated(
    normalizedRepoUrl: string,
    generated: { name: string; description: string; techTags: string[] },
  ) {
    setForm((f) => ({
      ...f,
      repoUrl: normalizedRepoUrl,
      name: generated.name,
      description: generated.description,
      techTags: generated.techTags,
    }))
    setErrors({})
    // Said out loud because the values land in fields further down the dialog
    // that the user may not be looking at, and because they are now theirs to
    // edit before saving.
    toast.success('Filled in from the repo — check it before saving')
  }

  async function handleGenerateFromReadme() {
    setGenerating(true)
    try {
      const res = await generateAppFromReadme(readme, form.repoUrl)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      applyGenerated(normalizeRepoUrl(form.repoUrl), res.data)
      // Collapse the paste box on success: it has done its job, and leaving a
      // wall of pasted markdown open above the fields it just filled buries
      // the thing the admin is now meant to check.
      setNeedsReadme(null)
      setReadme('')
    } catch {
      toast.error('Could not generate from that README')
    } finally {
      setGenerating(false)
    }
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
    // Client-side half of "PM is required" — the server's appCreateInput /
    // appUpdateInput schemas are the half that actually enforces it; this is
    // just what stops an obviously-doomed request from leaving the browser.
    if (!form.pmId) {
      setErrors((e) => ({ ...e, pmId: 'Choose a PM' }))
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
              // Explicit null (not undefined) so "no lead" actually CLEARS the
              // column — buildAppUpdate only touches keys that are present.
              leadId: form.leadId === NO_LEAD ? null : form.leadId,
              pmId: form.pmId,
            })
          : await createApp({
              name: form.name,
              description: form.description || undefined,
              repoUrl: normalizedRepoUrl || undefined,
              techTags: form.techTags,
              status: form.status,
              leadId: form.leadId === NO_LEAD ? undefined : form.leadId,
              pmId: form.pmId,
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
      <DialogTrigger render={trigger ?? <Button />}>
        {isEdit ? 'Edit app' : 'New app'}
      </DialogTrigger>
      {/* sm:max-w-lg, matching MeetingForm: the primitive defaults to
          sm:max-w-sm (384px), which is a sensible floor for a confirm box but
          far too narrow for this form — the repo row alone is an input plus a
          Generate button, and the README paste box holds 8,000 characters. */}
      <DialogContent
        // Internal scroll, because this form can outgrow a short viewport:
        // with the README paste box open the ~9 fields plus an h-40 textarea
        // used to carry the footer buttons off the bottom of the screen —
        // DialogContent sets no max height of its own.
        className="max-h-[calc(100dvh-3rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit app' : 'New app'}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this app's details." : 'Add a new app for the team to track.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Repo first: it is the field that can fill in the one below it, so
              asking for it last meant typing a description by hand and only
              then discovering it could have been generated. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-repo-url">Repo URL</Label>
            <div className="flex items-start gap-2">
              {/* min-w-0 on the input: a flex item defaults to min-width:auto
                  and refuses to shrink below its own content, so without it the
                  Generate button beside it pushes the input past the dialog
                  edge instead of the pair sharing the row. */}
              <Input
                id="app-repo-url"
                placeholder="https://github.com/org/repo"
                value={form.repoUrl}
                onChange={(e) => setField('repoUrl', e.target.value)}
                onBlur={handleRepoUrlBlur}
                className="min-w-0 flex-1 hover:border-ring/40"
                aria-invalid={Boolean(errors.repoUrl)}
                aria-describedby={errors.repoUrl ? 'app-repo-url-error' : undefined}
              />
              {/* Sits on the repo row, not the description row: it fills the
                  whole form, so it belongs next to its input rather than next
                  to one of its outputs. Disabled until there is a URL, so it
                  cannot be pressed into an error it could have predicted.
                  Explicitly a button rather than firing on blur — it spends the
                  admin's own Gemini quota and overwrites fields they may have
                  typed, and neither should happen as a side effect of leaving a
                  field. */}
              {aiGenerateEnabled ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!form.repoUrl.trim() || generating}
                  onClick={handleGenerateFromRepo}
                  className="shrink-0 gap-1.5"
                >
                  {generating ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Sparkles aria-hidden className="size-4" />
                  )}
                  {generating ? 'Reading…' : 'Generate'}
                </Button>
              ) : null}
            </div>
            {errors.repoUrl ? (
              <p id="app-repo-url-error" role="alert" className="text-xs text-destructive">
                {errors.repoUrl}
              </p>
            ) : aiGenerateEnabled ? (
              <p className="text-xs text-muted-foreground">
                Fills in the name, description, and tech tags from the repository.
              </p>
            ) : null}
          </div>

          {/* The private-repo path. GitHub answers a private repo with 404, so
              the server cannot fetch it and no message would make that the
              admin's problem to solve — but they can open the repo themselves
              and paste what it says. Appears only after a fetch has actually
              failed: offering it up front would be a second, confusing way to
              do the thing the button above already does. */}
          {needsReadme && aiGenerateEnabled ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="app-readme" className="text-xs">
                  Paste the README instead
                </Label>
                <p className="text-xs text-muted-foreground">{needsReadme}</p>
              </div>
              {/* The height rules here are load-bearing, not polish. The shared
                  Textarea carries `field-sizing-content`, so it grows to fit
                  whatever is in it — paste a real README and the field becomes
                  hundreds of lines tall, carrying the Generate button off the
                  bottom of the screen. Nothing catches that: DialogContent sets
                  no max height of its own.
                  `[field-sizing:fixed]` opts this ONE field back out of that
                  behaviour rather than fighting it with max-height, so the box
                  is a plain fixed-height textarea that scrolls its own content —
                  predictable regardless of how a browser resolves content
                  sizing against a max. Every other Textarea in the app keeps the
                  auto-grow it was designed around. */}
              <Textarea
                id="app-readme"
                value={readme}
                onChange={(e) => setReadme(e.target.value)}
                placeholder="Paste the contents of README.md here…"
                className="h-40 resize-none overflow-y-auto bg-background font-mono text-xs [field-sizing:fixed] hover:border-ring/40"
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                {/* The server truncates at README_PASTE_LIMIT. Without this the
                    tail of a long README disappears silently, and the admin has
                    no way to know the model never saw the half of the document
                    that actually described the product. */}
                {readme.length > README_PASTE_LIMIT ? (
                  <p className="mr-auto text-2xs text-muted-foreground" aria-live="polite">
                    Using the first{' '}
                    <span className="font-mono tabular-nums">
                      {README_PASTE_LIMIT.toLocaleString()}
                    </span>{' '}
                    characters
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={generating}
                  onClick={() => {
                    setNeedsReadme(null)
                    setReadme('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={readme.trim().length < 40 || generating}
                  onClick={handleGenerateFromReadme}
                  className="gap-1.5"
                >
                  {generating ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Sparkles aria-hidden className="size-4" />
                  )}
                  {generating ? 'Reading…' : 'Generate from README'}
                </Button>
              </div>
            </div>
          ) : null}
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
            <Label htmlFor="app-tech-tags">Tech tags</Label>
            <TechTagsInput
              id="app-tech-tags"
              value={form.techTags}
              onChange={(tags) => setField('techTags', tags)}
              error={errors.techTags}
              knownTags={knownTechTags}
            />
          </div>
          {/* Required — every app must have a PM, from the moment it's
              created. No "No PM" item (unlike Lead below): there is nothing
              equivalent to send, so the field simply stays unfilled and
              blocks submit (see handleSubmit) until something is chosen. */}
          <div className="flex flex-col gap-1.5">
            <Label id="app-pm-label" htmlFor="app-pm">
              PM <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Select
              // `|| null` puts Base UI into its native placeholder state
              // (styled via `data-placeholder` on the trigger) instead of
              // trying to render the label for the empty-string sentinel,
              // which has no matching item.
              value={form.pmId || null}
              items={pmItems}
              onValueChange={(value) => setField('pmId', (value as string) ?? '')}
            >
              <SelectTrigger
                id="app-pm"
                aria-labelledby="app-pm-label"
                aria-invalid={Boolean(errors.pmId)}
                aria-describedby={errors.pmId ? 'app-pm-error' : undefined}
                className="w-full hover:border-ring/40"
              >
                <SelectValue placeholder="Choose a PM…" />
              </SelectTrigger>
              <SelectContent>
                {activeUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
                {/* Listed, not hidden — same reasoning as the Lead select's
                    orphan entry below: a value with no item in the list is a
                    value the user cannot keep selected. */}
                {orphanPmId ? (
                  <SelectItem value={orphanPmId}>Former member</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
            {errors.pmId ? (
              <p id="app-pm-error" role="alert" className="text-xs text-destructive">
                {errors.pmId}
              </p>
            ) : null}
          </div>
          {/* The lead is the most prominent name on every app card, but until
              now it could only be changed from the Admin page's table — so the
              one person looking at the app couldn't set it. */}
          {activeUsers.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label id="app-lead-label" htmlFor="app-lead">
                Lead
              </Label>
              <Select
                value={form.leadId}
                items={leadItems}
                onValueChange={(value) => setField('leadId', (value as string) ?? NO_LEAD)}
              >
                <SelectTrigger
                  id="app-lead"
                  aria-labelledby="app-lead-label"
                  className="w-full hover:border-ring/40"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LEAD}>No lead</SelectItem>
                  {activeUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                  {/* Listed, not hidden: a value with no item in the list is a
                      value the user cannot keep. Leaving it out would make
                      "change the status" quietly also mean "clear the lead". */}
                  {orphanLeadId ? (
                    <SelectItem value={orphanLeadId}>Former member</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label id="app-status-label" htmlFor="app-status">
              Status
            </Label>
            <Select
              value={form.status}
              onValueChange={(value) => setField('status', value as Status)}
              // Same Base UI pitfall as the Lead select above: without items,
              // the closed trigger shows the raw value ("live"), not the label.
              items={STATUS_OPTIONS}
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
