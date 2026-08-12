import { cache } from 'react'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'

/**
 * REQUEST DEDUPLICATION for the session read.
 *
 * `auth()` is not free: its `jwt` callback in lib/auth.ts hits the database on
 * every single call (deliberately — that is what makes an approval or a
 * password change take effect on the very next request without a re-login).
 * That cost is per *call*, not per request, and a single dashboard render
 * currently calls it three times: the (app) layout, `NotificationBell` inside
 * the header, and the page body — three identical
 * `select … from users where email = ?` round trips for one page.
 *
 * Splitting a page into `<Suspense>` boundaries multiplies that further: every
 * streamed section that needs to know who is signed in is another call.
 *
 * `React.cache` is per-request memoisation, so the first caller in a render
 * pays for the read and every later caller in that same request gets the
 * resolved value. It is deduplication, not caching in the stale-data sense —
 * nothing survives the request, so one viewer's session can never be handed to
 * another's render, and the "reads the DB on every session" guarantee above is
 * preserved exactly (it is still once per request).
 *
 * Prefer this over importing `auth` directly in anything that renders. Server
 * actions and route handlers may keep using `auth()` — each invocation is its
 * own request, so there is nothing to share.
 */
export const getSession = cache(async function getSession(): Promise<Session | null> {
  return auth()
})

/** The signed-in user, or null. Deduplicated via {@link getSession}. */
export async function getSessionUser(): Promise<Session['user'] | null> {
  return (await getSession())?.user ?? null
}
