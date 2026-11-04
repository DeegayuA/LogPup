import { describe, expect, it } from 'vitest'
import { dmKey, effectiveStatus, isReaction, normalizeChannelName, parseStatus, statusExpiry } from './chat'

describe('dmKey', () => {
  it('is the same whichever person opens the DM', () => {
    expect(dmKey('b', 'a')).toBe('a:b')
    expect(dmKey('a', 'b')).toBe('a:b')
  })
})

describe('normalizeChannelName', () => {
  it('lowercases and dashes', () => {
    expect(normalizeChannelName('  #Release Planning!! ')).toBe('release-planning')
  })
  it('refuses names with nothing usable', () => {
    expect(normalizeChannelName('!!')).toBeNull()
    expect(normalizeChannelName('a')).toBeNull()
  })
})

describe('statusExpiry', () => {
  const now = new Date('2026-11-03T04:00:00Z') // 09:30 in Sri Lanka
  it('adds minutes', () => {
    expect(statusExpiry('1h', now)?.toISOString()).toBe('2026-11-03T05:00:00.000Z')
  })
  it('ends "today" at 23:59:59 Sri Lanka time', () => {
    expect(statusExpiry('today', now)?.toISOString()).toBe('2026-11-03T18:29:59.000Z')
  })
  it('never expires on "never"', () => {
    expect(statusExpiry('never', now)).toBeNull()
  })
})

describe('effectiveStatus', () => {
  const now = new Date('2026-11-03T04:00:00Z')
  it('hides an expired status', () => {
    expect(effectiveStatus({ status: 'busy', note: null, expiresAt: new Date('2026-11-03T03:00:00Z') }, now)).toBeNull()
  })
  it('keeps a live or open-ended one', () => {
    expect(effectiveStatus({ status: 'busy', note: 'x', expiresAt: null }, now)?.status).toBe('busy')
  })
})

describe('parsers', () => {
  it('accept only known values', () => {
    expect(parseStatus('dnd')).toBe('dnd')
    expect(parseStatus('sleeping')).toBeNull()
    expect(isReaction('👍')).toBe(true)
    expect(isReaction('💩')).toBe(false)
  })
})
