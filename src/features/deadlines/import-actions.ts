'use server'

import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { liveApps, liveTasks } from '@/db/live'
import { tasks } from '@/db/schema'
import { requireCapability } from '@/features/auth/actor'
import { logActivity } from '@/features/activity/log'
import { applyDueDate, DueDateError, type DueState } from '@/features/sprints/due-date'
import {
  DEADLINE_CSV_MAX_CHARS,
  describeDeadlineImport,
  parseDeadlineCsv,
  type InvalidDeadlineCsvRow,
  type ValidDeadlineCsvRow,
} from '@/features/deadlines/deadline-csv'
import { ok, err, type ActionResult } from '@/lib/action-result'

/**
 * Bulk deadlines: look, then leap.
 *
 * TWO ACTIONS, NOT ONE, and the shape is lifted deliberately from
 * bugs/import-actions.ts rather than reinvented. `previewDeadlineCsvImport`
 * writes nothing: it parses the file, resolves every task reference against
 * real rows on THIS project, and hands back exactly what would happen.
 * `importDeadlineCsvRows` then does it.
 *
 * BOTH RE-PARSE THE SAME TEXT. The confirm step does not accept rows the
 * browser prepared — a client that can post rows is a client that can post
 * rows the preview never showed, against tasks nobody looked at. Sending the
 * file twice buys the guarantee that what is written is what was previewed,
 * re-validated from scratch, by the server, through the same pure module.
 *
 * WHAT THE FILE IS NOT ALLOWED TO SAY, enforced here rather than trusted:
 *
 *  - The PROJECT. `appId` is an argument, from the page the import started on.
 *    Every task lookup below is scoped to it, so a file naming a task id from
 *    another project resolves to nothing and is skipped with a reason — not
 *    silently written into a project the uploader never opened.
 *  - WHICH TASK, when it is ambiguous. A title matching two live tasks is an
 *    invalid row, never a guess. A client deadline landing on the wrong task
 *    is the failure nobody notices until it is late.
 *
 * WHAT IT DOES NOT DO: create tasks. A typo in a title comes back as "no task
 * by that name", which is recoverable, rather than as a new duplicate task,
 * which somebody has to find first.
 */

const deadlineCsvInput = z.object({
  appId: z.uuid(),
  csv: z.string().min(1).max(DEADLINE_CSV_MAX_CHARS),
})

/** One row as the preview table shows it — the change, already resolved. */
export type DeadlineImportPreviewRow = ValidDeadlineCsvRow & {
  taskId: string
  /** The task's real title, which may differ in case from what was typed. */
  resolvedTitle: string
  /** What the task's date is now, so the preview can show the move. */
  currentDueDate: string | null
  /** True when this row would change nothing. */
  unchanged: boolean
}

export type DeadlineImportPreview = {
  valid: DeadlineImportPreviewRow[]
  invalid: InvalidDeadlineCsvRow[]
  ignoredColumns: string[]
  ignoredExampleRows: number
}

export type DeadlineImportResult = {
  updated: number
  skipped: number
  /** One sentence naming both numbers, for the toast. */
  summary: string
}

/**
 * Who may point a spreadsheet at a project's deadlines.
 *
 * `task.edit` scoped to the project is the floor — the same capability a
 * single deadline change already needs. On top of that this is restricted to
 * the project's CURRENT PM or lead, or an admin seat, because a bulk deadline
 * change is a different act from editing one task: it rewrites the plan.
 * `member` carries `task.edit` for their OWN work only, and a file that can
 * redate two hundred tasks is not that.
 */
async function requireDeadlineImporter(appId: string) {
  const actor = await requireCapability('task.edit', { appId })
  if (!actor) return null

  // liveApps carries pmId/leadId itself — joining the raw table to reach them
  // would read a soft-deleted project's roles, which is the whole thing the
  // live_* subqueries exist to prevent.
  const [row] = await db
    .select({ pmId: liveApps.pmId, leadId: liveApps.leadId })
    .from(liveApps)
    .where(eq(liveApps.id, appId))
    .limit(1)
  if (!row) return null

  const isAdminSeat = actor.role === 'superadmin' || actor.role === 'admin'
  if (isAdminSeat || row.pmId === actor.id || row.leadId === actor.id) return actor
  return null
}

