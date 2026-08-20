import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getSession } from '@/lib/session'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import {
  appHealth,
  parseCalendarDate,
  pickCurrentSprint,
  pickNextSprint,
  type AppSprintSnapshot,
} from '@/features/apps/app-health'
import { APP_TAB_IDS, boardHref, normalizeAppTab, type AppTabId } from '@/features/apps/tabs'
import {
  getAppBySlug,
  getAppCounts,
  getAppRoleHistory,
  listDistinctTechTags,
} from '@/features/apps/queries'
import { AppRoleHistoryCard } from '@/features/apps/components/app-role-history-card'
import { getAppActivity } from '@/features/apps/activity-queries'
import { listAppComments } from '@/features/apps/comment-queries'
import { AppHeader } from '@/features/apps/components/app-header'
import { AppTabNav } from '@/features/apps/components/app-tab-nav'
import { DeleteAppCard } from '@/features/apps/components/delete-app-card'
import { AppSprintBand } from '@/features/apps/components/app-sprint-band'
import { AppActivity } from '@/features/apps/components/app-activity'
import { AppComments } from '@/features/apps/components/app-comments'
import { AppFormDialog } from '@/features/apps/components/app-form-dialog'
import { TaskSplitBar } from '@/features/apps/components/task-split-bar'
import { getTeamForApp, listActiveUsers, listAssignableApps } from '@/features/people/queries'
import { getAppContributions } from '@/features/apps/contribution-queries'
import { AppContributions } from '@/features/apps/components/app-contributions'
import { TeamPanel } from '@/features/people/components/team-panel'
import { LazyDisclosure } from '@/components/shared/lazy-disclosure'
import {
  getBoard,
  getSprintTaskCounts,
  getSprintsForApp,
  type SprintTaskCounts,
} from '@/features/sprints/queries'
import { getSprintCheckins, type SprintCheckinRow } from '@/features/sprints/checkin-queries'
import { checkinGap, computeTaskProgress } from '@/features/sprints/checkins'
import { planGaps, readSprint } from '@/features/sprints/plan-read'
import { parseZoom } from '@/features/sprints/roadmap-layout'
import { RoadmapSpine } from '@/features/sprints/components/roadmap-spine'
import { PlanReadStrip } from '@/features/sprints/components/plan-read-strip'
import { getMeetingsForApp } from '@/features/meetings/queries'
import { Board } from '@/features/sprints/components/board'
import { Roadmap } from '@/features/sprints/components/roadmap'
import { SprintSwitcher } from '@/features/sprints/components/sprint-switcher'
import { SprintCheckins } from '@/features/sprints/components/sprint-checkins'
import { SprintFormDialog } from '@/features/sprints/components/sprint-form-dialog'
import { SprintStatusSelect } from '@/features/sprints/components/sprint-status-select'
import { ExportButton } from '@/features/notion/components/export-button'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { MeetingList } from '@/features/meetings/components/meeting-list'
import { isAdminRole, can } from '@/features/auth/capabilities'
import { loadActor } from '@/features/auth/actor'
import { getAiPrefs } from '@/features/gemini/prefs'
import { getOpenBugCountForApp, listBugsForApp } from '@/features/bugs/queries'
import { bugFilterHref, parseBugFilters } from '@/features/bugs/report-input'
import { BugList } from '@/features/bugs/components/bug-list'
import { ReportBugDialog } from '@/features/bugs/components/report-bug-dialog'
import { BugCsvImportDialog } from '@/features/bugs/components/bug-csv-import-dialog'

const SPRINT_STATUS_LABEL: Record<'planned' | 'active' | 'done', string> = {
  planned: 'Planned',
  active: 'Active',
  done: 'Done',
}

const SPRINT_STATUS_VARIANT: Record<
  'planned' | 'active' | 'done',
  'outline' | 'default' | 'secondary'
> = {
  planned: 'outline',
  active: 'default',
  done: 'secondary',
}

const ACTIVITY_FEED_LIMIT = 40
const OVERVIEW_ACTIVITY_LIMIT = 6

/** Tabs whose panel needs the workspace roster (member pickers, @mentions). */
const TABS_NEEDING_USERS: readonly AppTabId[] = ['overview', 'discussion', 'meetings', 'settings']

