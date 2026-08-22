import { describe, expect, it } from 'vitest'

import {
  DEADLINE_CSV_EXAMPLE_ROW,
  DEADLINE_CSV_HEADERS,
  DEADLINE_CSV_ROW_LIMIT,
  deadlineCsvTemplate,
  deadlineCsvTemplateFilename,
  describeDeadlineImport,
  isCalendarDay,
  isDeadlineExampleRow,
  parseDeadlineCsv,
  validateDeadlineCsvRow,
} from './deadline-csv'

/**
 * The format, driven end to end without a database — the same discipline
 * bug-csv.test.ts keeps, against the same things Excel does without being
 * asked: a BOM on every "CSV UTF-8" save, CRLF endings, a comma inside a note,
 * and a sheet where somebody deleted the columns they had nothing to say about.
 */

const HEADER = DEADLINE_CSV_HEADERS.join(',')

function file(...rows: string[]): string {
  return [HEADER, ...rows].join('\r\n')
}

function parseOk(text: string) {
  const result = parseDeadlineCsv(text)
  if (!result.ok) throw new Error(`expected a usable file, got: ${result.error}`)
  return result
}

/** The reasons for the one body row in a single-row file. */
function reasonsFor(row: string): string[] {
  return parseOk(file(row)).invalid[0]?.reasons ?? []
}

describe('isCalendarDay', () => {
  it('takes a real day in the one form tasks.due_date stores', () => {
    expect(isCalendarDay('2026-09-15')).toBe(true)
    expect(isCalendarDay('2026-02-28')).toBe(true)
    // 2028 is a leap year; 2026 is not. Both answers come from the calendar
    // rather than from a range check on the day number.
    expect(isCalendarDay('2028-02-29')).toBe(true)
    expect(isCalendarDay('2026-02-29')).toBe(false)
  })

  it('refuses a day that does not exist', () => {
    // The whole reason this is not a bare regex.
    expect(isCalendarDay('2026-02-31')).toBe(false)
    expect(isCalendarDay('2026-13-01')).toBe(false)
    expect(isCalendarDay('2026-00-10')).toBe(false)
  })

  it('refuses the formats a spreadsheet offers instead', () => {
    expect(isCalendarDay('15/09/2026')).toBe(false)
    expect(isCalendarDay('Sep 15, 2026')).toBe(false)
    expect(isCalendarDay('2026-9-5')).toBe(false)
    expect(isCalendarDay('')).toBe(false)
  })
})

describe('the template', () => {
  it('carries the full column set, in order', () => {
    expect(deadlineCsvTemplate().split('\r\n')[0]).toBe(
      'task_title,task_id,due_date,due_kind,commitment_note',
    )
  })

  it('never offers a column a spreadsheet must not control', () => {
    // A file that could name the project would write into another one; a file
    // that could set status would let a spreadsheet close work.
    expect(DEADLINE_CSV_HEADERS).not.toContain('app_id')
    expect(DEADLINE_CSV_HEADERS).not.toContain('status')
    expect(DEADLINE_CSV_HEADERS).not.toContain('assignee')
  })

  it('refuses its own untouched example row — fixed before it could bite', () => {
    expect(parseDeadlineCsv(deadlineCsvTemplate())).toEqual({
      ok: false,
      error:
        'That file is still the blank import template — add your deadlines under the header row',
    })
  })

  it('recognises the template through the BOM Excel adds', () => {
    expect(parseDeadlineCsv(`﻿${deadlineCsvTemplate()}`)).toEqual({
      ok: false,
      error:
        'That file is still the blank import template — add your deadlines under the header row',
    })
  })

  it('is named for the day it was downloaded', () => {
    expect(deadlineCsvTemplateFilename(new Date('2026-08-22T09:30:00Z'))).toBe(
      'deadline-import-template-2026-08-22.csv',
    )
  })

  it('keeps the row once its title has been rewritten over', () => {
    const edited = deadlineCsvTemplate().replace(
      'Rework the invoice export',
      'Rework the invoice importer',
    )
    const result = parseOk(edited)
    expect(result.valid).toHaveLength(1)
    expect(result.ignoredExampleRows).toBe(0)
  })

  it('drops the example and keeps the rows typed underneath it', () => {
    const example = DEADLINE_CSV_EXAMPLE_ROW.map((cell) =>
      cell.includes(',') ? `"${cell}"` : cell,
    ).join(',')
    const result = parseOk(file(example, 'Ship the API,,2026-10-01,,'))
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]?.taskTitle).toBe('Ship the API')
    // Row numbering must survive the drop, or the preview stops matching the
    // spreadsheet the person is checking it against.
    expect(result.valid[0]?.rowNumber).toBe(3)
    expect(result.ignoredExampleRows).toBe(1)
  })
})

describe('unusable files', () => {
  it('rejects an empty file', () => {
    expect(parseDeadlineCsv('')).toEqual({ ok: false, error: 'That file is empty' })
  })

  it('names the required column a file is missing', () => {
    expect(parseDeadlineCsv('task_title\r\nShip the API')).toEqual({
      ok: false,
      error: 'That file is missing a required column: due_date',
    })
  })

  it('needs one of the two ways to name a task, not both', () => {
    expect(parseDeadlineCsv('due_date\r\n2026-10-01')).toEqual({
      ok: false,
      error: 'That file needs a task_title or a task_id column',
    })
    // Either one alone is enough.
    expect(parseDeadlineCsv('task_id,due_date\r\nnot-an-id,2026-10-01').ok).toBe(true)
    expect(parseDeadlineCsv('task_title,due_date\r\nShip the API,2026-10-01').ok).toBe(true)
  })

  it('refuses a file past the row limit rather than half-importing it', () => {
    const rows = Array.from(
      { length: DEADLINE_CSV_ROW_LIMIT + 1 },
      (_, index) => `Ship the API ${index},,2026-10-01,,`,
    )
    expect(parseDeadlineCsv(file(...rows))).toEqual({
      ok: false,
      error: `That file has ${DEADLINE_CSV_ROW_LIMIT + 1} rows — ${DEADLINE_CSV_ROW_LIMIT} is the most one import can take`,
    })
  })
})

