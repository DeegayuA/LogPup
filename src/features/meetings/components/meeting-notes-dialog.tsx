'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { format } from 'date-fns'
import { AlertCircle, FileDown, List, ListChecks, NotebookPen, RotateCcw, Sparkles } from 'lucide-react'
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
import { MarkdownLite } from '@/components/markdown-lite'
import { cn } from '@/lib/utils'
import {
  bilingualLead,
  bilingualText,
  MetaChip,
  SectionHeading,
  SkeletonBlock,
  type ChipTone,
} from '@/features/meetings/components/meeting-chips'
import { splitBilingualSummary } from '@/features/meetings/components/meeting-panels-model'
import {
  dueStatus,
  parseSpokenDueDate,
  type ActionRow,
  type DueStatus,
} from '@/features/meetings/components/meeting-notes-model'
import { getMeetingIntel, type MeetingIntel, type TaskSuggestionView } from '@/features/meetings/ai-actions'

/**
 * A meeting's write-up, read from the calendar without leaving it.
 *
 * A chip in a month grid or a time column answers "when" and nothing else, so
 * the only way to read what a past meeting produced was to leave the calendar
 * for the list view — a full navigation to answer a question that takes ten
 * seconds. This is that answer in place: the summary and who owes what, and
 * two exits (the full meeting, the print/PDF view) for everything it
 * deliberately leaves out.
 *
 * READ-ONLY on purpose. Every write the write-up panel offers (accept a
 * suggestion, edit an assignee, record, clear the notes) needs the surrounding
 * context that panel has and a chip popup does not — the filters, the
 * transcript, the follow-ups. Offering half of those controls here would make
 * this a second, weaker editor for the same rows. It shows; the full meeting
 * edits.
 */
