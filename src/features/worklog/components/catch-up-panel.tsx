'use client'

import { useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  Loader2Icon,
  SparklesIcon,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DeclareAbsenceDialog,
  type FiledAbsence,
} from '@/features/worklog/components/declare-absence-dialog'
import { WorklogForm } from '@/features/worklog/components/worklog-form'
import { draftWorklogNote, type WorklogDraft } from '@/features/worklog/draft-actions'
import {
  meterOrigin,
  useAiMeter,
  type MeterOriginSource,
} from '@/features/gemini/components/ai-meter-provider'
import type { UserAssignedApp } from '@/features/worklog/queries'

export type CatchUpGap = {
  day: string
  /** The day's owed fraction from coverage — 0.5 names a half Saturday. */
  fraction: number
  /**
   * Whether hours are already recorded against this day.
   *
   * It is STILL a gap — coverage counts a day missing until it has a score,
   * and that is right: the score is the day record. But "Full day (100%)" on
   * a day somebody has already itemised reads as though their work went
   * nowhere, which is how a person concludes the page lost it.
   */
  hasHours?: boolean
}

/**
 * The owed-days group of the catch-up panel.
 * Uses an intelligent day-selector to prevent rendering 10 duplicated giant forms,
 * giving the engineer a clean, focused catch-up workflow.
 */
export function CatchUpPanel({
  gaps,
  filed,
  owedDays,
  knownFrom,
  knownTo,
  canDeclare,
  aiDraftEnabled,
  assignedApps = [],
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
  assignedApps?: UserAssignedApp[]
}) {
  const [drafts, setDrafts] = useState<Record<string, { data: WorklogDraft; seq: number }>>({})
  const seqRef = useRef(0)
  const [draftingDay, setDraftingDay] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const meter = useAiMeter()
  const [activeDay, setActiveDay] = useState<string>(gaps[0]?.day ?? '')

  async function draftAll(source?: MeterOriginSource) {
    const origin = meterOrigin(source)
    if (running) return
    setRunning(true)
    try {
      // Counted, not assumed. Both failure paths below `break`, so claiming
      // `gaps.length` at the end announced "Drafted notes for 5 days!"
      // directly beneath the error toast explaining it had stopped at day
      // two — the run telling the truth and then contradicting it.
      let drafted = 0
      for (const gap of gaps) {
        setDraftingDay(gap.day)
        try {
          /* One meter PER DAY, not one for the run. Each day is its own
             Gemini call with its own ledger row, and the feature's published
             estimate is "per draft" — a single card spanning five days would
             quote a fifth of what the run actually costs. The dock stacks and
             counts the overflow, which is what it is for. */
          const res = await meter.track('worklog-draft', origin, () =>
            draftWorklogNote(gap.day),
          )
          if (!res.ok) {
            toast.error(res.error)
            break
          }
          seqRef.current += 1
          const seq = seqRef.current
          setDrafts((prev) => ({ ...prev, [gap.day]: { data: res.data, seq } }))
          drafted += 1
        } catch {
          toast.error(
            `Could not draft ${format(new Date(`${gap.day}T12:00:00`), 'EEEE, MMMM d')} — the days before it kept their drafts`,
          )
          break
        }
      }
      // Silent when nothing landed: the error toast already said what happened,
      // and "Drafted 0 days" is a second notification carrying no news.
      if (drafted > 0) {
        toast.success(
          drafted === gaps.length
            ? `Drafted ${drafted === 1 ? 'a note' : `notes for ${drafted} days`} — review each before saving.`
            : `Drafted ${drafted} of ${gaps.length} days before stopping — review each before saving.`,
        )
      }
    } finally {
      setDraftingDay(null)
      setRunning(false)
    }
  }

  const currentGap = gaps.find((g) => g.day === activeDay) ?? gaps[0]

  if (gaps.length === 0) return null

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/40 p-5 shadow-xs backdrop-blur-sm">
      {/* Header Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-chart-1/10 text-chart-1">
              <Calendar className="size-4" />
            </span>
            <h2 className="font-heading text-sm font-semibold text-foreground">
              Catch-Up Ledger ({gaps.length} {gaps.length === 1 ? 'day' : 'days'} unlogged)
            </h2>
          </div>
          <p className="text-2xs text-muted-foreground leading-relaxed">
            Fill in earlier days you worked. If you were on leave, training, or off-site, declare it as{' '}
            <span className="font-medium text-foreground">Not a working day</span>.
          </p>
        </div>

        {aiDraftEnabled && gaps.length > 1 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={running}
            onClick={draftAll}
            className="border-primary/30 hover:border-primary hover:bg-primary/5 text-xs font-medium"
          >
            {running ? (
              <Loader2Icon className="size-3.5 animate-spin text-primary mr-1.5" aria-hidden />
            ) : (
              <SparklesIcon className="size-3.5 text-primary mr-1.5" aria-hidden />
            )}
            {running ? 'Drafting all days…' : `✨ Draft All ${gaps.length} Days`}
          </Button>
        ) : null}
      </div>

      {/* Interactive Day Chips Bar */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
          Select Day to Log:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {gaps.map(({ day, fraction, hasHours }) => {
            const isSelected = day === currentGap.day
            const hasDraft = Boolean(drafts[day])
            const isDrafting = draftingDay === day

            return (
              <button
                key={day}
                type="button"
                onClick={() => setActiveDay(day)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-[background-color,border-color,color,box-shadow] motion-reduce:transition-none cursor-pointer text-left',
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/30 shadow-xs'
                    : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground',
                )}
              >
                <div className="flex flex-col">
                  <span className="font-heading text-xs font-bold text-foreground">
                    {format(new Date(`${day}T12:00:00`), 'EEE, MMM d')}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-2xs',
                      hasHours ? 'text-chart-1' : 'text-muted-foreground',
                    )}
                  >
                    {hasHours
                      ? 'Hours in — needs a score'
                      : fraction === 0.5
                        ? 'Half day (50%)'
                        : 'Full day (100%)'}
                  </span>
                </div>

                {isDrafting ? (
                  <Loader2Icon className="size-3.5 animate-spin text-primary shrink-0" />
                ) : hasDraft ? (
                  <span className="flex items-center gap-1 rounded bg-primary/20 px-1.5 py-0.5 font-mono text-2xs font-semibold text-primary">
                    <CheckCircle2 className="size-3" /> Drafted
                  </span>
                ) : (
                  <span className="rounded bg-chart-1/15 px-1.5 py-0.5 font-mono text-2xs font-semibold text-chart-1">
                    Owed
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active Day Focused Form */}
      {currentGap ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-sm font-bold text-foreground">
                {format(new Date(`${currentGap.day}T12:00:00`), 'EEEE, MMMM d, yyyy')}
              </h3>
              {currentGap.fraction === 0.5 ? (
                <span className="rounded bg-muted px-2 py-0.5 font-mono text-2xs font-semibold text-foreground">
                  Half day (Saturday 50%)
                </span>
              ) : null}
            </div>

            {canDeclare ? (
              <DeclareAbsenceDialog
                day={currentGap.day}
                filed={filed}
                owedDays={owedDays}
                knownFrom={knownFrom}
                knownTo={knownTo}
              />
            ) : null}
          </div>

          <WorklogForm
            key={`${currentGap.day}:${drafts[currentGap.day]?.seq ?? 0}`}
            day={currentGap.day}
            initial={null}
            aiDraftEnabled={aiDraftEnabled}
            initialDraft={drafts[currentGap.day]?.data ?? null}
            assignedApps={assignedApps}
          />
        </div>
      ) : null}
    </div>
  )
}
