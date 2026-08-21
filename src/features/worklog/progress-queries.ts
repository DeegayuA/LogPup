import { and, asc, desc, eq, gte, inArray, lte, or } from 'drizzle-orm'
import { db } from '@/db'
import { absences, assignments, users, workSchedules } from '@/db/schema'
import { liveApps, liveWorklogEntries } from '@/db/live'
import { canHoldWork } from '@/features/people/removal-queries'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { computeCoverage, type CoverageSummary } from '@/features/worklog/coverage'
import { buildHolidayCalendar, closesTheStudio } from '@/features/worklog/holiday-listing'
import { listOrgHolidays } from '@/features/worklog/org-holiday-queries'
import { addDaysIso, eachDayInclusive } from '@/features/worklog/progress-params'
import { buildMixLegend, type DayEntry, type LegendEntry } from '@/features/worklog/day-app-mix'
import { getTeamWorklogs } from '@/features/worklog/queries'
import { patternForDay, type SchedulePattern } from '@/features/worklog/schedules'
import { listApps, type AppMember } from '@/features/apps/queries'
import { getActiveSprints } from '@/features/sprints/queries'
import { getOpenBugCounts } from '@/features/bugs/queries'
import { sprintProgress } from '@/features/dashboard/sprint-progress'

/**
 * Read-only composition for /progress. No writes live here and none may:
 * the page answers "who did what, where, how far" and changes nothing.
 *
 * The shape of every function is one batch of parallel reads and pure math on
 * top — never a query per person or per app. `getTeamWorklogs` is already a
 * single range read over everybody; the roster, absences and schedules are
 * one `inArray` read each; the apps lane rides the three grouped queries the
 * dashboard and portfolio already pay for (`listApps`, `getActiveSprints`,
 * `getOpenBugCounts`, all react-cached or grouped).
 */

/** How far an actor's `worklog.view` (or `app.view`) reaches. */
export type ProgressScope = 'all' | ReadonlySet<string>

// ---------------------------------------------------------------------------
// People × days matrix
// ---------------------------------------------------------------------------

export type ProgressPersonRow = {
  id: string
  name: string
  avatarUrl: string | null
  /** First day this person owed a log — users.createdAt, Colombo. */
  joinDay: string
  /** Self-scored percent per logged ISO day in the window. */
  percentByDay: ReadonlyMap<string, number>
  /** Days covered by an APPROVED absence. Pending ones never excuse. */
  absentDays: ReadonlySet<string>
  /**
   * What each logged day went TO, from worklog_entries — the question the
   * percent raises and cannot answer. Absent for a day with no entries, which
   * is normal rather than missing: daily_worklogs carries the percent, and
   * per-project entries are a separate, optional record on top of it.
   */
  entriesByDay: ReadonlyMap<string, DayEntry[]>
  coverage: CoverageSummary
}

export type ProgressMatrixData = {
  /** The visible columns, oldest first, both ends inclusive. */
  days: string[]
  /** Days the studio is actually shut inside the window. */
  closedDays: ReadonlySet<string>
  /** Holiday name per closed day, for cell titles. */
  holidayNames: ReadonlyMap<string, string>
  /** Rows, most owed days first — the page's job is finding gaps. */
  people: ProgressPersonRow[]
  /**
   * Projects appearing anywhere in the visible grid, heaviest first — the
   * legend for the colour bars. Built from the SAME entries the cells are, so
   * a hue on screen always has a name under it and vice versa.
   */
  mixLegend: LegendEntry[]
}

type ScheduleWindowRow = {
  pattern: SchedulePattern
  logging: 'daily' | 'none'
  effectiveFrom: string
  effectiveTo: string | null
}

/**
 * Whether a log is expected from this person AT ALL, as of `iso` — the
 * work_schedules.logging column resolved with the same half-open interval
 * rule `patternForDay` uses. 'daily' when no row covers the day, matching
 * the column default.
 */
function loggingInForce(rows: readonly ScheduleWindowRow[], iso: string): 'daily' | 'none' {
  for (const row of rows) {
    if (row.effectiveFrom > iso) continue
    if (row.effectiveTo !== null && row.effectiveTo <= iso) continue
    return row.logging
  }
  return 'daily'
}

