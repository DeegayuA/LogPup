import { createHmac } from 'node:crypto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SignJWT, jwtVerify } from 'jose'
import { signAttendanceHandoff, verifyAttendanceToken } from './attendance-sso'

/**
 * The happy-path tokens here are minted with `jose`'s SignJWT — the exact
 * library and call the Attendance Web App uses
 * (Attendance-Web-App/src/app/api/logpup-sso/route.ts). That is the point: a
 * hand-rolled verifier tested only against hand-rolled tokens proves that this
 * file agrees with itself. Minting the real way proves interop with the thing
 * actually on the other end of the link.
 *
 * jose is a TEST-ONLY import for exactly that reason (see the header comment in
 * attendance-sso.ts). If next-auth ever drops it, a test fails loudly here
 * instead of a sign-in failing quietly in production.
 *
 * The refusal cases are assembled by hand, because `jose` will not mint most
 * of them — an `alg: none` token or a lifetime of a day is precisely what a
 * correct library refuses to produce.
 */

const SECRET = 'an-sso-signing-secret-long-enough-to-be-real'
const NOW = new Date('2026-09-16T10:00:00.000Z')
const nowSeconds = Math.floor(NOW.getTime() / 1000)

async function mint(
  claims: Record<string, unknown> = {},
  { secret = SECRET, lifetime = 180 }: { secret?: string; lifetime?: number } = {},
): Promise<string> {
  return new SignJWT({ email: 'someone@altavision.lk', name: 'Someone', jti: 'token-1', ...claims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(String(claims.sub ?? claims.email ?? 'someone@altavision.lk'))
    .setIssuedAt(nowSeconds)
    // ABSOLUTE epoch seconds, not the '3m' string Attendance passes. jose
    // resolves a relative lifetime against the real wall clock rather than
    // against the `iat` just set, which would put every token in this suite
    // three minutes from the moment the test ran instead of from the fixed
    // NOW it asserts against.
    .setExpirationTime(nowSeconds + lifetime)
    .sign(new TextEncoder().encode(secret))
}

/** Assemble a token part by part, for the shapes a correct signer will not emit. */
function handMint(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  { secret = SECRET, signature }: { secret?: string; signature?: string } = {},
): string {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const head = `${b64(header)}.${b64(payload)}`
  if (signature !== undefined) return `${head}.${signature}`
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`
}

const validPayload = {
  sub: 'someone@altavision.lk',
  email: 'someone@altavision.lk',
  name: 'Someone',
  jti: 'token-1',
  iat: nowSeconds,
  exp: nowSeconds + 180,
}

describe('verifyAttendanceToken', () => {
  const original = process.env.LOGPUP_SSO_SECRET
  beforeEach(() => {
    process.env.LOGPUP_SSO_SECRET = SECRET
  })
  afterEach(() => {
    if (original === undefined) delete process.env.LOGPUP_SSO_SECRET
    else process.env.LOGPUP_SSO_SECRET = original
  })

  it('accepts a token minted exactly the way Attendance mints one', async () => {
    const identity = verifyAttendanceToken(await mint(), NOW)
    expect(identity).toEqual({
      email: 'someone@altavision.lk',
      jti: 'token-1',
      expiresAt: new Date(NOW.getTime() + 180_000),
    })
  })

  it('lowercases and trims the email', async () => {
    const identity = verifyAttendanceToken(
      await mint({ email: '  Someone@AltaVision.LK  ', sub: 'Someone@AltaVision.LK' }),
      NOW,
    )
    expect(identity?.email).toBe('someone@altavision.lk')
  })

  it('does NOT return the name claim', async () => {
    // Display text from another application. LogPup renders its own users.name,
    // and a claim nobody reads is a claim somebody eventually starts reading.
    const identity = verifyAttendanceToken(await mint({ name: 'Someone Else' }), NOW)
    expect(identity).not.toHaveProperty('name')
  })

  // --- signature -----------------------------------------------------------

  it('refuses a token signed with a different secret', async () => {
    const token = await mint({}, { secret: 'the-wrong-secret-entirely' })
    expect(verifyAttendanceToken(token, NOW)).toBeNull()
  })

  it('refuses a tampered payload', async () => {
    const token = await mint()
    const [header, , signature] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ ...validPayload, email: 'someone-else@altavision.lk' }),
    ).toString('base64url')
    expect(verifyAttendanceToken(`${header}.${forged}.${signature}`, NOW)).toBeNull()
  })

  it('refuses alg: none, whatever the header says', () => {
    // The one classic JWT mistake that applies to HS256: honouring the token's
    // own algorithm claim. An unsigned token must not become a session.
    expect(verifyAttendanceToken(handMint({ alg: 'none', typ: 'JWT' }, validPayload, { signature: '' }), NOW)).toBeNull()
    expect(verifyAttendanceToken(handMint({ alg: 'none', typ: 'JWT' }, validPayload), NOW)).toBeNull()
  })

  it('refuses another HMAC algorithm even when correctly signed for it', () => {
    const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
    const head = `${b64({ alg: 'HS512', typ: 'JWT' })}.${b64(validPayload)}`
    const sig = createHmac('sha512', SECRET).update(head).digest('base64url')
    expect(verifyAttendanceToken(`${head}.${sig}`, NOW)).toBeNull()
  })

  it('refuses a header carrying a crit extension it does not understand', () => {
    expect(
      verifyAttendanceToken(handMint({ alg: 'HS256', typ: 'JWT', crit: ['exp'] }, validPayload), NOW),
    ).toBeNull()
  })

  it('refuses a non-canonical signature encoding', async () => {
    // Buffer.from(…, 'base64url') silently skips characters it does not know,
    // so a dressed-up signature would otherwise decode to the same 32 bytes.
    const token = await mint()
    const [header, payload, signature] = token.split('.')
    expect(verifyAttendanceToken(`${header}.${payload}.${signature}==`, NOW)).toBeNull()
    expect(verifyAttendanceToken(`${header}.${payload}.${signature}!`, NOW)).toBeNull()
  })

  // --- shape ---------------------------------------------------------------

  it('refuses anything that is not three parts', async () => {
    const token = await mint()
    expect(verifyAttendanceToken(token.split('.').slice(0, 2).join('.'), NOW)).toBeNull()
    expect(verifyAttendanceToken(`${token}.extra`, NOW)).toBeNull()
    expect(verifyAttendanceToken('not-a-token', NOW)).toBeNull()
    expect(verifyAttendanceToken('', NOW)).toBeNull()
    expect(verifyAttendanceToken(null, NOW)).toBeNull()
    expect(verifyAttendanceToken(undefined, NOW)).toBeNull()
  })

  it('fails closed when LOGPUP_SSO_SECRET is unset', async () => {
    const token = await mint()
    delete process.env.LOGPUP_SSO_SECRET
    expect(verifyAttendanceToken(token, NOW)).toBeNull()
  })

  // --- claims --------------------------------------------------------------

  it('refuses a token with no jti — there is nothing to spend once', () => {
    const { jti: _dropped, ...noJti } = validPayload
    expect(verifyAttendanceToken(handMint({ alg: 'HS256', typ: 'JWT' }, noJti), NOW)).toBeNull()
    expect(verifyAttendanceToken(handMint({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, jti: '' }), NOW)).toBeNull()
    expect(verifyAttendanceToken(handMint({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, jti: 42 }), NOW)).toBeNull()
  })

  it('refuses a token with no usable email', () => {
    const { email: _dropped, ...noEmail } = validPayload
    expect(verifyAttendanceToken(handMint({ alg: 'HS256', typ: 'JWT' }, noEmail), NOW)).toBeNull()
    expect(verifyAttendanceToken(handMint({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, email: '   ' }), NOW)).toBeNull()
    expect(verifyAttendanceToken(handMint({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, email: 5 }), NOW)).toBeNull()
  })

  it('refuses a token whose sub names somebody other than its email', () => {
    // Two ends disagreeing about who signed in. There is no safe guess.
    const token = handMint({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, sub: 'someone-else@altavision.lk' })
    expect(verifyAttendanceToken(token, NOW)).toBeNull()
  })

  // --- time ----------------------------------------------------------------

  it('refuses an expired token', async () => {
    const token = await mint()
    // Comfortably past expiry AND past the skew allowance; the boundary itself
    // is the next test's job.
    expect(verifyAttendanceToken(token, new Date(NOW.getTime() + 600_000))).toBeNull()
  })

  it('tolerates a little clock skew either way', async () => {
    const token = await mint()
    // 10s past expiry on a clock that is slightly ahead: still in.
    expect(verifyAttendanceToken(token, new Date(NOW.getTime() + 190_000))).not.toBeNull()
    // 40s past: out.
    expect(verifyAttendanceToken(token, new Date(NOW.getTime() + 220_000))).toBeNull()
  })

  it('refuses a token issued well in the future', () => {
    const token = handMint({ alg: 'HS256', typ: 'JWT' }, {
      ...validPayload,
      iat: nowSeconds + 3600,
      exp: nowSeconds + 3600 + 180,
    })
    expect(verifyAttendanceToken(token, NOW)).toBeNull()
  })

  it('refuses a token that claims a lifetime longer than this side honours', () => {
    // The receiver is not bound by the sender's arithmetic: a URL outlives the
    // page it was clicked from, and a day-long token in browser history is a
    // standing session.
    const token = handMint({ alg: 'HS256', typ: 'JWT' }, {
      ...validPayload,
      exp: nowSeconds + 86_400,
    })
    expect(verifyAttendanceToken(token, NOW)).toBeNull()
  })

  it('refuses a token with no exp or no iat', () => {
    const { exp: _e, ...noExp } = validPayload
    const { iat: _i, ...noIat } = validPayload
    expect(verifyAttendanceToken(handMint({ alg: 'HS256', typ: 'JWT' }, noExp), NOW)).toBeNull()
    expect(verifyAttendanceToken(handMint({ alg: 'HS256', typ: 'JWT' }, noIat), NOW)).toBeNull()
    expect(verifyAttendanceToken(handMint({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, exp: 'soon' }), NOW)).toBeNull()
  })
})

/**
 * The outbound direction. These matter more than they look: the far end
 * (Attendance's /api/auth/logpup-sso) verifies with `jose`'s jwtVerify, so
 * every assertion below that runs a minted token through jwtVerify is the
 * actual contract, not a restatement of this file's own encoding.
 */
describe('signAttendanceHandoff', () => {
  const original = process.env.LOGPUP_SSO_SECRET
  beforeEach(() => {
    process.env.LOGPUP_SSO_SECRET = SECRET
  })
  afterEach(() => {
    if (original === undefined) delete process.env.LOGPUP_SSO_SECRET
    else process.env.LOGPUP_SSO_SECRET = original
  })

  it('mints a token the real jose verifies, with the claims Attendance reads', async () => {
    const token = signAttendanceHandoff('someone@altavision.lk', 'Someone', NOW)
    const { payload, protectedHeader } = await jwtVerify(
      token!,
      new TextEncoder().encode(SECRET),
      { algorithms: ['HS256'], currentDate: NOW },
    )
    expect(protectedHeader).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(payload.email).toBe('someone@altavision.lk')
    expect(payload.sub).toBe('someone@altavision.lk')
    expect(payload.name).toBe('Someone')
    expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/)
    expect(payload.exp).toBe(payload.iat! + 180)
  })

  it('refuses to verify against a different secret', async () => {
    const token = signAttendanceHandoff('someone@altavision.lk', 'Someone', NOW)
    await expect(
      jwtVerify(token!, new TextEncoder().encode('not-the-secret'), { algorithms: ['HS256'] }),
    ).rejects.toThrow()
  })

  it('gives every mint a fresh jti', () => {
    // The replay guard on the far side is keyed on this. Two clicks must not
    // produce one token that can only be spent once.
    const a = signAttendanceHandoff('someone@altavision.lk', 'Someone', NOW)
    const b = signAttendanceHandoff('someone@altavision.lk', 'Someone', NOW)
    expect(a).not.toBe(b)
  })

  it('expires, and jose is what enforces it', async () => {
    const token = signAttendanceHandoff('someone@altavision.lk', 'Someone', NOW)
    await expect(
      jwtVerify(token!, new TextEncoder().encode(SECRET), {
        algorithms: ['HS256'],
        currentDate: new Date(NOW.getTime() + 181_000),
      }),
    ).rejects.toThrow()
  })

  it('fails closed when LOGPUP_SSO_SECRET is unset', () => {
    // Null, not a token signed with an empty string — an unconfigured
    // deployment must mint nothing at all.
    delete process.env.LOGPUP_SSO_SECRET
    expect(signAttendanceHandoff('someone@altavision.lk', 'Someone', NOW)).toBeNull()
  })

  it('round-trips through the verifier in this same file', () => {
    // Not the live path (nothing sends a LogPup-minted token back here), but it
    // pins signer and verifier to one shared understanding of the format.
    const token = signAttendanceHandoff('someone@altavision.lk', 'Someone', NOW)
    const identity = verifyAttendanceToken(token, NOW)
    expect(identity?.email).toBe('someone@altavision.lk')
  })
})