export function MeetingNotesDialog({
  meetingId,
  meetingTitle,
  startsAt,
  trigger,
  open,
  onOpenChange,
  onOpenFullMeeting,
}: {
  meetingId: string
  meetingTitle: string
  /** Shown under the title so a popup opened from a grid says which day it is about. */
  startsAt?: Date
  /**
   * The chip's own "read the notes" control, rendered as the dialog trigger.
   * Pass this for the one-dialog-per-chip mounting; omit it and drive `open`
   * instead when a whole grid shares a single dialog.
   */
  trigger?: ReactElement
  /** Controlled mode. Leave undefined to let the trigger own the open state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Jumps to the full meeting (write-up, transcript, follow-ups, recorder) —
   * the same hand-off the calendar's detail dialog makes. Without it the
   * footer says where that surface is instead of pretending to be a dead end.
   */
  onOpenFullMeeting?: (meetingId: string) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen

  const [intel, setIntel] = useState<MeetingIntel | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  /**
   * Which fetch the popup is asking for, against the one its state actually
   * came from. Keys rather than a `loading` boolean because the boolean would
   * have to be switched on from inside the effect — a synchronous setState in
   * an effect body, i.e. a cascading render. This makes "loading" a derived
   * fact: what is being asked for is not yet what has arrived. The meeting id
   * is part of the key, so a single shared dialog re-pointed at another
   * meeting while open shows a skeleton rather than the previous meeting's
   * write-up under the new meeting's title.
   */
  const [attempt, setAttempt] = useState(0)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const requestKey = `${meetingId}:${attempt}`
  // Adjusting state during render (React's own recommendation for reacting to
  // a changed prop) rather than in an effect, so this works whether the open
  // state is ours or the caller's.
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    // Re-fetched on every open rather than cached for the session: a chip
    // popup gets opened seconds after somebody accepted a suggestion or
    // cleared the notes elsewhere, and a stale write-up read as current is
    // worse than a skeleton that resolves in a moment.
    if (isOpen) setAttempt(attempt + 1)
  }
  const loading = isOpen && loadedKey !== requestKey

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    getMeetingIntel(meetingId)
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setIntel(res.data)
          setLoadError(null)
          return
        }
        // A viewer who may not read this meeting's intel lands here too — the
        // server's own words say so, and are shown rather than swallowed.
        setIntel(null)
        setLoadError(res.error)
      })
      .catch(() => {
        if (cancelled) return
        setIntel(null)
        setLoadError('Could not load these notes')
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, meetingId, requestKey])

  function handleOpenChange(next: boolean) {
    if (open === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }

  const notes = intel?.notes ?? null
  const suggestions = intel?.suggestions ?? []
  const untracked = intel?.untrackedActions ?? []
  const actionCount = suggestions.length + untracked.length
  const { en, si } = splitBilingualSummary(notes?.summary)

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{meetingTitle}</DialogTitle>
          <DialogDescription>
            {startsAt ? (
              <>
                {format(startsAt, 'EEEE, MMMM d, yyyy')}
                {' · '}
                <span className="font-mono">{format(startsAt, 'h:mm a')}</span>
                {' · '}
              </>
            ) : null}
            The write-up, read-only.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <NotesSkeleton />
        ) : loadError ? (
          /* The same shape the write-up panel uses for a failed load: what went
             wrong in words, and a control that tries again — never a toast that
             leaves an empty-looking popup behind claiming there are no notes. */
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden /> {loadError}
            </p>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setAttempt((token) => token + 1)}
            >
              <RotateCcw aria-hidden /> Retry
            </Button>
          </div>
        ) : notes ? (
          <div className="flex flex-col gap-4">
            {notes.summary ? (
              <section className="flex flex-col gap-1.5">
                <SectionHeading as="h3" icon={Sparkles} title="Summary" />
                {/* Both languages, always, with no toggle: the toggle in the
                    full write-up is a reading preference that surface has room
                    to remember, and a popup opened for ten seconds should not
                    hide half of what was written behind a control the reader
                    has to find first. `lang` per block still switches a screen
                    reader's pronunciation at the boundary. */}
                {summaryBlocks(en, si, notes.summary).map((block) => (
                  <div key={block.lang} lang={block.lang}>
                    <MarkdownLite content={block.content} className={cn(bilingualLead, 'text-foreground')} />
                  </div>
                ))}
              </section>
            ) : null}

            {actionCount > 0 ? (
              <section className="flex flex-col gap-1.5">
                <SectionHeading as="h3" icon={ListChecks} title="Action items" count={actionCount} />
                <ul className="flex flex-col divide-y divide-border rounded-lg border">
                  {suggestions.map((suggestion) => (
                    <ActionLine
                      key={suggestion.id}
                      text={suggestion.text}
                      owner={suggestion.suggestedUserName}
                      due={suggestion.suggestedDueDate}
                      state={suggestionState(suggestion)}
                    />
                  ))}
                  {untracked.map((row) => (
                    <ActionLine
                      key={row.key}
                      text={row.text}
                      owner={row.owner}
                      due={row.due}
                      dueDate={row.dueDate}
                      status={row.status}
                      // Mentioned in the write-up but never turned into a
                      // suggestion card — say so, because "no owner, no date"
                      // otherwise reads as an item somebody dropped.
                      state={{ label: 'Not tracked', tone: 'neutral' }}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3 shrink-0" aria-hidden />
              Written up by AI on{' '}
              <span className="font-mono">{format(notes.createdAt, 'MMM d, h:mm a')}</span>
              <span aria-hidden>·</span>
              <span className="font-mono">{notes.model}</span>
            </p>
          </div>
        ) : (
          /* Distinct from the error above on purpose: nothing failed here, the
             meeting simply has no write-up yet. Recording and analyzing it
             needs the transcript and the recorder, both of which live in the
             full meeting — so this points there rather than offering a button
             that could not work from a calendar chip. */
          <div className="flex flex-col items-start gap-1.5 rounded-lg border border-dashed px-4 py-6">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <NotebookPen className="size-4 text-muted-foreground" aria-hidden />
              No AI write-up for this meeting yet
            </p>
            <p className="text-sm text-muted-foreground">
              Open the full meeting to record it — LogPup transcribes, summarizes and pulls out the
              action items, in English and Sinhala both.
            </p>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {onOpenFullMeeting ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  onOpenFullMeeting(meetingId)
                  handleOpenChange(false)
                }}
              >
                <List aria-hidden /> Open the full meeting
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                The transcript, follow-ups and editing live in the list view.
              </p>
            )}
            {/* The print-clean A4 view — the browser's Save as PDF is the export
                path (see src/app/print/meetings/[id]/page.tsx). */}
            <Button
              variant="outline"
              size="sm"
              render={<a href={`/print/meetings/${meetingId}`} target="_blank" rel="noreferrer" />}
            >
              <FileDown aria-hidden />
              PDF
            </Button>
          </div>
          <DialogClose render={<Button variant="outline" size="sm" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Which language block(s) the summary has. Falls back to the raw markdown
 * whenever the split found no distinct Sinhala half, so a monolingual summary
 * is never re-flowed through a two-block layout it does not need.
 */
function summaryBlocks(en: string, si: string, raw: string): { lang: 'en' | 'si'; content: string }[] {
  if (!si.trim()) return [{ lang: 'en', content: raw }]
  if (!en.trim()) return [{ lang: 'si', content: si }]
  return [
    { lang: 'en', content: en },
    { lang: 'si', content: si },
  ]
}

/** What became of a suggested action — always a word, colour only doubling it. */
function suggestionState(suggestion: TaskSuggestionView): { label: string; tone: ChipTone } | null {
  if (suggestion.taskStatus === 'done') return { label: 'Done', tone: 'success' }
  if (suggestion.taskStatus === 'in_progress') return { label: 'In progress', tone: 'neutral' }
  if (suggestion.taskStatus === 'todo') return { label: 'Task added', tone: 'neutral' }
  if (suggestion.status === 'accepted') return { label: 'Accepted', tone: 'neutral' }
  return null
}

/**
 * One commitment: what it is, who owes it, when it is due, and where it stands.
 * Same read-only row the write-up's "Not tracked" group uses, minus every
 * control — see the READ-ONLY note on the dialog.
 */
function ActionLine({
  text,
  owner,
  due,
  dueDate,
  status,
  state,
}: {
  text: string
  owner: string | null
  due: string | null
  /** Pre-resolved by the caller when it already has them (see ActionRow). */
  dueDate?: ActionRow['dueDate']
  status?: DueStatus
  state: { label: string; tone: ChipTone } | null
}) {
  const now = new Date()
  const resolvedStatus = status ?? dueStatus(due, now)
  const resolvedDate = dueDate ?? parseSpokenDueDate(due)
  const overdue = resolvedStatus === 'overdue'

  return (
    <li className={cn('flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2', overdue && 'bg-destructive/5')}>
      <span className={cn(bilingualText, 'min-w-0 flex-1 basis-48')}>{text}</span>
      <span className="flex shrink-0 flex-wrap items-center gap-1.5">
        {owner ? (
          <span className="text-xs font-medium text-muted-foreground">{owner}</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">Unassigned</span>
        )}
        <DueChip status={resolvedStatus} due={due} dueDate={resolvedDate} />
        {state ? <MetaChip tone={state.tone}>{state.label}</MetaChip> : null}
      </span>
    </li>
  )
}

/**
 * The deadline, and only as much urgency as we can actually stand behind: a
 * due date the model wrote as a phrase ("next Friday") is quoted with no
 * colour, because we refused to guess which Friday (see parseSpokenDueDate).
 */
function DueChip({
  status,
  due,
  dueDate,
}: {
  status: DueStatus
  due: string | null
  dueDate: Date | null
}) {
  if (status === 'unscheduled') return null
  if (status === 'unparsed') return <MetaChip>Due {due}</MetaChip>

  const day = dueDate ? format(dueDate, 'MMM d') : (due ?? '')
  if (status === 'overdue') {
    return (
      <MetaChip tone="danger">
        Overdue · <span className="font-mono">{day}</span>
      </MetaChip>
    )
  }
  if (status === 'today') return <MetaChip tone="warning">Due today</MetaChip>
  return (
    <MetaChip tone={status === 'soon' ? 'warning' : 'neutral'}>
      Due <span className="font-mono">{day}</span>
    </MetaChip>
  )
}

/**
 * The loading state. A skeleton in the shape of what is coming — a paragraph
 * of summary over a list of action rows — rather than a spinner, which in a
 * container about to be 400px tall says nothing about what to expect.
 */
function NotesSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading notes">
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-3.5 w-full" />
        <SkeletonBlock className="h-3.5 w-11/12" />
        <SkeletonBlock className="h-3.5 w-3/5" />
      </div>
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-4 w-28" />
        <div className="flex flex-col divide-y divide-border rounded-lg border">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <SkeletonBlock className="h-3.5 w-1/2" />
              <SkeletonBlock className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
