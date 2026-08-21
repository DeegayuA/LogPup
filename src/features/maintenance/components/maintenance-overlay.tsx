'use client'

import { useTransition } from 'react'
import { Eye, LogIn, Square } from 'lucide-react'
import { BrandMark } from '@/components/shell/brand-mark'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { LK_TIMEZONE } from '@/lib/lk-holidays'
import {
  KIND_HEADINGS,
  formatCountdown,
  formatMoment,
  type MaintenanceWindow,
} from '../window'
import { KIND_ICONS } from './maintenance-chrome'

/**
 * The screen a running window puts in front of the app.
 *
 * ABOVE EVERYTHING. z-[100] rather than the z-50 the dialogs share: a dialog
 * that was already open when the window started must not stay reachable on
 * top of the thing telling everyone the app is closed.
 *
 * WHAT IS CLICKABLE IS THE WHOLE DESIGN.
 *  - readonly — a way through, because the window only stops writing, and
 *    someone who just needs to read a meeting note should not be stopped.
 *  - block — admins through, nobody else. The screen says so.
 *  - lockdown — nothing at all, for anyone but an admin, and the screen says
 *    plainly that it cannot be dismissed rather than leaving people hunting
 *    for the close button that is not there.
 *
 * The buttons are what the UI enforces. The writes behind them are refused by
 * the database gate regardless of what any of this renders — see
 * src/db/write-gate.ts.
 */
export function MaintenanceOverlay({
  state,
  msRemaining,
  canManage,
  onEnterAnyway,
  onViewReadOnly,
  onEndNow,
}: {
  state: MaintenanceWindow
  msRemaining: number
  canManage: boolean
  onEnterAnyway: () => void
  onViewReadOnly: () => void
  onEndNow: () => Promise<void>
}) {
  const [isEnding, startEnding] = useTransition()
  const Icon = KIND_ICONS[state.kind]
  const dismissible = canManage || state.mode === 'readonly'

  return (
    <div
      data-maintenance
      role="dialog"
      aria-modal="true"
      aria-label={KIND_HEADINGS[state.kind]}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-background p-4 py-10 print:hidden"
    >
      <BrandMark />
      <Card className="w-full max-w-md">
        <CardHeader className="gap-3">
          <span className="flex items-center gap-2 font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">
            <Icon aria-hidden className="size-3.5" />
            {state.mode === 'lockdown' ? 'Locked down' : 'Maintenance'}
          </span>
          <h1 className="font-heading text-[1.75rem] leading-[1.05] font-bold tracking-[-0.03em]">
            {KIND_HEADINGS[state.kind]}
          </h1>
          <span aria-hidden className="rule-draw mt-1 block h-px w-full origin-left bg-border" />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-sm leading-relaxed text-muted-foreground">{state.message}</p>

          <div className="flex flex-col gap-1 border-l-2 border-border pl-3">
            <span className="font-mono text-3xl tabular-nums">{formatCountdown(msRemaining)}</span>
            <span className="text-sm text-muted-foreground">
              Expected back at {formatMoment(state.endAtMs, LK_TIMEZONE)}
            </span>
          </div>

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onEnterAnyway}>
                <LogIn aria-hidden />
                Enter anyway
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isEnding}
                onClick={() => startEnding(() => void onEndNow())}
              >
                <Square aria-hidden />
                {isEnding ? 'Ending…' : 'End maintenance now'}
              </Button>
            </div>
          ) : state.mode === 'readonly' ? (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={onViewReadOnly}>
              <Eye aria-hidden />
              View data read-only
            </Button>
          ) : null}

          {!dismissible ? (
            <p className="text-xs text-muted-foreground">
              {state.mode === 'lockdown'
                ? 'This screen cannot be dismissed. LogPup will let you back in on its own when the window ends.'
                : 'Only admins can get in while this is running. LogPup will let you back in on its own when the window ends.'}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground/70">
            Scheduled by {state.createdByName}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * The auth screens get this instead.
 *
 * /sign-in, /pending, /deactivated and /auth-error are NEVER hard-blocked. An
 * admin who is signed out when the window starts has to be able to sign in to
 * end it, and a full-screen overlay over the sign-in form is the one way to
 * make a maintenance window unrecoverable without a database console.
 */
export function MaintenanceAuthNotice({
  state,
  msRemaining,
  active,
}: {
  state: MaintenanceWindow
  msRemaining: number
  active: boolean
}) {
  const Icon = KIND_ICONS[state.kind]
  return (
    <div
      data-maintenance
      className="fixed inset-x-0 top-0 z-30 flex items-center justify-center gap-2 bg-muted px-4 py-2 text-center text-xs text-muted-foreground print:hidden"
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">
        {active
          ? `${KIND_HEADINGS[state.kind]} is running. Signing in still works.`
          : `${KIND_HEADINGS[state.kind]} in`}
      </span>
      {active ? null : <span className="font-mono tabular-nums">{formatCountdown(msRemaining)}</span>}
    </div>
  )
}
