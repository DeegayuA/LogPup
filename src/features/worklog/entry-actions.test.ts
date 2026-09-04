import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { worklogEntries } from '@/db/schema'
import { liveTasks, liveWorklogEntries } from '@/db/live'

/**
 * The write path for one person's own hours, at the ACTION boundary.
 *
 * entry-actions.ts carries three guarantees in its header comment and had no
 * test file at all, so all three were prose:
 *
 *   1. WRITES ARE SELF-ONLY. Not "there is no UI for it" — the statements
 *      themselves are scoped by the signed-in user, which is what makes a
 *      guessed row id inert rather than merely unlikely. Checks 1-4 render the
 *      ACTUAL where-clause SQL each statement runs with (via QueryBuilder,
 *      connection-free — same technique as src/db/live.test.ts and
 *      sprints/actions.test.ts) rather than trusting a mocked result, so a
 *      regression that drops `eq(userId, actor.id)` fails here even though the
 *      mock would happily return a row anyway.
 *   2. THE CATEGORY/TASK RULE IS A RULE, not a form's opinion. "A rule that
 *      only holds on create is not a rule" is the comment on updateWorklogEntry
 *      itself; checks 5-9 hold both actions to it, and pin that a task entry's
 *      project is derived from the TASK and never from the caller.
 *   3. NOBODY ON APPROVED LEAVE IS TOLD THEY ARE SHORT ON HOURS. The last two
 *      checks run the real absence -> zero-denominator -> silence chain end to
 *      end, with only the database reads mocked.
 *
 * Same mocked-action idiom as src/features/gemini/actions.test.ts and
 * src/features/worklog/absence-actions.test.ts: chainable db stubs, then
 * `await import` the modules under test.
 */

const {
  actorMock,
  canMock,
  logActivityMock,
  callGeminiMock,
  getAiPrefsMock,
  aiDisabledMock,
  resolveChainMock,
  sessionUserMock,
  approvedAbsenceDaysMock,
  workScheduleMock,
  orgHolidayDaysMock,
  joinDayMock,
  commitEvidenceMock,
} = vi.hoisted(() => ({
  actorMock: vi.fn(),
  canMock: vi.fn(),
  logActivityMock: vi.fn(),
  callGeminiMock: vi.fn(),
  getAiPrefsMock: vi.fn(),
  aiDisabledMock: vi.fn(),
  resolveChainMock: vi.fn(),
  sessionUserMock: vi.fn(),
  approvedAbsenceDaysMock: vi.fn(),
  workScheduleMock: vi.fn(),
  orgHolidayDaysMock: vi.fn(),
  joinDayMock: vi.fn(),
  commitEvidenceMock: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('@/features/auth/actor', () => ({ loadActor: actorMock }))
vi.mock('@/features/auth/capabilities', () => ({ can: canMock }))
vi.mock('@/lib/session', () => ({ getSessionUser: sessionUserMock }))

// The AI half of the check is mocked at its edges only. `findDiscrepancies`,
// `toCheckEvidence`, `loadDayEvidence` and the whole coverage/schedule ladder
// underneath them stay REAL — they are what the last two checks are about.
vi.mock('@/features/gemini/client', () => ({
  callGemini: callGeminiMock,
  GeminiError: class GeminiError extends Error {},
}))
vi.mock('@/features/gemini/model-choice', () => ({ resolveChain: resolveChainMock }))
vi.mock('@/features/gemini/prefs', () => ({
  getAiPrefs: getAiPrefsMock,
  aiFeatureDisabledMessage: aiDisabledMock,
}))
vi.mock('@/features/worklog/absence-queries', () => ({
  approvedAbsenceDays: approvedAbsenceDaysMock,
}))
vi.mock('@/features/worklog/queries', () => ({
  getMyWorkSchedule: workScheduleMock,
  getOrgHolidayDays: orgHolidayDaysMock,
  getUserJoinDay: joinDayMock,
}))
vi.mock('@/features/github/evidence', () => ({ commitEvidenceFor: commitEvidenceMock }))

// --- the database stub ------------------------------------------------------

type Row = Record<string, unknown>

/** Rows each `.from(<table>)` read resolves to. Anything unlisted reads empty. */
let rowsByTable = new Map<unknown, Row[]>()

const selectCalls: { table: unknown; where: unknown }[] = []
const updateCalls: { table: unknown; values: Row; where: unknown }[] = []
const insertCalls: { table: unknown; values: Row }[] = []

/**
 * One chainable node standing in for a drizzle select.
 *
 * Every builder method returns the node itself and the node is thenable, so a
 * `.from().where()`, a `.from().where().limit(1)` and a
 * `.from().leftJoin().where().orderBy()` all resolve to the same rows — the
 * five shapes these two modules actually write, without the stub having to
 * know which is which.
 */
type SelectNode = {
  innerJoin: () => SelectNode
  leftJoin: () => SelectNode
  where: (condition: unknown) => SelectNode
  orderBy: () => SelectNode
  limit: () => SelectNode
  then: (onOk: (rows: Row[]) => unknown, onFail?: (error: unknown) => unknown) => Promise<unknown>
}

function selectNode(table: unknown): SelectNode {
  const node: SelectNode = {
    innerJoin: () => node,
    leftJoin: () => node,
    where: (condition: unknown) => {
      selectCalls.push({ table, where: condition })
      return node
    },
    orderBy: () => node,
    limit: () => node,
    then: (onOk, onFail) => Promise.resolve(rowsByTable.get(table) ?? []).then(onOk, onFail),
  }
  return node
}

vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: (table: unknown) => selectNode(table) }),
    selectDistinct: () => ({ from: (table: unknown) => selectNode(table) }),
    update: (table: unknown) => ({
      set: (values: Row) => ({
        where: (condition: unknown) => {
          updateCalls.push({ table, values, where: condition })
          return {
            then: (onOk: (value: unknown) => unknown) => Promise.resolve(undefined).then(onOk),
            returning: async () => [],
          }
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Row) => {
        insertCalls.push({ table, values })
        return {
          then: (onOk: (value: unknown) => unknown) => Promise.resolve(undefined).then(onOk),
          returning: async () => [{ id: NEW_ENTRY }],
        }
      },
    }),
  },
}))

