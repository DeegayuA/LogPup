import { describe, expect, it } from 'vitest'
import { canAccessApp, mayHoldSession } from './access-gate'

describe('canAccessApp', () => {
  it('approved + active → true', () => {
    expect(canAccessApp('approved', true)).toBe(true)
  })

  it('pending → false, even when active', () => {
    expect(canAccessApp('pending', true)).toBe(false)
  })

  it('rejected → false, even when active', () => {
    expect(canAccessApp('rejected', true)).toBe(false)
  })

  it('approved but inactive → false', () => {
    expect(canAccessApp('approved', false)).toBe(false)
  })

  it('pending and inactive → false', () => {
    expect(canAccessApp('pending', false)).toBe(false)
  })
})

describe('mayHoldSession', () => {
  it('lets an approved user hold a session', () => {
    expect(mayHoldSession('approved')).toBe(true)
  })

  it('lets a pending user hold a session — they need one to reach /pending', () => {
    expect(mayHoldSession('pending')).toBe(true)
  })

  it('refuses a rejected user, who has nothing to reach', () => {
    expect(mayHoldSession('rejected')).toBe(false)
  })

  it('is wider than canAccessApp: deactivated signs in, and still cannot use the app', () => {
    // The whole deactivation contract in one assertion. If somebody ever
    // "simplifies" mayHoldSession into canAccessApp, this is what breaks:
    // a deactivated person would stop being able to sign in and so could
    // never be shown /deactivated or sign themselves out.
    expect(mayHoldSession('approved')).toBe(true)
    expect(canAccessApp('approved', false)).toBe(false)
  })
})
