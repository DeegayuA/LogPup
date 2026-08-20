import { z } from 'zod'
import { toCsv, csvFilename } from '@/features/admin/bulk-logic'
import {
  BUG_SEVERITIES,
  BUG_STATUSES,
  type BugSeverity,
  type BugStatus,
} from '@/features/bugs/bug-display'
import { bugPagePath, bugReportInput } from '@/features/bugs/report-input'

/**
 * The bulk-import format: writing the template, and reading back whatever
 * Excel hands us.
 *
 * PURE — zod and two pure modules, no drizzle, no React, no `db`. That is what
 * lets bug-csv.test.ts drive the whole format (every column, every sparse-row
 * shape, every invalid reason) without a database, and what lets the template
 * download happen in the browser with no round trip.
 *
 * THE SHAPE OF THE DEAL, decided with the user and encoded here:
 *
 *  - The template always carries the FULL column set. Real uploads do not:
 *    a PM deletes the columns they have nothing to say about, and Excel
 *    happily reorders what is left. So columns are matched by HEADER NAME,
 *    case- and whitespace-insensitive, never by position. A missing optional
 *    column is fine, an empty optional cell means "use the default", and an
 *    unknown extra column is IGNORED rather than fatal — a file with a `notes`
 *    column somebody's own process needs must still import.
 *
 *  - Only `title` and `description` are genuinely required, because they are
 *    the two NOT NULL columns on bug_reports with no default. Everything else
 *    has somewhere to fall back to.
 *
 *  - An unrecognised severity, status or assignee makes the ROW INVALID; it
 *    never silently becomes the default. The user chose flag-and-skip
 *    precisely so nothing changes meaning behind their back: a row that says
 *    `critical` and imports as `medium` is worse than a row that does not
 *    import at all, because nobody finds out.
 *
 * WHAT IS DELIBERATELY NOT A COLUMN:
 *
 *  - `app_id`. It comes from the page the import was started on. A file that
 *    could name any project id would let one project's import write bugs into
 *    another, and the uploader would have no reason to look.
 *  - `reported_by`. It is the uploading user. A CSV cannot be allowed to
 *    attribute a report to somebody else.
 *  - `resolved_at`. Derived from the status by triageBug and nowhere else —
 *    see actions.ts on why the two disagreeing is how a "resolved" list ends
 *    up full of rows that were never resolved.
 *  - `linked_task_id`. A raw uuid nobody has to hand, for a link that is made
 *    from the task side when the fix starts.
 */

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export type BugCsvColumn =
  | 'title'
  | 'description'
  | 'severity'
  | 'status'
  | 'assigneeEmail'
  | 'pagePath'

export type BugCsvColumnSpec = {
  key: BugCsvColumn
  /** The header as the template writes it. */
  header: string
  required: boolean
  /** One line for the dialog's column list. */
  help: string
  /** Extra spellings accepted on the way in, already normalised. */
  aliases: readonly string[]
}

/**
 * The full column set, in template order: the two required fields first, then
 * what triage would otherwise have to fill in by hand.
 *
 * Header names are snake_case because that is what survives a round trip
 * through Excel, Sheets and a text editor unchanged — and because
 * `normalizeHeader` below folds case, spaces, hyphens and dots into exactly
 * this shape, so `Assignee Email`, `assignee-email` and `ASSIGNEE_EMAIL` all
 * arrive at the same column without the aliases having to list them.
 */
