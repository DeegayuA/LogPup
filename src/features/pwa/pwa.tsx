'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Registers the service worker so the app is installable. Renders nothing.
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Availability of the real one-click install flow. `canInstall` is only true
 * once the browser has actually fired `beforeinstallprompt` (Chrome/Edge/
 * Android) and the app is not already running standalone — so callers can
 * render nothing rather than a dead button. Safari/iOS never fires the event,
 * so `canInstall` stays false there by design.
 */
function useInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (standalone) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as InstallPromptEvent)
    }
    const onInstalled = () => setDeferred(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    // The captured event is single-use: drop it either way so a second click
    // cannot call prompt() again on a spent event.
    setDeferred(null)
    await deferred.prompt()
  }, [deferred])

  return { canInstall: deferred !== null, install }
}

/**
 * One-click install. Renders nothing at all unless the browser offered a real
 * install prompt — see useInstallPrompt.
 *
 * Icon-only everywhere it appears (sidebar footer on desktop, header on
 * phones) — there is no visible label, so the accessible name lives in
 * `aria-label`, backed by a `title` for the mouse-hover tooltip. `surface`
 * only changes the tint to match the background it sits on: `sidebar` for
 * the dark sidebar footer, `default` for the header's neutral surface.
 */
export function InstallButton({
  surface = 'default',
  className,
}: {
  surface?: 'default' | 'sidebar'
  className?: string
}) {
  const { canInstall, install } = useInstallPrompt()

  if (!canInstall) return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Install LogPup as an app"
      title="Install LogPup as an app"
      onClick={install}
      className={cn(
        'shrink-0',
        surface === 'sidebar' &&
          'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring/60',
        className,
      )}
    >
      <Download />
    </Button>
  )
}
