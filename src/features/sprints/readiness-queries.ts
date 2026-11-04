import 'server-only'
import { and, asc, count, eq, inArray, isNull, ne, notInArray, or } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveAttachments, liveSprints, liveTasks } from '@/db/live'
import { acceptanceCriteria, workLinks } from '@/db/schema'
import type { TaskType } from '@/features/sprints/hierarchy'
import { formatTaskKey } from '@/features/sprints/task-key'
import { definitionOfReady, type DorCheck, type ReadinessFacts, type RiskLevel } from '@/features/sprints/readiness'

/**
 * The Definition of Ready's inputs for a set of tasks, in five grouped reads
 * (criteria, attachments, links each way, the rows) rather than per task.
 * Attachments go through `liveAttachments`: a trashed file is not a design.
 */
export async function getReadinessFacts(taskIds: readonly string[]): Promise<Map<string, ReadinessFacts>> {
  const ids = [...taskIds]
  const facts = new Map<string, ReadinessFacts>()
  if (ids.length === 0) return facts

  const [rows, criteria, files, linksFrom, linksTo] = await Promise.all([
    db
      .select({
        id: liveTasks.id,
        description: liveTasks.description,
        storyPoints: liveTasks.storyPoints,
        productApprovedAt: liveTasks.productApprovedAt,
      })
      .from(liveTasks)
      .where(inArray(liveTasks.id, ids)),
    db
      .select({ id: acceptanceCriteria.taskId, n: count() })
      .from(acceptanceCriteria)
      .where(inArray(acceptanceCriteria.taskId, ids))
      .groupBy(acceptanceCriteria.taskId),
    db
      .select({ id: liveAttachments.ownerId, n: count() })
      .from(liveAttachments)
      .where(and(eq(liveAttachments.ownerType, 'task'), inArray(liveAttachments.ownerId, ids)))
      .groupBy(liveAttachments.ownerId),
    db
      .select({ id: workLinks.fromId, n: count() })
      .from(workLinks)
      .where(and(eq(workLinks.fromType, 'task'), inArray(workLinks.fromId, ids)))
      .groupBy(workLinks.fromId),
    db
      .select({ id: workLinks.toId, n: count() })
      .from(workLinks)
      .where(and(eq(workLinks.toType, 'task'), inArray(workLinks.toId, ids)))
      .groupBy(workLinks.toId),
  ])

  const tally = (list: { id: string; n: number }[]) => new Map(list.map((r) => [r.id, Number(r.n)]))
  const c = tally(criteria)
  const a = tally(files)
  const lf = tally(linksFrom)
  const lt = tally(linksTo)
  for (const r of rows) {
    facts.set(r.id, {
      description: r.description,
      criteriaCount: c.get(r.id) ?? 0,
      storyPoints: r.storyPoints === null ? null : Number(r.storyPoints),
      attachmentCount: a.get(r.id) ?? 0,
      linkCount: (lf.get(r.id) ?? 0) + (lt.get(r.id) ?? 0),
      productApproved: r.productApprovedAt !== null,
    })
  }
  return facts
}

export type RefinementRow = {
  id: string
  taskKey: string | null
  title: string
  type: TaskType
  storyPoints: number | null
  risk: RiskLevel | null
  readyAt: Date | null
  sprintName: string | null
  sprintId: string | null
  checks: DorCheck[]
}

/** Types refined as a unit. Epics are refined through their stories; a sub-task through its task. */
const NOT_REFINED: TaskType[] = ['epic', 'subtask']

/** The cap on the refinement list — a backlog longer than this is triaged on the Backlog tab. */
export const REFINEMENT_LIMIT = 100

/**
 * The refinement queue: open items not yet in a running or finished sprint
 * (the backlog, plus sprints still being planned), not-ready first, then by
 * the board's own order.
 */
export async function getRefinementQueue(appId: string): Promise<RefinementRow[]> {
  const rows = await db
    .select({
      id: liveTasks.id,
      title: liveTasks.title,
      type: liveTasks.type,
      storyPoints: liveTasks.storyPoints,
      risk: liveTasks.risk,
      readyAt: liveTasks.readyAt,
      number: liveTasks.number,
      sprintId: liveSprints.id,
      sprintName: liveSprints.name,
      appKey: liveApps.key,
      appNumber: liveApps.number,
    })
    .from(liveTasks)
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .leftJoin(liveSprints, eq(liveSprints.id, liveTasks.sprintId))
    .where(
      and(
        eq(liveTasks.appId, appId),
        ne(liveTasks.status, 'done'),
        notInArray(liveTasks.type, NOT_REFINED),
        or(isNull(liveSprints.id), eq(liveSprints.status, 'planned')),
      ),
    )
    .orderBy(asc(liveTasks.sortOrder))
    .limit(REFINEMENT_LIMIT)

  const facts = await getReadinessFacts(rows.map((r) => r.id))
  const list = rows.map((r) => {
    const f = facts.get(r.id)
    return {
      id: r.id,
      taskKey: r.number === null ? null : formatTaskKey({ key: r.appKey, number: r.appNumber }, r.number),
      title: r.title,
      type: r.type as TaskType,
      storyPoints: r.storyPoints === null ? null : Number(r.storyPoints),
      risk: r.risk,
      readyAt: r.readyAt,
      sprintId: r.sprintId,
      sprintName: r.sprintName,
      checks: f ? definitionOfReady(f) : [],
    }
  })
  // Not-ready first; the board's own order within each group (sort is stable).
  return list.sort((x, y) => Number(x.readyAt !== null) - Number(y.readyAt !== null))
}
