import Link from 'next/link'
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ClockAlertIcon,
  LayersIcon,
  MinusIcon,
  UsersIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { CapacityBar, capacityBand } from '@/features/people/components/capacity-bar'
import { SectionEmpty } from '@/features/people/components/section-empty'
import { formatPct, PCT_CLASS } from '@/features/people/format-pct'
import { formatBusinessDayMonthTime } from '@/features/people/format-instant'
import { describeAllocationChange } from '@/features/people/allocation-history'
import { historyHref, type HistoryParams } from '@/features/people/history-params'
import type {
  AppLoadRow,
  CapacityDelta,
  OverloadStretch,
  TeamChangeEntry,
} from '@/features/people/capacity-compare'
import type { UserCapacity } from '@/features/people/queries'

/**
 * The three slices of the capacity-history page, plus the overload card. All
 * server components — every one is a read, and the page's interactivity lives
 * entirely in the URL (see history-filters.tsx).
 *
 * The shared discipline: a number never appears without the thing it should
 * be compared against. A load is shown against 100%, a delta against where it
 * came from, an app's total against the heaviest app, a change against what
 * it replaced. That is the difference between a page that reports state and
 * one somebody can decide from.
 */

const linkFocus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

/** How a delta renders — direction carried by an arrow AND a sign, not colour. */
function DeltaBadge({ deltaPct }: { deltaPct: number }) {
  if (deltaPct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <MinusIcon className="size-3" aria-hidden />
        no change
      </span>
    )
  }
  const up = deltaPct > 0
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon
  return (
    // Heavier is not automatically bad and lighter is not automatically good,
    // so this stays neutral: it states direction, not judgement. Only the
    // resulting LOAD gets a capacity colour, in its own column.
    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
      <Icon className="size-3" aria-hidden />
      <span className={PCT_CLASS}>
        {up ? '+' : '−'}
        {Math.abs(deltaPct)}%
      </span>
    </span>
  )
}

