'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Fingerprint, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Client half of PasskeyNudge. The server decided this should render; the
 * only state here is the user clicking ✕ — an event handler, so plain
 * setState with no effect gymnastics. The cookie makes the dismissal stick
 * across sessions; the local state makes it instant.
 */
export function PasskeyNudgeBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <Fingerprint aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
        Make your next sign-in one tap — add a passkey (Touch ID, Face ID or your phone) in
        Settings.
      </p>
      <Button size="sm" render={<Link href="/settings" />}>
        Add a passkey
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Dismiss passkey suggestion"
        onClick={() => {
          // A year, not forever: devices change, and re-asking annually is a
          // feature for an auth method people forget exists.
          document.cookie = 'logpup-passkey-nudge=1;path=/;max-age=31536000;samesite=lax'
          setDismissed(true)
        }}
      >
        <X aria-hidden />
      </Button>
    </div>
  )
}
