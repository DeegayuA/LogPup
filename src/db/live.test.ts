import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
  it('SOFT_TABLES covers exactly the eight soft-deleted tables', () => {
    expect(SOFT_TABLES.map((t) => t.sqlName).sort()).toEqual(
      [
        'apps', 'bug_reports', 'meeting_note_segments', 'meeting_screenshots',
        'meetings', 'sprints', 'tasks', 'worklog_entries',
      ].sort(),
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

  // why: createApp's slug-uniqueness pre-check must see TRASHED apps. The
  // unique index on apps.slug covers them, so asking only the live set would
  // report an address as free and then fail the insert with a 23505 the user
  // cannot act on. Every other read of `apps` in this file goes through
  // liveApps.
  'src/features/apps/actions.ts',

  // why: the trash-bin listing has to read deletedAt IS NOT NULL rows
  // directly — the opposite of what liveMeetings/liveTasks/... expose.
  'src/features/admin/trash-queries.ts',

  // why: the restore + permanent-purge actions operate on already-trashed
  // rows and perform the eventual hard delete.
  'src/features/admin/trash-actions.ts',

  // why: a full DB backup must capture every row, including soft-deleted
  // ones, so a restore from backup is complete rather than silently missing
  // anything a user had trashed.
  'src/features/admin/backup.ts',

  // why: houses the getMeetingNoteTimeline legacy `meetings.notes` fallback
  // probe — a raw EXISTS over meeting_note_segments that must see trashed
  // rows too, so trashing the last typed segment doesn't resurrect the legacy
  // notes blob.
  'src/features/meetings/legacy-notes.ts',

  // why: the meeting-keyframes proxy route's admin-preview exception. An
  // admin has to be able to preview a trashed keyframe from the admin Trash
  // card, and a non-admin's "is the MEETING trashed" check needs the real
  // meetings row too — liveScreenshots/liveMeetings would filter a
  // soft-deleted row out before the route ever got a chance to look at it.
  // The actual authorization decision is the pure canServeKeyframe function
  // (src/features/meetings/keyframe-access.ts, unit tested directly in
  // keyframe-access.test.ts); this raw read only gathers the facts it needs.
  'src/app/api/meeting-keyframes/[...path]/route.ts',
]
const allowlistSet = new Set(ALLOWLIST)

// An allowlist entry for a file that does not exist is a standing exemption
// waiting to be inherited: whoever eventually creates that path gets a free
// pass they never asked for and no reviewer ever granted. (The keyframe proxy
// route src/app/api/meeting-keyframes/[...path]/route.ts was listed here for
// exactly that reason and has now been removed — re-add it in the same commit
// that actually writes the route, with a why comment that can be reviewed
// against real code.) Asserting existence keeps the list self-maintaining: a
// deleted or renamed file fails here instead of quietly widening the net.
describe('allowlist hygiene', () => {
  it.each(ALLOWLIST)('%s exists', (relPath) => {
    expect(existsSync(path.join(REPO_ROOT, relPath))).toBe(true)
  })
})

// EVERY pattern below tolerates whitespace after the opening paren. A long
// drizzle chain is exactly the kind of line a formatter breaks, and
//
//   .from(
//     meetings,
//   )
//
// is the same read as `.from(meetings)` — without the `\s*` these checks
// simply stopped seeing a call the moment prettier wrapped it, which is a
// silent hole rather than a failing test. (Verified: a probe file using that
// spelling turns checks 1, 2 and 3 red.)
// worklogEntries is listed here in the commit that creates the table, before
// its first reader exists — like meetingApps before it. This regex, not
// SOFT_TABLES, is the actual enforcement for checks 1 and 2, and it can only
// see a table named here as a LITERAL, so a table registered in live.ts but
// missing from this string is guarded by check 5 alone (which only asks that
// it be registered, never that anybody reads it through the live subquery).
const SOFT_TABLE_NAMES = '(apps|bugReports|meetings|tasks|sprints|meetingNoteSegments|meetingScreenshots|worklogEntries)'
const RAW_FROM_RE = new RegExp(`\\.from\\(\\s*${SOFT_TABLE_NAMES}\\s*[),]`)
const RAW_JOIN_RE = new RegExp(`(?:leftJoin|innerJoin|rightJoin)\\(\\s*${SOFT_TABLE_NAMES}\\s*[),]`)
const ALIAS_RE = new RegExp(`alias\\(\\s*${SOFT_TABLE_NAMES}\\b`)

// This regex — not MEETING_CHILD_TABLES in live.ts, which only ever reaches an
// error message — is the actual enforcement, and it can only see a table named
// here as a LITERAL. meetingApps was added to both in the commit that created
// the table, before its first reader existed.
const CHILD_TABLE_NAMES = '(meetingAttendees|meetingAiNotes|meetingFollowups|meetingSpeakers|meetingTaskSuggestions|meetingRecordingSegments|meetingApps)'
const CHILD_FROM_RE = new RegExp(`\\.from\\(\\s*${CHILD_TABLE_NAMES}\\s*[),]`)
// Joins and alias() are read forms too. Check 1 has always had a join regex
// for the soft tables; check 3 had only `.from(`, so
// `.innerJoin(meetingAttendees, …)` in a file with no liveMeetings — the
// exact shape sub-project A's co-attendance query will take — went
// undetected, and `alias(meetingAttendees, 'a')` (how a self-join on a child
// table has to be written) was invisible to every check in this file.
const CHILD_JOIN_RE = new RegExp(`(?:leftJoin|innerJoin|rightJoin)\\(\\s*${CHILD_TABLE_NAMES}\\s*[),]`)
const CHILD_ALIAS_RE = new RegExp(`alias\\(\\s*${CHILD_TABLE_NAMES}\\b`)

/** Any read form — .from / *Join / alias — of a meeting child table. */
function readsChildTable(text: string): boolean {
  return CHILD_FROM_RE.test(text) || CHILD_JOIN_RE.test(text) || CHILD_ALIAS_RE.test(text)
}

// Check 1 -------------------------------------------------------------------

describe('check 1: raw .from()/join() reads of a soft-deleted table', () => {
  const offenders = entries.filter(
    (e) => !allowlistSet.has(e.relPath) && (RAW_FROM_RE.test(e.text) || RAW_JOIN_RE.test(e.text)),
  )

  // A describe() whose only test is it.each(offenders) registers ZERO tests
  // once offenders is empty, and vitest fails the whole FILE with "No test
  // found in suite" — so a fully-converted check could never show green.
  // Registering one explicit passing test for the empty case keeps every
  // offender message verbatim (Task 4's conversion worklist) while letting
  // this check actually reach PASS.
  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders.map((o) => o.relPath)).toEqual([])
    })
  } else {
    it.each(offenders)('$relPath', ({ relPath }) => {
      throw new Error(
        `${relPath}: reads meetings/tasks/sprints/meetingNoteSegments/meetingScreenshots directly via `
        + `.from()/leftJoin()/innerJoin()/rightJoin(). Use liveMeetings/liveTasks/liveSprints/`
        + `liveNoteSegments/liveScreenshots from '@/db/live' instead (or liveMeetingsAs(name)/etc. if the `
        + `query needs a second reference). If this is a genuine, reviewed exception, add '${relPath}' to `
        + 'ALLOWLIST in src/db/live.test.ts with a // why comment.',
      )
    })
  }
})