export const BUG_CSV_COLUMNS: readonly BugCsvColumnSpec[] = [
  {
    key: 'title',
    header: 'title',
    required: true,
    help: 'Required. One scannable line — what is broken.',
    aliases: ['summary', 'bug_title'],
  },
  {
    key: 'description',
    header: 'description',
    required: true,
    help: 'Required. What happened, in the reporter’s words.',
    aliases: ['details', 'detail', 'what_happened'],
  },
  {
    key: 'severity',
    header: 'severity',
    required: false,
    help: `Optional. One of ${BUG_SEVERITIES.join(', ')}. Empty leaves it at medium.`,
    aliases: [],
  },
  {
    key: 'status',
    header: 'status',
    required: false,
    help: `Optional. One of ${BUG_STATUSES.join(', ')}. Empty leaves it at open.`,
    aliases: ['state'],
  },
  {
    key: 'assigneeEmail',
    header: 'assignee_email',
    required: false,
    help: 'Optional. The LogPup address of whoever has it. Empty leaves it unassigned.',
    aliases: ['assignee', 'assigned_to', 'owner_email'],
  },
  {
    key: 'pagePath',
    header: 'page_path',
    required: false,
    help: 'Optional. The in-app route it broke on, e.g. /apps/logpup?tab=bugs.',
    aliases: ['page', 'path', 'route'],
  },
]

export const BUG_CSV_HEADERS: readonly string[] = BUG_CSV_COLUMNS.map((column) => column.header)

const REQUIRED_COLUMNS: readonly BugCsvColumnSpec[] = BUG_CSV_COLUMNS.filter((c) => c.required)

/**
 * How many rows one import may carry.
 *
 * A ceiling rather than no ceiling because everything downstream is bounded:
 * the preview is a table a person reads, the insert is one statement, and the
 * app's own bug list stops at 200 rows anyway (APP_BUG_LIMIT in queries.ts).
 * A 20,000-row paste should be told it is too big, not accepted and then time
 * out halfway through writing.
 */
export const BUG_CSV_ROW_LIMIT = 500

/**
 * How large the file itself may be, in characters.
 *
 * A separate limit from the row count because it guards a different thing: a
 * server action's request body, which Next caps at 1MB by default. Past that
 * the platform rejects the call before any code here runs, and the user is
 * told nothing useful. Checking the length in the browser first turns a
 * mystery failure into a sentence. 500 rows of ordinary bug reports is a
 * fraction of this; only pasted logfiles reach it.
 */
export const BUG_CSV_MAX_CHARS = 600_000

// ---------------------------------------------------------------------------
// The template
// ---------------------------------------------------------------------------

/**
 * ONE example row, not zero and not five.
 *
 * Zero leaves a PM guessing what `severity` wants — they write `P1`, the
 * import flags every row, and the format has taught them nothing. Five means
 * five bugs to delete. One shows the shape of every column at once, and the
 * preview step means it cannot be imported by accident: it is right there in
 * the table with its title, waiting to be looked at.
 */
export const BUG_CSV_EXAMPLE_ROW: readonly string[] = [
  'Sprint switcher forgets the backlog',
  'Picked Backlog, then chose a sprint from the dropdown — it jumped back to Overview. Happens every time, Chrome and Safari.',
  'high',
  'open',
  '',
  '/apps/logpup?tab=board',
]

/** Names the downloaded file. Shared so the dialog cannot drift from the test. */
export const BUG_CSV_TEMPLATE_PREFIX = 'bug-import-template'

/**
 * The template file's contents.
 *
 * Built with the same `toCsv` the admin exports use, so the quoting rules —
 * RFC 4180 doubling, CRLF endings, and the `=`/`+`/`-`/`@` formula guard that
 * keeps a spreadsheet from executing a cell — have one implementation in the
 * repo rather than two that disagree.
 *
 * The dialog does not call this directly: it hands the same headers and the
 * same example row to `downloadCsv`, which composes exactly this string and
 * wraps it in the BOM and Blob a browser will actually save. Same inputs, same
 * `toCsv` — so the round-trip test below is a test of the bytes users get.
 */
export function bugCsvTemplate(): string {
  return toCsv(BUG_CSV_HEADERS, [BUG_CSV_EXAMPLE_ROW])
}

/** `bug-import-template-2026-08-20.csv`. */
export function bugCsvTemplateFilename(at: Date): string {
  return csvFilename(BUG_CSV_TEMPLATE_PREFIX, at)
}

