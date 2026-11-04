import 'server-only'
import { and, asc, desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import { liveApps, liveSprints, liveTasks } from '@/db/live'
import { retroItems, sprintFeedback, standupEntries, users } from '@/db/schema'
import { formatTaskKey } from '@/features/sprints/task-key'
import { splitReviewTasks, type RetroKind, type ReviewQaStatus, type ScrumView } from '@/features/sprints/scrum'

/**
 * Reads for the Scrum tab (PRD Module B). The new tables (standup_entries,
 * sprint_feedback, retro_items) carry no deletedAt and are read directly;
 * every task or sprint they point at goes through the live views, so a
 * binned task shows up as "no linked task" rather than leaking its title.
 *
 * None of these check permission: the page that calls loadScrumView has
 * already gated on app.view, and this module is 'server-only' so it cannot be
 * reached from the browser.
 */

type AppKey = { key: string | null; number: number }

function keyOf(app: AppKey | null, n: number | null): string | null {
  return app && n !== null ? formatTaskKey(app, n) : null
}

function appKey(key: string | null, number: number | null): AppKey | null {
  return number === null ? null : { key, number }
}

export type StandupEntry = {
  id: string
  userId: string
  userName: string
  avatarUrl: string | null
  yesterday: string | null
  today: string | null
  blockers: string | null
  updatedAt: Date
}

export async function getStandups(sprintId: string, day: string): Promise<StandupEntry[]> {
  return db
    .select({
      id: standupEntries.id,
      userId: standupEntries.userId,
      userName: users.name,
      avatarUrl: users.avatarUrl,
      yesterday: standupEntries.yesterday,
      today: standupEntries.today,
      blockers: standupEntries.blockers,
      updatedAt: standupEntries.updatedAt,
    })
    .from(standupEntries)
    .innerJoin(users, eq(users.id, standupEntries.userId))
    .where(and(eq(standupEntries.sprintId, sprintId), eq(standupEntries.day, day)))
    .orderBy(asc(users.name))
}

/** Days that have at least one entry, newest first, the last two weeks' worth. */
export async function getStandupDays(sprintId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ day: standupEntries.day })
    .from(standupEntries)
    .where(eq(standupEntries.sprintId, sprintId))
    .orderBy(desc(standupEntries.day))
    .limit(14)
  return rows.map((r) => r.day)
}

export type SprintBlocker = { id: string; taskKey: string | null; title: string; assigneeName: string | null }

export async function getSprintBlockers(sprintId: string): Promise<SprintBlocker[]> {
  const rows = await db
    .select({
      id: liveTasks.id,
      title: liveTasks.title,
      number: liveTasks.number,
      appKey: liveApps.key,
      appNumber: liveApps.number,
      assigneeName: users.name,
    })
    .from(liveTasks)
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .leftJoin(users, eq(users.id, liveTasks.assigneeId))
    .where(and(eq(liveTasks.sprintId, sprintId), eq(liveTasks.status, 'blocked')))
    .orderBy(asc(liveTasks.number))
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    taskKey: keyOf(appKey(r.appKey, r.appNumber), r.number),
    assigneeName: r.assigneeName,
  }))
}

export type ReviewTask = {
  id: string
  taskKey: string | null
  title: string
  status: string
  type: string
  assigneeName: string | null
}

export type SprintReview = {
  goal: string | null
  completed: ReviewTask[]
  incomplete: ReviewTask[]
  released: ReviewTask[]
  bugs: ReviewTask[]
  qaCounts: { status: ReviewQaStatus; count: number }[]
}

export async function getSprintReview(sprintId: string): Promise<SprintReview> {
  const [[sprint], rows] = await Promise.all([
    db.select({ goal: liveSprints.goal }).from(liveSprints).where(eq(liveSprints.id, sprintId)),
    db
      .select({
        id: liveTasks.id,
        title: liveTasks.title,
        status: liveTasks.status,
        type: liveTasks.type,
        number: liveTasks.number,
        appKey: liveApps.key,
        appNumber: liveApps.number,
        assigneeName: users.name,
      })
      .from(liveTasks)
      .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
      .leftJoin(users, eq(users.id, liveTasks.assigneeId))
      .where(eq(liveTasks.sprintId, sprintId))
      .orderBy(asc(liveTasks.number)),
  ])
  const tasks: ReviewTask[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    type: r.type,
    taskKey: keyOf(appKey(r.appKey, r.appNumber), r.number),
    assigneeName: r.assigneeName,
  }))
  return { goal: sprint?.goal ?? null, ...splitReviewTasks(tasks) }
}