// Check 2 -------------------------------------------------------------------

// alias() of a CHILD table is deliberately NOT banned here: unlike the five
// soft tables (which always have a live subquery to alias instead), a child
// table has no deletedAt of its own, so aliasing it is fine as long as the
// statement names its liveness source. That conditional rule is check 3's,
// and CHILD_ALIAS_RE is applied there.
describe('check 2: alias() of a soft-deleted table', () => {
  const offenders = entries.filter((e) => !allowlistSet.has(e.relPath) && ALIAS_RE.test(e.text))

  // See check 1's comment: registers one passing test for the empty case so
  // this check can reach PASS instead of vitest failing the file with
  // "No test found in suite" once offenders is empty.
  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders.map((o) => o.relPath)).toEqual([])
    })
  } else {
    it.each(offenders)('$relPath', ({ relPath }) => {
      throw new Error(
        `${relPath}: calls alias() directly on meetings/tasks/sprints/meetingNoteSegments/meetingScreenshots. `
        + "Alias the live subquery instead — e.g. liveTasksAs('some_name') from '@/db/live' — so a self-join "
        + "or multi-reference still excludes soft-deleted rows. If this is a genuine, reviewed exception, add "
        + `'${relPath}' to ALLOWLIST in src/db/live.test.ts with a // why comment.`,
      )
    })
  }
})

