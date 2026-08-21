'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { ROLE_GRANTS, type UserRole } from '@/features/auth/capabilities'
import { useSmartPoll } from '@/hooks/use-smart-poll'
import { OPEN_CONTROLS_EVENT } from '../events'
import { endMaintenanceNow, fetchMaintenanceWindow } from '../actions'
import {
  maintenancePhase,
  nextPhaseChangeAtMs,
  type MaintenanceWindow,
} from '../window'
import { MaintenanceBanner } from './maintenance-banner'
import { MaintenanceDetailsDialog } from './maintenance-details-dialog'
import { MaintenanceAuthNotice, MaintenanceOverlay } from './maintenance-overlay'
import { MaintenanceControls } from './maintenance-controls'

/**
 * The console command, and the hash of the password that opens it.
 *
 * ONLY THE HASH IS IN THE BUNDLE. The plaintext never appears in the source,
 * the build output or git history — `crypto.subtle.digest` hashes whatever was
 * typed and the comparison happens against this constant.
 *
 * THIS IS CONVENIENCE, NOT SECURITY, AND THE COMMENT MUST STAY HONEST ABOUT
 * IT. Anyone can read this hash, and anyone can read the code that checks it.
 * What actually stops a non-admin arming maintenance is `maintenance.manage`
 * in the capability matrix, checked in the server action — and what stops a
 * non-admin writing THROUGH a window is the database gate in
 * src/db/write-gate.ts. The password exists so the command is not something
 * somebody discovers by typing into a console, nothing more.
 *
 * Overridable via NEXT_PUBLIC_MAINTENANCE_HASH so it can be rotated without a
 * code change. The literal member access is deliberate: Next inlines
 * process.env.NEXT_PUBLIC_* at build time only when it is written out in full.
 */
const DEFAULT_PASSWORD_HASH = 'ec06d30688939fca5880b2089c4db15eb0a281125cc9da2c36dab14b1a3702b4'
const PASSWORD_HASH = process.env.NEXT_PUBLIC_MAINTENANCE_HASH || DEFAULT_PASSWORD_HASH


const BANNER_STYLE = 'background:#7f1d1d;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700'

/**
 * Routes that are NEVER hard-blocked.
 *
 * An admin who was signed out when the window started has to be able to sign
 * in to end it. Covering the sign-in form with an uncloseable overlay is the
 * one way to make a maintenance window unrecoverable without a database
 * console, so these get the slim notice instead.
 */
const AUTH_PATHS = ['/sign-in', '/pending', '/deactivated', '/auth-error']

/** The document routes. Maintenance chrome has no business on a printed A4. */
const PRINT_PATHS = ['/print']

type Bypass = 'admin' | 'readonly'

function bypassKey(startAtMs: number): string {
  return `logpup.maintenance.bypass.${startAtMs}`
}

/** sessionStorage does not emit events for its own tab; nothing to subscribe to. */
const NEVER_CHANGES = () => () => {}

