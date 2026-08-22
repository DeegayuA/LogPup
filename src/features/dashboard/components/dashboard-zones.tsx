import type { ReactNode } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { AtSign, CalendarCheck, FileCheck, LayoutGrid, ListTodo, PawPrint } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatTile } from '@/components/ui/stat-tile'
import { cn } from '@/lib/utils'
import { can, type Actor } from '@/features/auth/capabilities'
import {
  zoneScope,
  type AdmittingGrant,
  type ZoneId,
} from '@/features/dashboard/zones'
import {
  getPersonFollowups,
  getPersonMeetings,
  getPersonWorkload,
  getTeamForApp,
  getUserCapacities,
  listAssignableApps,
} from '@/features/people/queries'
import { isoDayAdd, isoDayOf } from '@/features/people/iso-day'
import { dueState, summarizeOpenTasks, type PersonTaskRow } from '@/features/people/task-workload'
import { getCoverage } from '@/features/worklog/coverage-queries'
import {
  getTeamApprovedAbsences,
  getTeamRoster,
  getTeamWorklogs,
} from '@/features/worklog/queries'
import { CoverageFigure } from '@/features/admin/components/coverage-figure'
import { getApprovalsInbox, type InboxRequest } from '@/features/admin/change-request-queries'
import { HealthDot } from '@/features/apps/components/health-dot'
import type { AppPortfolioEntry } from '@/features/apps/queries'
import type { HealthLevel } from '@/features/apps/app-health'
import { MeetingLoadCard } from '@/features/meeting-load/components/meeting-load-card'
import { getSuggestionsAggregate, getWeeklyLoadTable } from '@/features/meeting-load/queries'
import { buildLoadTrend } from '@/features/meeting-load/trend-points'
import { getAllDecidedKeys } from '@/features/meeting-load/admin-queries'
import { getActiveSprints, getNextUpcomingSprint } from '@/features/sprints/queries'
import { listApps } from '@/features/apps/queries'
import { summarizePortfolio } from '@/features/apps/app-health'
import { browseHref, parseBrowseParams } from '@/features/apps/browse'
import { PortfolioSummaryStrip } from '@/features/apps/components/portfolio-summary'
import { listNotifications, unreadNotificationCount } from '@/features/notifications/queries'
import { listRecentActivity } from '@/features/activity/queries'
import { listPendingUsers } from '@/features/admin/queries'
import { PendingApprovalsCard } from '@/features/admin/components/pending-approvals-card'
import { getBriefing } from '@/features/intel/actions'
import { BriefingCard } from '@/features/intel/components/briefing-card'
import { BriefingCardSkeleton } from '@/features/intel/components/intel-skeletons'
import { CapacityHeat } from '@/features/dashboard/components/capacity-heat'
import { ActiveSprints } from '@/features/dashboard/components/active-sprints'
import { NotificationsCard } from '@/features/dashboard/components/notifications-card'
import { RecentActivityCard } from '@/features/dashboard/components/recent-activity-card'
import { buildMyDayStats } from '@/features/dashboard/my-day-stats'
import {
  aiEngineTotals,
  buildAiEngineRows,
  formatTokenCount,
  sortAiEngineRows,
} from '@/features/dashboard/ai-engine'
import { AiEngineCard } from '@/features/dashboard/components/ai-engine-card'
import { getAiPrefs } from '@/features/gemini/prefs'
import { formatUsd } from '@/features/gemini/pricing'
import { aggregateAiUsage, listPoolKeyHealth } from '@/features/gemini/queries'
import { assessRecordingReadiness } from '@/features/gemini/readiness'
import { summarizeUsage, totalsFor } from '@/features/gemini/usage-summary'
import type { PersonStat, StatTone } from '@/features/people/person-stats'
import { PersonTasksCard } from '@/features/people/components/person-tasks-card'
import { PersonFollowupsCard } from '@/features/people/components/person-followups-card'
import { PersonMeetingsCard } from '@/features/people/components/person-meetings-card'

/**
 * STREAMING UI — the dashboard as independent zones instead of one wait.
 *
 * WHICH zones is not decided here. `composeDashboard` (features/dashboard/
 * zones.ts) answers that from the actor's capabilities, and hands each zone
 * the grant level that admitted it; this file only knows how to draw one and
 * how far the grant lets it read.
 *
 * The page used to be a single `Promise.all` of eleven reads followed by one
 * render. Running them together was right; making the whole page wait for the
 * slowest one was not. The portfolio scan (`listApps` is five aggregates over
 * every app) and the capacity roll-up are the heavy reads, and they were
 * holding up the four numbers at the top — the part someone actually opens
 * this page for, and the part that is cheapest to produce.
 *
 * Split across `<Suspense>`, React renders these three zones concurrently and
 * flushes each one as its own data lands, so "my day" paints while the
 * portfolio is still being counted. Nothing that was parallel became serial:
 * each zone still batches its own reads.
 *
 * This is only affordable because of the request-scoped deduplication added in
 * lib/session.ts — three zones all needing to know who is signed in would
 * otherwise be three more `select … from users` round trips on top of the
 * layout's.
 *
 * Zone order is the page's argument, and it is also the useful streaming
 * order: yours, then the team's, then the portfolio's.
 */

/**
 * Muted divider label between the page's zones. Exported so loading.tsx can
 * render the same labels in the cold-entry skeleton — they are constants, and
 * a grey box where a known word belongs makes a page feel slower than it is.
 */