// Check 3 -------------------------------------------------------------------

// KNOWN LIMITATION, stated rather than silently lived with: the liveness
// test below is FILE-scoped (`!e.text.includes('liveMeetings')`), not
// statement-scoped. One liveMeetings reference anywhere in a 2600-line file
// like ai-actions.ts exempts every child-table read in it.
//
// Deliberately not tightened: most child reads in that file are gated rather
// than joined — they sit after a `canManageMeeting(id)` / `canReadMeetingIntel`
// call which resolves the meeting through liveMeetings and returns null for a
// trashed one, so the read never runs. A statement-scoped check would flag
// all of those as offenders, and the only way to quiet them would be a large
// allowlist, i.e. converting a real check back into convention.
//
// What this still catches, which is the case that matters: a NEW file (a
// sub-project A recommender, a transcript search) that reads a child table
// without naming any liveness source at all. What it does not catch: a new
// ungated read added inside an existing file that already mentions
// liveMeetings. Reviewing new queries in meetings/ai-actions.ts by hand
// remains necessary.
describe('check 3: meeting child table read without joining liveMeetings', () => {
  const offenders = entries.filter(
    (e) => !allowlistSet.has(e.relPath) && readsChildTable(e.text) && !e.text.includes('liveMeetings'),
  )

  // See check 1's comment: registers one passing test for the empty case so
  // this check can reach PASS instead of vitest failing the file with
  // "No test found in suite" once offenders is empty.
  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders.map((o) => o.relPath)).toEqual([])
    })
  } else {
    it.each(offenders)('$relPath', ({ relPath }) => {
      throw new Error(
        `${relPath}: reads a meeting child table (${MEETING_CHILD_TABLES.join(', ')}) via .from()/leftJoin()/`
        + 'innerJoin()/rightJoin()/alias() without '
        + 'also importing/using liveMeetings from \'@/db/live\'. A trashed meeting\'s children are '
        + 'live-iff-the-meeting-is-live (no deletedAt of their own) — join against liveMeetings (e.g. '
        + '.innerJoin(liveMeetings, eq(child.meetingId, liveMeetings.id))) so children of a soft-deleted '
        + `meeting stop being readable. If this is a genuine, reviewed exception, add '${relPath}' to `
        + 'ALLOWLIST in src/db/live.test.ts with a // why comment.',
      )
    })
  }
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
  // why: the permanent-purge actions — the one place a soft-deleted table is
  // legitimately hard-deleted.
  'src/features/admin/trash-actions.ts',
])

