import { csvFilename, normalizeHeader, splitCsvRows, toCsv } from '@/features/admin/bulk-logic'
import type { DueKind } from '@/features/sprints/due-date'

/**
 * Bulk deadlines: writing the template, and reading back whatever Excel hands
 * us.
 *
 * PURE — no drizzle, no React, no `db`, no `new Date()`. Everything a person
 * can get wrong in a spreadsheet is decidable here, against a fixture, with no
 * database: a missing column, an unparseable date, a `due_kind` nobody
 * recognises, a commitment naming nobody. What is left for the server is the
 * one thing this file genuinely cannot know — whether a task title matches a
 * real task on this project, and whether the uploader is allowed to say so.
 *
 * THE SHAPE OF THE DEAL:
 *
 *  - It SETS DEADLINES ON EXISTING TASKS. It does not create tasks. Creating
 *    work from a spreadsheet is a different feature with different failure
 *    modes, and merging the two turns a typo in a title into a silently
 *    duplicated task instead of a row that says "no task by that name".
 *
 *  - A title matching zero or MORE THAN ONE live task is an invalid row with a
 *    reason, never a guess. Ambiguity resolved by guessing is how a client
 *    deadline lands on the wrong task and nobody finds out until it is late.
 *
 *  - The write rules — `original_due_date` written once, `due_changed_count`
 *    incremented only on a real move, a commitment needing a note — are NOT
 *    reimplemented here. `applyDueDate` in sprints/due-date.ts owns them and
 *    the import calls it. Two implementations of "what did we originally say"
 *    is how that column stops meaning anything.
 *
 * WHAT IS DELIBERATELY NOT A COLUMN:
 *
 *  - `app_id` / project. It comes from the page the import was started on, the
 *    same rule bug-csv.ts follows. A file that could name any project would let
 *    one project's upload write deadlines into another.
 *  - `assignee`. Moving work between people is not a deadline change, and a
 *    column that did both would make "I only meant to shift the dates" a thing
 *    somebody says afterwards.
 *  - `status`. A spreadsheet must not be able to close work.
 */

export type DeadlineCsvColumn = 'taskId' | 'taskTitle' | 'dueDate' | 'dueKind' | 'commitmentNote'

export type DeadlineCsvColumnSpec = {
  key: DeadlineCsvColumn
  header: string
  help: string
  aliases: readonly string[]
}

/**
 * The full column set, in template order.
 *
 * NEITHER `task_id` NOR `task_title` carries a `required` flag, because the
 * rule is "one of the two" and a per-column flag cannot express that. The check
 * lives in validateDeadlineCsvRow, where it can say which one is missing rather
 * than demanding both.
 */
export const DEADLINE_CSV_COLUMNS: readonly DeadlineCsvColumnSpec[] = [
  {
    key: 'taskTitle',
    header: 'task_title',
    help: 'The task to date, exactly as it reads on the board. Or use task_id.',
    aliases: ['task', 'title', 'name'],
  },
  {
    key: 'taskId',
    header: 'task_id',
    help: 'Optional. The task’s id — use it when two tasks share a title.',
    aliases: ['id', 'uuid'],
  },
  {
    key: 'dueDate',
    header: 'due_date',
    help: 'Required. YYYY-MM-DD. Empty clears the date.',
    aliases: ['due', 'deadline', 'date'],
  },
  {
    key: 'dueKind',
    header: 'due_kind',
    help: 'Optional. target (default) or committed — committed is a promise to somebody.',
    aliases: ['kind', 'type'],
  },
  {
    key: 'commitmentNote',
    header: 'commitment_note',
    help: 'Required when due_kind is committed. Who it was promised to.',
    aliases: ['note', 'promised_to', 'commitment'],
  },
]

export const DEADLINE_CSV_HEADERS: readonly string[] = DEADLINE_CSV_COLUMNS.map((c) => c.header)

/**
 * How many rows one import may carry.
 *
 * Lower than the bug importer's 500 on purpose. Every row here is an UPDATE to
 * an existing task plus an activity_log write, and the preview is a table
 * somebody is expected to actually read before confirming — a 500-row deadline
 * change is not something anyone checks, it is something they accept.
 */
export const DEADLINE_CSV_ROW_LIMIT = 200

/** Guards the server action's request body, same reasoning as bug-csv.ts. */
export const DEADLINE_CSV_MAX_CHARS = 200_000

/**
 * ONE example row, and it is dropped on the way back in.
 *
 * The bug importer shipped an example row with a comment arguing the preview
 * step stopped it being imported by accident. It did not: people fill their
 * rows in underneath and upload the file whole. This template ships with that
 * already fixed — see isDeadlineExampleRow.
 */
export const DEADLINE_CSV_EXAMPLE_ROW: readonly string[] = [
  'Rework the invoice export',
  '',
  '2026-09-15',
  'committed',
  'Promised to Acme for their quarter close',
]

