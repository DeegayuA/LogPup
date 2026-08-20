import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import { liveApps, liveBugReports } from '@/db/live'
import { users } from '@/db/schema'
import {
  OPEN_BUG_STATUSES,
  type BugSeverity,
  type BugStatus,
} from '@/features/bugs/bug-display'
import type { BugFilters } from '@/features/bugs/report-input'

/**
 * Every read of a bug report.
 *
 * ALWAYS THROUGH `liveBugReports`, never the base table — a trashed bug must
 * disappear from the app's tab, the tab's count and the triage queue at the
 * same instant, and src/db/live.test.ts fails this file if it ever forgets.
 * `liveApps` is joined for the same reason one layer up: a bug whose PROJECT
 * is in the trash is not an open bug anybody can act on, and leaving it in the
 * queue would resurface a deleted project by name.
 *
 * The tables are named literally in each query below and must stay that way —
 * hoisting them into a shared `{ table, columns }` helper makes live.test.ts's
 * source scan match nothing and pass while the reads it exists to guard sit
 * unchecked. See the comment on SearchProvider.search for the long version.
 *
 * ORDERING COMES FROM THE PG ENUMS. `order by status asc` is open, triaged,
 * in progress, resolved, closed and `order by severity desc` is critical
 * first, because Postgres sorts an enum by declaration order and both enums
 * are declared in exactly that order (bug-display.ts pins this, and
 * apps/search-providers.ts already relies on the same property for app
 * status). No CASE expression, no lookup table, and no second copy of the
 * order to drift.
 */

/** How many bugs one app's tab will render before it stops. */
const APP_BUG_LIMIT = 200

/** How many rows the workspace triage queue shows in one go. */
export const TRIAGE_QUEUE_LIMIT = 100