// file -> the function (or functions) whose body may hard-delete; matches
// elsewhere in the same file are still offenders (this is deliberately narrower
// than a file-level allowlist).
//
// The value became `string | readonly string[]` when meeting_apps arrived:
// meetings/actions.ts had spent its single slot on updateMeeting, and
// setMeetingApps needs the same never-soft hard delete from the other entry
// point. Widening to a FILE allowlist instead would have converted a real
// check back into convention — every remaining db.delete( in these files is
// still an offender.
const DELETE_ALLOWED_FUNCTIONS: Readonly<Record<string, string | readonly string[]>> = {
  // An access key, exactly like webauthn_credentials. Revocation must be
  // absolute: a restorable grant is a key that can come back from the dead,
  // and "we thought we removed that client's access" is not a sentence
  // anyone wants to say.
  'src/features/admin/app-grant-actions.ts': 'revokeAppGrant',
  // The same deliberate hard delete removeAssignment already performs, for
  // the same reason: assignments is NOT a soft-deleted table (a deletedAt
  // would break assignments_user_app_idx and make every capacity query
  // over-count), and its history lives in assignment_history tombstones
  // rather than in the row. A handover reassigns an allocation; it does not
  // trash it.
  'src/features/people/handover-actions.ts': 'applyHandover',
  // Verified by reading the file: every db.delete() in admin/actions.ts
  // today lives inside clearTestData (the ENABLE_DB_CLEAR-gated dev tool).
  'src/features/admin/actions.ts': 'clearTestData',
  // Verified by reading the file: deleteGeminiKey is the real, current
  // location of the Gemini-key hard delete (a multi-line `db\n  .delete(...)`
  // chain, which is why the regex above tolerates whitespace/newlines
  // between `db` and `.delete(`).
  'src/features/gemini/actions.ts': 'deleteGeminiKey',
  // why: the decision row IS the suppression. `meeting_load_decisions` records
  // that somebody dismissed a suggestion, and the renderer filters live
  // suggestions against those keys — so marking one deleted and leaving it in
  // place would suppress the suggestion forever, which is the exact opposite
  // of reopening it. There is also nothing to preserve: open suggestions are
  // never stored, and the sweep re-derives this one from live rows the moment
  // the row is gone. Admin-only, and the only path back from a dismissal.
  'src/features/meetings/load-actions.ts': 'reopenLoadDecision',
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

  // The four below all delete rows in tables that are NOT soft-deletable —
  // verified against SOFT_TABLES above and against schema.ts, where none of
  // meeting_attendees, meeting_ai_notes, meeting_followups or sprint_checkins
  // carries a deletedAt column. This check greps a FILE for `db.delete(`
  // without knowing which table it targets, so a legitimate hard delete of a
  // never-soft table reads as a violation; naming the one function keeps the
  // rest of each file under the check.

  // why: attendee AND project reconciliation. Editing a meeting writes only the
  // added and removed rows so untouched attendees keep their RSVPs, and
  // "removed from the meeting" has no soft state to be in — the row's absence
  // IS the fact. meeting_apps (verified in schema.ts: no deletedAt column) is
  // the identical case for a project, reconciled the same way by updateMeeting
  // and by the one-control setMeetingApps.
  'src/features/meetings/actions.ts': ['updateMeeting', 'setMeetingApps'],

  // why: the same hard delete of the same never-soft table, reached from the
  // per-attendee control rather than the edit form. Nothing is lost by it —
  // meeting_attendee_history keeps the interval this person was on the
  // meeting for, plus a 'removed' tombstone carrying the RSVP they had, so
  // "who was on this meeting on date X" still answers correctly afterwards.
  'src/features/meetings/rsvp-actions.ts': 'removeMeetingAttendee',

  // why: clearMeetingAiNotes drops the generated write-up (meeting_ai_notes)
  // and the follow-ups this meeting raised (meeting_followups), both
  // rebuildable from the transcript that survives. The typed note segments it
  // used to hard-delete alongside them are soft-deleted now — that is a real
  // meeting_note_segments UPDATE in the same function, not an exemption.
  'src/features/meetings/ai-actions.ts': 'clearMeetingAiNotes',

  // why: an admin stopping a follow-up from carrying forward. meeting_followups
  // is generated from the meeting and regenerable by re-running the analysis,
  // so it is deliberately outside the trash.
  'src/features/meetings/followup-move-actions.ts': 'deleteFollowup',

  // why: removing a passkey is a security statement — "this device is gone"
  // — and must be absolute. webauthn_credentials has no deletedAt (verified
  // in schema.ts); a restorable credential in an admin Trash would be a key
  // that can come back from the dead. Scoped to the caller's own rows.
  'src/features/auth/webauthn-actions.ts': 'deletePasskey',

  // why: clearing a check-in is not the same as checking in at 0%. 0% is an
  // answer, absence is the lack of one, and the prep table renders them
  // differently — so the row has to be removable, not markable.
  'src/features/sprints/checkin-actions.ts': 'deleteSprintCheckin',
}