export type SprintFeedbackItem = {
  id: string
  body: string
  createdAt: Date
  authorId: string
  authorName: string
  task: { id: string; taskKey: string | null; title: string } | null
}

export async function getSprintFeedback(sprintId: string): Promise<SprintFeedbackItem[]> {
  const rows = await db
    .select({
      id: sprintFeedback.id,
      body: sprintFeedback.body,
      createdAt: sprintFeedback.createdAt,
      authorId: sprintFeedback.authorId,
      authorName: users.name,
      taskId: liveTasks.id,
      taskTitle: liveTasks.title,
      taskNumber: liveTasks.number,
      appKey: liveApps.key,
      appNumber: liveApps.number,
    })
    .from(sprintFeedback)
    .innerJoin(users, eq(users.id, sprintFeedback.authorId))
    .leftJoin(liveTasks, eq(liveTasks.id, sprintFeedback.taskId))
    .leftJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(sprintFeedback.sprintId, sprintId))
    .orderBy(asc(sprintFeedback.createdAt), asc(sprintFeedback.id))
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    authorId: r.authorId,
    authorName: r.authorName,
    task:
      r.taskId && r.taskTitle !== null
        ? { id: r.taskId, title: r.taskTitle, taskKey: keyOf(appKey(r.appKey, r.appNumber), r.taskNumber) }
        : null,
  }))
}

export type RetroItem = {
  id: string
  kind: RetroKind
  body: string
  authorId: string
  authorName: string
  ownerId: string | null
  ownerName: string | null
  taskId: string | null
  taskKey: string | null
  done: boolean
  createdAt: Date
}

export async function getRetroItems(sprintId: string): Promise<RetroItem[]> {
  const author = alias(users, 'retro_author')
  const owner = alias(users, 'retro_owner')
  const rows = await db
    .select({
      id: retroItems.id,
      kind: retroItems.kind,
      body: retroItems.body,
      authorId: retroItems.authorId,
      authorName: author.name,
      ownerId: retroItems.ownerId,
      ownerName: owner.name,
      taskId: liveTasks.id,
      taskNumber: liveTasks.number,
      appKey: liveApps.key,
      appNumber: liveApps.number,
      doneAt: retroItems.doneAt,
      createdAt: retroItems.createdAt,
    })
    .from(retroItems)
    .innerJoin(author, eq(author.id, retroItems.authorId))
    .leftJoin(owner, eq(owner.id, retroItems.ownerId))
    .leftJoin(liveTasks, eq(liveTasks.id, retroItems.taskId))
    .leftJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(retroItems.sprintId, sprintId))
    .orderBy(asc(retroItems.createdAt), asc(retroItems.id))
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body,
    authorId: r.authorId,
    authorName: r.authorName,
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    taskId: r.taskId,
    taskKey: keyOf(appKey(r.appKey, r.appNumber), r.taskNumber),
    done: r.doneAt !== null,
    createdAt: r.createdAt,
  }))
}

/**
 * What one Scrum view shows, fetched in one call so the page does not have to
 * know which reads each view needs. Only the chosen view's reads run.
 *
 * null when there is no sprint to show, or the sprint is not in this project
 * (a hand-edited ?sprint= from another project). Refinement needs no sprint:
 * it is the backlog, rendered by its own slot.
 */
export type ScrumViewData =
  | { view: 'standup'; entries: StandupEntry[]; days: string[]; blockers: SprintBlocker[] }
  | { view: 'review'; review: SprintReview; feedback: SprintFeedbackItem[] }
  | { view: 'retro'; items: RetroItem[] }
  | { view: 'refinement' }

export async function loadScrumView(
  appId: string,
  view: ScrumView,
  sprintId: string | null,
  day: string,
): Promise<ScrumViewData | null> {
  if (view === 'refinement') return { view: 'refinement' }
  if (!sprintId) return null
  const [inApp] = await db
    .select({ id: liveSprints.id })
    .from(liveSprints)
    .where(and(eq(liveSprints.id, sprintId), eq(liveSprints.appId, appId)))
  if (!inApp) return null

  switch (view) {
    case 'standup': {
      const [entries, days, blockers] = await Promise.all([
        getStandups(sprintId, day),
        getStandupDays(sprintId),
        getSprintBlockers(sprintId),
      ])
      return { view, entries, days, blockers }
    }
    case 'review': {
      const [review, feedback] = await Promise.all([getSprintReview(sprintId), getSprintFeedback(sprintId)])
      return { view, review, feedback }
    }
    case 'retro':
      return { view, items: await getRetroItems(sprintId) }
  }
}