export type BugRow = {
  id: string
  title: string
  description: string
  severity: BugSeverity
  status: BugStatus
  pagePath: string | null
  reportedById: string
  reportedByName: string | null
  reportedByAvatarUrl: string | null
  assignedToId: string | null
  assignedToName: string | null
  linkedTaskId: string | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** A bug plus the project it is about, for surfaces that span projects. */
export type BugQueueRow = BugRow & {
  appId: string
  appName: string
  appSlug: string
}

const reporter = alias(users, 'bug_reporter')
const assignee = alias(users, 'bug_assignee')

/**
 * The select list, written once. This is a COLUMN LIST, not a table
 * reference — the tables themselves stay literal at every `.from()` and
 * `.leftJoin()` below, which is the part the soft-delete scan reads.
 */
const bugColumns = {
  id: liveBugReports.id,
  title: liveBugReports.title,
  description: liveBugReports.description,
  severity: liveBugReports.severity,
  status: liveBugReports.status,
  pagePath: liveBugReports.pagePath,
  reportedById: liveBugReports.reportedBy,
  reportedByName: reporter.name,
  reportedByAvatarUrl: reporter.avatarUrl,
  assignedToId: liveBugReports.assignedTo,
  assignedToName: assignee.name,
  linkedTaskId: liveBugReports.linkedTaskId,
  resolvedAt: liveBugReports.resolvedAt,
  createdAt: liveBugReports.createdAt,
  updatedAt: liveBugReports.updatedAt,
}

/**
 * One app's bug list, optionally narrowed.
 *
 * Ordered worst-and-least-attended first rather than newest first: a project's
 * bug tab is a work queue, and the row that has been sitting at `open` /
 * `critical` for a fortnight is the one it must not bury under this morning's
 * cosmetic report. The workspace queue below makes the opposite choice on
 * purpose — see its comment.
 */
export async function listBugsForApp(appId: string, filters: BugFilters = {}): Promise<BugRow[]> {
  const conditions = [eq(liveBugReports.appId, appId)]
  if (filters.status) conditions.push(eq(liveBugReports.status, filters.status))
  if (filters.severity) conditions.push(eq(liveBugReports.severity, filters.severity))

  return db
    .select(bugColumns)
    .from(liveBugReports)
    // Inner, not left: no app row means the project is trashed, and its bugs
    // go with it.
    .innerJoin(liveApps, eq(liveApps.id, liveBugReports.appId))
    // Left, both of them: `reported_by` is NOT NULL at the column level, but a
    // left join costs nothing and keeps a report readable even if its
    // reporter's row ever goes missing. The report is the record; the person
    // is an attribution on it.
    .leftJoin(reporter, eq(reporter.id, liveBugReports.reportedBy))
    .leftJoin(assignee, eq(assignee.id, liveBugReports.assignedTo))
    .where(and(...conditions))
    .orderBy(asc(liveBugReports.status), desc(liveBugReports.severity), desc(liveBugReports.createdAt))
    .limit(APP_BUG_LIMIT)
}

/** One bug, with the project it belongs to. Null when it is trashed or gone. */
export async function getBugById(bugId: string): Promise<BugQueueRow | null> {
  const [row] = await db
    .select({
      ...bugColumns,
      appId: liveApps.id,
      appName: liveApps.name,
      appSlug: liveApps.slug,
    })
    .from(liveBugReports)
    .innerJoin(liveApps, eq(liveApps.id, liveBugReports.appId))
    .leftJoin(reporter, eq(reporter.id, liveBugReports.reportedBy))
    .leftJoin(assignee, eq(assignee.id, liveBugReports.assignedTo))
    .where(eq(liveBugReports.id, bugId))
    .limit(1)
  return row ?? null
}

/**
 * How many bugs are still somebody's problem on one app — the number beside
 * the Bugs tab.
 *
 * Counts the OPEN statuses only (bug-display.ts owns that set), so the badge
 * and the list underneath it can never disagree about what "3" meant.
 */
export async function getOpenBugCountForApp(appId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(liveBugReports)
    .innerJoin(liveApps, eq(liveApps.id, liveBugReports.appId))
    .where(
      and(
        eq(liveBugReports.appId, appId),
        inArray(liveBugReports.status, [...OPEN_BUG_STATUSES]),
      ),
    )
  return row?.total ?? 0
}

export type OpenBugCount = { appId: string; appName: string; appSlug: string; open: number }

/**
 * Open bugs per project, worst backlog first.
 *
 * ONE grouped query rather than a count per app, for the reason
 * apps/queries.ts states at `countWhere`: the alternative turns a forty-app
 * workspace into forty round trips the first time somebody wants this number
 * on a grid. Projects with nothing open are absent rather than present with a
 * zero — every caller is asking "where are the bugs", and a list of zeroes is
 * noise in the answer.
 */
export async function getOpenBugCounts(): Promise<OpenBugCount[]> {
  return db
    .select({
      appId: liveApps.id,
      appName: liveApps.name,
      appSlug: liveApps.slug,
      open: count(),
    })
    .from(liveBugReports)
    .innerJoin(liveApps, eq(liveApps.id, liveBugReports.appId))
    .where(inArray(liveBugReports.status, [...OPEN_BUG_STATUSES]))
    .groupBy(liveApps.id, liveApps.name, liveApps.slug)
    .orderBy(desc(count()), asc(liveApps.name))
}

/**
 * The workspace triage queue: every open bug on every live project.
 *
 * NEWEST FIRST, unlike the per-app list. This surface answers "what has come
 * in", and the thing a triager needs to see is the report filed twenty
 * minutes ago that nobody has read yet; severity is not a fact about a bug
 * until somebody has triaged it, so sorting an untriaged queue by severity
 * would be sorting it by the column default.
 */
export async function listTriageQueue(limit = TRIAGE_QUEUE_LIMIT): Promise<BugQueueRow[]> {
  return db
    .select({
      ...bugColumns,
      appId: liveApps.id,
      appName: liveApps.name,
      appSlug: liveApps.slug,
    })
    .from(liveBugReports)
    .innerJoin(liveApps, eq(liveApps.id, liveBugReports.appId))
    .leftJoin(reporter, eq(reporter.id, liveBugReports.reportedBy))
    .leftJoin(assignee, eq(assignee.id, liveBugReports.assignedTo))
    .where(inArray(liveBugReports.status, [...OPEN_BUG_STATUSES]))
    .orderBy(desc(liveBugReports.createdAt))
    .limit(limit)
}

/**
 * The app a bug belongs to, and nothing else.
 *
 * Exists because a scoped capability check needs the resource BEFORE it can
 * answer — `can(actor, 'bug.triage', { appId })` cannot be asked until the
 * appId is known, and asking it with the resource missing fails closed. So
 * every write in actions.ts reads this one row first. Deliberately not
 * `getBugById`: the guard needs an id and a slug, not a description and two
 * user joins.
 */
export async function getBugScope(
  bugId: string,
): Promise<{ appId: string; appName: string; appSlug: string; title: string; status: BugStatus } | null> {
  const [row] = await db
    .select({
      appId: liveApps.id,
      appName: liveApps.name,
      appSlug: liveApps.slug,
      title: liveBugReports.title,
      status: liveBugReports.status,
    })
    .from(liveBugReports)
    .innerJoin(liveApps, eq(liveApps.id, liveBugReports.appId))
    .where(eq(liveBugReports.id, bugId))
    .limit(1)
  return row ?? null
}
