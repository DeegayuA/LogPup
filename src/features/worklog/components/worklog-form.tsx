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
import { dayFormProblem } from '@/features/worklog/day-form'
import { noteHasAppTag, toggleNoteAppTag } from '@/features/worklog/note-app-tags'
import { DictateButton } from '@/features/speech/components/dictate-button'
import { upsertDailyWorklog } from '@/features/worklog/actions'
import { draftWorklogNote, type WorklogDraft } from '@/features/worklog/draft-actions'
import {
  meterOrigin,
  useAiMeter,
  type MeterOriginSource,
} from '@/features/gemini/components/ai-meter-provider'
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
  const meter = useAiMeter()
  const [saved, setSaved] = useState(initial)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fieldId = useId()

  const dirty = percent !== (saved?.percent ?? null) || note.trim() !== (saved?.note ?? '')
  // ONE description of why Save is unavailable, shared by the button and the
  // sentence beside it — so a dead button can never again be the only thing
  // the person is told.
  const problem = dayFormProblem({ percent, dirty })
  const canSave = problem === null

  // Whether this project is already tagged in the note. The TAG form only:
  // also matching the bare name meant an app called "API" or "Ops" counted as
  // tagged the moment either word appeared in ordinary prose, so its chip read
  // as filled and "split across unfilled projects" silently skipped it. The
  // tag is what the reader and the splitter both write, so it is the only
  // thing that should count as one.
  const getAppFillStatus = (appName: string) => noteHasAppTag(note, appName)

  /**
   * Tag the project, or take the tag back off.
   *
   * IT USED TO ONLY GO ONE WAY: a second click on a tagged chip toasted
   * "already tagged in this work log" and did nothing, so undoing a misclick
   * meant hunting the brackets down in your own prose — on a control that
   * reads as a toggle and shows a checkmark when it is on.
   *
   * The rule lives in note-app-tags.ts beside splitNoteAppTags, so the
   * function that WRITES a tag and the one that READS it back out of the note
   * cannot disagree about what a tag is.
   */
  /**
   * Focus the note and put the caret at the END of it.
   *
   * `focus()` alone leaves the caret wherever it last was — for an untouched
   * box that is offset 0, so tagging a project dropped a `[Project]` marker at
   * the bottom of the note and then parked the cursor at the top of it. The
   * one thing a person is certain to do next is type what they did on that
   * project, and they had to click into the right place first.
   */
  const caretToEnd = () => {
    setTimeout(() => {
      const field = textareaRef.current
      if (!field) return
      field.focus()
      const end = field.value.length
      field.setSelectionRange(end, end)
      // A tag appended past the visible rows is off-screen in a 4-row box.
      field.scrollTop = field.scrollHeight
    }, 50)
  }

  const handleTagProject = (appName: string) => {
    setNote((prev) => toggleNoteAppTag(prev, appName))
    caretToEnd()
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

    caretToEnd()
    toast.success(
      unfilledApps.length === 1
        ? `Added a line for ${unfilledApps[0].name} — say what you did`
        : `Added a line for each of ${unfilledApps.length} projects — say what you did`,
    )
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

  function handleDraft(source?: MeterOriginSource) {
    // Read before the transition — see meterOrigin's note on currentTarget.
    const origin = meterOrigin(source)
    startDrafting(async () => {
      try {
        const res = await meter.track('worklog-draft', origin, () => draftWorklogNote(day))
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        // Overwrites deliberately, like "Draft with AI" on the sprint form
        // (features/sprints/components/task-composer.tsx): the button is the
        // statement of intent, so appending to whatever is already in the box
        // would leave a person to clean up after their own click. Nothing is
        // saved until they press save, so the draft is reversible by not
        // saving it.
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
      {/* 1. Percentage / Plan Progress
          ONE ROW, not three. The question, the reading and the four one-tap
          answers used to stack; on the common path a person taps a preset and
          never touches anything else here, so the fast answer sits beside the
          question rather than below it. The long question survives as the
          control's accessible name — shortened on screen, not in the a11y
          tree. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-baseline gap-2">
            <label
              htmlFor={`${fieldId}-percent`}
              className="font-heading text-xs font-semibold text-foreground"
            >
              Plan progress
            </label>
            {percent === null ? (
              <span className="font-mono text-2xs font-medium text-muted-foreground">
                Not scored yet
              </span>
            ) : (
              <span className="font-mono text-sm font-bold tabular-nums text-primary">
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
                  'flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-2xs font-medium transition-[background-color,border-color,color,box-shadow] motion-reduce:transition-none cursor-pointer',
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
        </div>

        {/* Precision slider, for the answers the four presets do not cover.
            Its floating bubble and the 24px of empty space that existed only
            to hold it are gone: the reading is already in the header one line
            up, and two readouts of one number is height spent saying the same
            thing twice. */}
        <div className="relative">
          <input
            id={`${fieldId}-percent`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={thumbAt}
            aria-label="How much of what you planned did you get through?"
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
              {singleProject ? 'Assigned project' : 'Projects today'}
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
              <span className="size-2 rounded-full bg-primary animate-pulse motion-reduce:animate-none" />
              <span className="font-heading text-xs font-bold text-foreground">
                {singleProject.name}
              </span>
              <span className="font-mono text-2xs text-muted-foreground">
                ({singleProject.allocationPct > 0 ? `${singleProject.allocationPct}% allocation` : 'Primary'})
              </span>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 font-mono text-2xs font-semibold text-primary">
                Auto-Selected
              </span>
            </div>
            {/* ONE control in both states. Tagged used to render a static
                span, so the single-project case had no way back at all — and
                it tested `note.includes` case-sensitively while the chip
                beside it read the note case-insensitively, so the two could
                disagree about the same note. getAppFillStatus answers both. */}
            <button
              type="button"
              aria-pressed={getAppFillStatus(singleProject.name)}
              onClick={() => handleTagProject(singleProject.name)}
              title={
                getAppFillStatus(singleProject.name)
                  ? `Remove the [${singleProject.name}] tag from this day's note`
                  : `Tag [${singleProject.name}] in this day's note`
              }
              className="flex items-center gap-1 font-mono text-2xs font-medium text-primary hover:underline cursor-pointer"
            >
              {getAppFillStatus(singleProject.name) ? (
                <>
                  <CheckCircle2 className="size-3" /> Tagged in note
                </>
              ) : (
                <>+ Insert [{singleProject.name}] tag</>
              )}
            </button>
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
                      'group relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-[background-color,border-color,color,box-shadow] motion-reduce:transition-none cursor-pointer text-left',
                      isFilled
                        ? 'border-primary/40 bg-primary/10 text-foreground font-medium shadow-xs'
                        : 'border-border/60 bg-card/60 text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-foreground',
                    )}
                    /* aria-pressed, because this IS a toggle and always was
                       meant to be — the checkmark says so visually and the
                       accessibility tree said nothing. */
                    aria-pressed={isFilled}
                    title={
                      isFilled
                        ? `Remove the [${app.name}] tag from this day's note`
                        : `Tag [${app.name}] in this day's note`
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
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-2xs font-semibold text-primary">
                        Logged
                      </span>
                    ) : (
                      <span className="rounded bg-chart-1/15 px-1.5 py-0.5 font-mono text-2xs font-semibold text-chart-1 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                        ○ Unfilled
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

          </div>
        ) : null}

        {/* Case 3: No specific assignments -> Studio project chips */}
        {!singleProject && !hasMultipleProjects && assignedApps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {assignedApps.map((app) => {
              const isFilled = getAppFillStatus(app.name)
              return (
                <button
                  key={app.id}
                  type="button"
                  aria-pressed={isFilled}
                  onClick={() => handleTagProject(app.name)}
                  title={
                    isFilled
                      ? `Remove the [${app.name}] tag from this day's note`
                      : `Tag [${app.name}] in this day's note`
                  }
                  className={cn(
                    'flex items-center gap-1 rounded-md border px-2 py-1 text-2xs cursor-pointer',
                    isFilled
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border/60 bg-card text-muted-foreground hover:border-primary hover:text-foreground',
                  )}
                >
                  {isFilled ? (
                    <CheckCircle2 className="size-3 text-primary" />
                  ) : (
                    <Compass className="size-3 text-primary" />
                  )}
                  {/* The leading "+" is dropped once it is on: a chip that
                      still says "add" while showing a checkmark is the reason
                      nobody tried clicking it again. */}
                  <span>{isFilled ? `[${app.name}]` : `+ [${app.name}]`}</span>
                </button>
              )
            })}
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
          {/* The keyboard hint gives way to the reason: a shortcut for an
              action that will not run is not the useful half. Only the
              missing-score case speaks — "nothing to save" is the resting
              state of an untouched form and would be a complaint about a
              mistake nobody has made. */}
          {percent === null ? (
            <span className="text-2xs text-amber-600 dark:text-amber-400">{problem}</span>
          ) : (
            <span className="font-mono text-2xs text-muted-foreground">
              <kbd className="rounded border border-border/80 bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">⌘ + Enter</kbd> to save
            </span>
          )}

          <Button
            type="button"
            size="sm"
            disabled={!canSave || saving}
            title={problem ?? undefined}
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
