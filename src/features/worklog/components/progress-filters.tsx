'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  PROGRESS_RANGES,
  PROGRESS_RANGE_LABEL,
  progressHref,
  type ProgressParams,
  type ProgressWindow,
} from '@/features/worklog/progress-params'
import type { ProgressAppOption } from '@/features/worklog/progress-queries'

/**
 * The /progress controls: fortnight/month toggle, prev/next, an app Select
 * and a person-name filter. Every control is a LINK (or pushes a URL) so the
 * page stays a server component and any view can be pasted to a colleague —
 * the same grammar as people/history's filter bar, drafts and all.
 */

/** Select needs a non-empty sentinel for "no app filter". */
const ALL_APPS = 'all'

/** Anchored to local noon — the repo-wide guard for date-only strings. */
function noon(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

export function ProgressFilters(props: {
  params: ProgressParams
  window: ProgressWindow
  apps: ProgressAppOption[]
}) {
  // `key` resyncs the draft when the committed q changes underneath us (back
  // button, or a link that clears the filter) — the same remount-over-effect
  // pattern HistoryFilters documents.
  return <ProgressFiltersInner key={props.params.q} {...props} />
}

function ProgressFiltersInner({
  params,
  window,
  apps,
}: {
  params: ProgressParams
  window: ProgressWindow
  apps: ProgressAppOption[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(params.q)
  const [pending, startTransition] = useTransition()

  // `items` on the Root: Base UI's <Select.Value> renders the raw value (an
  // app UUID here) unless it is given a value → label map. House rule.
  const appItems = useMemo(
    () => [
      { value: ALL_APPS, label: 'All apps' },
      ...apps.map((app) => ({ value: app.id, label: app.name })),
    ],
    [apps],
  )

  function commit(next: string) {
    if (next === params.q) return
    startTransition(() => router.push(progressHref(params, { q: next })))
  }

  const windowLabel =
    params.range === 'month'
      ? format(noon(window.from), 'MMMM yyyy')
      : `${format(noon(window.from), 'MMM d')} – ${format(noon(window.to), 'MMM d')}`

  return (
    <div
      data-progress-filters
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', pending && 'opacity-60')}
    >
      {/* aria-current, not aria-pressed: these are links between two views of
          the calendar, and the nav landmark makes "which one am I on" the
          understood signal — same reasoning as HistoryFilters. Every link
          carries the CURRENT draft so a click mid-type cannot drop it. */}
      <nav aria-label="Window length" className="flex items-center gap-1.5">
        {PROGRESS_RANGES.map((range) => (
          <Button
            key={range}
            variant={params.range === range ? 'secondary' : 'outline'}
            size="sm"
            className="pointer-coarse:min-h-11"
            aria-current={params.range === range ? 'page' : undefined}
            render={<Link href={progressHref(params, { range, q: draft.trim() })} />}
          >
            {PROGRESS_RANGE_LABEL[range]}
          </Button>
        ))}
      </nav>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon-sm"
          className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          render={
            <Link
              href={progressHref(params, { start: window.prevStart, q: draft.trim() })}
              aria-label={`Earlier ${params.range}`}
            />
          }
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <span className="min-w-28 text-center font-mono text-xs tabular-nums text-muted-foreground">
          {windowLabel}
        </span>
        {/* Disabled rather than hidden when the next window would be pure
            future: the control keeps its place, and the reason is stated. */}
        <Button
          variant="outline"
          size="icon-sm"
          className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          disabled={!window.hasNext}
          render={
            window.hasNext ? (
              <Link
                href={progressHref(params, { start: window.nextStart, q: draft.trim() })}
                aria-label={`Later ${params.range}`}
              />
            ) : undefined
          }
          aria-label={window.hasNext ? undefined : 'No later window yet'}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
        {params.start ? (
          <Button
            variant="ghost"
            size="sm"
            className="pointer-coarse:min-h-11"
            render={<Link href={progressHref(params, { start: null, q: draft.trim() })} />}
          >
            Current
          </Button>
        ) : null}
      </div>

      {apps.length > 0 ? (
        <Select
          value={params.app ?? ALL_APPS}
          items={appItems}
          onValueChange={(value) => {
            const app = value == null || value === ALL_APPS ? null : (value as string)
            if (app === params.app) return
            startTransition(() => router.push(progressHref(params, { app, q: draft.trim() })))
          }}
        >
          <SelectTrigger aria-label="Filter by app" className="min-w-36 pointer-coarse:min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {appItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <form
        className="min-w-40 flex-1"
        onSubmit={(event) => {
          event.preventDefault()
          commit(draft.trim())
        }}
      >
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon className="size-4" aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => {
              // Focus moving to one of this bar's own controls? Their hrefs
              // already carry the draft — committing here too would fire a
              // second full server render with a stale flash between.
              const next = event.relatedTarget
              if (next instanceof Element && next.closest('[data-progress-filters]')) return
              commit(draft.trim())
            }}
            placeholder="Filter by person…"
            aria-label="Filter by person"
            maxLength={60}
          />
          {draft ? (
            <InputGroupAddon align="inline-end">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setDraft('')
                  commit('')
                }}
              >
                <XIcon aria-hidden />
                <span className="sr-only">Clear the person filter</span>
              </Button>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </form>
    </div>
  )
}
