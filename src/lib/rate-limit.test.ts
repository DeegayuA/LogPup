import { describe, it, expect } from 'vitest'
import { createRateLimiter } from './rate-limit'

describe('rate limiter', () => {
  it('allows attempts under the limit', () => {
    const now = 0
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 1000, now: () => now })
    for (let i = 0; i < 4; i++) {
      expect(limiter.isBlocked('a@b.com')).toBe(false)
      limiter.recordFailure('a@b.com')
    }
    expect(limiter.isBlocked('a@b.com')).toBe(false)
  })

  it('blocks once max failed attempts is reached within the window', () => {
    const now = 0
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 1000, now: () => now })
    for (let i = 0; i < 5; i++) limiter.recordFailure('a@b.com')
    expect(limiter.isBlocked('a@b.com')).toBe(true)
  })

  it('unblocks once the window has fully expired', () => {
    let now = 0
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 1000, now: () => now })
    for (let i = 0; i < 5; i++) limiter.recordFailure('a@b.com')
    expect(limiter.isBlocked('a@b.com')).toBe(true)
    now += 1001
    expect(limiter.isBlocked('a@b.com')).toBe(false)
  })

  it('slides the window: individual old attempts age out on their own', () => {
    let now = 0
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 100, now: () => now })
    limiter.recordFailure('a@b.com') // t=0
    now = 50
    limiter.recordFailure('a@b.com') // t=50
    now = 90
    limiter.recordFailure('a@b.com') // t=90 -> 3 attempts in window, blocked
    expect(limiter.isBlocked('a@b.com')).toBe(true)
    now = 101 // t=0 attempt (>100ms old) ages out, 2 remain -> under limit
    expect(limiter.isBlocked('a@b.com')).toBe(false)
  })

  it('reset clears attempt history for a key', () => {
    const now = 0
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 1000, now: () => now })
    for (let i = 0; i < 5; i++) limiter.recordFailure('a@b.com')
    expect(limiter.isBlocked('a@b.com')).toBe(true)
    limiter.reset('a@b.com')
    expect(limiter.isBlocked('a@b.com')).toBe(false)
  })

  it('tracks keys independently', () => {
    const now = 0
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 1000, now: () => now })
    for (let i = 0; i < 5; i++) limiter.recordFailure('a@b.com')
    expect(limiter.isBlocked('a@b.com')).toBe(true)
    expect(limiter.isBlocked('c@d.com')).toBe(false)
  })

  it('defaults to 5 attempts per 15 minutes', () => {
    let now = 0
    const limiter = createRateLimiter({ now: () => now })
    for (let i = 0; i < 5; i++) limiter.recordFailure('a@b.com')
    expect(limiter.isBlocked('a@b.com')).toBe(true)
    now += 15 * 60 * 1000 + 1
    expect(limiter.isBlocked('a@b.com')).toBe(false)
  })
})
