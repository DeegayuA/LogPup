'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ChevronRight,
  CircleDashed,
  CircleDot,
  History,
  PawPrint,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { StatTile } from '@/components/ui/stat-tile'
import { StatNumber } from '@/components/animate-ui/stat-number'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ContactButtons } from '@/components/contact-buttons'
import { eventDotClasses } from '@/features/meetings/event-color'
import { CapacityBar } from '@/features/people/components/capacity-bar'
import {
  RECENT_DAYS,
  actionSentence,
  nowHeadline,
  overdueCount,
  recentSummary,
  type PersonNow,
} from '@/features/people/now'
import type { UserCapacity } from '@/features/people/queries'
import { isAdminRole } from '@/features/auth/capabilities'

type SortKey = 'name' | 'load-desc' | 'load-asc'

const SORT_LABEL: Record<SortKey, string> = {
  name: 'Name A–Z',
  'load-desc': 'Most loaded first',
  'load-asc': 'Least loaded first',
}

const DEFAULT_SORT: SortKey = 'name'
const SEARCH_DEBOUNCE_MS = 250

function parseSort(raw: string | null): SortKey {
  // Explicit comparisons, not `raw in SORT_LABEL` — `in` walks the prototype
  // chain, so ?sort=toString would sneak past as a "valid" key.
  return raw === 'load-desc' || raw === 'load-asc' ? raw : DEFAULT_SORT
}

/**
 * Filter state lives in the URL (`?q=&org=&sort=`), written with
 * `history.replaceState` — the SHALLOW route update Next wires into
 * `useSearchParams`, so a keystroke re-renders this client component and
 * nothing else. `router.replace` would re-run the whole server page (two
 * queries) per commit for a filter that is applied entirely on the client;
 * plain component state (what this used to be) meant a filtered view could
 * not be linked, shared, or survive back-navigation — breaking the URL-state
 * discipline every sibling view (cohorts, history) follows.
 *
 * Defaults are DROPPED from the query string, so a bare /people stays the
 * canonical link, exactly as cohort-params.ts does for `view`.
 */
function writeFilterParams(patch: { q?: string; org?: string | null; sort?: SortKey }) {
  const next = new URLSearchParams(window.location.search)
  if (patch.q !== undefined) {
    if (patch.q) next.set('q', patch.q)
    else next.delete('q')
  }
  if (patch.org !== undefined) {
    if (patch.org) next.set('org', patch.org)
    else next.delete('org')
  }
  if (patch.sort !== undefined) {
    if (patch.sort !== DEFAULT_SORT) next.set('sort', patch.sort)
    else next.delete('sort')
  }
  const query = next.toString()
  window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
}

/** Sortable, org-filterable directory rows for the People page. */
/**
 * The two lines that turn a capacity list into a work list: what someone is on
 * right now, and what they have actually been doing.
 *
 * Both are deliberately quiet — this is a directory, and a row that shouts
 * stops being scannable. The ONE thing allowed to raise its voice is overdue
 * work, because that is the only state on the row a reader has to act on.
 */
