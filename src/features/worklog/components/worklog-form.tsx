'use client'

import { useId, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { Loader2Icon, SparklesIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { DictateButton } from '@/features/speech/components/dictate-button'
import { upsertDailyWorklog } from '@/features/worklog/actions'
import { draftWorklogNote, type WorklogDraft } from '@/features/worklog/draft-actions'

/** The suggestion chip's state: a proposed score and what it was judged from. */
type PercentSuggestion = { percent: number; activityCount: number }

/**
 * One person's entry for one day: how much of what they planned they got
 * through, and what they did.
 *
 * Both controls are designed against the same cost — an engineer's time at
 * 6pm. The percentage is a slider, so it is one gesture rather than a field
 * to deliberate over. The note has a Draft button that writes a first
 * version from the day's own activity, and a mic, so the common case is
 * correcting a sentence instead of composing one.
 *
 * The score starts UNSET for an unlogged day. It used to start at 50, which
 * meant typing a note and pressing save silently recorded 50% — a default
 * masquerading as a self-score. Saving now requires touching the slider (or
 * applying the AI suggestion); until then the form says "Not scored yet" in
 * words.
 */
export function WorklogForm({
  day,
  initial,
  aiDraftEnabled,
  initialDraft,
}: {
  day: string
  initial: { percent: number; note: string | null } | null
  /** From getAiPrefs(userId)['worklog-draft'] — hides Draft with AI (button
   *  and its caption together) when the user has switched it off. */
  aiDraftEnabled: boolean
  /**
   * A batch draft from the catch-up panel's "Draft all N days", landing here
   * for review: the note starts in the textarea (the same overwrite semantics
   * as the form's own Draft button) and the percent starts as the suggestion
   * chip, never the score. The PANEL re-keys this component per draft, so it
   * is genuinely initial state — no prop-to-state syncing.
   */
  initialDraft?: WorklogDraft | null
}) {
  // null = not scored yet. Only an explicit gesture (slider, suggestion chip)
  // sets a number, and handleSave refuses to run without one.
  const [percent, setPercent] = useState<number | null>(initial?.percent ?? null)
  const [note, setNote] = useState(initialDraft?.note ?? initial?.note ?? '')
  const [suggestion, setSuggestion] = useState<PercentSuggestion | null>(
    initialDraft && initialDraft.suggestedPercent !== null
      ? { percent: initialDraft.suggestedPercent, activityCount: initialDraft.activityCount }
      : null,
  )
  const [saving, startSaving] = useTransition()
  const [drafting, startDrafting] = useTransition()
  // What the server is known to hold, so the form can show "saved" the
  // instant it is pressed and roll back to the truth if the write fails.
  const [saved, setSaved] = useState(initial)
  // One form per day is rendered on /worklog (the day panel, plus a box for
  // each earlier day with no entry), so a fixed id would point every label at
  // the first box's controls.
  const fieldId = useId()

  const dirty = percent !== (saved?.percent ?? null) || note.trim() !== (saved?.note ?? '')
  const canSave = percent !== null && dirty

  function handleSave() {
    if (percent === null) return
    const nextPercent = percent
    const nextNote = note.trim() ? note.trim() : null
    const previous = saved
    // Optimistic: the entry reads as saved immediately.
    setSaved({ percent: nextPercent, note: nextNote })
    startSaving(async () => {
      try {
        const res = await upsertDailyWorklog(day, nextPercent, nextNote)
        if (!res.ok) {
          setSaved(previous)
          toast.error(res.error)
          return
        }
        toast.success('Logged')
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
        // Overwrites deliberately, like "Draft with AI" on the sprint form:
        // the button is the statement "draft this for me", and a merge that
        // kept half-typed text produces a sentence that is neither the
        // person's nor the model's.
        setNote(res.data.note)
        // The percent NEVER lands in the slider by itself — it becomes a
        // labeled chip the person applies with one click, because the score
        // is theirs, not the model's.
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

  // The slider needs a number to render; 50 is only where the THUMB rests
  // while nothing is scored — the state stays null until a real gesture, and
  // pointer-down/key-down on the control is that gesture even without a move.
  const thumbAt = percent ?? 50

  function scoreFromGesture() {
    if (percent === null) setPercent(thumbAt)
  }

  return (
    <section
      aria-label={`Work log for ${format(new Date(`${day}T12:00:00`), 'EEEE, MMMM d, yyyy')}`}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${fieldId}-percent`} className="text-sm font-medium">
            How much of what you planned did you get through?
          </label>
          {percent === null ? (
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              Not scored yet
            </span>
          ) : (
            <span className="shrink-0 font-mono text-lg font-semibold tabular-nums">
              {percent}%
            </span>
          )}
        </div>
        {/* A range, not a number box: this is a judgement, not a measurement,
            and it should cost one gesture. Steps of 5 because nobody means
            the difference between 62% and 63%. The bubble tracks the thumb so
            the value is read where the hand is, not across the row. */}
        <div className="relative pt-7">
          {percent !== null ? (
            <output
              htmlFor={`${fieldId}-percent`}
              aria-hidden
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-primary px-1.5 py-0.5 font-mono text-2xs font-semibold tabular-nums text-primary-foreground"
              // The thumb is ~16px wide and does not travel the full track:
              // at 0% its center sits 8px in, at 100% 8px short. The linear
              // correction keeps the bubble over it at both ends.
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
              'w-full accent-primary pointer-coarse:min-h-11',
              percent === null && 'opacity-60',
            )}
          />
        </div>
        <p className="text-2xs text-muted-foreground">
          {percent === null
            ? 'Pick a score to save — your own read on your own day. Meetings, review and debugging count.'
            : 'Your own read on your own day — meetings, review and debugging count.'}
        </p>
        {suggestion !== null && suggestion.percent !== percent ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5">
            <SparklesIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
            <p className="min-w-0 flex-1 text-2xs text-muted-foreground">
              AI suggests{' '}
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {suggestion.percent}%
              </span>
              {' — based on '}
              <span className="font-mono tabular-nums">{suggestion.activityCount}</span>
              {suggestion.activityCount === 1 ? ' activity' : ' activities'} LogPup saw that day.
            </p>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setPercent(suggestion.percent)}
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

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={`${fieldId}-note`} className="text-sm font-medium">
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
              >
                {drafting ? (
                  <Loader2Icon className="animate-spin" aria-hidden />
                ) : (
                  <SparklesIcon aria-hidden />
                )}
                {drafting ? 'Drafting…' : 'Draft with AI'}
              </Button>
            ) : null}
          </div>
        </div>
        <Textarea
          id={`${fieldId}-note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Two or three lines is plenty."
          maxLength={4000}
          rows={4}
        />
        {aiDraftEnabled ? (
          <p className="text-2xs text-muted-foreground">
            Draft with AI writes a first version from what you did in LogPup that day, and
            suggests a percent you can take or leave. Edit it — it is your entry.
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <span className={cn('text-2xs text-muted-foreground', dirty && 'invisible')}>
          {saved ? 'Saved' : null}
        </span>
        <Button type="button" onClick={handleSave} disabled={saving || !canSave}>
          {saving ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
          {saved ? 'Update' : 'Log the day'}
        </Button>
      </div>
    </section>
  )
}
