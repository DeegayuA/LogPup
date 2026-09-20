import { beforeEach, describe, expect, it, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { absences } from '@/db/schema'

/**
 * The three writes on an absence row, and the races they lose.
 *
 * absence-actions.ts had NO test file, and both defects below are the kind
 * that only appear when two people act on the same row at once — invisible to
 * a reader, invisible in use, and destructive when they land.
 *
 * Same mocked-action idiom as admin/trash-actions.test.ts: chainable stubs
 * with a per-table `.returning()` queue, then `await import` the module.
 */
const { authMock, logActivityMock, whereSpy, setSpy, canReviewAbsenceMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  logActivityMock: vi.fn(),
  whereSpy: vi.fn(),
  setSpy: vi.fn(),
  canReviewAbsenceMock: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('@/features/auth/actor', () => ({ loadActor: authMock }))
vi.mock('@/features/auth/capabilities', () => ({ can: () => true }))
// The real scoping logic (manager-vs-appId) is covered where it lives, by
// absence-queries.test.ts's canReviewAbsence suite. Mocked here as a spy so
// these tests pin what review() DOES with it — fetches the absent person's
// own assignments, passes them through, and refuses when it says no —
// without re-deriving `can()`'s matrix answer for actors this file never
// gives a role or scope to.
vi.mock('@/features/worklog/absence-queries', () => ({ canReviewAbsence: canReviewAbsenceMock }))

let selectQueue: unknown[][] = []
let updateReturning: unknown[][] = []

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          const rows = selectQueue.shift() ?? []
          return {
            then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) =>
              Promise.resolve(rows).then(ok, fail),
            limit: async () => rows,
            orderBy: () => ({ limit: async () => rows }),
          }
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        setSpy(values)
        return {
          where: (predicate: unknown) => {
            whereSpy(predicate)
            const rows = updateReturning.shift() ?? []
            return {
              then: (ok: (v: unknown) => unknown) => Promise.resolve(undefined).then(ok),
              returning: async () => rows,
            }
          },
        }
      },
    }),
    insert: () => ({ values: async () => undefined }),
    batch: async (queries: unknown[]) => Promise.all(queries),
  },
}))

const { approveAbsence, withdrawAbsence } = await import('./absence-actions')

const ID = '11111111-1111-4111-8111-111111111111'
const OWNER = '22222222-2222-4222-8222-222222222222'
const REVIEWER = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  authMock.mockReset()
  logActivityMock.mockReset()
  whereSpy.mockReset()
  setSpy.mockReset()
  canReviewAbsenceMock.mockReset()
  canReviewAbsenceMock.mockReturnValue(true)
  selectQueue = []
  updateReturning = []
})

describe('withdrawAbsence', () => {
  /**
   * THE PREDICATE, PINNED.
   *
   * This was `ne(absences.status, 'approved')`, which is true of a REJECTED
   * row. A reviewer who rejected between the SELECT and the UPDATE had their
   * decision — and the reason they typed into reviewNote — overwritten with
   * 'withdrawn'. A behaviour test cannot catch this: the mock cannot know that
   * the wrong predicate would have matched a row the right one skips. So the
   * predicate itself is the assertion.
   */
  it('may only ever leave a PENDING row, never one already decided', async () => {
    authMock.mockResolvedValue({ id: OWNER })
    selectQueue = [[{ id: ID, userId: OWNER, status: 'pending' }]]
    updateReturning = [[{ id: ID }]]

    const res = await withdrawAbsence({ id: ID })

    expect(res.ok).toBe(true)
    expect(whereSpy).toHaveBeenCalledWith(
      and(eq(absences.id, ID), eq(absences.status, 'pending')),
    )
  })

  // The other half: the predicate now matches nothing, and the action has to
  // notice. Before, the update's result was never read at all.
  it('reports the race rather than claiming success when it matched nothing', async () => {
    authMock.mockResolvedValue({ id: OWNER })
    selectQueue = [[{ id: ID, userId: OWNER, status: 'pending' }]]
    updateReturning = [[]]

    const res = await withdrawAbsence({ id: ID })

    expect(res).toEqual({ ok: false, error: 'That absence has already been reviewed' })
  })

  it('refuses somebody else’s absence outright', async () => {
    authMock.mockResolvedValue({ id: REVIEWER })
    selectQueue = [[{ id: ID, userId: OWNER, status: 'pending' }]]

    expect(await withdrawAbsence({ id: ID })).toEqual({ ok: false, error: 'Not allowed' })
    expect(whereSpy).not.toHaveBeenCalled()
  })
})

describe('approveAbsence', () => {
  it('records the decision and logs it when it wins the race', async () => {
    authMock.mockResolvedValue({ id: REVIEWER })
    selectQueue = [[{ id: ID, userId: OWNER, status: 'pending', kind: 'annual' }]]
    updateReturning = [[{ id: ID }]]

    const res = await approveAbsence({ id: ID, note: 'Covered by Nimal' })

    expect(res.ok).toBe(true)
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved', reviewerId: REVIEWER, reviewNote: 'Covered by Nimal' }),
    )
    expect(logActivityMock).toHaveBeenCalledTimes(1)
  })

  /**
   * THE LOST RACE. The `row.status !== 'pending'` guard reads a SELECT taken
   * before the other reviewer decided, so both reviewers reach the UPDATE. The
   * loser's touched zero rows — and the function went on to write an
   * 'approved' activity row and return ok, so the audit trail gained a
   * decision nobody made and the reviewer was told theirs had landed.
   */
  it('writes no activity row and claims nothing when another reviewer got there first', async () => {
    authMock.mockResolvedValue({ id: REVIEWER })
    selectQueue = [[{ id: ID, userId: OWNER, status: 'pending', kind: 'annual' }]]
    updateReturning = [[]]

    const res = await approveAbsence({ id: ID })

    expect(res).toEqual({ ok: false, error: 'Somebody already decided that one' })
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  /**
   * THE BUG: review() used to ask `can(actor, 'absence.approve', { ownerId:
   * row.userId })` — no appId, which 'scoped' (manager) always refuses — so a
   * manager the list already scoped correctly to this row dead-ended right
   * here. The fix resolves the absent person's OWN assignments and hands them
   * to canReviewAbsence, same as the list does.
   */
  it('resolves the absent person’s own assignments and lets a scoped manager through', async () => {
    authMock.mockResolvedValue({ id: 'mgr-1' })
    selectQueue = [
      [{ id: ID, userId: OWNER, status: 'pending', kind: 'annual' }],
      [{ appId: 'app-1' }, { appId: 'app-2' }],
    ]
    updateReturning = [[{ id: ID }]]

    const res = await approveAbsence({ id: ID })

    expect(res.ok).toBe(true)
    expect(canReviewAbsenceMock).toHaveBeenCalledWith(
      { id: 'mgr-1' },
      { userId: OWNER, appIds: ['app-1', 'app-2'] },
    )
  })

  it('refuses, before touching the row, when canReviewAbsence says no', async () => {
    authMock.mockResolvedValue({ id: 'mgr-1' })
    selectQueue = [[{ id: ID, userId: OWNER, status: 'pending', kind: 'annual' }], []]
    canReviewAbsenceMock.mockReturnValue(false)

    const res = await approveAbsence({ id: ID })

    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(whereSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })
})
