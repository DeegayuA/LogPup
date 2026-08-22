import { describe, expect, it } from 'vitest'
import type { Actor, UserRole } from '@/features/auth/capabilities'
import {
  DAILY_NOTIFICATION_CAP,
  OVERFLOW_HREF,
  applyDailyCap,
  colomboDayWindow,
  dailyCapFor,
  dedupeKeyFor,
  dedupeRowStillBinds,
  mergeSameKey,
  recipientsFor,
  type RecipientCandidate,
} from '@/features/notifications/notify-rules'

/**
 * The two failures these rules exist to prevent are both invisible in review:
 * a dedupe key that looks right and merges two people's ladders, and a cap
 * that looks enforced and drops the sixth event of somebody's day. So every
 * assertion here is by value — real keys, real counts, real dates — and the
 * cap cases assert what happens to the SUPPRESSED events as well as to the
 * ones that land.
 *
 * FRIDAY is a full working day, SATURDAY a half day, SUNDAY off, and
 * WEDNESDAY_HOLIDAY (Milad-un-Nabi) is a mercantile holiday on a midweek day —
 * chosen so the holiday arm is proven by something other than a weekend.
 */
const FRIDAY = '2026-08-21'
const SATURDAY = '2026-08-22'
const SUNDAY = '2026-08-23'
const WEDNESDAY_HOLIDAY = '2026-08-26'

const TASK = '3f1c2b90-0000-4000-8000-000000000001'
const ME = 'user-me'

describe('dedupeKeyFor: permanent ladders', () => {
  it('keys a rung on the date it was armed for, and is permanent', () => {
    expect(
      dedupeKeyFor({ mode: 'ladder', ladder: 'deadline', entityId: TASK, step: 'due_soon', armedOn: '2026-09-01' }),
    ).toEqual({ key: `deadline:${TASK}:due_soon:2026-09-01`, permanent: true })
  })

  it('a repeat tick produces the identical key, so the second run writes nothing', () => {
    const rung = { mode: 'ladder', ladder: 'deadline', entityId: TASK, step: 'overdue', armedOn: '2026-09-01' } as const
    expect(dedupeKeyFor(rung).key).toBe(dedupeKeyFor(rung).key)
  })

  it('a moved due date re-arms the ladder', () => {
    const before = dedupeKeyFor({ mode: 'ladder', ladder: 'deadline', entityId: TASK, step: 'due_soon', armedOn: '2026-09-01' })
    const after = dedupeKeyFor({ mode: 'ladder', ladder: 'deadline', entityId: TASK, step: 'due_soon', armedOn: '2026-09-08' })
    expect(after.key).not.toBe(before.key)
    expect(after.key).toBe(`deadline:${TASK}:due_soon:2026-09-08`)
  })

  it('each rung of one ladder is its own key', () => {
    const key = (step: string) =>
      dedupeKeyFor({ mode: 'ladder', ladder: 'deadline', entityId: TASK, step, armedOn: '2026-09-01' }).key
    expect(new Set([key('due_soon'), key('overdue'), key('breached')]).size).toBe(3)
  })
})

describe('dedupeKeyFor: collapsing entity keys', () => {
  it('collapses on the entity, never the event', () => {
    expect(dedupeKeyFor({ mode: 'entity', entityType: 'task', entityId: TASK, event: 'comment' })).toEqual({
      key: `task:${TASK}:comment`,
      permanent: false,
    })
  })

  it('five comments on one task share one key; a mention on it does not', () => {
    const comment = dedupeKeyFor({ mode: 'entity', entityType: 'task', entityId: TASK, event: 'comment' }).key
    const mention = dedupeKeyFor({ mode: 'entity', entityType: 'task', entityId: TASK, event: 'mention' }).key
    expect(comment).toBe(`task:${TASK}:comment`)
    expect(mention).not.toBe(comment)
  })

  it('the same event on two entities never shares a key', () => {
    const a = dedupeKeyFor({ mode: 'entity', entityType: 'task', entityId: 'task-a', event: 'comment' }).key
    const b = dedupeKeyFor({ mode: 'entity', entityType: 'task', entityId: 'task-b', event: 'comment' }).key
    expect(a).not.toBe(b)
  })
})

describe('dedupeKeyFor: the overflow row', () => {
  it('is one collapsing row per person per day', () => {
    expect(dedupeKeyFor({ mode: 'overflow', userId: ME, dayIso: FRIDAY })).toEqual({
      key: `notif:overflow:${ME}:${FRIDAY}`,
      permanent: false,
    })
  })

  it('yesterday and today are different rows', () => {
    const today = dedupeKeyFor({ mode: 'overflow', userId: ME, dayIso: FRIDAY }).key
    const yesterday = dedupeKeyFor({ mode: 'overflow', userId: ME, dayIso: '2026-08-20' }).key
    expect(today).not.toBe(yesterday)
  })

  it('refuses a segment carrying the separator, rather than minting an ambiguous key', () => {
    expect(() => dedupeKeyFor({ mode: 'entity', entityType: 'task', entityId: 'a:b', event: 'comment' })).toThrow(
      /entityId/,
    )
  })
})

