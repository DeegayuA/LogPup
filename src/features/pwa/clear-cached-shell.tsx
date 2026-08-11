'use client'

import { useEffect } from 'react'

/**
 * Drops every LogPup Cache Storage entry once the browser is on the
 * signed-out page. Renders nothing.
 *
 * Cache Storage is scoped to the origin, not to the session: it outlives
 * sign-out and is shared by everyone using the browser profile. The service
 * worker no longer stores anything user-specific (see public/sw.js), but an
 * install still running an older worker can be holding cached authenticated
 * documents, so wipe on the way out rather than waiting for that worker to be
 * replaced.
 *
 * Mounted on /sign-in because that is where both sign-out paths land — the
 * header's `signOut({ redirectTo: '/sign-in' })` form action and the command
 * palette's `signOutFromPalette` — which also covers an expired session and a
 * proxy.ts redirect.
 */
export function ClearCachedShell() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('caches' in window)) return
    // Done from the page, not only via the worker, so it still happens when no
    // service worker controls this client.
    void caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {})
    navigator.serviceWorker?.controller?.postMessage({ type: 'logpup-clear-cache' })
  }, [])

  return null
}
