import { describe, expect, it } from 'vitest'
import {
  BUG_CSV_COLUMNS,
  BUG_CSV_EXAMPLE_ROW,
  BUG_CSV_HEADERS,
  BUG_CSV_ROW_LIMIT,
  bugCsvTemplate,
  bugCsvTemplateFilename,
  describeBugImport,
  isTemplateExampleRow,
  normalizeHeader,
  parseBugCsv,
  splitCsvRows,
  validateBugCsvRow,
} from './bug-csv'
import { BUG_SEVERITIES, BUG_STATUSES } from './bug-display'

/**
 * The format, driven end to end without a database.
 *
 * Excel is what a PM will actually use, so the cases that matter most here are
 * the ones Excel produces without being asked: a BOM on every "CSV UTF-8"
 * save, CRLF endings, a comma inside a description, a newline inside a cell,
 * and a sheet where somebody deleted the columns they had nothing to say
 * about. A parser that breaks on any of those is useless however correct it is
 * about the specification.
 */

const HEADER = BUG_CSV_HEADERS.join(',')

/** A file with the full column set and whatever rows are given. */
function file(...rows: string[]): string {
  return [HEADER, ...rows].join('\r\n')
}

/** parseBugCsv, asserting the file itself was usable. */
function parseOk(text: string) {
  const result = parseBugCsv(text)
  if (!result.ok) throw new Error(`expected a usable file, got: ${result.error}`)
  return result
}

// ---------------------------------------------------------------------------
// The template
// ---------------------------------------------------------------------------

describe('the template', () => {
  it('carries the full column set, in order', () => {
    expect(bugCsvTemplate().split('\r\n')[0]).toBe(
      'title,description,severity,status,assignee_email,page_path',
    )
  })

  it('names every column the parser knows about — no column the template omits', () => {
    expect(BUG_CSV_HEADERS).toEqual(BUG_CSV_COLUMNS.map((column) => column.header))
  })

  it('never offers app_id or reported_by — a CSV cannot choose either', () => {
    expect(BUG_CSV_HEADERS).not.toContain('app_id')
    expect(BUG_CSV_HEADERS).not.toContain('reported_by')
    for (const column of BUG_CSV_COLUMNS) {
      expect(column.aliases).not.toContain('app_id')
      expect(column.aliases).not.toContain('reported_by')
    }
  })

  it('requires exactly title and description — the two NOT NULL columns', () => {
    expect(BUG_CSV_COLUMNS.filter((c) => c.required).map((c) => c.key)).toEqual([
      'title',
      'description',
    ])
  })

  /*
   * This block used to assert the opposite — "its own example row parses back
   * as one valid bug" — which is exactly the behaviour that filed "Sprint
   * switcher forgets the backlog" into real projects. The round-trip property
   * it was protecting (every column survives the write/read cycle) is still
   * covered below, by a row that has been EDITED the way somebody filling the
   * template in actually edits it.
   */
  it('refuses the untouched template: it holds no bug anybody filed', () => {
    expect(parseBugCsv(bugCsvTemplate())).toEqual({
      ok: false,
      error: 'That file is still the blank import template — add your bugs under the header row',
    })
  })

  it('recognises the template through the BOM Excel adds', () => {
    // The BOM used to become part of the first header name, so `title` stopped
    // matching and every row came back as missing a required column. Reaching
    // the TEMPLATE message rather than a missing-column one is the proof that
    // the header still parsed and the row was matched against the example.
    expect(parseBugCsv(`\ufeff${bugCsvTemplate()}`)).toEqual({
      ok: false,
      error: 'That file is still the blank import template — add your bugs under the header row',
    })
  })

  it('round-trips every column once the example row has been edited', () => {
    const edited = bugCsvTemplate().replace(
      'Sprint switcher forgets the backlog',
      'Sprint switcher forgets the sprint',
    )
    const result = parseOk(edited)
    expect(result.invalid).toEqual([])
    expect(result.valid).toHaveLength(1)
    expect(result.ignoredExampleRows).toBe(0)
    expect(result.valid[0]).toMatchObject({
      rowNumber: 2,
      title: 'Sprint switcher forgets the sprint',
      severity: 'high',
      status: 'open',
      assigneeEmail: null,
      pagePath: '/apps/logpup?tab=board',
    })
  })

  it('is named for the day it was downloaded', () => {
    expect(bugCsvTemplateFilename(new Date('2026-08-20T09:30:00Z'))).toBe(
      'bug-import-template-2026-08-20.csv',
    )
  })
})

