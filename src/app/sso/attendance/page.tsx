import { redirect } from 'next/navigation'
import { safeNext } from '@/lib/safe-next'
import { auth } from '@/lib/auth'
import { AttendanceSsoReceiver } from '@/features/auth/components/attendance-sso-receiver'

export const metadata = { title: 'Signing you in' }

// Never prerendered: every visit carries a different one-time token, and a
// cached copy of this page would be a cached copy of somebody's handoff.
export const dynamic = 'force-dynamic'

/**
 * The receiving end of the Attendance Web App's sign-in handoff.
 *
 * LIVES OUTSIDE THE (app) ROUTE GROUP, AND OUTSIDE src/proxy.ts's matcher, and
 * both are load-bearing. This page runs for somebody who is NOT signed in yet
 * — that is the entire point of it — so a gate that bounced it to /sign-in
 * would make the handoff a redirect loop that never redeems anything. The
 * failure only appears in the signed-out case, which is the one nobody tests
 * by hand because their own browser is always already signed in. `sso` is
 * excluded in the proxy matcher next to `sign-in` for exactly this reason.
 *
 * mustChangePassword is deliberately LEFT ALONE: somebody arriving by SSO has
 * still not typed their starter password, so the proxy pinning them to
 * /profile afterwards remains correct.
 */
export default async function AttendanceSsoPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await props.searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

  const token = first(raw.token)

  // Validated HERE, on the server, before the value can reach a navigation.
  // An unvalidated `next` is an open redirect, and an open redirect on a
  // sign-in route is the classic way to harvest a session — bounce somebody to
  // a lookalike host at the moment they expect to land somewhere new.
  const next = safeNext(first(raw.next))

  // ALREADY SIGNED IN → straight through, token left unspent. The common case
  // for a PWA: the handoff was never needed. Without this, any refusal of the
  // token (expired, replayed, out of scope) sent the receiver to /sign-in, and
  // /sign-in does not bounce a signed-in visitor — so a person with a perfectly
  // good LogPup session landed on the login page. This lands them as whoever
  // is signed in here, exactly as opening LogPup directly would; proxy.ts
  // still applies its pending/deactivated gates on the way to `next`.
  if ((await auth())?.user) redirect(next)

  // No token at all is not an error worth a page — it is somebody who opened a
  // bare URL, and the sign-in page is what they actually wanted.
  if (!token) redirect('/sign-in')

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <AttendanceSsoReceiver token={token} next={next} />
    </main>
  )
}
