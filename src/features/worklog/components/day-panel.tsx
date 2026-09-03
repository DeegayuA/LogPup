'use client'

import * as React from 'react'
import { Loader2Icon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DayHoursCard } from '@/features/worklog/components/day-hours-card'
import { DayOneLine } from '@/features/worklog/components/day-one-line'
import { WorklogForm } from '@/features/worklog/components/worklog-form'
import { draftWorklogNote, type WorklogDraft } from '@/features/worklog/draft-actions'
import {
  meterOrigin,
  useAiMeter,
  type MeterOriginSource,
} from '@/features/gemini/components/ai-meter-provider'
import { draftWorklogEntries, type DraftedEntry } from '@/features/worklog/entry-ai-actions'
import { glanceAtDay } from '@/features/worklog/day-summary'
import type { LoggableTask, WorklogEntryRow } from '@/features/worklog/entry-queries'
import type { PickerApp, UserAssignedApp } from '@/features/worklog/queries'

/**
 * The whole day in one panel: the score, the note, and where the time went —
 * with ONE button that drafts all three.
 *
 * WHY THIS EXISTS RATHER THAN TWO CARDS. Those are three answers to one
 * question ("what did today consist of"), and they were two separate boxes
 * carrying two separate AI buttons doing overlapping work. Pressing both spent
 * somebody's Gemini quota twice on one day, and nothing said which button was
 * meant for them.
 *
 * ONE PASS, TWO ACTIONS, IN PARALLEL. The note draft and the hours draft read
 * the same day from different angles — prose over the activity log, durations
 * off meetings and task movement — so they stay separate server actions and
 * are simply awaited together. Merging them into one action would have made
 * the two AI feature prefs meaningless: somebody who wants prose help but does
 * not want a model estimating durations they will be PAID against must still
 * get exactly what they asked for. Whichever half is switched off is skipped,
 * and the toast says which halves actually ran.
 *
 * NOTHING IS SAVED. Every drafted thing lands as an editable suggestion — the
 * note fills the box, the percent arrives as a labelled chip to apply, and
 * each hours row is accepted or dismissed on its own. A day is a first-person
 * record, and a button that filed one on somebody's behalf would make it a
 * machine's account of their day wearing their name.
 */