function readStoredBypass(startAtMs: number | null): string | null {
  if (startAtMs === null) return null
  try {
    return sessionStorage.getItem(bypassKey(startAtMs))
  } catch {
    // Private mode, or storage disabled. No bypass, which is the safe answer.
    return null
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function canManageMaintenance(role: UserRole | null): boolean {
  return role !== null && ROLE_GRANTS['maintenance.manage'][role] === 'all'
}

function sameWindow(a: MaintenanceWindow | null, b: MaintenanceWindow | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.enabled === b.enabled &&
    a.startAtMs === b.startAtMs &&
    a.endAtMs === b.endAtMs &&
    a.mode === b.mode &&
    a.kind === b.kind &&
    a.message === b.message
  )
}

const POLL_BASE_MS = 30_000
const POLL_MAX_MS = 5 * 60_000

/**
 * Everything the app-wide maintenance UI decides, in one client component
 * mounted once in the root layout.
 *
 * IT RENDERS NOTHING UNTIL IT HAS MOUNTED. Every surface here is a function of
 * `Date.now()` and of the browser's timezone, neither of which the server
 * agrees with — server-rendering a countdown produces a hydration mismatch on
 * every load, and formatting a 20:00 window on a UTC server announces it as
 * 14:30. Waiting one frame costs a blocking overlay a few hundred milliseconds
 * and is not what stops writes: the freeze is enforced in the database gate,
 * not here.
 */
export function MaintenanceGate({
  initialWindow,
  role,
}: {
  initialWindow: MaintenanceWindow | null
  role: UserRole | null
}) {
  const pathname = usePathname()
  const [now, setNow] = useState(() => Date.now())
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)
  /** Keyed by the window it was granted for, so a new window re-asks. */
  const [granted, setGranted] = useState<{ startAtMs: number; value: Bypass } | null>(null)

  const canManage = canManageMaintenance(role)

  // "Has this hydrated yet", without a setState in an effect. The server
  // snapshot is false and the client's is true, so the first client render
  // after hydration flips it — the documented shape for a value that only
  // exists in the browser.
  const mounted = useSyncExternalStore(NEVER_CHANGES, () => true, () => false)

  const poll = useCallback(() => fetchMaintenanceWindow(), [])
  const state = useSmartPoll<MaintenanceWindow | null>(poll, initialWindow, {
    baseMs: POLL_BASE_MS,
    maxMs: POLL_MAX_MS,
    isEqual: sameWindow,
  })

  const phase = maintenancePhase(state, now)

  /**
   * THE BYPASS IS RE-EARNED ON EVERY RENDER, NOT REMEMBERED.
   *
   * sessionStorage outlives a sign-out on the same tab, so a flag left by an
   * admin who signed out and handed the laptop over would otherwise show the
   * next person "End maintenance now". The stored value is only ever a hint —
   * the seat is re-checked HERE, against the session rendering right now, and
   * it is checked on every render rather than once on mount, so a role that
   * changes mid-session cannot leave the earlier answer standing.
   */
  const stored = useSyncExternalStore(
    NEVER_CHANGES,
    () => readStoredBypass(state?.startAtMs ?? null),
    () => null,
  )
  const claimed = granted && state && granted.startAtMs === state.startAtMs ? granted.value : stored
  const bypass: Bypass | null =
    claimed === 'admin'
      ? canManage
        ? 'admin'
        : null
      : claimed === 'readonly' && state?.mode === 'readonly'
        ? 'readonly'
        : null

  /**
   * A stale admin flag is DELETED, not merely ignored.
   *
   * Ignoring it leaves it there for the next admin sign-in on this tab to pick
   * up silently, letting somebody through a window they never chose to enter.
   * No setState here — the render above has already refused to honour it.
   */
  useEffect(() => {
    if (!state || stored !== 'admin' || canManage) return
    try {
      sessionStorage.removeItem(bypassKey(state.startAtMs))
    } catch {
      // Nothing to do; the render path already refused it.
    }
  }, [state, stored, canManage])

  const rememberBypass = useCallback(
    (value: Bypass) => {
      if (!state) return
      try {
        sessionStorage.setItem(bypassKey(state.startAtMs), value)
      } catch {
        // The bypass still applies for this page; it just will not survive a
        // navigation. Better than refusing to let somebody through at all.
      }
      setGranted({ startAtMs: state.startAtMs, value })
    },
    [state],
  )

  const onAuthScreen = AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const onPrintScreen = PRINT_PATHS.some((path) => pathname.startsWith(path))

  const blocking = phase === 'active' && bypass === null && !onAuthScreen && !onPrintScreen
  const showBanner = phase === 'scheduled' && !onPrintScreen

  // Ticking one second at a time is only ever justified by a countdown someone
  // can see. An admin who entered anyway, a printed page, an ended window: all
  // of them get no interval at all.
  const countdownVisible = mounted && (showBanner || blocking || (detailsOpen && phase !== 'off'))

  useEffect(() => {
    if (!countdownVisible) return
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [countdownVisible])

  /**
   * A one-shot timer to the next phase change, separate from the tick above.
   *
   * Without it a window whose countdown is NOT on screen — an admin who
   * bypassed, a quiet /print tab — would never notice that it had started or
   * ended, because nothing would move `now` again. Deliberately keyed on the
   * phase rather than on `now`, or the one-second tick would re-arm it a
   * thousand times an hour.
   */
  useEffect(() => {
    const at = nextPhaseChangeAtMs(state, Date.now())
    if (at === null) return
    const id = setTimeout(() => setNow(Date.now()), Math.max(0, at - Date.now()) + 50)
    return () => clearTimeout(id)
  }, [state, phase])

  /** The console door. Registered on every route, including /sign-in. */
  useEffect(() => {
    const target = window as typeof window & { maintenance?: (password: string) => Promise<void> }
    target.maintenance = async (password: string) => {
      const typed = typeof password === 'string' ? password : ''
      const passwordOk = typed !== '' && (await sha256Hex(typed)) === PASSWORD_HASH
      const seat = role ?? 'signed out'

      if (!passwordOk && !canManage) {
        console.error(
          '%c MAINTENANCE ',
          BANNER_STYLE,
          `Refused on both counts. That is not the maintenance password, and this session is ${seat} — maintenance controls need the admin or superadmin seat.`,
        )
        return
      }
      if (!passwordOk) {
        console.error('%c MAINTENANCE ', BANNER_STYLE, 'That is not the maintenance password.')
        return
      }
      if (!canManage) {
        console.error(
          '%c MAINTENANCE ',
          BANNER_STYLE,
          `Password accepted, but this session is ${seat}. Maintenance controls need the admin or superadmin seat — and the server refuses the write regardless of what this console does.`,
        )
        return
      }
      setControlsOpen(true)
    }
    return () => {
      delete target.maintenance
    }
  }, [role, canManage])

  /** The ⌘K row opens the same popup, without a handle on this component. */
  useEffect(() => {
    if (!canManage) return
    const open = () => setControlsOpen(true)
    window.addEventListener(OPEN_CONTROLS_EVENT, open)
    return () => window.removeEventListener(OPEN_CONTROLS_EVENT, open)
  }, [canManage])

  const msToStart = useMemo(() => (state ? state.startAtMs - now : 0), [state, now])
  const msToEnd = useMemo(() => (state ? state.endAtMs - now : 0), [state, now])

  if (!mounted) return null

  return (
    <>
      {/*
        THE PRINT ESCAPE, scoped to this component because it has to be.
        `body { padding-top }` is set inline by the banner, and no stylesheet
        class can outrank an inline style — only `!important` inside a media
        query can. The `display` rule is belt and braces on top of the
        `print:hidden` each element already carries: a `dark:bg-*` utility
        compiles to `.dark .x`, two classes, which outranks a single-class
        `print:*` utility, so anything relying on a print utility to repaint a
        dark shell needs the same !important treatment. A PDF produced during a
        window has to come out as the document, never as the overlay.
      */}
      <style>{`@media print{body{padding-top:0 !important}[data-maintenance]{display:none !important}}`}</style>

      {state && onAuthScreen && phase !== 'off' && phase !== 'ended' ? (
        <MaintenanceAuthNotice state={state} msRemaining={msToStart} active={phase === 'active'} />
      ) : null}

      {state && showBanner && !onAuthScreen ? (
        <MaintenanceBanner
          state={state}
          msRemaining={msToStart}
          onOpenDetails={() => setDetailsOpen(true)}
        />
      ) : null}

      {state && blocking ? (
        <MaintenanceOverlay
          state={state}
          msRemaining={msToEnd}
          canManage={canManage}
          onEnterAnyway={() => rememberBypass('admin')}
          onViewReadOnly={() => rememberBypass('readonly')}
          onEndNow={async () => {
            const result = await endMaintenanceNow()
            if (result.ok) setNow(Date.now())
          }}
        />
      ) : null}

      {state ? (
        <MaintenanceDetailsDialog
          state={state}
          msRemaining={msToStart}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          canManage={canManage}
          onOpenControls={() => {
            setDetailsOpen(false)
            setControlsOpen(true)
          }}
        />
      ) : null}

      {canManage && controlsOpen ? (
        <MaintenanceControls current={state} nowMs={now} open onOpenChange={setControlsOpen} />
      ) : null}
    </>
  )
}
