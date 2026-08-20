import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { canAccessApp } from '@/lib/access-gate'

export default auth((req) => {
  if (!req.auth) {
    // The bare domain serves the public home page rather than bouncing to
    // /sign-in. Google's OAuth review opens the origin itself, and a login
    // screen there fails the "your home page does not explain the purpose of
    // your app" check — which is exactly how the first submission was rejected.
    //
    // rewrite, not redirect: the reviewer has to see the explanation AT the URL
    // registered on the consent screen. A redirect would move them to /home and
    // leave the registered URL itself still answering with a bounce.
    if (req.nextUrl.pathname === '/') {
      return NextResponse.rewrite(new URL('/home', req.nextUrl))
    }
    return NextResponse.redirect(new URL('/sign-in', req.nextUrl))
  }
  const { pathname } = req.nextUrl

  // Deactivation gate, FIRST of the three: a deactivated account now holds a
  // real session (see the jwt callback in src/lib/auth.ts) and is pinned to
  // /deactivated, which explains what happened and offers sign-out and
  // nothing else. It runs ahead of the other two because being switched off
  // outranks both of the things they are about — a deactivated account that
  // is also awaiting approval, or still on its starter password, has no
  // approval to wait for and no password worth setting, and sending it to
  // either page would answer a question it is not asking.
  if (
    req.auth.user?.active === false &&
    !pathname.startsWith('/deactivated') &&
    !pathname.startsWith('/api')
  ) {
    return NextResponse.redirect(new URL('/deactivated', req.nextUrl))
  }

  // Pending-approval gate: a self-signed-up user awaiting admin review (see
  // src/lib/auth.ts signIn callback + src/db/schema.ts `user_status`) is
  // pinned to /pending until an admin approves them — same shape as the
  // mustChangePassword gate below. `active` is hardcoded true here because
  // the gate above already returned for every deactivated session, so by the
  // time we reach this line it cannot be false. /api stays reachable so auth
  // + server actions (including sign-out, and the onboarding submit action)
  // work.
  if (
    !canAccessApp(req.auth.user?.status ?? 'pending', true) &&
    !pathname.startsWith('/pending') &&
    !pathname.startsWith('/api')
  ) {
    return NextResponse.redirect(new URL('/pending', req.nextUrl))
  }

  // First-login gate: a user still on the admin-issued starter password is
  // pinned to /profile until they set their own (setOwnPassword clears the
  // flag; the jwt callback re-reads it per request, so the gate lifts on the
  // next navigation). /api stays reachable so auth + server actions work.
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
  // api/meetings is excluded for the same shape of reason: it serves files
  // (the .ics invite), and a file endpoint must answer with a status code its
  // caller can act on — a 307 to an HTML sign-in page would be downloaded as
  // the "invite". The route gates itself on auth() + canAccessApp and returns
  // 401/404 directly; see src/app/api/meetings/[id]/ics/route.ts.
  // Also skip PWA/static assets so install/manifest fetches don't redirect to
  // /sign-in. The extension list is explicit and end-anchored on purpose: a bare
  // `.*\.` exclusion skips the guard for ANY path containing a dot, so a request
  // like /apps/foo.bar would reach a page unauthenticated. The (app) layout also
  // redirects on a missing session as defense in depth.
  // home/privacy/terms are the public pages under src/app/(public): they hold
  // no workspace data, and Google's OAuth review team fetches all three with no
  // session before it will approve the sensitive calendar.events scope. Put
  // them back behind the guard and verification fails with a redirect, which
  // nothing else in the app would surface.
  matcher: [
    '/((?!api/auth|api/cron|api/meetings|_next/static|_next/image|sign-in|home|privacy|terms|pwa-icon|apple-icon|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|webmanifest|json|txt|xml|js|css|map|woff|woff2|ttf)$).*)',
  ],
}
