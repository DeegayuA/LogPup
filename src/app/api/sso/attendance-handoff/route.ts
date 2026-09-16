import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { bridgeEmailAllowed } from '@/lib/bridge-auth'
import { signAttendanceHandoff } from '@/features/auth/attendance-sso'
import { safeNext } from '@/lib/safe-next'

// randomUUID and createHmac are node builtins, and reading the session already
// makes this dynamic — these read the way both external routes do.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The outbound half of the sign-in handoff: LogPup → Attendance.
 *
 * Returns the URL to open. It does NOT redirect, because the caller is a button
 * that has already opened a tab and needs somewhere to point it (see
 * attendance-app-button.tsx for why that tab is opened before this request).
 *
 * THIS ROUTE MINTS A TOKEN NAMING THE SESSION'S OWN USER AND NOBODY ELSE. The
 * email is read from auth(), never from the request body, and the body is
 * parsed for exactly one field: `next`. A handoff endpoint that accepts a
 * target email is an impersonation endpoint — it would let anyone with a
 * LogPup session mint an Attendance session for anyone else, which is a
 * privilege escalation across two applications at once.
 *
 * The far side refuses independently: Attendance's /api/auth/logpup-sso
 * verifies the signature, checks its own tenant gate, spends the jti, and
 * provisions nothing. This route being correct is the first of two locks, not
 * the only one.
 *
 * NOT RATE-LIMITED, deliberately, and this is the same reasoning the task
 * endpoints are documented with: src/lib/rate-limit.ts is in-memory and
 * per-process and explicitly refuses responsibility for a multi-instance
 * deployment, which Vercel is. What bounds this endpoint is that it requires a
 * session and mints only for that session's own user — the worst an abuser can
 * do is issue themselves tokens they could have got by clicking the button.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // The bridge's domain gate, both directions. An in-domain LogPup user is the
  // only person who could have an Attendance account to land in; minting for
  // anyone else would be handing out a token that can only ever be refused.
  // DELIBERATELY NOT emailAllowed(), which decides who may sign in HERE and
  // carries four domains — see bridge-auth.ts.
  if (!bridgeEmailAllowed(email)) {
    return NextResponse.json({ success: false, error: 'Not available for this account' }, { status: 403 })
  }

  const body: unknown = await req.json().catch(() => ({}))
  const next = safeNext((body as { next?: unknown } | null)?.next)

  const token = signAttendanceHandoff(email, session?.user?.name ?? email)
  if (!token) {
    // Unset LOGPUP_SSO_SECRET. 503 rather than 500: nothing is broken, the
    // integration is simply not configured, and the button's fallback path
    // turns this into "opened Attendance, please sign in" rather than an error.
    return NextResponse.json({ success: false, error: 'SSO is not configured' }, { status: 503 })
  }

  const url = `${attendanceBaseUrl()}/sso/logpup?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`
  return NextResponse.json({ success: true, url }, { headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Where Attendance lives. Mirrors how the other side names this repo
 * (`LOGPUP_APP_URL` in Attendance-Web-App/src/lib/logpupApi.ts): an env var so
 * a preview deployment can point at a preview, defaulting to production so
 * nothing has to be set for the ordinary case.
 */
function attendanceBaseUrl(): string {
  return (process.env.ATTENDANCE_APP_URL || 'https://attendance.altavision.lk').replace(/\/$/, '')
}
