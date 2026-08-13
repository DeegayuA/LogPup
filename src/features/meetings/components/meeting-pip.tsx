'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mic, MicOff, PictureInPicture2, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The floating "meeting is still running" window — the surface Google Meet
 * shows when you switch tabs mid-call, built on the same API: Document
 * Picture-in-Picture. A real always-on-top browser window that holds DOM,
 * not the video-only PiP.
 *
 * Two ways in, because the API demands it:
 *  - AUTO, on tab switch: Chrome fires the mediaSession
 *    'enterpictureinpicture' action for a tab that is capturing the mic when
 *    focus leaves it — the exact mechanism behind Meet's popup. Registered
 *    only while recording, unregistered after, so an idle LogPup tab never
 *    pops anything.
 *  - MANUAL, the toolbar button: requestWindow needs a user gesture in every
 *    other circumstance, so a plain visibilitychange listener could never
 *    open it — the browser rejects the call, by design. The button is the
 *    path that works everywhere the API exists at all.
 *
 * Chrome/Edge only — the API does not exist in Safari or Firefox. Everything
 * here feature-detects and renders nothing when absent, so other browsers
 * keep exactly today's behaviour.
 *
 * Coming back to the tab closes the popup: its one job is to represent the
 * meeting while the meeting is not on screen.
 */

// Not in TS's lib.dom yet — the shape of the API, declared locally.
type DocumentPipHost = {
  window: Window | null
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>
}

function pipHost(): DocumentPipHost | null {
  if (typeof window === 'undefined') return null
  const host = (window as unknown as { documentPictureInPicture?: DocumentPipHost })
    .documentPictureInPicture
  return host ?? null
}

/** Clone the page's styles + theme class so the popup matches the app. */
function adoptStyles(pip: Window) {
  pip.document.documentElement.className = document.documentElement.className
  const theme = document.documentElement.getAttribute('data-theme')
  if (theme) pip.document.documentElement.setAttribute('data-theme', theme)
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join('\n')
      const style = pip.document.createElement('style')
      style.textContent = rules
      pip.document.head.appendChild(style)
    } catch {
      // Cross-origin sheet: cssRules throws. Re-link it instead of reading it.
      const owner = sheet.ownerNode
      if (owner instanceof HTMLLinkElement) {
        const link = pip.document.createElement('link')
        link.rel = 'stylesheet'
        link.href = owner.href
        pip.document.head.appendChild(link)
      }
    }
  }
}

export function MeetingPip({
  recording,
  seconds,
  /** The last stretch of live transcript — what proves the mic is hearing. */
  tail,
  micOn,
  canToggleMic,
  onToggleMic,
  onStop,
}: {
  recording: boolean
  seconds: number
  tail: string
  micOn: boolean
  canToggleMic: boolean
  onToggleMic: () => void
  onStop: () => void
}) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  const supported = pipHost() !== null
  // The latest opener, reachable from long-lived browser callbacks without
  // re-registering them per render.
  const openRef = useRef<() => void>(() => {})

  const open = useCallback(async () => {
    const host = pipHost()
    if (!host) return
    if (host.window) return // already open — one popup, not a stack
    try {
      const pip = await host.requestWindow({ width: 360, height: 220 })
      adoptStyles(pip)
      pip.document.body.style.background = 'var(--background)'
      pip.document.body.style.margin = '0'
      // The browser fires pagehide when the popup is closed from its own ✕.
      pip.addEventListener('pagehide', () => setPipWindow(null), { once: true })
      setPipWindow(pip)
    } catch {
      // No gesture, or the browser refused — nothing to clean up.
    }
  }, [])
  useEffect(() => {
    openRef.current = open
  })

  // Only touches the external window. State is NOT cleared here — the popup's
  // own 'pagehide' listener does that, and it fires for every way the window
  // dies: this close(), the popup's ✕, and the browser reclaiming it. One
  // path for all three keeps the effect below free of setState.
  const close = useCallback(() => {
    pipHost()?.window?.close()
  }, [])

  // AUTO-OPEN — the Meet behaviour. While the mic is held, Chrome routes a
  // tab-switch through this mediaSession action WITH activation, which is the
  // one non-gesture door into requestWindow.
  useEffect(() => {
    if (!supported || !recording) return
    try {
      navigator.mediaSession.setActionHandler(
        'enterpictureinpicture' as MediaSessionAction,
        () => openRef.current(),
      )
    } catch {
      return // action unknown to this browser — the manual button still works
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler(
          'enterpictureinpicture' as MediaSessionAction,
          null,
        )
      } catch {
        // unregistering can only fail where registering already did
      }
    }
  }, [supported, recording])

  // Coming back to the tab, or stopping the recording, retires the popup.
  useEffect(() => {
    if (!pipWindow) return
    if (!recording) {
      close()
      return
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') close()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [pipWindow, recording, close])

  if (!supported) return null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => (pipWindow ? close() : void open())}
        aria-pressed={pipWindow !== null}
        title="Pop the recording out — it follows you to other tabs"
      >
        <PictureInPicture2 aria-hidden />
        <span className="sr-only sm:not-sr-only">Pop out</span>
      </Button>

      {pipWindow
        ? createPortal(
            <div className="flex h-dvh flex-col gap-2 p-3 text-foreground">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-destructive motion-safe:animate-pulse"
                />
                <span className="text-sm font-medium">Recording</span>
                <span className="ml-auto font-mono text-sm tabular-nums">
                  {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                </span>
              </div>
              {/* The tail, newest visible: proof the mic still hears without
                  needing the tab. Empty until the first utterance lands. */}
              <p className="min-h-0 flex-1 overflow-hidden text-xs leading-relaxed text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">
                {tail || 'Listening…'}
              </p>
              <div className="flex items-center gap-2">
                {canToggleMic ? (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={onToggleMic}
                    aria-pressed={micOn}
                  >
                    {micOn ? <Mic aria-hidden /> : <MicOff aria-hidden />}
                    {micOn ? 'Mic on' : 'Mic off'}
                  </Button>
                ) : null}
                <Button
                  variant="destructive"
                  size="sm"
                  type="button"
                  className="ml-auto"
                  onClick={() => {
                    onStop()
                    close()
                  }}
                >
                  <Square aria-hidden />
                  Stop
                </Button>
              </div>
            </div>,
            pipWindow.document.body,
          )
        : null}
    </>
  )
}
