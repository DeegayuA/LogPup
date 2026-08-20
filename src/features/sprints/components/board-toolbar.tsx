'use client'

import { useEffect, useId, useState } from 'react'
import { AlertTriangle, ListFilter, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatNumber } from '@/components/animate-ui/stat-number'
import { cn } from '@/lib/utils'
import {
  EMPTY_FILTERS,
  GROUP_BY_LABEL,
  GROUP_BY_VALUES,
  PRIORITY_LABEL,
  UNASSIGNED_GROUP,
  activeFilterCount,
  type BoardFilters,
  type BoardSummary,
  type BoardView,
  type GroupBy,
} from '@/features/sprints/board-view'

/** Long enough that a typed word is one URL write, short enough that the
 *  board doesn't feel like it's lagging behind the keyboard. */
const SEARCH_DEBOUNCE_MS = 200

function Stat({
  label,
  value,
  suffix,
  tone,
}: {
  label: string
  value: number
  suffix?: string
  tone?: 'default' | 'danger'
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          // font-mono, matching the portfolio strip and the app header tiles:
          // one typeface for data values on this whole surface (house rule).
          'font-mono text-xl leading-none font-semibold tabular-nums',
          // Colour carries meaning, never decoration: a count is only red
          // when it is a count of something wrong, and only when it is
          // non-zero — "0 overdue" in red would be a false alarm.
          tone === 'danger' && value > 0 ? 'text-destructive' : 'text-foreground',
        )}
      >
        <StatNumber value={value} />
        {suffix ? <span className="text-base font-semibold">{suffix}</span> : null}
      </span>
      <span className="text-2xs text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  )
}

/**
 * The board's header: what the numbers say, and every control that changes
 * which cards you are looking at.
 *
 * The summary describes the FILTERED set, deliberately — a headline that
 * counts tasks the columns below aren't showing is worse than no headline.
 */
export function BoardToolbar({
  view,
  summary,
  team,
  onChange,
}: {
  view: BoardView
  summary: BoardSummary
  team: { userId: string; name: string }[]
  onChange: (next: BoardView) => void
}) {
  const searchId = useId()
  const [draft, setDraft] = useState(view.filters.query)
  /**
   * The last value this component pushed into the view. The URL change that
   * comes back is then recognisable as our own echo rather than as somebody
   * else editing the address bar — see the re-seed below.
   *
   * STATE, NOT A REF, and that is not a style choice: this value is READ
   * during render (the re-seed is a render-time state adjustment, per React's
   * "you might not need an effect"). A ref read during render is a value
   * React does not know the render depends on, so the comparison can run
   * against a `current` from a render that was thrown away — which is exactly
   * the bug this echo check exists to prevent. It is also what the
   * react-hooks/refs lint rule refuses.
   */
  const [lastSent, setLastSent] = useState<string | null>(null)

  // The input is uncontrolled-ish on purpose: typing updates local state at
  // keyboard speed and only settles into the shared view (and the URL) after
  // a pause. Driving it straight off `view` would rewrite the URL on every
  // keystroke.
  useEffect(() => {
    if (draft === view.filters.query) return
    const timer = setTimeout(() => {
      // Both updates land in one batch, so the render that sees the new
      // `view` also sees the matching `lastSent` and recognises the echo.
      setLastSent(draft)
      onChange({ ...view, filters: { ...view.filters, query: draft } })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, view, onChange])

  /*
   * Re-seed from the URL when it changes underneath us — a shared link, or a
   * navigation that carries different params.
   *
   * The echo check is load-bearing. Settling the search box writes the URL,
   * which comes straight back as a changed `view`; adopting it
   * unconditionally overwrites `draft` with the value from ~200ms ago, so any
   * character typed between the write and this render is silently deleted
   * from under the cursor. Ignoring our own echo means only a genuinely
   * external value ever replaces what the user is typing.
   */
  const [syncedQuery, setSyncedQuery] = useState(view.filters.query)
  if (view.filters.query !== syncedQuery) {
    setSyncedQuery(view.filters.query)
    if (view.filters.query !== lastSent) setDraft(view.filters.query)
  }

  const filterCount = activeFilterCount(view.filters)

  function setFilters(patch: Partial<BoardFilters>) {
    onChange({ ...view, filters: { ...view.filters, ...patch } })
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  }

  const assigneeOptions = [
    ...team.map((member) => ({ id: member.userId, name: member.name })),
    { id: UNASSIGNED_GROUP, name: 'Unassigned' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xl leading-none font-semibold tabular-nums">
            <StatNumber value={summary.done} />
            <span className="text-muted-foreground">/</span>
            <StatNumber value={summary.total} />
          </span>
          <div className="flex items-center gap-2">
            <div
              aria-hidden
              className="h-1 w-24 overflow-hidden rounded-full bg-border"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: `${summary.donePct}%` }}
              />
            </div>
            <span className="text-2xs text-muted-foreground uppercase tracking-wide">
              {summary.donePct}% done
            </span>
          </div>
        </div>
        <Stat label="In progress" value={summary.inProgress} />
        <Stat label="To do" value={summary.todo} />
        <Stat label="Overdue" value={summary.overdue} tone="danger" />
        <Stat label="Unassigned" value={summary.unassigned} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1 sm:max-w-64">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={searchId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks by title or description"
            autoComplete="off"
            className="h-8 pl-8"
          />
        </div>

        <Select
          value={view.groupBy}
          onValueChange={(value) => onChange({ ...view, groupBy: (value ?? 'status') as GroupBy })}
        >
          <SelectTrigger className="h-8 w-40 max-w-full" aria-label="Group cards by">
            <SelectValue>
              {(value: string) => `Group: ${GROUP_BY_LABEL[value as GroupBy] ?? 'Status'}`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {GROUP_BY_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {GROUP_BY_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <ListFilter aria-hidden />
            Filter
            {filterCount > 0 ? (
              <span className="ml-0.5 rounded-full bg-primary px-1.5 font-mono text-2xs tabular-nums text-primary-foreground">
                {filterCount}
              </span>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Assignee</DropdownMenuLabel>
            {assigneeOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.id}
                checked={view.filters.assignees.includes(option.id)}
                onCheckedChange={() =>
                  setFilters({ assignees: toggle(view.filters.assignees, option.id) })
                }
              >
                {option.name}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Priority</DropdownMenuLabel>
            {[3, 2, 1, 0].map((priority) => (
              <DropdownMenuCheckboxItem
                key={priority}
                checked={view.filters.priorities.includes(priority)}
                onCheckedChange={() =>
                  setFilters({ priorities: toggle(view.filters.priorities, priority) })
                }
              >
                {PRIORITY_LABEL[priority]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          size="sm"
          variant={view.filters.overdueOnly ? 'default' : 'outline'}
          aria-pressed={view.filters.overdueOnly}
          onClick={() => setFilters({ overdueOnly: !view.filters.overdueOnly })}
        >
          <AlertTriangle aria-hidden />
          Overdue
          {summary.overdue > 0 && !view.filters.overdueOnly ? (
            <span className="font-mono text-2xs tabular-nums text-destructive">
              {summary.overdue}
            </span>
          ) : null}
        </Button>

        {filterCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft('')
              // Keep the invariant that `lastSent` is always the last query
              // this component pushed, so the URL echo of this clear isn't
              // mistaken for somebody else editing the address bar.
              setLastSent('')
              onChange({ ...view, filters: EMPTY_FILTERS })
            }}
          >
            <X aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}
