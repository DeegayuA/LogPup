import Link from 'next/link'
import { CalendarDays, Crown, LayersIcon, Link2, UsersIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { can, type Actor } from '@/features/auth/capabilities'
import { dayDiff, sprintDayProgress } from '@/features/apps/app-health'
import { HealthDot } from '@/features/apps/components/health-dot'
import { eventDotClasses } from '@/features/meetings/event-color'
import { SectionEmpty } from '@/features/people/components/section-empty'
import { formatPct, PCT_CLASS } from '@/features/people/format-pct'
import { peopleHref, type CohortParams } from '@/features/people/cohort-params'
import {
  PROJECT_SORTS,
  PROJECT_SORT_LABEL,
  ROLE_FILTERS,
  ROLE_FILTER_LABEL,
  STAFF_FILTERS,
  STAFF_FILTER_LABEL,
  filterSortProjects,
  hasActiveProjectFilters,
} from '@/features/people/cohort-filter'
import {
  type CohortMember,
  type OverlapReport,
  type ProjectCohort,
  type SharedPerson,
} from '@/features/people/cohorts'
import type { AppPortfolioEntry } from '@/features/apps/queries'
import { HelpNote } from '@/components/shared/help-note'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The three cohort views on /people — "By project", "Shared" and "Overlap".
 *
 * ALL SERVER COMPONENTS. Every one of them is a read, and the page's whole
 * interactivity is the URL (cohort-params.ts), so nothing here ships to the
 * browser. They render from two reads the page already makes — the capacity
 * list and, for the project view only, the portfolio — folded into cohorts by
 * features/people/cohorts.ts. There is no query in this file and no query per
 * project or per person anywhere behind it.
 *
 * THE SHARED DISCIPLINE, same as history-views.tsx: nothing on screen may say
 * more than the data behind it supports. A sort order is named by what it
 * actually sorted on; a health verdict is the one app-health.ts computed, never
 * a second opinion assembled here. Allocation percentages are teammate-visible
 * by design (the directory and person page already show them to everyone
 * signed in), so no per-viewer gate exists here.
 */

const linkFocus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

/** The app's identity hue — one system, event-color.ts, everywhere it is named. */
function ProjectDot({ appId }: { appId: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-2 shrink-0 rounded-full',
        eventDotClasses(appId) ?? 'bg-muted-foreground/50',
      )}
    />
  )
}

function PersonLink({
  userId,
  name,
  title,
  avatarUrl,
}: {
  userId: string
  name: string
  title: string | null
  avatarUrl: string | null
}) {
  return (
    <Link
      href={`/people/${userId}`}
      className={cn('flex min-w-0 items-center gap-2 rounded-md hover:underline', linkFocus)}
    >
      <Avatar className="size-7 shrink-0">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{name}</span>
        {title ? <span className="truncate text-2xs text-muted-foreground">{title}</span> : null}
      </span>
    </Link>
  )
}

/**
 * A member row: who they are, what they are called on this project, and how
 * much of them the project has. The percentage is shown unconditionally —
 * allocation figures are teammate-visible by design, exactly as the directory
 * and the person page already show them. (An earlier draft carried a
 * `showPct` gate whose comments promised per-viewer withholding that was
 * never implemented; a hardwired-open gate is a lie about the permission
 * model, so the gate is gone rather than left looking load-bearing.)
 */
function MemberRow({ member }: { member: CohortMember }) {
  return (
    <li className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <PersonLink
        userId={member.userId}
        name={member.name}
        title={member.title}
        avatarUrl={member.avatarUrl}
      />
      <span className="ml-auto flex shrink-0 items-center gap-3">
        {member.role ? (
          <span className="text-xs text-muted-foreground">{member.role}</span>
        ) : null}
        <span className={cn(PCT_CLASS, 'text-xs text-foreground')}>
          {formatPct(member.allocationPct)}
        </span>
      </span>
    </li>
  )
}


// ---------------------------------------------------------------------------
// By project
// ---------------------------------------------------------------------------

/**
 * The sprint sentence under a project's name.
 *
 * `sprintDayProgress` is imported from app-health.ts, the module that already
 * owns sprint arithmetic for the portfolio, so "day 6 of 10" means the same
 * thing here as it does on /apps. `today` is the caller's Asia/Colombo day —
 * never `new Date()` in this file, which renders on a UTC server.
 */
