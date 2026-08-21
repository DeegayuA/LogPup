'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { armMaintenance, cancelMaintenance } from '../actions'
import {
  EXTEND_STEPS,
  KIND_LABELS,
  MAINTENANCE_KINDS,
  MAINTENANCE_MODES,
  MAINTENANCE_PRESETS,
  MODE_LABELS,
  MODE_SUMMARIES,
  autoMessage,
  defaultWindow,
  formatWindowSummary,
  fromDatetimeLocal,
  toDatetimeLocal,
  type MaintenanceKind,
  type MaintenanceMode,
  type MaintenanceWindow,
} from '../window'
import { KIND_ICONS } from './maintenance-chrome'

/**
 * The admin's whole surface for planned maintenance.
 *
 * THE INPUTS HOLD TEXT, NOT MILLISECONDS. A controlled datetime-local backed
 * by a number snaps the field back the instant a half-typed value fails to
 * parse, which makes it impossible to edit the hour without the field fighting
 * you. The text is the state; the milliseconds are derived, and null while the
 * value is not yet a real moment.
 *
 * TIMES ARE THE BROWSER'S OWN ZONE, because datetime-local has no other. The
 * admin arming this is in the studio's day, and everything the window is
 * announced with is formatted in Asia/Colombo from the same instants — see
 * window.ts.
 */