export function ZoneLabel({ children, hidden = false }: { children: string; hidden?: boolean }) {
  // `hidden` hides the RULE, never the heading: a zone whose own cards already
  // carry visible titles does not need a second one above them, but dropping
  // the <h2> would leave the page a flat list of cards to anyone navigating by
  // headings. Same element, read aloud, not drawn.
  if (hidden) return <h2 className="sr-only">{children}</h2>

  return (
    <h2 className="mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

/**
 * THE TWO-CARD ROW, held to one height.
 *
 * These rows pair cards whose lengths are unrelated: capacity is one line per
 * person, sprints is one per sprint. A twelve-person team running two sprints
 * put a very tall card beside a very short one, and `items-start` let each
 * size to its own content — so the row ended in a column of dead space as
 * tall as the difference. Swap which side is longer and the gap just moves.
 *
 * Three rules fix it, and none of them touch the card components themselves —
 * `PersonTasksCard` and friends are shared with /people/[id], where a natural
 * height is right and this cap would be wrong:
 *
 * - No `items-start`, so the pair stretches to a common height and the row
 *   reads as a row.
 * - `max-h` on the card, from `lg` up only — the cap exists to keep a PAIR
 *   even, and single-column mobile has no pair to keep even.
 * - The content area scrolls (`min-h-0` is what lets a flex child shrink
 *   below its own content at all), so capping never hides a person: the
 *   twelfth teammate is one scroll away rather than clipped.
 *
 * 30rem is roughly ten list rows — enough that most teams never scroll, short
 * enough that no single card owns the fold.
 *
 * A FUNCTION of the child count, not a constant: an unconditional
 * `lg:grid-cols-2` left every lone card (a non-admin's Portfolio zone) at
 * half width beside a permanently empty cell. One child collapses to one
 * column; the two-up layout only exists when there is a pair to lay out.
 *
 * `scrollbar-width`/`scrollbar-color` on the scrolling content are the
 * card's scroll AFFORDANCE: overlay scrollbars (macOS default) hide until
 * hover, so a capped card gave no visible sign that a twelfth teammate
 * existed. Styling the scrollbar opts it out of overlay rendering in both
 * engines, so an overflowing card shows a thin, token-coloured bar at rest.
 */
export function pairedCards(count: number): string {
  return cn(
    'grid grid-cols-1 gap-6',
    count > 1 && 'lg:grid-cols-2',
    '[&>*]:h-full [&_[data-slot=card]]:h-full',
    'lg:[&_[data-slot=card]]:max-h-[30rem]',
    '[&_[data-slot=card-content]]:min-h-0 [&_[data-slot=card-content]]:overflow-y-auto',
    '[&_[data-slot=card-content]]:[scrollbar-width:thin]',
    '[&_[data-slot=card-content]]:[scrollbar-color:var(--border)_transparent]',
  )
}

/* ────────────────────── Zone plumbing ───────────────────────── */

/**
 * THE ONE PROP SHAPE EVERY ZONE TAKES.
 *
 * Uniform on purpose. The page renders whatever `composeDashboard` returns by
 * looking each id up in `ZONE_VIEWS` below, so a zone with bespoke props would
 * put the chain of ternaries back into the page — the thing this refactor
 * exists to remove. What differs between zones is what they DO with the grant.
 *
 * `grant` is carried down rather than re-derived: a zone that asked the matrix
 * again could ask it differently from the function that admitted it, and then
 * the answer to "who sees what" would live in two places.
 */
export type ZoneProps = {
  actor: Actor
  grant: AdmittingGrant
  /** How to address the reader, for the cards that use a name in prose. */
  userName: string
}

type ZoneComponent = (props: ZoneProps) => ReactNode | Promise<ReactNode>

export type ZoneView = {
  Zone: ZoneComponent
  /** What fills the zone's Suspense boundary. Same geometry as the real thing. */
  Skeleton: () => ReactNode
}

/**
 * Zone id → what to draw, and what to draw while it loads.
 *
 * The page's entire "which zone is this" decision, as data. Adding a zone is a
 * row in `DASHBOARD_ZONES` and a row here; the page does not change, and
 * neither does any other zone.
 *
 * `Record<ZoneId, …>` is what keeps the two halves honest — a zone declared in
 * the registry with nothing to draw is a compile error, not a blank space on
 * somebody's dashboard.
 */
export const ZONE_VIEWS: Record<ZoneId, ZoneView> = {
  'my-day': { Zone: MyDayZone, Skeleton: MyDayZoneSkeleton },
  'my-work': { Zone: MyWorkZone, Skeleton: MyWorkZoneSkeleton },
  team: { Zone: TeamZone, Skeleton: TeamZoneSkeleton },
  coverage: { Zone: CoverageZone, Skeleton: CoverageZoneSkeleton },
  portfolio: { Zone: PortfolioZone, Skeleton: PortfolioZoneSkeleton },
  approvals: { Zone: ApprovalsZone, Skeleton: ApprovalsZoneSkeleton },
  trail: { Zone: TrailZone, Skeleton: TrailZoneSkeleton },
  'ai-usage': { Zone: AiZone, Skeleton: AiZoneSkeleton },
}

/** Shared link treatment for the in-card destinations. */
const cardLink =
  'rounded-sm underline-offset-2 outline-none transition-colors duration-150 hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none'

/**
 * Plain `YYYY-MM-DD` anchored to local noon before formatting. Handed straight
 * to `new Date()` it parses as midnight UTC and renders as the previous day in
 * any negative-offset zone — the same fix the sprint and task cards carry.
 */
function formatDay(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), 'MMM d')
}

/* ─────────────────────────── My day ─────────────────────────── */

/**
 * Where each stat tile's ANSWER lives — the card that holds the rows the
 * number is counting. "Overdue 3" without a destination names a problem and
 * won't take you to it; these anchors are the shortest path from the number
 * to its rows (which sit several scrolls below on mobile). The anchor ids are
 * on wrappers in this same zone, so tile and target always resolve together.
 */