/**
 * Everything the people×days matrix needs, in one roster read plus one
 * parallel batch of four range reads — a fixed query count however many
 * people are visible.
 *
 * Scope semantics mirror the capability matrix: 'all' is every person who
 * can hold work; a set narrows the roster to people holding an assignment on
 * any of those apps. The actor keeps their own row on an unfiltered scoped
 * view — their log is theirs to see wherever they sit — but an explicit app
 * filter means "people on this app" and is not padded with the viewer.
 */
export async function getProgressMatrix(opts: {
  scope: ProgressScope
  actorId: string
  /** Already validated by the caller against the apps the actor may see. */
  appId?: string | null
  q?: string
  /** Inclusive window bounds, Asia/Colombo ISO days. */
  from: string
  to: string
  today: string
}): Promise<ProgressMatrixData> {
  const days = eachDayInclusive(opts.from, opts.to)
  const empty: ProgressMatrixData = {
    days,
    closedDays: new Set(),
    holidayNames: new Map(),
    people: [],
    mixLegend: [],
  }

  // Which app memberships admit a person onto the matrix. null = everyone.
  const appIds = opts.appId
    ? opts.scope === 'all' || opts.scope.has(opts.appId)
      ? [opts.appId]
      : []
    : opts.scope === 'all'
      ? null
      : [...opts.scope]
  if (appIds !== null && appIds.length === 0) return empty

  const identity = {
    id: users.id,
    name: users.name,
    avatarUrl: users.avatarUrl,
    createdAt: users.createdAt,
  }
  const roster =
    appIds === null
      ? await db.select(identity).from(users).where(canHoldWork()).orderBy(asc(users.name))
      : await db
          .selectDistinct(identity)
          .from(users)
          .leftJoin(assignments, eq(assignments.userId, users.id))
          .where(
            and(
              canHoldWork(),
              opts.appId
                ? inArray(assignments.appId, appIds)
                : or(inArray(assignments.appId, appIds), eq(users.id, opts.actorId)),
            ),
          )
          .orderBy(asc(users.name))

  // Name filter BEFORE the range reads, so a narrowed matrix narrows the
  // absence/schedule reads with it.
  const q = opts.q?.trim().toLowerCase()
  const visible = q ? roster.filter((row) => row.name.toLowerCase().includes(q)) : roster
  if (visible.length === 0) return empty

  const ids = visible.map((row) => row.id)
  const idSet = new Set(ids)
  // computeCoverage takes a half-open [from, to); the window is inclusive.
  const toExclusive = addDaysIso(opts.to, 1)

  const [teamRows, absenceRows, scheduleRows, orgRows, entryRows] = await Promise.all([
    // Already a single bounded range read over EVERYBODY — filtered to the
    // visible people here rather than re-queried per person.
    getTeamWorklogs(opts.from, opts.to),
    db
      .select({ userId: absences.userId, startDate: absences.startDate, endDate: absences.endDate })
      .from(absences)
      .where(
        and(
          inArray(absences.userId, ids),
          // APPROVED ONLY — same rule as approvedAbsenceDays: a pending
          // absence never lowers anyone's denominator.
          eq(absences.status, 'approved'),
          lte(absences.startDate, opts.to),
          gte(absences.endDate, opts.from),
        ),
      ),
    db
      .select({
        userId: workSchedules.userId,
        pattern: workSchedules.pattern,
        logging: workSchedules.logging,
        effectiveFrom: workSchedules.effectiveFrom,
        effectiveTo: workSchedules.effectiveTo,
      })
      .from(workSchedules)
      .where(inArray(workSchedules.userId, ids))
      .orderBy(desc(workSchedules.effectiveFrom)),
    listOrgHolidays(),
    // One bounded range read for the whole visible grid, matching the shape of
    // the reads beside it — never per person and never per day.
    //
    // liveApps, not the raw table: a project someone TRASHED must not put its
    // name and its hue back on the grid. The entry survives the project being
    // removed (app_id is ON DELETE SET NULL and the row keeps its minutes), so
    // that time renders as unassigned, which is what it has become.
    db
      .select({
        userId: liveWorklogEntries.userId,
        day: liveWorklogEntries.day,
        appId: liveWorklogEntries.appId,
        appName: liveApps.name,
        minutes: liveWorklogEntries.minutes,
      })
      // The LIVE view, not the raw table: worklog entries are soft-deleted, so
      // reading the table directly would keep counting hours somebody removed
      // — and this feeds a per-person progress matrix, where a phantom hour is
      // read as work that happened. db/live.test.ts caught this.
      .from(liveWorklogEntries)
      .leftJoin(liveApps, eq(liveWorklogEntries.appId, liveApps.id))
      .where(
        and(
          inArray(liveWorklogEntries.userId, ids),
          gte(liveWorklogEntries.day, opts.from),
          lte(liveWorklogEntries.day, opts.to),
        ),
      ),
  ])

  // ONE holiday composition for the whole range: the gazette merged with the
  // company's own rows, kept only where the studio actually closes — the
  // same closesTheStudio the admin holidays page states, so the matrix and
  // that page can never disagree about the 27th.
  const closedDays = new Set<string>()
  const holidayNames = new Map<string, string>()
  for (const row of buildHolidayCalendar(orgRows)) {
    if (row.day < opts.from || row.day > opts.to) continue
    if (!closesTheStudio(row)) continue
    closedDays.add(row.day)
    // Gazetted rows sort first on a shared date, so the gazette names the day.
    if (!holidayNames.has(row.day)) holidayNames.set(row.day, row.name)
  }

  const percentByUser = new Map<string, Map<string, number>>()
  for (const row of teamRows) {
    if (!idSet.has(row.userId)) continue
    let byDay = percentByUser.get(row.userId)
    if (!byDay) {
      byDay = new Map()
      percentByUser.set(row.userId, byDay)
    }
    byDay.set(row.day, row.percent)
  }

  const entriesByUser = new Map<string, Map<string, DayEntry[]>>()
  for (const row of entryRows) {
    let byDay = entriesByUser.get(row.userId)
    if (!byDay) {
      byDay = new Map()
      entriesByUser.set(row.userId, byDay)
    }
    const list = byDay.get(row.day) ?? []
    // appName is null both for genuinely unassigned time and for a TRASHED
    // project. day-app-mix keeps those apart on appId, not on the name.
    list.push({ appId: row.appId, appName: row.appName, minutes: row.minutes })
    byDay.set(row.day, list)
  }

  // Absence bounds are INCLUSIVE on both ends (dates a person stated in
  // words); the window clip happens in exactly one place, same as the
  // worklog page's absenceDays.
  const absentByUser = new Map<string, Set<string>>()
  for (const row of absenceRows) {
    let set = absentByUser.get(row.userId)
    if (!set) {
      set = new Set()
      absentByUser.set(row.userId, set)
    }
    let day = row.startDate < opts.from ? opts.from : row.startDate
    for (; day <= row.endDate && day < toExclusive; day = addDaysIso(day, 1)) set.add(day)
  }

  const schedulesByUser = new Map<string, ScheduleWindowRow[]>()
  for (const row of scheduleRows) {
    const list = schedulesByUser.get(row.userId) ?? []
    // Newest first from the orderBy above — the order patternForDay expects.
    list.push({
      pattern: row.pattern,
      logging: row.logging,
      effectiveFrom: toIsoDateInTimeZone(row.effectiveFrom, LK_TIMEZONE),
      effectiveTo: row.effectiveTo ? toIsoDateInTimeZone(row.effectiveTo, LK_TIMEZONE) : null,
    })
    schedulesByUser.set(row.userId, list)
  }

  const people = visible.map((person): ProgressPersonRow => {
    const joinDay = toIsoDateInTimeZone(person.createdAt, LK_TIMEZONE)
    const percentByDay = percentByUser.get(person.id) ?? new Map<string, number>()
    const absentDays = absentByUser.get(person.id) ?? new Set<string>()
    const schedule = schedulesByUser.get(person.id) ?? []
    const coverage = computeCoverage({
      from: opts.from,
      to: toExclusive,
      loggedDays: new Set(percentByDay.keys()),
      exemptDays: absentDays,
      isHoliday: (iso) => closedDays.has(iso),
      patternFor: (iso) => patternForDay(schedule, iso),
      joinedOn: joinDay,
      today: opts.today,
      logsWork: loggingInForce(schedule, opts.today) !== 'none',
    })
    return {
      id: person.id,
      name: person.name,
      avatarUrl: person.avatarUrl,
      joinDay,
      percentByDay,
      absentDays,
      entriesByDay: entriesByUser.get(person.id) ?? new Map<string, DayEntry[]>(),
      coverage,
    }
  })

  // Most owed first — the reader is here to find gaps, not alphabet.
  people.sort(
    (a, b) => b.coverage.missing - a.coverage.missing || a.name.localeCompare(b.name),
  )

  // Built from the rows that actually reached the grid, so the legend can
  // never name a project no cell shows, or omit one that a cell colours.
  const mixLegend = buildMixLegend(
    entryRows.map((row) => ({ appId: row.appId, appName: row.appName, minutes: row.minutes })),
  )

  return { days, closedDays, holidayNames, people, mixLegend }
}

