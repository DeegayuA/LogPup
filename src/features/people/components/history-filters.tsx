'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'
import {
  COMPARE_WINDOWS,
  HISTORY_VIEWS,
  HISTORY_VIEW_LABEL,
  historyHref,
  type HistoryParams,
} from '@/features/people/history-params'

/**
 * The page's controls: which slice is in front, how far back the comparison
 * reaches, a name filter, and the "only what moved" switch.
 *
 * Navigation controls are LINKS that set query params — the page stays a
 * server component, and whatever view someone is looking at can be pasted to
 * a colleague. Two exceptions: the text box, which needs local state while
 * typing and commits on submit or blur (the same draft-then-commit rule the
 * as-of picker and the activity date filters follow) rather than pushing a
 * route on every keystroke; and "Only what moved", which is a real toggle
 * button because a filter's on/off state is aria-pressed's job, not
 * aria-current's.
 */
export function HistoryFilters({ params }: { params: HistoryParams }) {
  // `key` on the inner form is what resyncs the draft when the committed
  // value changes underneath us (back button, or a link that clears the
  // filter): remounting is cheaper and more honest than an effect that
  // writes state during render, and it is the pattern ActivityFilterBar's
  // date fields already use for the same problem.
  return <HistoryFiltersInner key={params.q} params={params} />
}

function HistoryFiltersInner({ params }: { params: HistoryParams }) {
  const router = useRouter()
  const [draft, setDraft] = useState(params.q)
  const [pending, startTransition] = useTransition()

  function commit(next: string) {
    if (next === params.q) return
    startTransition(() => router.push(historyHref(params, { q: next })))
  }

  return (
    <div data-history-filters className={cn('flex flex-col gap-3', pending && 'opacity-60')}>
      {/* Every link carries the CURRENT draft, not the last committed query:
          clicking a tab while a filter is half-typed used to race the blur
          commit and drop what was typed. Carrying it means the two agree
          whichever way the click lands. */}
      <nav aria-label="History views" className="flex flex-wrap gap-1.5">
        {HISTORY_VIEWS.map((view) => (
          <Button
            key={view}
            variant={params.view === view ? 'secondary' : 'ghost'}
            size="sm"
            className="pointer-coarse:min-h-11"
            aria-current={params.view === view ? 'page' : undefined}
            render={<Link href={historyHref(params, { view, q: draft.trim() })} />}
          >
            {HISTORY_VIEW_LABEL[view]}
          </Button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* aria-current, not aria-pressed: these are links, and aria-pressed
            is only defined for buttons — on a link it is ignored, which would
            leave "which window am I looking at" carried by fill colour alone.
            A nav landmark makes aria-current="page" the right, understood
            signal for the one that is active. */}
        <nav
          className="flex flex-wrap items-center gap-1.5"
          aria-label="Comparison window"
        >
          <span className="text-xs text-muted-foreground">Compare against</span>
          {COMPARE_WINDOWS.map((days) => (
            <Button
              key={days}
              variant={params.window === days ? 'secondary' : 'outline'}
              size="sm"
              className="pointer-coarse:min-h-11"
              aria-current={params.window === days ? 'page' : undefined}
              render={<Link href={historyHref(params, { window: days, q: draft.trim() })} />}
            >
              {days}d ago
            </Button>
          ))}
        </nav>

        {/* Only meaningful where rows ARE people — the app rollup and the
            change log have no per-person movement to filter on, and a control
            that silently does nothing is worse than one that isn't there.

            A real toggle BUTTON with aria-pressed, unlike its link siblings:
            this is a filter with two states, not navigation between places,
            and the link version carried aria-current="true" — a token that
            means "current page" and is not a toggle semantic at all. Buttons
            get no free prefetch, so the hover/focus warm-up is added by hand,
            same as the as-of presets. */}
        {params.view === 'people' ? (
          <Button
            type="button"
            variant={params.movedOnly ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={params.movedOnly}
            className="pointer-coarse:min-h-11"
            onClick={() =>
              startTransition(() =>
                router.push(historyHref(params, { movedOnly: !params.movedOnly, q: draft.trim() })),
              )
            }
            onPointerEnter={() =>
              router.prefetch(historyHref(params, { movedOnly: !params.movedOnly, q: draft.trim() }))
            }
            onFocus={() =>
              router.prefetch(historyHref(params, { movedOnly: !params.movedOnly, q: draft.trim() }))
            }
          >
            {params.movedOnly ? 'Showing only what moved' : 'Only what moved'}
          </Button>
        ) : null}

        <form
          className="min-w-48 flex-1"
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
                // Focus moving to one of this bar's own links? Their hrefs
                // already carry the draft, so committing here too would fire
                // a SECOND full server render (old view + new q, then the
                // link's own navigation) with a stale-view flash between.
                const next = event.relatedTarget
                if (next instanceof Element && next.closest('[data-history-filters]')) return
                commit(draft.trim())
              }}
              placeholder="Filter by person or app…"
              aria-label="Filter by person or app"
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
                  <span className="sr-only">Clear filter</span>
                </Button>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </form>
      </div>
    </div>
  )
}
