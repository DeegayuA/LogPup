'use client'

import * as React from 'react'
import { Loader2Icon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DayHoursCard } from '@/features/worklog/components/day-hours-card'
import { WorklogForm } from '@/features/worklog/components/worklog-form'
import { draftWorklogNote, type WorklogDraft } from '@/features/worklog/draft-actions'
import { draftWorklogEntries, type DraftedEntry } from '@/features/worklog/entry-ai-actions'
import type { WorklogEntryRow } from '@/features/worklog/entry-queries'
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
  canEdit,
  noteAiEnabled,
  entriesAiEnabled,
}: {
  day: string
  initial: { percent: number; note: string | null } | null
  entries: WorklogEntryRow[]
  scheduledMinutes: number | null
  assignedApps: UserAssignedApp[]
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

  async function fillMyDay() {
    setFilling(true)
    try {
      // Both halves at once: independent reads, and running them in series
      // would make one button feel like two.
      const [noteRes, entryRes] = await Promise.all([
        noteAiEnabled ? draftWorklogNote(day) : null,
        entriesAiEnabled ? draftWorklogEntries(day) : null,
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
      {canEdit && anyAi ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-heading text-sm font-semibold">Your day</h2>
            <p className="text-2xs text-muted-foreground">
              Score it, say what you did, and log where the time went.
            </p>
          </div>
          <Button type="button" size="sm" disabled={filling} onClick={fillMyDay}>
            {filling ? (
              <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <SparklesIcon aria-hidden />
            )}
            {filling ? 'Reading your day…' : 'Fill my day'}
          </Button>
        </div>
      ) : null}

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
        canEdit={canEdit}
        aiDraftEnabled={entriesAiEnabled}
        // null until the first fill, so the card keeps its own button for
        // anybody who has only the hours feature switched on.
        suggestions={anyAi ? entryDrafts : null}
        evidence={evidence}
      />
    </div>
  )
}
