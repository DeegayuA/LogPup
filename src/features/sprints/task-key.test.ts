import { describe, expect, it } from 'vitest'
import { appKeyFor, formatTaskKey, isValidAppKey, parseTaskKey } from './task-key'

describe('appKeyFor', () => {
  it('uses the project key when one is set', () => {
    expect(appKeyFor({ key: 'LOG', number: 7 })).toBe('LOG')
  })

  it('falls back to P<project number> when no key is set', () => {
    expect(appKeyFor({ key: null, number: 7 })).toBe('P7')
  })
})

describe('formatTaskKey', () => {
  it('joins the project key and the task number', () => {
    expect(formatTaskKey({ key: 'LOG', number: 1 }, 245)).toBe('LOG-245')
    expect(formatTaskKey({ key: null, number: 12 }, 3)).toBe('P12-3')
  })
})

describe('isValidAppKey (mirrors the apps_key_format CHECK)', () => {
  it.each(['LOG', 'AB', 'SGX2', 'ABCDEF'])('accepts %s', (k) => {
    expect(isValidAppKey(k)).toBe(true)
  })

  it.each([
    ['A', 'too short'],
    ['ABCDEFG', 'too long'],
    ['log', 'lower case'],
    ['1AB', 'starts with a digit'],
    ['LO-G', 'punctuation'],
    ['P12', 'reserved for the P<number> fallback'],
    ['P1', 'reserved for the P<number> fallback'],
  ])('refuses %s (%s)', (k) => {
    expect(isValidAppKey(k)).toBe(false)
  })

  it('still accepts a P-word that is not P<digits>', () => {
    expect(isValidAppKey('PAY')).toBe(true)
    expect(isValidAppKey('P2X')).toBe(true)
  })
})

describe('parseTaskKey', () => {
  it('reads a project key and a number', () => {
    expect(parseTaskKey('LOG-245')).toEqual({ appKey: 'LOG', number: 245 })
  })

  it('reads the P<number> fallback', () => {
    expect(parseTaskKey('P12-3')).toEqual({ appKey: 'P12', number: 3 })
  })

  it('ignores surrounding space and case', () => {
    expect(parseTaskKey('  log-9 ')).toEqual({ appKey: 'LOG', number: 9 })
  })

  it.each(['LOG', 'LOG-', '-5', 'LOG-0', 'LOG-05x', 'L-5', 'LOG 245', 'TOOLONG-1', '', 'P012-3', 'P0-1'])(
    'returns null for %j',
    (q) => {
      expect(parseTaskKey(q)).toBeNull()
    },
  )
})
