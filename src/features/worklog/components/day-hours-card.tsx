'use client'

import * as React from 'react'
import { Check, Loader2Icon, Pencil, Plus, SparklesIcon, Trash2, X } from 'lucide-react'
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
import { SearchSelect } from '@/components/ui/search-select'
import {
  ENTRY_CATEGORIES,
  accountedFraction,
  formatHours,
  totalMinutes,
  type EntryCategory,
} from '@/features/worklog/entries'
import type { Observation } from '@/features/worklog/entry-check'
import {
  buildEntryPayload,
  entryFormProblem,
  type EntryFormFields,
} from '@/features/worklog/entry-form'
import {
  CATEGORY_LABEL,
  EntryGrammarHelp,
} from '@/features/worklog/components/entry-grammar-help'
// The duration grammar lives beside the sentence reader in
// entry-language.ts, not here: this box and that sentence had already
// drifted — "90m" parsed in one and returned null in the other — and one
// grammar cannot disagree with itself. Re-exported so existing importers
// are unaffected.
import {
  parseDuration,
  parseEntryLine,
} from '@/features/worklog/entry-language'
export { parseDuration }
import {
  createWorklogEntry,
  deleteWorklogEntry,
  updateWorklogEntry,
} from '@/features/worklog/entry-actions'
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


const NO_APP = '__none__'

/** Generated once from the parser's own tables — see entry-language.ts. */

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
 * A saved row's minutes as text the duration box can hold WITHOUT changing it.
 *
 * `formatHours` rounds to one decimal for display and `parseDuration` reads
 * that back as a different number: 100 minutes renders "1.7" and would save as
 * 102. Somebody who opened a row only to fix a typo in the note would have
 * their hours moved by the act of looking at them — the exact silent
 * corruption an editor exists to prevent. Durations that survive the round
 * trip stay in the friendly unit; the rest are seeded in minutes, which
 * always does.
 */
function editableDuration(minutes: number): string {
  const asHours = formatHours(minutes)
  return parseDuration(asHours) === minutes ? asHours : `${minutes}m`
}

/**
 * A saved row as the add-form's field shape, with the two values the inline
 * editor may change substituted in.
 *
 * KIND, TASK AND PROJECT ARE PASSED THROUGH UNCHANGED. `updateWorklogEntry`
 * takes the whole mutable body rather than a patch — deliberately, so a
 * half-update cannot leave a 'meeting' row carrying a stale task — which means
 * they still have to be sent, and sending the row's own values is what keeps
 * the category/task rule true of the row after the edit.
 *
 * Going through the same `EntryFormFields` the add form uses is what stops the
 * two forms from disagreeing: one `entryFormProblem`, one `buildEntryPayload`,
 * so a correction is refused for the same reason and in the same words an add
 * would be.
 */
type EditDraft = {
  id: string
  duration: string
  note: string
  /** Absent until the person changes it — the row's own value until then. */
  category?: EntryCategory
  appId?: string | null
}

/**
 * The body an edit will send.
 *
 * KIND AND PROJECT ARE EDITABLE; TASK IS NOT. Fixing "meeting" that should
 * have been "review", or a project the sentence read wrong, is the ordinary
 * correction — and before this the only way to make it was to delete the row
 * and retype it. Converting a row to or from a TASK entry is deliberately not
 * offered: the server derives a task row's project from the task, the guard
 * that runs first still demands one, and LoggableTask does not carry an appId
 * for the client to supply. Guessing it would mis-attribute hours, which is
 * the one thing this column must never do.
 */