function PersonCell({ person }: { person: UserCapacity }) {
  return (
    <Link
      href={`/people/${person.user.id}`}
      className={cn('flex min-w-0 items-center gap-2 rounded-md hover:underline', linkFocus)}
    >
      <Avatar className="size-7 shrink-0">
        {person.user.avatarUrl ? <AvatarImage src={person.user.avatarUrl} alt="" /> : null}
        <AvatarFallback>{person.user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{person.user.name}</span>
        {person.user.title ? (
          <span className="truncate text-2xs text-muted-foreground">{person.user.title}</span>
        ) : null}
      </span>
    </Link>
  )
}

/**
 * The way out of a filter-caused empty state.
 *
 * It is rendered ONLY where a filter is actually set, and only where that
 * filter narrows the list in front of the reader — a button offering to reveal
 * rows that would still not appear is worse than prose. `historyHref` keeps the
 * date, window and view, so clearing a filter does not also throw away the
 * question somebody came here with.
 */
function ClearFilterButton({ href, label = 'Clear the filter' }: { href: string; label?: string }) {
  return (
    <Button variant="outline" size="sm" render={<Link href={href} />}>
      {label}
    </Button>
  )
}

const BAND_WORD = {
  over: 'Over capacity',
  near: 'Near capacity',
  normal: 'Has headroom',
} as const

/**
 * Person view: current load, where it came from, and exactly which apps make
 * it up — including the per-app percentages the dashboard's compact heat list
 * has to omit for space, which is precisely the number needed to decide what
 * to move off someone's plate.
 */
export function HistoryPeopleTable({
  people,
  deltas,
  compareLabel,
  params,
}: {
  people: UserCapacity[]
  deltas: Map<string, CapacityDelta>
  /** What the comparison column is measured against, e.g. "30 days earlier". */
  compareLabel: string
  /** Current URL state — the only thing that can name the filter and undo it. */
  params: HistoryParams
}) {
  if (people.length === 0) {
    // Both the text filter and "only what moved" narrow THIS list, so either
    // one being set means rows are hidden rather than absent. With neither
    // set the roster itself is empty, and the honest answer is prose.
    const filtered = Boolean(params.q || params.movedOnly)
    return (
      <Card>
        <SectionEmpty
          icon={UsersIcon}
          title="Nobody matches this view"
          hint={
            params.q && params.movedOnly
              ? `Nothing matches the text filter and moved-since-${compareLabel} together.`
              : params.q
                ? 'Nothing on this date matches the text filter above.'
                : params.movedOnly
                  ? `Nobody’s load or app list is different from ${compareLabel}.`
                  : 'The roster is empty, so there is no load to show.'
          }
          action={
            filtered ? (
              <ClearFilterButton
                href={historyHref(params, { q: '', movedOnly: false })}
                label={params.q && params.movedOnly ? 'Clear both filters' : 'Clear the filter'}
              />
            ) : undefined
          }
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Who is carrying what</CardTitle>
        <CardDescription>
          Load on the chosen date, against {compareLabel}. Percentages are of one person&rsquo;s full
          capacity.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-44">Person</TableHead>
                <TableHead className="min-w-40">Load</TableHead>
                <TableHead className="min-w-28">vs {compareLabel}</TableHead>
                <TableHead className="min-w-56">Apps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => {
                const delta = deltas.get(person.user.id)
                const band = capacityBand(person.totalPct)
                return (
                  <TableRow key={person.user.id}>
                    <TableCell>
                      <PersonCell person={person} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="flex items-baseline gap-1.5">
                          <span
                            className={cn(
                              PCT_CLASS,
                              'text-sm font-semibold',
                              band === 'over' && 'text-destructive',
                              band === 'near' && 'text-chart-1',
                            )}
                          >
                            {formatPct(person.totalPct)}
                          </span>
                          {/* The word carries the band; colour only reinforces
                              it (WCAG 1.4.1 — the rule capacity-bar states). */}
                          <span className="text-2xs text-muted-foreground">{BAND_WORD[band]}</span>
                        </span>
                        <CapacityBar totalPct={person.totalPct} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <DeltaBadge deltaPct={delta?.deltaPct ?? 0} />
                        <span className={cn(PCT_CLASS, 'text-2xs text-muted-foreground')}>
                          was {formatPct(delta?.fromPct ?? person.totalPct)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {person.breakdown.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Nothing assigned — free to take work
                        </span>
                      ) : (
                        <ul className="flex flex-wrap gap-1">
                          {person.breakdown.map((row) => (
                            <li key={row.appId}>
                              <Link
                                href={`/apps/${row.slug}`}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-2xs hover:bg-muted',
                                  linkFocus,
                                )}
                              >
                                <span className="max-w-32 truncate">{row.appName}</span>
                                <span className={cn(PCT_CLASS, 'text-muted-foreground')}>
                                  {formatPct(row.allocationPct)}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                      {delta && (delta.addedApps.length > 0 || delta.droppedApps.length > 0) ? (
                        <p className="mt-1 text-2xs text-muted-foreground">
                          {delta.addedApps.length > 0 ? `Picked up ${delta.addedApps.join(', ')}` : null}
                          {delta.addedApps.length > 0 && delta.droppedApps.length > 0 ? ' · ' : null}
                          {delta.droppedApps.length > 0 ? `Left ${delta.droppedApps.join(', ')}` : null}
                        </p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * App view: the same snapshot pivoted onto projects. The people-equivalent
 * figure is the one that matters — "this app is consuming 2.4 people"
 * answers a staffing question that a list of names never does.
 */
export function HistoryAppsTable({
  apps,
  params,
}: {
  apps: AppLoadRow[]
  /** Current URL state — the only thing that can name the filter and undo it. */
  params: HistoryParams
}) {
  if (apps.length === 0) {
    // Only the text filter reaches this rollup. "Only what moved" is a
    // per-person comparison and never narrows the app list, so offering to
    // clear it here would send the reader back to the same empty table.
    return (
      <Card>
        <SectionEmpty
          icon={LayersIcon}
          title="No app had anyone on it"
          hint={
            params.q
              ? 'Nobody was allocated to any app on this date, or the filter excluded them all.'
              : 'Nobody was allocated to any app on this date.'
          }
          action={
            params.q ? <ClearFilterButton href={historyHref(params, { q: '' })} /> : undefined
          }
        />
      </Card>
    )
  }

  const heaviest = apps[0].totalPct

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Where the effort went</CardTitle>
        <CardDescription>
          Every app someone was allocated to on this date, heaviest first. &ldquo;People&rdquo; is the
          allocation total, not a headcount — 240% is roughly two and a half people&rsquo;s time.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-40">App</TableHead>
                <TableHead className="min-w-40">Share of the team</TableHead>
                <TableHead className="min-w-24">People</TableHead>
                <TableHead className="min-w-56">Who</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app) => (
                <TableRow key={app.appId}>
                  <TableCell>
                    <Link
                      href={`/apps/${app.slug}`}
                      className={cn('text-sm font-medium hover:underline', linkFocus)}
                    >
                      {app.appName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className={cn(PCT_CLASS, 'text-sm font-semibold')}>
                        {formatPct(app.totalPct)}
                      </span>
                      {/* Bars share ONE denominator (the heaviest app), so
                          their lengths are comparable to each other — a
                          per-row scale would make every app look equally busy. */}
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={`${formatPct(app.totalPct)} allocated, against ${formatPct(heaviest)} for the heaviest app`}
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${heaviest === 0 ? 0 : (app.totalPct / heaviest) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn(PCT_CLASS, 'text-sm')}>{(app.totalPct / 100).toFixed(1)}</span>
                    <span className="ml-1 text-2xs text-muted-foreground">
                      ({app.headcount} {app.headcount === 1 ? 'person' : 'people'})
                    </span>
                  </TableCell>
                  <TableCell>
                    <ul className="flex flex-wrap gap-1">
                      {app.people.map((person) => (
                        <li key={person.userId}>
                          <Link
                            href={`/people/${person.userId}`}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-2xs hover:bg-muted',
                              linkFocus,
                            )}
                          >
                            <span className="max-w-32 truncate">{person.name}</span>
                            <span className={cn(PCT_CLASS, 'text-muted-foreground')}>
                              {formatPct(person.allocationPct)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Change log: who changed whose allocation, when, and why.
 *
 * `changedBy` and `note` have been written on every history row since the
 * table existed, and have never been shown outside one person's own page —
 * which meant "why is Anu suddenly at 130%?" had no answer anywhere in the
 * product. This is that answer.
 */
export function HistoryChangeLog({
  changes,
  params,
}: {
  changes: TeamChangeEntry[]
  /** Current URL state — the only thing that can name the filter and undo it. */
  params: HistoryParams
}) {
  if (changes.length === 0) {
    // Same rule as the app rollup: only the text filter narrows this list, so
    // it is the only thing there is anything to clear.
    return (
      <Card>
        <SectionEmpty
          icon={ClockAlertIcon}
          title="Nothing changed in this window"
          hint={
            params.q
              ? 'Or the filter excluded it — clearing it may bring rows back.'
              : 'Only edits made inside the window land here — the date and window above set which stretch that is.'
          }
          action={
            params.q ? <ClearFilterButton href={historyHref(params, { q: '' })} /> : undefined
          }
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">What changed, and who changed it</CardTitle>
        <CardDescription>
          Every allocation edit inside the window, newest first — with the note whoever made the
          change left behind.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="flex flex-col divide-y divide-border">
          {changes.map((change) => (
            <li
              key={change.id}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-6 py-2.5"
            >
              {/* Business timezone (format-instant.ts) — this is a server
                  component, so date-fns format() here stamped every change in
                  the SERVER's zone (UTC on Vercel), hours off the day the
                  as-of picker above resolves in. */}
              <time
                dateTime={change.effectiveFrom.toISOString()}
                className="w-32 shrink-0 font-mono text-2xs tabular-nums text-muted-foreground"
              >
                {formatBusinessDayMonthTime(change.effectiveFrom)}
              </time>
              <span className="min-w-0 flex-1 text-sm">
                <Link
                  href={`/people/${change.userId}`}
                  className={cn('font-medium hover:underline', linkFocus)}
                >
                  {change.userName ?? 'Someone'}
                </Link>{' '}
                on{' '}
                <Link
                  href={`/apps/${change.slug}`}
                  className={cn('font-medium hover:underline', linkFocus)}
                >
                  {change.appName}
                </Link>
                <span className="text-muted-foreground"> — {describeAllocationChange(change)}</span>
                {change.note ? (
                  <span className="text-muted-foreground"> · &ldquo;{change.note}&rdquo;</span>
                ) : null}
              </span>
              <span className="shrink-0 text-2xs text-muted-foreground">
                by {change.changedByName ?? 'a since-removed account'}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/**
 * The card that answers a question no snapshot can: not "who is over
 * capacity" but "who has BEEN over, and for how long". A day at 110% is a
 * busy day; three weeks at 110% is a staffing decision waiting to be made.
 */
export function OverloadCard({
  overloads,
  windowDays,
}: {
  overloads: (OverloadStretch & { name: string })[]
  windowDays: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Time spent over capacity</CardTitle>
        <CardDescription>
          Continuous stretches above 100% in the last {windowDays} days, longest first.
        </CardDescription>
      </CardHeader>
      {overloads.length === 0 ? (
        <SectionEmpty
          icon={ClockAlertIcon}
          title="Nobody went over capacity"
          hint={`No one exceeded 100% at any point in this ${windowDays}-day window.`}
        />
      ) : (
        <CardContent>
          <ul className="flex flex-col gap-2">
            {overloads.map((stretch) => (
              <li
                key={`${stretch.userId}-${stretch.start.toISOString()}`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
              >
                <Link
                  href={`/people/${stretch.userId}`}
                  className={cn('text-sm font-medium hover:underline', linkFocus)}
                >
                  {stretch.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  <span className={cn(PCT_CLASS, 'font-medium text-destructive')}>
                    {stretch.days === 0 ? 'under a day' : `${stretch.days} ${stretch.days === 1 ? 'day' : 'days'}`}
                  </span>{' '}
                  {stretch.end === null ? 'and still over' : 'over'} · peaked at{' '}
                  <span className={PCT_CLASS}>{formatPct(stretch.peakPct)}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}
