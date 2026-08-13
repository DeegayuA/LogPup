'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { startAuthentication } from '@simplewebauthn/browser'
import { Fingerprint, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { beginPasskeyLogin, completePasskeyLogin } from '@/features/auth/webauthn-actions'

/**
 * One-tap sign-in for anyone who has registered a passkey (settings →
 * Passkeys). Three hops, all invisible to the user: fetch a challenge, let
 * the platform authenticator answer it (Touch ID / Face ID / Windows Hello /
 * a phone), then trade the verified assertion's one-time token through the
 * 'passkey' NextAuth provider for a real session.
 *
 * Renders unconditionally: WebAuthn exists in every current browser, and
 * whether a passkey EXISTS for this device is knowable only by asking —
 * which is what the tap does. A cancelled sheet is silent (that includes
 * "I have no passkey here — never mind"); a failed verification is a toast.
 */
export function PasskeyLoginButton() {
  const [busy, setBusy] = useState(false)

  async function loginWithPasskey() {
    setBusy(true)
    try {
      const options = await beginPasskeyLogin()
      if (!options.ok) {
        toast.error(options.error)
        return
      }
      let assertion
      try {
        assertion = await startAuthentication(options.data)
      } catch {
        // The user closed the sheet — their decision, not an error.
        return
      }
      const verified = await completePasskeyLogin(assertion)
      if (!verified.ok) {
        toast.error(verified.error)
        return
      }
      await signIn('passkey', { token: verified.data.token, callbackUrl: '/' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="w-full"
        onClick={loginWithPasskey}
        disabled={busy}
      >
        {busy ? (
          <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Fingerprint aria-hidden />
        )}
        Sign in with a passkey
      </Button>
      {/* The browser's own "no passkeys for this site" sheet is a dead end
          with no directions — these are the directions. A passkey attaches
          to an account, so the first visit has to come in another door. */}
      <p className="text-center text-xs text-muted-foreground">
        First time? Sign in with Google or password, then add a passkey in Settings.
      </p>
    </div>
  )
}
