import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getTableColumns, getTableName, isTable } from 'drizzle-orm'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import * as schema from './schema'
import {
  liveMeetings, liveMeetingsAs, MEETING_CHILD_TABLES, SOFT_TABLES,
} from './live'

// ---------------------------------------------------------------------------
// This file has two jobs:
//
//  1. A handful of direct unit checks on live.ts itself (the QueryBuilder
//     subqueries build valid, connection-free SQL).
//  2. A static source scan of src/ (checks 1-6 below) that is the actual
//     CI enforcement for the soft-deletes feature: it fails on every call
//     site that still reads a soft-deleted table directly instead of going
//     through liveMeetings/liveTasks/liveSprints/liveNoteSegments/
//     liveScreenshots. It is EXPECTED to be red right now — converting the
//     offenders it lists is Task 4 (and Task 3 for db.delete confinement),
//     not this task. Do not silence a real offender by adding it to
//     ALLOWLIST; that defeats the point of the check.
// ---------------------------------------------------------------------------

// --- live.ts sanity ---------------------------------------------------------

describe('live.ts subqueries', () => {
  it('SOFT_TABLES covers exactly the five soft-deleted tables', () => {
    expect(SOFT_TABLES.map((t) => t.sqlName).sort()).toEqual(
      ['meeting_note_segments', 'meeting_screenshots', 'meetings', 'sprints', 'tasks'].sort(),
    )
  })

  it('liveMeetings is a usable subquery: SELECT ... WHERE deleted_at is null', () => {
    // .as() subqueries don't expose their own SQL directly, but they are
    // usable as a .from() target — building a query against one and
    // rendering it to SQL is what proves the whole thing is connection-free
    // and syntactically valid (per the "Connection-free" comment in live.ts).
    const qb = new QueryBuilder()
    const { sql, params } = qb.select().from(liveMeetings).toSQL()
    expect(sql.toLowerCase()).toContain('deleted_at')
    expect(sql.toLowerCase()).toContain('is null')
    expect(params).toEqual([])
  })

  it('liveMeetingsAs mints a fresh alias for self-joins/multi-reference', () => {
    const a = liveMeetingsAs('a')
    const b = liveMeetingsAs('b')
    expect(a).not.toBe(b)
  })
})

// --- static source scan -----------------------------------------------------

const SRC_DIR = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(SRC_DIR, '..')

type FileEntry = { relPath: string; text: string }

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (
      entry.isFile()
      && /\.(ts|tsx)$/.test(entry.name)
      && !entry.name.endsWith('.test.ts')
      && !entry.name.endsWith('.test.tsx')
      && !entry.name.endsWith('.d.ts')
    ) {
      out.push(full)
    }
  }
  return out
}

const entries: FileEntry[] = walk(SRC_DIR).map((absPath) => ({
  relPath: path.relative(REPO_ROOT, absPath).split(path.sep).join('/'),
  text: readFileSync(absPath, 'utf8'),
}))

// Files intentionally exempt from checks 1-3 (raw .from()/join()/alias() of
// the five soft-deleted tables). Keep this to genuine, reviewed exceptions —
// Task 4 converts real offenders to liveMeetings/liveTasks/liveSprints/
// liveNoteSegments/liveScreenshots instead of adding them here.
const ALLOWLIST: readonly string[] = [
  // why: IS the raw-read boundary — wraps each table with isNull(deletedAt)
  // exactly once so every other call site can consume the filtered subquery
  // instead of re-implementing the filter itself.
  'src/db/live.ts',

  // why: Task 5's trash-bin listing has to read deletedAt IS NOT NULL rows
  // directly — the opposite of what liveMeetings/liveTasks/... expose.
  // Does not exist yet in this worktree; allowlisted by anticipated path.
  'src/features/admin/trash-queries.ts',

  // why: Task 5/6's restore + permanent-purge actions operate on already-
  // trashed rows and perform the eventual hard delete. Does not exist yet.
  'src/features/admin/trash-actions.ts',

  // why: a full DB backup must capture every row, including soft-deleted
  // ones, so a restore from backup is complete rather than silently missing
  // anything a user had trashed.
  'src/features/admin/backup.ts',

  // why: houses the getMeetingNoteTimeline legacy `meetings.notes` fallback
  // probe (currently inline in ai-actions.ts), extracted into its own file
  // once the rest of ai-actions.ts's reads convert to live tables in Task 4.
  // Does not exist yet.
  'src/features/meetings/legacy-notes.ts',

  // why: private-blob proxy for keyframe screenshot images — same pattern as
  // src/app/api/avatar/[...path]/route.ts. Referenced today only as the
  // KEYFRAME_PROXY_PREFIX string constant in ai-actions.ts; the route itself
  // is not built yet.
  'src/app/api/meeting-keyframes/[...path]/route.ts',
]
const allowlistSet = new Set(ALLOWLIST)