export default async function AppDetailPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ slug }, search] = await Promise.all([props.params, props.searchParams])
  // loadActor rather than a second role read: `bug.view` and `bug.triage` are
  // SCOPED for manager, editor and member, so answering them needs the set of
  // projects this person reaches — which is one query per request, memoised,
  // and the only way to ask the matrix instead of comparing roles. The
  // session is still read for the things that genuinely want an identity
  // (the board's current user, the check-in card).
  const [app, session, actor] = await Promise.all([
    getAppBySlug(slug),
    getSession(),
    loadActor(),
  ])
  if (!app) notFound()

  const isAdmin = session?.user ? isAdminRole(session.user.role) : false
  // Every bug question is asked WITH the project, because every one of them is
  // scoped below manager. Asked without it, `can` fails closed and a member
  // would lose the tab on their own project.
  const bugResource = { appId: app.id }
  const canViewBugs = actor ? can(actor, 'bug.view', bugResource) : false
  const canTriageBugs = actor ? can(actor, 'bug.triage', bugResource) : false
  const canDeleteBugs = actor ? can(actor, 'bug.delete', bugResource) : false
  // Filing is granted 'all' from member up and takes no resource: whoever hits
  // a bug reports it, including on a project they are not on.
  const canReportBugs = actor ? can(actor, 'bug.report') : false
  // Settings is admin-only; Bugs needs bug.view on THIS app. Everything else
  // is visible to any signed-in member. normalizeAppTab sends a link to a tab
  // this viewer cannot open back to Overview rather than to a 403.
  const available = APP_TAB_IDS.filter((id) =>
    id === 'settings' ? isAdmin : id === 'bugs' ? canViewBugs : true,
  )
  const tab = normalizeAppTab(search.tab, available)
  const bugFilters = parseBugFilters({ bugStatus: search.bugStatus, bugSeverity: search.bugSeverity })
  const sprintParam = typeof search.sprint === 'string' ? search.sprint : undefined

  const today = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
  // Admins get an "Edit app" dialog in the header on every tab, and that
  // dialog needs both the roster (for the Lead select) and the workspace tag
  // vocabulary — so those two follow the permission, not the tab.
  /*
   * Roadmap needs the ROSTER but not the tag vocabulary, so the two queries
   * that used to share one flag no longer can.
   *
   * Its column composers resolve a typed "@name" against the whole workspace
   * rather than this app's team: resolving against the team alone answered a
   * correctly spelled teammate with "no one here called shanika", which sends
   * you hunting for a typo that isn't there. Tech tags are only ever wanted by
   * the editor dialogs, so fetching them here would be a query nothing reads.
   */
  // Bugs joins the list only for a viewer who can actually triage — the
  // assignee select is the sole thing on that tab that wants a roster, and a
  // member reading the list should not buy one.
  const needsUsers =
    isAdmin
    || tab === 'roadmap'
    || (tab === 'bugs' && canTriageBugs)
    || TABS_NEEDING_USERS.includes(tab)
  const needsTechTags = isAdmin || TABS_NEEDING_USERS.includes(tab)

  // Overview shows a teaser; Activity shows the feed; every other tab needs
  // none of it, and 0 is how they say so.
  const activityLimit =
    tab === 'activity' ? ACTIVITY_FEED_LIMIT : tab === 'overview' ? OVERVIEW_ACTIVITY_LIMIT : 0

  // ONE batch for everything the header needs plus everything THIS tab needs.
  // The old page fetched the board, the meeting list, the comment thread, the
  // full app list and the tag vocabulary on every visit regardless of which
  // tab was open — including `listApps()` (five aggregate queries) purely to
  // fill the meeting form's app dropdown, whose results were then discarded.
  const [
    sprints,
    team,
    counts,
    activeUsers,
    comments,
    appMeetings,
    assignableApps,
    workspaceTechTags,
    activity,
    contributions,
    roleHistory,
    aiPrefs,
    bugs,
    openBugCount,
  ] = await Promise.all([
    getSprintsForApp(app.id),
    getTeamForApp(app.id),
    getAppCounts(app.id),
    needsUsers ? listActiveUsers() : Promise.resolve([]),
    tab === 'discussion' ? listAppComments(app.id) : Promise.resolve([]),
    tab === 'meetings' ? getMeetingsForApp(app.id) : Promise.resolve([]),
    tab === 'meetings' ? listAssignableApps() : Promise.resolve([]),
    needsTechTags ? listDistinctTechTags() : Promise.resolve([]),
    activityLimit > 0 ? getAppActivity(app.id, activityLimit) : Promise.resolve([]),
    // Overview is the only tab that renders it; every other tab would pay
    // three aggregate queries for a panel it never shows.
    tab === 'overview' ? getAppContributions(app.id) : Promise.resolve([]),
    // Settings is the only tab that shows PM/lead history — it sits right
    // under the form that edits them (AppFormDialog below).
    tab === 'settings' ? getAppRoleHistory(app.id) : Promise.resolve([]),
    // Only the dialogs below read this, and only admins ever see those
    // dialogs — a member pays nothing for a preference lookup they have no
    // control that needs it.
    isAdmin && session?.user ? getAiPrefs(session.user.id) : Promise.resolve(null),
    tab === 'bugs' ? listBugsForApp(app.id, bugFilters) : Promise.resolve([]),
    // The ONE exception to "only the active tab's data": the count is the
    // badge ON the tab, so fetching it only while the tab is open is the one
    // moment it is not needed. One partial-index count, and only for a viewer
    // who can see the tab at all.
    canViewBugs ? getOpenBugCountForApp(app.id) : Promise.resolve(0),
  ])
  const tasks = counts.tasks
  const sprintDraftEnabled = aiPrefs ? aiPrefs['sprint-draft'].enabled : true
  const appMetadataEnabled = aiPrefs ? aiPrefs['app-metadata'].enabled : true

  const sprintSnapshots: AppSprintSnapshot[] = sprints.map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    status: sprint.status,
  }))
  const currentSprint = pickCurrentSprint(sprintSnapshots, today)
  const nextSprint = currentSprint ? null : pickNextSprint(sprintSnapshots, today)

  const health = appHealth(
    {
      status: app.status,
      tasks,
      currentSprint,
      sprintCount: sprints.length,
      memberCount: team.length,
      leadId: app.leadId,
      lastActivityOn: counts.lastActivityAt
        ? toIsoDateInTimeZone(counts.lastActivityAt, LK_TIMEZONE)
        : null,
    },
    today,
  )

  // `sprints` now comes back in roadmap order (`sortOrder` — drag-reorderable,
  // independent of dates), not date order, so picking `sprints[0]` here would
  // hand the board the OLDEST sprint by default instead of the most recent
  // one the moment a workspace's rows stop being in chronological order.
  // `sprintsByDateDesc` (newest first) is what both the board's default
  // fallback and the sprint switcher dropdown actually want.
  const sprintsByDateDesc = [...sprints].sort((a, b) => b.startDate.localeCompare(a.startDate))

  // A `sprint=backlog` query param is a synthetic selection, not a real
  // sprint id: it maps to `getBoard(appId, null)`, which returns tasks that
  // aren't attached to any sprint.
  const isBacklog = sprintParam === 'backlog'
  const selectedSprint = isBacklog
    ? undefined
    : (sprintParam ? sprints.find((s) => s.id === sprintParam) : undefined) ??
      sprints.find((s) => s.status === 'active') ??
      sprintsByDateDesc[0]
  const showBoard = tab === 'roadmap' && (isBacklog || Boolean(selectedSprint))
  const boardSprintId = isBacklog ? null : (selectedSprint?.id ?? null)

  // The plan's three reads, fetched together. `getBoard` answers for the
  // SELECTED sprint only, which is why the spine needs its own grouped count
  // query — the old Board tab could never show progress for a sprint you had
  // not already opened.
  const [board, sprintCounts, checkins] = await Promise.all([
    showBoard ? getBoard(app.id, boardSprintId) : Promise.resolve(null),
    // Typed empty Map, not a bare `new Map()`: an untyped one infers
    // Map<any, any> through the ternary, which would quietly make every
    // `.get()` below `any` and take the counts' type checking with it.
    tab === 'roadmap'
      ? getSprintTaskCounts(app.id)
      : Promise.resolve(new Map<string | null, SprintTaskCounts>()),
    tab === 'roadmap' && boardSprintId
      ? getSprintCheckins(boardSprintId)
      : Promise.resolve([] as SprintCheckinRow[]),
  ])

  const todayIso = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)

  /**
   * A link to this same plan with `overrides` applied, CARRYING the view you
   * already had. Picking a different sprint used to rebuild the URL from
   * scratch, which silently threw away the board's filters (`who`, `q`,
   * `prio`, `group`, `overdue`) and the timeline scale — so narrowing to one
   * person's work and then stepping to the next sprint quietly showed you
   * everybody's again.
   *
   * `undefined` in `overrides` removes a param, which is how a value that is
   * the default (month zoom) keeps the URL clean.
   */
  const planHref = (overrides: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams({ tab: 'roadmap' })
    for (const key of ['sprint', 'zoom', 'group', 'q', 'who', 'prio', 'overdue']) {
      const value = search[key]
      if (typeof value === 'string' && value) params.set(key, value)
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    return `/apps/${slug}?${params.toString()}`
  }
  const spineZoom = parseZoom(typeof search.zoom === 'string' ? search.zoom : undefined)
  const spineSprints = sprints.map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    read: readSprint(
      sprint,
      sprintCounts.get(sprint.id) ?? { todo: 0, in_progress: 0, done: 0 },
      todayIso,
    ),
  }))

  // The same counts the spine reads, keyed for the full timeline below, which
  // scores its own reads client-side so a dragged bar's verdict tracks the
  // dates under the cursor. The gaps are filled HERE, once: the grouped query
  // returns no row at all for a sprint with no tasks, and its `null` key is
  // the backlog, which has no bar on either surface.
  const sprintTaskCountsById = Object.fromEntries(
    sprints.map((sprint) => [
      sprint.id,
      sprintCounts.get(sprint.id) ?? { todo: 0, in_progress: 0, done: 0 },
    ]),
  )

  /*
   * Who a name typed into a board composer may resolve to.
   *
   * The whole workspace, each flagged by whether they are on THIS app, so the
   * preview can distinguish "that name is nobody" from "that is Shanika, who
   * isn't on this app" — two different problems that used to share one wrong
   * message. createTask only requires the assignee to be a real user, so the
   * wider list is assignable, not merely displayable.
   *
   * The fallback matters: if the roster query is ever gated off this tab
   * again, falling back to the team keeps name resolution working instead of
   * silently answering every name with "no one in the workspace called…".
   */
  const teamUserIds = new Set(team.map((member) => member.userId))
  const composerPeople =
    activeUsers.length > 0
      ? activeUsers.map((user) => ({
          id: user.id,
          name: user.name,
          onTeam: teamUserIds.has(user.id),
        }))
      : team.map((member) => ({ id: member.userId, name: member.name, onTeam: true }))

  const boardTasks = board ? [...board.todo, ...board.in_progress, ...board.done] : []
  const selectedRead = selectedSprint
    ? readSprint(
        selectedSprint,
        sprintCounts.get(selectedSprint.id) ?? { todo: 0, in_progress: 0, done: 0 },
        todayIso,
      )
    : null
  // Self-report vs cards, per person, using the same threshold the check-in
  // card on Overview uses — a second definition of "disagrees" would let the
  // two surfaces contradict each other about the same person.
  const progressInput = boardTasks.map((task) => ({
    assigneeId: task.assignee?.id ?? null,
    status: task.status,
  }))
  const checkinGapCount = checkins.filter((row) => {
    const gap = checkinGap(row.percent, computeTaskProgress(progressInput, row.userId))
    // 'unknown' means that person has no cards in this sprint at all — there
    // is nothing for their report to disagree WITH, so counting it would
    // flag everyone who checked in before being assigned anything.
    return gap === 'ahead' || gap === 'behind'
  }).length

  return (
    <div className="flex flex-1 flex-col gap-5 p-6">
      <AppHeader
        name={app.name}
        slug={app.slug}
        status={app.status}
        description={app.description}
        repoUrl={app.repoUrl}
        techTags={app.techTags}
        leadName={app.leadName}
        pmName={app.pmName}
        health={health}
        tasks={tasks}
        memberCount={team.length}
        sprintCount={sprints.length}
        meetingCount={counts.meetings}
        /* Report a bug sits in the HEADER, not in the Bugs tab, because
           `bug.report` is granted 'all' from member up while `bug.view` is
           scoped: somebody outside this project can file a report and cannot
           open the tab. Putting the affordance behind the tab would silence
           exactly the person the grant was widened for. It is also true of
           everyone else that a bug is hit on the Roadmap or in Discussion,
           not on the Bugs tab. */
        actions={
          canReportBugs || isAdmin ? (
            <>
              {canReportBugs ? <ReportBugDialog appId={app.id} appName={app.name} /> : null}
              {isAdmin ? (
                <AppFormDialog
                  appId={app.id}
                  initialValues={{
                    name: app.name,
                    description: app.description,
                    repoUrl: app.repoUrl,
                    techTags: app.techTags,
                    status: app.status,
                    leadId: app.leadId,
                    pmId: app.pmId,
                  }}
                  workspaceTechTags={workspaceTechTags}
                  activeUsers={activeUsers}
                  trigger={<Button variant="outline" size="sm" />}
                  aiGenerateEnabled={appMetadataEnabled}
                />
              ) : null}
            </>
          ) : undefined
        }
      />

      <AppTabNav
        slug={slug}
        active={tab}
        tabs={available}
        // Open bugs only — resolved ones are not a number anybody has to act
        // on, and the list under the badge counts the same way (see
        // OPEN_BUG_STATUSES).
        counts={{ discussion: counts.comments, meetings: counts.meetings, bugs: openBugCount }}
      />

      {tab === 'overview' ? (
        <div className="flex flex-col gap-6">
          {health.reasons.length > 0 ? (
            <section
              aria-label="What needs attention"
              className="flex flex-col gap-1.5 rounded-xl border bg-card p-4"
            >
              <h2 className="font-heading text-sm font-semibold">What needs attention</h2>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {health.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 size-1.5 shrink-0 rounded-full',
                        health.level === 'at-risk' ? 'bg-destructive' : 'bg-warning',
                      )}
                    />
                    {reason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {currentSprint ? (
            <>
              <AppSprintBand sprint={currentSprint} tasks={tasks} today={today} />
              <SprintCheckins
                appId={app.id}
                sprintId={currentSprint.id}
                currentUser={
                  session?.user
                    ? {
                        id: session.user.id,
                        name: session.user.name ?? session.user.email,
                        avatarUrl: session.user.image ?? null,
                      }
                    : null
                }
              />
            </>
          ) : (
            <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <h2 className="font-heading text-sm font-semibold">No sprint running</h2>
              <p className="text-sm text-muted-foreground">
                {nextSprint
                  ? `${nextSprint.name} starts ${format(parseCalendarDate(nextSprint.startDate), 'MMMM d')}.`
                  : 'Nothing is scheduled. Open the Board to plan one.'}
              </p>
              <TaskSplitBar tasks={tasks} className="pt-1" />
            </section>
          )}

          <TeamPanel
            appId={app.id}
            appName={app.name}
            team={team}
            activeUsers={activeUsers}
            isAdmin={isAdmin}
          />

          {/* Directly under Team on purpose: Team is the plan (who is on this,
              at what allocation), this is the record of what came of it. */}
          <AppContributions contributions={contributions} appName={app.name} />

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-heading text-sm font-semibold">Recent activity</h2>
              <Link
                href={`/apps/${slug}?tab=activity`}
                className="rounded-sm text-xs text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                See all
              </Link>
            </div>
            <AppActivity
              items={activity}
              today={today}
              emptyHint="Comments, tasks, meetings and team changes will show up here as the app gets going."
            />
          </section>
        </div>
      ) : null}

      {tab === 'roadmap' ? (
        <div className="flex flex-col gap-4">
          {/* What this viewer may actually do here, stated once. The board
              below hides what you cannot use — a member sees no sprint
              controls and no delete — so without this line the only way to
              learn where your reach ends is to try something. Both branches
              are the real server rules: createTask takes any session,
              updateTask and canMoveTask take an admin OR the assignee, and
              every sprint action takes an admin. */}
          {board && session?.user ? (
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? 'You can change any task on this board, and the sprints themselves — dates, status and order.'
                : 'You can add a task to any column and move or edit the ones assigned to you — sprints and their dates are set by an admin.'}
            </p>
          ) : null}

          {/* THE SPINE. The schedule and the sprint selector are one object —
              clicking a bar is what changes the board below it. This is the
              merge: a plan you can read the shape of, with the work inside it
              on the same screen, instead of a Board tab with no time in it and
              a Roadmap tab with no work in it. */}
          {spineSprints.length > 0 ? (
            <RoadmapSpine
              sprints={spineSprints}
              selectedId={isBacklog ? null : (selectedSprint?.id ?? null)}
              todayIso={todayIso}
              zoom={spineZoom}
              hrefFor={(sprintId) => planHref({ sprint: sprintId })}
              // 'month' is parseZoom's default, so it is written as the
              // ABSENCE of the param — the canonical link stays clean.
              zoomHrefFor={(level) => planHref({ zoom: level === 'month' ? undefined : level })}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Kept alongside the spine rather than replaced by it: the bars
                  are the fast path, but a long-running app accumulates more
                  sprints than fit on screen, and a list is still the reliable
                  way to reach an old one. */}
              <SprintSwitcher
                sprints={sprints}
                selectedId={isBacklog ? '' : (selectedSprint?.id ?? '')}
              />
              <Link
                href={isBacklog ? boardHref(slug) : boardHref(slug, 'backlog')}
                className={cn(buttonVariants({ variant: isBacklog ? 'default' : 'outline' }))}
              >
                Backlog
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && !isBacklog && selectedSprint ? (
                <ExportButton sprintId={selectedSprint.id} />
              ) : null}
              {isAdmin ? (
                <SprintFormDialog appId={app.id} aiDraftEnabled={sprintDraftEnabled} />
              ) : null}
            </div>
          </div>

          {!isBacklog && selectedSprint ? (
            <div className="flex flex-col gap-1 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-heading text-base font-semibold">{selectedSprint.name}</h2>
                {isAdmin ? (
                  <SprintStatusSelect
                    sprintId={selectedSprint.id}
                    status={selectedSprint.status}
                  />
                ) : (
                  <Badge variant={SPRINT_STATUS_VARIANT[selectedSprint.status]}>
                    {SPRINT_STATUS_LABEL[selectedSprint.status]}
                  </Badge>
                )}
              </div>
              {selectedSprint.goal ? (
                <p className="text-sm text-muted-foreground">{selectedSprint.goal}</p>
              ) : null}
              <p className="font-mono text-xs text-muted-foreground tabular-nums">
                {format(parseCalendarDate(selectedSprint.startDate), 'MMM d, yyyy')} –{' '}
                {format(parseCalendarDate(selectedSprint.endDate), 'MMM d, yyyy')}
              </p>
            </div>
          ) : null}

          {/* The judgement line, between the plan and the work: what this
              sprint's shape actually means, and the handful of things worth
              acting on. Each count links to the cards it is about. */}
          {selectedRead && !isBacklog ? (
            <PlanReadStrip
              read={selectedRead}
              gaps={planGaps(boardTasks)}
              checkinGapCount={checkinGapCount}
              boardHrefFor={(params) => planHref(params)}
            />
          ) : null}

          {isBacklog ? (
            <p className="text-sm text-muted-foreground">
              Backlog — tasks not assigned to any sprint.
            </p>
          ) : null}

          {board && session?.user ? (
            <Board
              initialBoard={board}
              team={team.map((member) => ({ userId: member.userId, name: member.name }))}
              composerPeople={composerPeople}
              appId={app.id}
              sprintId={boardSprintId}
              currentUser={{ id: session.user.id, role: session.user.role }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <p className="font-heading text-base font-semibold">Nothing to fetch here yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {isAdmin
                  ? 'This app has no sprints. Create the first one and LogPup will keep watch over the board.'
                  : 'No sprints planned for this app yet. LogPup is keeping an eye out — check back soon.'}
              </p>
              {isAdmin ? (
                <SprintFormDialog appId={app.id} aiDraftEnabled={sprintDraftEnabled} />
              ) : null}
            </div>
          )}

          {/* Rescheduling — dragging a sprint's dates, resizing it, editing or
              deleting it — still lives in the full timeline. It is folded away
              rather than removed: the spine above answers "how is the plan
              going", which is what people come here for many times a day, and
              this answers "change the plan", which is occasional. Two open
              timelines on one screen would be exactly the duplication this
              merge exists to remove. */}
          {sprints.length > 0 ? (
            // LazyDisclosure, not a bare <details>: the timeline scrolls to
            // today on mount, and inside a closed <details> that would resolve
            // against a zero-width box and land on the oldest sprint instead.
            <LazyDisclosure
              // Open for anyone who can actually change the plan. Collapsed,
              // this was read as the feature being gone: the spine above is
              // the thing that LOOKS like the roadmap, and it only selects —
              // clicking, dragging and editing a sprint all live down here.
              // A closed <details> is right for detail you might want; it is
              // wrong for the only place an action exists.
              defaultOpen={isAdmin}
              summary={isAdmin ? 'Edit the schedule' : 'See the full schedule'}
              hint={
                isAdmin
                  ? 'click a sprint to edit it, or drag to move and resize'
                  : 'every sprint, with dates'
              }
            >
              <Roadmap sprints={sprints} slug={slug} counts={sprintTaskCountsById} />
            </LazyDisclosure>
          ) : null}
        </div>
      ) : null}

      {tab === 'discussion' ? (
        <AppComments
          appId={app.id}
          comments={comments}
          users={activeUsers.map((user) => ({ id: user.id, name: user.name }))}
        />
      ) : null}

      {tab === 'meetings' ? (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <MeetingForm
              apps={assignableApps.map((a) => ({ id: a.id, name: a.name }))}
              activeUsers={activeUsers}
              defaultAppId={app.id}
              trigger={<Button size="sm">New meeting</Button>}
            />
          </div>
          <MeetingList
            meetings={appMeetings}
            currentUserId={session?.user?.id ?? ''}
            isAdmin={isAdmin}
            hideAppId={app.id}
            users={activeUsers}
          />
        </div>
      ) : null}

      {tab === 'bugs' ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-prose text-sm text-muted-foreground">
              What is broken in {app.name}, and who has it. Reports arrive from wherever
              somebody hit the problem — the page they were on comes with them.
            </p>
            {/* Import sits beside the list rather than in the header: filing one
                bug is something anyone does from wherever they hit it, but
                importing a file of them is a triage act, done here, looking at
                the queue they land in. */}
            <BugCsvImportDialog appId={app.id} appName={app.name} canImport={canTriageBugs} />
          </div>
          <BugList
            bugs={bugs}
            filters={bugFilters}
            filterHrefFor={(patch) => bugFilterHref(slug, bugFilters, patch)}
            emptyHint={
              bugFilters.status || bugFilters.severity
                ? 'No bug matches that filter. Clear it to see the rest.'
                : 'Nothing has been reported against this app. Report a bug from the page it broke on — the route comes with it — and it will land here.'
            }
            assignableUsers={activeUsers.map((user) => ({ id: user.id, name: user.name }))}
            canTriage={canTriageBugs ? () => true : undefined}
            canDelete={canDeleteBugs ? () => true : undefined}
          />
        </div>
      ) : null}

      {tab === 'activity' ? (
        <AppActivity
          items={activity}
          today={today}
          emptyHint="Comments, tasks, meetings and team changes all land here — the first one will show up as soon as someone does something."
        />
      ) : null}

      {tab === 'settings' ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <h2 className="font-heading text-sm font-semibold">App details</h2>
            <p className="text-sm text-muted-foreground">
              Name, description, repo, tech tags, PM, lead and status. Changes apply
              immediately and the app&apos;s address stays <code className="font-mono">/apps/{slug}</code>.
            </p>
            <div className="pt-1">
              <AppFormDialog
                appId={app.id}
                initialValues={{
                  name: app.name,
                  description: app.description,
                  repoUrl: app.repoUrl,
                  techTags: app.techTags,
                  status: app.status,
                  leadId: app.leadId,
                  pmId: app.pmId,
                }}
                workspaceTechTags={workspaceTechTags}
                activeUsers={activeUsers}
                aiGenerateEnabled={appMetadataEnabled}
              />
            </div>
          </div>

          <AppRoleHistoryCard history={roleHistory} />

          <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
            <h2 className="font-heading text-sm font-semibold">Archiving</h2>
            <p className="text-sm text-muted-foreground">
              Set the status to <span className="font-medium text-foreground">Archived</span> above
              to retire this app. It keeps all of its history and drops out of the default
              Apps view, but nothing is deleted.
            </p>
          </div>

          {/* Deleting is the harder of the two, so it is read second — and it
              is safe on the same gate as this whole tab, because `app.delete`
              grants exactly the seats isAdminRole covers (superadmin, admin)
              with no scoped arm. The action re-checks the capability
              regardless; this only decides what is offered. */}
          <DeleteAppCard appId={app.id} appName={app.name} slug={slug} />
        </div>
      ) : null}
    </div>
  )
}
