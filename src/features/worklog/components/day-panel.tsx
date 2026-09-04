'use client'

import * as React from 'react'
import { Loader2Icon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DayHoursCard } from '@/features/worklog/components/day-hours-card'
import {
  meterOrigin,
  useAiMeter,
  type MeterOriginSource,
} from '@/features/gemini/components/ai-meter-provider'
import { draftWorklogEntries, type DraftedEntry } from '@/features/worklog/entry-ai-actions'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  resetDayScoreToHours,
  setDayNote,
  upsertDailyWorklog,
} from '@/features/worklog/actions'
import { glanceAtDay } from '@/features/worklog/day-summary'
import type { ScoreSource } from '@/features/worklog/auto-score'
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
  scoreSource,
  entries,
  scheduledMinutes,
  assignedApps,
  otherApps = [],
  tasks,
  canEdit,
  entriesAiEnabled,
}: {
  day: string
  initial: { percent: number; note: string | null } | null
  /**
   * Who said the score. 'from_hours' earns a chip beside it — a number derived
   * by division must never render identically to one the person typed.
   * Defaults to 'self' so a day with no row at all is never mislabelled.
   */
  scoreSource?: ScoreSource
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
  /**
   * Whether the NOTE drafter is switched on for this person.
   *
   * Deliberately unread here. It stays in the signature because the pref is
   * per-feature and the page passes both, and because a future surface in this
   * panel may want it — but the note box lives in the log box at the top of the
   * page now, so drafting prose from here would have nowhere to put it.
   */
  noteAiEnabled?: boolean
  entriesAiEnabled: boolean
}) {
  const [filling, setFilling] = React.useState(false)
  const [entryDrafts, setEntryDrafts] = React.useState<DraftedEntry[] | null>(null)
  const [evidence, setEvidence] = React.useState(0)

  /* HOURS ONLY, now that the note form has left this panel.
     "Fill my day" used to draft the note and the hours together, because both
     landed here. The note box is in the log box at the top of the page, so
     drafting prose from here would produce a paragraph with nowhere to go — and
     would spend somebody's Gemini quota to do it. `noteAiEnabled` still arrives
     as a prop and is deliberately not consulted: the note drafter is reached
     from the box that owns notes. */
  const anyAi = entriesAiEnabled
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
      // ONE call now, and one meter. This used to run the note drafter beside
      // the hours drafter because both landed in this panel; the note box has
      // moved to the log box at the top of the page, so drafting prose here
      // would spend a request producing a paragraph with nowhere to put it.
      const entryRes = await meter.track('worklog-entries-draft', origin, () =>
        draftWorklogEntries(day),
      )

      if (!entryRes.ok) {
        toast.error(entryRes.error)
        return
      }

      setEntryDrafts(entryRes.data.entries)
      setEvidence(entryRes.data.evidenceCount)

      // Say what actually happened rather than "Done". An empty day is a quiet
      // day, not a failure, and somebody who sees nothing appear needs to know
      // which of the two it was.
      const filledRows = entryRes.data.entries.length
      if (filledRows === 0) {
        toast.info('LogPup recorded nothing for that day — nothing to suggest.')
      } else {
        toast.success(
          `Suggested ${filledRows} ${filledRows === 1 ? 'entry' : 'entries'} — review before saving.`,
        )
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
          <h2 className="font-heading text-sm font-semibold">This day in detail</h2>
          <p className="text-2xs text-muted-foreground">
            What is already recorded, and the controls to correct it.
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

      {/* THE FACTS, IN FRONT, ALWAYS.
          The one-line field moved out of this panel to the log box at the top
          of the page, and what was left behind was a header, a button and a
          collapsed <details> — a card that rendered as an empty box beside a
          full calendar. The collapse earned its place while the fast path sat
          directly above it; with the fast path gone it was hiding the only
          content this panel has.

          So the day's numbers are stated outright and the controls sit under
          them. Somebody coming back to yesterday reads the answer without
          opening anything, which is what the collapsed summary was for — it
          just no longer has to summarise something hidden. */}
      <dl className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
          <dt className="font-mono text-2xs uppercase tracking-wider text-muted-foreground">
            Score
          </dt>
          <dd className="flex flex-wrap items-baseline gap-1.5">
            {glance.percent === null ? (
              <span className="text-xs text-muted-foreground">Not scored</span>
            ) : (
              <>
                <span className="font-mono text-base font-bold tabular-nums text-primary">
                  {glance.percent}%
                </span>
                {/* SAID OUT LOUD WHEN IT WAS DERIVED. A score computed by
                    dividing hours by a scheduled day is not a claim the person
                    made, and rendering it identically to one they typed is the
                    single real harm in auto-scoring. See auto-score.ts. */}
                {scoreSource === 'from_hours' ? (
                  <span
                    className="rounded bg-chart-1/15 px-1.5 py-px font-sans text-2xs text-chart-1"
                    title="Worked out from the hours below. Pick a number to say otherwise."
                  >
                    from your hours
                  </span>
                ) : null}
              </>
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
          <dt className="font-mono text-2xs uppercase tracking-wider text-muted-foreground">
            Hours
          </dt>
          <dd className="font-mono text-base font-bold tabular-nums text-foreground">
            {glance.hours ? `${glance.hours}h` : <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
          <dt className="font-mono text-2xs uppercase tracking-wider text-muted-foreground">
            Entries
          </dt>
          <dd className="font-mono text-base font-bold tabular-nums text-foreground">
            {glance.entryCount > 0 ? (
              glance.entryCount
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
      </dl>

      {/* THE SCORE, EDITABLE — the last thing this panel could not correct.
          Removing the old form took the note AND the score with it, and only
          the note came back. A day is three facts and the panel says it holds
          "the controls to correct" them, so leaving one of the three read-only
          made that sentence false. Four pills rather than a slider: those are
          the values the rest of the product offers, and a slider invites a
          precision nobody means. */}
      {canEdit ? (
        <DayScoreEditor
          day={day}
          percent={initial?.percent ?? null}
          scoreSource={scoreSource ?? 'self'}
          note={initial?.note ?? null}
          hasHours={entries.length > 0}
        />
      ) : null}

      {/* THE NOTE, EDITABLE. Removing the old score-and-note form from this
          panel took the ONLY place a day's note could be written or corrected
          with it — and a day scored from its hours arrives with no note at all,
          so every auto-scored day read "No note" with nothing to do about it.
          Just the note: the score belongs to the hours or to the box above, and
          the four preset pills and project chip row that used to sit here were
          the duplication that got removed. */}
      {canEdit && initial !== null ? (
        /* KEYED BY DAY so paging to another day re-seeds the box from that
           day's note. The alternative — an effect calling setState — is a
           cascading render React lints against, and this is the case keys are
           for: a different day is a different note, not the same one changed. */
        <DayNoteEditor key={day} day={day} initialNote={initial.note} />
      ) : glance.snippet ? (
        <p className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-2 text-xs text-muted-foreground">
          {glance.snippet}
        </p>
      ) : null}

      {/* THE SCORE-AND-NOTE FORM IS GONE FROM HERE.
          It was the third place on one screen to write the same two things.
          The log box at the top of the page takes a score, a note, hours and a
          whole week of them in one field; this panel repeated all of it as a
          slider, four preset pills, a project chip row and a textarea, under a
          heading that said the panel was for reading what is already recorded.
          Two of the three even disagreed — this one refused a note without a
          score ("Score the day first"), which stopped being true the moment
          hours started scoring their own day.

          What is left is the half that is genuinely detail and has nowhere else
          to live: the hours, itemised, with the controls to correct them. */}
      <div className="flex flex-col gap-3">
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
    </div>
  )
}

/**
 * One day's note, on its own.
 *
 * WRITES ONE COLUMN. `setDayNote` deliberately says nothing about the score, so
 * correcting the words on a day scored from its hours does not claim that score
 * as the person's own — which `upsertDailyWorklog` would, permanently, and
 * would stop the hours ever updating it again.
 *
 * Only rendered for a day that HAS a record. `daily_worklogs.percent` is NOT
 * NULL, so there is no row for a note to live on until the day has a score or
 * some hours; offering an input that could only fail would be worse than not
 * offering one.
 */
function DayNoteEditor({ day, initialNote }: { day: string; initialNote: string | null }) {
  const [note, setNote] = React.useState(initialNote ?? '')
  const [saving, startSaving] = React.useTransition()

  const dirty = note.trim() !== (initialNote ?? '').trim()

  function save() {
    if (!dirty) return
    startSaving(async () => {
      const res = await setDayNote(day, note.trim() ? note.trim() : null)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Note saved')
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={`day-note-${day}`}
        className="font-mono text-2xs uppercase tracking-wider text-muted-foreground"
      >
        Note
      </label>
      <Textarea
        id={`day-note-${day}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder="One line about the day"
        className="min-h-14 text-xs"
      />
      {dirty ? (
        <Button type="button" size="sm" variant="outline" onClick={save} disabled={saving}>
          {saving ? (
            <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : null}
          Save note
        </Button>
      ) : null}
    </div>
  )
}

/** The four values the rest of the product offers. A slider invites false precision. */
const SCORE_PRESETS = [25, 50, 80, 100] as const

/**
 * One day's score, and the two ways it can be set.
 *
 * PICKING A NUMBER CLAIMS IT. `upsertDailyWorklog` stamps `score_source =
 * 'self'`, so from then on the day keeps that number however many hours are
 * logged against it — which is the point, and also why the way back has to
 * exist beside it rather than in a settings page somewhere.
 *
 * The note is carried through the write UNCHANGED. `upsertDailyWorklog` sets
 * both columns, so scoring a day without passing its existing note would blank
 * words the person wrote — the same trap the one-line box handles by passing
 * `savedNote` through.
 */
function DayScoreEditor({
  day,
  percent,
  scoreSource,
  note,
  hasHours,
}: {
  day: string
  percent: number | null
  scoreSource: ScoreSource
  note: string | null
  hasHours: boolean
}) {
  const [saving, startSaving] = React.useTransition()

  function pick(value: number) {
    startSaving(async () => {
      const res = await upsertDailyWorklog(day, value, note)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Scored ${value}%`)
    })
  }

  function backToHours() {
    startSaving(async () => {
      const res = await resetDayScoreToHours(day)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Scored from your hours again')
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-2xs text-muted-foreground">
        {percent === null ? 'Score this day:' : 'Change it:'}
      </span>
      {SCORE_PRESETS.map((value) => (
        <button
          key={value}
          type="button"
          disabled={saving}
          onClick={() => pick(value)}
          aria-pressed={percent === value && scoreSource === 'self'}
          className={cn(
            'rounded border px-2 py-0.5 font-mono text-2xs cursor-pointer',
            'transition-colors motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-60',
            percent === value && scoreSource === 'self'
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
          )}
        >
          {value}%
        </button>
      ))}
      {/* Only offered where it would DO something: a day already derived has
          nothing to go back to, and a day with no hours has nothing to derive
          from — offering it there would be a button whose only outcome is an
          error message. */}
      {scoreSource === 'self' && hasHours ? (
        <button
          type="button"
          disabled={saving}
          onClick={backToHours}
          className="rounded px-1.5 py-0.5 text-2xs text-muted-foreground underline decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          use my hours instead
        </button>
      ) : null}
      {saving ? (
        <Loader2Icon className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : null}
    </div>
  )
}
