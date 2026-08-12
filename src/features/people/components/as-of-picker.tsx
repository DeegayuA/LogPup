'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isoDaysAgo, todayIso } from '@/features/people/as-of-date'
import { historyHref, type HistoryParams } from '@/features/people/history-params'
import { cn } from '@/lib/utils'

const PRESETS: { label: string; days: number }[] = [
  { label: 'Today', days: 0 },
  { label: '1 week ago', days: 7 },
  { label: '1 month ago', days: 30 },
  { label: '3 months ago', days: 90 },
]

/**
 * Date control for the team-wide "as it was then" view.
 *
 * The chosen day lives in the URL (`?at=`), not in component state, so the
 * view is linkable, back-button-able and re-renderable on the server — the
 * capacity list it drives is a server component and there is nothing to
 * hydrate. A native date input rather than a custom calendar: it is already
 * keyboard- and screen-reader-complete, and on mobile it opens the platform
 * picker.
 */
export function AsOfPicker({
  iso,
  isToday,
  params,
}: {
  iso: string
  isToday: boolean
  /** The rest of the page's URL state, carried through every date change —
   *  changing the date used to reset the view, comparison window and filter
   *  back to their defaults, because this control rebuilt the URL from
   *  scratch with only `at` on it. */
  params: HistoryParams
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const today = todayIso()

  // The typed value is LOCAL until it is submitted. A date input fires change
  // on every segment keystroke once the composite value is complete — and it
  // always is here, because the other two segments are already filled — so
  // driving `value` straight off the prop and navigating in onChange pushed a
  // route per digit and then reverted the digit when the prop came back
  // unchanged. Typing a year was impossible; only the presets and the mouse
  // calendar worked.
  const [draft, setDraft] = useState(iso)
  const [lastIso, setLastIso] = useState(iso)
  // Adjust-while-rendering rather than an effect: when the server lands on a
  // new day the field must follow it, but only then.
  if (lastIso !== iso) {
    setLastIso(iso)
    setDraft(iso)
  }

  function go(next: string) {
    startTransition(() => {
      // historyHref carries the rest of the page's state and drops `at` when
      // it is today, so the default view stays a bare /people/history rather
      // than pinning a date that goes stale at midnight.
      router.push(historyHref(params, { at: next }))
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // `max` only marks an out-of-range value :invalid; the form's native
    // validation blocks submit, but a scripted/autofilled value still gets
    // checked here.
    if (!draft || draft > today || draft === iso) return
    go(draft)
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-end gap-3 transition-opacity duration-150 motion-reduce:transition-none',
        isPending && 'opacity-60',
      )}
    >
      {/* A real form: submit is the commit point, so the field is only read
          once the user is done with it, and `max` gets native constraint
          validation for free instead of being decorative. */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <Label htmlFor="as-of-date">Show the team as of</Label>
        <div className="flex items-end gap-1.5">
          <Input
            id="as-of-date"
            type="date"
            value={draft}
            max={today}
            required
            onChange={(event) => setDraft(event.target.value)}
            className="pointer-coarse:min-h-11 w-44 font-mono tabular-nums"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isPending || !draft || draft === iso}
            className="pointer-coarse:min-h-11"
          >
            Show
          </Button>
        </div>
      </form>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Jump to a date">
        {PRESETS.map((preset) => {
          const target = isoDaysAgo(preset.days)
          const active = preset.days === 0 ? isToday : iso === target
          return (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              aria-pressed={active}
              disabled={isPending}
              onClick={() => go(target)}
              className="pointer-coarse:min-h-11"
            >
              {preset.days === 0 ? <CalendarClock aria-hidden /> : null}
              {preset.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
