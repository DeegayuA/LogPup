'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import {
  AlertCircleIcon,
  CheckIcon,
  KeyboardIcon,
  Loader2Icon,
  MicIcon,
  NotebookPenIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  UndoIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MentionText, MentionTextarea, type MentionUser } from '@/components/mention-textarea'
import { MarkdownLite } from '@/components/markdown-lite'
import { cn } from '@/lib/utils'
import {
  bilingualText,
  MetaChip,
  SectionHeading,
  SkeletonBlock,
} from '@/features/meetings/components/meeting-chips'
import { isSameNoteText } from '@/features/meetings/components/meeting-notes-model'
import {
  acceptTaskSuggestion,
  addTypedNoteSegment,
  deleteNoteSegment,
  dismissTaskSuggestion,
  editNoteSegment,
  getMeetingNoteTimeline,
  setSpeakerMapping,
  undoAutoAcceptedSuggestion,
  type NoteSegmentView,
  type NoteTimelineData,
  type TaskSuggestionView,
} from '@/features/meetings/ai-actions'

const NOT_ATTENDEE = '__not_attendee__'
const UNASSIGNED = '__unassigned__'

const PRIORITY_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Low' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'High' },
]

const SOURCE_META: Record<
  NoteSegmentView['source'],
  { icon: typeof KeyboardIcon; label: string }
> = {
  typed: { icon: KeyboardIcon, label: 'Typed' },
  voice: { icon: MicIcon, label: 'Voice' },
  ai: { icon: SparklesIcon, label: 'AI' },
}

type EditForm = { title: string; assigneeId: string; dueDate: string; priority: string }

function toEditForm(suggestion: TaskSuggestionView): EditForm {
  return {
    title: suggestion.text,
    assigneeId: suggestion.suggestedUserId ?? UNASSIGNED,
    dueDate: suggestion.suggestedDueDate ?? '',
    priority: '0',
  }
}