export function MaintenanceControls({
  current,
  nowMs,
  open,
  onOpenChange,
}: {
  current: MaintenanceWindow | null
  /**
   * The clock, passed in rather than read here.
   *
   * Every preset is "from now", so this component needs the time — but reading
   * Date.now() inside a component body is a render-time impurity whichever
   * function it sits in, and the linter is right that it cannot tell a preset
   * handler from a render path. The gate already holds a clock; this borrows
   * it, and the component becomes a pure function of its props.
   */
  nowMs: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const seed = current ?? { ...defaultWindow(nowMs), kind: 'maintenance' as const, mode: 'block' as const }

  const [startText, setStartText] = useState(() => toDatetimeLocal(seed.startAtMs))
  const [endText, setEndText] = useState(() => toDatetimeLocal(seed.endAtMs))
  const [kind, setKind] = useState<MaintenanceKind>(seed.kind)
  const [mode, setMode] = useState<MaintenanceMode>(seed.mode)
  /**
   * NULL MEANS "STILL AUTO-WRITTEN", and the message is derived below.
   *
   * The obvious shape — message in state, an effect rewriting it whenever the
   * window changes — is a cascading render, and worse, it is a second source of
   * truth for a string that is a pure function of the kind and the window. A
   * null draft says the automation still owns the field; anything else is the
   * admin's sentence, and an auto-write that overwrote it would lose a sentence
   * they meant. Seeded non-null when a window already carries a message,
   * because that message may well have been hand-written and this cannot tell.
   */
  const [draft, setDraft] = useState<string | null>(current?.message ? current.message : null)
  const [notifyNow, setNotifyNow] = useState(true)
  const [isSaving, startSaving] = useTransition()
  const [isCancelling, startCancelling] = useTransition()

  const startAtMs = fromDatetimeLocal(startText)
  const endAtMs = fromDatetimeLocal(endText)
  const valid = startAtMs !== null && endAtMs !== null && endAtMs > startAtMs
  const handEdited = draft !== null
  const message = draft ?? (valid ? autoMessage(kind, startAtMs, endAtMs) : '')

  function applyPreset(resolve: (at: number) => { startAtMs: number; endAtMs: number }) {
    const next = resolve(nowMs)
    setStartText(toDatetimeLocal(next.startAtMs))
    setEndText(toDatetimeLocal(next.endAtMs))
  }

  function extendBy(ms: number) {
    setEndText(toDatetimeLocal((endAtMs ?? nowMs) + ms))
  }

  function save() {
    if (!valid) return
    startSaving(async () => {
      const result = await armMaintenance({
        startAtMs,
        endAtMs,
        message: message.trim(),
        mode,
        kind,
        notifyNow,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(current ? 'Maintenance window updated' : 'Maintenance window scheduled', {
        description: formatWindowSummary(startAtMs, endAtMs),
      })
      onOpenChange(false)
    })
  }

  function cancel() {
    startCancelling(async () => {
      const result = await cancelMaintenance()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Maintenance cancelled')
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h-[90vh] with its own scroll: this form is taller than a laptop
          viewport once the presets and the message are on screen, and a dialog
          that overflows the window puts its own submit button out of reach. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg print:hidden" data-maintenance>
        <DialogHeader>
          <DialogTitle>Maintenance window</DialogTitle>
          <DialogDescription>
            {current
              ? 'A window is armed. Changing the end extends it without announcing it again.'
              : 'Nothing is armed. This closes LogPup for everyone but admins.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            {MAINTENANCE_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(preset.resolve)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maintenance-start">Starts</Label>
              <Input
                id="maintenance-start"
                type="datetime-local"
                value={startText}
                onChange={(event) => setStartText(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maintenance-end">Ends</Label>
              <Input
                id="maintenance-end"
                type="datetime-local"
                value={endText}
                onChange={(event) => setEndText(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Push the end back</span>
            {EXTEND_STEPS.map((step) => (
              <Button
                key={step.label}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => extendBy(step.ms)}
              >
                {step.label}
              </Button>
            ))}
          </div>

          <p
            className={cn(
              'border-l-2 pl-3 text-sm',
              valid ? 'border-border text-foreground' : 'border-destructive/40 text-destructive',
            )}
          >
            {startAtMs !== null && endAtMs !== null
              ? formatWindowSummary(startAtMs, endAtMs)
              : 'Pick a start and an end.'}
          </p>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">What is happening</span>
            <div className="flex flex-wrap gap-2">
              {MAINTENANCE_KINDS.map((option) => {
                const Icon = KIND_ICONS[option]
                return (
                  <Button
                    key={option}
                    type="button"
                    variant={kind === option ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={kind === option}
                    onClick={() => setKind(option)}
                  >
                    <Icon aria-hidden />
                    {KIND_LABELS[option]}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Who gets in</span>
            <RadioGroup
              aria-label="Access level"
              value={mode}
              onValueChange={(next) => setMode(next as MaintenanceMode)}
            >
              {MAINTENANCE_MODES.map((option) => (
                <Label key={option} className="flex items-start gap-2 font-normal">
                  <RadioGroupItem value={option} className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{MODE_LABELS[option]}</span>
                    <span className="text-xs text-muted-foreground">{MODE_SUMMARIES[option]}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="maintenance-message">What people are told</Label>
              {handEdited ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft(null)}
                >
                  <RotateCcw aria-hidden />
                  Auto-write
                </Button>
              ) : null}
            </div>
            <Textarea
              id="maintenance-message"
              rows={4}
              value={message}
              onChange={(event) => setDraft(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {handEdited
                ? 'Yours. It will not be rewritten when you change the window.'
                : 'Written from the kind and the window. Type to take it over.'}
            </p>
          </div>

          <Label className="flex items-center justify-between gap-3 font-normal">
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Notify everyone now</span>
              <span className="text-xs text-muted-foreground">
                One notification each, immediately. Starting and finishing are announced on their
                own.
              </span>
            </span>
            <Switch checked={notifyNow} onCheckedChange={setNotifyNow} aria-label="Notify everyone now" />
          </Label>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            {current ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isCancelling || isSaving}
                onClick={cancel}
              >
                {isCancelling ? 'Cancelling…' : 'Cancel maintenance'}
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" disabled={!valid || isSaving || isCancelling} onClick={save}>
              {isSaving ? 'Saving…' : current ? 'Update' : 'Schedule it'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
