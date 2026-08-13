'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
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

type SortKey = 'name' | 'load-desc' | 'load-asc'

const SORT_LABEL: Record<SortKey, string> = {
  name: 'Name A–Z',
  'load-desc': 'Most loaded first',
  'load-asc': 'Least loaded first',
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
  const [sort, setSort] = useState<SortKey>('name')
  const [org, setOrg] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const orgs = useMemo(
    () => [...new Set(people.flatMap((p) => p.user.orgTags))].sort((a, b) => a.localeCompare(b)),
    [people],
  )

  // The chip row is derived from `people`, which changes with the header
  // search, while `org` is component state that survives that navigation. An
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
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5 rounded-xl border bg-card p-3">
            <span className={cn('font-mono text-xl font-semibold', stat.alert && 'text-destructive')}>
              <StatNumber value={stat.value} />
            </span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
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
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by name, role or org — ⌘K fetches everything"
          aria-label="Filter people"
        />
      </InputGroup>

      <div className="flex flex-wrap items-center gap-2">
        {orgs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by organization">
            <button
              type="button"
              aria-pressed={activeOrg === null}
              onClick={() => setOrg(null)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors duration-150',
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
                onClick={() => setOrg(activeOrg === tag ? null : tag)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors duration-150',
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
          <Select value={sort} onValueChange={(value: string | null) => setSort((value as SortKey) ?? 'name')}>
            <SelectTrigger size="sm" className="h-8 w-44" aria-label="Sort people">
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
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
          <PawPrint className="size-8 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-heading font-semibold">
              {search.trim() ? 'No one matches your search.' : `No one in ${activeOrg} yet.`}
            </p>
            <p className="text-sm text-muted-foreground">
              {search.trim()
                ? 'Try ⌘K — it fetches apps, tasks and meetings too.'
                : 'Clear the filter to see everyone.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              setSearch('')
              setOrg(null)
            }}
          >
            Clear filters
          </Button>
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
                  {user.role === 'admin' ? (
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
              <span className="hidden max-w-56 truncate text-xs text-muted-foreground lg:block">
                {breakdown.length > 0 ? (
                  <>
                    {breakdown.slice(0, 2).map((b, i) => (
                      <span key={b.appName}>
                        {i > 0 ? ' · ' : ''}
                        {b.appName}
                        {/* The PER-PROJECT role — the same person is a
                            manager on one app and a reviewer on another,
                            so the role belongs to the pairing, not the
                            person. */}
                        {b.role ? (
                          <span className="text-muted-foreground/80"> — {b.role}</span>
                        ) : null}{' '}
                        <span className="font-mono tabular-nums">{b.allocationPct}%</span>
                      </span>
                    ))}
                    {breakdown.length > 2 ? (
                      <span className="font-mono tabular-nums"> +{breakdown.length - 2}</span>
                    ) : null}
                  </>
                ) : (
                  'Unassigned'
                )}
              </span>
              <div className="w-40 shrink-0">
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
