'use client'

import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LK_TIMEZONE } from '@/lib/lk-holidays'
import {
  KIND_HEADINGS,
  MODE_LABELS,
  MODE_SUMMARIES,
  formatCountdown,
  formatWindowRange,
  type MaintenanceWindow,
} from '../window'
import { KIND_ICONS } from './maintenance-chrome'

/**
 * What the banner opens. READ-ONLY for everybody, including admins — the one
 * control on it is a door to the real controls, so that "let me read what this
 * says" and "let me change it" are never one misplaced click apart.
 *
 * Times are pinned to Asia/Colombo rather than the reader's own zone: the
 * window was chosen in the studio's working day, and a laptop still set to the
 * last trip's timezone should not be shown a different maintenance window from
 * the person sitting next to it.
 */
export function MaintenanceDetailsDialog({
  state,
  msRemaining,
  open,
  onOpenChange,
  canManage,
  onOpenControls,
}: {
  state: MaintenanceWindow
  msRemaining: number
  open: boolean
  onOpenChange: (open: boolean) => void
  canManage: boolean
  onOpenControls: () => void
}) {
  const Icon = KIND_ICONS[state.kind]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto print:hidden" data-maintenance>
        <DialogHeader>
          <span className="flex items-center gap-2 font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">
            <Icon aria-hidden className="size-3.5" />
            Planned maintenance
          </span>
          <DialogTitle className="font-heading text-[1.5rem] leading-[1.1] font-bold tracking-[-0.03em]">
            {KIND_HEADINGS[state.kind]}
          </DialogTitle>
          <DialogDescription className="sr-only">
            When this maintenance window runs and what it will stop.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl tabular-nums">{formatCountdown(msRemaining)}</span>
            <span className="text-sm text-muted-foreground">until it starts</span>
          </div>

          <p className="text-sm leading-relaxed text-foreground">{state.message}</p>

          {/* The aside idiom this codebase uses on its gate screens: a left
              rule rather than a filled box, so a second colour does not read
              as a second alarm. */}
          <dl className="flex flex-col gap-2 border-l-2 border-border pl-3 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Window</dt>
              <dd className="font-medium">
                {formatWindowRange(state.startAtMs, state.endAtMs, LK_TIMEZONE)}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Access</dt>
              <dd className="font-medium">
                {MODE_LABELS[state.mode]}
                <span className="ml-1 font-normal text-muted-foreground">
                  — {MODE_SUMMARIES[state.mode]}
                </span>
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Scheduled by</dt>
              <dd className="font-medium">{state.createdByName}</dd>
            </div>
          </dl>

          {canManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={onOpenControls}
            >
              <Settings2 aria-hidden />
              Maintenance controls
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
