'use client'

import * as React from 'react'
import { Loader2Icon, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  describeGrammar,
  describeLine,
  lineIntent,
  lineSuggestions,
  parseEntryLine,
  type LineToken,
} from '@/features/worklog/entry-language'
import { buildEntryPayload, entryFormProblem } from '@/features/worklog/entry-form'
import { createWorklogEntry } from '@/features/worklog/entry-actions'
import { upsertDailyWorklog } from '@/features/worklog/actions'
import type { LoggableTask } from '@/features/worklog/entry-queries'
import { cn } from '@/lib/utils'

/**
 * THE WHOLE DAY, IN ONE FIELD.
 *
 * "80% 2h reviewed the feeder model for SCADA" carries all four things the day
 * needs: the self-score, the hours, the project and the note. They used to be
 * a slider, four preset buttons, a project chip row, a textarea, a duration
 * box, two selects and a second note field — eleven controls across two cards,
 * in a workspace where not one hour has ever been recorded.
 *
 * THE TWO HALVES STAY TWO HALVES. One field is a typing convenience, not a
 * merge: `percent` is written to daily_worklogs as a JUDGEMENT and `minutes`
 * to worklog_entries as a MEASUREMENT, by two separate actions, and neither is
 * derived from the other. The grammar enforces it — a score must carry its `%`
 * sign, because one token meaning either would be that collapse by the back
 * door. The chips below say which of the two the line is currently writing.
 *
 * NOTHING IS APPLIED UNSEEN. Every recognised piece comes back as a coloured
 * chip while you type, and whatever is left over is shown as the note rather
 * than quietly dropped. The one real risk of a free-text field is not being
 * able to tell what it heard until after you commit.
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

const grammar = describeGrammar()

export function DayOneLine({
  day,
  apps,
  tasks,
  savedNote,
  scored,
}: {
  day: string
  apps: { id: string; name: string }[]
  tasks: LoggableTask[]
  /** The day's existing note, so a score-only line does not erase it. */
  savedNote: string | null
  /** Whether the day already carries a score — changes what the button says. */
  scored: boolean
}) {
  const [line, setLine] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  const appRefs = React.useMemo(
    () => apps.map((app) => ({ id: app.id, name: app.name })),
    [apps],
  )
  const taskRefs = React.useMemo(
    () => tasks.map((task) => ({ id: task.id, name: task.title })),
    [tasks],
  )

  const parsed = parseEntryLine(line, { apps: appRefs, tasks: taskRefs })
  const tokens = describeLine(parsed)
  const intent = lineIntent(parsed)
  const suggestions = lineSuggestions(parsed, appRefs)

  // Only asked of a line that is actually trying to log hours — a score-only
  // line has no entry to validate, and refusing it for a missing duration
  // would be a complaint about something the person did not ask to do.
  const entryProblem = intent.logsHours
    ? entryFormProblem({
        minutes: parsed.minutes,
        category: parsed.category,
        taskId: parsed.taskId,
        appId: parsed.appId,
        note: parsed.note,
      })
    : null

  const nothingToDo = !intent.scores && !intent.logsHours
  const canSubmit = !pending && !nothingToDo && entryProblem === null

  function insert(text: string) {
    setLine((prev) => (prev.trim() ? `${prev.trim()} ${text} ` : `${text} `))
  }

  function submit() {
    if (!canSubmit) return
    startTransition(async () => {
      const done: string[] = []
      try {
        // THE SCORE FIRST. If the hours write fails afterwards the day is still
        // scored, which is the half that clears it off the owed list — the
        // reverse order would leave somebody's hours recorded against a day the
        // rest of the app still calls unlogged.
        if (intent.scores && parsed.percent !== null) {
          // The note is carried through so a score-only line does not blank a
          // note the person wrote earlier; a line WITH prose replaces it.
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

        setLine('')
        toast.success(done.join(' · '))
      } catch {
        toast.error('Could not save that — try again')
      }
    })
  }

  const buttonLabel = intent.scores && intent.logsHours
    ? 'Score & log'
    : intent.scores
      ? scored
        ? 'Update score'
        : 'Score day'
      : 'Log hours'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="day-one-line"
          value={line}
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="80% 2h reviewed the feeder model for SCADA"
          aria-label="Your day — score, hours and what you did"
          aria-describedby="day-one-line-hint"
          className="min-w-56 flex-1 text-sm"
        />
        <Button type="button" size="sm" disabled={!canSubmit} onClick={submit}>
          {pending ? (
            <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Plus aria-hidden />
          )}
          {buttonLabel}
        </Button>
      </div>

      {/* WHAT IT HEARD, live. Anything not recognised is shown as the note
          rather than silently discarded. */}
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

      {/* WHAT CAN STILL BE ADDED. Only what this line is missing, and each chip
          inserts text that parses back to exactly what the chip says. */}
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.kind}-${suggestion.label}`}
              type="button"
              onClick={() => insert(suggestion.text)}
              className={cn(
                'rounded border border-transparent px-1.5 py-0.5 text-2xs font-medium transition-colors motion-reduce:transition-none cursor-pointer hover:border-current',
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
        <p id="day-one-line-hint" className="text-2xs text-amber-600 dark:text-amber-400">
          {entryProblem}
        </p>
      ) : (
        <p id="day-one-line-hint" className="text-2xs text-muted-foreground">
          Say it how you would say it. A <span className="font-mono">%</span> scores the day, a
          time logs hours — one line can do both, or either.
        </p>
      )}

      <details>
        <summary className="w-fit cursor-pointer text-2xs text-muted-foreground hover:text-foreground">
          What it understands
        </summary>
        <div className="mt-1.5 flex flex-col gap-1 rounded-xl border border-border/50 bg-background/40 p-2.5">
          <p className="text-2xs text-muted-foreground">
            <span className="font-medium text-foreground">Score:</span>{' '}
            <span className="font-mono">25% · 50% · 80% · 100%</span> — the sign is what makes it a
            score rather than hours.
          </p>
          <p className="text-2xs text-muted-foreground">
            <span className="font-medium text-foreground">Time:</span>{' '}
            <span className="font-mono">{grammar.durations.join('  ·  ')}</span>
          </p>
          {grammar.kinds.map((kind) => (
            <p key={kind.label} className="text-2xs text-muted-foreground">
              <span className="font-medium capitalize text-foreground">{kind.label}:</span>{' '}
              <span className="font-mono">{kind.words}</span>
            </p>
          ))}
          <p className="text-2xs text-muted-foreground">
            Naming a project attributes the time to it; naming a task makes it a task entry. The
            first matching word wins, so a &ldquo;review meeting&rdquo; is a meeting.
          </p>
        </div>
      </details>
    </div>
  )
}