function PersonNowLines({ now, todayIso }: { now?: PersonNow; todayIso: string }) {
  const doing = now?.doing ?? []
  const recent = now?.recent ?? []
  const headline = nowHeadline(doing, todayIso)
  const late = overdueCount(doing, todayIso)
  const history = recentSummary(recent)

  return (
    <span className="mt-0.5 flex flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-1.5 truncate text-xs">
        {headline ? (
          <>
            <CircleDot className="size-3 shrink-0 text-primary" aria-hidden />
            <span className="sr-only">Working on: </span>
            <span className="truncate text-foreground">{headline}</span>
            {/* A word, not just the amber — the row's only urgent state must
                not be carried by colour alone (WCAG 1.4.1). */}
            {late > 0 ? (
              <span className="shrink-0 font-medium text-warning">
                <span className="font-mono tabular-nums">{late}</span> overdue
              </span>
            ) : null}
          </>
        ) : (
          <>
            <CircleDashed className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />
            {/* Said plainly rather than left blank: an empty line reads as
                missing data, and "nothing in progress" is a real answer. */}
            <span className="text-muted-foreground">Nothing in progress</span>
          </>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 truncate text-2xs text-muted-foreground">
        <History className="size-3 shrink-0" aria-hidden />
        {history ? (
          <>
            <span className="sr-only">Recently: </span>
            {/* The counts first — they are the scannable part — then the most
                recent thing in full, which is what makes the row concrete. */}
            <span className="shrink-0">{history}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{actionSentence(recent[0])}</span>
          </>
        ) : (
          <span>No recorded activity in the last {RECENT_DAYS} days</span>
        )}
      </span>
    </span>
  )
}

export function PeopleDirectory({
  people,
  now = {},
  todayIso,
}: {
  people: UserCapacity[]
  /**
   * Per-person current work and recent history, keyed by user id. Optional and
   * defaulting to empty so the directory still renders if a caller has not
   * fetched it — the rows simply say so rather than the page failing.
   */
  now?: Record<string, PersonNow>
  /** Resolved server-side in the business timezone; never `new Date()` here. */
  todayIso: string
}) {
  // Sort and org are read STRAIGHT from the URL — one source of truth, no
  // mirror state to fall out of sync. The search box keeps a local draft
  // (typing must never wait on anything) and debounces it into the URL.
  const searchParams = useSearchParams()
  const sort = parseSort(searchParams.get('sort'))
  const org = searchParams.get('org')
  const urlQ = searchParams.get('q') ?? ''
  const [search, setSearch] = useState(urlQ)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Adjust-while-rendering (the as-of picker's pattern): when the URL's q
  // changes underneath us — bfcache restore, an external replaceState — the
  // draft follows it. Our own debounced write stores the draft VERBATIM
  // (untrimmed), so the resync after it is always a no-op and can never eat
  // what is being typed; only a genuinely foreign URL change moves the field.
  const [lastUrlQ, setLastUrlQ] = useState(urlQ)
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ)
    if (urlQ !== search) setSearch(urlQ)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    }
  }, [])

  function commitSearch(value: string) {
    setSearch(value)
    if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      // Verbatim, not trimmed — see the resync note above. The row filter
      // trims when matching, so the URL carrying a trailing space is inert.
      writeFilterParams({ q: value })
    }, SEARCH_DEBOUNCE_MS)
  }

  const orgs = useMemo(
    () => [...new Set(people.flatMap((p) => p.user.orgTags))].sort((a, b) => a.localeCompare(b)),
    [people],
  )

  // The chip row is derived from `people`, which changes with the header
  // search, while `org` rides the URL, which survives that navigation. An
  // org that is no longer on screen must not keep filtering — otherwise the
  // whole chip group (including "All") unmounts and there is no way to clear.
  const activeOrg = org && orgs.includes(org) ? org : null

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = people.filter((p) => {
      if (activeOrg && !p.user.orgTags.includes(activeOrg)) return false
      if (!term) return true
      // Name, job title and org all match — typing "engineer" or a client name
      // finds people just as well as typing a name does.
      return [p.user.name, p.user.title ?? '', ...p.user.orgTags]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
    return [...filtered].sort((a, b) => {
      if (sort === 'load-desc') return b.totalPct - a.totalPct
      if (sort === 'load-asc') return a.totalPct - b.totalPct
      return a.user.name.localeCompare(b.user.name)
    })
  }, [people, activeOrg, sort, search])

  // Where the "Over capacity" tile lands: the same view, worst-loaded first,
  // with whatever filter is already applied carried along rather than reset.
  const overHref = useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('sort', 'load-desc')
    if (activeOrg) qs.set('org', activeOrg)
    if (search.trim()) qs.set('q', search.trim())
    return `/people?${qs.toString()}`
  }, [activeOrg, search])

  // Derived from `rows`, not `people`: the strip and the list below it describe
  // the same set, so an org filter can never leave them contradicting each other.
  const stats = useMemo(() => {
    const over = rows.filter((p) => p.overallocated).length
    return [
      { label: 'People', value: rows.length },
      { label: 'Assigned', value: rows.filter((p) => p.breakdown.length > 0).length },
      { label: 'Over capacity', value: over, alert: over > 0 },
      {
        label: 'Avg load %',
        value: rows.length
          ? Math.round(rows.reduce((sum, p) => sum + p.totalPct, 0) / rows.length)
          : 0,
      },
    ]
  }, [rows])

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* The shared StatTile: mono numbers, worded labels — and the one
            alarming figure LINKS to its answering rows (most loaded first)
            instead of naming a problem it won't take you to. */}
        {stats.map((stat) => (
          <StatTile
            key={stat.label}
            label={stat.label}
            value={<StatNumber value={stat.value} />}
            tone={stat.alert ? 'destructive' : 'default'}
            href={stat.alert ? overHref : undefined}
            meta={stat.alert ? 'opens the list worst-loaded first' : undefined}
          />
        ))}
      </div>

      <InputGroup className="w-full max-w-xs">
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        {/* Filters as you type — no submit, no round trip: every person is
            already on the client. */}
        <InputGroupInput
          type="text"
          value={search}
          onChange={(event) => commitSearch(event.target.value)}
          placeholder="Filter by name, role or org — ⌘K fetches everything"
          aria-label="Filter people"
        />
      </InputGroup>

      <div className="flex flex-wrap items-center gap-2">
        {orgs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by organization">
            {/* pointer-coarse:min-h-11 — the surface's own touch-target
                convention (as-of-picker.tsx set it); 26px chips were the
                directory's smallest tap targets. */}
            <button
              type="button"
              aria-pressed={activeOrg === null}
              onClick={() => writeFilterParams({ org: null })}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors duration-150',
                'pointer-coarse:min-h-11 pointer-coarse:px-4',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                activeOrg === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:border-ring/40 hover:text-foreground',
              )}
            >
              All
            </button>
            {orgs.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={activeOrg === tag}
                onClick={() => writeFilterParams({ org: activeOrg === tag ? null : tag })}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors duration-150',
                  'pointer-coarse:min-h-11 pointer-coarse:px-4',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  activeOrg === tag
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:border-ring/40 hover:text-foreground',
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ml-auto">
          <Select
            value={sort}
            onValueChange={(value: string | null) =>
              writeFilterParams({ sort: parseSort(value) })
            }
          >
            <SelectTrigger
              size="sm"
              className="pointer-coarse:min-h-11 h-8 w-44"
              aria-label="Sort people"
            >
              <SelectValue>{(value: string) => SORT_LABEL[value as SortKey]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-8">
          <EmptyState
            icon={PawPrint}
            title={search.trim() ? 'No one matches your search.' : `No one in ${activeOrg} yet.`}
            description={
              search.trim()
                ? 'Try ⌘K — it fetches apps, tasks and meetings too.'
                : 'Clear the filter to see everyone.'
            }
            action={
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setSearch('')
                  writeFilterParams({ q: '', org: null })
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
          {/* Stretched-link rows: the name anchor covers the row via ::after,
              so the whole row navigates while the call button stays a
              separate, valid sibling link above it. */}
          {rows.map(({ user, totalPct, breakdown }) => (
            <li
              key={user.id}
              className={cn(
                'relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3',
                'transition-colors duration-150 hover:bg-accent/50',
                'has-[a:focus-visible]:bg-accent/50',
              )}
            >
              <Avatar>
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 basis-48 flex-col">
                <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                  <Link
                    href={`/people/${user.id}`}
                    className={cn(
                      'truncate rounded-sm after:absolute after:inset-0 after:content-[""]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    {user.name}
                  </Link>
                  {isAdminRole(user.role) ? (
                    // role="img" so the label is actually exposed: an <svg>
                    // has no implicit role, and several screen readers drop
                    // aria-label on an unroled element entirely.
                    <ShieldCheck
                      role="img"
                      aria-label="Admin"
                      className="size-3.5 shrink-0 text-primary"
                    />
                  ) : null}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.title ?? 'No title yet'}
                </span>
                <PersonNowLines now={now[user.id]} todayIso={todayIso} />
              </div>
              {user.orgTags.length > 0 ? (
                <div className="hidden items-center gap-1 md:flex">
                  {user.orgTags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="font-normal text-muted-foreground">
                      {tag}
                    </Badge>
                  ))}
                  {user.orgTags.length > 2 ? (
                    <span className="font-mono text-2xs text-muted-foreground">
                      +{user.orgTags.length - 2}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <span className="hidden max-w-md items-center gap-1.5 overflow-hidden text-xs text-muted-foreground lg:flex">
                {breakdown.length > 0 ? (
                  <>
                    {breakdown.slice(0, 2).map((b) => (
                      /* One chip per project, each wearing ITS color — the
                         dot is the app's event hue, the same one its
                         meetings wear on the calendar, so "the amber one"
                         means the same thing everywhere. The role is the
                         PER-PROJECT one: a manager on one app is a reviewer
                         on another, so it belongs to the pairing. */
                      <span
                        key={b.appId}
                        className="inline-flex min-w-0 items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            eventDotClasses(b.appId) ?? 'bg-muted-foreground/50',
                          )}
                        />
                        <span className="truncate text-foreground">{b.appName}</span>
                        {b.role ? <span className="truncate">· {b.role}</span> : null}
                        <span className="shrink-0 font-mono tabular-nums">{b.allocationPct}%</span>
                      </span>
                    ))}
                    {breakdown.length > 2 ? (
                      <span className="shrink-0 font-mono tabular-nums">
                        +{breakdown.length - 2}
                      </span>
                    ) : null}
                  </>
                ) : (
                  'Unassigned'
                )}
              </span>
              {/* Below sm the meter takes its own full-width line, LAST in
                  the row — a fixed w-40 in this flex-wrap row wrapped under
                  some names and not others at 320-375px, so the meters never
                  lined up column-wise while scanning. */}
              <div className="order-last w-full basis-full shrink-0 sm:order-none sm:w-40 sm:basis-auto">
                <CapacityBar totalPct={totalPct} />
              </div>
              {/* relative z-10 lifts the anchors above the row's
                  stretched-link overlay, same as the old call button. */}
              <ContactButtons
                name={user.name}
                phone={user.phone}
                context={breakdown[0]?.appName}
                className="relative z-10"
              />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
