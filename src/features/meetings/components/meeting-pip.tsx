'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check, Copy, Mic, MicOff, Pin, PinOff, PictureInPicture2, Square, Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The floating "meeting is still running" window — the surface Google Meet
 * shows when you switch tabs mid-call, built on the same API: Document
 * Picture-in-Picture. A real always-on-top browser window that holds DOM, not
 * the video-only PiP.
 *
 * WHAT IT IS FOR. While the meeting is off-screen you need to know three
 * things without going back: that it is still recording, that the mic is still
 * being heard, and that nothing is being lost. Everything in here answers one
 * of those, and the controls are the two that cannot wait — mute and stop.
 *
 * THREE WAYS IN, because the API is fussy about which one it will accept:
 *  - AUTO, on tab switch: Chrome fires the mediaSession
 *    'enterpictureinpicture' action for a tab capturing the mic when focus
 *    leaves it. This is the mechanism behind Meet's popup and the only door
 *    into requestWindow that does not need a click.
 *  - AUTO, best effort: `visibilitychange` and `blur` also try. They usually
 *    fail — requestWindow needs user activation and the browser refuses
 *    without it — but they cost nothing, they catch the case where activation
 *    is still sticky, and they are what makes this work when the mediaSession
 *    action is unavailable (a shared-audio recording with the mic muted, for
 *    instance, where Chrome may not treat the tab as capturing).
 *  - MANUAL, the toolbar button: works everywhere the API exists at all.
 *
 * Chrome/Edge only — the API does not exist in Safari or Firefox. Everything
 * feature-detects and renders nothing when absent, so other browsers keep
 * exactly today's behaviour.
 */

/** Remembered per browser: somebody who closes this popup three times does not
 *  want it, and re-opening it on every tab switch is the app arguing. */
const AUTO_KEY = 'logpup.meeting-pip.auto'

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

/** Reads never throw: a private window, or a browser set to block site data,
 *  makes the accessor itself raise. Default to ON — the feature is opt-out. */
function readAutoPref(): boolean {
  try {
    return window.localStorage.getItem(AUTO_KEY) !== 'off'
  } catch {
    return true
  }
}

function writeAutoPref(on: boolean) {
  try {
    window.localStorage.setItem(AUTO_KEY, on ? 'on' : 'off')
  } catch {
    // Nothing to do and nothing worth telling anybody — the preference simply
    // does not persist in this browser.
  }
}