const STAT_HREFS: Record<string, string> = {
  'due-soon': '#my-tasks',
  overdue: '#my-tasks',
  owed: '#my-followups',
  'meetings-today': '#my-meetings',
}

/** person-stats tone vocabulary → StatTile's. */
const STAT_TONES: Record<StatTone, 'default' | 'attention' | 'destructive'> = {
  normal: 'default',
  warn: 'attention',
  alert: 'destructive',
}

const STAT_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'

function MyDayStatTiles({ stats }: { stats: PersonStat[] }) {
  return (
    <div className={STAT_GRID}>
      {stats.map((stat) => (
        <StatTile
          key={stat.key}
          label={stat.label}
          value={stat.value}
          meta={stat.meta}
          tone={STAT_TONES[stat.tone]}
          href={STAT_HREFS[stat.key]}
        />
      ))}
    </div>
  )
}

/** Tiles whose subject is the reader's board rather than their calendar. */
const TASK_TILES = new Set(['due-soon', 'overdue'])

export async function MyDayZone({ actor, userName }: ZoneProps) {
  // FILTERED INSIDE THE ZONE, because this zone is shown to every seat — a
  // stakeholder still attends meetings and still gets mentioned. They hold no
  // task.edit and no meeting.manage, so their my-day is those two cards and
  // nothing else; without this it would be the one always-on zone that leaks.
  //
  // Asked WITH `ownerId`: both actions bottom out at 'own', and an 'own' grant
  // asked without a resource fails closed — which would empty the zone for
  // every member in the workspace.
  const showTasks = can(actor, 'task.edit', { ownerId: actor.id })
  const showFollowups = can(actor, 'meeting.manage', { ownerId: actor.id })
  // The briefing is a sentence about the WORKSPACE, not about you, so it rides
  // on the trail's capability rather than on whether AI happens to be on.
  const showBriefing = can(actor, 'activity.view')

  const [workload, followups, meetings, notificationItems, briefingResult] =
    await Promise.all([
      showTasks ? getPersonWorkload(actor.id) : null,
      showFollowups ? getPersonFollowups(actor.id) : null,
      getPersonMeetings(actor.id, actor.id),
      listNotifications(actor.id, 8),
      // In the same Promise.all as the rest, not awaited after them: the
      // briefing reads its own workspace snapshot, and sequencing it behind
      // four queries would add its latency to a zone that already streams as
      // one unit.
      showBriefing ? getBriefing() : null,
    ])

  // The one err() case is a snapshot that could not be read at all. Nothing
  // to say and nothing to derive from, so the zone renders without the card
  // rather than with an apology — the four cards below still answer the
  // question the briefing was summarising.
  const briefing = briefingResult?.ok ? briefingResult.data : null

  // meetings.today, NOT a filter over meetings.upcoming: `upcoming` is a
  // display slice — capped at 5 and holding only meetings that have not
  // ended — so counting from it undercounts a busy day and drops every
  // meeting already finished. See features/people/meeting-window.ts.
  //
  // One "now" for this zone, shared with the Portfolio zone's convention:
  // NotificationsCard's relative timestamps must count back from the same
  // moment as every other "ago" on the page.
  const now = new Date()
  const todayIso = workload?.todayIso ?? isoDayOf(now)

  const myDayStats = buildMyDayStats({
    // `summarizeOpenTasks([])` rather than a hand-written zero literal: the
    // tiles it feeds are dropped below for a reader who may not see tasks, and
    // an invented TaskLoad is a second definition of "no work" waiting to
    // disagree with the real one.
    tasks: workload?.load ?? summarizeOpenTasks([], todayIso),
    followupsOwed: followups?.owed.length ?? 0,
    oldestOwedDays: followups?.oldestOwedDays ?? null,
    meetingsToday: meetings.today,
  }).filter(
    (stat) =>
      (showTasks || !TASK_TILES.has(stat.key)) && (showFollowups || stat.key !== 'owed'),
  )

  // A tile row of "0 overdue, 0 owed" for somebody who can hold neither is not
  // a calm dashboard, it is a lie with a zero in it.
  const cardCount = 2 + (showTasks ? 1 : 0) + (showFollowups ? 1 : 0)

  return (
    <>
      <MyDayStatTiles stats={myDayStats} />
      {/* Full width and above the paired cards: the briefing is the sentence
          that says which of the cards below to open, so it reads before them
          or not at all. Absent for two reasons only — a snapshot that could
          not be read at all, and a reader without `activity.view`. Never
          because of AI settings: getBriefing degrades to source:'derived', a
          true summary off the same snapshot, when AI is off, keyless or
          unrouted, and a card that vanished with somebody's model choice would
          make the zone's height depend on it. */}
      {briefing ? <BriefingCard initial={briefing} className="mb-1" /> : null}
      <div className={pairedCards(cardCount)}>
        {workload ? (
          <div id="my-tasks" className="scroll-mt-6">
            <PersonTasksCard
              openTasks={workload.openTasks}
              todayIso={workload.todayIso}
              doneCount={workload.doneCount}
              totalCount={workload.totalCount}
            />
          </div>
        ) : null}
        {followups ? (
          <div id="my-followups" className="scroll-mt-6">
            <PersonFollowupsCard followups={followups} personName={userName} />
          </div>
        ) : null}
        <div id="my-meetings" className="scroll-mt-6">
          <PersonMeetingsCard meetings={meetings} />
        </div>
        <div id="notifications" className="scroll-mt-6">
          <NotificationsCard items={notificationItems} now={now} />
        </div>
      </div>
    </>
  )
}

