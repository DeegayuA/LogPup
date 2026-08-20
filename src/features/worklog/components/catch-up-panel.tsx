'use client'

import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { Loader2Icon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DeclareAbsenceDialog,
  type FiledAbsence,
} from '@/features/worklog/components/declare-absence-dialog'
import { WorklogForm } from '@/features/worklog/components/worklog-form'
import { draftWorklogNote, type WorklogDraft } from '@/features/worklog/draft-actions'

export type CatchUpGap = {
  day: string
  /** The day's owed fraction from coverage — 0.5 names a half Saturday. */
  fraction: number
}

/**
 * The owed-days group of the catch-up panel: one form per gap, plus
 * "Draft all N days".
 *
 * Client component because the batch draft is a client-side SEQUENTIAL
 * fan-out of the existing per-day `draftWorklogNote` action — one call in
 * flight at a time (each is a Gemini call on the person's own keys; firing
 * ten at once trips rate limits and races the usage ledger), with the
 * per-day pending state named beside the day it belongs to.
 *
 * Every draft LANDS IN ITS DAY'S FORM for review — nothing here saves.
 * The person still reads, edits, scores and saves each day themselves;
 * `upsertDailyWorklog` stays the only write.
 */
export function CatchUpPanel({
  gaps,
  filed,
  owedDays,
  knownFrom,
  knownTo,
  canDeclare,
  aiDraftEnabled,
}: {
  gaps: CatchUpGap[]
  /** Pending and approved absences, for the dialog's clash naming. */
  filed: FiledAbsence[]
  /** Days in the known window with fraction > 0 — see DeclareAbsenceDialog. */
  owedDays: string[]
  knownFrom: string
  knownTo: string
  canDeclare: boolean
  aiDraftEnabled: boolean
}) {
  // Each landed draft carries a sequence number: the form is REMOUNTED per
  // draft (key includes seq), which is how the note and the suggestion chip
  // arrive as genuinely initial state instead of prop-to-state syncing.
  const [drafts, setDrafts] = useState<Record<string, { data: WorklogDraft; seq: number }>>({})
  const seqRef = useRef(0)
  const [draftingDay, setDraftingDay] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  async function draftAll() {
    if (running) return
    setRunning(true)
    try {
      for (const gap of gaps) {
        setDraftingDay(gap.day)
        try {
          const res = await draftWorklogNote(gap.day)
          if (!res.ok) {
            // The likely failures — feature switched off, no key, out of
            // quota — would repeat identically for every remaining day, so
            // one error stops the run instead of echoing N times.
            toast.error(res.error)
            break
          }
          seqRef.current += 1
          const seq = seqRef.current
          setDrafts((prev) => ({ ...prev, [gap.day]: { data: res.data, seq } }))
        } catch {
          toast.error(
            `Could not draft ${format(new Date(`${gap.day}T12:00:00`), 'EEEE, MMMM d')} — the days before it kept their drafts`,
          )
          break
        }
      }
    } finally {
      setDraftingDay(null)
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-sm font-semibold">
            {gaps.length === 1
              ? '1 earlier day has no entry'
              : `${gaps.length} earlier days have no entry`}
          </h2>
          {/* How the days are counted is stated under the page header, so it
              is not repeated here. */}
          <p className="text-2xs text-muted-foreground">
            Fill in the ones you worked.
            {canDeclare ? (
              <>
                {' '}
                If you were not working — leave, sick, training, a day on another project — say
                so with <span className="font-medium text-foreground">Not a working day</span>{' '}
                rather than writing an entry for work that did not happen.
              </>
            ) : null}
          </p>
        </div>
        {aiDraftEnabled && gaps.length > 1 ? (
          <div className="flex flex-col items-end gap-0.5">
            <Button type="button" variant="outline" size="sm" disabled={running} onClick={draftAll}>
              {running ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : (
                <SparklesIcon aria-hidden />
              )}
              {running ? 'Drafting…' : `Draft all ${gaps.length} days`}
            </Button>
            <p className="text-2xs text-muted-foreground">
              Each draft lands in its box for review — nothing saves itself.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        {gaps.map(({ day, fraction }) => (
          <div key={day} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="flex items-baseline gap-2 font-mono text-xs tabular-nums text-muted-foreground">
                {format(new Date(`${day}T12:00:00`), 'EEEE, MMMM d')}
                {/* The fraction coverage already worked out for this person,
                    not the studio default: the percentage means "of what I
                    planned", so a half day has to be named or a full Saturday
                    reads as an under-delivered weekday. */}
                {fraction === 0.5 ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-sans text-2xs font-medium text-foreground">
                    Half day
                  </span>
                ) : null}
                {draftingDay === day ? (
                  <span
                    role="status"
                    className="flex items-center gap-1 font-sans text-2xs text-muted-foreground"
                  >
                    <Loader2Icon className="size-3 animate-spin" aria-hidden />
                    Drafting…
                  </span>
                ) : null}
              </h3>
              {canDeclare ? (
                <DeclareAbsenceDialog
                  day={day}
                  filed={filed}
                  owedDays={owedDays}
                  knownFrom={knownFrom}
                  knownTo={knownTo}
                />
              ) : null}
            </div>
            {/* Draft with AI reads that day's own activity, so a forgotten
                Tuesday is still recoverable from what LogPup saw. */}
            <WorklogForm
              key={`${day}:${drafts[day]?.seq ?? 0}`}
              day={day}
              initial={null}
              aiDraftEnabled={aiDraftEnabled}
              initialDraft={drafts[day]?.data ?? null}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