// ---------------------------------------------------------------------------
// Reading a file
// ---------------------------------------------------------------------------

/**
 * RFC 4180, as actually emitted rather than as specified.
 *
 * Written by hand rather than pulled in, because the awkward cases are few and
 * every one of them is a case Excel produces on an ordinary Tuesday: a
 * description with a comma in it, a description with a NEWLINE in it (Alt+Enter
 * inside a cell), `""` for a literal quote, CRLF endings, and a UTF-8 BOM on
 * every "CSV UTF-8" save. A parser that splits on `,` and `\n` breaks on the
 * first real bug report somebody writes.
 *
 * Returns raw cells; blank lines are dropped by the caller, not here, so the
 * row numbering stays honest.
 */
export function splitCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // The BOM. Left in place it becomes part of the first header name, so
  // `title` stops matching, and every row in the file is reported as missing
  // a title — the single most confusing way this feature could fail.
  let index = text.charCodeAt(0) === 0xfeff ? 1 : 0

  for (; index < text.length; index += 1) {
    const char = text[index]

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field === '') {
      // A quote only opens a quoted field at the START of one. Mid-field it is
      // data — `5" screen` is a size, not a delimiter.
      inQuotes = true
      continue
    }

    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }

    if (char === '\r' || char === '\n') {
      // CRLF, LF and lone CR all end a row. The lone CR matters: it is what a
      // spreadsheet exported on an old Mac still produces.
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      continue
    }

    field += char
  }

  // Only reached when the file does not end in a newline — most do.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/**
 * `  Assignee Email ` and `assignee-email` are the same column.
 *
 * Also strips a BOM that survived onto a header (a file concatenated from two
 * exports can carry one mid-stream) and drops surrounding quotes a
 * hand-written header sometimes keeps.
 */
export function normalizeHeader(raw: string): string {
  return raw
    .replace(/﻿/g, '')
    .trim()
    // `[\s\S]` rather than `.` with the `s` flag: tsconfig targets ES2017,
    // where dotAll does not exist, and tsc rejects the flag outright.
    .replace(/^"([\s\S]*)"$/, '$1')
    .toLowerCase()
    .replace(/[\s.\-]+/g, '_')
}

/** Same folding for enum VALUES, so `In Progress` reaches `in_progress`. */
function normalizeValue(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s.\-]+/g, '_')
}

/** header (already normalised) -> column key. First spelling wins. */
function buildHeaderIndex(): ReadonlyMap<string, BugCsvColumn> {
  const map = new Map<string, BugCsvColumn>()
  for (const column of BUG_CSV_COLUMNS) {
    map.set(normalizeHeader(column.header), column.key)
    for (const alias of column.aliases) map.set(normalizeHeader(alias), column.key)
  }
  return map
}

const HEADER_INDEX = buildHeaderIndex()

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * A row that will be created if the user confirms.
 *
 * `severity` and `status` are null when the cell was empty, meaning "let the
 * column default stand" rather than "medium"/"open" written out — so a bug
 * imported without a severity is indistinguishable from one filed through the
 * dialog, which also sends none (see report-input.ts on why the reporter does
 * not rate their own blockage).
 */
export type ValidBugCsvRow = {
  /** Line number in the file as the user's spreadsheet shows it: header is 1. */
  rowNumber: number
  title: string
  description: string
  severity: BugSeverity | null
  status: BugStatus | null
  pagePath: string | null
  /** Still an email here. queries resolve it to a user id server-side. */
  assigneeEmail: string | null
}

/** A row that will be skipped, and every reason it is being skipped. */
export type InvalidBugCsvRow = {
  rowNumber: number
  /** Whatever was in the title cell, so the user can find the row. May be ''. */
  title: string
  reasons: string[]
}

export type BugCsvParse =
  /** The file itself is unusable — nothing can be previewed. */
  | { ok: false; error: string }
  | {
      ok: true
      valid: ValidBugCsvRow[]
      invalid: InvalidBugCsvRow[]
      /** Extra headers that were ignored. Reported, never fatal. */
      ignoredColumns: string[]
    }

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------

