'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CalendarClock, Loader2Icon, Plus, SparklesIcon, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { HelpNote } from '@/components/shared/help-note'
import { cn } from '@/lib/utils'
import { EntryGrammarHelp } from '@/features/worklog/components/entry-grammar-help'
import {
  DeclareAbsenceDialog,
  type FiledAbsence,
} from '@/features/worklog/components/declare-absence-dialog'
import { ABSENCE_KIND_LABELS } from '@/features/worklog/absence-kinds'
import { autoScoreFromHours } from '@/features/worklog/auto-score'
import { scheduledMinutesForFraction } from '@/features/worklog/schedules'
import type { AliasedApp } from '@/features/apps/app-aliases'
import {
  describeLine,
  lineIntent,
  lineSuggestions,
  parseEntryLine,
  type LineToken,
} from '@/features/worklog/entry-language'
import { buildEntryPayload, entryFormProblem } from '@/features/worklog/entry-form'
import { createWorklogEntry } from '@/features/worklog/entry-actions'
import { setDayNote, upsertDailyWorklog } from '@/features/worklog/actions'
import { createAbsence } from '@/features/worklog/absence-actions'
import { readCatchUpText, type CatchUpDayFacts } from '@/features/worklog/catch-up-actions'
import {
  looksLikeSeveralDays,
  summarizeReading,
  type CatchUpDay,
  type CatchUpReading,
} from '@/features/worklog/catch-up-parse'
import {
  meterOrigin,
  useAiMeter,
  type MeterOriginSource,
} from '@/features/gemini/components/ai-meter-provider'
import type { LoggableTask } from '@/features/worklog/entry-queries'

/**
 * ONE BOX FOR THE WHOLE LOG.
 *
 * WHAT THIS REPLACED. Two panels sat on /worklog doing the same job at
 * different scales. "Your day" carried a one-line field for the selected day.
 * "Catch-Up Ledger (5 days unlogged)" carried a row of day chips and, under
 * whichever chip was selected, an entire second copy of the day form — so
 * catching up on five days meant five round trips through a form somebody had
 * already met above, and the two boxes disagreed about which was the place to
 * type. Nobody typed in either; five days went unlogged.
 *
 * The whole of it is now one field. Type one line and the instant reader takes
 * it, exactly as before. Write out your week — dates, nicknames, typos, hours
 * on some things and not others — and LogPup reads it into days and shows you
 * what it heard before anything is written.
 *
 * THE TWO ANSWERS STAY TWO ANSWERS, and this is the design's spine. "I worked"
 * and "I did not owe work" are different statements about a day, written to
 * different tables through different approval paths, and the second one goes to
 * a human. They are the two controls at the top of this card, the same weight,
 * because a person who was on leave and cannot find how to say so ends up
 * logging a day they did not work.
 *
 * NOTHING IS SAVED UNSEEN. The instant reader shows coloured chips of what it
 * heard while you type. The catch-up reader shows a card per day, with every
 * hours row dismissable and the score left blank until the person picks one —
 * a self-score is a judgement about their own day, and no model may put a
 * number in it. Whatever it could not place is listed rather than dropped.
 */

/** One colour per kind of thing, so the reading is scannable, not just legible. */
const TOKEN_CLASS: Record<LineToken['kind'], string> = {
  score: 'bg-primary/15 text-primary',
  time: 'bg-chart-1/15 text-chart-1',
  category: 'bg-tag-discussion/15 text-tag-discussion',
  project: 'bg-event-3/20 text-foreground',
  task: 'bg-event-5/20 text-foreground',
  note: 'bg-muted text-muted-foreground',
}

/** The score presets, in the order somebody reaches for them. */
const SCORE_PRESETS = [100, 80, 50, 25] as const

export type LogBoxGap = {
  day: string
  /** The day's owed fraction from coverage — 0.5 names a half Saturday. */
  fraction: number
  /** Hours are already recorded but the day has no score, so it is still owed. */
  hasHours?: boolean
}

