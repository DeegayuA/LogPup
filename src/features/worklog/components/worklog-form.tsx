'use client'

import { useId, useState, useTransition } from 'react'
import { Loader2Icon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { DictateButton } from '@/features/speech/components/dictate-button'
import { upsertDailyWorklog } from '@/features/worklog/actions'
import { draftWorklogNote } from '@/features/worklog/draft-actions'

/**
 * One person's entry for one day: how much of what they planned they got
 * through, and what they did.
 *
 * Both controls are designed against the same cost — an engineer's time at
 * 6pm. The percentage is a slider, so it is one gesture rather than a field
 * to deliberate over. The note has a Draft button that writes a first
 * version from the day's own activity, and a mic, so the common case is
 * correcting a sentence instead of composing one.
 */
export function WorklogForm({
  day,
  initial,
  aiDraftEnabled,
}: {
  day: string
  initial: { percent: number; note: string | null } | null
  /** From getAiPrefs(userId)['worklog-draft'] — hides Draft with AI (button
   *  and its caption together) when the user has switched it off. */
  aiDraftEnabled: boolean
}) {
  const [percent, setPercent] = useState(initial?.percent ?? 50)
  const [note, setNote] = useState(initial?.note ?? '')
  const [saving, startSaving] = useTransition()
  const [drafting, startDrafting] = useTransition()
  // What the server is known to hold, so the form can show "saved" the
  // instant it is pressed and roll back to the truth if the write fails.
  const [saved, setSaved] = useState(initial)
  // One form per day is rendered on /worklog (today's, plus a box for each
  // earlier day with no entry), so a fixed id would point every label at the
  // first box's controls.
  const fieldId = useId()

  const dirty = percent !== (saved?.percent ?? null) || note.trim() !== (saved?.note ?? '')

  function handleSave() {
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
        if (res.data.activityCount === 0) {
          toast.info('LogPup recorded nothing for that day — the draft is a prompt, not a summary.')
        }
      } catch {
        toast.error('Could not draft that right now — try again')
      }
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${fieldId}-percent`} className="text-sm font-medium">
            How much of what you planned did you get through?
          </label>
          <span className="font-mono text-lg font-semibold tabular-nums">{percent}%</span>
        </div>
        {/* A range, not a number box: this is a judgement, not a measurement,
            and it should cost one gesture. Steps of 5 because nobody means
            the difference between 62% and 63%. */}
        <input
          id={`${fieldId}-percent`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          onChange={(event) => setPercent(Number(event.target.value))}
          className="w-full accent-primary pointer-coarse:min-h-11"
        />
        <p className="text-2xs text-muted-foreground">
          Your own read on your own day — meetings, review and debugging count.
        </p>
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
            Draft with AI writes a first version from what you did in LogPup today. Edit it — it
            is your entry.
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <span className={cn('text-2xs text-muted-foreground', dirty && 'invisible')}>
          {saved ? 'Saved' : null}
        </span>
        <Button type="button" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
          {saved ? 'Update' : 'Log the day'}
        </Button>
      </div>
    </section>
  )
}