/**
 * Title and description are checked with `bugReportInput`'s OWN field
 * definitions, picked off the schema rather than re-stated.
 *
 * One definition of a valid bug: if somebody widens the title to 200
 * characters, the dialog and the importer change together, and the message
 * below changes with them because the number is read out of the failing issue
 * instead of being typed here a second time.
 */
const bugCsvFields = bugReportInput.pick({ title: true, description: true })

/** Zod's issue, said the way a PM staring at row 34 needs to hear it. */
function fieldReason(label: string, issue: z.core.$ZodIssue): string {
  if (issue.code === 'too_small' && typeof issue.minimum === 'number') {
    return `${label} must be at least ${issue.minimum} characters`
  }
  if (issue.code === 'too_big' && typeof issue.maximum === 'number') {
    return `${label} must be ${issue.maximum} characters or fewer`
  }
  return `${label}: ${issue.message}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * One row, against everything checkable WITHOUT a database.
 *
 * The assignee is validated as far as it can be here — a value that is not an
 * email address at all is this module's to reject — and left as an email for
 * the server to resolve against real users. That split is why the reason list
 * a user can see has exactly one entry this file never produces.
 */
export function validateBugCsvRow(
  rowNumber: number,
  cells: Partial<Record<BugCsvColumn, string>>,
): { ok: true; row: ValidBugCsvRow } | { ok: false; row: InvalidBugCsvRow } {
  const reasons: string[] = []
  const title = (cells.title ?? '').trim()
  const description = (cells.description ?? '').trim()

  // "Missing" is said separately from "too short", because they are different
  // mistakes: an empty cell is a row somebody did not finish, a three-character
  // title is a row somebody did not think was worth finishing. Telling the
  // first "must be at least 4 characters" reads as pedantry.
  if (title === '') reasons.push('Title is missing')
  if (description === '') reasons.push('Description is missing')

  if (title !== '' || description !== '') {
    const parsed = bugCsvFields.safeParse({ title, description })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === 'title' && title === '') continue
        if (field === 'description' && description === '') continue
        if (field === 'title') reasons.push(fieldReason('Title', issue))
        if (field === 'description') reasons.push(fieldReason('Description', issue))
      }
    }
  }

  let severity: BugSeverity | null = null
  const rawSeverity = normalizeValue(cells.severity ?? '')
  if (rawSeverity !== '') {
    const match = BUG_SEVERITIES.find((value) => value === rawSeverity)
    if (match) severity = match
    else {
      reasons.push(
        `Severity "${(cells.severity ?? '').trim()}" is not one of: ${BUG_SEVERITIES.join(', ')}`,
      )
    }
  }

  let status: BugStatus | null = null
  const rawStatus = normalizeValue(cells.status ?? '')
  if (rawStatus !== '') {
    const match = BUG_STATUSES.find((value) => value === rawStatus)
    if (match) status = match
    else {
      reasons.push(
        `Status "${(cells.status ?? '').trim()}" is not one of: ${BUG_STATUSES.join(', ')}`,
      )
    }
  }

  let pagePath: string | null = null
  const rawPath = (cells.pagePath ?? '').trim()
  if (rawPath !== '') {
    // The same rule the dialog is held to, from the same schema: an in-app
    // path only. `//evil.example` is a protocol-relative URL every browser
    // treats as another origin, and this string is rendered as a link in the
    // triage queue — so a CSV must not be the way one gets in.
    const parsed = bugPagePath.safeParse(rawPath)
    if (parsed.success) pagePath = parsed.data
    else reasons.push(parsed.error.issues[0]?.message ?? 'Page must be a path inside LogPup')
  }

  let assigneeEmail: string | null = null
  const rawEmail = (cells.assigneeEmail ?? '').trim()
  if (rawEmail !== '') {
    if (EMAIL_RE.test(rawEmail)) assigneeEmail = rawEmail.toLowerCase()
    else reasons.push(`Assignee "${rawEmail}" is not an email address`)
  }

  if (reasons.length > 0) return { ok: false, row: { rowNumber, title, reasons } }
  return {
    ok: true,
    row: { rowNumber, title, description, severity, status, pagePath, assigneeEmail },
  }
}

