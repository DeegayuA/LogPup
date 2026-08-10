import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// Password hashing with Node's built-in scrypt — no external dependency.
// Stored format: "<saltHex>:<hashHex>". scrypt is memory-hard and salted per user.
const KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEYLEN).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(':')
  if (!salt || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, salt, KEYLEN)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