/** A proposed day, plus what the person has done to it in the review panel. */
type ReviewDay = CatchUpDay & {
  /** Whether the proposed leave filing is still wanted. */
  keepAbsence: boolean
  /** Saved, so a second press of "Save all" cannot double-file it. */
  done: boolean
}

export function LogBox({
  day,
  apps,
  suggestFrom,
  tasks,
  savedNote,
  scored,
  gaps,
  filed,
  owedDays,
  knownFrom,
  knownTo,
  canDeclare,
  catchUpAiEnabled,
}: {
  /** The selected day — what a one-line entry with no date is about. */
  day: string
  /** Projects, with the nicknames they answer to — see app-aliases.ts. */
  apps: AliasedApp[]
  /**
   * Apps the suggestion chips may PROMOTE — defaults to `apps`. The parser
   * matches the full list either way, so any project is reachable by typing its
   * name; this only narrows the one-tap chips, because a person with one
   * assignment should not meet three alphabetically-first guest projects styled
   * exactly like their own.
   */
  suggestFrom?: AliasedApp[]
  tasks: LoggableTask[]
  /** The day's existing note, so a score-only line does not erase it. */
  savedNote: string | null
  /** Whether the day already carries a score — changes what the button says. */
  scored: boolean
  /** Earlier days with nothing filed, oldest first. */
  gaps: LogBoxGap[]
  /** Pending and approved absences, for the dialog's clash naming. */
  filed: FiledAbsence[]
  /** Days in the known window with fraction > 0 — see DeclareAbsenceDialog. */
  owedDays: string[]
  knownFrom: string
  knownTo: string
  canDeclare: boolean
  catchUpAiEnabled: boolean
}) {
  const router = useRouter()
  const meter = useAiMeter()
  const [text, setText] = React.useState('')
  const [pending, startTransition] = React.useTransition()
  const [reading, setReading] = React.useState<
    (CatchUpReading & { facts: CatchUpDayFacts[] }) | null
  >(null)
  const [review, setReview] = React.useState<ReviewDay[]>([])
  const [busy, setBusy] = React.useState(false)
  const boxRef = React.useRef<HTMLTextAreaElement>(null)

  const appRefs = React.useMemo(
    () => apps.map((a) => ({ id: a.id, name: a.name, aliases: a.aliases })),
    [apps],
  )
  const suggestRefs = React.useMemo(
    () => (suggestFrom ?? apps).map((a) => ({ id: a.id, name: a.name })),
    [suggestFrom, apps],
  )
  const taskRefs = React.useMemo(() => tasks.map((t) => ({ id: t.id, name: t.title })), [tasks])

  // The instant reader runs on every keystroke and costs nothing. It is the
  // right answer for one line and the wrong one for a week, so what it found is
  // only SHOWN while the text still looks like one line.
  const parsed = parseEntryLine(text, { apps: appRefs, tasks: taskRefs })
  const several = looksLikeSeveralDays(text)
  const tokens = several ? [] : describeLine(parsed)
  const intent = lineIntent(parsed)
  const suggestions = several ? [] : lineSuggestions(parsed, suggestRefs)

  const entryProblem = intent.logsHours
    ? entryFormProblem({
        minutes: parsed.minutes,
        category: parsed.category,
        taskId: parsed.taskId,
        appId: parsed.appId,
        note: parsed.note,
      })
    : null

  const canSaveLine =
    !several && !pending && (intent.scores || intent.logsHours) && entryProblem === null
  const canRead = catchUpAiEnabled && text.trim().length > 0 && !busy

  function insert(fragment: string) {
    setText((prev) => (prev.trim() ? `${prev.trim()} ${fragment} ` : `${fragment} `))
    boxRef.current?.focus()
  }

  /** A gap chip seeds the box with that day's date, so the reader has an anchor. */
  function startDay(iso: string) {
    const label = format(new Date(`${iso}T12:00:00`), 'MMM d')
    setText((prev) => {
      const body = prev.trimEnd()
      return body ? `${body}\n${label} - ` : `${label} - `
    })
    boxRef.current?.focus()
  }

  // -------------------------------------------------------------------------
  // The instant path — one line, one day, no model
  // -------------------------------------------------------------------------

  function saveLine() {
    if (!canSaveLine) return
    startTransition(async () => {
      const done: string[] = []
      try {
        // THE SCORE FIRST. If the hours write fails afterwards the day is still
        // scored, which is the half that clears it off the owed list — the
        // reverse order would leave hours recorded against a day the rest of
        // the app still calls unlogged.
        if (intent.scores && parsed.percent !== null) {
          const note = parsed.note || savedNote
          const res = await upsertDailyWorklog(day, parsed.percent, note)
          if (!res.ok) {
            toast.error(res.error)
            return
          }
          done.push(`scored ${parsed.percent}%`)
        }

        if (intent.logsHours) {
          const payload = buildEntryPayload({
            minutes: parsed.minutes,
            category: parsed.category,
            taskId: parsed.taskId,
            appId: parsed.appId,
            note: parsed.note,
          })
          if (payload) {
            const res = await createWorklogEntry({ day, ...payload })
            if (!res.ok) {
              // Said with what DID land, so a partial success is never mistaken
              // for nothing having happened.
              toast.error(done.length ? `${res.error} — the score was saved` : res.error)
              return
            }
            done.push(`logged ${Math.round((payload.minutes / 60) * 10) / 10}h`)
          }
        }

        setText('')
        toast.success(done.join(' · '))
      } catch {
        toast.error('Could not save that — try again')
      }
    })
  }

  // -------------------------------------------------------------------------
  // The catch-up path — several days, read by a model, checked by a person
  // -------------------------------------------------------------------------

  async function readDays(source?: MeterOriginSource) {
    if (!canRead) return
    setBusy(true)
    try {
      const res = await meter.track('worklog-catch-up', meterOrigin(source), () =>
        readCatchUpText(text),
      )
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setReading(res.data)
      setReview(
        res.data.days.map((proposed) => ({
          ...proposed,
          keepAbsence: proposed.absence !== null,
          done: false,
        })),
      )
      if (res.data.days.length === 0) {
        toast.info('No days came out of that — try naming the dates, like "sep 3 - …"')
      } else {
        const sum = summarizeReading(res.data)
        toast.success(
          `Read ${sum.days} ${sum.days === 1 ? 'day' : 'days'}` +
            (sum.entries > 0
              ? ` and ${sum.entries} ${sum.entries === 1 ? 'entry' : 'entries'}`
              : '') +
            ' — check each one before saving.',
        )
      }
    } catch {
      toast.error('Could not read that right now — try again')
    } finally {
      setBusy(false)
    }
  }

  function patch(iso: string, change: Partial<ReviewDay>) {
    setReview((prev) => prev.map((row) => (row.day === iso ? { ...row, ...change } : row)))
  }

  function dropEntry(iso: string, index: number) {
    setReview((prev) =>
      prev.map((row) =>
        row.day === iso ? { ...row, entries: row.entries.filter((_, i) => i !== index) } : row,
      ),
    )
  }

  /**
   * Put a project on a row the reader could not place.
   *
   * THE MISSING HALF OF THE FENCE. catch-up-parse.ts drops a project it was not
   * shown and lists the phrase under "could not place", which is the honest
   * thing to do — but on its own it left somebody reading "Solar app" in the
   * unresolved list with the hours sitting right there and no way to attach
   * them. Every row carries the picker, so a wrong match is as correctable as a
   * missing one, by hand, before anything is saved.
   */
  function setEntryApp(iso: string, index: number, appId: string | null) {
    setReview((prev) =>
      prev.map((row) =>
        row.day === iso
          ? {
              ...row,
              entries: row.entries.map((entry, i) => (i === index ? { ...entry, appId } : entry)),
            }
          : row,
      ),
    )
  }

  function discard() {
    setReading(null)
    setReview([])
  }

  /**
   * Writes one reviewed day through the ORDINARY paths — the same three actions
   * a person typing by hand reaches, each still applying its own rules. There
   * is deliberately no bulk endpoint: a route that wrote a week in one
   * transaction would be a second, weaker copy of every check these three make.
   */
  async function saveDay(row: ReviewDay): Promise<{ ok: true } | { ok: false; error: string }> {
    // Leave first. It is the statement that changes what the day even IS, and
    // it is the one that goes to another human.
    if (row.absence && row.keepAbsence) {
      const res = await createAbsence({
        startDate: row.day,
        endDate: row.day,
        kind: row.absence.kind,
        reason: row.absence.reason ?? undefined,
      })
      if (!res.ok) return { ok: false, error: res.error }
    }

    /* HOURS BEFORE THE SCORE, now — the reverse of what this did originally.
       Writing the entries is what creates the day's record, because saving
       hours derives a score from them (auto-score.ts). A day the person left
       unscored therefore has no row until its entries land, and the note write
       below has nothing to attach to until then. */
    for (const entry of row.entries) {
      const res = await createWorklogEntry({
        day: row.day,
        minutes: entry.minutes,
        category: entry.category,
        appId: entry.appId,
        note: entry.note,
        // Marked as what it is. A proposal accepted unedited must not reach the
        // table looking like something the person typed out.
        source: 'ai_suggested',
      })
      if (!res.ok) return { ok: false, error: res.error }
    }

    if (row.percent !== null) {
      // A number the person picked. upsertDailyWorklog stamps it 'self', which
      // also stops the derivation ever overwriting it.
      const res = await upsertDailyWorklog(row.day, row.percent, row.note)
      if (!res.ok) return { ok: false, error: res.error }
    } else if (row.note) {
      /* NO SCORE, BUT WORDS. The score is coming from the hours just saved, so
         claiming it as the person's own would be a lie — but the note they
         typed in this card is theirs and was being silently dropped, because
         nothing else writes it. setDayNote touches that one column and says
         nothing about the score. */
      const res = await setDayNote(row.day, row.note)
      if (!res.ok) return { ok: false, error: res.error }
    }

    return { ok: true }
  }

  function saveAll() {
    const rows = review.filter((row) => !row.done && hasSomethingToSave(row))
    if (rows.length === 0) return
    setBusy(true)
    startTransition(async () => {
      // COUNTED, NOT ASSUMED. Claiming the whole list and then showing an error
      // toast beside it is the run telling the truth and contradicting itself.
      const saved: string[] = []
      const failed: { day: string; error: string }[] = []
      for (const row of rows) {
        const res = await saveDay(row)
        if (res.ok) {
          saved.push(row.day)
          patch(row.day, { done: true })
        } else {
          failed.push({ day: row.day, error: res.error })
        }
      }
      setBusy(false)
      router.refresh()

      if (saved.length > 0) {
        toast.success(
          `Saved ${saved.length} ${saved.length === 1 ? 'day' : 'days'}` +
            (failed.length > 0 ? ` — ${failed.length} did not go through` : ''),
        )
      }
      for (const failure of failed) {
        toast.error(`${dayLabel(failure.day)}: ${failure.error}`)
      }
      if (failed.length === 0 && saved.length > 0) {
        setText('')
        discard()
      }
    })
  }

  const outstanding = review.filter((row) => !row.done && hasSomethingToSave(row))
  /* Days that will STILL have no score after saving. A day with hours scores
     itself, so counting it here was the warning crying wolf about the common
     case — which is how a person stops reading the one day it is really about:
     the day they described in words and put no hours against. */
  const unscored = review.filter(
    (row) =>
      !row.done &&
      row.percent === null &&
      !row.absence &&
      derivedScoreFor(row, reading?.facts.find((f) => f.day === row.day)) === null,
  )

  return (
    <section
      id="log-box"
      aria-label="Log your days"
      className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs backdrop-blur-sm sm:p-5"
    >
      {/* THE TWO ANSWERS, THE SAME WEIGHT. "I worked" and "I owed no work" are
          different statements about a day, and burying the second one behind a
          small outline button on a card headed "Your day" is how somebody on
          leave ends up logging a day they did not work. */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-heading text-base font-bold text-foreground">Your day</h2>
          <p className="text-2xs text-muted-foreground">
            One line for today, or write out several days at once —{' '}
            <span className="font-mono">%</span> scores a day, a time logs hours.
          </p>
        </div>
        {canDeclare ? (
          <div className="flex flex-col items-end gap-1">
            <DeclareAbsenceDialog
              day={day}
              filed={filed}
              owedDays={owedDays}
              knownFrom={knownFrom}
              knownTo={knownTo}
              triggerVariant="secondary"
              triggerClassName="h-9 px-4 font-medium"
            />
            <span className="text-2xs text-muted-foreground">Leave, half day or an excuse</span>
          </div>
        ) : null}
      </div>

      {/* THE LEDGER, FOLDED INTO THE SAME CARD. It used to be a panel of its own
          carrying a second copy of the whole day form. Now it is a row of chips
          over the one box: tapping one writes that date into the text, which is
          the only thing the old panel's day picker was really for. */}
      {gaps.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-chart-1/30 bg-chart-1/5 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarClock className="size-3.5 shrink-0 text-chart-1" aria-hidden />
            <span className="font-heading text-xs font-semibold text-foreground">
              {gaps.length} {gaps.length === 1 ? 'day' : 'days'} unlogged
            </span>
            <span className="text-2xs text-muted-foreground">
              Tap one to start its line, or just write them all out below.
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {gaps.map((gap) => (
              <button
                key={gap.day}
                type="button"
                onClick={() => startDay(gap.day)}
                className={cn(
                  'flex items-baseline gap-1.5 rounded-lg border border-border/60 bg-card/70 px-2 py-1 text-2xs',
                  'cursor-pointer transition-colors motion-reduce:transition-none hover:border-chart-1 hover:bg-card',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <span className="font-heading font-semibold text-foreground">
                  {format(new Date(`${gap.day}T12:00:00`), 'EEE d MMM')}
                </span>
                <span
                  className={cn(
                    'font-mono',
                    gap.hasHours ? 'text-chart-1' : 'text-muted-foreground',
                  )}
                >
                  {gap.hasHours ? 'hours in, no score' : gap.fraction === 0.5 ? 'half' : 'full'}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* THE ONE FIELD. A textarea rather than an input, because the thing it
          has to accept is four days of somebody's week, and a single-line box
          that scrolls sideways teaches people to write less than they mean. */}
      <div className="flex flex-col gap-2">
        <Textarea
          ref={boxRef}
          id="day-one-line"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter saves a one-liner, exactly as the old field did. Once the
            // text is several days, Enter is a line break — the person is
            // writing a list, not committing one.
            if (event.key === 'Enter' && !event.shiftKey && !several && canSaveLine) {
              event.preventDefault()
              saveLine()
            }
          }}
          rows={several ? 5 : 2}
          placeholder={
            '80% 2h reviewed the feeder model for SCADA\n' +
            '…or: sep 3 - attendance app fixes 4h, ML model 2h, sep 2 - monthly meeting 2h'
          }
          aria-label="Your days — score, hours, projects and what you did"
          aria-describedby="log-box-hint"
          className="min-h-16 text-sm"
        />

        <div className="flex flex-wrap items-center gap-2">
          {several ? (
            <Button type="button" size="sm" disabled={!canRead} onClick={() => readDays()}>
              {busy ? (
                <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <SparklesIcon aria-hidden />
              )}
              {busy ? 'Reading your days…' : 'Read my days'}
            </Button>
          ) : (
            <>
              <Button type="button" size="sm" disabled={!canSaveLine} onClick={saveLine}>
                {pending ? (
                  <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                  <Plus aria-hidden />
                )}
                {intent.scores && intent.logsHours
                  ? 'Score & log'
                  : intent.scores
                    ? scored
                      ? 'Update score'
                      : 'Score day'
                    : 'Log hours'}
              </Button>
              {/* Still reachable when the guess is wrong: somebody may write one
                  line about last Tuesday with no date word in it. */}
              {catchUpAiEnabled && text.trim().length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!canRead}
                  onClick={() => readDays()}
                >
                  <SparklesIcon aria-hidden />
                  Read it instead
                </Button>
              ) : null}
            </>
          )}
        </div>

        {/* WHAT IT HEARD, live — the instant reader only. Anything unrecognised
            shows as the note rather than being silently discarded. */}
        {tokens.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {tokens.map((token, index) => (
              <span
                key={`${token.kind}-${index}`}
                className={cn(
                  'rounded px-1.5 py-0.5 text-2xs font-medium',
                  TOKEN_CLASS[token.kind],
                  token.kind === 'note' && 'max-w-64 truncate font-normal',
                )}
                title={token.kind === 'note' ? token.label : token.kind}
              >
                {token.label}
              </span>
            ))}
          </div>
        ) : null}

        {suggestions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={`${suggestion.kind}-${suggestion.label}`}
                type="button"
                onClick={() => insert(suggestion.text)}
                className={cn(
                  'rounded border border-transparent px-1.5 py-0.5 text-2xs font-medium cursor-pointer',
                  'transition-colors motion-reduce:transition-none hover:border-current',
                  TOKEN_CLASS[suggestion.kind],
                )}
                title={`Add ${suggestion.label} to the line`}
              >
                + {suggestion.label}
              </button>
            ))}
          </div>
        ) : null}

        {entryProblem ? (
          <p id="log-box-hint" className="text-2xs text-amber-600 dark:text-amber-400">
            {entryProblem}
          </p>
        ) : several ? (
          <p id="log-box-hint" className="text-2xs text-muted-foreground">
            Several days in there. LogPup will read it into days and show you each one before
            anything is saved — dates, project nicknames and typos included.
          </p>
        ) : (
          <p id="log-box-hint" className="text-2xs text-muted-foreground">
            Say it how you would say it. A <span className="font-mono">%</span> scores the day, a
            time logs hours — one line can do both, or either.
          </p>
        )}

        {!several ? <EntryGrammarHelp showScore /> : null}
      </div>

      {/* WHAT IT HEARD, FOR SEVERAL DAYS. One card per day, every row
          dismissable, and the score left for the person to state. */}
      {reading ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h3 className="font-heading text-sm font-semibold">
                What LogPup heard — check it before saving
              </h3>
              <p className="text-2xs text-muted-foreground">
                Nothing here is saved yet. Drop anything wrong, then score each day yourself.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={discard} disabled={busy}>
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={saveAll}
                disabled={busy || outstanding.length === 0}
              >
                {busy ? (
                  <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
                ) : null}
                Save {outstanding.length} {outstanding.length === 1 ? 'day' : 'days'}
              </Button>
            </div>
          </div>

          {/* SAID OUT LOUD RATHER THAN LEFT TO BE DISCOVERED. A day with hours
              and no score stays on the owed list, which is exactly the state
              this whole feature exists to clear. */}
          {unscored.length > 0 ? (
            <HelpNote>
              {unscored.length} of these {unscored.length === 1 ? 'days has' : 'days have'} no
              hours to score from — you described {unscored.length === 1 ? 'it' : 'them'} in words
              only. Days with hours score themselves; {unscored.length === 1 ? 'this one needs' : 'these need'}{' '}
              a number, or {unscored.length === 1 ? 'it stays' : 'they stay'} on the unlogged list.
            </HelpNote>
          ) : null}

          {reading.unresolved.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs font-medium text-muted-foreground">Could not place:</span>
              {reading.unresolved.map((phrase) => (
                <span
                  key={phrase}
                  className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-2xs text-amber-700 dark:text-amber-400"
                  title="No project on your list answers to this — your words are kept in the note"
                >
                  {phrase}
                </span>
              ))}
              {/* Named as fixable rather than left as a complaint. The hours are
                  already on the right day; only the attribution is missing. */}
              <span className="text-2xs text-muted-foreground">
                — your words are kept. Set the project on the row itself if one fits.
              </span>
            </div>
          ) : null}

          <ul className="flex flex-col gap-2.5">
            {review.map((row) => {
              const facts = reading.facts.find((f) => f.day === row.day)
              return (
                <li
                  key={row.day}
                  className={cn(
                    'flex flex-col gap-2 rounded-lg border bg-card/70 p-3',
                    row.done ? 'border-primary/40 opacity-70' : 'border-border/60',
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-heading text-xs font-bold text-foreground">
                        {dayLabel(row.day)}
                      </span>
                      {facts?.fraction === 0.5 ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs">
                          Half day
                        </span>
                      ) : null}
                      {facts?.closedFor ? (
                        <span className="rounded bg-chart-1/15 px-1.5 py-0.5 font-mono text-2xs text-chart-1">
                          {facts.closedFor}
                        </span>
                      ) : null}
                      {facts?.logged ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                          already scored — saving replaces it
                        </span>
                      ) : null}
                    </div>
                    {row.done ? (
                      <span className="font-mono text-2xs font-semibold text-primary">Saved</span>
                    ) : null}
                  </div>

                  {row.absence ? (
                    <label className="flex items-center gap-2 rounded-md border border-border/50 bg-background/50 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={row.keepAbsence}
                        disabled={row.done}
                        onChange={(event) => patch(row.day, { keepAbsence: event.target.checked })}
                        className="size-3.5 accent-primary"
                      />
                      <span className="text-2xs">
                        File as{' '}
                        <span className="font-medium text-foreground">
                          {ABSENCE_KIND_LABELS[row.absence.kind]}
                        </span>{' '}
                        — goes for approval
                      </span>
                    </label>
                  ) : null}

                  {row.entries.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {row.entries.map((entry, index) => (
                        <li
                          key={`${row.day}-${index}`}
                          className="flex items-baseline gap-2 rounded-md bg-background/50 px-2 py-1"
                        >
                          <span className="font-mono text-2xs font-semibold tabular-nums text-chart-1">
                            {Math.round((entry.minutes / 60) * 10) / 10}h
                          </span>
                          <span className="rounded bg-tag-discussion/15 px-1 py-px text-2xs text-tag-discussion">
                            {entry.category}
                          </span>
                          {/* THE PROJECT IS EDITABLE, always — not a chip when
                              the reader matched one and nothing when it did
                              not. Both cases are a guess about somebody's
                              afternoon, and the one that needs correcting most
                              is the confident wrong one. */}
                          <select
                            value={entry.appId ?? ''}
                            disabled={row.done}
                            onChange={(event) =>
                              setEntryApp(row.day, index, event.target.value || null)
                            }
                            aria-label="Project for this entry"
                            className={cn(
                              'max-w-40 shrink-0 cursor-pointer truncate rounded border-0 py-px pl-1 pr-4 text-2xs outline-none',
                              'focus-visible:ring-2 focus-visible:ring-ring',
                              entry.appId
                                ? 'bg-event-3/20 text-foreground'
                                : 'bg-muted/60 text-muted-foreground',
                            )}
                          >
                            <option value="">No project</option>
                            {apps.map((app) => (
                              <option key={app.id} value={app.id}>
                                {app.name}
                              </option>
                            ))}
                          </select>
                          <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
                            {entry.note ?? '—'}
                          </span>
                          {!row.done ? (
                            <button
                              type="button"
                              onClick={() => dropEntry(row.day, index)}
                              aria-label={`Drop this entry from ${dayLabel(row.day)}`}
                              className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <X className="size-3" aria-hidden />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <Textarea
                    value={row.note ?? ''}
                    disabled={row.done}
                    onChange={(event) => patch(row.day, { note: event.target.value || null })}
                    rows={2}
                    aria-label={`Note for ${dayLabel(row.day)}`}
                    placeholder="One line about the day"
                    className="min-h-12 text-2xs"
                  />

                  {/* THE SCORE, AND WHERE IT IS COMING FROM.
                      A day with hours no longer needs a number picked for it:
                      saving the entries derives one (auto-score.ts), so this
                      card says WHAT that number will be rather than demanding
                      a tap and warning about a consequence that no longer
                      happens. A day with no hours has nothing to derive from,
                      so for that one the pills really are the only way to clear
                      it, and the warning stays. The pills remain either way —
                      picking one marks the score as the person's own and stops
                      the derivation touching it again. */}
                  {(() => {
                    const derived = derivedScoreFor(row, facts)
                    const chosen = row.percent
                    return (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-2xs text-muted-foreground">
                          {chosen === null && derived !== null ? 'Scores itself at' : 'Score this day:'}
                        </span>
                        {chosen === null && derived !== null ? (
                          <span
                            className="rounded bg-chart-1/15 px-1.5 py-0.5 font-mono text-2xs font-semibold text-chart-1"
                            title="Worked out from the hours on this day when you save it"
                          >
                            {derived}% from your hours
                          </span>
                        ) : null}
                        {SCORE_PRESETS.map((value) => (
                          <button
                            key={value}
                            type="button"
                            disabled={row.done}
                            onClick={() =>
                              patch(row.day, { percent: chosen === value ? null : value })
                            }
                            className={cn(
                              'rounded border px-1.5 py-0.5 font-mono text-2xs cursor-pointer',
                              'transition-colors motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              chosen === value
                                ? 'border-primary bg-primary/15 text-primary'
                                : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                            )}
                          >
                            {value}%
                          </button>
                        ))}
                        {chosen === null && derived === null ? (
                          <span className="text-2xs text-amber-600 dark:text-amber-400">
                            no hours to score from — pick one, or the day stays on the list
                          </span>
                        ) : null}
                      </div>
                    )
                  })()}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function dayLabel(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), 'EEEE, MMMM d')
}

/**
 * The score this day's proposed hours will produce when saved, or null when
 * they will produce none.
 *
 * THE SAME TWO FUNCTIONS THE SERVER USES, on the same inputs, so the number
 * shown here and the number written afterwards cannot disagree — a preview that
 * quoted a different figure from the one that lands would be worse than no
 * preview. `fraction` is the day's owed share as coverage computed it, which is
 * already holiday- and leave-folded; a day at 0 has no scheduled length and
 * therefore nothing to derive from, which is exactly what `null` means here.
 */
function derivedScoreFor(
  row: ReviewDay,
  facts: CatchUpDayFacts | undefined,
): number | null {
  if (row.entries.length === 0) return null
  if (!facts || facts.fraction <= 0) return null
  const minutes = row.entries.reduce((total, entry) => total + entry.minutes, 0)
  return autoScoreFromHours(minutes, scheduledMinutesForFraction(facts.fraction))
}

/** A day nobody scored, with no rows left and no leave to file, writes nothing. */
function hasSomethingToSave(row: ReviewDay): boolean {
  return row.percent !== null || row.entries.length > 0 || (row.absence !== null && row.keepAbsence)
}
