'use client'

import { useEffect, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

/**
 * Redeems the Attendance Web App's handoff token for a LogPup session.
 *
 * Everything that DECIDES anything happens on the server, in the
 * 'attendance-sso' provider (src/lib/auth.ts). This component's whole job is
 * to hand the token over once, say something honest while it waits, and get
 * out of the way.
 *
 * `next` arrives already validated by the server page — see safeNext(). It is
 * accepted here as a plain string on the understanding that nothing else ever
 * passes one in.
 */
export function AttendanceSsoReceiver({ token, next }: { token: string; next: string }) {
  const [failed, setFailed] = useState(false)
  // EXACTLY ONCE, and this ref is not ceremony. The token is single-use by
  // design: the first redemption spends the jti and a second attempt with the
  // same token is correctly refused. React's development double-invoke of
  // effects is therefore enough, on its own, to make every local sign-in fail
  // — the first call succeeds and the second lands on the replay guard.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    // Drop the token from the address bar and from the back stack before the
    // network call, not after. It cannot be un-leaked once it is in the URL,
    // but it should not sit there being screenshotted, shoulder-read or
    // re-submitted while this page waits.
    try {
      window.history.replaceState(null, '', '/sso/attendance')
    } catch {
      // A browser that refuses replaceState is not a reason to refuse a login.
    }

    void (async () => {
      try {
        // redirect: false so a REFUSAL lands here rather than on Auth.js's own
        // error page, which would tell somebody arriving from another app that
        // "CredentialsSignin" happened.
        const result = await signIn('attendance-sso', { token, redirect: false })
        if (!result || result.error) {
          setFailed(true)
          return
        }
        // A full document load, not a client navigation: the session cookie
        // was just set by the callback response, and every server gate this
        // person is about to pass — src/proxy.ts, the (app) layout — reads it
        // per request. `replace` rather than `assign` so the handoff URL does
        // not become a back-button destination.
        window.location.replace(next)
      } catch {
        setFailed(true)
      }
    })()
  }, [token, next])

  useEffect(() => {
    if (!failed) return
    // The ordinary sign-in page, with the ordinary message. Someone whose
    // handoff expired in a background tab should see the door, not a diagnosis.
    const timer = setTimeout(() => window.location.replace('/sign-in?error=CredentialsSignin'), 1200)
    return () => clearTimeout(timer)
  }, [failed])

  return (
    <div className="flex flex-col items-center gap-3 text-center" aria-live="polite">
      {failed ? (
        <p className="text-sm text-muted-foreground">
          That sign-in link has expired. Taking you to the sign-in page…
        </p>
      ) : (
        <>
          <Loader2 aria-hidden className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none" />
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </>
      )}
    </div>
  )
}