/** Every live task on this project, for resolving what the file names. */
async function loadTasks(appId: string) {
  return db
    .select({
      id: liveTasks.id,
      title: liveTasks.title,
      dueDate: liveTasks.dueDate,
      dueKind: liveTasks.dueKind,
      originalDueDate: liveTasks.originalDueDate,
      dueChangedCount: liveTasks.dueChangedCount,
    })
    .from(liveTasks)
    .where(eq(liveTasks.appId, appId))
}

type TaskRow = Awaited<ReturnType<typeof loadTasks>>[number]

/**
 * Which task a row names, or why it names none.
 *
 * An id wins over a title when both are given: somebody who pasted an id was
 * being specific, and the title beside it is the likelier stale copy.
 *
 * Titles match case- and whitespace-insensitively, because a title
 * round-tripped through Excel comes back with different capitals and a
 * trailing space more often than not. Matching EXACTLY would reject the
 * ordinary case; matching FUZZILY would silently pick a neighbour.
 */
function resolveTask(
  row: ValidDeadlineCsvRow,
  byId: Map<string, TaskRow>,
  byTitle: Map<string, TaskRow[]>,
): { ok: true; task: TaskRow } | { ok: false; reason: string } {
  if (row.taskId !== null) {
    const task = byId.get(row.taskId)
    if (task) return { ok: true, task }
    return { ok: false, reason: `No task on this project with id ${row.taskId}` }
  }
  const matches = byTitle.get(row.taskTitle.trim().toLowerCase()) ?? []
  if (matches.length === 1) return { ok: true, task: matches[0] }
  if (matches.length === 0) {
    return { ok: false, reason: `No task on this project called "${row.taskTitle}"` }
  }
  return {
    ok: false,
    reason: `${matches.length} tasks on this project are called "${row.taskTitle}" — use task_id to say which`,
  }
}

/**
 * The shared half of both actions: parse, resolve, and say what would happen.
 *
 * Extracted rather than duplicated precisely because the confirm step must
 * reach the same verdict as the preview from the same input. Two copies of
 * this reasoning is how "12 ready to import" becomes 11 writes.
 */
function planImport(
  parsed: Extract<ReturnType<typeof parseDeadlineCsv>, { ok: true }>,
  taskRows: TaskRow[],
): DeadlineImportPreview {
  const byId = new Map(taskRows.map((task) => [task.id, task]))
  const byTitle = new Map<string, TaskRow[]>()
  for (const task of taskRows) {
    const key = task.title.trim().toLowerCase()
    const bucket = byTitle.get(key)
    if (bucket) bucket.push(task)
    else byTitle.set(key, [task])
  }

  const valid: DeadlineImportPreviewRow[] = []
  const invalid: InvalidDeadlineCsvRow[] = [...parsed.invalid]

  for (const row of parsed.valid) {
    const resolved = resolveTask(row, byId, byTitle)
    if (!resolved.ok) {
      invalid.push({
        rowNumber: row.rowNumber,
        taskTitle: row.taskTitle,
        reasons: [resolved.reason],
      })
      continue
    }
    const task = resolved.task
    valid.push({
      ...row,
      taskId: task.id,
      resolvedTitle: task.title,
      currentDueDate: task.dueDate,
      // Shown rather than skipped. A file re-stating dates already set is a
      // normal file — somebody exported, edited three rows, and uploaded the
      // lot — and telling them 197 rows change nothing is more useful than
      // quietly writing 200 identical values.
      unchanged:
        task.dueDate === row.dueDate
        && task.dueKind === row.dueKind
        && (row.dueKind !== 'committed' || row.commitmentNote === null),
    })
  }

  // Back into file order: the two lists were built by walking the file, but
  // the task-resolution failures above moved rows between them, and a preview
  // whose row numbers jump around cannot be checked against a spreadsheet.
  invalid.sort((a, b) => a.rowNumber - b.rowNumber)
  return {
    valid,
    invalid,
    ignoredColumns: parsed.ignoredColumns,
    ignoredExampleRows: parsed.ignoredExampleRows,
  }
}