export function DayPanel({
  day,
  initial,
  entries,
  scheduledMinutes,
  assignedApps,
  otherApps = [],
  tasks,
  canEdit,
  noteAiEnabled,
  entriesAiEnabled,
}: {
  day: string
  initial: { percent: number; note: string | null } | null
  entries: WorklogEntryRow[]
  scheduledMinutes: number | null
  assignedApps: UserAssignedApp[]
  /**
   * The studio's other active projects — logging never required assignment
   * (createWorklogEntry takes any live app id), only the pickers implied it.
   */
  otherApps?: PickerApp[]
  /** Tasks a task entry may name — passed straight through to the hours card. */
  tasks: LoggableTask[]
  canEdit: boolean
  noteAiEnabled: boolean
  entriesAiEnabled: boolean
}) {
  const [filling, setFilling] = React.useState(false)
  const [noteDraft, setNoteDraft] = React.useState<WorklogDraft | null>(null)
  const [entryDrafts, setEntryDrafts] = React.useState<DraftedEntry[] | null>(null)
  const [evidence, setEvidence] = React.useState(0)
  // Bumped on every fill so WorklogForm re-seeds from the new draft. Its
  // initialDraft is an OPENING VALUE, not a controlled prop — the person edits
  // the box afterwards, and re-imposing the draft each render would fight them
  // mid-sentence.
  const [fillCount, setFillCount] = React.useState(0)

  const anyAi = noteAiEnabled || entriesAiEnabled
  const meter = useAiMeter()

  // ASSIGNED FIRST, then the rest of the studio, for the one-line box and the
  // hours card: both render flat lists (the card's Select scrolls), so the
  // order IS the common case — a person's own projects stay two taps away
  // while a guest project is still reachable by name. The line's one-tap
  // suggestion chips draw from the assigned half ONLY: parsing must hear
  // every project, but promoting alphabetically-first guests to chips styled
  // like a person's own assignments would bury the projects they are actually
  // expected on — the same reason WorklogForm keeps untagged guests behind a
  // picker.
  const assignedPickerApps = assignedApps.map((a) => ({ id: a.id, name: a.name }))
  const pickerApps = [
    ...assignedPickerApps,
    ...otherApps.map((a) => ({ id: a.id, name: a.name })),
  ]

  // What this day already says, for the disclosure's own label. Read from the
  // props rather than from either card's state: those two cards each own an
  // optimistic copy of half of it, and a summary that tracked one of them
  // would disagree with the other the moment somebody saved.
  const glance = glanceAtDay({
    percent: initial?.percent ?? null,
    note: initial?.note ?? null,
    loggedMinutes: entries.reduce((total, entry) => total + entry.minutes, 0),
    scheduledMinutes,
    entryCount: entries.length,
  })

  async function fillMyDay(source?: MeterOriginSource) {
    const origin = meterOrigin(source)
    setFilling(true)
    try {
      // Both halves at once: independent reads, and running them in series
      // would make one button feel like two.
      //
      // TWO meters, not one, because these are two registry features with
      // separate estimates, separate model choices and separate ledger slugs.
      // Folding them into one card would report a cost under a feature name
      // that only paid for half of it — and a dock built for concurrency is
      // exactly what makes showing both affordable.
      const [noteRes, entryRes] = await Promise.all([
        noteAiEnabled
          ? meter.track('worklog-draft', origin, () => draftWorklogNote(day))
          : null,
        entriesAiEnabled
          ? meter.track('worklog-entries-draft', origin, () => draftWorklogEntries(day))
          : null,
      ])

      let filledNote = false
      let filledRows = 0

      if (noteRes) {
        if (noteRes.ok) {
          setNoteDraft(noteRes.data)
          filledNote = noteRes.data.note.trim().length > 0
        } else {
          toast.error(noteRes.error)
        }
      }

      if (entryRes) {
        if (entryRes.ok) {
          setEntryDrafts(entryRes.data.entries)
          setEvidence(entryRes.data.evidenceCount)
          filledRows = entryRes.data.entries.length
        } else {
          toast.error(entryRes.error)
        }
      }

      setFillCount((n) => n + 1)

      // Say what actually happened rather than "Done". An empty day is a quiet
      // day, not a failure, and somebody who sees nothing appear needs to know
      // which of the two it was.
      if (!filledNote && filledRows === 0) {
        toast.info('LogPup recorded nothing for that day — nothing to suggest.')
      } else {
        const parts = [
          filledNote ? 'drafted your note' : null,
          filledRows > 0
            ? `suggested ${filledRows} ${filledRows === 1 ? 'entry' : 'entries'}`
            : null,
        ].filter(Boolean)
        toast.success(`Read your day — ${parts.join(' and ')}. Review before saving.`)
      }
    } catch {
      toast.error('Could not read your day right now — try again')
    } finally {
      setFilling(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs backdrop-blur-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-heading text-sm font-semibold">Your day</h2>
          <p className="text-2xs text-muted-foreground">
            One line does it — a % scores the day, a time logs hours.
          </p>
        </div>
        {canEdit && anyAi ? (
          <Button type="button" size="sm" disabled={filling} onClick={fillMyDay}>
            {filling ? (
              <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <SparklesIcon aria-hidden />
            )}
            {filling ? 'Reading your day…' : 'Fill my day'}
          </Button>
        ) : null}
      </div>

      {/* THE ONE FIELD, in front. Everything below it is the same day seen in
          detail — what is already logged, and the full controls for correcting
          it. Kept rather than deleted: the line is the fast path, not the only
          path, and a day already logged still has to be readable and editable.
          Collapsed by default so the fast path is what a person meets. */}
      {canEdit ? (
        <DayOneLine
          day={day}
          apps={pickerApps}
          suggestFrom={assignedPickerApps}
          tasks={tasks}
          savedNote={initial?.note ?? null}
          scored={initial != null}
        />
      ) : null}

      {/* Open only for somebody who cannot type in the line above — they have
          no fast path, so the detail IS their view of the day.

          It used to also open for any day with content, which meant every day
          you ever came back to. That defeated the collapse entirely: returning
          to yesterday put a slider, four preset pills, a chip row, a textarea,
          a duration box and two selects in front of a person who came to read
          one number. Now the label carries what was logged and the controls
          stay folded until somebody wants to correct something. */}
      <details open={!canEdit}>
        <summary className="cursor-pointer list-none text-2xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          {glance.empty ? (
            <span>The day in detail</span>
          ) : (
            /* The facts first, the affordance last. A person checking what
               they logged gets their answer from the closed state and never
               opens this at all. */
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {glance.percent !== null ? (
                <span className="font-mono text-xs font-bold tabular-nums text-primary">
                  {glance.percent}%
                </span>
              ) : null}
              {glance.hours ? (
                <span className="font-mono tabular-nums text-foreground">{glance.hours}h</span>
              ) : null}
              {glance.entryCount > 0 ? (
                <span className="font-mono tabular-nums">
                  {glance.entryCount} {glance.entryCount === 1 ? 'entry' : 'entries'}
                </span>
              ) : null}
              {glance.snippet ? (
                /* min-w-0 + truncate so a long note shortens instead of
                   pushing "Edit" off the end of the row on a narrow screen. */
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {glance.snippet}
                </span>
              ) : null}
              <span className="shrink-0 underline decoration-dotted underline-offset-2">Edit</span>
            </span>
          )}
        </summary>
        <div className="mt-3 flex flex-col gap-3">
      <WorklogForm
        // Keyed by day AND by fill, so a new draft re-seeds the box while
        // paging to another day still starts from that day's saved state.
        key={`${day}-${fillCount}`}
        day={day}
        initial={initial}
        // Its own Draft button is suppressed while this panel offers one:
        // two triggers doing overlapping work is what this panel removes.
        aiDraftEnabled={noteAiEnabled && !anyAi}
        initialDraft={noteDraft}
        assignedApps={assignedApps}
        otherApps={otherApps}
      />

      <DayHoursCard
        day={day}
        entries={entries}
        scheduledMinutes={scheduledMinutes}
        apps={pickerApps}
        tasks={tasks}
        canEdit={canEdit}
        aiDraftEnabled={entriesAiEnabled}
        // null until the first fill, so the card keeps its own button for
        // anybody who has only the hours feature switched on.
        // The panel owns the fill button whenever it shows one, whether or
        // not a draft has come back yet — otherwise the card renders a second
        // one beside it.
        outerFill={canEdit && anyAi}
        // The one-line box above renders the grammar legend when it is shown,
        // so this card must not render a second copy of it a few hundred
        // pixels below — the same rule as outerFill on the line above.
        showGrammarHelp={!canEdit}
        suggestions={anyAi ? entryDrafts : null}
        evidence={evidence}
      />
        </div>
      </details>
    </div>
  )
}
