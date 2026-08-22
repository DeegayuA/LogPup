'use client'

import * as React from 'react'
import { Check, Loader2Icon, Plus, SparklesIcon, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchSelect } from '@/components/ui/search-select'
import {
  ENTRY_CATEGORIES,
  accountedFraction,
  formatHours,
  totalMinutes,
  type EntryCategory,
} from '@/features/worklog/entries'
import type { Observation } from '@/features/worklog/entry-check'
import { buildEntryPayload, entryFormProblem } from '@/features/worklog/entry-form'
import { createWorklogEntry, deleteWorklogEntry } from '@/features/worklog/entry-actions'
import {
  checkWorklogEntries,
  draftWorklogEntries,
  type DraftedEntry,
} from '@/features/worklog/entry-ai-actions'
import {
  meterOrigin,
  useAiMeter,
  type MeterOriginSource,
} from '@/features/gemini/components/ai-meter-provider'
import type { LoggableTask, WorklogEntryRow } from '@/features/worklog/entry-queries'
import { cn } from '@/lib/utils'

/**
 * Where the day's hours are recorded — one row per piece of work.
 *
 * THESE ARE MEASURED, NOT DERIVED, which is the whole reason this can sit
 * beside the percent slider. The page's "days, never hours" rule is about
 * DERIVATION: multiplying a self-scored percent-of-plan into a duration would
 * invent a timesheet nobody filled in. Minutes somebody typed against a piece
 * of work are the opposite — a first-hand record, and the only honest source
 * of an hours figure in this product.
 *
 * The two never mix. `daily_worklogs.percent` stays a JUDGEMENT ("of what I
 * planned, how much did I get through"); these stay a MEASUREMENT ("where the
 * time went"). Nothing here is computed from that, and nothing there from
 * these.
 */

const CATEGORY_LABEL: Record<EntryCategory, string> = {
  task: 'Task',
  meeting: 'Meeting',
  review: 'Review',
  support: 'Support',
  admin: 'Admin',
  learning: 'Learning',
  other: 'Other',
}

const NO_APP = '__none__'

/** Shared empty set, so the derivation below returns a stable reference. */
const EMPTY_HIDDEN: ReadonlySet<string> = new Set()

/**
 * A stable identity for one observation, so dismissing it dismisses THAT one.
 *
 * Keyed on kind plus the facts it was computed from rather than on the
 * message, because the message may be reworded by a model between two runs of
 * the same check — dismiss "you logged 9h against a 8h day", get it back
 * phrased differently, and the dismissal would look broken. The facts are what
 * findDiscrepancies actually decided on, and they only change when the day
 * does, which is exactly when the note should return.
 */
function observationKey(observation: { kind: string; facts: Record<string, unknown> }): string {
  const facts = Object.keys(observation.facts)
    .sort()
    .map((name) => `${name}=${String(observation.facts[name])}`)
    .join('|')
  return `${observation.kind}::${facts}`
}

/**
 * "1.5", "90m", "1h30", "2h" all mean the same thing to somebody logging a
 * day, and refusing three of them because the fourth was expected is the kind
 * of small rudeness that stops a habit forming. Returns whole minutes, or null
 * when there is genuinely no number in there.
 */
export function parseDuration(raw: string): number | null {
  const text = raw.trim().toLowerCase()
  if (!text) return null

  const hm = text.match(/^(\d+)\s*h\s*(\d+)\s*m?$/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])

  const hours = text.match(/^(\d+(?:[.,]\d+)?)\s*h(?:rs?|ours?)?$/)
  if (hours) return Math.round(Number(hours[1].replace(',', '.')) * 60)

  const mins = text.match(/^(\d+)\s*m(?:ins?|inutes?)?$/)
  if (mins) return Number(mins[1])

  // A bare number is HOURS, because that is what somebody typing "1.5" into a
  // box labelled Hours means. Minutes have to say so.
  const bare = text.match(/^(\d+(?:[.,]\d+)?)$/)
  if (bare) return Math.round(Number(bare[1].replace(',', '.')) * 60)

  return null
}