/** What WOULD happen. Reads only — nothing here writes anything. */
export async function previewDeadlineCsvImport(
  appId: string,
  csv: string,
): Promise<ActionResult<DeadlineImportPreview>> {
  const input = deadlineCsvInput.safeParse({ appId, csv })
  if (!input.success) return err('That file could not be read')

  const actor = await requireDeadlineImporter(input.data.appId)
  if (!actor) return err('Only this project’s PM or tech lead can import deadlines')

  const parsed = parseDeadlineCsv(input.data.csv)
  if (!parsed.ok) return err(parsed.error)

  return ok(planImport(parsed, await loadTasks(input.data.appId)))
}

/**
 * Do it.
 *
 * ONE UPDATE PER ROW rather than one batched statement, because each row's
 * patch depends on that row's CURRENT state — `original_due_date` is written
 * once, and `due_changed_count` increments only on a real move, both decided
 * per task by `applyDueDate`. A single bulk UPDATE cannot express that, and
 * reimplementing it here would give this repo a second, divergent answer to
 * "what did we originally say".
 *
 * A row whose write throws is COUNTED AS SKIPPED and the rest continue.
 * applyDueDate throws by design (its callers are actions that funnel throws
 * into `err()`), but aborting here would leave a partial import with no record
 * of where it stopped — the one outcome a bulk write must not produce.
 */
export async function importDeadlineCsvRows(
  appId: string,
  csv: string,
): Promise<ActionResult<DeadlineImportResult>> {
  const input = deadlineCsvInput.safeParse({ appId, csv })
  if (!input.success) return err('That file could not be read')

  const actor = await requireDeadlineImporter(input.data.appId)
  if (!actor) return err('Only this project’s PM or tech lead can import deadlines')

  const parsed = parseDeadlineCsv(input.data.csv)
  if (!parsed.ok) return err(parsed.error)

  const taskRows = await loadTasks(input.data.appId)
  const plan = planImport(parsed, taskRows)
  const byId = new Map(taskRows.map((task) => [task.id, task]))

  const [app] = await db
    .select({ slug: liveApps.slug, name: liveApps.name })
    .from(liveApps)
    .where(eq(liveApps.id, input.data.appId))
    .limit(1)

  let updated = 0
  let failed = 0

  for (const row of plan.valid) {
    const current = byId.get(row.taskId)
    if (!current) {
      failed += 1
      continue
    }
    const state: DueState = {
      dueDate: current.dueDate,
      dueKind: current.dueKind,
      originalDueDate: current.originalDueDate,
      dueChangedCount: current.dueChangedCount,
    }
    let patch
    try {
      patch = applyDueDate(state, {
        dueDate: row.dueDate,
        dueKind: row.dueKind,
        note: row.commitmentNote,
      })
    } catch (error) {
      // Already checked per row by validateDeadlineCsvRow, so reaching here
      // means the two disagree. Skip the row rather than the batch.
      if (error instanceof DueDateError) {
        failed += 1
        continue
      }
      throw error
    }

    try {
      await db
        .update(tasks)
        .set({
          dueDate: patch.dueDate,
          dueKind: patch.dueKind,
          dueCommitmentNote: patch.dueCommitmentNote,
          originalDueDate: patch.originalDueDate,
          dueChangedCount: patch.dueChangedCount,
        })
        // Scoped to the project at the WRITE as well as at the read: a task id
        // from another project must not be redated even if it slipped through.
        .where(and(eq(tasks.id, row.taskId), eq(tasks.appId, input.data.appId)))
      updated += 1
    } catch {
      failed += 1
      continue
    }

    // Written per task, not once per import. activity_log is the only clock
    // this repo has for when a task's plan changed — a bulk change recorded as
    // one entry would be invisible on every task it moved, which is exactly
    // where somebody goes looking.
    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'task',
      entityId: row.taskId,
      entityLabel: row.resolvedTitle,
      appId: input.data.appId,
      pagePath: app?.slug ? `/apps/${app.slug}` : null,
      detail:
        patch.dueDate === null
          ? 'deadline cleared, by import'
          : `${patch.dueKind === 'committed' ? 'committed to' : 'due'} ${patch.dueDate}, by import`,
      metadata: {
        from: current.dueDate,
        to: patch.dueDate,
        dueKind: patch.dueKind,
        source: 'csv-import',
      },
    })
  }

  if (app?.slug) revalidatePath(`/apps/${app.slug}`)

  const skipped = plan.invalid.length + failed
  return ok({ updated, skipped, summary: describeDeadlineImport(updated, skipped) })
}
