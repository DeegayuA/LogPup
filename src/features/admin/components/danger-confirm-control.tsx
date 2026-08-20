'use client'

import { useId, useState, useTransition, type ReactNode } from 'react'
import { Loader2Icon, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { matchesConfirm, type BlastRadius } from '@/features/admin/danger-logic'
import { cn } from '@/lib/utils'

/**
 * The one destructive control every card on /admin/danger is built from.
 *
 * Deliberately not an AlertDialog, for the reason DeleteAppCard already gives
 * (features/apps/components/delete-app-card.tsx): what survives, what does not,
 * and what the phrase is all have to stay readable WHILE the phrase is being
 * typed, not on a layer that replaced them.
 *
 * The enabled/disabled check here uses the SAME matchesConfirm the server
 * action calls. It decides nothing — whatever was typed is sent verbatim and
 * re-checked server-side against a freshly computed phrase — it only stops the
 * button promising a run that the action would refuse.
 */
export function DangerConfirmControl({
  title,
  lead,
  radius,
  phrase,
  phraseLabel,
  openLabel,
  confirmLabel,
  pendingLabel,
  emptyMessage,
  onConfirm,
  children,
}: {
  title: string
  /** One sentence of what this is, above the two lists. */
  lead: ReactNode
  radius: BlastRadius
  /** The exact text that must be typed. Empty disables the control entirely. */
  phrase: string
  /** How the phrase is described, e.g. "the project's address". */
  phraseLabel: string
  openLabel: string
  confirmLabel: string
  pendingLabel: string
  /** Shown instead of the control when there is nothing for it to act on. */
  emptyMessage?: string | null
  onConfirm: (confirm: string) => Promise<void>
  /** A target picker, rendered above the confirmation. */
  children?: ReactNode
}) {
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [pending, start] = useTransition()

  const matches = matchesConfirm(confirm, phrase)

  function close() {
    setOpen(false)
    setConfirm('')
  }

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4',
        radius.reversible ? 'border-border bg-card' : 'border-destructive/30 bg-destructive/5',
      )}
    >
      <h2
        id={`${inputId}-title`}
        className="flex items-center gap-2 font-heading text-sm font-semibold"
      >
        {radius.reversible ? null : (
          <TriangleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
        )}
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{lead}</p>

      <BlastRadiusLists radius={radius} />

      {emptyMessage ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <>
          {children}
          {open ? (
            <div className="flex flex-col gap-2">
              <label className="text-2xs text-muted-foreground" htmlFor={inputId}>
                Type {phraseLabel === '' ? null : <>{phraseLabel} </>}
                <span className="font-mono text-foreground">{phrase}</span> to confirm.
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={inputId}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder={phrase}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={pending}
                  className="h-9 w-full max-w-[280px] font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!matches || pending}
                  onClick={() => {
                    if (!matches) return
                    start(async () => {
                      await onConfirm(confirm)
                      close()
                    })
                  }}
                >
                  {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
                  {pending ? pendingLabel : confirmLabel}
                </Button>
                <Button type="button" variant="ghost" disabled={pending} onClick={close}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button
                variant={radius.reversible ? 'outline' : 'destructive'}
                disabled={phrase === ''}
                onClick={() => setOpen(true)}
              >
                {openLabel}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Both halves, always, in the same order. A control that only lists what it
 * destroys makes every operator reconstruct the other half from memory, and
 * the difference between these controls IS the other half.
 */
export function BlastRadiusLists({ radius }: { radius: BlastRadius }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {radius.destroys.length > 0 && (
        <div className="flex flex-col gap-1">
          <dt className="text-2xs font-medium tracking-wide text-destructive uppercase">
            {radius.reversible ? 'Removes' : 'Destroys permanently'}
          </dt>
          <dd>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground">
              {radius.destroys.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <dt className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
          Survives
        </dt>
        <dd>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground">
            {radius.survives.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  )
}