const SOFT_TABLE_NAMES = '(meetings|tasks|sprints|meetingNoteSegments|meetingScreenshots)'
const RAW_FROM_RE = new RegExp(`\\.from\\(${SOFT_TABLE_NAMES}[),]`)
const RAW_JOIN_RE = new RegExp(`(?:leftJoin|innerJoin|rightJoin)\\(${SOFT_TABLE_NAMES}[),]`)
const ALIAS_RE = new RegExp(`alias\\(${SOFT_TABLE_NAMES}\\b`)
const CHILD_TABLE_NAMES = '(meetingAttendees|meetingAiNotes|meetingFollowups|meetingSpeakers|meetingTaskSuggestions|meetingRecordingSegments)'
const CHILD_FROM_RE = new RegExp(`\\.from\\(${CHILD_TABLE_NAMES}[),]`)

// Check 1 -------------------------------------------------------------------

describe('check 1: raw .from()/join() reads of a soft-deleted table', () => {
  const offenders = entries.filter(
    (e) => !allowlistSet.has(e.relPath) && (RAW_FROM_RE.test(e.text) || RAW_JOIN_RE.test(e.text)),
  )

  it.each(offenders)('$relPath', ({ relPath }) => {
    throw new Error(
      `${relPath}: reads meetings/tasks/sprints/meetingNoteSegments/meetingScreenshots directly via `
      + `.from()/leftJoin()/innerJoin()/rightJoin(). Use liveMeetings/liveTasks/liveSprints/`
      + `liveNoteSegments/liveScreenshots from '@/db/live' instead (or liveMeetingsAs(name)/etc. if the `
      + `query needs a second reference). If this is a genuine, reviewed exception, add '${relPath}' to `
      + 'ALLOWLIST in src/db/live.test.ts with a // why comment.',
    )
  })
})

// Check 2 -------------------------------------------------------------------

describe('check 2: alias() of a soft-deleted table', () => {
  const offenders = entries.filter((e) => !allowlistSet.has(e.relPath) && ALIAS_RE.test(e.text))

  it.each(offenders)('$relPath', ({ relPath }) => {
    throw new Error(
      `${relPath}: calls alias() directly on meetings/tasks/sprints/meetingNoteSegments/meetingScreenshots. `
      + "Alias the live subquery instead — e.g. liveTasksAs('some_name') from '@/db/live' — so a self-join "
      + "or multi-reference still excludes soft-deleted rows. If this is a genuine, reviewed exception, add "
      + `'${relPath}' to ALLOWLIST in src/db/live.test.ts with a // why comment.`,
    )
  })
})

// Check 3 -------------------------------------------------------------------

describe('check 3: meeting child table read without joining liveMeetings', () => {
  const offenders = entries.filter(
    (e) => !allowlistSet.has(e.relPath) && CHILD_FROM_RE.test(e.text) && !e.text.includes('liveMeetings'),
  )

  it.each(offenders)('$relPath', ({ relPath }) => {
    throw new Error(
      `${relPath}: reads a meeting child table (${MEETING_CHILD_TABLES.join(', ')}) via .from() without `
      + 'also importing/using liveMeetings from \'@/db/live\'. A trashed meeting\'s children are '
      + 'live-iff-the-meeting-is-live (no deletedAt of their own) — join against liveMeetings (e.g. '
      + '.innerJoin(liveMeetings, eq(child.meetingId, liveMeetings.id))) so children of a soft-deleted '
      + `meeting stop being readable. If this is a genuine, reviewed exception, add '${relPath}' to `
      + 'ALLOWLIST in src/db/live.test.ts with a // why comment.',
    )
  })
})

// Check 4 ---------------------------------------------------------------

// A hard db.delete(...) call is only legitimate in a handful of known
// places: the eventual trash purge, the admin test-data wipe (scoped to
// clearTestData — the rest of admin/actions.ts must not silently hard-
// delete), and revoking a user's own Gemini API key (geminiKeys has no
// deletedAt column — there is nothing to soft-delete). Everywhere else, a
// soft-deleted table must be updated (deletedAt/deletedBy set), not deleted.
const DELETE_RE = /db\s*\.\s*delete\(/g

const DELETE_ALWAYS_ALLOWED_FILES = new Set([
  // why: Task 5/6 permanent-purge action. Does not exist yet.
  'src/features/admin/trash-actions.ts',
])

// file -> function whose body may hard-delete; matches elsewhere in the same
// file are still offenders (this is deliberately narrower than a file-level
// allowlist).
const DELETE_ALLOWED_FUNCTIONS: Readonly<Record<string, string>> = {
  // Verified by reading the file: every db.delete() in admin/actions.ts
  // today lives inside clearTestData (the ENABLE_DB_CLEAR-gated dev tool).
  'src/features/admin/actions.ts': 'clearTestData',
  // Verified by reading the file: deleteGeminiKey is the real, current
  // location of the Gemini-key hard delete (a multi-line `db\n  .delete(...)`
  // chain, which is why the regex above tolerates whitespace/newlines
  // between `db` and `.delete(`).
  'src/features/gemini/actions.ts': 'deleteGeminiKey',
  // why: `assignments` is deliberately NOT one of the soft-deleted tables
  // (see SOFT_TABLES in src/db/live.ts / schema.ts) — the design spec keeps
  // assignments hard-deleted on purpose. assignment_history already records
  // the removal (a changeKind='removed' row with who/when/role/pct — see the
  // schema.ts comment on assignment_history), so nothing is lost when the
  // live `assignments` row goes away. Adding a deletedAt column here would
  // also break assignments_user_app_idx and cause every capacity query to
  // over-count, since a still-live index/lookup would keep matching rows
  // that are only "soft" gone. removeAssignment is the one place that
  // deletes an assignment row (verified by reading the file).
  'src/features/people/actions.ts': 'removeAssignment',
}

/** Byte offsets [start, end) of `function <name>(` ... matching `}`, or null. */
function functionSpan(text: string, functionName: string): [number, number] | null {
  const decl = new RegExp(`function\\s+${functionName}\\s*\\(`).exec(text)
  if (!decl) return null
  const braceStart = text.indexOf('{', decl.index)
  if (braceStart === -1) return null
  let depth = 0
  for (let i = braceStart; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') {
      depth -= 1
      if (depth === 0) return [decl.index, i + 1]
    }
  }
  return null
}

