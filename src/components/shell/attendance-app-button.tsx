'use client'

import { useState } from 'react'
import { CalendarCheck, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * Where Attendance lives, for the FALLBACK path only.
 *
 * Hardcoded rather than read from the env var the route uses, and that is not
 * an oversight: this value is needed exactly when the request to that route
 * failed, so it cannot come from the response. Attendance's SolarAppButton
 * hardcodes its counterpart for the same reason. If the deployment ever moves,
 * both this and ATTENDANCE_APP_URL change together.
 */
const ATTENDANCE_URL = 'https://attendance.altavision.lk'

/**
 * Opens the Attendance Web App, signed in, in one tap.
 *
 * The interaction model is copied from Attendance's own SolarAppButton rather
 * than invented here, because three of its details were paid for in production
 * and none of them is obvious:
 *
 *  1. A TOP-LEVEL NAVIGATION ON TOUCH DEVICES, a new tab on desktop. Only a
 *     top-level navigation triggers OS link-capturing, so an installed
 *     Attendance PWA opens in the installed app instead of a browser tab. A
 *     redirected about:blank popup is not captured.
 *  2. THE DESKTOP PLACEHOLDER TAB IS OPENED SYNCHRONOUSLY, before the await, or
 *     the browser blocks it as a popup. It is opened WITHOUT `noopener`: with
 *     it, window.open returns null, the handle is lost and an orphaned blank
 *     tab is left behind. `opener` is severed afterwards instead.
 *  3. EVERY FAILURE FALLS BACK TO THE PLAIN URL. This is the part that matters
 *     most and is the easiest to drop. Both apps are PWAs with persistent
 *     sessions, so the overwhelmingly common case is that the person is
 *     ALREADY signed in at the other end and the SSO round trip was never
 *     needed. A broken handoff should cost a click, not a journey.
 */
export function AttendanceAppButton({
  collapsed = false,
  next = '/tasks',
  onNavigate,
}: {
  /** Icon-rail form, matching NavLink's. */
  collapsed?: boolean
  /**
   * Where to land inside Attendance. Validated again on both servers — this is
   * a default, not a trust boundary.
   */
  next?: string
  /** Lets the mobile sheet close itself as the navigation starts. */
  onNavigate?: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function open() {
    if (loading) return
    onNavigate?.()

    const handoff = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    // Opened here, synchronously, while we are still inside the click. See (2).
    const win = handoff ? null : window.open('about:blank', '_blank')
    const go = (url: string) => {
      if (handoff) window.location.href = url
      else if (win) {
        win.opener = null
        win.location.href = url
      } else window.open(url, '_blank', 'noopener,noreferrer')
    }

    setLoading(true)
    try {
      const res = await fetch('/api/sso/attendance-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next }),
      })
      if (!res.ok) throw new Error('handoff failed')
      const data = await res.json()
      if (!data?.url) throw new Error('handoff returned no url')
      go(data.url)
    } catch {
      // Not an error worth a red toast: the person is probably already signed
      // in over there, and they asked to go to Attendance, not to hear about
      // our token exchange. Send them where they asked, and say why the door
      // might ask for a password.
      go(`${ATTENDANCE_URL}${next}`)
      toast('Opened Attendance — you may need to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      // Same bonus-only tooltip the rail's links carry: the label below stays
      // in the accessibility tree either way.
      title={collapsed ? 'Attendance' : undefined}
      className={cn(
        'group relative flex items-center rounded-xl py-2 text-xs font-medium transition-[background-color,color,box-shadow] duration-150 disabled:opacity-60 motion-reduce:transition-none',
        'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
        collapsed ? 'justify-center px-2' : 'w-full gap-2.5 px-3',
      )}
    >
      {loading ? (
        <Loader2
          aria-hidden
          className="size-4 shrink-0 animate-spin text-sidebar-foreground/70 motion-reduce:animate-none"
        />
      ) : (
        <CalendarCheck
          aria-hidden
          className="size-4 shrink-0 text-sidebar-foreground/70 transition-colors group-hover:text-sidebar-foreground"
        />
      )}
      {/* sr-only, never `hidden` — an icon rail whose rows have no accessible
          name is a list of unlabelled buttons. */}
      <span className={cn(collapsed ? 'sr-only' : 'truncate')}>Attendance</span>
      {collapsed ? null : (
        <ExternalLink aria-hidden className="ml-auto size-3.5 shrink-0 opacity-60" />
      )}
    </button>
  )
}