const { createWorklogEntry, updateWorklogEntry } = await import('./entry-actions')
const { checkWorklogEntries } = await import('./entry-ai-actions')

// --- the cast ---------------------------------------------------------------

const ME = '11111111-1111-4111-8111-111111111111'
const SOMEBODY_ELSE = '22222222-2222-4222-8222-222222222222'
const ENTRY = '33333333-3333-4333-8333-333333333333'
const NEW_ENTRY = '44444444-4444-4444-8444-444444444444'
const TASK = '55555555-5555-4555-8555-555555555555'
/** The project the TASK is on — what the server derives. */
const TASKS_APP = '66666666-6666-4666-8666-666666666666'
/** The project a caller claims — what the server must ignore. */
const CLAIMED_APP = '77777777-7777-4777-8777-777777777777'

const PAST_DAY = '2024-01-15'

/**
 * The where-clause of a statement, rendered to the SQL it would really run.
 *
 * Two helpers rather than one generic: drizzle's `.from()` is a conditional
 * type, and the READ goes through the `live_worklog_entries` subquery while the
 * WRITE goes through the raw table, so their column references only render
 * against their own source.
 */
function readWhereSql(condition: unknown) {
  const query = new QueryBuilder().select().from(liveWorklogEntries)
  return query.where(condition as Parameters<typeof query.where>[0]).toSQL()
}

function writeWhereSql(condition: unknown) {
  const query = new QueryBuilder().select().from(worklogEntries)
  return query.where(condition as Parameters<typeof query.where>[0]).toSQL()
}

