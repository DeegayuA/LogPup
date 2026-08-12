'use client'

import { useOptimistic, useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { checkinGap, type CheckinGap } from '@/features/sprints/checkins'
import { upsertSprintCheckin } from '@/features/sprints/checkin-actions'

export type ReportedCheckin = { percent: number; note: string | null }

/**
 * The verdict → colour mapping, in ONE place. It lives in this client file
 * (not the server list) because the editor must recompute it against an
 * optimistic percent mid-transition; the server-rendered rows in
 * sprint-checkins.tsx borrow it so the two can never disagree on what
 * 'ahead' looks like.
 *
 * 'ahead' gets the warning token: reporting more than the board shows is the
 * one gap worth a question at standup. 'behind' is usually just cards nobody
 * moved yet, so it stays muted — flagging it loudly would train people to
 * ignore the colour. Never a decorative accent for either.
 */
export function GapHint({ verdict }: { verdict: CheckinGap }) {
  if (verdict === 'ahead') {
    return <span className="text-2xs font-medium text-warning">ahead of board</span>
  }
  if (verdict === 'behind') {
    return <span className="text-2xs font-medium text-muted-foreground">behind board</span>
  }
  return null
}

/**
 * Client-side mirror of the action's percent rule (int 0..100) so the Save
 * button can refuse before a round trip. Digits-only rather than parseInt:
 * parseInt('12abc') is 12, and silently saving a number the user didn't
 * quite type is worse than a disabled button.
 */
function parsePercent(text: string): number | null {
  if (!/^\d{1,3}$/.test(text.trim())) return null
  const value = Number(text)
  return value <= 100 ? value : null
}

/**
 * The signed-in user's own slot in the check-in strip: the "You said N%"
 * line everyone else sees rendered from their row, plus the controls to
 * change it. Both are always mounted — the editor never toggles open, so
 * checking in doesn't reflow anything around it.
 *
 * OPTIMISTIC SPLIT: the saved line and the inputs are deliberately two
 * different pieces of state. The line uses `useOptimistic` over the
 * server-rendered check-in — submit overlays the draft instantly, a
 * successful action revalidates /apps/[slug] so the fresh prop matches the
 * overlay, and a failure drops the overlay back to server truth with no
 * undo bookkeeping (same account as PendingApprovalsCard). The inputs hold
 * plain draft state that a failure does NOT reset: wiping what the user
 * typed on error would make "try again" mean "type it all again".
 */
export function SprintCheckinEditor({
  sprintId,
  initial,
  computedPercent,
}: {
  sprintId: string
  /** The caller's saved check-in from the server render; null before the first one. */
  initial: ReportedCheckin | null
  /** computeTaskProgress().percent for this user — null means no tasks, gap unknowable. */
  computedPercent: number | null
}) {
  const [isPending, startTransition] = useTransition()
  const [reported, showReported] = useOptimistic(
    initial,
    (_current: ReportedCheckin | null, next: ReportedCheckin) => next,
  )
  const [percentText, setPercentText] = useState(initial ? String(initial.percent) : '')
  const [note, setNote] = useState(initial?.note ?? '')

  const draftPercent = parsePercent(percentText)
  // The slider needs a number even while the text field holds a half-typed
  // one; falling back to the saved percent keeps the thumb where the last
  // real answer was instead of snapping to zero.
  const sliderValue = draftPercent ?? reported?.percent ?? 0

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draftPercent === null || isPending) return
    // '' → null here, mirroring the action's own convention, so the overlay
    // previews exactly what the server will store.
    const next: ReportedCheckin = { percent: draftPercent, note: note.trim() || null }
    startTransition(async () => {
      showReported(next)
      try {
        const res = await upsertSprintCheckin(sprintId, next.percent, next.note ?? undefined)
        if (!res.ok) {
          // No manual rollback: the transition ending drops the optimistic
          // overlay and the line falls back to the server's value.
          toast.error(res.error)
          return
        }
        toast.success(`Checked in at ${res.data.percent}%`)
      } catch {
        // Actions can REJECT (dropped connection) as well as return err() —
        // same guard as every other action call in this feature.
        toast.error('Something went wrong — try again')
      }
    })
  }

  const verdict: CheckinGap = reported
    ? checkinGap(reported.percent, { percent: computedPercent })
    : 'unknown'

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs" aria-live="polite">
        {reported ? (
          <>
            <span className="font-mono font-medium tabular-nums">You said {reported.percent}%</span>
            <GapHint verdict={verdict} />
            {reported.note ? (
              <span className="min-w-0 text-muted-foreground">“{reported.note}”</span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">Not checked in yet</span>
        )}
        {isPending ? <span className="text-2xs text-muted-foreground">Saving…</span> : null}
      </p>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={sliderValue}
          onChange={(event) => setPercentText(event.target.value)}
          aria-label="Your progress"
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
        />
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={percentText}
          onChange={(event) => setPercentText(event.target.value)}
          aria-label="Your progress percent"
          aria-invalid={percentText !== '' && draftPercent === null}
          className="w-16 shrink-0 text-right font-mono tabular-nums"
        />
        <span aria-hidden className="text-xs text-muted-foreground">
          %
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={280}
          placeholder="Optional note — one sentence of context"
          aria-label="Check-in note (optional)"
        />
        <Button
          type="submit"
          size="sm"
          className="shrink-0"
          disabled={isPending || draftPercent === null}
        >
          {reported ? 'Update' : 'Check in'}
        </Button>
      </div>
    </form>
  )
}