describe('dedupeRowStillBinds: which existing row an event collapses into', () => {
  it('a permanent row binds forever, read or not', () => {
    expect(dedupeRowStillBinds({ permanent: true, read: true, dismissed: true })).toBe(true)
  })

  it('an unread, undismissed collapsing row still counts up', () => {
    expect(dedupeRowStillBinds({ permanent: false, read: false, dismissed: false })).toBe(true)
  })

  it('the counter resets once it has been read: the next event opens a fresh row', () => {
    expect(dedupeRowStillBinds({ permanent: false, read: true, dismissed: false })).toBe(false)
  })

  it('and once it has been dismissed', () => {
    expect(dedupeRowStillBinds({ permanent: false, read: false, dismissed: true })).toBe(false)
  })
})

describe('mergeSameKey', () => {
  const row = (userId: string, dedupeKey: string | null, collapseCount = 1, title = '') => ({
    userId,
    dedupeKey,
    collapseCount,
    title,
  })

  it('sums the counts of rows sharing a key, keeping the newest row', () => {
    expect(
      mergeSameKey([
        row(ME, `task:${TASK}:comment`, 1, 'Nuwan commented'),
        row(ME, `task:${TASK}:comment`, 1, 'Amali commented'),
        row(ME, `task:${TASK}:comment`, 1, 'Kasun commented'),
      ]),
    ).toEqual([row(ME, `task:${TASK}:comment`, 3, 'Kasun commented')])
  })

  it('keeps the same key for two different people apart', () => {
    const merged = mergeSameKey([row(ME, 'task:t1:comment'), row('user-two', 'task:t1:comment')])
    expect(merged.map((r) => r.userId)).toEqual([ME, 'user-two'])
    expect(merged.map((r) => r.collapseCount)).toEqual([1, 1])
  })

  it('leaves unkeyed rows alone — a null key never conflicts', () => {
    const rows = [row(ME, null, 1, 'first'), row(ME, null, 1, 'second')]
    expect(mergeSameKey(rows)).toEqual(rows)
  })

  it('adds an already-collapsed count rather than resetting it to one', () => {
    expect(mergeSameKey([row(ME, 'k', 4), row(ME, 'k', 2)])[0].collapseCount).toBe(6)
  })
})

describe('recipientsFor', () => {
  const actor = (id: string, role: UserRole, scope: string[] = []): Actor => ({
    id,
    role,
    scopeAppIds: new Set(scope),
  })

  const candidate = (
    id: string,
    role: UserRole = 'member',
    over: Partial<RecipientCandidate> & { scope?: string[] } = {},
  ): RecipientCandidate => ({
    actor: actor(id, role, over.scope ?? []),
    active: true,
    approved: true,
    ...over,
  })

  it('drops the actor themself — nobody is notified about their own action', () => {
    expect(
      recipientsFor({
        candidates: [candidate(ME), candidate('user-two')],
        actorId: ME,
        visibility: null,
      }),
    ).toEqual(['user-two'])
  })

  it('keeps everyone when the system acted rather than a person', () => {
    expect(
      recipientsFor({ candidates: [candidate(ME), candidate('user-two')], actorId: null, visibility: null }),
    ).toEqual([ME, 'user-two'])
  })

  it('drops a deactivated person', () => {
    expect(
      recipientsFor({ candidates: [candidate('gone', 'member', { active: false })], visibility: null }),
    ).toEqual([])
  })

  it('drops a signup still waiting for approval', () => {
    expect(
      recipientsFor({ candidates: [candidate('pending', 'member', { approved: false })], visibility: null }),
    ).toEqual([])
  })

  it('drops a scoped person the entity is not visible to', () => {
    expect(
      recipientsFor({
        candidates: [candidate('outsider', 'editor', { scope: ['app-other'] })],
        visibility: { action: 'app.view', resource: { appId: 'app-1' } },
      }),
    ).toEqual([])
  })

  it('keeps the same person once the entity is inside their scope', () => {
    expect(
      recipientsFor({
        candidates: [candidate('insider', 'editor', { scope: ['app-1'] })],
        visibility: { action: 'app.view', resource: { appId: 'app-1' } },
      }),
    ).toEqual(['insider'])
  })

  it('drops a seat with no grant on the action at all', () => {
    expect(
      recipientsFor({
        candidates: [candidate('client', 'stakeholder'), candidate('boss', 'admin')],
        visibility: { action: 'worklog.view' },
      }),
    ).toEqual(['boss'])
  })

  it('names each person once, however many times they were mentioned', () => {
    expect(
      recipientsFor({ candidates: [candidate('u1'), candidate('u1'), candidate('u2')], visibility: null }),
    ).toEqual(['u1', 'u2'])
  })
})

