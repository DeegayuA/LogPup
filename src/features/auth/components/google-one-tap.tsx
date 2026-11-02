'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { ONE_TAP_OPTIONS, type OneTapConfig } from '../one-tap-options'

/**
 * Google One Tap: the prompt that offers an already-signed-in Google account in
 * the corner of the page, so a returning user is one click from a session
 * instead of a full OAuth redirect.
 *
 * It is a convenience layer over the existing button, never a replacement.
 * One Tap returns an ID token only — no OAuth scopes, no refresh token — so a
 * user who has never granted Calendar still has to press "Continue with
 * Google" once before they can schedule a meeting. The button therefore stays
 * primary, and this stays silent when it cannot help.
 *
 * Deliberately fails quiet. One Tap is suppressed by Google for reasons we
 * neither control nor need to explain: no Google session in the browser, a
 * previous dismissal still inside its cooldown, third-party cookies blocked, an
 * unsupported browser. Each is a normal outcome, and the page already offers a
 * working way in, so none deserves an error. Only a credential that Google
 * issued and our own server then refused is worth surfacing.
 */

type CredentialResponse = { credential?: string }

type GoogleIdApi = {
  accounts: {
    id: {
      initialize: (
        config: OneTapConfig & {
          client_id: string
          callback: (response: CredentialResponse) => void
        },
      ) => void
      prompt: () => void
      cancel: () => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdApi
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client'

export function GoogleOneTap({ clientId }: { clientId: string }) {
  const router = useRouter()

  useEffect(() => {
    if (!clientId) return

    const start = () => {
      const api = window.google
      if (!api) return
      api.accounts.id.initialize({
        ...ONE_TAP_OPTIONS,
        client_id: clientId,
        callback: async ({ credential }) => {
          if (!credential) return
          const result = await signIn('google-one-tap', { credential, redirect: false })
          if (result?.error) {
            // Google vouched for this person and our server still said no —
            // deactivated, rejected by an admin, or a token that failed
            // verification. Unlike a suppressed prompt, the user did act here,
            // so silence would read as a broken control.
            toast.error('That account cannot sign in. Try "Continue with Google".')
            return
          }
          // Navigate, don't just refresh. /sign-in is excluded from the proxy
          // matcher (it has to be — a signed-out visitor must be able to reach
          // it), so the guard never moves an authenticated user off this page.
          // refresh() alone therefore re-rendered the sign-in page with a
          // perfectly valid session, which from the outside looked exactly like
          // the prompt doing nothing at all.
          //
          // refresh() after push() is not redundant: while signed out, `/` was
          // rewritten to the public home page, so the client router may be
          // holding that entry. Without the refresh the user can land back on
          // the marketing page they just signed in from.
          router.push('/')
          router.refresh()
        },
      })
      api.accounts.id.prompt()
    }

    // One tick late on purpose. Strict Mode's mount → cleanup → mount clears
    // the first timer before any FedCM request exists, so there is exactly one
    // prompt and nothing for cancel() to abort (an abort is what GSI logs as
    // "FedCM get() rejects with AbortError").
    let timer: number | undefined
    const schedule = () => {
      timer = window.setTimeout(start, 0)
    }

    // Loaded by hand rather than through next/script: this component mounts on
    // exactly one page, and next/script's afterInteractive strategy keeps the
    // tag in the document across client navigations, leaving One Tap
    // initialized on pages that never asked for it.
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (window.google) {
      schedule()
    } else {
      // A tag from an earlier visit may still be loading, so wait on it rather
      // than assume it is ready.
      if (!script) {
        script = document.createElement('script')
        script.src = GSI_SRC
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }
      script.addEventListener('load', schedule)
    }

    return () => {
      // Leave the script cached in the document, but make sure no prompt opens
      // or outlives the page that asked for it: a load landing after the user
      // navigated away would otherwise prompt on whatever page they are on.
      window.clearTimeout(timer)
      script?.removeEventListener('load', schedule)
      window.google?.accounts.id.cancel()
    }
  }, [clientId, router])

  return null
}
