import { describe, expect, it } from 'vitest'
import { matchApp } from './app-match'

const APPS = [
  { id: 'a1', name: 'Vela' },
  { id: 'a2', name: 'Vela Mobile' },
  { id: 'a3', name: 'Orbit' },
]

describe('matchApp', () => {
  it('resolves an exact name match', () => {
    expect(matchApp('Vela', APPS)).toEqual(APPS[0])
    expect(matchApp('Orbit', APPS)).toEqual(APPS[2])
  })

  it('is case-insensitive on an exact match', () => {
    expect(matchApp('vela', APPS)).toEqual(APPS[0])
    expect(matchApp('ORBIT', APPS)).toEqual(APPS[2])
  })

  it('falls back to a substring match when there is no exact name match', () => {
    expect(matchApp('Orb', APPS)).toEqual(APPS[2])
  })

  it('is case-insensitive on a substring match', () => {
    expect(matchApp('orb', APPS)).toEqual(APPS[2])
    expect(matchApp('VELA MOB', APPS)).toEqual(APPS[1])
  })

  it('an exact name match wins over a substring match on another app', () => {
    // "Vela" is an exact match on APPS[0] even though it is also a substring
    // of "Vela Mobile" — exact wins outright, no ambiguity.
    expect(matchApp('Vela', APPS)).toEqual(APPS[0])
  })

  it('is ambiguous — and returns null — when multiple apps substring-match', () => {
    // "Vela" substring-matches both "Vela" and "Vela Mobile"; only the exact
    // branch resolves that case (covered above). A query that is a substring
    // of two apps but an exact match of neither must return null.
    expect(matchApp('vel', APPS)).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(matchApp('Nonexistent', APPS)).toBeNull()
  })

  it('returns null for an empty query against a non-empty app list', () => {
    // Every app name "includes" the empty string, so more than one app
    // matches and the result is ambiguous by the same rule as any other tie.
    expect(matchApp('', APPS)).toBeNull()
  })

  it('returns null against an empty app list', () => {
    expect(matchApp('Vela', [])).toBeNull()
  })
})
