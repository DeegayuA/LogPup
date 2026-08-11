'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isoDaysAgo, todayIso } from '@/features/people/as-of-date'
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
export function AsOfPicker({ iso, isToday }: { iso: string; isToday: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const today = todayIso()

  function go(next: string) {
    startTransition(() => {
      // Today is the default view, so it drops the param instead of pinning
      // a date that goes stale at midnight.
      router.push(next === today ? '/people/history' : `/people/history?at=${next}`)
    })
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-end gap-3 transition-opacity duration-150 motion-reduce:transition-none',
        isPending && 'opacity-60',
      )}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="as-of-date">Show the team as of</Label>
        <Input
          id="as-of-date"
          type="date"
          value={iso}
          max={today}
          onChange={(event) => {
            if (event.target.value) go(event.target.value)
          }}
          className="pointer-coarse:min-h-11 w-44 font-mono tabular-nums"
        />
      </div>
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