function check4MatchIndexes(entry: FileEntry): number[] {
  const matches = [...entry.text.matchAll(DELETE_RE)].map((m) => m.index ?? 0)
  if (matches.length === 0) return []
  if (DELETE_ALWAYS_ALLOWED_FILES.has(entry.relPath)) return []
  if (allowlistSet.has(entry.relPath)) return [] // e.g. backup.ts, trash-queries.ts if ever applicable

  const allowedFn = DELETE_ALLOWED_FUNCTIONS[entry.relPath]
  if (allowedFn) {
    const span = functionSpan(entry.text, allowedFn)
    if (span) {
      const [start, end] = span
      return matches.filter((i) => i < start || i >= end)
    }
  }
  return matches
}

describe('check 4: db.delete(...) confined to trash/cleanup/key-revoke sites', () => {
  const offenders = entries.filter((e) => check4MatchIndexes(e).length > 0)

  it.each(offenders)('$relPath', ({ relPath }) => {
    throw new Error(
      `${relPath}: calls db.delete(...) outside the allowed sites (src/features/admin/trash-actions.ts, `
      + "clearTestData in src/features/admin/actions.ts, deleteGeminiKey in src/features/gemini/actions.ts, "
      + 'or a scripts/ file). A soft-deleted table must be marked deleted (set deletedAt/deletedBy) instead '
      + `of hard-deleted — see src/db/live.ts. (${relPath})`,
    )
  })
})

// Check 5 ---------------------------------------------------------------

describe('check 5: every schema table with a deletedAt column is in SOFT_TABLES', () => {
  const softTableSqlNames = new Set<string>(SOFT_TABLES.map((t) => t.sqlName))

  const tablesWithDeletedAt = Object.entries(schema)
    .filter(([, value]) => isTable(value))
    .map(([exportName, value]) => {
      const table = value as Parameters<typeof getTableName>[0]
      return {
        exportName,
        sqlName: getTableName(table),
        hasDeletedAt: 'deletedAt' in getTableColumns(table),
      }
    })
    .filter((t) => t.hasDeletedAt)

  it('sanity: found at least one soft-deleted table via schema reflection', () => {
    expect(tablesWithDeletedAt.length).toBeGreaterThan(0)
  })

  const missing = tablesWithDeletedAt.filter((t) => !softTableSqlNames.has(t.sqlName))

  it.each(missing)('schema.$exportName ($sqlName) is missing from SOFT_TABLES', ({ exportName, sqlName }) => {
    throw new Error(
      `schema.${exportName} (SQL table "${sqlName}") has a deletedAt column but is not registered in `
      + `SOFT_TABLES in src/db/live.ts. Add a liveOf(${exportName}, 'live_${sqlName}') export plus a `
      + 'matching SOFT_TABLES entry, the same way meetings/tasks/sprints/meetingNoteSegments/'
      + 'meetingScreenshots are wired up.',
    )
  })

  it('SOFT_TABLES has no stale entries for tables that no longer have deletedAt', () => {
    const currentNames = new Set(tablesWithDeletedAt.map((t) => t.sqlName))
    const stale = SOFT_TABLES.filter((t) => !currentNames.has(t.sqlName)).map((t) => t.sqlName)
    expect(stale).toEqual([])
  })
})

// Check 6 ---------------------------------------------------------------

describe('check 6: isNull(...sprintId) backlog predicate confined to backlog.ts', () => {
  const BACKLOG_PATH = 'src/features/sprints/backlog.ts'
  const SPRINT_ID_ISNULL_RE = /isNull\([^)]*sprintId\)/

  const offenders = entries.filter((e) => e.relPath !== BACKLOG_PATH && SPRINT_ID_ISNULL_RE.test(e.text))

  it.each(offenders)('$relPath', ({ relPath }) => {
    throw new Error(
      `${relPath}: uses isNull(...sprintId) (the "task has no sprint = backlog" predicate) outside `
      + `${BACKLOG_PATH}. Move this predicate into a shared helper exported from backlog.ts and import it `
      + 'here instead of reimplementing it inline, so the backlog definition stays in one place as it picks '
      + 'up the soft-delete filter.',
    )
  })
})