function SprintLine({ stats, todayIso }: { stats: AppPortfolioEntry['stats']; todayIso: string }) {
  const current = stats.currentSprint
  if (current) {
    const progress = sprintDayProgress(current.startDate, current.endDate, todayIso)
    // `dayDiff` rather than the progress fields for the upcoming case:
    // `elapsedDays` is clamped to 0 before a sprint starts, so it cannot say
    // how far off the start is. This branch is reachable because
    // `pickCurrentSprint` trusts `isSprintRunningNow`, which can name a sprint
    // marked active before its start date.
    const untilStart = dayDiff(todayIso, current.startDate)
    const overdueDays = -progress.remainingDays
    const tail =
      progress.phase === 'ended'
        ? `ended ${overdueDays} day${overdueDays === 1 ? '' : 's'} ago and is still open`
        : progress.phase === 'upcoming'
          ? `starts in ${untilStart} day${untilStart === 1 ? '' : 's'}`
          : `day ${progress.elapsedDays} of ${progress.totalDays}`
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="size-3 shrink-0" aria-hidden />
        <span className="truncate text-foreground">{current.name}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0">{tail}</span>
      </span>
    )
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <CalendarDays className="size-3 shrink-0" aria-hidden />
      {stats.nextSprint ? (
        <>
          <span className="shrink-0">No sprint running · next is</span>
          <span className="truncate text-foreground">{stats.nextSprint.name}</span>
        </>
      ) : (
        <span>No sprint running, and none planned</span>
      )}
    </span>
  )
}

/** Everything back to its default, in one link. */
const CLEARED = { q: '', staff: 'all', role: 'all', sort: 'name' } as const

/**
 * The toolbar for "By project".
 *
 * LINKS, NOT A FORM. Every control is an <a> that sets one param, which keeps
 * the page a server component, makes a narrowed grid pasteable into a message,
 * and means the back button undoes a filter — the same rule the cohort tabs
 * and the history filters already follow.
 *
 * The search box is the one exception, because a link cannot carry a phrase
 * somebody is still typing. It submits on Enter and is a GET form to the same
 * URL, so it degrades to exactly the link behaviour everything else has.
 */
function ProjectFilterBar({
  params,
  showing,
  total,
}: {
  params: CohortParams
  showing: number
  total: number
}) {
  const active = hasActiveProjectFilters(params)

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card/60 p-3">
      <form method="get" className="flex flex-wrap items-center gap-2">
        {/* The other params ride along as hidden fields, so searching does not
            silently drop the filters somebody already set. */}
        <input type="hidden" name="view" value="projects" />
        <input type="hidden" name="staff" value={params.staff} />
        <input type="hidden" name="role" value={params.role} />
        <input type="hidden" name="sort" value={params.sort} />
        <label htmlFor="cohort-q" className="sr-only">
          Search projects, people and roles
        </label>
        <input
          id="cohort-q"
          name="q"
          defaultValue={params.q}
          placeholder="Search a project, a person, or a role…"
          className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FilterGroup
          label="Show"
          params={params}
          current={params.staff}
          options={STAFF_FILTERS}
          labels={STAFF_FILTER_LABEL}
          toPatch={(value) => ({ staff: value })}
        />
        <FilterGroup
          label="Roles"
          params={params}
          current={params.role}
          options={ROLE_FILTERS}
          labels={ROLE_FILTER_LABEL}
          toPatch={(value) => ({ role: value })}
        />
        <FilterGroup
          label="Sort"
          params={params}
          current={params.sort}
          options={PROJECT_SORTS}
          labels={PROJECT_SORT_LABEL}
          toPatch={(value) => ({ sort: value })}
        />

        <span className="ml-auto flex items-center gap-2 text-2xs text-muted-foreground">
          {/* Said in words when it is narrowed and not at all when it is not —
              "16 of 16" is noise that trains people to stop reading the line. */}
          {showing === total ? (
            <span>
              {total} project{total === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="text-foreground">
              {showing} of {total}
            </span>
          )}
          {active ? (
            <Link
              href={peopleHref(params, CLEARED)}
              className={cn('underline underline-offset-2 hover:text-foreground', linkFocus)}
            >
              Clear
            </Link>
          ) : null}
        </span>
      </div>
    </div>
  )
}

function FilterGroup<T extends string>({
  label,
  params,
  current,
  options,
  labels,
  toPatch,
}: {
  label: string
  params: CohortParams
  current: T
  options: readonly T[]
  labels: Record<T, string>
  toPatch: (value: T) => Partial<CohortParams>
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 font-mono text-2xs tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {options.map((option) => {
        const selected = option === current
        return (
          <Link
            key={option}
            href={peopleHref(params, toPatch(option))}
            aria-current={selected ? 'true' : undefined}
            className={cn(
              'rounded-lg border px-2 py-0.5 text-2xs transition-colors',
              selected
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              linkFocus,
            )}
          >
            {labels[option]}
          </Link>
        )
      })}
    </div>
  )
}

