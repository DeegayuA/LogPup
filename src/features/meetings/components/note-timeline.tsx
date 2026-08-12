'use client'

import { useEffect, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  AlertCircleIcon,
  KeyboardIcon,
  Loader2Icon,
  MicIcon,
  NotebookPenIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MentionText, MentionTextarea, type MentionUser } from '@/components/mention-textarea'
import { MarkdownLite } from '@/components/markdown-lite'
import { cn } from '@/lib/utils'
import {
  bilingualText,
  SectionHeading,
  SkeletonBlock,
} from '@/features/meetings/components/meeting-chips'
import { isSameNoteText } from '@/features/meetings/components/meeting-notes-model'
import type { DeadlineHintSource } from '@/features/meetings/components/note-timeline-model'
import {
  ActionItemSuggestionsList,
  buildAssigneePool,
  useActionItemActions,
} from '@/features/meetings/components/action-item-board'
import {
  addTypedNoteSegment,
  deleteNoteSegment,
  editNoteSegment,
  getMeetingNoteTimeline,
  setSpeakerMapping,
  type NoteSegmentView,
  type NoteTimelineData,
} from '@/features/meetings/ai-actions'

const NOT_ATTENDEE = '__not_attendee__'

const SOURCE_META: Record<
  NoteSegmentView['source'],
  { icon: typeof KeyboardIcon; label: string }
> = {
  typed: { icon: KeyboardIcon, label: 'Typed' },
  voice: { icon: MicIcon, label: 'Voice' },
  ai: { icon: SparklesIcon, label: 'AI' },
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
  deadlines = [],
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
  /**
   * The SAME analysis pass's free-text deadlines[] (meetingAiNotes.deadlines)
   * — used only to find an unresolved/unrejected due-date HINT for a
   * suggestion whose own suggestedDueDate is null (see findDueDateHint in
   * note-timeline-model.ts). Never written to; this timeline owns
   * suggestions and tasks, not the AI notes row.
   */
  deadlines?: DeadlineHintSource[]
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

  const mentionPool = mentionUsers ?? attendees
  const assigneePool: MentionUser[] = buildAssigneePool(attendees, mentionUsers)

  // Reassign/reschedule/retitle/accept/dismiss/undo — the ONE shared
  // implementation of "edit this action item" (action-item-board.tsx), fed
  // this timeline's own `data.suggestions` and a setter that patches just
  // that field, so an optimistic edit here updates the exact same rows the
  // Action items panel (meeting-notes.tsx) also renders from a separate
  // fetch of the same underlying query.
  const actionItemActions = useActionItemActions(
    data?.suggestions ?? [],
    (updater) => setData((prev) => (prev ? { ...prev, suggestions: updater(prev.suggestions) } : prev)),
    load,
    assigneePool,
  )

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

      <ActionItemSuggestionsList
        suggestions={data.suggestions}
        attendees={attendees}
        mentionUsers={mentionUsers}
        appId={appId}
        meetingTitle={meetingTitle}
        deadlines={deadlines}
        canManage={canManage}
        compact={false}
        autoAssignCappedCount={autoAssignCappedCount}
        actions={actionItemActions}
      />
    </div>
  )
}