function rowFields(entry: WorklogEntryRow, draft: EditDraft): EntryFormFields {
  return {
    minutes: parseDuration(draft.duration),
    category: draft.category ?? entry.category,
    taskId: entry.taskId,
    appId: draft.appId === undefined ? entry.appId : draft.appId,
    note: draft.note,
  }
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
  outerFill = false,
  showGrammarHelp = true,
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
  /**
   * Whether an OUTER control owns filling this day.
   *
   * Stated explicitly rather than inferred from `suggestions !== null`, which
   * is what it used to be — and `suggestions` is null until the first draft
   * comes back, so on every fresh render the card believed nobody was driving
   * it and rendered its own "Fill from my day" beside the panel's "Fill my
   * day". Two AI buttons doing overlapping work on one screen, which is the
   * exact thing day-panel.tsx's header says this arrangement removed.
   *
   * It cannot be fixed by passing `[]` instead of null: the dismissal reset
   * compares `suggestions` by identity, and a fresh array each render would
   * set state during render forever.
   */
  outerFill?: boolean
  /**
   * Whether to render "What it understands" here.
   *
   * Defaults TRUE so this card carries its own help wherever it stands alone.
   * The day panel passes false while the one-line box above it is showing the
   * same block — the same reason it suppresses this card's own draft button.
   */
  showGrammarHelp?: boolean
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
  /**
   * THE WHOLE ENTRY, AS ONE SENTENCE. "2h reviewed the feeder model for CEB"
   * carries the duration, the kind, the project and the note — the four things
   * four separate controls used to ask for, under a note field that had
   * already asked what you did.
   */
  const [line, setLine] = React.useState('')
  /**
   * Which fields the person corrected by hand in Adjust.
   *
   * Without this, re-parsing on the next keystroke would silently undo their
   * correction — they pick "Review", type one more word, and the sentence puts
   * "Meeting" back. Cleared whenever the line is rewritten, because a new
   * sentence is a new statement and should be read afresh.
   */
  const [touched, setTouched] = React.useState<Set<'category' | 'app' | 'task'>>(new Set())
  const [showAdjust, setShowAdjust] = React.useState(false)
  // Opens on the kind this person can actually submit. 'task' is the right
  // default for almost everybody and the wrong one for a lead with nothing
  // assigned to them — for whom the form would open already unsubmittable,
  // which is the shape of the bug this card just had.
  const [category, setCategory] = React.useState<EntryCategory>(
    tasks.length > 0 ? 'task' : 'meeting',
  )
  const [appId, setAppId] = React.useState<string>(NO_APP)
  const [taskId, setTaskId] = React.useState<string>('')
  const [busyId, setBusyId] = React.useState<string | null>(null)
  /*
   * The row being corrected, and the draft in its two boxes.
   *
   * ONE ROW AT A TIME. A second open editor would need a second busy flag and
   * a second problem line, and nobody corrects two rows at once — but the
   * bigger reason is that the draft is UNSAVED: two of them on screen is two
   * ways to lose work by clicking somewhere else.
   *
   * Held here rather than in the row, because cancelling has to restore the
   * SERVER's values, and the only way to be sure of that is never to have
   * written the draft anywhere the row reads from.
   */
  const [editing, setEditing] = React.useState<EditDraft | null>(null)
  /*
   * The row whose edit button should take focus back once it returns to the
   * DOM. Closing the editor UNMOUNTS the button that opened it, so focus would
   * otherwise fall to <body> and a keyboard user would restart from the top of
   * the page. Applied as a ref below rather than from an effect: there is
   * nothing to focus until the commit that re-renders the button, and setting
   * state from an effect to arrange that is the cascade the lint rule forbids.
   */
  const [returnFocusTo, setReturnFocusTo] = React.useState<string | null>(null)

  /*
   * STABLE IDENTITIES, so React attaches each ref exactly once — on mount —
   * instead of detaching and re-running it on every render. An inline arrow
   * here would re-focus and re-select the duration box on every keystroke,
   * which is a field you cannot type in.
   */
  const focusEditField = React.useCallback((node: HTMLInputElement | null) => {
    if (!node) return
    node.focus()
    // Selected, not merely focused: the correction this exists for is
    // retyping a whole duration — 90 that should have been 190.
    node.select()
  }, [])
  const focusReturnedTrigger = React.useCallback((node: HTMLButtonElement | null) => {
    node?.focus()
  }, [])
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
  const externallyDriven = outerFill
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
  // The sentence is read on every keystroke; a hand-correction in Adjust wins
  // over what it understood, for that field only.
  const parsed = parseEntryLine(line, {
    apps: apps.map((app) => ({ id: app.id, name: app.name })),
    tasks: tasks.map((task) => ({ id: task.id, name: task.title })),
  })
  const effCategory = touched.has('category') ? category : parsed.category
  const effTaskId = touched.has('task') ? taskId : (parsed.taskId ?? '')
  const effAppId = touched.has('app') ? appId : (parsed.appId ?? NO_APP)
  const isTask = effCategory === 'task'

  // ONE description of the form's state, shared by the payload, the disabled
  // button and the hint under it — so the reason Add is unavailable is always
  // the reason the server would have given, in the same words.
  const formFields = {
    minutes: parsed.minutes,
    category: effCategory,
    taskId: effTaskId || null,
    appId: effAppId === NO_APP ? null : effAppId,
    note: parsed.note,
  }
  const problem = entryFormProblem(formFields)
  const canSubmit = problem === null && !pending

  function rewriteLine(next: string) {
    setLine(next)
    setTouched(new Set())
  }

  function override(field: 'category' | 'app' | 'task') {
    setTouched((prev) => new Set(prev).add(field))
  }

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
        rewriteLine('')
        setShowAdjust(false)
        toast.success(`Logged ${formatHours(payload.minutes)}h`)
        runCheck()
      } catch {
        toast.error('Could not log that — try again')
      }
    })
  }

  function startEdit(entry: WorklogEntryRow) {
    setEditing({
      id: entry.id,
      duration: editableDuration(entry.minutes),
      note: entry.note ?? '',
    })
  }

  function cancelEdit(id: string) {
    setEditing(null)
    setReturnFocusTo(id)
  }

  function handleSaveEdit(
    entry: WorklogEntryRow,
    fields: EntryFormFields,
    problem: string | null,
  ) {
    const payload = buildEntryPayload(fields)
    if (!payload || problem) {
      toast.error(problem ?? 'Enter a time — "1.5", "90m" and "1h30" all work')
      return
    }
    setBusyId(entry.id)
    startTransition(async () => {
      try {
        const res = await updateWorklogEntry({
          id: entry.id,
          ...payload,
          /*
           * THE ROW'S OWN PROJECT, ON A TASK ROW TOO.
           *
           * `buildEntryPayload` nulls appId for task entries because
           * `resolveEntryAppId` re-derives it from the task and throws the
           * client's answer away. But the action validates the WHOLE BODY
           * with `requireAppForTask: true` BEFORE that derivation runs, so a
           * task entry that arrives without a project is refused with "That
           * task is not linked to a project" and never reaches the code that
           * would have supplied one.
           *
           * What is sent here is the project the row already carries, which
           * the server derived from this same task when the row was written —
           * so it satisfies the guard without the client deciding anything,
           * and the derivation overwrites it with the same value.
           */
          appId: fields.category === 'task' ? entry.appId : fields.appId,
          // Carried through explicitly. The action reads `billable ?? false`
          // over the WHOLE body, so leaving it out would quietly un-bill an
          // entry somebody had opened only to fix a typo in the note.
          billable: entry.billable,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setEditing(null)
        setReturnFocusTo(entry.id)
        toast.success(`Updated to ${formatHours(payload.minutes)}h`)
        // A correction changes the day exactly as an add does — a fixed
        // duration can resolve an observation as easily as raise one — so the
        // cross-check has to re-run here too, not only on add and delete.
        runCheck()
      } catch {
        toast.error('Could not save that — try again')
      } finally {
        setBusyId(null)
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
        /* ONE LINE, not an illustrated empty state. Nothing is broken and
           nothing needs explaining — the add row is directly below and its
           own labels already say what goes in it. A full EmptyState block
           here pushed that row off the fold on a laptop, so the control that
           answers the emptiness was hidden by the notice about it. */
        <p className="px-0.5 py-1 text-2xs text-muted-foreground">
          No hours on this day yet — add them below. Separate from the score, which is about
          your plan.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((entry) => {
            // Narrowed through `editing &&` rather than `editing?.id`, so the
            // draft is non-null inside the branch without a second assertion.
            const draft = editing && editing.id === entry.id ? editing : null
            const label = entry.taskTitle ?? CATEGORY_LABEL[entry.category]
            const fields = draft ? rowFields(entry, draft) : null
            const editProblem = fields ? entryFormProblem(fields) : null
            /*
             * NO EDIT CONTROL ON A ROW THE SAVE PATH WOULD REFUSE. Two ways
             * that happens, and both leave a row that legitimately belongs in
             * the table:
             *
             *  - a 'task' entry whose task was purged. `task_id` is ON DELETE
             *    SET NULL and entries.ts keeps such a row deliberately — the
             *    hours were still worked — but the category/task rule then
             *    refuses the whole body.
             *  - a 'task' entry carrying no project. The action checks that
             *    BEFORE it derives one from the task (see the payload above),
             *    and `entryFormProblem` cannot see the difference: it passes
             *    `requireAppForTask: false`, which is right for the add form
             *    and is not what this action actually checks.
             *
             * Either way an editor there would open a form whose Save can
             * never light up, which reads as broken rather than as a refusal.
             */
            const correctable =
              entryFormProblem(
                rowFields(entry, {
                  id: entry.id,
                  duration: editableDuration(entry.minutes),
                  note: entry.note ?? '',
                }),
              ) === null
              && (entry.category !== 'task' || entry.appId !== null)

            function onEditKey(event: React.KeyboardEvent<HTMLInputElement>) {
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelEdit(entry.id)
                return
              }
              if (event.key === 'Enter' && fields && editProblem === null && !pending) {
                event.preventDefault()
                handleSaveEdit(entry, fields, editProblem)
              }
            }

            return (
              <li
                key={entry.id}
                className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2"
              >
                {draft && fields ? (
                  <div className="flex min-w-0 w-full flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Input
                        ref={focusEditField}
                        value={draft.duration}
                        onChange={(e) => setEditing({ ...draft, duration: e.target.value })}
                        onKeyDown={onEditKey}
                        aria-label={`Hours for ${label}`}
                        aria-invalid={editProblem !== null}
                        aria-describedby={`entry-edit-hint-${entry.id}`}
                        inputMode="decimal"
                        className="h-7 w-20 text-xs"
                      />
                      {/* A TASK ROW'S KIND IS FIXED. Everything else is a
                          correction somebody makes constantly, and used to
                          cost a delete and a retype. */}
                      {entry.category !== 'task' ? (
                        <Select
                          value={fields.category}
                          onValueChange={(value) =>
                            setEditing({ ...draft, category: value as EntryCategory })
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            aria-label={`Kind for ${label}`}
                            className="h-7 w-28 text-xs"
                          >
                            <SelectValue>
                              {(value: string) => CATEGORY_LABEL[value as EntryCategory] ?? 'Kind'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {ENTRY_CATEGORIES.filter((c) => c !== 'task').map((c) => (
                              <SelectItem key={c} value={c}>
                                {CATEGORY_LABEL[c]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                      {entry.category !== 'task' && apps.length > 0 ? (
                        <Select
                          value={fields.appId ?? NO_APP}
                          onValueChange={(value) =>
                            setEditing({ ...draft, appId: value === NO_APP ? null : value })
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            aria-label={`Project for ${label}`}
                            className="h-7 w-32 text-xs"
                          >
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
                      ) : null}
                      <Input
                        value={draft.note}
                        onChange={(e) => setEditing({ ...draft, note: e.target.value })}
                        onKeyDown={onEditKey}
                        aria-label={`Note for ${label}`}
                        aria-describedby={`entry-edit-hint-${entry.id}`}
                        placeholder="What was it? (optional)"
                        className="h-7 min-w-32 flex-1 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Save ${label}`}
                        disabled={pending || editProblem !== null}
                        onClick={() => handleSaveEdit(entry, fields, editProblem)}
                      >
                        {busyId === entry.id ? (
                          <Loader2Icon
                            className="animate-spin motion-reduce:animate-none"
                            aria-hidden
                          />
                        ) : (
                          <Check aria-hidden />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Cancel editing ${label}`}
                        disabled={pending}
                        onClick={() => cancelEdit(entry.id)}
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                    {/* The hint the two boxes point at. It says what is
                        stopping the save in the server's own words when
                        something is wrong, and the two keys otherwise — one
                        element either way, so the description an assistive
                        reader announced does not disappear mid-edit. */}
                    <p
                      id={`entry-edit-hint-${entry.id}`}
                      className={cn(
                        'text-2xs',
                        editProblem
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      {editProblem ?? 'Enter saves, Escape cancels.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <span className="w-14 shrink-0 font-mono text-xs font-semibold tabular-nums">
                      {formatHours(entry.minutes)}h
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-xs font-medium">{label}</span>
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
                    {canEdit && correctable ? (
                      <Button
                        // Focus comes back HERE when the editor closes, and
                        // only for the row that was just closed — the ref is
                        // attached to one button at a time, so no other row
                        // can steal the caret on an unrelated re-render.
                        ref={returnFocusTo === entry.id ? focusReturnedTrigger : undefined}
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        // Named by its hours AND its work, because a screen
                        // reader lists these buttons out of context and "Edit"
                        // seven times over says nothing about which row.
                        aria-label={`Edit ${formatHours(entry.minutes)} hours of ${label}`}
                        disabled={pending}
                        onClick={() => startEdit(entry)}
                      >
                        <Pencil aria-hidden />
                      </Button>
                    ) : null}
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
                          <Loader2Icon
                            className="animate-spin motion-reduce:animate-none"
                            aria-hidden
                          />
                        ) : (
                          <Trash2 aria-hidden />
                        )}
                      </Button>
                    ) : null}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canEdit ? (
        <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
          {/* ONE BOX. The duration, the kind, the project and the note used to
              be four controls sitting under a note field that had already
              asked what you did — and in a workspace with zero hour entries
              ever recorded, that was the cost of the first one. The sentence
              is read live and what it understood is shown BELOW rather than
              written into controls, so nothing is silently decided: the person
              sees "2h · Review · SCADA" before they commit, and Adjust is
              there when the reading is wrong. */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="entry-line"
              value={line}
              onChange={(e) => rewriteLine(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) {
                  e.preventDefault()
                  handleAdd()
                }
              }}
              placeholder="2h reviewed the feeder model for SCADA"
              aria-label="What you did, with how long it took"
              aria-describedby="entry-line-hint"
              className="min-w-56 flex-1 text-xs"
            />
            <Button type="button" size="sm" disabled={!canSubmit} onClick={handleAdd}>
              {pending ? (
                <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <Plus aria-hidden />
              )}
              Add
            </Button>
          </div>

          {/* WHAT IT UNDERSTOOD, before anything is written. A parser that
              acts without showing its reading is a parser people stop
              trusting the first time it is wrong. */}
          {line.trim() !== '' ? (
            <div className="flex flex-wrap items-center gap-1.5 text-2xs">
              {parsed.minutes !== null ? (
                <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono font-semibold text-primary">
                  {formatHours(parsed.minutes)}h
                </span>
              ) : (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono font-semibold text-amber-600 dark:text-amber-400">
                  no time yet
                </span>
              )}
              <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                {CATEGORY_LABEL[effCategory]}
              </span>
              {effTaskId ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {tasks.find((task) => task.id === effTaskId)?.title ?? 'Task'}
                </span>
              ) : effAppId !== NO_APP ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {apps.find((app) => app.id === effAppId)?.name ?? 'Project'}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setShowAdjust((open) => !open)}
                aria-expanded={showAdjust}
                className="rounded px-1.5 py-0.5 font-medium text-primary hover:underline cursor-pointer"
              >
                {showAdjust ? 'Done adjusting' : 'Adjust'}
              </button>
            </div>
          ) : null}

          {/* Every field still reachable — just not occupying the screen until
              the reading is actually wrong. */}
          {showAdjust ? (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/50 bg-background/40 p-2.5">
              <div className="flex min-w-0 flex-col gap-1">
                <Label htmlFor="entry-category" className="text-xs">
                  Kind
                </Label>
                <Select
                  value={effCategory}
                  onValueChange={(value) => {
                    override('category')
                    setCategory(value as EntryCategory)
                  }}
                >
                  <SelectTrigger id="entry-category" size="sm" className="w-32">
                    {/* Function child, NOT a bare <SelectValue />. Base UI
                        renders String(value) without one — the closed trigger
                        showed "task" and the raw "__none__" sentinel. */}
                    <SelectValue>
                      {(value: string) => CATEGORY_LABEL[value as EntryCategory] ?? 'Kind'}
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

              {isTask ? (
                <div className="flex min-w-0 flex-col gap-1">
                  <Label htmlFor="entry-task" className="text-xs">
                    Task
                  </Label>
                  <SearchSelect
                    id="entry-task"
                    size="sm"
                    value={effTaskId}
                    onValueChange={(value) => {
                      override('task')
                      setTaskId(value)
                    }}
                    options={taskOptions}
                    placeholder={tasks.length === 0 ? 'No tasks assigned' : 'Pick a task'}
                    searchPlaceholder="Type a task or project…"
                    emptyText="No task matches that."
                    disabled={tasks.length === 0}
                    className="w-56"
                  />
                </div>
              ) : apps.length > 0 ? (
                <div className="flex min-w-0 flex-col gap-1">
                  <Label htmlFor="entry-app" className="text-xs">
                    Project
                  </Label>
                  <Select
                    value={effAppId}
                    onValueChange={(value) => {
                      override('app')
                      setAppId(value ?? NO_APP)
                    }}
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
            </div>
          ) : null}

          {problem && line.trim() !== '' ? (
            <p id="entry-line-hint" className="text-2xs text-amber-600 dark:text-amber-400">
              {problem}
            </p>
          ) : (
            <p id="entry-line-hint" className="text-2xs text-muted-foreground">
              Write it how you would say it — &ldquo;2h reviewed the feeder model for SCADA&rdquo;.
              {isTask && tasks.length === 0
                ? ' You have no tasks assigned — say meeting, review or admin instead.'
                : ''}
            </p>
          )}

          {/* SUPPRESSED WHEN THE ONE-LINE BOX IS SHOWING ONE. Both used to
              render this, and the day panel renders both — so the same eight
              lines of grammar appeared twice on one screen. Same rule the
              panel already applies to the AI draft button. */}
          {showGrammarHelp ? <EntryGrammarHelp /> : null}
        </div>
      ) : null}
    </section>
  )
}
