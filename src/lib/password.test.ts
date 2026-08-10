import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('verifies a correct password', () => {
    const stored = hashPassword('correct horse battery staple')
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true)
  })

  it('rejects a wrong password', () => {
    const stored = hashPassword('s3cret-pass')
    expect(verifyPassword('wrong-pass', stored)).toBe(false)
  })

  it('salts: same password hashes differently each time', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'))
  })

  it('rejects malformed stored values', () => {
    expect(verifyPassword('x', '')).toBe(false)
    expect(verifyPassword('x', 'nocolon')).toBe(false)
    expect(verifyPassword('x', 'abc:')).toBe(false)
  })
})