export function NoteTimeline({
  meetingId,
  meetingTitle,
  canManage,
  attendees,
  appId,
  mentionUsers,
  shownElsewhere = null,
  autoAssignCappedCount = 0,
}: {
  meetingId: string
  meetingTitle: string
  /** Same admin-or-creator tier the rest of the meeting's manage actions use. */
  canManage: boolean
  attendees: { id: string; name: string }[]
  appId: string | null
  /** Wider mention pool (falls back to attendees). */
  mentionUsers?: MentionUser[]
  /**
   * Text already rendered above this timeline — in practice the AI summary,
   * which is stored both on the meeting's ai_notes row and as an 'ai' segment
   * here. Matching segments are hidden so the same paragraph is not printed
   * twice on one screen; see isSameNoteText for why this compares content.
   */
  shownElsewhere?: string | null
  /**
   * How many of the LATEST analysis pass's action items qualified for
   * auto-assign but were held back by MAX_AUTO_TASKS_PER_MEETING (see
   * meetingAiNotes.autoAssignCappedCount) — shown as a note next to the
   * manual "Suggested tasks" heading, since those held-back items are
   * exactly the ones that landed there instead.
   */
  autoAssignCappedCount?: number
}) {
  const [data, setData] = useState<NoteTimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [posting, startPosting] = useTransition()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [editPending, startEditPending] = useTransition()

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletePending, startDeletePending] = useTransition()

  const [speakerBusyLabel, setSpeakerBusyLabel] = useState<string | null>(null)
  const [speakerPending, startSpeakerPending] = useTransition()

  const [suggestionBusyId, setSuggestionBusyId] = useState<string | null>(null)
  const [suggestionPending, startSuggestionPending] = useTransition()

  const [editingSuggestion, setEditingSuggestion] = useState<TaskSuggestionView | null>(null)
  const [suggestionForm, setSuggestionForm] = useState<EditForm | null>(null)

  const [undoBusyId, setUndoBusyId] = useState<string | null>(null)
  const [undoPending, startUndoPending] = useTransition()

  const mentionPool = mentionUsers ?? attendees

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getMeetingNoteTimeline(meetingId)
      if (res.ok) setData(res.data)
      else setLoadError(res.error)
    } catch {
      setLoadError('Could not load notes')
    } finally {
      setLoading(false)
    }
  }

  // Fetch once per meeting on mount/meetingId change; every later refresh
  // (after a save, edit, or delete) is an explicit `await load()` at the
  // call site, not another effect run. Wrapped in an async IIFE (rather
  // than calling the setState-bearing `load` directly in the effect body)
  // to match the prefetch pattern in meeting-intel.tsx.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!cancelled) await load()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` intentionally excluded: it's stable in spirit (only reads meetingId from props) and including it would refetch on every render
  }, [meetingId])

  function handleAddNote() {
    const content = draft.trim()
    if (!content) return
    startPosting(async () => {
      try {
        const res = await addTypedNoteSegment(meetingId, content)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setDraft('')
        await load()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function startEdit(segment: NoteSegmentView) {
    setEditingId(segment.id)
    setEditDraft(segment.content)
  }

  function handleSaveEdit(segmentId: string) {
    const content = editDraft.trim()
    if (!content) return
    setSavingEditId(segmentId)
    startEditPending(async () => {
      try {
        const res = await editNoteSegment(segmentId, content)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setEditingId(null)
        await load()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setSavingEditId(null)
      }
    })
  }

  function handleDeleteSegment(segmentId: string) {
    setDeletingId(segmentId)
    startDeletePending(async () => {
      try {
        const res = await deleteNoteSegment(segmentId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Note deleted')
        await load()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setDeletingId(null)
      }
    })
  }

  function handleAssignSpeaker(label: string, value: string) {
    const userId = value === NOT_ATTENDEE ? null : value
    setSpeakerBusyLabel(label)
    startSpeakerPending(async () => {
      try {
        const res = await setSpeakerMapping(meetingId, label, userId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        await load()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setSpeakerBusyLabel(null)
      }
    })
  }

  function handleAcceptSuggestion(suggestion: TaskSuggestionView, overrides?: EditForm) {
    setSuggestionBusyId(suggestion.id)
    startSuggestionPending(async () => {
      try {
        const res = await acceptTaskSuggestion(
          suggestion.id,
          overrides
            ? {
                title: overrides.title.trim() || undefined,
                assigneeId: overrides.assigneeId === UNASSIGNED ? null : overrides.assigneeId,
                dueDate: overrides.dueDate || null,
                priority: Number(overrides.priority),
              }
            : undefined,
        )
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Task created')
        setEditingSuggestion(null)
        setSuggestionForm(null)
        await load()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setSuggestionBusyId(null)
      }
    })
  }

  // Layer (b) of full-auto's manual override: undo deletes the task the
  // auto pass created and reverts the card to a plain manual suggestion.
  // The server re-checks the todo+unmodified constraint (canUndoAutoAssign)
  // regardless of what this button shows — a failure here just means
  // someone (or something) changed the task between load and click.
  function handleUndoAutoAssign(suggestionId: string) {
    setUndoBusyId(suggestionId)
    startUndoPending(async () => {
      try {
        const res = await undoAutoAcceptedSuggestion(suggestionId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Undone — back to a suggestion card')
        await load()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setUndoBusyId(null)
      }
    })
  }

  function handleDismissSuggestion(suggestionId: string) {
    setSuggestionBusyId(suggestionId)
    startSuggestionPending(async () => {
      try {
        const res = await dismissTaskSuggestion(suggestionId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        await load()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setSuggestionBusyId(null)
      }
    })
  }

  if (loading) {
    // Skeleton, not a spinner: this is a stack of bordered note cards and the
    // reader can be told that before the data lands.
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Loading the record">
        {[0, 1].map((row) => (
          <div key={row} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
            <SkeletonBlock className="h-3 w-40" />
            <SkeletonBlock className="h-3.5 w-full" />
            <SkeletonBlock className="h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-3">
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircleIcon className="size-3.5 shrink-0" aria-hidden /> {loadError}
        </p>
        <Button variant="outline" size="sm" type="button" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!data) return null

  const segments = data.segments.filter(
    (segment) => !(segment.source === 'ai' && isSameNoteText(segment.content, shownElsewhere)),
  )

  // getMeetingNoteTimeline already narrows `suggestions` to open + auto-
  // accepted (see its query comment) — this just tells the two apart for
  // rendering. A suggestion a PERSON accepted has already dropped off the
  // list entirely (same as it always has), so `status === 'accepted'` here
  // can only mean the auto pass did it.
  const manualSuggestions = data.suggestions.filter((s) => s.status === 'open')
  const autoSuggestions = data.suggestions.filter((s) => s.status === 'accepted')

  const speakerLabels = Array.from(
    new Set(
      segments
        .filter((s) => s.source === 'voice' && s.speakerLabel)
        .map((s) => s.speakerLabel as string),
    ),
  )

  return (
    <div className="flex flex-col gap-3">
      {speakerLabels.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5">
          {/* h5: this sits inside the panel's "Record" h4, and used to be an
              h4 styled smaller and weaker than the body text underneath it. */}
          <SectionHeading as="h5" icon={UsersIcon} title="Who's who" />
          <div className="flex flex-wrap gap-2">
            {speakerLabels.map((label) => {
              const mapping = data.speakers.find((s) => s.label === label)
              const value = mapping ? (mapping.userId ?? NOT_ATTENDEE) : undefined
              const busy = speakerBusyLabel === label && speakerPending
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  {canManage ? (
                    <Select
                      value={value}
                      onValueChange={(v) => v && handleAssignSpeaker(label, v)}
                      disabled={busy}
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-40"
                        aria-label={`Who is ${label}?`}
                      >
                        <SelectValue placeholder="Assign…">
                          {(v: string) =>
                            v === NOT_ATTENDEE
                              ? 'Not an attendee'
                              : (attendees.find((a) => a.id === v)?.name ?? 'Assign…')
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {attendees.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={NOT_ATTENDEE}>Not a listed attendee</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs font-medium">
                      {mapping
                        ? (mapping.userName ?? 'Not a listed attendee')
                        : 'Unassigned'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {segments.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center">
          <NotebookPenIcon className="size-4 text-muted-foreground/60" aria-hidden />
          <p className="text-sm font-medium">No notes yet</p>
          <p className="text-xs text-muted-foreground">
            Type one below, or record the meeting so LogPup can add its own.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {segments.map((segment) => {
            const meta = SOURCE_META[segment.source]
            const Icon = meta.icon
            const isEditing = editingId === segment.id
            const canEditThis = canManage && segment.source !== 'voice' && !segment.isLegacy
            const speakerDisplay =
              segment.speakerName ?? segment.speakerLabel ?? (segment.source === 'typed' ? segment.createdByName : null)
            return (
              <li
                key={segment.id}
                className={cn(
                  'flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5',
                  // The model's own write-up reads as a different kind of
                  // thing from a person's typed note, so it gets a rule rather
                  // than a fill — a tint here would have to borrow one of the
                  // four state colours to say something that is not a state.
                  segment.source === 'ai' && 'border-l-2 border-l-muted-foreground/40',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    <span className="font-medium">{meta.label}</span>
                    {speakerDisplay ? (
                      <span className="font-medium text-foreground">{speakerDisplay}</span>
                    ) : null}
                    <span className="font-mono">
                      {format(segment.createdAt, 'MMM d, h:mm a')}
                    </span>
                  </span>
                  {canEditThis && !isEditing ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        onClick={() => startEdit(segment)}
                      >
                        <PencilIcon />
                        <span className="sr-only">Edit note</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        disabled={deletingId === segment.id && deletePending}
                        onClick={() => handleDeleteSegment(segment.id)}
                      >
                        {deletingId === segment.id && deletePending ? (
                          <Loader2Icon className="animate-spin" aria-hidden />
                        ) : (
                          <Trash2Icon />
                        )}
                        <span className="sr-only">Delete note</span>
                      </Button>
                    </span>
                  ) : null}
                </div>

                {isEditing ? (
                  <div className="flex flex-col gap-1.5">
                    <MentionTextarea
                      users={mentionPool}
                      value={editDraft}
                      onValueChange={setEditDraft}
                      maxLength={5000}
                      rows={3}
                      aria-label="Edit note"
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="sm" type="button" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        disabled={savingEditId === segment.id && editPending}
                        onClick={() => handleSaveEdit(segment.id)}
                      >
                        {savingEditId === segment.id && editPending ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : segment.source === 'ai' ? (
                  <MarkdownLite content={segment.content} className={bilingualText} />
                ) : (
                  <p className={cn(bilingualText, 'whitespace-pre-wrap')}>
                    <MentionText text={segment.content} users={mentionPool} />
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {canManage ? (
        <div className="flex flex-col gap-1.5">
          <MentionTextarea
            users={mentionPool}
            value={draft}
            onValueChange={setDraft}
            maxLength={5000}
            rows={2}
            placeholder="Add a note… (@name to mention someone)"
            aria-label="Add a note"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                handleAddNote()
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              type="button"
              disabled={posting || draft.trim().length === 0}
              onClick={handleAddNote}
            >
              {posting ? <Loader2Icon className="animate-spin" aria-hidden /> : <PlusIcon aria-hidden />}
              Add note
            </Button>
          </div>
        </div>
      ) : null}

      {autoSuggestions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading
            as="h5"
            icon={SparklesIcon}
            title="Auto-assigned"
            count={autoSuggestions.length}
          />
          <ul className="flex flex-col gap-2">
            {autoSuggestions.map((suggestion) => {
              const busy = undoBusyId === suggestion.id && undoPending
              return (
                <li
                  key={suggestion.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-success/30 bg-success/5 p-2.5"
                >
                  <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
                    {suggestion.appSlug && suggestion.createdTaskId ? (
                      <Link
                        href={`/apps/${suggestion.appSlug}`}
                        className={cn(
                          bilingualText,
                          'text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        )}
                      >
                        {suggestion.taskTitle ?? suggestion.text}
                      </Link>
                    ) : (
                      <p className={cn(bilingualText, 'text-foreground')}>
                        {suggestion.taskTitle ?? suggestion.text}
                      </p>
                    )}
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {/* Sparkles = AI acted; check = the outcome was
                          committed, not merely proposed — together they say
                          "done automatically", distinct from the neutral
                          "Suggested" chip below on a card nobody clicked yet. */}
                      <MetaChip tone="success">
                        <SparklesIcon className="size-3.5 shrink-0" aria-hidden />
                        <CheckIcon className="size-3.5 shrink-0" aria-hidden />
                        Auto-assigned
                      </MetaChip>
                      {suggestion.suggestedUserId ? (
                        <>
                          to{' '}
                          <Link
                            href={`/people/${suggestion.suggestedUserId}`}
                            className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            {suggestion.suggestedUserName ?? 'Unknown'}
                          </Link>
                        </>
                      ) : null}
                      {suggestion.suggestedDueDate ? (
                        <span className="font-mono">
                          Due {format(parseISO(suggestion.suggestedDueDate), 'MMM d')}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={busy}
                        onClick={() => handleUndoAutoAssign(suggestion.id)}
                      >
                        {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : <UndoIcon aria-hidden />}
                        Undo
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {manualSuggestions.length > 0 ? (
        <section className="flex flex-col gap-2">
          {/* `primary` used to mean four different things at once in this
              feature — "AI proposed it", "resolved", "outcome", and plain
              decoration on two icons. A suggestion is a proposal, not a
              state, so it is a neutral card carrying the word "Suggested". */}
          <SectionHeading
            as="h5"
            icon={SparklesIcon}
            title="Suggested tasks"
            count={manualSuggestions.length}
          />
          {autoAssignCappedCount > 0 ? (
            <p className="text-2xs text-muted-foreground">
              <span className="font-mono">{autoAssignCappedCount}</span>{' '}
              {autoAssignCappedCount === 1 ? 'more suggestion needs' : 'more suggestions need'} review —
              this meeting already hit its auto-assign limit.
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {manualSuggestions.map((suggestion) => {
              const busy = suggestionBusyId === suggestion.id && suggestionPending
              return (
                <li
                  key={suggestion.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-dashed border-border bg-card p-2.5"
                >
                  <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
                    <p className={cn(bilingualText, 'text-foreground')}>{suggestion.text}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <MetaChip>Suggested</MetaChip>
                      {suggestion.suggestedAppName ? (
                        // Where this task will actually be filed — the AI's
                        // routing decision (suggestedAppId, ai-actions.ts).
                        // Without this label, accepting a routed suggestion
                        // files it into an app the card never named.
                        <MetaChip>→ {suggestion.suggestedAppName}</MetaChip>
                      ) : null}
                      <span>{suggestion.suggestedUserName ?? 'Unassigned'}</span>
                      {suggestion.suggestedDueDate ? (
                        <span className="font-mono">
                          Due {format(parseISO(suggestion.suggestedDueDate), 'MMM d')}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        type="button"
                        // A suggestion the AI routed to a specific app can be
                        // accepted even when the MEETING has no app — the
                        // server files it into suggestion.suggestedAppId
                        // (acceptTaskSuggestion falls back to meeting.appId
                        // only when routing was inconclusive). Gating on the
                        // meeting's app alone made routed suggestions
                        // unclickable exactly where routing matters most:
                        // multi-project meetings not pinned to one app.
                        disabled={busy || (!appId && !suggestion.suggestedAppId)}
                        title={
                          appId || suggestion.suggestedAppId
                            ? undefined
                            : 'Link this meeting to an app first'
                        }
                        onClick={() => handleAcceptSuggestion(suggestion)}
                      >
                        {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
                        Add task
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingSuggestion(suggestion)
                          setSuggestionForm(toEditForm(suggestion))
                        }}
                      >
                        <PencilIcon aria-hidden /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        disabled={busy}
                        onClick={() => handleDismissSuggestion(suggestion.id)}
                      >
                        <XIcon aria-hidden />
                        <span className="sr-only">Dismiss suggestion</span>
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <Dialog
        open={editingSuggestion !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSuggestion(null)
            setSuggestionForm(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit suggested task</DialogTitle>
            <DialogDescription>From “{meetingTitle}” — adjust before creating it.</DialogDescription>
          </DialogHeader>
          {editingSuggestion && suggestionForm ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                handleAcceptSuggestion(editingSuggestion, suggestionForm)
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="suggestion-title">Title</Label>
                <Input
                  id="suggestion-title"
                  value={suggestionForm.title}
                  onChange={(e) =>
                    setSuggestionForm((f) => (f ? { ...f, title: e.target.value } : f))
                  }
                  minLength={1}
                  maxLength={140}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="suggestion-assignee">Assignee</Label>
                  <Select
                    value={suggestionForm.assigneeId}
                    onValueChange={(v) =>
                      setSuggestionForm((f) => (f ? { ...f, assigneeId: v ?? UNASSIGNED } : f))
                    }
                  >
                    <SelectTrigger id="suggestion-assignee" className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          value === UNASSIGNED
                            ? 'Unassigned'
                            : (attendees.find((a) => a.id === value)?.name ?? 'Unassigned')
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {attendees.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="suggestion-priority">Priority</Label>
                  <Select
                    value={suggestionForm.priority}
                    onValueChange={(v) =>
                      setSuggestionForm((f) => (f ? { ...f, priority: v ?? '0' } : f))
                    }
                  >
                    <SelectTrigger id="suggestion-priority" className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          PRIORITY_OPTIONS.find((opt) => opt.value === value)?.label ?? 'None'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="suggestion-due">Due date</Label>
                <Input
                  id="suggestion-due"
                  type="date"
                  value={suggestionForm.dueDate}
                  onChange={(e) =>
                    setSuggestionForm((f) => (f ? { ...f, dueDate: e.target.value } : f))
                  }
                  className="font-mono"
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={suggestionBusyId === editingSuggestion.id && suggestionPending}
                >
                  {suggestionBusyId === editingSuggestion.id && suggestionPending
                    ? 'Creating…'
                    : 'Create task'}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
