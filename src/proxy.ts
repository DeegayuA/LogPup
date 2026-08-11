import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL('/sign-in', req.nextUrl))
  }
  // First-login gate: a user still on the admin-issued starter password is
  // pinned to /profile until they set their own (setOwnPassword clears the
  // flag; the jwt callback re-reads it per request, so the gate lifts on the
  // next navigation). /api stays reachable so auth + server actions work.
  const { pathname } = req.nextUrl
  if (
    req.auth.user?.mustChangePassword === true &&
    !pathname.startsWith('/profile') &&
    !pathname.startsWith('/api')
  ) {
    return NextResponse.redirect(new URL('/profile?firstLogin=1', req.nextUrl))
  }
})

export const config = {
  // api/cron is excluded too: Vercel Cron invokes it with no session, and the
  // route self-authenticates via a constant-time CRON_SECRET check (see
  // src/app/api/cron/backup/route.ts) — without this exclusion the redirect
  // above sends cron requests to /sign-in and backups silently never run.
  matcher: ['/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|sign-in).*)'],
}