beforeEach(() => {
  rowsByTable = new Map()
  selectCalls.length = 0
  updateCalls.length = 0
  insertCalls.length = 0

  actorMock.mockReset()
  actorMock.mockResolvedValue({ id: ME })
  canMock.mockReset()
  canMock.mockReturnValue(true)
  logActivityMock.mockReset()
  sessionUserMock.mockReset()
  sessionUserMock.mockResolvedValue({ name: 'Nimal' })

  aiDisabledMock.mockReset()
  aiDisabledMock.mockResolvedValue(null)
  getAiPrefsMock.mockReset()
  getAiPrefsMock.mockResolvedValue({ 'worklog-entries-check': { enabled: true, model: null } })
  resolveChainMock.mockReset()
  resolveChainMock.mockReturnValue(['gemini-test'])
  // The phrasing call FAILS in every case here. That is not a shortcut: the
  // computed sentences are real product copy and a failed call must cost the
  // wording and nothing else, so making it fail is how these checks assert on
  // what `findDiscrepancies` actually decided rather than on a stubbed reply.
  callGeminiMock.mockReset()
  callGeminiMock.mockRejectedValue(new Error('no key on file in a test'))

  approvedAbsenceDaysMock.mockReset()
  approvedAbsenceDaysMock.mockResolvedValue(new Set<string>())
  workScheduleMock.mockReset()
  workScheduleMock.mockResolvedValue([])
  orgHolidayDaysMock.mockReset()
  orgHolidayDaysMock.mockResolvedValue([])
  joinDayMock.mockReset()
  joinDayMock.mockResolvedValue('2020-01-01')
  commitEvidenceMock.mockReset()
  commitEvidenceMock.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// 1. Self-only, in the statements rather than in the prose
// ---------------------------------------------------------------------------

describe('updateWorklogEntry: one person cannot edit another person’s hours', () => {
  it('scopes the ownership read AND the write itself to the signed-in user', async () => {
    rowsByTable.set(liveWorklogEntries, [{ id: ENTRY }])

    const res = await updateWorklogEntry({
      id: ENTRY,
      minutes: 190,
      category: 'meeting',
      note: 'Sprint review — 190 minutes, not 90',
    })

    expect(res).toEqual({ ok: true, data: undefined })

    // The read that decides the row exists is scoped to the actor, so a row
    // belonging to somebody else simply is not there to be found. It is the
    // FIRST read the action makes — nothing may look at the row before the
    // predicate that proves it is theirs.
    expect(selectCalls[0].table).toBe(liveWorklogEntries)
    const read = readWhereSql(selectCalls[0].where)
    expect(read.sql.toLowerCase()).toContain('user_id')
    expect(read.params).toEqual([ENTRY, ME])

    /* EVERY read of the entries table is scoped, not just the first.
       This used to be `expect(selectCalls).toHaveLength(1)`, which pinned the
       COUNT rather than the property — so it broke the moment the action grew
       a legitimate second read (syncAutoScore totals the day's minutes to
       derive its score) while saying nothing about whether that read was safe.
       Counting reads was never the guarantee; scoping them is. */
    for (const call of selectCalls) {
      if (call.table !== liveWorklogEntries) continue
      expect(readWhereSql(call.where).sql.toLowerCase()).toContain('user_id')
    }

    // And the write REPEATS it rather than trusting the read. This is the
    // assertion a behaviour test cannot make: with the predicate dropped the
    // mocked update would still succeed and the action would still return ok.
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].table).toBe(worklogEntries)
    const write = writeWhereSql(updateCalls[0].where)
    expect(write.sql.toLowerCase()).toContain('user_id')
    expect(write.params).toEqual([ENTRY, ME])

    expect(updateCalls[0].values).toMatchObject({
      minutes: 190,
      category: 'meeting',
      taskId: null,
      note: 'Sprint review — 190 minutes, not 90',
    })
  })

  it('refuses a row the ownership-scoped read did not return, and writes nothing', async () => {
    // Somebody else's entry, or one already soft-deleted: `liveWorklogEntries`
    // scoped by userId answers with nothing either way, and the action must
    // stop there rather than issue an UPDATE and hope its own predicate saves
    // it.
    rowsByTable.set(liveWorklogEntries, [])

    const res = await updateWorklogEntry({ id: ENTRY, minutes: 60, category: 'admin' })

    expect(res).toEqual({ ok: false, error: 'That entry no longer exists' })
    expect(updateCalls).toEqual([])
  })

  it('has no way to name a subject — a caller-supplied user id is dropped on the floor', async () => {
    rowsByTable.set(liveWorklogEntries, [{ id: ENTRY }])

    const res = await updateWorklogEntry({
      id: ENTRY,
      minutes: 60,
      category: 'admin',
      // @ts-expect-error deliberately off-type: there is no targetUserId on
      // this action and there must never be one. zod strips it; this asserts
      // that it also never reaches a predicate.
      userId: SOMEBODY_ELSE,
    })

    expect(res.ok).toBe(true)
    expect(writeWhereSql(updateCalls[0].where).params).toEqual([ENTRY, ME])
    expect(readWhereSql(selectCalls[0].where).params).not.toContain(SOMEBODY_ELSE)
  })

  it('refuses a caller with no session, and a seat that cannot write a worklog', async () => {
    actorMock.mockResolvedValue(null)
    expect(await updateWorklogEntry({ id: ENTRY, minutes: 60, category: 'admin' }))
      .toEqual({ ok: false, error: 'Not allowed' })

    // Signed in, but stakeholder/auditor: `worklog.write.own` is 'none' for
    // them, so they cannot write even their own.
    actorMock.mockResolvedValue({ id: ME })
    canMock.mockReturnValue(false)
    expect(await updateWorklogEntry({ id: ENTRY, minutes: 60, category: 'admin' }))
      .toEqual({ ok: false, error: 'Not allowed' })

    expect(selectCalls).toEqual([])
    expect(updateCalls).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 2. The category/task rule, at the boundary rather than in the form
// ---------------------------------------------------------------------------

describe('the category/task rule holds on update, not only on create', () => {
  it('refuses a meeting that names a task, before it reads anything', async () => {
    rowsByTable.set(liveWorklogEntries, [{ id: ENTRY }])

    const res = await updateWorklogEntry({
      id: ENTRY,
      minutes: 60,
      category: 'meeting',
      taskId: TASK,
    })

    // The sentence is `validateEntry`'s own, verbatim — the action and the
    // form must not invent two sets of words for one rule.
    expect(res).toEqual({ ok: false, error: 'Only task entries can name a task' })
    // Refused before any database work at all: a rejected body is not worth a
    // round trip, and the ordering is what keeps the message stable.
    expect(selectCalls).toEqual([])
    expect(updateCalls).toEqual([])
  })

  it('refuses a task entry with no task on it', async () => {
    rowsByTable.set(liveWorklogEntries, [{ id: ENTRY }])

    const res = await updateWorklogEntry({ id: ENTRY, minutes: 60, category: 'task' })

    expect(res).toEqual({ ok: false, error: 'Pick the task that time went to' })
    expect(updateCalls).toEqual([])
  })

  it('refuses both combinations on create too, so neither boundary is the lenient one', async () => {
    expect(
      await createWorklogEntry({ day: PAST_DAY, minutes: 60, category: 'admin', taskId: TASK }),
    ).toEqual({ ok: false, error: 'Only task entries can name a task' })

    expect(await createWorklogEntry({ day: PAST_DAY, minutes: 60, category: 'task' }))
      .toEqual({ ok: false, error: 'Pick the task that time went to' })

    expect(insertCalls).toEqual([])
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('takes a task entry’s project from the TASK and ignores the one the caller sent', async () => {
    rowsByTable.set(liveTasks, [{ appId: TASKS_APP }])
    rowsByTable.set(liveWorklogEntries, [{ id: ENTRY }])

    const res = await updateWorklogEntry({
      id: ENTRY,
      minutes: 120,
      category: 'task',
      taskId: TASK,
      appId: CLAIMED_APP,
      billable: true,
    })

    expect(res.ok).toBe(true)
    // Forged or merely stale, the client's answer never lands: otherwise
    // somebody's hours could be filed against a project their task is not on,
    // with nothing in the row to contradict it.
    expect(updateCalls[0].values).toMatchObject({
      appId: TASKS_APP,
      taskId: TASK,
      billable: true,
      minutes: 120,
    })
    expect(updateCalls[0].values.appId).not.toBe(CLAIMED_APP)
  })

  it('SAVES a task entry that sends no project, which is what the form sends', async () => {
    /*
     * THE REGRESSION. Every task-category entry in the product failed with
     * "That task is not linked to a project" and no task entry could be saved
     * at all.
     *
     * entry-form.ts deliberately sends appId: null for a task entry, because
     * resolveEntryAppId derives the project from the task server-side. But
     * validateEntry ran FIRST, on that pre-resolution input, with its default
     * requireAppForTask: true — so it refused the row before the code that
     * would have supplied the project ever ran.
     *
     * Every pure test of validateEntry passed throughout, because in isolation
     * the rule is correct. Only the ORDER was wrong, and only an action-level
     * test can see an order. That is why this one sends appId exactly as the
     * form does rather than the CLAIMED_APP the test above uses.
     */
    rowsByTable.set(liveTasks, [{ appId: TASKS_APP }])
    rowsByTable.set(liveWorklogEntries, [{ id: ENTRY }])

    const res = await createWorklogEntry({
      day: PAST_DAY,
      minutes: 90,
      category: 'task',
      taskId: TASK,
      appId: null,
      billable: true,
    })

    expect(res.ok).toBe(true)
    expect(insertCalls[0].values).toMatchObject({ appId: TASKS_APP, taskId: TASK, minutes: 90 })
  })

  it('refuses a task that is only invisible because it was trashed', async () => {
    // Read raw, a soft-deleted task comes back live and the hours get filed
    // against work somebody deliberately removed. The read goes through the
    // LIVE subquery, so "no rows" is the trashed case as well as the never-
    // existed one — and both deserve the same sentence.
    rowsByTable.set(liveTasks, [])

    const res = await updateWorklogEntry({
      id: ENTRY,
      minutes: 60,
      category: 'task',
      taskId: TASK,
      // A project the caller has no business supplying, sent on purpose: this
      // case is about the TASK being gone, and the claimed project must not
      // rescue it. (An earlier draft of this comment said a project "has to be
      // on the body to reach the derivation at all" — that was true only
      // because of the ordering bug the test above now pins, and is not a rule.)
      appId: CLAIMED_APP,
    })

    expect(res).toEqual({ ok: false, error: 'That task no longer exists' })
    expect(selectCalls[0].table).toBe(liveTasks)
    expect(updateCalls).toEqual([])
  })

  it('an update carries the WHOLE body, so switching kind clears the old task', async () => {
    // The reason updateWorklogEntry takes no patch: a partial write could set
    // category to 'meeting' and leave the task behind, which is exactly the
    // state the rule exists to prevent.
    rowsByTable.set(liveWorklogEntries, [{ id: ENTRY }])

    const res = await updateWorklogEntry({
      id: ENTRY,
      minutes: 45,
      category: 'review',
      appId: CLAIMED_APP,
    })

    expect(res.ok).toBe(true)
    expect(updateCalls[0].values).toMatchObject({
      taskId: null,
      // A non-task entry's project IS the caller's answer, and this one is not
      // derived from anything — the name above is only "claimed" for a task.
      appId: CLAIMED_APP,
      category: 'review',
      billable: false,
      note: null,
    })
  })
})

describe('createWorklogEntry: what reaches the team-wide activity feed', () => {
  it('names the day and never the note', async () => {
    const res = await createWorklogEntry({
      day: PAST_DAY,
      minutes: 90,
      category: 'support',
      note: 'Debugged the payroll import with Amara — she was upset about it',
    })

    expect(res).toEqual({ ok: true, data: { id: NEW_ENTRY } })
    expect(logActivityMock).toHaveBeenCalledTimes(1)
    const logged = logActivityMock.mock.calls[0][0]
    // entityId is the AUTHOR, not the row: the feed links to that person's log.
    expect(logged).toMatchObject({
      actorId: ME,
      entityType: 'worklog',
      entityId: ME,
      entityLabel: `Time entry for ${PAST_DAY}`,
    })
    // THE NOTE IS THE WHOLE POINT OF THIS CHECK. The feed is read by everyone;
    // the note is what somebody wrote about their own day.
    expect(logged.metadata).toEqual({
      day: PAST_DAY,
      minutes: 90,
      category: 'support',
      source: 'manual',
    })
    expect(JSON.stringify(logged)).not.toContain('Amara')
  })

  it('refuses a day that has not happened yet', async () => {
    const res = await createWorklogEntry({ day: '2999-01-01', minutes: 60, category: 'admin' })
    expect(res).toEqual({ ok: false, error: 'That day has not happened yet' })
    expect(insertCalls).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 3. Nobody on approved leave is told they are short on hours
// ---------------------------------------------------------------------------

/**
 * These two run the REAL chain — `loadDayEvidence` -> `scheduledMinutesFor` ->
 * `computeCoverage` -> `toCheckEvidence` -> `findDiscrepancies` — with only the
 * database reads and the phrasing call replaced. That is the point: the
 * exemption lives in one line of entry-evidence.ts and the silence it buys is
 * three modules away, so a test that mocked the middle would prove nothing.
 */
describe('checkWorklogEntries on a day the studio had agreed was not worked', () => {
  /** A Monday: a full 8-hour day unless something exempts it. */
  const DAY = '2024-01-15'

  /** One hour of admin: somebody who dipped in briefly. */
  function oneHourOfAdmin() {
    rowsByTable.set(liveWorklogEntries, [
      { id: ENTRY, minutes: 60, category: 'admin', taskId: null, taskTitle: null },
    ])
  }

  it('says nothing, and asks no model, when an approved absence covers the day', async () => {
    approvedAbsenceDaysMock.mockResolvedValue(new Set([DAY]))
    oneHourOfAdmin()

    const res = await checkWorklogEntries(DAY)

    // Not "a gentler sentence" — NO SENTENCE. An approved absence folds the
    // day's scheduled minutes to 0, and a zero denominator makes both schedule
    // comparisons skip rather than divide.
    expect(res).toEqual({ ok: true, data: { observations: [], phrased: false } })
    // Zero observations means zero model calls: the short circuit fires before
    // prefs are read, so silence costs no request and no ledger row.
    expect(callGeminiMock).not.toHaveBeenCalled()
  })

  it('a PENDING absence exempts nothing — only an approved one does', async () => {
    // approvedAbsenceDays returns approved rows only, so a pending request is
    // simply absent from the set. Filing one cannot lower the filer's own
    // denominator, which is what stops the exemption being self-served.
    approvedAbsenceDaysMock.mockResolvedValue(new Set<string>())
    oneHourOfAdmin()

    const res = await checkWorklogEntries(DAY)

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.observations.map((o) => o.kind)).toEqual(['under-scheduled'])
  })

  it('the same hour on the same day, with no absence, DOES produce the short-day note', async () => {
    // The contrast case, and the reason the first check is not vacuous: this
    // day is loud, and the absence is the only thing that silences it.
    oneHourOfAdmin()

    const res = await checkWorklogEntries(DAY)

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.observations).toHaveLength(1)
    const [observation] = res.data.observations
    expect(observation.kind).toBe('under-scheduled')
    expect(observation.severity).toBe('note')
    expect(observation.message).toBe(
      'That day accounts for 1 hour, against 8 hours scheduled.',
    )
    expect(observation.facts).toEqual({
      loggedMinutes: 60,
      scheduledMinutes: 480,
      differenceMinutes: 420,
    })
    // The phrasing call failed, and the computed sentence survived it intact:
    // a phrasing outage must not turn into the app quietly deciding not to
    // mention something it noticed.
    expect(res.data.phrased).toBe(false)
    expect(callGeminiMock).toHaveBeenCalledTimes(1)
  })

  it('a day with nothing logged is an empty day, not a discrepancy', async () => {
    rowsByTable.set(liveWorklogEntries, [])

    const res = await checkWorklogEntries(DAY)

    expect(res).toEqual({ ok: true, data: { observations: [], phrased: false } })
    // The evidence read is skipped entirely too — no schedule, no meetings, no
    // activity log. Every unopened day would otherwise cost five queries.
    expect(approvedAbsenceDaysMock).not.toHaveBeenCalled()
    expect(callGeminiMock).not.toHaveBeenCalled()
  })
})