export const DEADLINE_CSV_TEMPLATE_PREFIX = 'deadline-import-template'

export function deadlineCsvTemplate(): string {
  return toCsv(DEADLINE_CSV_HEADERS, [DEADLINE_CSV_EXAMPLE_ROW])
}

export function deadlineCsvTemplateFilename(at: Date): string {
  return csvFilename(DEADLINE_CSV_TEMPLATE_PREFIX, at)
}

/** The example row keyed by column, built by index so it cannot drift. */
const EXAMPLE_BY_COLUMN: ReadonlyMap<DeadlineCsvColumn, string> = new Map(
  DEADLINE_CSV_COLUMNS.map((column, index) => [
    column.key,
    (DEADLINE_CSV_EXAMPLE_ROW[index] ?? '').trim().toLowerCase(),
  ]),
)

/**
 * Is this the template's own example row, left where it was?
 *
 * Same rule as the bug importer's, and here from day one rather than after
 * somebody's example row became a real deadline on a real task: the TITLE must
 * be present and match, and every other populated cell must match too. A title
 * rewritten over is somebody filling the template in, and their row is kept.
 */
export function isDeadlineExampleRow(cells: Partial<Record<DeadlineCsvColumn, string>>): boolean {
  const title = (cells.taskTitle ?? '').trim().toLowerCase()
  if (title === '' || title !== EXAMPLE_BY_COLUMN.get('taskTitle')) return false
  for (const [key, example] of EXAMPLE_BY_COLUMN) {
    if (key === 'taskTitle') continue
    const value = (cells[key] ?? '').trim()
    if (value === '') continue
    if (value.toLowerCase() !== example) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type ValidDeadlineCsvRow = {
  rowNumber: number
  /** Set when the file named an id. The server prefers this over the title. */
  taskId: string | null
  /** Always carried, even alongside an id — the preview names the task. */
  taskTitle: string
  /** `YYYY-MM-DD`, or null to clear the date. */
  dueDate: string | null
  dueKind: DueKind
  commitmentNote: string | null
}

export type InvalidDeadlineCsvRow = {
  rowNumber: number
  /** Whatever was in the title cell, so the row can be found. May be ''. */
  taskTitle: string
  reasons: string[]
}

export type DeadlineCsvParse =
  | { ok: false; error: string }
  | {
      ok: true
      valid: ValidDeadlineCsvRow[]
      invalid: InvalidDeadlineCsvRow[]
      ignoredColumns: string[]
      /** Template example rows dropped. Reported, never silent. */
      ignoredExampleRows: number
    }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `YYYY-MM-DD`, and a day that really exists.
 *
 * Checked as a STRING and never parsed into a Date for comparison.
 * `new Date('2026-08-12')` is midnight UTC, which is still the 11th west of
 * Greenwich — the exact bug schema.ts documents against `tasks.due_date` and
 * refuses on purpose. The calendar check below constructs a UTC date only to
 * reject 31 February, and throws it away immediately.
 */
export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const probe = new Date(Date.UTC(year, month - 1, day))
  return (
    probe.getUTCFullYear() === year
    && probe.getUTCMonth() === month - 1
    && probe.getUTCDate() === day
  )
}

/**
 * One row, against everything checkable without a database.
 *
 * The commitment rule is asserted HERE as well as inside applyDueDate, on
 * purpose. applyDueDate THROWS, which in an import would abort the batch on
 * row 40 and leave 39 deadlines already written — so the same rule has to be a
 * per-row REASON first, and the throw stays the backstop it was written to be.
 */
export function validateDeadlineCsvRow(
  rowNumber: number,
  cells: Partial<Record<DeadlineCsvColumn, string>>,
): { ok: true; row: ValidDeadlineCsvRow } | { ok: false; row: InvalidDeadlineCsvRow } {
  const reasons: string[] = []
  const taskTitle = (cells.taskTitle ?? '').trim()
  const rawId = (cells.taskId ?? '').trim()

  let taskId: string | null = null
  if (rawId !== '') {
    if (UUID_RE.test(rawId)) taskId = rawId.toLowerCase()
    else reasons.push(`Task id "${rawId}" is not an id`)
  }
  if (taskId === null && taskTitle === '') {
    reasons.push('Needs a task_title or a task_id')
  }

  const rawDate = (cells.dueDate ?? '').trim()
  let dueDate: string | null = null
  if (rawDate !== '') {
    if (isCalendarDay(rawDate)) dueDate = rawDate
    else reasons.push(`Due date "${rawDate}" is not a day in YYYY-MM-DD form`)
  }

  const rawKind = (cells.dueKind ?? '').trim().toLowerCase()
  let dueKind: DueKind = 'target'
  if (rawKind !== '') {
    if (rawKind === 'target' || rawKind === 'committed') dueKind = rawKind
    else reasons.push(`Due kind "${(cells.dueKind ?? '').trim()}" is not target or committed`)
  }

  const commitmentNote = (cells.commitmentNote ?? '').trim() || null

  if (dueKind === 'committed') {
    // Both halves of the rule applyDueDate enforces, said as reasons so the
    // row is skipped rather than the batch aborted.
    if (rawDate === '') reasons.push('A commitment needs a date')
    if (commitmentNote === null) {
      reasons.push('A committed date needs a note naming who it was promised to')
    }
  }

  if (reasons.length > 0) return { ok: false, row: { rowNumber, taskTitle, reasons } }
  return { ok: true, row: { rowNumber, taskId, taskTitle, dueDate, dueKind, commitmentNote } }
}

function buildHeaderIndex(): ReadonlyMap<string, DeadlineCsvColumn> {
  const map = new Map<string, DeadlineCsvColumn>()
  for (const column of DEADLINE_CSV_COLUMNS) {
    map.set(normalizeHeader(column.header), column.key)
    for (const alias of column.aliases) map.set(normalizeHeader(alias), column.key)
  }
  return map
}

const HEADER_INDEX = buildHeaderIndex()

/** Text in, preview out. NOTHING here writes anything. */
export function parseDeadlineCsv(text: string): DeadlineCsvParse {
  const rows = splitCsvRows(text)
  const isBlank = (cells: readonly string[]) => cells.every((cell) => cell.trim() === '')

  const headerIndex = rows.findIndex((cells) => !isBlank(cells))
  if (headerIndex === -1) return { ok: false, error: 'That file is empty' }

  const headerCells = rows[headerIndex] ?? []
  const columnAt: (DeadlineCsvColumn | null)[] = []
  const seen = new Set<DeadlineCsvColumn>()
  const ignoredColumns: string[] = []

  for (const cell of headerCells) {
    const key = HEADER_INDEX.get(normalizeHeader(cell)) ?? null
    if (key && !seen.has(key)) {
      seen.add(key)
      columnAt.push(key)
    } else {
      columnAt.push(null)
      if (cell.trim() !== '') ignoredColumns.push(cell.trim())
    }
  }

  if (!seen.has('dueDate')) {
    return { ok: false, error: 'That file is missing a required column: due_date' }
  }
  // One of the two, which is why this is not a per-column `required` flag.
  if (!seen.has('taskTitle') && !seen.has('taskId')) {
    return { ok: false, error: 'That file needs a task_title or a task_id column' }
  }

  const bodyRows = rows
    .slice(headerIndex + 1)
    // Numbered from the top of the FILE, header and blank lines included, so
    // the number matches the gutter of the spreadsheet somebody is looking at.
    .map((cells, offset) => ({ rowNumber: headerIndex + offset + 2, cells }))
    .filter((entry) => !isBlank(entry.cells))

  const deadlineRows: {
    rowNumber: number
    byColumn: Partial<Record<DeadlineCsvColumn, string>>
  }[] = []
  let ignoredExampleRows = 0

  for (const { rowNumber, cells } of bodyRows) {
    const byColumn: Partial<Record<DeadlineCsvColumn, string>> = {}
    for (let position = 0; position < columnAt.length; position += 1) {
      const key = columnAt[position]
      // A short row is a normal row: somebody filled two columns and stopped.
      if (key) byColumn[key] = cells[position] ?? ''
    }
    if (isDeadlineExampleRow(byColumn)) {
      ignoredExampleRows += 1
      continue
    }
    deadlineRows.push({ rowNumber, byColumn })
  }

  if (deadlineRows.length === 0) {
    return {
      ok: false,
      error:
        ignoredExampleRows > 0
          ? 'That file is still the blank import template — add your deadlines under the header row'
          : 'That file has a header row but no deadlines under it',
    }
  }
  if (deadlineRows.length > DEADLINE_CSV_ROW_LIMIT) {
    return {
      ok: false,
      error: `That file has ${deadlineRows.length} rows — ${DEADLINE_CSV_ROW_LIMIT} is the most one import can take`,
    }
  }

  const valid: ValidDeadlineCsvRow[] = []
  const invalid: InvalidDeadlineCsvRow[] = []
  for (const { rowNumber, byColumn } of deadlineRows) {
    const result = validateDeadlineCsvRow(rowNumber, byColumn)
    if (result.ok) valid.push(result.row)
    else invalid.push(result.row)
  }

  return { ok: true, valid, invalid, ignoredColumns, ignoredExampleRows }
}

/** "12 deadlines set, 3 rows skipped" — one sentence, both numbers. */
export function describeDeadlineImport(updated: number, skipped: number): string {
  const deadlines = `${updated} ${updated === 1 ? 'deadline' : 'deadlines'} set`
  if (skipped === 0) return deadlines
  return `${deadlines}, ${skipped} ${skipped === 1 ? 'row' : 'rows'} skipped`
}
