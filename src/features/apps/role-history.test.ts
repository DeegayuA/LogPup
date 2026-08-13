import { describe, it, expect } from 'vitest'
import {
  appRoleAsOf,
  buildAppRoleEntry,
  buildRoleTimeline,
  isBackfilled,
  BACKFILLED_APP_ROLE_NOTE,
  type AppRoleInterval,
  type AppRoleKind,
} from './role-history'

const JAN = new Date('2026-01-01T00:00:00.000Z')
const FEB = new Date('2026-02-01T00:00:00.000Z')
const MAR = new Date('2026-03-01T00:00:00.000Z')

type Row = AppRoleInterval & { id: string; role: AppRoleKind; userId: string; note: string | null }

function row(over: Partial<Row> = {}): Row {
  return {
    id: 'h1',
    role: 'pm',
    userId: 'u1',
    effectiveFrom: JAN,
    effectiveTo: null,
    note: null,
    ...over,
  }
}

describe('appRoleAsOf', () => {
  it('finds the holder at an instant inside an interval', () => {
    const held = row({ userId: 'u1', effectiveFrom: JAN, effectiveTo: MAR })
    expect(appRoleAsOf([held], 'pm', FEB)).toEqual(held)
  })

  it('is inclusive of the start boundary and exclusive of the end boundary — [from, to)', () => {
    const held = row({ userId: 'u1', effectiveFrom: FEB, effectiveTo: MAR })
    expect(appRoleAsOf([held], 'pm', FEB)).toEqual(held)
    expect(appRoleAsOf([held], 'pm', MAR)).toBeNull()
  })

  it('picks exactly the successor at the instant one holder replaces another', () => {
    // The abutting pair a single change writes: same timestamp on both sides.
    const before = row({ id: 'h1', userId: 'u1', effectiveFrom: JAN, effectiveTo: FEB })
    const after = row({ id: 'h2', userId: 'u2', effectiveFrom: FEB, effectiveTo: null })
    expect(appRoleAsOf([before, after], 'pm', FEB)).toEqual(after)
  })

  it('returns null before any history exists', () => {
    const held = row({ effectiveFrom: FEB })
    expect(appRoleAsOf([held], 'pm', JAN)).toBeNull()
  })

  it('returns the same single row for every instant on an app whose PM never changed', () => {
    const held = row({ userId: 'u1', effectiveFrom: JAN, effectiveTo: null })
    expect(appRoleAsOf([held], 'pm', FEB)).toEqual(held)
    expect(appRoleAsOf([held], 'pm', new Date('2030-01-01T00:00:00.000Z'))).toEqual(held)
  })

  it('never matches a different role, even when the interval covers the instant', () => {
    const leadHeld = row({ role: 'lead', userId: 'u1', effectiveFrom: JAN, effectiveTo: null })
    expect(appRoleAsOf([leadHeld], 'pm', FEB)).toBeNull()
    expect(appRoleAsOf([leadHeld], 'lead', FEB)).toEqual(leadHeld)
  })

  it('reports no lead once a closed interval has nothing reopened after it', () => {
    const cleared = row({ role: 'lead', userId: 'u1', effectiveFrom: JAN, effectiveTo: FEB })
    expect(appRoleAsOf([cleared], 'lead', JAN)).toEqual(cleared)
    expect(appRoleAsOf([cleared], 'lead', MAR)).toBeNull()
  })

  it('handles empty input', () => {
    expect(appRoleAsOf([], 'pm', JAN)).toBeNull()
  })
})

describe('isBackfilled / BACKFILLED_APP_ROLE_NOTE', () => {
  it('is true only for the exact sentinel', () => {
    expect(isBackfilled(BACKFILLED_APP_ROLE_NOTE)).toBe(true)
    expect(isBackfilled('backfilled at migration')).toBe(true)
  })

  it('is false for an observed row, including one that merely mentions backfilling', () => {
    expect(isBackfilled(null)).toBe(false)
    expect(isBackfilled('')).toBe(false)
    expect(isBackfilled('this was backfilled by an admin')).toBe(false)
  })
})

describe('buildRoleTimeline', () => {
  it('orders newest first', () => {
    const entries = buildRoleTimeline([
      row({ id: 'h1', effectiveFrom: JAN }),
      row({ id: 'h2', effectiveFrom: MAR }),
      row({ id: 'h3', effectiveFrom: FEB }),
    ])
    expect(entries.map((e) => e.id)).toEqual(['h2', 'h3', 'h1'])
  })

  it('flags backfilled rows as such, and leaves observed rows unflagged', () => {
    const entries = buildRoleTimeline([
      row({ id: 'observed', note: null }),
      row({ id: 'assumed', note: BACKFILLED_APP_ROLE_NOTE }),
    ])
    const byId = Object.fromEntries(entries.map((e) => [e.id, e.backfilled]))
    expect(byId).toEqual({ observed: false, assumed: true })
  })

  it('handles empty input', () => {
    expect(buildRoleTimeline([])).toEqual([])
  })
})

describe('buildAppRoleEntry', () => {
  const base = { appId: 'a1', userId: 'u1', role: 'pm' as AppRoleKind, changedBy: 'admin-1', at: FEB }

  it('opens an interval at the given instant', () => {
    expect(buildAppRoleEntry(base)).toEqual({
      appId: 'a1',
      userId: 'u1',
      role: 'pm',
      effectiveFrom: FEB,
      effectiveTo: null,
      changedBy: 'admin-1',
      note: null,
    })
  })

  it('keeps a given note and normalises absence to null', () => {
    expect(buildAppRoleEntry({ ...base, note: 'test' }).note).toBe('test')
    expect(buildAppRoleEntry(base).note).toBeNull()
  })
})
