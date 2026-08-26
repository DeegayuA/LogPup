'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
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
import { MentionText, MentionTextarea, type MentionUser } from '@/components/mention-textarea'
import { MarkdownLite } from '@/components/markdown-lite'
import { cn } from '@/lib/utils'
import {
  bilingualText,
  SectionHeading,
  SkeletonBlock,
} from '@/features/meetings/components/meeting-chips'
import { isSameNoteText } from '@/features/meetings/components/meeting-notes-model'
import { usePanels } from '@/features/meetings/components/meeting-panels'
import { DictateButton } from '@/features/speech/components/dictate-button'
import { resolveSpeakerNameForLabel } from '@/features/meetings/notes'
import { diffSingleWord } from '@/features/meetings/text-replace'
import {
  findMeetingReplacements,
  type MeetingReplaceMatches,
} from '@/features/meetings/text-replace-actions'
import { ReplaceReviewDialog } from '@/features/meetings/components/replace-review-dialog'
import { SelectionCorrector } from '@/features/meetings/components/correct-selection'
import { MeetingPeoplePicker } from '@/features/meetings/components/meeting-people-picker'
import type { PickablePerson } from '@/features/meetings/components/meeting-people-picker-model'
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
  appIds,
  mentionUsers,
  shownElsewhere = null,
  autoAssignCappedCount = 0,
  deadlines = [],
  defaultDueIso = null,
  draftSeed = null,
}: {
  meetingId: string
  meetingTitle: string
  /** Same admin-or-creator tier the rest of the meeting's manage actions use. */
  canManage: boolean
  attendees: { id: string; name: string }[]
  /** The meeting's projects — a set, none primary; `[]` is the app-less meeting. */
  appIds: string[]
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
  /** The agreed next meeting as `YYYY-MM-DD`. This list is the SAME list the
   *  write-up's Action items panel renders, at the other density — so it has to
   *  show the same default deadline, or one row would answer "when is this
   *  due?" two ways on one screen. */
  defaultDueIso?: string | null
  /**
   * A line to drop into the composer, sent by another panel — today the
   * meeting planner's "Answer in notes", so the answer to a question gets
   * typed next to the question that produced it.
   *
   * APPENDS, never replaces, and never posts by itself — exactly the contract
   * DictateButton below already has, and for the same reason: whatever is
   * half-typed in the box belongs to the person typing it.
   *
   * `nonce` is what makes a repeat of the SAME text land again; keying the
   * effect on the text alone would silently swallow the second click on the
   * same question.
   */
  draftSeed?: { text: string; nonce: number } | null
}) {
  const [data, setData] = useState<NoteTimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [posting, startPosting] = useTransition()

  // Appends the seed once per nonce. The guard ref — rather than a
  // nonce-only dependency list — is what makes this correct AND honest about
  // its dependencies: the effect reads the text too, and a re-render carrying
  // the same seed must not append it a second time. Functional updater, so it
  // composes with whatever the person has already typed rather than racing it.
  const appliedSeedNonce = useRef<number | null>(null)
  useEffect(() => {
    if (!draftSeed || !draftSeed.text) return
    if (appliedSeedNonce.current === draftSeed.nonce) return
    appliedSeedNonce.current = draftSeed.nonce
    const line = draftSeed.text
    setDraft((current) => (current.trim() ? `${current.trimEnd()}\n${line}` : line))
  }, [draftSeed])

  // The correctable region: every note, transcript turn and action item on
  // screen. Handed to SelectionCorrector so a selection reaching outside the
  // write-up — into the panel chrome, or another panel entirely — is ignored.
  const timelineRef = useRef<HTMLDivElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  // What the note said before the edit, kept so a saved change can be compared
  // against it — see offerReplaceAll.
  const [editOriginal, setEditOriginal] = useState('')
  const [replaceOffer, setReplaceOffer] = useState<{
    term: string
    replacement: string
    matches: MeetingReplaceMatches
    /**
     * Which gesture started this. It decides one word of copy that matters: an
     * edit has ALREADY fixed the note in front of you, so what is left is the
     * OTHER places — a highlighted word has been fixed nowhere yet, and calling
     * its own occurrence "other" would leave somebody hunting for a mention
     * that is sitting right there on screen.
     */
    origin: 'edit' | 'selection'
  } | null>(null)
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [editPending, startEditPending] = useTransition()

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletePending, startDeletePending] = useTransition()

  const [speakerBusyLabel, setSpeakerBusyLabel] = useState<string | null>(null)
  const [speakerPending, startSpeakerPending] = useTransition()

  // The write-up's density control, read straight from the panels context
  // rather than threaded down as a prop: this timeline is the bulk of what is
  // on screen, and it used to pass `compact={false}` unconditionally — so the
  // Comfortable/Compact toggle changed a few gaps in the panels around it and
  // left the actual record untouched, which read as a broken control.
  const { density } = usePanels()
  const compact = density === 'compact'

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
    setEditOriginal(segment.content)
  }

  /**
   * After a one-word correction, ask whether the rest of the meeting should
   * follow.
   *
   * A name misheard by the transcriber is misheard the same way every time it
   * was said, so fixing it in one note fixes one of eleven. This looks for the
   * old spelling everywhere else in this meeting — other notes, the summary,
   * the action items, the raw transcript — and offers them for review. Fuzzy,
   * because the transcriber's mistakes vary ("Sanjeewa", "Sanjeeva",
   * "Sanjiwa"), and the whole point is to catch the variants a literal search
   * would walk straight past.
   *
   * Silent on failure and silent on no matches: this is an unasked-for offer
   * riding on somebody else's successful save, and an error toast about a
   * search they never ran would read as the save having gone wrong.
   */
  async function offerReplaceAll(before: string, after: string) {
    const change = diffSingleWord(before, after)
    if (!change) return
    try {
      const res = await findMeetingReplacements({
        meetingId,
        term: change.from,
        fuzzy: true,
      })
      // The note just saved now holds the NEW spelling, so it cannot match its
      // own old one — every occurrence here is somewhere else.
      if (!res.ok || res.data.occurrences.length === 0) return
      setReplaceOffer({
        term: change.from,
        replacement: change.to,
        matches: res.data,
        origin: 'edit',
      })
    } catch {
      // Nothing to say: the edit itself succeeded.
    }
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
        const before = editOriginal
        setEditingId(null)
        await load()
        // After the reload, so the timeline behind the dialog already shows the
        // correction the offer is about.
        await offerReplaceAll(before, content)
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

  function handleAssignSpeaker(label: string, value: string, displayName?: string | null) {
    const userId = value === NOT_ATTENDEE ? null : value
    setSpeakerBusyLabel(label)
    startSpeakerPending(async () => {
      try {
        // Omitting displayName for a real user is deliberate: the action
        // treats the arguments as the mapping's whole intended state, so
        // naming a person clears any typed name that used to stand in.
        const res = await setSpeakerMapping(meetingId, label, userId, displayName)
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

  // Anyone can turn out to be "Speaker 2" — the invited list is a guess at
  // who shows up, not a roster of who spoke. Attendees are offered first,
  // then every other approved user.
  const attendeeIdSet = new Set(attendees.map((a) => a.id))
  const otherPeople = (data.approvedUsers ?? []).filter((person) => !attendeeIdSet.has(person.id))
  /**
   * The wider pool the picker offers below the attendees — everyone else
   * approved, plus the "not a listed attendee" sentinel as its LAST entry, so
   * the order the old Select had (attendees, then everyone else, then the
   * sentinel) survives the swap.
   *
   * The sentinel rides here rather than in the picker's own "unassigned" slot
   * on purpose. It is a DECISION about a voice — it writes a speaker mapping
   * with no user and opens the "Their name" field beside this control —
   * whereas the picker's null means "nobody has decided yet", which is what
   * the old placeholder said. Folding the two together would make every
   * un-mapped speaker claim a decision nobody made and pop that name field
   * open underneath all of them.
   */
  const speakerPeople: PickablePerson[] = [
    ...otherPeople,
    { id: NOT_ATTENDEE, name: 'Not a listed attendee', hint: 'A voice with no account here' },
  ]

  return (
    <div ref={timelineRef} className="flex flex-col gap-3">
      {speakerLabels.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5">
          {/* h5: this sits inside the panel's "Record" h4, and used to be an
              h4 styled smaller and weaker than the body text underneath it. */}
          <SectionHeading as="h5" icon={UsersIcon} title="Who's who" />
          <div className="flex flex-wrap gap-2">
            {speakerLabels.map((label) => {
              const mapping = data.speakers.find((s) => s.label === label)
              const value = mapping ? (mapping.userId ?? NOT_ATTENDEE) : null
              const busy = speakerBusyLabel === label && speakerPending
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  {canManage ? (
                    /* The one shared people picker: searchable, attendees under
                       their own heading, everyone else still reachable by
                       typing. A workspace of any size made the old flat Select
                       a scroll hunt, and "Speaker 2" is regularly somebody who
                       was never on the invite. */
                    <MeetingPeoplePicker
                      value={value}
                      onValueChange={(id) => {
                        // The picker's null slot is the old "Assign…"
                        // placeholder — the state an un-mapped speaker is
                        // already in, and there is no action that un-maps one.
                        // Same guard the old `v && …` handler had.
                        if (id) handleAssignSpeaker(label, id)
                      }}
                      // The mapped user's name, so a voice assigned to someone
                      // the pool has since lost (a deactivated account) still
                      // reads as a NAME rather than as "Assign…".
                      currentName={mapping?.userName ?? null}
                      attendees={attendees}
                      people={speakerPeople}
                      disabled={busy}
                      label={`Who is ${label}?`}
                      unassignedLabel="Assign…"
                      className="h-7 w-40 border-input px-2"
                    />
                  ) : null}
                  {/* "Not a listed attendee" alone only records that the voice
                      is nobody on the invite — it discards WHO it was, so the
                      transcript keeps saying "Speaker 1". Commits on blur or
                      Enter, never per keystroke: each save renames the voice
                      across every segment carrying this label. */}
                  {canManage && value === NOT_ATTENDEE ? (
                    <input
                      type="text"
                      defaultValue={mapping?.displayName ?? ''}
                      disabled={busy}
                      maxLength={80}
                      placeholder="Their name"
                      aria-label={`Name for ${label}`}
                      onBlur={(event) => {
                        const typed = event.target.value.trim()
                        if (typed === (mapping?.displayName ?? '')) return
                        handleAssignSpeaker(label, NOT_ATTENDEE, typed || null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          event.currentTarget.blur()
                        }
                      }}
                      className="h-7 w-32 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    />
                  ) : null}
                  {!canManage ? (
                    <span className="text-xs font-medium">
                      {resolveSpeakerNameForLabel(label, data.speakers) ?? 'Unassigned'}
                    </span>
                  ) : null}
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
        <ol className={cn('flex flex-col', compact ? 'gap-1' : 'gap-2')}>
          {segments.map((segment) => {
            const meta = SOURCE_META[segment.source]
            const Icon = meta.icon
            const isEditing = editingId === segment.id
            const canEditThis = canManage && segment.source !== 'voice' && !segment.isLegacy
            // Mappings first, THEN the joined user name. A hand-typed name for
            // a voice with no account lives on the mapping row, so resolving
            // from the segment alone left this reading "Speaker 1" while the
            // PDF export — which already resolves this way — showed the real
            // name. One shared helper, so the two cannot disagree again.
            const speakerDisplay =
              resolveSpeakerNameForLabel(segment.speakerLabel, data.speakers) ??
              segment.speakerName ??
              (segment.source === 'typed' ? segment.createdByName : null)
            return (
              <li
                key={segment.id}
                className={cn(
                  'flex flex-col rounded-lg border border-border bg-card',
                  // The whole point of Compact: more of the record on screen at
                  // once. Padding and the gap between a turn's own lines are
                  // what actually buy that back, not a smaller font.
                  compact ? 'gap-1 p-1.5' : 'gap-1.5 p-2.5',
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
                      {/* A note is the most personal thing anyone writes in
                          here, and deleting one does NOT destroy it — it goes
                          to Trash where an admin can still read it. Retracting
                          a note believing it is gone when it is not is the one
                          mistake this surface must not let someone make, so
                          this is the one delete affordance that gets a
                          confirmation even though it is a single icon button:
                          same AlertDialog pattern as the meeting/task/sprint
                          deletes, with the sharper retention sentence. */}
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              type="button"
                              disabled={deletingId === segment.id && deletePending}
                            />
                          }
                        >
                          {deletingId === segment.id && deletePending ? (
                            <Loader2Icon className="animate-spin" aria-hidden />
                          ) : (
                            <Trash2Icon />
                          )}
                          <span className="sr-only">Delete note</span>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Moves it to Trash — admins can view and restore it, and the content is
                              retained until an admin permanently deletes it.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              disabled={deletingId === segment.id && deletePending}
                              onClick={() => handleDeleteSegment(segment.id)}
                            >
                              {deletingId === segment.id && deletePending ? 'Deleting…' : 'Delete'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {/* Typing a note during a meeting is the thing people least have
                hands free for. Dictation APPENDS to whatever is already in
                the box (and never posts by itself) so a spoken sentence can
                still be corrected, @mentioned, or added to before it goes in. */}
            <DictateButton
              onText={(text) =>
                setDraft((current) => (current.trim() ? `${current.trim()} ${text}` : text))
              }
              disabled={posting}
              label="Speak the note"
              className="mr-auto"
            />
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
        appIds={appIds}
        meetingTitle={meetingTitle}
        deadlines={deadlines}
        defaultDueIso={defaultDueIso}
        canManage={canManage}
        compact={compact}
        autoAssignCappedCount={autoAssignCappedCount}
        actions={actionItemActions}
      />

      {/* "You corrected this spelling — it appears 11 more times." Mounted only
          while there is an offer on the table, so the search result it is
          reviewing is always the one that produced it. */}
      {/* The other way in: highlight a word — in a transcript turn nobody may
          edit, in the AI write-up, anywhere — and say what it should have been.
          Gated on canManage because the server refuses the write regardless,
          and an offer that ends in "you can't do that" is worse than none. */}
      <SelectionCorrector
        meetingId={meetingId}
        containerRef={timelineRef}
        enabled={canManage}
        onFound={(found) => setReplaceOffer({ ...found, origin: 'selection' })}
      />

      {replaceOffer ? (
        <ReplaceReviewDialog
          meetingId={meetingId}
          term={replaceOffer.term}
          replacement={replaceOffer.replacement}
          matches={replaceOffer.matches}
          origin={replaceOffer.origin}
          open
          onOpenChange={(next) => {
            if (!next) setReplaceOffer(null)
          }}
          onApplied={() => {
            void load()
          }}
        />
      ) : null}
    </div>
  )
}