// ---------------------------------------------------------------------------
// The whole file
// ---------------------------------------------------------------------------

/**
 * Text in, preview out. NOTHING here writes anything — the caller decides
 * whether the valid half is worth importing, which is the entire point of
 * showing it first.
 */
export function parseBugCsv(text: string): BugCsvParse {
  const rows = splitCsvRows(text)
  const isBlank = (cells: readonly string[]) => cells.every((cell) => cell.trim() === '')

  const headerIndex = rows.findIndex((cells) => !isBlank(cells))
  if (headerIndex === -1) return { ok: false, error: 'That file is empty' }

  const headerCells = rows[headerIndex] ?? []
  const columnAt: (BugCsvColumn | null)[] = []
  const seen = new Set<BugCsvColumn>()
  const ignoredColumns: string[] = []

  for (const cell of headerCells) {
    const key = HEADER_INDEX.get(normalizeHeader(cell)) ?? null
    // A column named twice keeps its first appearance. The alternative — last
    // wins — means a stray empty duplicate at the end of the sheet silently
    // blanks a column that was filled in properly.
    if (key && !seen.has(key)) {
      seen.add(key)
      columnAt.push(key)
    } else {
      columnAt.push(null)
      if (cell.trim() !== '') ignoredColumns.push(cell.trim())
    }
  }

  const missing = REQUIRED_COLUMNS.filter((column) => !seen.has(column.key))
  if (missing.length > 0) {
    return {
      ok: false,
      error: `That file is missing a required column: ${missing.map((c) => c.header).join(', ')}`,
    }
  }

  const bodyRows = rows
    .slice(headerIndex + 1)
    // The row number a person can act on is the one their spreadsheet shows in
    // the gutter, so it is counted from the top of the FILE — including the
    // header and any blank lines — not from the first bug.
    .map((cells, offset) => ({ rowNumber: headerIndex + offset + 2, cells }))
    .filter((entry) => !isBlank(entry.cells))

  if (bodyRows.length === 0) {
    return { ok: false, error: 'That file has a header row but no bugs under it' }
  }
  if (bodyRows.length > BUG_CSV_ROW_LIMIT) {
    return {
      ok: false,
      error: `That file has ${bodyRows.length} rows — ${BUG_CSV_ROW_LIMIT} is the most one import can take`,
    }
  }

  const valid: ValidBugCsvRow[] = []
  const invalid: InvalidBugCsvRow[] = []

  for (const { rowNumber, cells } of bodyRows) {
    const byColumn: Partial<Record<BugCsvColumn, string>> = {}
    for (let position = 0; position < columnAt.length; position += 1) {
      const key = columnAt[position]
      // A short row is a normal row: a PM who filled in two columns and left
      // the rest stops typing, and the file simply ends the line early.
      if (key) byColumn[key] = cells[position] ?? ''
    }
    const result = validateBugCsvRow(rowNumber, byColumn)
    if (result.ok) valid.push(result.row)
    else invalid.push(result.row)
  }

  return { ok: true, valid, invalid, ignoredColumns }
}

/**
 * "12 bugs created, 3 rows skipped" — one sentence, both numbers, no
 * arithmetic left for the reader to do. Pure so the wording is testable, and
 * shared so the toast and the dialog cannot describe the same import
 * differently.
 */
export function describeBugImport(created: number, skipped: number): string {
  const bugs = `${created} ${created === 1 ? 'bug' : 'bugs'}`
  if (skipped === 0) return `${bugs} created`
  return `${bugs} created, ${skipped} ${skipped === 1 ? 'row' : 'rows'} skipped`
}