describe('dailyCapFor', () => {
  it('is five on a full working day', () => {
    expect(dailyCapFor(FRIDAY)).toBe(DAILY_NOTIFICATION_CAP)
    expect(dailyCapFor(FRIDAY)).toBe(5)
  })

  it('is three on a Saturday half day', () => {
    expect(dailyCapFor(SATURDAY)).toBe(3)
  })

  it('is one on a Sunday — never zero, so a lone fact is still the fact', () => {
    expect(dailyCapFor(SUNDAY)).toBe(1)
  })

  it('is one on a midweek mercantile holiday', () => {
    expect(dailyCapFor(WEDNESDAY_HOLIDAY)).toBe(1)
  })

  it('takes the holiday predicate from the caller when one is given', () => {
    expect(dailyCapFor(FRIDAY, (iso) => iso === FRIDAY)).toBe(1)
  })
})

describe('applyDailyCap', () => {
  const events = (n: number) => Array.from({ length: n }, (_, i) => `event-${i + 1}`)

  it('lets the whole day through when it fits under the cap', () => {
    const out = applyDailyCap({ userId: ME, dayIso: FRIDAY, alreadyToday: 0, candidates: events(5) })
    expect(out.immediate).toEqual(events(5))
    expect(out.suppressed).toEqual([])
    expect(out.overflow).toBeNull()
  })

  it('the fifth row of a day lands normally', () => {
    const out = applyDailyCap({ userId: ME, dayIso: FRIDAY, alreadyToday: 4, candidates: ['event-5'] })
    expect(out.immediate).toEqual(['event-5'])
    expect(out.overflow).toBeNull()
  })

  it('the sixth creates no row of its own and opens one overflow row', () => {
    const out = applyDailyCap({ userId: ME, dayIso: FRIDAY, alreadyToday: 5, candidates: ['event-6'] })
    expect(out.immediate).toEqual([])
    expect(out.suppressed).toEqual(['event-6'])
    expect(out.overflow).toEqual({
      key: `notif:overflow:${ME}:${FRIDAY}`,
      increment: 1,
      params: { count: 1, href: OVERFLOW_HREF },
    })
  })

  it('the seventh increments that row rather than adding another', () => {
    const out = applyDailyCap({
      userId: ME,
      dayIso: FRIDAY,
      alreadyToday: 5,
      overflowSoFar: 1,
      candidates: ['event-7'],
    })
    expect(out.overflow).toEqual({
      key: `notif:overflow:${ME}:${FRIDAY}`,
      increment: 1,
      params: { count: 2, href: OVERFLOW_HREF },
    })
  })

  it('the count equals the number of events actually suppressed, never a dropped one', () => {
    const out = applyDailyCap({ userId: ME, dayIso: FRIDAY, alreadyToday: 0, candidates: events(20) })
    expect(out.immediate).toHaveLength(5)
    expect(out.suppressed).toHaveLength(15)
    expect(out.immediate.length + out.suppressed.length).toBe(20)
    expect(out.overflow?.increment).toBe(15)
    expect(out.overflow?.params.count).toBe(15)
  })

  it('a burst arriving on a day already over the cap is entirely suppressed', () => {
    const out = applyDailyCap({
      userId: ME,
      dayIso: FRIDAY,
      alreadyToday: 9,
      overflowSoFar: 4,
      candidates: events(3),
    })
    expect(out.immediate).toEqual([])
    expect(out.overflow?.params.count).toBe(7)
  })

  it('spends a Saturday half day at three, and collapses the rest', () => {
    const out = applyDailyCap({ userId: ME, dayIso: SATURDAY, alreadyToday: 0, candidates: events(4) })
    expect(out.immediate).toEqual(events(3))
    expect(out.overflow?.key).toBe(`notif:overflow:${ME}:${SATURDAY}`)
    expect(out.overflow?.params.count).toBe(1)
  })

  it('lets one Sunday notification through and collapses the rest', () => {
    const out = applyDailyCap({ userId: ME, dayIso: SUNDAY, alreadyToday: 0, candidates: events(4) })
    expect(out.immediate).toEqual(['event-1'])
    expect(out.overflow?.params.count).toBe(3)
  })

  it('points the overflow row at the surface that lists the day', () => {
    const out = applyDailyCap({
      userId: ME,
      dayIso: FRIDAY,
      alreadyToday: 5,
      candidates: ['event-6'],
      href: '/?day=2026-08-21',
    })
    expect(out.overflow?.params.href).toBe('/?day=2026-08-21')
  })

  it('has nothing to say about a person with no candidates', () => {
    const out = applyDailyCap({ userId: ME, dayIso: FRIDAY, alreadyToday: 9, candidates: [] })
    expect(out).toEqual({ immediate: [], suppressed: [], overflow: null })
  })
})

describe('colomboDayWindow', () => {
  it('starts at Colombo midnight, which is 18:30 UTC the day before', () => {
    const { from, to } = colomboDayWindow(FRIDAY)
    expect(from.toISOString()).toBe('2026-08-20T18:30:00.000Z')
    expect(to.toISOString()).toBe('2026-08-21T18:30:00.000Z')
  })

  it('is half open, so an instant is charged to exactly one day', () => {
    const friday = colomboDayWindow(FRIDAY)
    const saturday = colomboDayWindow(SATURDAY)
    expect(friday.to.getTime()).toBe(saturday.from.getTime())
  })

  it('throws on a day that is not a day, rather than sliding the window', () => {
    expect(() => colomboDayWindow('not-a-day')).toThrow(RangeError)
  })
})