// ---------------------------------------------------------------------------
// The reader
// ---------------------------------------------------------------------------

describe('splitCsvRows', () => {
  it('reads CRLF, LF and a lone CR as the same row break', () => {
    expect(splitCsvRows('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
    expect(splitCsvRows('a,b\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
    expect(splitCsvRows('a,b\rc,d')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('keeps a comma inside a quoted field', () => {
    expect(splitCsvRows('a,"one, two",c')).toEqual([['a', 'one, two', 'c']])
  })

  it('keeps a NEWLINE inside a quoted field — Alt+Enter in a cell', () => {
    expect(splitCsvRows('a,"line one\nline two",c')).toEqual([['a', 'line one\nline two', 'c']])
    // A CRLF inside quotes stays a CRLF: it is data, not a row break.
    expect(splitCsvRows('a,"line one\r\nline two",c')).toEqual([
      ['a', 'line one\r\nline two', 'c'],
    ])
  })

  it('unescapes a doubled quote', () => {
    expect(splitCsvRows('a,"she said ""no""",c')).toEqual([['a', 'she said "no"', 'c']])
  })

  it('treats a mid-field quote as data, not a delimiter', () => {
    expect(splitCsvRows('a,5" screen,c')).toEqual([['a', '5" screen', 'c']])
  })

  it('strips a leading BOM rather than gluing it to the first header', () => {
    expect(splitCsvRows('﻿title,description')).toEqual([['title', 'description']])
  })

  it('keeps an empty trailing cell but does not invent a trailing row', () => {
    expect(splitCsvRows('a,b,\r\n')).toEqual([['a', 'b', '']])
  })
})

// ---------------------------------------------------------------------------
// Header mapping
// ---------------------------------------------------------------------------

describe('header mapping', () => {
  it('folds case, spaces, hyphens and dots', () => {
    expect(normalizeHeader('  Assignee Email ')).toBe('assignee_email')
    expect(normalizeHeader('assignee-email')).toBe('assignee_email')
    expect(normalizeHeader('ASSIGNEE.EMAIL')).toBe('assignee_email')
  })

  it('matches columns by NAME, not position', () => {
    const result = parseOk(
      ['STATUS,Description,  Title  ', 'triaged,It falls over on save,Save button explodes'].join(
        '\n',
      ),
    )
    expect(result.valid[0]).toMatchObject({
      title: 'Save button explodes',
      description: 'It falls over on save',
      status: 'triaged',
    })
  })

  it('accepts a missing OPTIONAL column and defaults what it stood for', () => {
    const result = parseOk(
      ['title,description', 'Save button explodes,It falls over on save'].join('\n'),
    )
    expect(result.invalid).toEqual([])
    expect(result.valid[0]).toMatchObject({
      severity: null,
      status: null,
      pagePath: null,
      assigneeEmail: null,
    })
  })

  it('ignores unknown extra columns rather than failing the file', () => {
    const result = parseOk(
      ['title,description,jira_id,notes', 'Save button explodes,It falls over on save,ENG-4,n/a'].join(
        '\n',
      ),
    )
    expect(result.ignoredColumns).toEqual(['jira_id', 'notes'])
    expect(result.valid).toHaveLength(1)
    expect(result.invalid).toEqual([])
  })

  it('keeps the FIRST of a duplicated column, so a stray empty one cannot blank it', () => {
    const result = parseOk(
      ['title,description,title', 'Save button explodes,It falls over on save,'].join('\n'),
    )
    expect(result.valid[0]?.title).toBe('Save button explodes')
  })

  it('accepts the documented aliases', () => {
    const result = parseOk(
      ['summary,details,assigned_to,page', 'Save button explodes,It falls over on save,,/apps/logpup'].join(
        '\n',
      ),
    )
    expect(result.valid[0]).toMatchObject({
      title: 'Save button explodes',
      description: 'It falls over on save',
      pagePath: '/apps/logpup',
    })
  })
})

// ---------------------------------------------------------------------------
// Sparse rows
// ---------------------------------------------------------------------------

describe('sparse rows', () => {
  it('treats a row that stops early as empty cells, not an error', () => {
    const result = parseOk(file('Save button explodes,It falls over on save'))
    expect(result.invalid).toEqual([])
    expect(result.valid[0]).toMatchObject({ severity: null, status: null, pagePath: null })
  })

  it('treats an empty optional cell as "use the default"', () => {
    const result = parseOk(file('Save button explodes,It falls over on save,,,,'))
    expect(result.valid[0]).toMatchObject({
      severity: null,
      status: null,
      assigneeEmail: null,
      pagePath: null,
    })
  })

  it('skips blank lines without spending a row number on them', () => {
    const result = parseOk(file('Save button explodes,It falls over on save', '', ',,,,,', 'Second one breaks,And this is what it did'))
    expect(result.valid.map((row) => row.rowNumber)).toEqual([2, 5])
  })

  it('reads a long description with a comma and a newline in it', () => {
    const result = parseOk(
      file('"Save, then reload","Line one\nLine two, with a comma",critical'),
    )
    expect(result.valid[0]).toMatchObject({
      title: 'Save, then reload',
      description: 'Line one\nLine two, with a comma',
      severity: 'critical',
    })
  })
})

// ---------------------------------------------------------------------------
// The template's own example row
// ---------------------------------------------------------------------------

describe('the example row, on the way back in', () => {
  /** The example row as a CSV line, so a file can be built around it. */
  const EXAMPLE_LINE = BUG_CSV_EXAMPLE_ROW.map((cell) =>
    cell.includes(',') ? `"${cell}"` : cell,
  ).join(',')

  const REAL_BUG = 'Save button explodes,It falls over on save when you press it'

  it('drops the untouched example and keeps the bugs typed underneath it', () => {
    const result = parseOk(file(EXAMPLE_LINE, REAL_BUG))
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]?.title).toBe('Save button explodes')
    expect(result.invalid).toEqual([])
    expect(result.ignoredExampleRows).toBe(1)
  })

  it('leaves the row numbers of everything below it alone', () => {
    // The dropped row is line 2. The bug under it is line 3 in the
    // spreadsheet's own gutter and must still say 3, or the preview stops
    // matching the file the person is looking at.
    const result = parseOk(file(EXAMPLE_LINE, REAL_BUG))
    expect(result.valid[0]?.rowNumber).toBe(3)
  })

  it('keeps the row once the title has been rewritten over', () => {
    const edited = EXAMPLE_LINE.replace(
      'Sprint switcher forgets the backlog',
      'Sprint switcher forgets the sprint',
    )
    const result = parseOk(file(edited))
    expect(result.valid).toHaveLength(1)
    expect(result.ignoredExampleRows).toBe(0)
  })

  it('keeps the row when only the description has been rewritten', () => {
    const cells = [...BUG_CSV_EXAMPLE_ROW]
    cells[1] = 'Actually it drops every selection, not just the backlog one.'
    const line = cells.map((cell) => (cell.includes(',') ? `"${cell}"` : cell)).join(',')
    const result = parseOk(file(line))
    expect(result.valid).toHaveLength(1)
    expect(result.ignoredExampleRows).toBe(0)
  })

  it('counts more than one copy of it', () => {
    const result = parseOk(file(EXAMPLE_LINE, EXAMPLE_LINE, REAL_BUG))
    expect(result.ignoredExampleRows).toBe(2)
    expect(result.valid).toHaveLength(1)
  })

  it('does not spend the row limit on it', () => {
    // 500 real rows plus the example is a 500-row import, not a rejection.
    const rows = Array.from(
      { length: BUG_CSV_ROW_LIMIT },
      (_, index) => `Save button explodes ${index},It falls over on save`,
    )
    const result = parseOk(file(EXAMPLE_LINE, ...rows))
    expect(result.valid).toHaveLength(BUG_CSV_ROW_LIMIT)
  })

  describe('isTemplateExampleRow', () => {
    it('needs the title, so a lone matching enum value is not a template row', () => {
      // The bug this clause exists for: `severity,high` alone matched once.
      expect(isTemplateExampleRow({ severity: 'high' })).toBe(false)
      expect(isTemplateExampleRow({ status: 'open' })).toBe(false)
      expect(isTemplateExampleRow({})).toBe(false)
    })

    it('ignores case and surrounding space, which Excel adds on its own', () => {
      expect(
        isTemplateExampleRow({ title: '  SPRINT SWITCHER FORGETS THE BACKLOG  ' }),
      ).toBe(true)
    })

    it('is false as soon as any populated cell differs', () => {
      expect(
        isTemplateExampleRow({
          title: BUG_CSV_EXAMPLE_ROW[0],
          severity: 'low',
        }),
      ).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// Every reason a row can be skipped
// ---------------------------------------------------------------------------

describe('invalid rows', () => {
  /** The reasons for the one body row in a single-row file. */
  function reasonsFor(row: string): string[] {
    const result = parseOk(file(row))
    return result.invalid[0]?.reasons ?? []
  }

  it('flags a missing title', () => {
    expect(reasonsFor(',It falls over on save when you press it')).toEqual(['Title is missing'])
  })

  it('flags a missing description', () => {
    expect(reasonsFor('Save button explodes,')).toEqual(['Description is missing'])
  })

  it('says "missing" once, not "missing" AND "too short"', () => {
    // A row with SOMETHING in it — a wholly empty line is a blank line and is
    // dropped rather than flagged, which the blank-line case above covers.
    expect(reasonsFor(',,high')).toEqual(['Title is missing', 'Description is missing'])
  })

  it('flags a title under the shared minimum', () => {
    expect(reasonsFor('Ugh,It falls over on save when you press it')).toEqual([
      'Title must be at least 4 characters',
    ])
  })

  it('flags a title over the shared maximum', () => {
    expect(reasonsFor(`${'x'.repeat(141)},It falls over on save when you press it`)).toEqual([
      'Title must be 140 characters or fewer',
    ])
  })

  it('flags a description under the shared minimum', () => {
    expect(reasonsFor('Save button explodes,broken')).toEqual([
      'Description must be at least 10 characters',
    ])
  })

  it('flags a description over the shared maximum', () => {
    expect(reasonsFor(`Save button explodes,${'x'.repeat(4001)}`)).toEqual([
      'Description must be 4000 characters or fewer',
    ])
  })

  it('flags an unrecognised severity rather than defaulting it', () => {
    expect(reasonsFor('Save button explodes,It falls over on save,urgent')).toEqual([
      `Severity "urgent" is not one of: ${BUG_SEVERITIES.join(', ')}`,
    ])
  })

  it('flags an unrecognised status rather than defaulting it', () => {
    expect(reasonsFor('Save button explodes,It falls over on save,,wip')).toEqual([
      `Status "wip" is not one of: ${BUG_STATUSES.join(', ')}`,
    ])
  })

  it('flags an assignee that is not an email address', () => {
    expect(reasonsFor('Save button explodes,It falls over on save,,,Nuwan')).toEqual([
      'Assignee "Nuwan" is not an email address',
    ])
  })

  it('flags an off-site page path — a CSV is not a way to plant a link', () => {
    expect(reasonsFor('Save button explodes,It falls over on save,,,,//evil.example')).toEqual([
      'Page must be a path inside LogPup',
    ])
    expect(reasonsFor('Save button explodes,It falls over on save,,,,https://evil.example')).toEqual(
      ['Page must be a path inside LogPup'],
    )
  })

  it('collects EVERY reason for a row, not just the first', () => {
    expect(reasonsFor('Ugh,short,urgent,wip,nope,//evil.example')).toEqual([
      'Title must be at least 4 characters',
      'Description must be at least 10 characters',
      `Severity "urgent" is not one of: ${BUG_SEVERITIES.join(', ')}`,
      `Status "wip" is not one of: ${BUG_STATUSES.join(', ')}`,
      'Page must be a path inside LogPup',
      'Assignee "nope" is not an email address',
    ])
  })

  it('reports the row number the spreadsheet shows, and the title to find it by', () => {
    const result = parseOk(
      file('Save button explodes,It falls over on save', 'Broken thing,short'),
    )
    expect(result.invalid[0]).toMatchObject({ rowNumber: 3, title: 'Broken thing' })
  })

  it('keeps the valid rows beside the invalid ones', () => {
    const result = parseOk(
      file('Save button explodes,It falls over on save', 'Ugh,short', 'Second one breaks,And this is what it did'),
    )
    expect(result.valid.map((row) => row.title)).toEqual([
      'Save button explodes',
      'Second one breaks',
    ])
    expect(result.invalid.map((row) => row.rowNumber)).toEqual([3])
  })
})

// ---------------------------------------------------------------------------
// Values that are accepted
// ---------------------------------------------------------------------------

describe('accepted values', () => {
  it('accepts every severity, case-insensitively', () => {
    for (const severity of BUG_SEVERITIES) {
      const result = parseOk(file(`Save button explodes,It falls over on save,${severity.toUpperCase()}`))
      expect(result.valid[0]?.severity).toBe(severity)
    }
  })

  it('accepts every status, including the display spelling of in_progress', () => {
    for (const status of BUG_STATUSES) {
      const result = parseOk(file(`Save button explodes,It falls over on save,,${status}`))
      expect(result.valid[0]?.status).toBe(status)
    }
    const spelled = parseOk(file('Save button explodes,It falls over on save,,In Progress'))
    expect(spelled.valid[0]?.status).toBe('in_progress')
  })

  it('lower-cases an assignee email so the lookup is case-insensitive', () => {
    const result = parseOk(file('Save button explodes,It falls over on save,,,Nuwan@Example.COM'))
    expect(result.valid[0]?.assigneeEmail).toBe('nuwan@example.com')
  })

  it('trims the title and description it keeps', () => {
    const result = parseOk(file('  Save button explodes  ,  It falls over on save  '))
    expect(result.valid[0]).toMatchObject({
      title: 'Save button explodes',
      description: 'It falls over on save',
    })
  })
})

// ---------------------------------------------------------------------------
// Files that cannot be read at all
// ---------------------------------------------------------------------------

describe('unusable files', () => {
  it('rejects an empty file', () => {
    expect(parseBugCsv('')).toEqual({ ok: false, error: 'That file is empty' })
    expect(parseBugCsv('\r\n\r\n')).toEqual({ ok: false, error: 'That file is empty' })
  })

  it('rejects a file with no bugs under the header', () => {
    expect(parseBugCsv(HEADER)).toEqual({
      ok: false,
      error: 'That file has a header row but no bugs under it',
    })
  })

  it('names the required column a file is missing', () => {
    expect(parseBugCsv('title,severity\nSave button explodes,high')).toEqual({
      ok: false,
      error: 'That file is missing a required column: description',
    })
    expect(parseBugCsv('severity\nhigh')).toEqual({
      ok: false,
      error: 'That file is missing a required column: title, description',
    })
  })

  it('refuses a file past the row limit rather than half-importing it', () => {
    const rows = Array.from(
      { length: BUG_CSV_ROW_LIMIT + 1 },
      (_, index) => `Save button explodes ${index},It falls over on save`,
    )
    const result = parseBugCsv(file(...rows))
    expect(result).toEqual({
      ok: false,
      error: `That file has ${BUG_CSV_ROW_LIMIT + 1} rows — ${BUG_CSV_ROW_LIMIT} is the most one import can take`,
    })
  })

  it('accepts a file exactly at the row limit', () => {
    const rows = Array.from(
      { length: BUG_CSV_ROW_LIMIT },
      (_, index) => `Save button explodes ${index},It falls over on save`,
    )
    expect(parseOk(file(...rows)).valid).toHaveLength(BUG_CSV_ROW_LIMIT)
  })
})

// ---------------------------------------------------------------------------
// validateBugCsvRow on its own — the server calls it too
// ---------------------------------------------------------------------------

describe('validateBugCsvRow', () => {
  it('validates a cell bag with no file around it', () => {
    const result = validateBugCsvRow(7, {
      title: 'Save button explodes',
      description: 'It falls over on save',
    })
    expect(result.ok).toBe(true)
    expect(result.row.rowNumber).toBe(7)
  })

  it('treats a wholly absent optional key the same as an empty cell', () => {
    const withNothing = validateBugCsvRow(2, { title: 'Save button explodes', description: 'It falls over on save' })
    const withEmpties = validateBugCsvRow(2, {
      title: 'Save button explodes',
      description: 'It falls over on save',
      severity: '',
      status: '',
      assigneeEmail: '',
      pagePath: '',
    })
    expect(withNothing).toEqual(withEmpties)
  })
})

// ---------------------------------------------------------------------------
// The sentence a user is told afterwards
// ---------------------------------------------------------------------------

describe('describeBugImport', () => {
  it('says both numbers, and says them singular when they are one', () => {
    expect(describeBugImport(12, 3)).toBe('12 bugs created, 3 rows skipped')
    expect(describeBugImport(1, 1)).toBe('1 bug created, 1 row skipped')
  })

  it('does not mention skipping when nothing was skipped', () => {
    expect(describeBugImport(4, 0)).toBe('4 bugs created')
  })

  it('still reads correctly when nothing could be created', () => {
    expect(describeBugImport(0, 5)).toBe('0 bugs created, 5 rows skipped')
  })
})