/**
 * Index of a function's BODY `{`, given the index of its parameter list's `(`.
 *
 * Not `text.indexOf('{', declEnd)`, and the difference is the whole point. A
 * signature like
 *
 *   export async function updateMeeting(
 *     input: unknown,
 *   ): Promise<ActionResult<{ meetingId: string; calendarWarning?: string }>> {
 *
 * puts a `{` in the RETURN TYPE. Taking the first one makes functionSpan
 * brace-match that type literal and report a span ending a hundred lines
 * before the body starts — so every db.delete() in the function stays an
 * offender no matter what DELETE_ALLOWED_FUNCTIONS says, and the exemption
 * silently does nothing. Destructured parameters (`function f({ a, b }: T)`)
 * fail the same way.
 *
 * So: walk past the balanced parameter list first, then take the first `{`
 * that is not nested inside angle brackets.
 */
function bodyBraceIndex(text: string, parenOpen: number): number {
  let depth = 0
  let i = parenOpen
  for (; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1
    else if (text[i] === ')') {
      depth -= 1
      if (depth === 0) {
        i += 1
        break
      }
    }
  }
  if (depth !== 0) return -1

  let angle = 0
  for (; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '<') angle += 1
    else if (ch === '>') {
      // `=>` inside a return type is not a closing angle bracket.
      if (text[i - 1] !== '=') angle = Math.max(0, angle - 1)
    } else if (ch === '{' && angle === 0) return i
  }
  return -1
}

/** Byte offsets [start, end) of `function <name>(` ... matching `}`, or null. */
function functionSpan(text: string, functionName: string): [number, number] | null {
  const decl = new RegExp(`function\\s+${functionName}\\s*\\(`).exec(text)
  if (!decl) return null
  const braceStart = bodyBraceIndex(text, decl.index + decl[0].length - 1)
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

  const allowed = DELETE_ALLOWED_FUNCTIONS[entry.relPath]
  if (allowed) {
    // The UNION of the named functions' spans. Resolving only the first name
    // would silently un-exempt every later one, which is the failure mode a
    // single-string value had no way to express at all.
    const spans = (typeof allowed === 'string' ? [allowed] : allowed)
      .map((name) => functionSpan(entry.text, name))
      .filter((span): span is [number, number] => span !== null)
    if (spans.length > 0) {
      return matches.filter((i) => !spans.some(([start, end]) => i >= start && i < end))
    }
  }
  return matches
}

