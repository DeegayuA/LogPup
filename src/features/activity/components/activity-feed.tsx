import type { ReactNode } from 'react'
import Link from 'next/link'
import { format, formatDistance } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { formatBusinessDayMonth, formatBusinessTime } from '@/features/people/format-instant'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { eventDotClasses } from '@/features/meetings/event-color'
import { activityFilterHref } from '@/features/activity/describe'
import {
  activityDaySummary,
  activityPhrase,
  activityPhraseParts,
  groupActivityByDay,
  groupActivityBursts,
} from '@/features/activity/format'
import type { ActivityParamState } from '@/features/activity/filters'
import type { ActivityRow } from '@/features/activity/types'

/**
 * The trail, in two densities.
 *
 * `ActivityFeed` — flat, time-ago, avatar per row — is the dashboard's
 * Recent-activity card: ten rows, glanced at, never filtered.
 *
 * `ActivityTrail` (below) is /activity: a day-grouped, burst-collapsed,
 * colour-railed instrument for finding one change among hundreds. See
 * docs/superpowers/specs/2026-08-13-activity-redesign-design.md.
 *
 * Both are server-rendered end to end. A log line never changes after the
 * fact, and every affordance here is a link or a native `<details>`, so there
 * is nothing on this surface worth shipping JavaScript for.
 */

/* ------------------------------------------------------------------ *
 * Flat variant — the dashboard card. Unchanged in substance.
 * ------------------------------------------------------------------ */