export function ProjectCohortList({
  apps,
  cohorts,
  actor,
  todayIso,
  params,
}: {
  /** Every project, from the portfolio read — including the ones with nobody on them. */
  apps: AppPortfolioEntry[]
  /** Who is on each project, keyed by app id. */
  cohorts: Map<string, ProjectCohort>
  /** Only used to decide whether an empty state may offer its action. */
  actor: Actor | null
  todayIso: string
  /** The URL IS the filter state — see cohort-params.ts. */
  params: CohortParams
}) {
  if (apps.length === 0) {
    return (
      <Card>
        <SectionEmpty
          icon={LayersIcon}
          title="No projects yet."
          hint="Projects are what group people here — once one exists, everyone on it appears as a team."
          action={
            // Offered only to someone who can actually create one. An admin-only
            // button under a member's empty state is a dead end wearing the
            // costume of a next step.
            actor && can(actor, 'app.create') ? (
              <Button variant="outline" size="sm" render={<Link href="/apps" />}>
                Go to projects
              </Button>
            ) : undefined
          }
        />
      </Card>
    )
  }

  // Filtered from the SAME cohorts the cards render, so the count in the
  // toolbar and the cards under it can never disagree.
  const filtered = filterSortProjects(
    apps.map((app) => ({
      appId: app.id,
      name: app.name,
      slug: app.slug,
      members: cohorts.get(app.id)?.members ?? [],
    })),
    params,
  )
  const byId = new Map(apps.map((app) => [app.id, app]))

  return (
    <div className="flex flex-col gap-3">
      <ProjectFilterBar params={params} showing={filtered.length} total={apps.length} />

      {filtered.length === 0 ? (
        <Card>
          <SectionEmpty
            icon={LayersIcon}
            title="No project matches those filters."
            hint="Every project is still here — the filters are just narrower than the portfolio."
            action={
              <Button variant="outline" size="sm" render={<Link href={peopleHref(params, CLEARED)} />}>
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : null}

      {filtered.map((row) => {
        const app = byId.get(row.appId)!
        const members = row.members as CohortMember[]
        return (
          <Card key={app.id}>
            <CardHeader>
              <CardTitle as="h2" className="flex min-w-0 items-center gap-2">
                <ProjectDot appId={app.id} />
                <Link href={`/apps/${app.slug}`} className={cn('truncate hover:underline', linkFocus)}>
                  {app.name}
                </Link>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {/* PM and lead by NAME, from apps.pm_id / apps.lead_id — the
                    structural columns, not a guess from anybody's free-text
                    assignment role. A project always has a PM (pm_id is NOT
                    NULL); a lead is optional, and "No lead" is a real answer
                    the health verdict already counts against it. */}
                <span className="flex items-center gap-1.5">
                  <Crown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">PM</span>
                  <span className="text-foreground">{app.pmName ?? 'Unknown'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Lead</span>
                  <span className={app.leadName ? 'text-foreground' : undefined}>
                    {app.leadName ?? 'No lead'}
                  </span>
                </span>
                <SprintLine stats={app.stats} todayIso={todayIso} />
              </CardDescription>
              <CardAction>
                {/* The verdict app-health.ts computed for the portfolio, passed
                    through untouched. Recomputing it here — even with the same
                    weights — would give /people its own opinion of "at risk",
                    and two red dots that can disagree are worse than one. */}
                <HealthDot health={app.health} />
              </CardAction>
            </CardHeader>
            {/* SectionEmpty IS a CardContent (see section-empty.tsx), so it
                stands in place of one rather than inside it. */}
            {members.length === 0 ? (
              <SectionEmpty
                icon={UsersIcon}
                title="Nobody is assigned."
                hint="Nobody on the current roster holds an allocation on this project."
                action={
                  actor && can(actor, 'app.assign', { appId: app.id }) ? (
                    <Button variant="outline" size="sm" render={<Link href={`/apps/${app.slug}`} />}>
                      Assign people
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <CardContent>
                <ul className="flex flex-col divide-y divide-border">
                  {members.map((member) => (
                    <MemberRow key={member.userId} member={member} />
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/**
 * People carrying more than one project.
 *
 * The two things it has to get right: the SPLIT (which projects, and how much
 * of them each one has) and the ORDER. The order is named in the description
 * because it changes with what the reader may see — ranked by how evenly
 * someone is split where the percentages are on screen, and by how many
 * projects they are on where they are not. A list ranked on a number nobody
 * can see is a list nobody can check.
 */
export function SharedPeopleList({
  rows,
  params,
}: {
  rows: SharedPerson[]
  params: CohortParams
  /** True when every number behind the ranking is on screen — see cohorts.ts. */
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <SectionEmpty
          icon={UsersIcon}
          title="Nobody is on more than one project."
          hint="Everyone on the roster carries at most one project, so there is no split to show."
          action={
            <Button
              variant="outline"
              size="sm"
              render={<Link href={peopleHref(params, { view: 'projects' })} />}
            >
              See the projects
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle as="h2">Shared across projects</CardTitle>
          <CardDescription>
            Most evenly split first — the people with no single project holding
            most of their time.
          </CardDescription>
          <CardAction>
            <span className={cn(PCT_CLASS, 'text-xs text-muted-foreground')}>
              {rows.length} {rows.length === 1 ? 'person' : 'people'}
            </span>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((row) => (
              <li key={row.person.user.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                <PersonLink
                  userId={row.person.user.id}
                  name={row.person.user.name}
                  title={row.person.user.title}
                  avatarUrl={row.person.user.avatarUrl}
                />
                <span className="flex min-w-0 flex-1 basis-64 flex-wrap items-center gap-1.5">
                  {row.projects.map((project) => (
                    <span
                      key={project.appId}
                      className="inline-flex min-w-0 items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-xs"
                    >
                      <ProjectDot appId={project.appId} />
                      <span className="truncate text-foreground">{project.appName}</span>
                      <span className={cn(PCT_CLASS, 'shrink-0')}>
                        {formatPct(project.allocationPct)}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-2">
                  {/* States the test it applied rather than a grade: three or
                      more projects, none of them holding half the person. A
                      reader can check it against the chips alongside. */}
                  {row.noAnchor ? (
                    <Badge variant="outline" className="border-warning text-foreground">
                      No project has half their time
                    </Badge>
                  ) : null}
                  <span className={cn(PCT_CLASS, 'text-xs text-muted-foreground')}>
                    {row.projectCount} projects
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overlap
// ---------------------------------------------------------------------------

/** The anchor picker: one link per project that has anybody on it. */
function OverlapPicker({
  cohorts,
  anchorAppId,
  params,
}: {
  cohorts: ProjectCohort[]
  anchorAppId: string
  params: CohortParams
}) {
  return (
    <nav aria-label="Anchor project" className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Overlap with</span>
      {cohorts.map((cohort) => (
        <Button
          key={cohort.appId}
          variant={cohort.appId === anchorAppId ? 'secondary' : 'outline'}
          size="sm"
          aria-current={cohort.appId === anchorAppId ? 'page' : undefined}
          render={<Link href={peopleHref(params, { view: 'overlap', project: cohort.slug })} />}
        >
          <ProjectDot appId={cohort.appId} />
          {cohort.name}
        </Button>
      ))}
    </nav>
  )
}

export function ProjectOverlapView({
  cohorts,
  report,
  params,
  unknownProject,
}: {
  /** Every project with at least one person — the pickable set. */
  cohorts: ProjectCohort[]
  /** Null only when nobody is on any project at all. */
  report: OverlapReport | null
  params: CohortParams
  /**
   * A `project` param that matched no project WITH PEOPLE ON IT — an unknown
   * slug, or a real project everybody has since left. Either way the first
   * project is shown instead and the view says so.
   */
  unknownProject: boolean
}) {
  if (!report) {
    return (
      <Card>
        <SectionEmpty
          icon={Link2}
          title="No project has anybody on it yet."
          hint="Overlap is people two projects have in common, so it needs at least one project with a team."
          action={
            <Button
              variant="outline"
              size="sm"
              render={<Link href={peopleHref(params, { view: 'projects' })} />}
            >
              See the projects
            </Button>
          }
        />
      </Card>
    )
  }

  const { anchor, overlaps } = report

  return (
    <div className="flex flex-col gap-3">
      {unknownProject ? (
        // Said plainly rather than 404ing, because the link may simply predate
        // the last person leaving that project — the same rule the capacity
        // history's as-of picker follows for an unreadable date.
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          No project with anybody on it matched that link, so {anchor.name} is shown instead.
        </p>
      ) : null}

      <OverlapPicker cohorts={cohorts} anchorAppId={anchor.appId} params={params} />

      {/* "Room size" is the only number on this page a reader cannot derive
          from the rows in front of them, and it is the one the view exists to
          produce — so it is defined once, here, rather than guessed at per
          card. */}
      <HelpNote>
        People, not head counts: <span className="text-foreground">shared</span> is who works on both
        projects, and <span className="text-foreground">room size</span> is everyone on either one —
        the number who would have to be in a meeting that covered both.
      </HelpNote>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex min-w-0 items-center gap-2">
            <ProjectDot appId={anchor.appId} />
            <Link href={`/apps/${anchor.slug}`} className={cn('truncate hover:underline', linkFocus)}>
              {anchor.name}
            </Link>
          </CardTitle>
          <CardDescription>
            {anchor.members.length} {anchor.members.length === 1 ? 'person' : 'people'} on it.{' '}
            {overlaps.length > 0
              ? `${overlaps.length} other ${overlaps.length === 1 ? 'project shares' : 'projects share'} at least one of them.`
              : 'Nobody on it is on another project.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border">
            {anchor.members.map((member) => (
              <MemberRow key={member.userId} member={member} />
            ))}
          </ul>
        </CardContent>
      </Card>

      {overlaps.length === 0 ? (
        <Card>
          <SectionEmpty
            icon={Link2}
            title={`Nothing overlaps ${anchor.name}.`}
            hint="Everyone on it works only on it, so a session about this project needs nobody else in the room."
            action={
              <Button
                variant="outline"
                size="sm"
                render={<Link href={peopleHref(params, { view: 'shared' })} />}
              >
                See who is shared elsewhere
              </Button>
            }
          />
        </Card>
      ) : (
        overlaps.map((overlap) => (
          <Card key={overlap.project.appId}>
            <CardHeader>
              <CardTitle as="h2" className="flex min-w-0 items-center gap-2">
                <ProjectDot appId={overlap.project.appId} />
                <Link
                  href={`/apps/${overlap.project.slug}`}
                  className={cn('truncate hover:underline', linkFocus)}
                >
                  {overlap.project.name}
                </Link>
              </CardTitle>
              <CardDescription>
                {/* roomSize is |anchor ∪ other|, and it is said as exactly that:
                    the number of distinct people a session covering both
                    projects would have to include. It is not a recommendation
                    and not a meeting — this page cannot schedule one. */}
                {overlap.shared.length} shared with {anchor.name} · {overlap.roomSize} people
                between the two projects
              </CardDescription>
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link href={peopleHref(params, { view: 'overlap', project: overlap.project.slug })} />
                  }
                >
                  Anchor here
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y divide-border">
                {/* The allocation shown is the one on THIS project — the
                    anchor's own figure is on the card above, and showing both
                    on one row invites reading them as a single number. */}
                {overlap.shared.map((member) => (
                  <MemberRow key={member.userId} member={member} />
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Stands in for the DATA only. The page's title and the view switch above it
 * are rendered for real from the URL before anything is awaited, so a skeleton
 * covering them would replace a working control with a grey box the moment
 * somebody used it.
 *
 * Models what a cohort view actually resolves to — stacked cards, each with a
 * header (title + description + verdict dot) and member rows — instead of the
 * three bare rectangles this used to be, so the arriving cards land in the
 * shape already on screen rather than replacing generic blocks.
 */
export function CohortDataSkeleton() {
  return (
    <>
      <span className="sr-only" role="status">
        Loading cohorts
      </span>
      <div className="flex flex-col gap-3" aria-hidden>
        {[0, 1, 2].map((card) => (
          <div key={card} className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
              <Skeleton className="size-2.5 shrink-0 rounded-full" />
            </div>
            <div className="flex flex-col divide-y divide-border">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <Skeleton className="size-7 shrink-0 rounded-full" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="ml-auto h-3.5 w-16 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * The directory's own stand-in, mirroring what it actually renders — stat
 * strip, filter row, dense row list — so the switch back to "People" holds the
 * same shape it is about to fill rather than three generic blocks.
 *
 * Deliberately a sibling of the route's loading.tsx rather than a shared
 * export: that file covers COLD entry, where the header is shimmer too, and
 * this one stands in only while the page's own Suspense boundary resolves,
 * with the real header and view switch already on screen above it.
 */
export function DirectoryDataSkeleton() {
  return (
    <>
      <span className="sr-only" role="status">
        Loading people
      </span>
      <div className="flex flex-col gap-3" aria-hidden>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => (
            <div key={tile} className="flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-9 w-full max-w-xs rounded-lg" />
          <Skeleton className="h-8 w-44 rounded-lg" />
        </div>
        <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
            <div key={row} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-2 w-40 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
