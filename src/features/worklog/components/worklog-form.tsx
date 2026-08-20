'use client'

import { useId, useState, useTransition, useRef } from 'react'
import { format } from 'date-fns'
import {
  Loader2Icon,
  SparklesIcon,
  XIcon,
  Layers,
  CheckCircle2,
  Plus,
  Compass,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { DictateButton } from '@/features/speech/components/dictate-button'
import { upsertDailyWorklog } from '@/features/worklog/actions'
import { draftWorklogNote, type WorklogDraft } from '@/features/worklog/draft-actions'
import type { UserAssignedApp } from '@/features/worklog/queries'

type PercentSuggestion = { percent: number; activityCount: number }

const SCORE_PRESETS = [
  { val: 25, label: '25% · Light' },
  { val: 50, label: '50% · Half' },
  { val: 80, label: '80% · Solid' },
  { val: 100, label: '100% · Shipped' },
] as const

/**
 * Daily Engineering Work Log Editor.
 *
 * Provides:
 * - 1-tap quick score presets & precision slider.
 * - Intelligent project allocation status pills and templates.
 * - Gemini AI draft and voice dictation.
 * - Instant `⌘ + Enter` keyboard save shortcut.
 */
export function WorklogForm({
  day,
  initial,
  aiDraftEnabled,
  initialDraft,
  assignedApps = [],
}: {
  day: string
  initial: { percent: number; note: string | null } | null
  aiDraftEnabled: boolean
  initialDraft?: WorklogDraft | null
  assignedApps?: UserAssignedApp[]
}) {
  const [percent, setPercent] = useState<number | null>(initial?.percent ?? null)
  const [note, setNote] = useState(initialDraft?.note ?? initial?.note ?? '')
  const [suggestion, setSuggestion] = useState<PercentSuggestion | null>(
    initialDraft && initialDraft.suggestedPercent !== null
      ? { percent: initialDraft.suggestedPercent, activityCount: initialDraft.activityCount }
      : null,
  )
  const [saving, startSaving] = useTransition()
  const [drafting, startDrafting] = useTransition()
  const [saved, setSaved] = useState(initial)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fieldId = useId()

  const dirty = percent !== (saved?.percent ?? null) || note.trim() !== (saved?.note ?? '')
  const canSave = percent !== null && dirty

  // Detect which projects are referenced/filled in the current note
  const getAppFillStatus = (appName: string) => {
    const lowerNote = note.toLowerCase()
    const lowerName = appName.toLowerCase()
    return lowerNote.includes(`[${lowerName}]`) || lowerNote.includes(lowerName)
  }

  // Insert or toggle a project tag into the note textarea
  const handleTagProject = (appName: string) => {
    const tag = `[${appName}]`
    if (note.includes(tag)) {
      toast.info(`${appName} is already tagged in this work log.`)
      return
    }

    setNote((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return `${tag} `
      return `${trimmed}\n${tag} `
    })

    setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
  }

  // Split day across all unfilled assigned projects
  const handleSplitUnfilled = () => {
    const unfilledApps = assignedApps.filter((a) => !getAppFillStatus(a.name))
    if (unfilledApps.length === 0) {
      toast.info('All assigned projects are already tagged in your note.')
      return
    }

    setNote((prev) => {
      let updated = prev.trim()
      for (const app of unfilledApps) {
        const tag = `[${app.name}]`
        if (!updated.includes(tag)) {
          updated = updated ? `${updated}\n${tag} ` : `${tag} `
        }
      }
      return updated
    })

    setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
    toast.success(`Added templates for ${unfilledApps.length} project(s)`)
  }

  function handleSave() {
    if (percent === null) return
    const nextPercent = percent
    const nextNote = note.trim() ? note.trim() : null
    const previous = saved
    setSaved({ percent: nextPercent, note: nextNote })
    startSaving(async () => {
      try {
        const res = await upsertDailyWorklog(day, nextPercent, nextNote)
        if (!res.ok) {
          setSaved(previous)
          toast.error(res.error)
          return
        }
        toast.success('Logged successfully!')
      } catch {
        setSaved(previous)
        toast.error('Could not save that — try again')
      }
    })
  }

  function handleDraft() {
    startDrafting(async () => {
      try {
        const res = await draftWorklogNote(day)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setNote(res.data.note)
        setSuggestion(
          res.data.suggestedPercent !== null
            ? { percent: res.data.suggestedPercent, activityCount: res.data.activityCount }
            : null,
        )
        if (res.data.activityCount === 0) {
          toast.info('LogPup recorded nothing for that day — the draft is a prompt, not a summary.')
        }
      } catch {
        toast.error('Could not draft that right now — try again')
      }
    })
  }

  const thumbAt = percent ?? 50

  function scoreFromGesture() {
    if (percent === null) setPercent(thumbAt)
  }

  const singleProject = assignedApps.length === 1 ? assignedApps[0] : null
  const hasMultipleProjects = assignedApps.length > 1
  const unfilledCount = assignedApps.filter((a) => !getAppFillStatus(a.name)).length

  return (
    <section
      aria-label={`Work log for ${format(new Date(`${day}T12:00:00`), 'EEEE, MMMM d, yyyy')}`}
      className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-sm"
    >
      {/* 1. Percentage / Plan Progress */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${fieldId}-percent`} className="font-heading text-xs font-semibold text-foreground">
            How much of what you planned did you get through?
          </label>
          {percent === null ? (
            <span className="font-mono text-2xs font-medium text-muted-foreground">
              Not scored yet
            </span>
          ) : (
            <span className="font-mono text-base font-bold tabular-nums text-primary">
              {percent}%
            </span>
          )}
        </div>

        {/* 1-Tap Preset Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SCORE_PRESETS.map((preset) => {
            const isSelected = percent === preset.val
            return (
              <button
                key={preset.val}
                type="button"
                onClick={() => setPercent(preset.val)}
                className={cn(
                  'flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-2xs font-medium transition-all cursor-pointer',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'border-border/60 bg-card/80 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {isSelected ? <Check className="size-3" /> : null}
                <span>{preset.label}</span>
              </button>
            )
          })}
        </div>

        {/* Precision Slider */}
        <div className="relative pt-6">
          {percent !== null ? (
            <output
              htmlFor={`${fieldId}-percent`}
              aria-hidden
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-primary px-1.5 py-0.5 font-mono text-2xs font-bold tabular-nums text-primary-foreground shadow-xs"
              style={{ left: `calc(${percent}% + ${(50 - percent) * 0.16}px)` }}
            >
              {percent}%
            </output>
          ) : null}
          <input
            id={`${fieldId}-percent`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={thumbAt}
            aria-valuetext={percent === null ? 'Not scored yet' : `${percent}%`}
            onPointerDown={scoreFromGesture}
            onKeyDown={scoreFromGesture}
            onChange={(event) => setPercent(Number(event.target.value))}
            className={cn(
              'w-full accent-primary pointer-coarse:min-h-11 cursor-pointer',
              percent === null && 'opacity-60',
            )}
          />
        </div>

        {suggestion !== null && suggestion.percent !== percent ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5">
            <SparklesIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
            <p className="min-w-0 flex-1 text-2xs text-muted-foreground">
              AI suggests{' '}
              <span className="font-mono font-bold tabular-nums text-foreground">
                {suggestion.percent}%
              </span>
              {/* A literal •, not the HTML entity: this is a JS string inside
                  braces, where JSX does no entity decoding, so "&bull;" would
                  render as those six characters verbatim. Entities are only
                  decoded in raw JSX text — which is why the same "&bull;"
                  elsewhere in this feature is correct and this one was not. */}
              {' • based on '}
              <span className="font-mono font-medium text-foreground">{suggestion.activityCount}</span>
              {suggestion.activityCount === 1 ? ' activity' : ' activities'} recorded.
            </p>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setPercent(suggestion.percent)}
              className="border-primary/40 hover:bg-primary hover:text-primary-foreground"
            >
              Use {suggestion.percent}%
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss suggested percent"
              onClick={() => setSuggestion(null)}
            >
              <XIcon aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>

      {/* 2. Intelligent Project Selection & Allocation Bar */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary" />
            <span className="font-heading text-xs font-semibold text-foreground">
              {singleProject ? 'Assigned Project' : 'Project Allocation for Today'}
            </span>
          </div>

          {hasMultipleProjects && unfilledCount > 0 ? (
            <button
              type="button"
              onClick={handleSplitUnfilled}
              className="flex items-center gap-1 rounded font-mono text-[11px] font-medium text-primary hover:underline cursor-pointer"
            >
              <Plus className="size-3" />
              <span>Tag {unfilledCount} unfilled project(s)</span>
            </button>
          ) : null}
        </div>

        {/* Case 1: Exactly 1 Project -> Auto-Selected */}
        {singleProject ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <span className="font-heading text-xs font-bold text-foreground">
                {singleProject.name}
              </span>
              <span className="font-mono text-2xs text-muted-foreground">
                ({singleProject.allocationPct > 0 ? `${singleProject.allocationPct}% allocation` : 'Primary'})
              </span>
              <span className="rounded-full bg-primary/20 px-2 py-0.2 font-mono text-[10px] font-semibold text-primary">
                Auto-Selected
              </span>
            </div>
            {!note.includes(`[${singleProject.name}]`) ? (
              <button
                type="button"
                onClick={() => handleTagProject(singleProject.name)}
                className="font-mono text-2xs text-primary hover:underline cursor-pointer font-medium"
              >
                + Insert [{singleProject.name}] tag
              </button>
            ) : (
              <span className="flex items-center gap-1 font-mono text-2xs text-primary font-medium">
                <CheckCircle2 className="size-3" /> Tagged in note
              </span>
            )}
          </div>
        ) : null}

        {/* Case 2: More Than 1 Project -> Suggest Unfilled with Intelligent Chips */}
        {hasMultipleProjects ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {assignedApps.map((app) => {
                const isFilled = getAppFillStatus(app.name)

                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => handleTagProject(app.name)}
                    className={cn(
                      'group relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all cursor-pointer text-left',
                      isFilled
                        ? 'border-primary/40 bg-primary/10 text-foreground font-medium shadow-xs'
                        : 'border-border/60 bg-card/60 text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-foreground',
                    )}
                    title={
                      isFilled
                        ? `${app.name} is included in this day's work log`
                        : `Click to add [${app.name}] tag to this day's note`
                    }
                  >
                    {isFilled ? (
                      <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                    ) : (
                      <span className="size-2 rounded-full bg-chart-1 shrink-0 ring-2 ring-chart-1/20" />
                    )}

                    <span className="font-medium text-foreground">{app.name}</span>

                    {app.allocationPct > 0 ? (
                      <span className="font-mono text-2xs text-muted-foreground">
                        {app.allocationPct}%
                      </span>
                    ) : null}

                    {isFilled ? (
                      <span className="rounded bg-primary/20 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-primary">
                        Logged
                      </span>
                    ) : (
                      <span className="rounded bg-chart-1/15 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-chart-1 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                        ○ Unfilled
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <p className="text-2xs text-muted-foreground">
              💡 <strong>Smart Allocation:</strong> Click any project chip above to tag it in your note.
            </p>
          </div>
        ) : null}

        {/* Case 3: No specific assignments -> Studio project chips */}
        {!singleProject && !hasMultipleProjects && assignedApps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {assignedApps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => handleTagProject(app.name)}
                className="flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 text-2xs text-muted-foreground hover:border-primary hover:text-foreground cursor-pointer"
              >
                <Compass className="size-3 text-primary" />
                <span>+ [{app.name}]</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* 3. Note Content Textarea */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={`${fieldId}-note`} className="font-heading text-xs font-semibold text-foreground">
            What did you do?
          </label>
          <div className="flex items-center gap-1.5">
            <DictateButton
              onText={(text) =>
                setNote((current) => (current.trim() ? `${current.trim()} ${text}` : text))
              }
              disabled={saving}
              label="Speak it"
              size="sm"
            />
            {aiDraftEnabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={drafting || saving}
                onClick={handleDraft}
                className="border-primary/30 hover:border-primary hover:bg-primary/5 text-xs"
              >
                {drafting ? (
                  <Loader2Icon className="size-3.5 animate-spin text-primary mr-1" aria-hidden />
                ) : (
                  <SparklesIcon className="size-3.5 text-primary mr-1" aria-hidden />
                )}
                {drafting ? 'Drafting…' : 'Draft with AI'}
              </Button>
            ) : null}
          </div>
        </div>

        <Textarea
          ref={textareaRef}
          id={`${fieldId}-note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              if (canSave && !saving) {
                handleSave()
              }
            }
          }}
          placeholder="e.g. [Kestrel] Completed rate limiter bucket algorithm and database migration test..."
          maxLength={4000}
          rows={4}
          className="resize-none font-sans text-xs leading-relaxed border-border/70 bg-card/80 focus-visible:ring-primary"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="font-mono text-2xs text-muted-foreground">
            <kbd className="rounded border border-border/80 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘ + Enter</kbd> to save
          </span>

          <Button
            type="button"
            size="sm"
            disabled={!canSave || saving}
            onClick={handleSave}
            className="min-w-24 font-medium shadow-xs cursor-pointer"
          >
            {saving ? (
              <Loader2Icon className="size-3.5 animate-spin mr-1" aria-hidden />
            ) : null}
            {saving ? 'Saving…' : saved ? 'Update entry' : 'Save entry'}
          </Button>
        </div>
      </div>
    </section>
  )
}