function FlatRow({ row, timeLabel }: { row: ActivityRow; timeLabel: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Avatar size="sm" className="mt-0.5">
        {row.actorAvatarUrl ? <AvatarImage src={row.actorAvatarUrl} alt={row.actorName} /> : null}
        <AvatarFallback>{row.actorName.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm leading-snug">
          <span className="font-medium">{row.actorName}</span>{' '}
          <span className="text-muted-foreground">{activityPhrase(row)}</span>{' '}
          {row.pagePath ? (
            <Link href={row.pagePath} className="font-medium hover:underline">
              {row.entityLabel}
            </Link>
          ) : (
            <span className="font-medium">{row.entityLabel}</span>
          )}
          {row.detail ? <span className="text-muted-foreground"> {row.detail}</span> : null}
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{timeLabel}</span>
          {row.appName ? (
            <Badge variant="secondary" className="text-xs">
              {row.appName}
            </Badge>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function ActivityFeed({
  rows,
  now,
}: {
  rows: ActivityRow[]
  /** Passed in so server render and tests agree on what "ago" means. */
  now: Date
}) {
  if (rows.length === 0) return null
  return (
    <ul className="flex flex-col divide-y divide-border">
      {rows.map((row) => (
        <FlatRow
          key={row.id}
          row={row}
          // `formatDistance(…, now)`, not `formatDistanceToNow(…)`: the latter
          // reads the wall clock, so the `now` prop above documented a
          // determinism it never actually delivered.
          timeLabel={formatDistance(row.createdAt, now, { addSuffix: true })}
        />
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ *
 * Trail variant — /activity.
 * ------------------------------------------------------------------ */

/** Focus ring shared by every link in the trail, matching the UI primitives. */
const FOCUS = 'rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * A one-click filter built from a row's own words.
 *
 * The accessible name says what the link DOES (it filters; it does not
 * navigate to the person) and contains the visible text verbatim, so speech
 * input still works — WCAG 2.5.3, Label in Name.
 *
 * Hover is DOTTED. Two kinds of link sit in the same sentence and do opposite
 * things: this one narrows the page you are on, while the subject link leaves
 * it. A shared solid underline would make them indistinguishable until after
 * the click; dotted-versus-solid is the cheapest honest distinction, and it
 * never carries meaning by colour alone.
 */
function FilterLink({
  href,
  label,
  className,
  children,
}: {
  href: string
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${FOCUS} underline-offset-2 hover:underline hover:decoration-dotted ${className ?? ''}`}
    >
      {children}
    </Link>
  )
}

/**
 * The rail node. Its hue is the PRODUCT, from the one identity-colour system
 * (features/meetings/event-color.ts) — so scanning the rail shows colour bands
 * and answers "does any of this touch my app" before a word is read.
 *
 * A change with no app gets a neutral node rather than a default hue: a colour
 * meaning "no product" would read as just another product.
 *
 * WCAG 1.4.1 — the hue is keyed off `appName`, not `appId`, so a row is only
 * ever coloured when the product is ALSO named in text on that same row (as
 * the app chip, or as the subject itself when the change is to the app). Rows
 * do exist with an appId and no name: ~31 logActivity call sites record an id
 * with no name in scope, and listActivity now COALESCEs the live apps.name to
 * cover them — but where even that resolves to nothing, the node stays neutral
 * rather than becoming grouping information carried by colour alone.
 */
function RailNode({ row }: { row: ActivityRow }) {
  return (
    <span
      aria-hidden
      className={`absolute top-3.5 left-0 size-2 -translate-x-1/2 rounded-full ring-2 ring-background ${
        (row.appName ? eventDotClasses(row.appId) : null) ?? 'bg-muted-foreground/50'
      }`}
    />
  )
}

/**
 * The app, as a filter. Padding-based rather than the fixed-height `Badge`
 * primitive: app names are user text and this UI is bilingual — Sinhala renders
 * taller than Latin, and `Badge`'s `h-5 overflow-hidden` would clip it.
 *
 * An app whose row carries a name but no id (the app was deleted; only the
 * denormalised name survives) renders as plain text — there is no id to filter
 * by, and a link that silently does nothing is worse than no link.
 */
function AppChip({ row, current }: { row: ActivityRow; current: ActivityParamState }) {
  if (!row.appName) return null
  // A change to the APP ITSELF already names the app as its subject, so the
  // chip would render the same string twice in a row ("changed app PM Test App
  // — PM Test App"). Seen on real data; suppressed by comparing the strings
  // rather than by special-casing entityType, which also catches a task or
  // meeting that happens to be named after its app.
  if (row.appName === row.entityLabel) return null
  const className =
    'ml-1 inline-block rounded-md bg-muted px-1.5 py-px align-baseline text-2xs text-muted-foreground'
  if (!row.appId) return <span className={className}>{row.appName}</span>
  return (
    <FilterLink
      href={activityFilterHref(current, { app: row.appId })}
      label={`Filter activity by ${row.appName}`}
      className={`${className} transition-colors duration-150 ease-out hover:bg-accent hover:text-accent-foreground motion-reduce:transition-none`}
    >
      {row.appName}
    </FilterLink>
  )
}

/** The entity, linked to itself when the write recorded a destination. */
function Subject({ row }: { row: ActivityRow }) {
  if (!row.pagePath) return <span className="font-medium">{row.entityLabel}</span>
  return (
    <Link href={row.pagePath} className={`${FOCUS} font-medium underline-offset-2 hover:underline`}>
      {row.entityLabel}
    </Link>
  )
}

/**
 * "Prabuddha Silva moved task Fix login to In progress" — read as a sentence,
 * with the actor and the entity-type WORD each a one-click filter and the
 * entity itself a link to the thing that changed.
 *
 * The entity type is linked rather than repeated as a chip: the word already
 * carries the meaning and already sits where the eye is.
 */
function Sentence({ row, current }: { row: ActivityRow; current: ActivityParamState }) {
  const { verb, entityType } = activityPhraseParts(row)
  return (
    <>
      <FilterLink
        href={activityFilterHref(current, { person: row.actorId })}
        label={`Filter activity by ${row.actorName}`}
        className="font-medium"
      >
        {row.actorName}
      </FilterLink>{' '}
      <span className="text-muted-foreground">{verb}</span>{' '}
      {entityType ? (
        <>
          {/* entity_type is a text column, so a one-off value that isn't in
              ACTIVITY_ENTITY_TYPES can appear here. The link still builds; the
              page's Zod schema catches the unknown value and degrades it to
              "not filtered", which is the same contract a hand-edited URL
              gets. Never a crash, never an empty page. */}
          <FilterLink
            href={activityFilterHref(current, { type: entityType })}
            label={`Filter activity by ${entityType} changes`}
            className="text-muted-foreground"
          >
            {entityType}
          </FilterLink>{' '}
        </>
      ) : null}
      <Subject row={row} />
      {row.detail ? <span className="text-muted-foreground"> {row.detail}</span> : null}
    </>
  )
}

/**
 * Right-hand clock column, so a day's chronology reads straight down.
 *
 * `min-w`, not a fixed `w`: a burst's time RANGE ("6:57 PM – 7:02 PM") is more
 * than twice as wide as a single time and wrapped mid-range inside a fixed
 * column. Column alignment does not depend on the width anyway — the row is
 * `justify-between`, so every time sits flush to the same right edge; the
 * minimum only stops a lone short time from crowding the sentence.
 */
function TrailTime({ children, dateTime }: { children: ReactNode; dateTime?: string }) {
  return (
    <time
      dateTime={dateTime}
      className="shrink-0 font-mono text-2xs whitespace-nowrap tabular-nums text-muted-foreground sm:min-w-24 sm:text-right"
    >
      {children}
    </time>
  )
}

function TrailEvent({
  row,
  current,
  withDate = false,
}: {
  row: ActivityRow
  current: ActivityParamState
  /**
   * Print the DAY alongside the clock time.
   *
   * Only the grouped trail has a day header to inherit a date from. In search
   * results there is none — and those rows are ordered by RELEVANCE, so
   * position carries no date either. Without this a hit from last month is
   * indistinguishable from one an hour old, which is precisely the question a
   * search result has to answer.
   */
  withDate?: boolean
}) {
  return (
    <li className="relative pl-5">
      <RailNode row={row} />
      <div className="flex flex-col gap-x-3 gap-y-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="min-w-0 text-sm/6">
          <Sentence row={row} current={current} />
          <AppChip row={row} current={current} />
        </p>
        {/* formatBusiness*, NOT date-fns format: this renders on the server,
            where format() resolves in the server's zone (UTC on Vercel) while
            the day header above it is bucketed in Asia/Colombo — so a 3 AM
            Colombo event would file under "Today" and print "9:30 PM". See
            features/people/format-instant.ts. */}
        <TrailTime dateTime={row.createdAt.toISOString()}>
          {withDate
            ? `${formatBusinessDayMonth(row.createdAt)} · ${formatBusinessTime(row.createdAt)}`
            : formatBusinessTime(row.createdAt)}
        </TrailTime>
      </div>
    </li>
  )
}

/**
 * One edit session, collapsed. See groupActivityBursts for the rule.
 *
 * The disclosure is a native `<details>` whose `<summary>` contains no
 * interactive descendants — the actor/type/app links live in the sentence
 * ABOVE it. Nesting a link inside a summary means one click both navigates and
 * toggles, and is an accessibility smell besides.
 */
function TrailBurst({ rows, current }: { rows: ActivityRow[]; current: ActivityParamState }) {
  // Rows arrive newest-first, so the range runs from the LAST to the first.
  const newest = rows[0]
  const oldest = rows[rows.length - 1]
  const startLabel = formatBusinessTime(oldest.createdAt)
  const endLabel = formatBusinessTime(newest.createdAt)
  const { entityType } = activityPhraseParts(newest)

  return (
    <li className="relative pl-5">
      <RailNode row={newest} />
      <div className="flex flex-col gap-x-3 gap-y-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm/6">
            <FilterLink
              href={activityFilterHref(current, { person: newest.actorId })}
              label={`Filter activity by ${newest.actorName}`}
              className="font-medium"
            >
              {newest.actorName}
            </FilterLink>{' '}
            <span className="text-muted-foreground">changed</span>{' '}
            {entityType ? (
              <>
                <FilterLink
                  href={activityFilterHref(current, { type: entityType })}
                  label={`Filter activity by ${entityType} changes`}
                  className="text-muted-foreground"
                >
                  {entityType}
                </FilterLink>{' '}
              </>
            ) : null}
            <Subject row={newest} />
            <AppChip row={newest} current={current} />
          </p>

          <details className="group mt-0.5">
            <summary
              className={`${FOCUS} inline-flex cursor-pointer list-none items-center gap-1 py-0.5 text-2xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden`}
            >
              <ChevronRight
                aria-hidden
                className="size-3 shrink-0 transition-transform duration-150 ease-out group-open:rotate-90 motion-reduce:transition-none"
              />
              <span className="font-mono tabular-nums">{rows.length}</span> changes
            </summary>
            <ol className="mt-1 ml-1.5 flex flex-col gap-1 border-l border-border pt-1 pl-3">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-baseline gap-x-2 text-2xs/5">
                  <time
                    dateTime={row.createdAt.toISOString()}
                    className="font-mono tabular-nums text-muted-foreground"
                  >
                    {formatBusinessTime(row.createdAt)}
                  </time>
                  <span>{activityPhraseParts(row).verb}</span>
                  {row.detail ? (
                    <span className="text-muted-foreground">{row.detail}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
        </div>
        <TrailTime>
          {startLabel === endLabel ? endLabel : `${startLabel} – ${endLabel}`}
        </TrailTime>
      </div>
    </li>
  )
}

/**
 * The day marker: what day, how much weight it carries, and a way to keep only
 * it. The weight ("18 changes · 5 people") is what lets a reader skip a quiet
 * day without reading it — the single cheapest thing this page can offer
 * someone scanning for an exception.
 */
function DayMarker({
  dayIso,
  relativeLabel,
  rows,
  current,
}: {
  dayIso: string
  relativeLabel: string
  rows: ActivityRow[]
  current: ActivityParamState
}) {
  const { changes, people } = activityDaySummary(rows)
  // Midday, not midnight: `new Date('…T00:00:00')` is parsed as LOCAL time, and
  // a local midnight is not a real instant on a spring-forward day. Only the
  // weekday name is taken from it — the date itself is printed from the ISO
  // string, which is already the Asia/Colombo answer.
  const weekday = format(new Date(`${dayIso}T12:00:00`), 'EEEE')

  return (
    <h2 className="sticky top-14 z-10 -mx-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 bg-background/90 px-2 py-1.5 backdrop-blur">
      <Link
        href={activityFilterHref(current, { from: dayIso, to: dayIso })}
        aria-label={`Filter activity to ${weekday} ${dayIso} only`}
        // Dotted like every other filter affordance on the page — see FilterLink.
        className={`${FOCUS} inline-flex items-baseline gap-2 underline-offset-4 hover:underline hover:decoration-dotted`}
      >
        <span className="text-xs font-semibold tracking-wide uppercase">
          {relativeLabel || weekday}
        </span>
        <span className="font-mono text-2xs tabular-nums text-muted-foreground">{dayIso}</span>
      </Link>
      <span className="font-mono text-2xs tabular-nums text-muted-foreground">
        {changes} {changes === 1 ? 'change' : 'changes'} · {people}{' '}
        {people === 1 ? 'person' : 'people'}
      </span>
    </h2>
  )
}

/**
 * /activity's feed: day-grouped, burst-collapsed, hung off one continuous rail.
 *
 * `grouped` is false exactly when a search is active. Then rows are ordered by
 * RELEVANCE (rankActivityMatches / fuzzyActivityFallback), and both day
 * grouping and burst collapsing are suppressed — each is a statement about
 * chronological adjacency, and neither is true of a ranked list. The searched
 * trail stays flat so its ranking is visible rather than re-shuffled.
 */
export function ActivityTrail({
  rows,
  now,
  grouped,
  current,
}: {
  rows: ActivityRow[]
  /** Passed in so server render and tests agree on what "today" means. */
  now: Date
  grouped: boolean
  current: ActivityParamState
}) {
  if (rows.length === 0) return null

  if (!grouped) {
    return (
      <ol className="ml-2 flex flex-col border-l border-border">
        {rows.map((row) => (
          // withDate: these rows have no day header above them and are ordered
          // by relevance, so the row itself is the only thing that can say when
          // this happened.
          <TrailEvent key={row.id} row={row} current={current} withDate />
        ))}
      </ol>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groupActivityByDay(rows, now).map((group) => (
        <section key={group.dayIso} className="flex flex-col gap-1">
          <DayMarker
            dayIso={group.dayIso}
            relativeLabel={group.relativeLabel}
            rows={group.rows}
            current={current}
          />
          {/* Bursts are computed per DAY, so one can never span midnight and
              print a time range that crosses a day header. */}
          <ol className="ml-2 flex flex-col border-l border-border">
            {groupActivityBursts(group.rows).map((entry) =>
              entry.kind === 'event' ? (
                <TrailEvent key={entry.key} row={entry.row} current={current} />
              ) : (
                <TrailBurst key={entry.key} rows={entry.rows} current={current} />
              ),
            )}
          </ol>
        </section>
      ))}
    </div>
  )
}