describe('a row that is skipped, and why', () => {
  it('flags a row naming no task at all', () => {
    expect(reasonsFor(',,2026-10-01,,')).toEqual(['Needs a task_title or a task_id'])
  })

  it('flags a date a spreadsheet formatted its own way', () => {
    expect(reasonsFor('Ship the API,,15/10/2026,,')).toEqual([
      'Due date "15/10/2026" is not a day in YYYY-MM-DD form',
    ])
  })

  it('flags a due_kind nobody recognises rather than defaulting it', () => {
    // Silently becoming 'target' is how a promise to a client stops being one.
    expect(reasonsFor('Ship the API,,2026-10-01,hard,')).toEqual([
      'Due kind "hard" is not target or committed',
    ])
  })

  it('flags a commitment that names nobody', () => {
    // The rule applyDueDate throws on, said here as a reason instead — a throw
    // mid-batch would leave the rows before it already written.
    expect(reasonsFor('Ship the API,,2026-10-01,committed,')).toEqual([
      'A committed date needs a note naming who it was promised to',
    ])
  })

  it('flags a commitment with no date', () => {
    expect(reasonsFor('Ship the API,,,committed,Promised to Acme')).toEqual([
      'A commitment needs a date',
    ])
  })

  it('flags a task id that is not an id', () => {
    expect(reasonsFor('Ship the API,task-42,2026-10-01,,')).toEqual([
      'Task id "task-42" is not an id',
    ])
  })

  it('reports every reason at once, not the first', () => {
    expect(reasonsFor(',,15/10/2026,hard,')).toEqual([
      'Needs a task_title or a task_id',
      'Due date "15/10/2026" is not a day in YYYY-MM-DD form',
      'Due kind "hard" is not target or committed',
    ])
  })
})

describe('a row that is kept', () => {
  it('reads a plain target date', () => {
    const [row] = parseOk(file('Ship the API,,2026-10-01,,')).valid
    expect(row).toMatchObject({
      rowNumber: 2,
      taskId: null,
      taskTitle: 'Ship the API',
      dueDate: '2026-10-01',
      dueKind: 'target',
      commitmentNote: null,
    })
  })

  it('defaults an empty due_kind to target rather than to committed', () => {
    // The safe direction: a commitment must be stated, never inferred.
    expect(parseOk(file('Ship the API,,2026-10-01,,')).valid[0]?.dueKind).toBe('target')
  })

  it('reads a commitment with its note', () => {
    const [row] = parseOk(
      file('Ship the API,,2026-10-01,committed,"Promised to Acme, for the close"'),
    ).valid
    expect(row).toMatchObject({
      dueKind: 'committed',
      commitmentNote: 'Promised to Acme, for the close',
    })
  })

  it('takes an empty due_date as clearing the date', () => {
    expect(parseOk(file('Ship the API,,,,')).valid[0]?.dueDate).toBeNull()
  })

  it('lowercases an id and a kind somebody typed in caps', () => {
    const [row] = parseOk(
      file('Ship the API,AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE,2026-10-01,COMMITTED,Acme'),
    ).valid
    expect(row?.taskId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    expect(row?.dueKind).toBe('committed')
  })

  it('accepts a sheet with the optional columns deleted', () => {
    const result = parseDeadlineCsv('task_title,due_date\r\nShip the API,2026-10-01')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.valid[0]?.dueKind).toBe('target')
  })

  it('matches a header by alias, however the person spelled it', () => {
    const result = parseDeadlineCsv('Task,Deadline\r\nShip the API,2026-10-01')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.valid[0]?.dueDate).toBe('2026-10-01')
  })

  it('ignores a column this import has no field for, rather than failing', () => {
    const result = parseOk('task_title,due_date,owner\r\nShip the API,2026-10-01,Ama')
    expect(result.ignoredColumns).toEqual(['owner'])
    expect(result.valid).toHaveLength(1)
  })
})

describe('validateDeadlineCsvRow', () => {
  it('needs neither a title nor an id when the other is there', () => {
    expect(
      validateDeadlineCsvRow(2, {
        taskId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        dueDate: '2026-10-01',
      }).ok,
    ).toBe(true)
  })
})

describe('isDeadlineExampleRow', () => {
  it('needs the title, so a lone matching cell is not a template row', () => {
    expect(isDeadlineExampleRow({ dueKind: 'committed' })).toBe(false)
    expect(isDeadlineExampleRow({ dueDate: '2026-09-15' })).toBe(false)
    expect(isDeadlineExampleRow({})).toBe(false)
  })

  it('is false as soon as any populated cell differs', () => {
    expect(
      isDeadlineExampleRow({ taskTitle: 'Rework the invoice export', dueDate: '2026-11-01' }),
    ).toBe(false)
  })
})

describe('describeDeadlineImport', () => {
  it('says both numbers in one sentence', () => {
    expect(describeDeadlineImport(12, 3)).toBe('12 deadlines set, 3 rows skipped')
    expect(describeDeadlineImport(1, 1)).toBe('1 deadline set, 1 row skipped')
    expect(describeDeadlineImport(4, 0)).toBe('4 deadlines set')
  })
})
