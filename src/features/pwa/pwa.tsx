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
 * `variant="icon"` is the sidebar-footer form: icon only, sized to sit beside
 * the account row, named for screen readers via aria-label.
 */
export function InstallButton({
  variant = 'default',
  className,
}: {
  variant?: 'default' | 'icon'
  className?: string
}) {
  const { canInstall, install } = useInstallPrompt()

  if (!canInstall) return null

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Install LogPup as an app"
        title="Install LogPup as an app"
        onClick={install}
        className={cn(
          'shrink-0 text-sidebar-foreground/70',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          'focus-visible:ring-sidebar-ring/60',
          className,
        )}
      >
        <Download />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      // The label collapses below `sm`, so name the button explicitly rather
      // than leaving a bare icon with no accessible name.
      aria-label="Install LogPup as an app"
      onClick={install}
      className={className}
    >
      <Download className="size-4" />
      <span className="hidden sm:inline">Install app</span>
    </Button>
  )
}
