import { describe, expect, it } from 'vitest'
import { canAccessApp } from './access-gate'

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