export function MyDayZoneSkeleton() {
  return (
    <>
      <span className="sr-only" role="status">
        Loading your day…
      </span>
      <div className={STAT_GRID} aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          // Shaped like StatTile: bordered tile, label over a mono value over
          // a meta line — not the old free-floating card, so the swap to the
          // real tiles is not a layout shift.
          <div
            key={i}
            className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Reserves the briefing's slot. Imported from the intel feature rather
          than redrawn here: a second geometry for the same card is exactly
          the drift this file's skeletons exist to prevent, and it would go
          stale the first time the card changes. */}
      <div aria-hidden className="mb-1">
        <BriefingCardSkeleton />
      </div>
      <div className={pairedCards(4)} aria-hidden>
        {Array.from({ length: 4 }, (_, i) =>
          // The fourth slot is where NotificationsCard resolves, and the
          // header's UnreadMentionsPill points at #notifications — the id
          // lives on the skeleton too, so clicking the pill mid-stream
          // scrolls to where the card is about to land instead of no-opping.
          i === 3 ? (
            <div key={i} id="notifications" className="scroll-mt-6">
              <CardSkeleton rows={4} />
            </div>
          ) : (
            <CardSkeleton key={i} rows={4} />
          ),
        )}
      </div>
    </>
  )
}

/* ────────────────────────── My work ─────────────────────────── */

/** Rows shown per project before the card defers to the board. */
const MY_WORK_PER_APP = 4

type AppTaskGroup = { appName: string; appSlug: string; tasks: PersonTaskRow[] }

/**
 * The same open rows my-day counts, cut by PROJECT instead of by urgency.
 *
 * Most work first, then alphabetical: a stable order, so two loads that
 * returned the same rows never reshuffle the card under somebody reading it.
 */
function groupTasksByApp(rows: PersonTaskRow[]): AppTaskGroup[] {
  const byApp = new Map<string, AppTaskGroup>()
  for (const row of rows) {
    const group = byApp.get(row.appSlug)
      ?? { appName: row.appName, appSlug: row.appSlug, tasks: [] }
    group.tasks.push(row)
    byApp.set(row.appSlug, group)
  }
  return [...byApp.values()].sort(
    (a, b) => b.tasks.length - a.tasks.length || a.appName.localeCompare(b.appName),
  )
}

/**
 * Where the week is going, by project.
 *
 * my-day answers "what is late". This answers "what am I carrying, and where"
 * — the cut you need when deciding which board to open rather than which task
 * to panic about.
 *
 * READS THE ACTOR'S OWN ROWS AT EVERY GRANT LEVEL, deliberately. A scoped or
 * 'all' grant on task.edit reaches further than this — every unassigned item
 * on those boards — but the query that exists is per-assignee, and a card that
 * silently listed a third of the board would be a worse answer than a link to
 * all of it. The group headings are that link.
 */
