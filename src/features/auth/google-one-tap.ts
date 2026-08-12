/**
 * Verification for the ID token Google One Tap hands the browser.
 *
 * One Tap is an authentication-only flow: the credential it returns is a
 * signed ID token, NOT an OAuth grant. It therefore carries no
 * `calendar.events` scope and produces no refresh token — a user who signs in
 * this way can read LogPup but cannot create Google Calendar events until they
 * go through "Continue with Google" once. That is a deliberate trade: One Tap
 * is a fast path for people who already granted Calendar (their stored refresh
 * token is untouched by this), not a replacement for the consent flow.
 *
 * Verification goes through Google's own tokeninfo endpoint rather than local
 * JWKS verification with `jose`. jose is present in node_modules only as a
 * transitive dependency of next-auth — importing it directly would make LogPup
 * break the day next-auth changes its dependency tree, and adding it as a
 * direct dependency means a lockfile write. tokeninfo does full signature and
 * expiry validation server-side; the cost is one outbound request per One Tap
 * sign-in, which is nothing against a flow that already round-trips to Google.
 *
 * NO NONCE BINDING. Google supports a nonce for One Tap, and we do not use one:
 * it needs a server-issued value round-tripped through a cookie, and the token
 * here is already constrained to our own `aud` (client id) and can only be
 * submitted through the Auth.js credentials callback, which carries CSRF
 * protection. The residual risk is replay of a token minted for *this* app —
 * which requires the victim to have signed in to LogPup already. Revisit if
 * LogPup ever stops being an internal tool.
 */

// tokeninfo returns every claim as a string, including the ones that are
// booleans and numbers in the decoded JWT.
type TokenInfo = {
  aud?: string
  iss?: string
  sub?: string
  exp?: string
  email?: string
  email_verified?: string
  name?: string
  picture?: string
}

export type GoogleIdentity = {
  email: string
  name: string
  picture?: string
}

const VALID_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com'])

export async function verifyGoogleIdToken(credential: string): Promise<GoogleIdentity | null> {
  const clientId = process.env.AUTH_GOOGLE_ID
  if (!clientId || !credential) return null

  let info: TokenInfo
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      // No caching: a token that was valid a minute ago may be expired now, and
      // Next's fetch defaults would happily serve a cached "valid" answer.
      { cache: 'no-store' },
    )
    if (!res.ok) {
      console.warn('[auth] one-tap: tokeninfo rejected the credential')
      return null
    }
    info = (await res.json()) as TokenInfo
  } catch (error) {
    // A network failure must not be mistaken for a valid token.
    console.warn('[auth] one-tap: tokeninfo request failed', error)
    return null
  }

  // tokeninfo verifies the signature and expiry for us; everything below is
  // the part it CANNOT know — that this token was minted for LogPup, by
  // Google, for a real verified mailbox. Checking `aud` is what stops a token
  // issued to any other Google client from being replayed here.
  if (info.aud !== clientId) {
    console.warn('[auth] one-tap: credential was issued for a different client id')
    return null
  }
  if (!info.iss || !VALID_ISSUERS.has(info.iss)) {
    console.warn('[auth] one-tap: unexpected issuer')
    return null
  }
  // Belt and braces on expiry — tokeninfo already refuses expired tokens, but
  // this costs nothing and makes the guarantee local.
  if (!info.exp || Number(info.exp) * 1000 <= Date.now()) {
    console.warn('[auth] one-tap: credential expired')
    return null
  }
  if (info.email_verified !== 'true') {
    console.warn('[auth] one-tap: email not verified by Google')
    return null
  }

  const email = info.email?.trim().toLowerCase()
  if (!email) return null

  return { email, name: info.name?.trim() || email, picture: info.picture }
}
