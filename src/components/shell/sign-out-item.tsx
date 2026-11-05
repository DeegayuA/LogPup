'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

/**
 * "Sign out" through Auth.js's own /api/auth/signout endpoint, not a server
 * action. A server action POSTs to the current page, and proxy.ts answers a
 * request with no live session (expired, deactivated, removed) by redirecting
 * it to /sign-in — an HTML response the action client cannot read, so the
 * user got "An unexpected response was received from the server" and stayed
 * half signed out. /api/auth is outside the proxy matcher, so this works
 * whether the session is alive or already gone.
 */
export function SignOutItem() {
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  return (
    <DropdownMenuItem
      variant="destructive"
      closeOnClick={false}
      disabled={busy}
      onClick={() => {
        if (busy) return
        setBusy(true)
        void signOut({ redirectTo: '/sign-in' }).catch(() => {
          // Network failure: the cookie may still be set, so go to /sign-in
          // anyway; the proxy sends a live session back where it belongs.
          router.replace('/sign-in')
        })
      }}
    >
      <LogOut /> {busy ? 'Signing out…' : 'Sign out'}
    </DropdownMenuItem>
  )
}
