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
  // Also skip PWA/static assets so install/manifest fetches don't redirect to
  // /sign-in. The extension list is explicit and end-anchored on purpose: a bare
  // `.*\.` exclusion skips the guard for ANY path containing a dot, so a request
  // like /apps/foo.bar would reach a page unauthenticated. The (app) layout also
  // redirects on a missing session as defense in depth.
  matcher: [
    '/((?!api/auth|api/cron|_next/static|_next/image|sign-in|pwa-icon|apple-icon|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|webmanifest|json|txt|xml|js|css|map|woff|woff2|ttf)$).*)',
  ],
}