export function DayHoursCard({
  day,
  entries,
  scheduledMinutes,
  apps,
  tasks,
  canEdit,
  aiDraftEnabled = false,
  suggestions = null,
  evidence = 0,
}: {
  day: string
  entries: WorklogEntryRow[]
  /** Minutes this person was scheduled to work, or null when unknown. */
  scheduledMinutes: number | null
  apps: { id: string; name: string }[]
  /**
   * The tasks a task entry may name. Empty is a real state — somebody with no
   * assigned tasks logs meetings, review and admin, and the form says so
   * rather than offering a picker with nothing in it.
   */
  tasks: LoggableTask[]
  /** False for a future day, which cannot be logged against. */
  canEdit: boolean
  /** Whether the per-entry AI draft is switched on for this person. */
  aiDraftEnabled?: boolean
  /**
   * Suggestions produced by an OUTER control — the day panel's single "Fill my
   * day", which drafts the note and the hours in one pass. When this is
   * supplied the card shows no button of its own: two AI triggers on one
   * screen doing overlapping work is how somebody spends their quota twice
   * and wonders which one they were meant to press.
   */
  suggestions?: DraftedEntry[] | null
  evidence?: number
}) {
  const [pending, startTransition] = React.useTransition()
  /*
   * What the cross-check noticed, and which of those the person has waved
   * away. Both are per-day and deliberately NOT persisted: an observation is
   * derived from the entries as they stand, so it comes back on its own the
   * moment the day still warrants it, and a dismissal stored in a table would
   * be a second thing that can disagree with the first.
   */
  /*
   * TAGGED WITH THE DAY IT DESCRIBES, rather than reset by an effect when the
   * day changes. Both are derived below by comparing that tag against the
   * current `day`, so yesterday's "two entries against the same task" cannot
   * survive onto a different date — and no setState-in-effect cascade is
   * needed to make that true.
   */
  const [checked, setChecked] = React.useState<{
    day: string
    observations: Observation[]
    hidden: ReadonlySet<string>
  }>({ day, observations: [], hidden: new Set() })

  const observations = checked.day === day ? checked.observations : []
  const hiddenNotes = checked.day === day ? checked.hidden : EMPTY_HIDDEN

  /**
   * The cross-check, run after a save changed the day.
   *
   * FIRE AND FORGET, deliberately outside the save transition. The entry is
   * already written and the toast has already said so; a check that made the
   * form sit pending would turn "log 90 minutes" into a round trip to Gemini,
   * and a check that FAILED would then look like the save failing.
   *
   * A failure is silence. checkWorklogEntries returns `err` when AI is off,
   * when the key is spent, or when the day is not a day — none of which is
   * something the person logging their hours needs to hear about.
   */
  const runCheck = React.useCallback(() => {
    if (!canEdit) return
    void checkWorklogEntries(day)
      .then((res) => {
        if (!res.ok) return
        // Stamped with the day it was asked about: a slow check that lands
        // after the reader has moved on must not paint yesterday's notes onto
        // today. The derivation above then ignores it.
        setChecked({ day, observations: res.data.observations, hidden: new Set() })
      })
      .catch(() => {
        /* Offline, or the action threw. The day is saved either way. */
      })
  }, [canEdit, day])
  const [duration, setDuration] = React.useState('')
  // Opens on the kind this person can actually submit. 'task' is the right
  // default for almost everybody and the wrong one for a lead with nothing
  // assigned to them — for whom the form would open already unsubmittable,
  // which is the shape of the bug this card just had.
  const [category, setCategory] = React.useState<EntryCategory>(
    tasks.length > 0 ? 'task' : 'meeting',
  )
  const [appId, setAppId] = React.useState<string>(NO_APP)
  const [taskId, setTaskId] = React.useState<string>('')
  const [note, setNote] = React.useState('')
  const [busyId, setBusyId] = React.useState<string | null>(null)
  // Proposals live HERE, not in the entries list, and are never written until
  // somebody accepts one. A draft that saved itself would be the model filing
  // a timesheet in a person's name — and hours, unlike a note, are the thing
  // an invoice is built from.
  const [ownDrafted, setOwnDrafted] = React.useState<DraftedEntry[] | null>(null)
  const [ownEvidence, setOwnEvidence] = React.useState(0)
  // Dismissed suggestions are tracked by index against whichever list is
  // showing, so a person can clear rows the outer panel handed down without
  // that panel having to own the dismissal.
  const [dismissed, setDismissed] = React.useState<Set<number>>(new Set())
  const externallyDriven = suggestions !== null
  // ONE source list, and dismissal is tracked by INDEX INTO IT rather than by
  // rebuilding the array. The panel owns its array and this card cannot
  // rewrite it, so a filtered copy would make every index mean something
  // different from what the dismiss handler was given — rows would vanish in
  // the wrong order as soon as two were cleared.
  const sourceDrafts = externallyDriven ? suggestions : ownDrafted
  const evidenceCount = externallyDriven ? evidence : ownEvidence
  const visibleCount = sourceDrafts
    ? sourceDrafts.filter((_, i) => !dismissed.has(i)).length
    : 0

  // A fresh batch clears the previous batch's dismissals, or new rows inherit
  // the old list's holes. Adjusted DURING RENDER rather than in an effect —
  // React's own guidance for "reset state when a prop changes", and the
  // effect version trips the cascading-render rule because it sets state on
  // the commit after the one that already had the new list.
  const [seenSuggestions, setSeenSuggestions] = React.useState(suggestions)
  if (suggestions !== seenSuggestions) {
    setSeenSuggestions(suggestions)
    setDismissed(new Set())
  }

  const dismissAt = React.useCallback((index: number) => {
    setDismissed((prev) => new Set(prev).add(index))
  }, [])

  const dismissAll = React.useCallback(() => {
    setDismissed(new Set(sourceDrafts?.map((_, i) => i) ?? []))
  }, [sourceDrafts])

  // The project rides in the HINT rather than the label, which is what makes
  // it searchable: SearchSelect matches on label + hint together, so typing a
  // project name narrows to that project's tasks, and typing "done" finds the
  // finished ones. A done task says so before it is picked — hours booked to
  // a task somebody closed last month are usually a misclick, not a decision.
  const taskOptions = React.useMemo(
    () =>
      tasks.map((task) => ({
        value: task.id,
        label: task.title,
        hint: task.status === 'done' ? `${task.appName} · Done` : task.appName,
      })),
    [tasks],
  )
  const [drafting, setDrafting] = React.useState(false)
  const meter = useAiMeter()

  async function handleDraft(source?: MeterOriginSource) {
    const origin = meterOrigin(source)
    setDrafting(true)
    try {
      const res = await meter.track('worklog-entries-draft', origin, () =>
        draftWorklogEntries(day),
      )
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setOwnDrafted(res.data.entries)
      setOwnEvidence(res.data.evidenceCount)
      if (res.data.entries.length === 0) {
        // An empty day is a quiet day, not a failure. Saying so beats an
        // empty list somebody reads as the feature being broken.
        toast.info(
          res.data.evidenceCount === 0
            ? 'LogPup recorded nothing for that day — nothing to suggest.'
            : 'Nothing worth suggesting on top of what you already logged.',
        )
      }
    } catch {
      toast.error('Could not draft that right now — try again')
    } finally {
      setDrafting(false)
    }
  }

  function acceptDraft(entry: DraftedEntry, index: number) {
    startTransition(async () => {
      try {
        const res = await createWorklogEntry({
          day,
          minutes: entry.minutes,
          category: entry.category,
          taskId: entry.taskId,
          note: entry.note,
          // Recorded as AI-suggested so the row remembers how it arrived, and
          // so nothing can later present it as something a person typed.
          source: 'ai_suggested',
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        dismissAt(index)
        toast.success(`Logged ${formatHours(entry.minutes)}h`)
        // An accepted draft is a save like any other, and the drafts are the
        // rows most worth cross-checking: they were proposed from evidence
        // rather than typed from memory.
        runCheck()
      } catch {
        toast.error('Could not log that — try again')
      }
    })
  }


  const logged = totalMinutes(entries)
  /* null when nothing is scheduled — a person with no work pattern that day
     has no denominator, and 0/0 rendered as 0% would read as "logged nothing"
     rather than "nothing was owed". */
  const accounted = accountedFraction(logged, scheduledMinutes ?? 0)
  const openObservations = observations.filter(
    (observation) => !hiddenNotes.has(observationKey(observation)),
  )
  const isTask = category === 'task'
  // ONE description of the form's state, shared by the payload, the disabled
  // button and the hint under it — so the reason Add is unavailable is always
  // the reason the server would have given, in the same words.
  const formFields = {
    minutes: parseDuration(duration),
    category,
    taskId: taskId || null,
    appId: appId === NO_APP ? null : appId,
    note,
  }
  const problem = entryFormProblem(formFields)
  const canSubmit = problem === null && !pending

  function handleAdd() {
    const payload = buildEntryPayload(formFields)
    if (!payload || problem) {
      toast.error(problem ?? 'Enter a time — "1.5", "90m" and "1h30" all work')
      return
    }
    startTransition(async () => {
      try {
        const res = await createWorklogEntry({ day, ...payload })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setDuration('')
        setNote('')
        toast.success(`Logged ${formatHours(payload.minutes)}h`)
        runCheck()
      } catch {
        toast.error('Could not log that — try again')
      }
    })
  }

  function handleDelete(id: string, mins: number) {
    setBusyId(id)
    startTransition(async () => {
      try {
        const res = await deleteWorklogEntry({ id })
        if (!res.ok) toast.error(res.error)
        else {
          toast.success(`Removed ${formatHours(mins)}h`)
          // Removing an entry can RESOLVE an observation as easily as create
          // one — the duplicate that was flagged is gone — so the check has to
          // re-run on delete too, not only on add.
          runCheck()
        }
      } catch {
        toast.error('Could not remove that — try again')
      } finally {
        setBusyId(null)
      }
    })
  }

  return (
    <section
      aria-label="Hours logged"
      className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold">Where the time went</h3>
        {canEdit && aiDraftEnabled && !externallyDriven ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={drafting || pending}
            onClick={handleDraft}
          >
            {drafting ? (
              <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <SparklesIcon className="text-primary" aria-hidden />
            )}
            {drafting ? 'Reading your day…' : 'Fill from my day'}
          </Button>
        ) : null}
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {/* Logged over scheduled, never a percentage: this is coverage, and a
              percent here would read as a sibling of the self-score above it,
              which measures something else entirely. */}
          {formatHours(logged)}h logged
          {scheduledMinutes ? ` of ${formatHours(scheduledMinutes)}h scheduled` : ''}
        </p>
      </header>

      {/* The same coverage as a bar. Rendered only when there IS a
          denominator — accountedFraction returns null for a day nothing was
          scheduled on, and a 0% bar there would read as "logged nothing"
          rather than "nothing was owed".

          The fill is capped at 100% while the LABEL is not: an eleven-hour day
          against eight scheduled is a real thing that happened, and a bar that
          silently clipped it would hide exactly the day worth noticing. */}
      {accounted !== null ? (
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(accounted * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Hours accounted for against hours scheduled"
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-(--dur-base) ease-out motion-reduce:transition-none',
                accounted >= 1 ? 'bg-primary' : 'bg-chart-1',
              )}
              style={{ width: `${Math.min(accounted * 100, 100)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-2xs tabular-nums text-muted-foreground">
            {Math.round(accounted * 100)}%
          </span>
        </div>
      ) : null}

      {/* What the cross-check noticed. EMPTY IS THE COMMON CASE and renders as
          nothing at all — a quiet check reads as success, and a panel saying
          "no problems found" would turn every ordinary day into a report. */}
      {openObservations.length > 0 ? (
        <ul aria-label="What LogPup noticed about this day" className="flex flex-col gap-1.5">
          {openObservations.map((observation) => {
            const key = observationKey(observation)
            return (
              <li
                key={key}
                className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/40 p-2.5"
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                    observation.severity === 'question' ? 'bg-chart-1' : 'bg-muted-foreground/60',
                  )}
                />
                <p className="flex-1 text-xs text-foreground">
                  {/* Severity is carried by the word as well as the dot —
                      never hue alone (WCAG 1.4.1). */}
                  <span className="sr-only">
                    {observation.severity === 'question' ? 'Worth a look: ' : 'Note: '}
                  </span>
                  {observation.message}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label="Dismiss this note"
                  onClick={() =>
                    setChecked((prev) => ({
                      ...prev,
                      hidden: new Set(prev.hidden).add(key),
                    }))
                  }
                >
                  <X aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {sourceDrafts && visibleCount > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-primary/30 bg-primary/5 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-2xs font-medium text-primary">
              <SparklesIcon className="size-3" aria-hidden />
              Suggested from {evidenceCount} recorded {evidenceCount === 1 ? 'thing' : 'things'}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={dismissAll}
              disabled={pending}
            >
              Dismiss all
            </Button>
          </div>
          {/* Reviewed one at a time, on purpose. An "accept all" on HOURS is a
              button that files a timesheet nobody read — and the model is
              inferring durations from meetings and activity, which is exactly
              where it is most likely to be plausibly wrong. */}
          <ul className="flex flex-col gap-1">
            {sourceDrafts.map((entry, index) =>
              dismissed.has(index) ? null : (
              <li
                key={`${entry.category}-${entry.minutes}-${index}`}
                className="flex items-start gap-2 rounded-lg bg-background/60 px-2.5 py-2"
              >
                <span className="w-14 shrink-0 font-mono text-xs font-semibold tabular-nums">
                  {formatHours(entry.minutes)}h
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-xs font-medium">
                    {CATEGORY_LABEL[entry.category]}
                  </span>
                  {entry.note ? (
                    <span className="truncate text-2xs text-muted-foreground">{entry.note}</span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Log ${formatHours(entry.minutes)} hours of ${CATEGORY_LABEL[entry.category]}`}
                  disabled={pending}
                  onClick={() => acceptDraft(entry, index)}
                >
                  <Check aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Dismiss this suggestion"
                  disabled={pending}
                  onClick={() => dismissAt(index)}
                >
                  <X aria-hidden />
                </Button>
              </li>
              ),
            )}
          </ul>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          title="No hours on this day yet"
          description="Add where the time went — a task, a meeting, review, support. Separate from the score above, which is about your plan."
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2"
            >
              <span className="w-14 shrink-0 font-mono text-xs font-semibold tabular-nums">
                {formatHours(entry.minutes)}h
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-xs font-medium">
                  {entry.taskTitle ?? CATEGORY_LABEL[entry.category]}
                </span>
                <span className="truncate text-2xs text-muted-foreground">
                  {[
                    entry.taskTitle ? CATEGORY_LABEL[entry.category] : null,
                    entry.appName,
                    entry.billable ? 'Billable' : null,
                    entry.note,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${formatHours(entry.minutes)} hours`}
                  disabled={pending}
                  onClick={() => handleDelete(entry.id, entry.minutes)}
                >
                  {busyId === entry.id ? (
                    <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <Trash2 aria-hidden />
                  )}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="entry-duration" className="text-xs">
                Hours
              </Label>
              <Input
                id="entry-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
                placeholder="1.5"
                inputMode="decimal"
                aria-describedby="entry-duration-hint"
                className="w-24"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="entry-category" className="text-xs">
                Kind
              </Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as EntryCategory)}
              >
                <SelectTrigger id="entry-category" size="sm" className="w-32">
                  {/* Function child, NOT a bare <SelectValue />. Base UI renders
                      String(value) without one, so the closed trigger showed
                      "task" rather than "Task" — and for the project select
                      below it showed the raw "__none__" sentinel. This repo
                      has now hit that default four times. */}
                  <SelectValue>
                    {(value: string) =>
                      CATEGORY_LABEL[value as EntryCategory] ?? 'Kind'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* A task entry names a TASK; every other kind names a project.
                Never both, and never the wrong one: resolveEntryAppId derives
                a task entry's project FROM the task and ignores whatever appId
                the client sent, so the Project select that used to sit here on
                task entries was a control whose answer was thrown away. */}
            {isTask ? (
              <div className="flex min-w-0 flex-col gap-1">
                <Label htmlFor="entry-task" className="text-xs">
                  Task
                </Label>
                <SearchSelect
                  id="entry-task"
                  size="sm"
                  value={taskId}
                  onValueChange={setTaskId}
                  options={taskOptions}
                  placeholder={tasks.length === 0 ? 'No tasks assigned' : 'Pick a task'}
                  searchPlaceholder="Type a task or project…"
                  emptyText="No task matches that."
                  disabled={tasks.length === 0}
                  aria-describedby="entry-duration-hint"
                  className="w-56"
                />
              </div>
            ) : apps.length > 0 ? (
              <div className="flex min-w-0 flex-col gap-1">
                <Label htmlFor="entry-app" className="text-xs">
                  Project
                </Label>
                <Select
                  value={appId}
                  onValueChange={(value) => setAppId(value ?? NO_APP)}
                >
                  <SelectTrigger id="entry-app" size="sm" className="w-40">
                    <SelectValue>
                      {(value: string) =>
                        value === NO_APP
                          ? 'No project'
                          : (apps.find((a) => a.id === value)?.name ?? 'No project')
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_APP}>No project</SelectItem>
                    {apps.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Button type="button" size="sm" disabled={!canSubmit} onClick={handleAdd}>
              {pending ? (
                <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <Plus aria-hidden />
              )}
              Add
            </Button>
          </div>

          <Input
            aria-label="What was it"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was it? (optional)"
            className="text-xs"
          />

          {/* THE HINT SAYS WHAT IS ACTUALLY STOPPING THE ADD, in the server's
              own words, and only once something is half-typed. Silent until
              then, because "Pick the task that time went to" on an untouched
              form is a complaint about a mistake nobody has made yet — and
              that sentence used to arrive from the server AFTER the click,
              naming a control this card did not have. */}
          {problem && (duration.trim() !== '' || taskId !== '') ? (
            <p id="entry-duration-hint" className="text-2xs text-amber-600 dark:text-amber-400">
              {problem}
            </p>
          ) : (
            <p id="entry-duration-hint" className="text-2xs text-muted-foreground">
              &ldquo;1.5&rdquo;, &ldquo;90m&rdquo; and &ldquo;1h30&rdquo; all mean the same thing.
              A bare number is hours.
              {isTask && tasks.length === 0
                ? ' You have no tasks assigned — log this as a meeting, review or admin instead.'
                : ''}
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}