/** Clone the page's styles + theme so the popup matches the app. */
function adoptStyles(pip: Window) {
  pip.document.documentElement.className = document.documentElement.className
  const theme = document.documentElement.getAttribute('data-theme')
  if (theme) pip.document.documentElement.setAttribute('data-theme', theme)
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n')
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

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export function MeetingPip({
  meetingTitle,
  recording,
  seconds,
  /** The whole live transcript so far. The popup scrolls it rather than
   *  clamping to a few lines — "is it still hearing me" is answered by
   *  watching text arrive, and four lines was not enough to watch. */
  transcript,
  micOn,
  canToggleMic,
  /** How many ~5-minute slices are already stored. This is the "nothing is
   *  being lost" answer, and it is the one thing here somebody cannot get by
   *  looking at the meeting tab. */
  savedSegments,
  onToggleMic,
  onStop,
}: {
  meetingTitle: string
  recording: boolean
  seconds: number
  transcript: string
  micOn: boolean
  canToggleMic: boolean
  savedSegments: number
  onToggleMic: () => void
  onStop: () => void
}) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  /** Read once, in the initializer rather than an effect: hydrating this in a
   *  useEffect meant one render with the wrong answer, and on a tab switch
   *  landing in that window the popup would open against somebody's stored
   *  "no". The server has no localStorage, but it never reaches this line —
   *  `supported` is false there and the component renders nothing. */
  const [autoOpen, setAutoOpen] = useState<boolean>(
    () => (typeof window === 'undefined' ? true : readAutoPref()),
  )
  /** Pinned popups survive coming back to the tab — for a second monitor,
   *  where the meeting tab being visible does not mean the popup is in the
   *  way. Unpinned is the default and the Meet behaviour. */
  const [pinned, setPinned] = useState(false)
  const [copied, setCopied] = useState(false)
  const supported = pipHost() !== null

  // The latest opener, reachable from long-lived browser callbacks without
  // re-registering them on every render.
  const openRef = useRef<() => void>(() => {})
  /** The same value, reachable from browser callbacks that outlive a render. */
  const autoRef = useRef(autoOpen)

  const open = useCallback(async () => {
    const host = pipHost()
    if (!host) return
    if (host.window) return // already open — one popup, not a stack
    try {
      // Taller than it was: the transcript is the point, and 220px left room
      // for four lines and nothing else.
      const pip = await host.requestWindow({ width: 400, height: 340 })
      adoptStyles(pip)
      pip.document.body.style.background = 'var(--background)'
      pip.document.body.style.margin = '0'
      // Fires for every way the window dies — this close(), the popup's own ✕,
      // and the browser reclaiming it. One path for all three.
      pip.addEventListener('pagehide', () => setPipWindow(null), { once: true })
      setPipWindow(pip)
    } catch {
      // No user activation, or the browser refused. Expected on the
      // best-effort paths below; nothing to clean up and nothing to report.
    }
  }, [])
  useEffect(() => {
    openRef.current = open
  })

  /** Only touches the external window. State is cleared by the popup's own
   *  'pagehide' listener, which keeps every effect here free of setState. */
  const close = useCallback(() => {
    pipHost()?.window?.close()
  }, [])

  const toggleAuto = useCallback(() => {
    setAutoOpen((was) => {
      const next = !was
      autoRef.current = next
      writeAutoPref(next)
      return next
    })
  }, [])

  // --- AUTO-OPEN ----------------------------------------------------------
  // The mediaSession action is the real door: while the mic is held, Chrome
  // routes a tab-switch through it WITH activation.
  useEffect(() => {
    if (!supported || !recording) return
    try {
      navigator.mediaSession.setActionHandler(
        'enterpictureinpicture' as MediaSessionAction,
        () => { if (autoRef.current) openRef.current() },
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

  // The best-effort half. These usually bounce off the activation requirement,
  // which is why they are additional rather than instead — but they cost one
  // rejected promise and they cover the recordings Chrome does not treat as
  // mic-capturing, where the mediaSession action never fires at all.
  useEffect(() => {
    if (!supported || !recording) return
    const tryOpen = () => {
      if (!autoRef.current) return
      if (document.visibilityState === 'visible' && document.hasFocus()) return
      void openRef.current()
    }
    document.addEventListener('visibilitychange', tryOpen)
    window.addEventListener('blur', tryOpen)
    return () => {
      document.removeEventListener('visibilitychange', tryOpen)
      window.removeEventListener('blur', tryOpen)
    }
  }, [supported, recording])

  // Coming back to the tab retires the popup, unless it is pinned. Stopping
  // the recording always does — there is nothing left for it to represent.
  useEffect(() => {
    if (!pipWindow) return
    if (!recording) {
      close()
      return
    }
    if (pinned) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') close()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [pipWindow, recording, pinned, close])

  // --- actions available only from inside the popup -----------------------

  const copyTranscript = useCallback(async () => {
    if (!transcript) return
    try {
      await navigator.clipboard.writeText(transcript)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard denied. The transcript is still on the meeting page, so
      // there is a way through that does not need a message here.
    }
  }, [transcript])

  /** Back to the meeting, in one move: focus the tab this popup came from and
   *  close the popup behind you. Without this the way back is hunting for the
   *  tab you left, which is the thing the popup exists to save you. */
  const returnToTab = useCallback(() => {
    window.focus()
    close()
  }, [close])

  if (!supported) return null

  return (
    <>
      <div className="inline-flex items-center gap-1">
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
        {/* The opt-out lives beside the button rather than inside the popup:
            somebody who wants to stop it appearing is, by definition, looking
            at the tab and not at the popup. */}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={toggleAuto}
          aria-pressed={autoOpen}
          title={
            autoOpen
              ? 'Pops out on its own when you switch tabs. Click to stop that.'
              : 'Only pops out when you press the button. Click to do it automatically.'
          }
        >
          {autoOpen ? <Pin aria-hidden /> : <PinOff aria-hidden />}
          <span className="sr-only">
            {autoOpen ? 'Turn off automatic pop-out' : 'Turn on automatic pop-out'}
          </span>
        </Button>
      </div>

      {pipWindow
        ? createPortal(
            <PipBody
              meetingTitle={meetingTitle}
              seconds={seconds}
              transcript={transcript}
              micOn={micOn}
              canToggleMic={canToggleMic}
              savedSegments={savedSegments}
              copied={copied}
              pinned={pinned}
              onTogglePin={() => setPinned((was) => !was)}
              onCopy={() => void copyTranscript()}
              onReturn={returnToTab}
              onToggleMic={onToggleMic}
              onStop={() => { onStop(); close() }}
            />,
            pipWindow.document.body,
          )
        : null}
    </>
  )
}

/**
 * The popup's own layout: a status header, the transcript, and the controls.
 *
 * Three rows in a fixed-height window, and the middle one takes whatever is
 * left. The header and footer never move, so the two things somebody glances
 * for — the clock and the stop button — are always in the same place however
 * much text has arrived.
 */
function PipBody({
  meetingTitle,
  seconds,
  transcript,
  micOn,
  canToggleMic,
  savedSegments,
  copied,
  pinned,
  onTogglePin,
  onCopy,
  onReturn,
  onToggleMic,
  onStop,
}: {
  meetingTitle: string
  seconds: number
  transcript: string
  micOn: boolean
  canToggleMic: boolean
  savedSegments: number
  copied: boolean
  pinned: boolean
  onTogglePin: () => void
  onCopy: () => void
  onReturn: () => void
  onToggleMic: () => void
  onStop: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  /** Only follow the text while the reader is already at the bottom. Yanking
   *  somebody back down while they are scrolled up reading an earlier line is
   *  worse than not following at all. */
  const pinnedToBottom = useRef(true)

  useEffect(() => {
    const node = scrollRef.current
    if (!node || !pinnedToBottom.current) return
    node.scrollTop = node.scrollHeight
  }, [transcript])

  const saved = useMemo(() => {
    if (savedSegments <= 0) return 'Saving as it goes'
    return `${savedSegments} part${savedSegments === 1 ? '' : 's'} saved`
  }, [savedSegments])

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full bg-destructive motion-safe:animate-pulse"
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium leading-tight" title={meetingTitle}>
            {meetingTitle || 'Recording'}
          </span>
          {/* Says where the audio goes, in the popup as well as on the page.
              A window that can be left open on a second monitor for an hour
              must not be the one surface that stops disclosing it. */}
          <span className="text-2xs leading-tight text-muted-foreground">
            Recording — audio goes to Gemini
          </span>
        </div>
        <span
          className="ml-auto shrink-0 font-mono text-sm tabular-nums"
          role="status"
          aria-label={`Recording for ${clock(seconds)}`}
        >
          {clock(seconds)}
        </span>
      </header>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const node = event.currentTarget
          pinnedToBottom.current =
            node.scrollHeight - node.scrollTop - node.clientHeight < 24
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-xs leading-relaxed text-muted-foreground"
      >
        {transcript || (
          <span className="italic">Listening — nothing said yet.</span>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border/70 px-3 py-2">
        <span className="mr-auto text-2xs text-muted-foreground" role="status">
          {saved}
        </span>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onCopy}
          disabled={transcript.length === 0}
          title="Copy what has been said so far"
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          <span className="sr-only">{copied ? 'Copied' : 'Copy transcript'}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onTogglePin}
          aria-pressed={pinned}
          title={
            pinned
              ? 'Stays open when you go back to the meeting tab'
              : 'Closes when you go back to the meeting tab'
          }
        >
          {pinned ? <Pin aria-hidden /> : <PinOff aria-hidden />}
          <span className="sr-only">{pinned ? 'Unpin' : 'Keep open'}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onReturn}
          title="Back to the meeting"
        >
          <Undo2 aria-hidden />
          <span className="sr-only">Back to the meeting</span>
        </Button>

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

        <Button variant="destructive" size="sm" type="button" onClick={onStop}>
          <Square aria-hidden />
          Stop
        </Button>
      </footer>
    </div>
  )
}