// ---------------------------------------------------------------------------
// Apps lane
// ---------------------------------------------------------------------------

/** The light list the filter Select needs — id and name, nothing heavier. */
export type ProgressAppOption = { id: string; name: string }

/**
 * Apps the actor may see, as picker options. Deliberately its own thin read
 * rather than `listApps()`: the filter bar renders before either data zone,
 * and it must not wait behind the portfolio's six aggregate queries.
 */
export async function listProgressAppOptions(
  appScope: ProgressScope,
): Promise<ProgressAppOption[]> {
  const rows = await db
    .select({ id: liveApps.id, name: liveApps.name, status: liveApps.status })
    .from(liveApps)
    .orderBy(asc(liveApps.name))
  return rows
    .filter(
      (row) => row.status !== 'archived' && (appScope === 'all' || appScope.has(row.id)),
    )
    .map(({ id, name }) => ({ id, name }))
}

export type ProgressSprint = {
  id: string
  name: string
  startDate: string
  endDate: string
  done: number
  total: number
  /** Fraction in [0, 1], the same math as the dashboard card. */
  progress: number
  /** Running by date but never flipped to Active — badged, not hidden. */
  notStarted: boolean
}

export type ProgressAppRow = {
  id: string
  name: string
  slug: string
  status: string
  /**
   * Whether this app sits inside the actor's worklog scope. Out-of-scope but
   * app.view-visible apps get the same card WITHOUT per-person data — the
   * partial tier, derived from existing grants and nothing else.
   */
  fullDetail: boolean
  sprint: ProgressSprint | null
  openBugs: number
  lastActivityAt: Date | null
  /** Empty on partial-tier cards. */
  members: Pick<AppMember, 'userId' | 'name' | 'avatarUrl'>[]
}