export async function MyWorkZone({ actor }: ZoneProps) {
  const workload = await getPersonWorkload(actor.id)
  const groups = groupTasksByApp(workload.openTasks)

  return (
    <div className={pairedCards(1)}>
      <Card>
        <CardHeader>
          <CardTitle as="h3" className="flex items-center gap-2">
            <ListTodo className="size-4" aria-hidden /> My work by project
          </CardTitle>
          <CardAction>
            <Link href="/apps" className={cn(cardLink, 'text-xs font-medium text-muted-foreground')}>
              All boards →
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <EmptyState
              icon={PawPrint}
              title="Nothing open on any board."
              description="Work assigned to you shows up here, grouped by the project it belongs to."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {groups.map((group) => (
                <li key={group.appSlug} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link href={`/apps/${group.appSlug}`} className={cn(cardLink, 'text-sm font-medium')}>
                      {group.appName}
                    </Link>
                    <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                      {group.tasks.length} open
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {group.tasks.slice(0, MY_WORK_PER_APP).map((task) => {
                      const state = dueState(task.dueDate, workload.todayIso)
                      return (
                        <li key={task.id} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate">{task.title}</span>
                          <span
                            className={cn(
                              'shrink-0 font-mono text-2xs tabular-nums',
                              // Lateness is the only thing that gets colour,
                              // and the date beside it says so in words.
                              state === 'overdue' ? 'text-destructive' : 'text-muted-foreground',
                            )}
                          >
                            {task.dueDate ? formatDay(task.dueDate) : 'no date'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  {group.tasks.length > MY_WORK_PER_APP ? (
                    <Link
                      href={`/apps/${group.appSlug}`}
                      className={cn(cardLink, 'text-2xs text-muted-foreground')}
                    >
                      {group.tasks.length - MY_WORK_PER_APP} more on the board →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function MyWorkZoneSkeleton() {
  return (
    <div className={pairedCards(1)} aria-hidden>
      <span className="sr-only" role="status">
        Loading your work…
      </span>
      <CardSkeleton rows={5} />
    </div>
  )
}

/* ──────────────────────────── Team ──────────────────────────── */

export async function TeamZone({ actor, grant }: ZoneProps) {
  const scope = zoneScope(grant, actor)
  // NARROW BY THE GRANT, NEVER BY WHETHER THE SCOPE SET IS EMPTY. `scopeAppIds`
  // is empty for superadmin, admin and auditor because their grant is 'all'
  // and never consults it — filtering on the set unconditionally would show an
  // admin an empty team, which is the exact inversion of what the seat is for.
  const orgWide = scope.kind === 'all'
  // One "now" for the zone, so the trend's last point and the this-week figure
  // cannot straddle midnight and disagree about which week it is.
  const now = new Date()
  // The inline "Assign to app" control WRITES assignments, so it is gated on
  // the action that writes them — asked without a resource, which is what
  // makes a scoped manager fall through to the read-only heat instead of being
  // handed an editor over every app in the workspace.
  const canAssign = can(actor, 'app.assign')
  const [capacities, activeSprints, assignableApps, weeklyRows, decidedKeys] = await Promise.all([
    getUserCapacities(),
    getActiveSprints(),
    // Two callers now: the assign control, and the scoped read below, which
    // needs app SLUGS to narrow sprints (ActiveSprintSummary carries no id).
    // Neither one runs for a plain 'all' reader, so nobody pays who does not.
    canAssign || scope.kind === 'apps' ? listAssignableApps() : Promise.resolve([]),
    // The meeting-load figures are org-wide by construction — a count of
    // everybody's week — and there is no scoped form of them, so a narrowed
    // reader does not buy the two heaviest reads in the zone.
    orgWide ? getWeeklyLoadTable(now) : Promise.resolve([]),
    // Fetched with the table, not per reader: the aggregate is org-wide and
    // would over-count if this copy could not see what has been decided.
    orgWide ? getAllDecidedKeys() : Promise.resolve(new Set<string>()),
  ])
  const aggregate = orgWide ? await getSuggestionsAggregate(now, decidedKeys) : null

  const visibleCapacities =
    scope.kind === 'all'
      ? capacities
      : scope.kind === 'apps'
        ? capacities.filter((person) =>
            person.breakdown.some((entry) => scope.appIds.has(entry.appId)),
          )
        : // An 'own' grant on the directory is unreachable today; if the matrix
          // ever narrows that far, the honest team view is the reader alone
          // rather than everybody.
          capacities.filter((person) => person.user.id === scope.userId)

  // Sprints narrow by SLUG because ActiveSprintSummary carries no app id — the
  // ids come from the same live-apps list the assign control uses, so the two
  // narrowings cannot drift apart.
  const scopedSlugs =
    scope.kind === 'apps'
      ? new Set(assignableApps.filter((app) => scope.appIds.has(app.id)).map((app) => app.slug))
      : scope.kind === 'own'
        ? new Set(visibleCapacities.flatMap((person) => person.breakdown.map((e) => e.slug)))
        : null
  const visibleSprints = scopedSlugs
    ? activeSprints.filter((sprint) => scopedSlugs.has(sprint.appSlug))
    : activeSprints

  // Built from the SAME rows the drill-down renders, rather than a second
  // query with its own bucketing — a card that disagreed with the page it
  // links to would make both unreadable.
  const trend = buildLoadTrend(
    weeklyRows.map((row) => ({ weekStartIso: row.weekStartIso, hours: row.invitedHours })),
    now,
  )
  const weekly = trend.points.map((point) => point.hours)
  const thisWeekHours = weekly[weekly.length - 1] ?? 0
  const thisWeekIso = trend.points[trend.points.length - 1]?.weekStartIso
  const coverage = weeklyRows.find((row) => row.weekStartIso === thisWeekIso)?.coverage ?? 0
  // MEDIAN of the trailing four, not the mean: one workshop week should not
  // leave the card reading "down 40%" for the month afterwards.
  const trailing = weekly.slice(-5, -1).sort((a, b) => a - b)
  const trailingMedianHours = trailing.length === 0
    ? 0
    : trailing.length % 2 === 0
      ? (trailing[trailing.length / 2 - 1] + trailing[trailing.length / 2]) / 2
      : trailing[Math.floor(trailing.length / 2)]
  // Only needed for the sprints card's empty-but-not-really state, so it is
  // fetched after we already know whether anything is running now. The query
  // is org-wide, so it goes through the SAME slug narrowing as the list it is
  // standing in for — otherwise a manager with nothing running would be
  // consoled with another team's sprint.
  const upcoming = visibleSprints.length === 0 ? await getNextUpcomingSprint() : null
  const nextSprint =
    upcoming && (!scopedSlugs || scopedSlugs.has(upcoming.appSlug)) ? upcoming : null

  return (
    <div className={pairedCards(2)}>
      <CapacityHeat capacities={visibleCapacities} isAdmin={canAssign} apps={assignableApps} />
      <ActiveSprints sprints={visibleSprints} nextSprint={nextSprint} />
      {/* A team number, not a personal one — how much of everybody's week is
          spoken for before any work starts. No names and no named series: the
          org-wide view is a count, and the questions go to the organizers.
          Absent for a narrowed reader, because there is no narrowed form of
          "everybody's week" and a scoped seat must not be shown one. */}
      {aggregate ? (
        <MeetingLoadCard
          thisWeekHours={thisWeekHours}
          trailingMedianHours={trailingMedianHours}
          coverage={coverage}
          trend={trend}
          suggestionCount={aggregate.count}
          potentialHoursPerWeek={aggregate.potentialHoursPerWeek}
        />
      ) : null}
    </div>
  )
}

export function TeamZoneSkeleton() {
  return (
    <div className={pairedCards(2)} aria-hidden>
      <CardSkeleton rows={5} />
      <CardSkeleton rows={3} />
      <CardSkeleton rows={4} />
    </div>
  )
}

/* ───────────────────────── Coverage ─────────────────────────── */

/** How far back the personal coverage figure looks. */
const COVERAGE_WINDOW_DAYS = 14

const COVERAGE_STAT_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3'

/** Day fractions read as "3" and "2.5", never as "2.5000000001". */
function formatOwed(days: number): string {
  return Number.isInteger(days) ? String(days) : days.toFixed(1)
}

/**
 * Everybody this reader is answerable for, from the assignments on their own
 * apps. One query per app in scope — scope sets are a handful of projects, and
 * the alternative is re-deriving membership from a capacity roll-up that only
 * lists people who have an allocation.
 */
async function rosterForApps(appIds: ReadonlySet<string>) {
  const teams = await Promise.all([...appIds].map((appId) => getTeamForApp(appId)))
  const byId = new Map<string, { userId: string; name: string }>()
  for (const member of teams.flat()) {
    if (!byId.has(member.userId)) byId.set(member.userId, { userId: member.userId, name: member.name })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Who is logged, who is away, and who neither — today.
 *
 * THE ROSTER IS THE DENOMINATOR, not the worklog rows. Counted the other way
 * round, the one view you open to find who is behind structurally cannot show
 * them: somebody who logged nothing produces no row, so a team of twenty with
 * three loggers reports a full house.
 *
 * A morning reading is not a verdict — a day is owed by the end of it — which
 * is why the third figure is "not logged yet" and says so.
 */
export async function CoverageZone({ actor, grant }: ZoneProps) {
  const scope = zoneScope(grant, actor)
  const today = isoDayOf(new Date())

  if (scope.kind === 'own') {
    // Their own window, through the same pure core /worklog uses, so the two
    // surfaces cannot disagree about which days were owed. Half-open
    // [from, to): `to` is tomorrow, so today is inside the window.
    const summary = await getCoverage(
      actor,
      scope.userId,
      isoDayAdd(today, -(COVERAGE_WINDOW_DAYS - 1)),
      isoDayAdd(today, 1),
      today,
    )

    return (
      <div className={pairedCards(1)}>
        <Card>
          <CardHeader>
            <CardTitle as="h3" className="flex items-center gap-2">
              <CalendarCheck className="size-4" aria-hidden /> My coverage
            </CardTitle>
            <CardAction>
              <Link href="/worklog" className={cn(cardLink, 'text-xs font-medium text-muted-foreground')}>
                Open worklog →
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {summary ? (
              <div className="flex flex-col gap-1.5">
                <CoverageFigure summary={summary} label={`Last ${COVERAGE_WINDOW_DAYS} days`} />
                <p className="text-2xs text-muted-foreground">
                  {summary.missing === 0
                    ? 'Every day you owed is logged.'
                    : `${formatOwed(summary.missing)} owed still unlogged — the catch-up queue on /worklog has them.`}
                </p>
              </div>
            ) : (
              <EmptyState
                icon={PawPrint}
                title="No coverage to read yet."
                description="Coverage starts counting from your first day, and skips approved leave and company holidays."
              />
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // 'all' reads the whole roster; 'apps' reads the people on the reader's own
  // projects. Never a filter over `scopeAppIds` for an 'all' reader — that set
  // is empty for exactly the seats that see everything.
  const roster = scope.kind === 'all' ? await getTeamRoster() : await rosterForApps(scope.appIds)
  const [logged, away] = await Promise.all([
    getTeamWorklogs(today, today),
    // Approved only. A pending absence exempts nothing, here or anywhere else.
    getTeamApprovedAbsences(today, today),
  ])

  const loggedIds = new Set(logged.map((row) => row.userId))
  const awayIds = new Set(away.map((row) => row.userId))
  const loggedCount = roster.filter((person) => loggedIds.has(person.userId)).length
  const awayCount = roster.filter((person) => awayIds.has(person.userId)).length
  const owing = roster.filter(
    (person) => !loggedIds.has(person.userId) && !awayIds.has(person.userId),
  )
  // A dead link is worse than no link: /admin/absences is behind absence.view,
  // which a scoped seat holds only WITH a resource and therefore not here.
  const absencesHref = can(actor, 'absence.view') ? '/admin/absences' : undefined

  return (
    <>
      <div className={COVERAGE_STAT_GRID}>
        <StatTile
          label="Logged today"
          value={loggedCount}
          meta={`of ${roster.length} expected`}
          href="/worklog"
        />
        <StatTile
          label="Away"
          value={awayCount}
          meta={awayCount === 0 ? 'nobody on approved leave' : 'on approved leave'}
          href={absencesHref}
        />
        <StatTile
          label="Not logged yet"
          value={owing.length}
          tone={owing.length > 0 ? 'attention' : 'default'}
          meta={owing.length === 0 ? 'everybody accounted for' : 'still owed by end of day'}
          href="/worklog"
        />
      </div>
      <div className={pairedCards(1)}>
        <Card>
          <CardHeader>
            <CardTitle as="h3" className="flex items-center gap-2">
              <CalendarCheck className="size-4" aria-hidden /> Still to log today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roster.length === 0 ? (
              <EmptyState
                icon={PawPrint}
                title="Nobody on the roster yet."
                description="This counts everybody active and approved on the projects you can see."
              />
            ) : owing.length === 0 ? (
              <EmptyState
                icon={PawPrint}
                title="Everybody is accounted for."
                description="Logged, or away on approved leave. Nothing owed for today."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {owing.map((person) => (
                  <li key={person.userId} className="flex items-baseline justify-between gap-2 py-2 first:pt-0 last:pb-0 text-sm">
                    <Link href={`/people/${person.userId}`} className={cardLink}>
                      {person.name}
                    </Link>
                    <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                      {formatDay(today)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export function CoverageZoneSkeleton() {
  return (
    <>
      <span className="sr-only" role="status">
        Loading coverage…
      </span>
      <div className={COVERAGE_STAT_GRID} aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className={pairedCards(1)} aria-hidden>
        <CardSkeleton rows={4} />
      </div>
    </>
  )
}

/* ───────────────────────── Portfolio ────────────────────────── */

/** At-risk first: the strip counts them, and this is where they are named. */
const RISK_RANK: Record<HealthLevel, number> = {
  'at-risk': 0,
  watch: 1,
  'on-track': 2,
  dormant: 3,
}

export async function PortfolioZone({ actor, grant }: ZoneProps) {
  const scope = zoneScope(grant, actor)
  const all = await listApps()
  // Scoped seats — editor, member, stakeholder — see the projects they are on.
  // An 'all' seat ignores `scopeAppIds` entirely; it is empty for them, and
  // filtering on it would hand an auditor an empty portfolio.
  const apps =
    scope.kind === 'all'
      ? all
      : scope.kind === 'apps'
        ? all.filter((app) => scope.appIds.has(app.id))
        : // Nothing owns a slice of a portfolio, so an 'own' grant shows none
          // of it. Unreachable through the registry (portfolio needs 'scoped'
          // at minimum) and written out so it cannot become reachable quietly.
          []

  const summary = summarizePortfolio(apps)

  return (
    <>
      {apps.length > 0 ? (
        <PortfolioSummaryStrip
          summary={summary}
          atRiskHref={browseHref('/apps', parseBrowseParams({}), {
            risk: 'at-risk',
            status: 'live',
          })}
        />
      ) : null}
      <div className={pairedCards(1)}>
        <AppHealthCard apps={apps} />
      </div>
    </>
  )
}

/**
 * The strip's counts, with the projects behind them named.
 *
 * "3 at risk" tells you a number and not which three; every row here carries
 * its verdict in words (HealthDot spells the level out and puts the reasons in
 * its accessible name) and links to the board that answers it.
 */
function AppHealthCard({ apps }: { apps: AppPortfolioEntry[] }) {
  const ranked = [...apps]
    .filter((app) => app.status !== 'archived')
    .sort(
      (a, b) =>
        RISK_RANK[a.health.level] - RISK_RANK[b.health.level] || a.name.localeCompare(b.name),
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3" className="flex items-center gap-2">
          <LayoutGrid className="size-4" aria-hidden /> Project health
        </CardTitle>
        <CardAction>
          <Link href="/apps" className={cn(cardLink, 'text-xs font-medium text-muted-foreground')}>
            All projects →
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title="No live projects here yet."
            description="Projects you are on show up with their health, open work and running sprint."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {ranked.map((app) => (
              <li key={app.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/apps/${app.slug}`} className={cn(cardLink, 'text-sm font-medium')}>
                    {app.name}
                  </Link>
                  <HealthDot health={app.health} />
                </div>
                <p className="font-mono text-2xs tabular-nums text-muted-foreground">
                  {app.stats.tasks.todo + app.stats.tasks.in_progress} open ·{' '}
                  {app.stats.tasks.overdue} overdue ·{' '}
                  {app.stats.currentSprint
                    ? `${app.stats.currentSprint.name} running`
                    : app.stats.nextSprint
                      ? `${app.stats.nextSprint.name} next`
                      : 'no sprint scheduled'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Shaped like the resolved zone: summary strip plus one full-width card. The
 * strip is absent only for a reader whose portfolio is empty, which is not
 * knowable while the query is still running — so the skeleton promises the
 * usual shape rather than the rare one.
 */
export function PortfolioZoneSkeleton() {
  return (
    <>
      <span className="sr-only" role="status">
        Loading the portfolio…
      </span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 py-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-10" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className={pairedCards(1)} aria-hidden>
        <CardSkeleton rows={6} />
      </div>
    </>
  )
}

/* ───────────────────────── Approvals ────────────────────────── */

/**
 * What is waiting on THIS person's signature.
 *
 * Lifted out of the portfolio zone, where it used to render as a second card
 * behind `isAdmin && pendingUsers.length > 0`. Two things were wrong with
 * that: a queue is not portfolio news, and a zone that appears only when it
 * has content cannot be relied on to be checked.
 */
export async function ApprovalsZone({ actor }: ZoneProps) {
  const [pendingUsers, requests] = await Promise.all([
    listPendingUsers(),
    // The zone is admitted by `user.approve`; signing a change request is a
    // DIFFERENT signature, so it is asked for rather than assumed. Both reads
    // already refuse rows this actor may not act on.
    can(actor, 'request.review') ? getApprovalsInbox(actor) : Promise.resolve([]),
  ])

  return (
    <div className={pairedCards(2)}>
      <PendingApprovalsCard users={pendingUsers} />
      <ChangeRequestsCard requests={requests} />
    </div>
  )
}

/**
 * A pointer, not a second approvals screen. Approving here would mean a second
 * copy of the review flow — and the reasons, the payload diff and the
 * self-approval rule all live on /admin/approvals, which is one click away.
 */
function ChangeRequestsCard({ requests }: { requests: InboxRequest[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3" className="flex items-center gap-2">
          <FileCheck className="size-4" aria-hidden /> Change requests
        </CardTitle>
        <CardAction>
          <Link
            href="/admin/approvals"
            className={cn(cardLink, 'text-xs font-medium text-muted-foreground')}
          >
            Review →
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title="Nothing waiting on your signature."
            description="Edits and deletes proposed by somebody who could not make them directly land here."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 text-sm">
                <span>
                  <span className="font-medium">{request.requesterName}</span>{' '}
                  <span className="text-muted-foreground">
                    wants to {request.operation} {request.entityType}
                  </span>{' '}
                  <span className="font-medium">{request.entityLabel}</span>
                </span>
                {request.reason ? (
                  <span className="text-2xs text-muted-foreground">{request.reason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function ApprovalsZoneSkeleton() {
  return (
    <div className={pairedCards(2)} aria-hidden>
      <span className="sr-only" role="status">
        Loading what is waiting on you…
      </span>
      <CardSkeleton rows={3} />
      <CardSkeleton rows={3} />
    </div>
  )
}

/* ─────────────────────────── Trail ──────────────────────────── */

/**
 * What changed, lately.
 *
 * Gated on `activity.view` — the org's shared memory — and NOT on `audit.view`,
 * which is the compliance surface: the same table unfiltered, with trashed
 * rows and self-approval metadata. If that is ever wanted on a dashboard it is
 * a second zone, not this one widened.
 *
 * The catch-up digest the design pairs with this feed is the intel briefing,
 * which my-day already renders. A second copy would be a second Gemini call
 * for the same paragraph on the same page.
 */
export async function TrailZone() {
  const rows = await listRecentActivity(10)
  // One "now" for this zone: every "ago" in the feed must count back from the
  // same moment.
  const now = new Date()

  return (
    <div className={pairedCards(1)}>
      <RecentActivityCard rows={rows} now={now} />
    </div>
  )
}

export function TrailZoneSkeleton() {
  return (
    <div className={pairedCards(1)} aria-hidden>
      <span className="sr-only" role="status">
        Loading the activity trail…
      </span>
      <CardSkeleton rows={6} />
    </div>
  )
}

/* ───────────────────── Header unread pill ───────────────────── */

/**
 * Streamed on its own, with a `null` fallback rather than a shimmer. It is a
 * decoration on the greeting: appearing a beat late reads as nothing at all,
 * whereas a placeholder box that resolves to "no unread mentions" would be a
 * flicker of nothing turning into nothing.
 *
 * Its `#notifications` target exists from the zone's FIRST paint — the
 * MyDayZoneSkeleton carries the id on the slot the card resolves into — so
 * clicking before the data lands scrolls to the right place instead of
 * silently doing nothing.
 */
export async function UnreadMentionsPill({ userId }: { userId: string }) {
  const unread = await unreadNotificationCount(userId)
  if (unread === 0) return null

  return (
    <Link
      href="#notifications"
      className="flex items-center gap-1.5 rounded-full bg-chart-1/15 px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors duration-150 hover:bg-chart-1/25 focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
    >
      <AtSign className="size-3.5 text-chart-1" aria-hidden />
      {unread} unread
    </Link>
  )
}

/* ────────────────────────── AI engine ───────────────────────── */

/**
 * How far back the AI figures look. Thirty days is not a round number picked
 * for looks — it is the window Settings' own usage roll-up already uses, and
 * two surfaces quoting "your AI usage" over different windows is how a user
 * learns to trust neither.
 */
const AI_WINDOW_DAYS = 30
const AI_WINDOW_MS = AI_WINDOW_DAYS * 24 * 60 * 60 * 1000

const AI_STAT_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4'

/**
 * The AI zone: what the product's AI is wired to, and what it has cost this
 * person — the only zone on this page whose subject is the machine rather
 * than the team.
 *
 * It sits late in every role's ordering on purpose — the zones above are what
 * someone opens the dashboard to act on, and this one is reference they
 * consult. Streaming order follows reading order, so the numbers people came
 * for still paint first. That position is a row in ZONE_ORDER (zones.ts), not
 * a fact about this component.
 *
 * Two reads, both scoped to one user and both already indexed: the ledger
 * roll-up and the key pool. The routing table itself costs nothing — it is
 * computed from the same constants the call sites use.
 */
export async function AiZone({ actor }: ZoneProps) {
  const now = new Date()
  const since = new Date(now.getTime() - AI_WINDOW_MS)
  const [prefs, aggRows, poolKeys] = await Promise.all([
    getAiPrefs(actor.id),
    aggregateAiUsage(actor.id, since),
    listPoolKeyHealth(actor.id),
  ])

  const summaries = summarizeUsage(aggRows, now)
  const totals = totalsFor(summaries)
  const readiness = assessRecordingReadiness(poolKeys, now)
  const rows = sortAiEngineRows(buildAiEngineRows({ prefs, summaries, at: now }))
  const engineTotals = aiEngineTotals(rows)

  return (
    <>
      <div className={AI_STAT_GRID}>
        <StatTile
          label={`AI calls · ${AI_WINDOW_DAYS}d`}
          value={totals.calls}
          meta={
            totals.failedCalls > 0
              ? `${totals.failedCalls} blocked before running`
              : totals.calls > 0
                ? 'all reached Google'
                : 'nothing run yet'
          }
          tone={totals.failedCalls > 0 ? 'attention' : 'default'}
          href="/settings"
        />
        <StatTile
          label="Tokens spent"
          value={formatTokenCount(totals.tokens)}
          meta={`${totals.tokens.toLocaleString('en-US')} in and out`}
          href="/settings"
        />
        <StatTile
          label="Indicative value"
          value={formatUsd(totals.valueUsd)}
          // The distinction the ledger exists to keep straight: value is what
          // the tokens WOULD cost on the paid tier, charge is what your own
          // paid keys really ran. Free keys and a teammate's shared key are
          // both $0 to you, and conflating the two invoices the wrong person.
          meta={
            totals.paidChargeUsd > 0
              ? `${formatUsd(totals.paidChargeUsd)} on your paid keys`
              : 'nothing charged to you'
          }
          href="/settings"
        />
        <StatTile
          label="Keys working"
          value={readiness.healthyCount}
          meta={
            readiness.failingCount > 0
              ? `${readiness.failingCount} failing`
              : readiness.healthyCount > 0
                ? 'quota shared across them'
                : 'add one in Profile'
          }
          tone={
            readiness.level === 'blocked'
              ? 'destructive'
              : readiness.level === 'degraded'
                ? 'attention'
                : 'default'
          }
          href="/profile"
        />
      </div>
      <div className={pairedCards(1)}>
        <AiEngineCard
          rows={rows}
          totals={engineTotals}
          readiness={readiness}
          windowDays={AI_WINDOW_DAYS}
        />
      </div>
    </>
  )
}

export function AiZoneSkeleton() {
  return (
    <>
      <span className="sr-only" role="status">
        Loading your AI engine…
      </span>
      <div className={AI_STAT_GRID} aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className={pairedCards(1)} aria-hidden>
        <CardSkeleton rows={6} />
      </div>
    </>
  )
}

/* ─────────────────────────── Shared ─────────────────────────── */

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
