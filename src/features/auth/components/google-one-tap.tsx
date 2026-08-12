'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'

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
      initialize: (config: {
        client_id: string
        callback: (response: CredentialResponse) => void
        auto_select?: boolean
        cancel_on_tap_outside?: boolean
        context?: 'signin' | 'signup' | 'use'
        use_fedcm_for_prompt?: boolean
      }) => void
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
  // React Strict Mode mounts effects twice in development. Without this guard
  // the second mount calls initialize() again mid-prompt, which Google answers
  // by tearing the prompt down — One Tap would flicker and vanish every time,
  // but only locally, which is the worst kind of bug to chase.
  const started = useRef(false)

  useEffect(() => {
    if (started.current || !clientId) return
    started.current = true

    const start = () => {
      const api = window.google
      if (!api) return
      api.accounts.id.initialize({
        client_id: clientId,
        // FedCM is required: Chrome has removed the legacy third-party-cookie
        // path One Tap relied on, so without this the prompt never appears in
        // a current Chrome at all.
        use_fedcm_for_prompt: true,
        // Never sign someone in without a deliberate click. auto_select would
        // resume the last account on page load, which on a shared machine means
        // signing in as whoever used it last.
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
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

    // Loaded by hand rather than through next/script: this component mounts on
    // exactly one page, and next/script's afterInteractive strategy keeps the
    // tag in the document across client navigations, leaving One Tap
    // initialized on pages that never asked for it.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (existing) {
      start()
      return
    }

    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = start
    document.head.appendChild(script)

    return () => {
      // Leave the script cached in the document, but close any open prompt so
      // it cannot outlive the page that opened it.
      window.google?.accounts.id.cancel()
    }
  }, [clientId, router])

  return null
}