describe('check 4: db.delete(...) confined to trash/cleanup/key-revoke sites', () => {
  const offenders = entries.filter((e) => check4MatchIndexes(e).length > 0)

  // See check 1's comment: registers one passing test for the empty case so
  // this check can reach PASS instead of vitest failing the file with
  // "No test found in suite" once offenders is empty.
  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders.map((o) => o.relPath)).toEqual([])
    })
  } else {
    it.each(offenders)('$relPath', ({ relPath }) => {
      throw new Error(
        `${relPath}: calls db.delete(...) outside the allowed sites (src/features/admin/trash-actions.ts, `
        + "clearTestData in src/features/admin/actions.ts, deleteGeminiKey in src/features/gemini/actions.ts, "
        + 'or a scripts/ file). A soft-deleted table must be marked deleted (set deletedAt/deletedBy) instead '
        + `of hard-deleted — see src/db/live.ts. (${relPath})`,
      )
    })
  }
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

  // See check 1's comment: registers one passing test for the empty case so
  // this doesn't fail the file with "No test found in suite" once nothing is
  // missing (as it already isn't today).
  if (missing.length === 0) {
    it('no missing tables', () => {
      expect(missing.map((m) => m.exportName)).toEqual([])
    })
  } else {
    it.each(missing)('schema.$exportName ($sqlName) is missing from SOFT_TABLES', ({ exportName, sqlName }) => {
      throw new Error(
        `schema.${exportName} (SQL table "${sqlName}") has a deletedAt column but is not registered in `
        + `SOFT_TABLES in src/db/live.ts. Add a liveOf(${exportName}, 'live_${sqlName}') export plus a `
        + 'matching SOFT_TABLES entry, the same way meetings/tasks/sprints/meetingNoteSegments/'
        + 'meetingScreenshots are wired up.',
      )
    })
  }

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

  // See check 1's comment: registers one passing test for the empty case so
  // this check can reach PASS instead of vitest failing the file with
  // "No test found in suite" once offenders is empty.
  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders.map((o) => o.relPath)).toEqual([])
    })
  } else {
    it.each(offenders)('$relPath', ({ relPath }) => {
      throw new Error(
        `${relPath}: uses isNull(...sprintId) (the "task has no sprint = backlog" predicate) outside `
        + `${BACKLOG_PATH}. Move this predicate into a shared helper exported from backlog.ts and import it `
        + 'here instead of reimplementing it inline, so the backlog definition stays in one place as it picks '
        + 'up the soft-delete filter.',
      )
    })
  }
})

// Check 7 ---------------------------------------------------------------
//
// The legacy-notes probe must keep being CALLED, not merely keep existing.
//
// getMeetingNoteTimeline decides whether to fall back to the old
// `meetings.notes` blob by asking whether typed segments EVER existed. That
// question has to be asked of the RAW table: through liveNoteSegments,
// trashing the last segment makes the answer "never existed" and the legacy
// blob comes back from the dead — content the author had already replaced.
//
// The other checks do not cover this. `allowlist hygiene` asserts the probe's
// FILE exists; checks 1-3 assert that reads go through live*. Neither notices
// if someone keeps legacy-notes.ts on disk while deleting the calls to it and
// converting getMeetingNoteTimeline to live* uniformly — which is exactly the
// resolution a merge conflict invites, because those call sites sit inside the
// hunks that conflict. File present, scan satisfied, bug silently shipped.
describe('check 7: the legacy-notes probe is still called', () => {
  const CALLER = 'src/features/meetings/ai-actions.ts'
  const PROBE = 'haveNoteSegmentsEverExisted'
  const caller = entries.find((e) => e.relPath === CALLER)

  it(`${CALLER} imports and calls ${PROBE}`, () => {
    expect(caller, `${CALLER} not found — update this check if the file moved`).toBeDefined()
    const occurrences = caller!.text.split(PROBE).length - 1
    // One import plus at least one call. Two call sites exist today (the
    // timeline fallback and addTypedNoteSegment), so requiring >= 2 total
    // means deleting every call fails even if the import lingers.
    expect(
      occurrences,
      `${CALLER} must import AND call ${PROBE} (from @/features/meetings/legacy-notes). `
      + 'That probe reads the raw meeting_note_segments table on purpose: asking it through '
      + 'liveNoteSegments would make a trashed last segment look like "no segments ever existed", '
      + 'resurrecting the legacy meetings.notes blob. If you are resolving a merge conflict here, '
      + 'keep the probe raw and keep these calls.',
    ).toBeGreaterThanOrEqual(2)
  })
})
