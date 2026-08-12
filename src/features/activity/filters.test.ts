import { describe, expect, it } from 'vitest'
import {
  activityConditions,
  decodeActivityCursor,
  encodeActivityCursor,
} from './filters'

// activityConditions returns drizzle SQL objects — opaque, but their
// PRESENCE/ABSENCE per input is the composition rule worth pinning down, and
// the cursor codec is pure string work either way.

describe('activityConditions', () => {
  it('returns undefined for no filters and no cursor — the unfiltered firehose', () => {
    expect(activityConditions({})).toBeUndefined()
  })

  it('builds a condition when any single filter is present', () => {
    expect(activityConditions({ actorId: 'a' })).toBeDefined()
    expect(activityConditions({ entityType: 'task' })).toBeDefined()
    expect(activityConditions({ appId: 'x' })).toBeDefined()
    expect(activityConditions({ from: new Date() })).toBeDefined()
    expect(activityConditions({ to: new Date() })).toBeDefined()
  })

  it('builds a condition for a cursor alone (page two of the firehose)', () => {
    expect(
      activityConditions({}, { createdAt: new Date(), id: 'row-id' }),
    ).toBeDefined()
  })
})

describe('activity cursor codec', () => {
  it('round-trips', () => {
    const row = {
      createdAt: new Date('2026-08-12T10:30:00.000Z'),
      id: '22222222-2222-4222-8222-222222222222',
    }
    const decoded = decodeActivityCursor(encodeActivityCursor(row))
    expect(decoded?.id).toBe(row.id)
    expect(decoded?.createdAt.getTime()).toBe(row.createdAt.getTime())
  })

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['no separator', '2026-08-12T10:30:00.000Z'],
    ['bad date', 'yesterday|some-id'],
    ['missing id', '2026-08-12T10:30:00.000Z|'],
  ])('degrades %s to null instead of crashing', (_name, raw) => {
    expect(decodeActivityCursor(raw as string | undefined)).toBeNull()
  })
})
