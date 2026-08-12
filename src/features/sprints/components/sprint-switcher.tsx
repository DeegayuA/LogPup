'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type SwitcherSprint = {
  id: string
  name: string
  status: 'planned' | 'active' | 'done'
  startDate: string
  endDate: string
}

/**
 * The backlog is a REAL option in this list, not a button beside it.
 *
 * It was previously a separate `<Link>` styled as a button, which left the
 * Select holding `value=""` whenever the backlog was showing — a control
 * displaying nothing while the thing it controls is plainly on screen. The
 * host route already understands `?sprint=backlog` as a synthetic id, so the
 * two selectors collapse into one without the route changing at all.
 *
 * The empty string is the host's own way of saying "backlog is selected"; it
 * only ever arrives when there IS a backlog selection, because a board with
 * no sprints doesn't render this component.
 */
export const BACKLOG_VALUE = 'backlog'

const STATUS_DOT: Record<SwitcherSprint['status'], string> = {
  planned: 'border border-dashed border-chart-2 bg-chart-2/25',
  active: 'bg-primary',
  done: 'bg-muted-foreground/40',
}

const STATUS_LABEL: Record<SwitcherSprint['status'], string> = {
  planned: 'Planned',
  active: 'Active',
  done: 'Done',
}

/** Plain YYYY-MM-DD from a `date` column, anchored to local noon so it can't
 *  render as the previous day west of Greenwich. */
function shortRange(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
}

export function SprintSwitcher({
  sprints,
  selectedId,
}: {
  sprints: SwitcherSprint[]
  selectedId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const value = selectedId === '' ? BACKLOG_VALUE : selectedId

  function handleChange(next: string | null) {
    if (!next || next === value) return
    // Copy the existing params (e.g. ?tab=roadmap) so switching sprints never
    // clobbers whatever else is in the URL.
    const params = new URLSearchParams(searchParams.toString())
    params.set('sprint', next)
    router.push(`${pathname}?${params.toString()}`)
  }

  if (sprints.length === 0) return null

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-64" aria-label="Select sprint or backlog">
        {/* Explicit label mapping — the raw id is the Select's `value`, so
            without this the trigger falls back to rendering that id (a UUID)
            instead of the sprint's name. */}
        <SelectValue>
          {(current: string) =>
            current === BACKLOG_VALUE
              ? 'Backlog'
              : (sprints.find((sprint) => sprint.id === current)?.name ?? 'Select sprint')
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={BACKLOG_VALUE}>
          <span className="flex flex-col gap-0.5">
            <span>Backlog</span>
            <span className="text-2xs text-muted-foreground">Tasks in no sprint</span>
          </span>
        </SelectItem>
        {sprints.map((sprint) => (
          <SelectItem key={sprint.id} value={sprint.id}>
            {/* Name alone made choosing the right sprint a memory test.
                Status is a dot AND a word — never colour alone, since planned
                and active sit only a shade apart on the pine ramp. */}
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[sprint.status])} />
                {sprint.name}
              </span>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {STATUS_LABEL[sprint.status]} · {shortRange(sprint.startDate, sprint.endDate)}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
