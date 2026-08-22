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
import type { LoggableTask, WorklogEntryRow } from '@/features/worklog/entry-queries'
import type { UserAssignedApp } from '@/features/worklog/queries'

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
          apps={assignedApps.map((a) => ({ id: a.id, name: a.name }))}
          tasks={tasks}
          savedNote={initial?.note ?? null}
          scored={initial != null}
        />
      ) : null}

      <details open={!canEdit || entries.length > 0 || initial != null}>
        <summary className="w-fit cursor-pointer text-2xs text-muted-foreground hover:text-foreground">
          The day in detail
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
      />

      <DayHoursCard
        day={day}
        entries={entries}
        scheduledMinutes={scheduledMinutes}
        apps={assignedApps.map((a) => ({ id: a.id, name: a.name }))}
        tasks={tasks}
        canEdit={canEdit}
        aiDraftEnabled={entriesAiEnabled}
        // null until the first fill, so the card keeps its own button for
        // anybody who has only the hours feature switched on.
        // The panel owns the fill button whenever it shows one, whether or
        // not a draft has come back yet — otherwise the card renders a second
        // one beside it.
        outerFill={canEdit && anyAi}
        suggestions={anyAi ? entryDrafts : null}
        evidence={evidence}
      />
        </div>
      </details>
    </div>
  )
}
