import { beforeEach, describe, expect, it, vi } from 'vitest'

// The wrapper under test calls the glance server action, and THAT module
// reaches the db at import time — stubbed out so this stays a pure test.
// Same mocked-module idiom as use-glance-map.test.ts.
vi.mock('@/features/meetings/glance-actions', () => ({ getMeetingGlances: vi.fn() }))

import { getMeetingGlances } from '@/features/meetings/glance-actions'
import { getMeetingGlancesChunked } from './glance-batch'
import { MAX_GLANCE_IDS } from './glance-core'

const action = vi.mocked(getMeetingGlances)

/** Deterministic fake ids — the wrapper never inspects their shape. */
function ids(count: number, prefix = 'm'): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`)
}

beforeEach(() => {
  action.mockReset()
})

describe('getMeetingGlancesChunked', () => {
  it('passes an under-cap request through as ONE action call', async () => {
    const requested = ids(3)
    action.mockResolvedValue({ ok: true, map: { 'm-0': null, 'm-1': null, 'm-2': null } })

    const result = await getMeetingGlancesChunked(requested)

    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith(requested)
    expect(result).toEqual({ ok: true, map: { 'm-0': null, 'm-1': null, 'm-2': null } })
  })

  it('splits an over-cap request into cap-sized calls and merges the maps', async () => {
    const requested = ids(MAX_GLANCE_IDS + 5)
    action.mockImplementation(async (chunk) => ({
      ok: true,
      map: Object.fromEntries(chunk.map((id) => [id, null])),
    }))

    const result = await getMeetingGlancesChunked(requested)

    expect(action).toHaveBeenCalledTimes(2)
    for (const call of action.mock.calls) {
      expect(call[0].length).toBeLessThanOrEqual(MAX_GLANCE_IDS)
    }
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Every requested id has a key — none silently dropped past the cap.
      expect(Object.keys(result.map)).toHaveLength(requested.length)
    }
  })

  it('dedupes ids before chunking, so duplicates cannot push a batch over the cap', async () => {
    const requested = [...ids(MAX_GLANCE_IDS), ...ids(MAX_GLANCE_IDS)]
    action.mockImplementation(async (chunk) => ({
      ok: true,
      map: Object.fromEntries(chunk.map((id) => [id, null])),
    }))

    const result = await getMeetingGlancesChunked(requested)

    expect(action).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('one failed chunk fails the whole batch — a half-answered map would make rows lie', async () => {
    const requested = ids(MAX_GLANCE_IDS + 1)
    action
      .mockResolvedValueOnce({ ok: true, map: {} })
      .mockResolvedValueOnce({ ok: false })

    expect(await getMeetingGlancesChunked(requested)).toEqual({ ok: false })
  })
})