/**
 * One card's worth of facts per visible app: the running sprint with its task
 * counts, the open bug backlog, and when anything last happened.
 */
export async function getProgressApps(opts: {
  /** app.view reach — which apps appear at all. */
  appScope: ProgressScope
  /** worklog.view reach — which apps get the full (per-person) tier. */
  detailScope: ProgressScope
  appId?: string | null
}): Promise<ProgressAppRow[]> {
  const [apps, activeSprints, bugCounts] = await Promise.all([
    listApps(),
    getActiveSprints(),
    getOpenBugCounts(),
  ])

  const countsBySprint = new Map(activeSprints.map((sprint) => [sprint.sprintId, sprint]))
  const bugsByApp = new Map(bugCounts.map((entry) => [entry.appId, entry.open]))

  const rows = apps
    .filter(
      (app) =>
        app.status !== 'archived' &&
        (opts.appScope === 'all' || opts.appScope.has(app.id)) &&
        (!opts.appId || app.id === opts.appId),
    )
    .map((app): ProgressAppRow => {
      const current = app.stats.currentSprint
      const live = current ? countsBySprint.get(current.id) : undefined
      const counts = live?.counts
      const total = counts ? counts.todo + counts.in_progress + counts.done : 0
      const fullDetail = opts.detailScope === 'all' || opts.detailScope.has(app.id)
      return {
        id: app.id,
        name: app.name,
        slug: app.slug,
        status: app.status,
        fullDetail,
        sprint: current
          ? {
              id: current.id,
              name: current.name,
              startDate: current.startDate,
              endDate: current.endDate,
              done: counts?.done ?? 0,
              total,
              progress: counts ? sprintProgress(counts) : 0,
              notStarted: live?.status === 'planned',
            }
          : null,
        openBugs: bugsByApp.get(app.id) ?? 0,
        lastActivityAt: app.stats.lastActivityAt,
        members: fullDetail
          ? app.members.map(({ userId, name, avatarUrl }) => ({ userId, name, avatarUrl }))
          : [],
      }
    })

  // Your own projects first; inside a tier, alphabetical — a stable order a
  // reader can learn.
  rows.sort(
    (a, b) => Number(b.fullDetail) - Number(a.fullDetail) || a.name.localeCompare(b.name),
  )
  return rows
}
