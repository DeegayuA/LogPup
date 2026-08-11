import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

// AES-256-GCM for secrets at rest (per-user Gemini API keys).
//
// Key derivation: prefer a dedicated GEMINI_KEY_ENCRYPTION_SECRET so that
// rotating AUTH_SECRET (session signing) doesn't also silently invalidate
// every stored key. Falls back to deriving from AUTH_SECRET when the new
// var is unset, so deployments that never opt in see no behavior change —
// this keeps the fallback path fully backward compatible with keys that
// were already encrypted before this var existed.
//
// Rotation guidance:
// - Whichever secret is active, rotating it re-derives the AES key, so
//   every previously stored key becomes undecryptable. There is no
//   versioned/dual-key migration here — decryptSecret will throw, and
//   callers should treat that as "this key needs re-entry", not a fatal
//   error. Rotate deliberately and expect users to re-add their Gemini
//   keys afterward.
// - Adopting GEMINI_KEY_ENCRYPTION_SECRET on a deployment that already has
//   keys stored under the AUTH_SECRET-derived key is itself a rotation:
//   generate the secret (openssl rand -base64 32), set it, and expect
//   existing rows to need re-entry — same as any other rotation above.
function keyFromSecret(): Buffer {
  const secret = process.env.GEMINI_KEY_ENCRYPTION_SECRET || process.env.AUTH_SECRET
  if (!secret) throw new Error('GEMINI_KEY_ENCRYPTION_SECRET or AUTH_SECRET must be set')
  return createHash('sha256').update(`${secret}:logpup-secrets`).digest()
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted payload')
  const decipher = createDecipheriv('aes-256-gcm', keyFromSecret(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
