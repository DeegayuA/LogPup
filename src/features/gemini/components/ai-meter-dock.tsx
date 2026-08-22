'use client'

/**
 * The corner the live AI meter lives in.
 *
 * It has one job and one prohibition. The job: while any AI call is running,
 * say what is running, what it is expected to cost, and — once the answer is
 * back and this app's own ledger has caught up — what it actually did cost.
 * The prohibition: never show a number nobody measured.
 *
 * That prohibition is why there is no progress bar anywhere below, and why
 * there never can be. A bar needs a denominator, and the two denominators this
 * UI would want are both unavailable. Tokens do not exist until the response
 * arrives (there is no streaming client — see ai-meter.ts), so a bar filling
 * during the call would be animating a guess. And Google enforces the free
 * tier per PROJECT, per minute and per day, publishing no endpoint for what is
 * left, so a "quota remaining" bar would be inferred from local records and
 * wrong the moment the same key is used from a script or a second deployment.
 *
 * Motion reads as evidence, which is exactly why it is spent on the one thing
 * that is genuinely true — this panel came from that button, and it is still
 * working — and on nothing that resembles a measurement.
 */

import * as React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, ChevronDown, Loader2, TriangleAlert, X } from 'lucide-react'

import { formatUsd } from '@/features/gemini/pricing'
import { meterView } from '@/features/gemini/ai-meter'
import { dockView, flightDelta, type MeterTask } from '@/features/gemini/meter-tasks'
import type { MeterContext } from '@/features/gemini/meter-actions'
import { cn } from '@/lib/utils'

/* globals.css: --ease-enter / --ease-exit, --dur-base / --dur-slow. Restated
   as arrays because motion animates JS values, not CSS transitions — the
   numbers are the same curve the rest of the app chrome moves on, and
   --ease-editorial (the public pages' curve) deliberately is not here. */
const EASE_ENTER = [0.16, 1, 0.3, 1] as const
const EASE_EXIT = [0.7, 0, 0.84, 0] as const
const DUR_BASE = 0.2
const DUR_SLOW = 0.32

/**
 * A card's nominal height, used only to aim the flight.
 *
 * The dock's anchor is a zero-height placeholder, so it gives an exact x and a
 * top but no centre. This supplies the missing half. It is approximate on
 * purpose: the card is laid out at its real position from the first frame and
 * only ever moves by `transform`, so being a few pixels out changes where the
 * flight *starts*, never where anything ends up.
 */
const CARD_FLIGHT_HEIGHT = 88

const number = (value: number) => value.toLocaleString()

export function AiMeterDock({
  tasks,
  now,
  context,
  anchorRef,
  onDismiss,
  onHoverChange,
}: {
  tasks: MeterTask[]
  now: number
  context: MeterContext | null
  anchorRef: React.RefObject<HTMLDivElement | null>
  onDismiss: (id: string) => void
  onHoverChange: (hovered: boolean) => void
}) {
  const view = dockView(tasks)

  return (
    /* Below the header rather than over it: "top right" is where this belongs,
       but the account menu and theme toggle already live up there and a meter
       that buried them would cost the user a control to tell them a number.
       pointer-events-none on the column, re-enabled per card, so the empty
       dock never swallows a click meant for the page. */
    <div
      className="pointer-events-none fixed top-[calc(var(--maintenance-banner-h,0px)+3.5rem+0.75rem)] right-4 z-30 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 print:hidden"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocusCapture={() => onHoverChange(true)}
      onBlurCapture={() => onHoverChange(false)}
    >
      {/* Always rendered, even with nothing to show: it is what a card reads
          to know where it is flying to, and it has to exist before the card
          that asks. */}
      <div ref={anchorRef} aria-hidden className="h-0 w-full" />

      {/* Phase changes only. The cards themselves are not a live region: the
          elapsed clock changes every second, and a region that announced it
          would read a stopwatch aloud over whatever the user was doing. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement(view.visible, view.hiddenCount)}
      </p>

      <AnimatePresence initial={false}>
        {view.visible.map((task) => (
          <MeterCard
            key={task.id}
            task={task}
            now={now}
            context={context}
            anchorRef={anchorRef}
            onDismiss={onDismiss}
          />
        ))}
        {view.hiddenCount > 0 ? (
          <motion.p
            key="overflow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR_BASE, ease: EASE_ENTER }}
            className="pointer-events-auto self-end rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground ring-1 ring-foreground/10"
          >
            {/* Counted, never dropped: three cards and silence would
                under-report how much of this workspace's quota is in flight. */}
            +{view.hiddenCount} more AI {view.hiddenCount === 1 ? 'task' : 'tasks'}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function MeterCard({
  task,
  now,
  context,
  anchorRef,
  onDismiss,
}: {
  task: MeterTask
  now: number
  context: MeterContext | null
  anchorRef: React.RefObject<HTMLDivElement | null>
  onDismiss: (id: string) => void
}) {
  const reduced = useReducedMotion()
  const [open, setOpen] = React.useState(false)

  /* Measured once, at mount, from the anchor that was already on screen.
     Deliberately not a dependency-tracked memo: the flight describes where
     this card CAME FROM, which is a fact about one instant and must not be
     recomputed when the dock reflows underneath it. */
  const flight = React.useMemo(() => {
    if (reduced) return null
    const anchor = anchorRef.current
    if (!anchor) return null
    const rect = anchor.getBoundingClientRect()
    return flightDelta(task.origin, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: CARD_FLIGHT_HEIGHT,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const view = meterView({
    featureLabel: task.featureLabel,
    // The model that ANSWERED, which is knowable only once the ledger has
    // reported. What the chain asked for first is shown separately, and
    // labelled as a request.
    model: task.settlement?.model ?? null,
    phase: task.phase === 'settling' ? 'done' : task.phase,
    elapsedMs: (task.endedAt ?? now) - task.startedAt,
    estimateLabel: task.estimateLabel,
    usage: task.settlement?.usage,
    keyTier: task.settlement?.keyTier ?? 'unknown',
    at: new Date(task.endedAt ?? now),
  })

  const running = task.phase === 'running'
  const settling = task.phase === 'settling'
  const failed = task.phase === 'failed'

  return (
    <motion.div
      layout={!reduced}
      /* Reduced motion gets a DESIGNED state, not a disabled one: the card
         still arrives, still fades in, still says everything. What it loses is
         the flight and the scale — the two parts that are movement for its own
         sake. */
      initial={
        flight
          ? { opacity: 0, scale: 0.55, x: flight.x, y: flight.y }
          : { opacity: 0, scale: 1, x: 0, y: 0 }
      }
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: reduced ? 1 : 0.96, transition: { duration: DUR_BASE, ease: EASE_EXIT } }}
      transition={{ duration: flight ? DUR_SLOW : DUR_BASE, ease: EASE_ENTER }}
      className={cn(
        'pointer-events-auto overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-lg ring-1',
        failed ? 'ring-destructive/40' : 'ring-foreground/10',
      )}
    >
      <div className="flex items-start gap-2 px-3 pt-3">
        <span className="mt-0.5 shrink-0" aria-hidden>
          {failed ? (
            <TriangleAlert className="size-4 text-destructive" />
          ) : running || settling ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
          ) : (
            <Check className="size-4 text-success" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{task.featureLabel}</p>
          <p className="text-xs text-muted-foreground">
            {failed
              ? `Failed after ${view.elapsed}`
              : running
                ? `Running · ${view.elapsed}`
                : settling
                  ? /* Not "done" and not a spinner with no explanation: the
                       model has answered, and what is outstanding is this
                       app's own record of it. */
                    `Answered in ${view.elapsed} · reading the usage ledger`
                  : `Done in ${view.elapsed}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(task.id)}
          className="-mr-1 rounded-md p-1 text-muted-foreground transition-colors duration-(--dur-quick) hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`Dismiss the ${task.featureLabel} meter`}
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="space-y-1.5 px-3 pt-2 pb-3 text-xs">
        {failed && task.error ? (
          <p className="text-destructive">{task.error}</p>
        ) : null}

        {/* WHILE RUNNING, the feature's own published estimate — and the word
            "estimate" is on the line itself, not in a tooltip. This is a guess
            about a representative use, printed next to a live clock, and the
            two must not read as the same kind of claim. */}
        {running && task.estimateLabel ? (
          <Row
            label="Estimate"
            value={
              <span className="tabular-nums">
                {task.estimateUsd === null ? 'price unknown' : formatUsd(task.estimateUsd)}
                <span className="text-muted-foreground"> {task.estimateLabel}</span>
              </span>
            }
          />
        ) : null}

        {running ? (
          <Row
            label="Asking for"
            /* A request, not a result. resolveChain can fall through several
               models, so naming this one as "the" model would misattribute
               both the cost and the capability. */
            value={task.requestedModel ?? `${task.chain} chain (default)`}
          />
        ) : null}

        {view.tokens ? (
          <>
            <Row
              label="Tokens"
              value={
                <span className="tabular-nums">
                  {number(view.tokens.input)} in · {number(view.tokens.output)} out
                </span>
              }
            />
            <Row
              label="Cost"
              value={
                view.costUsd === null ? (
                  /* A model with no published rate. "price unknown" and not
                     "$0.00": one says we cannot tell you, the other says it
                     was free. */
                  <span className="text-muted-foreground">price unknown for this model</span>
                ) : (
                  <span className="tabular-nums">
                    {formatUsd(view.costUsd)}
                    <span className="text-muted-foreground"> indicative</span>
                  </span>
                )
              }
            />
          </>
        ) : null}

        {view.model ? (
          <Row
            label="Answered by"
            value={
              <>
                {view.model}
                {task.settlement && task.settlement.models.length > 1 ? (
                  <span className="text-muted-foreground">
                    {' '}
                    +{task.settlement.models.length - 1} more in chain
                  </span>
                ) : null}
              </>
            }
          />
        ) : null}

        {/* The finished task produced no ledger row inside the settle window.
            Said out loud, because an empty cost line reads as a free call. */}
        {task.unrecorded && !task.settlement ? (
          <p className="text-muted-foreground">
            No usage was recorded for this call — LogPup can’t say what it cost.
          </p>
        ) : null}

        <Billing task={task} context={context} billing={view.billing} running={running} />

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center gap-1 pt-0.5 text-muted-foreground transition-colors duration-(--dur-quick) hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronDown
            className={cn(
              'size-3 transition-transform duration-(--dur-quick) motion-reduce:transition-none',
              open && 'rotate-180',
            )}
            aria-hidden
          />
          {open ? 'Less' : 'What this covers'}
        </button>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="details"
              initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: DUR_BASE, ease: EASE_ENTER }}
              className="space-y-1.5 overflow-hidden border-t border-border/70 pt-2 text-muted-foreground"
            >
              <Row label="Chain" value={task.chain} />
              {task.settlement ? (
                <Row
                  label="Calls"
                  value={
                    task.settlement.okCalls === task.settlement.calls
                      ? `${number(task.settlement.calls)} recorded`
                      : `${number(task.settlement.okCalls)} of ${number(task.settlement.calls)} succeeded`
                  }
                />
              ) : null}
              {context ? (
                <Row
                  label="Today"
                  value={
                    <span className="tabular-nums">
                      {number(context.today.tokens)} tokens · {number(context.today.calls)} calls
                    </span>
                  }
                />
              ) : null}
              {/* THE PARAGRAPH THAT REPLACES A PROGRESS BAR. It is here because
                  the honest answer to "how much is left?" is that this app
                  cannot see it, and a sentence saying so is worth more than a
                  bar that implies somebody measured. */}
              <p className="leading-relaxed">
                Google meters the free tier per project, per minute and per day, and publishes no
                way to read what’s left — a key used anywhere else spends quota LogPup never sees.
                The figures above are what LogPup itself recorded, priced at list rates. They are
                never a bill.
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{value}</span>
    </p>
  )
}

/**
 * Who is paying, answered from whatever is actually known at this moment.
 *
 * While RUNNING nothing has touched a key yet — rotation picks one at call
 * time — so the honest statement is which keys are available to be picked,
 * not which one will be. Once the ledger reports, the real tier replaces it.
 *
 * There is no "unlimited" anywhere here, because there is no unlimited tier:
 * a paid key is metered and invoiced to whoever owns it.
 */
function Billing({
  task,
  context,
  billing,
  running,
}: {
  task: MeterTask
  context: MeterContext | null
  billing: 'free-tier' | 'billed-to-key-owner' | 'unknown'
  running: boolean
}) {
  if (running) {
    if (!context) return null
    const { ownFree, ownPaid, sharedPool } = context.keys
    if (ownFree + ownPaid + sharedPool === 0) return null
    const mine = [ownFree ? `${ownFree} free` : null, ownPaid ? `${ownPaid} paid` : null]
      .filter(Boolean)
      .join(' + ')
    return (
      <p className="text-muted-foreground">
        {mine ? `Your keys: ${mine}` : 'No key of your own'}
        {sharedPool
          ? ` · ${sharedPool} shared team ${sharedPool === 1 ? 'key' : 'keys'} behind them`
          : ''}
      </p>
    )
  }

  if (!task.settlement) return null
  if (billing === 'free-tier') {
    return <p className="text-muted-foreground">Free-tier key — nothing charged.</p>
  }
  if (billing === 'billed-to-key-owner') {
    return (
      <p className="text-muted-foreground">
        Paid key — metered and billed to {task.settlement.ownKey ? 'you' : 'the teammate who shared it'}.
      </p>
    )
  }
  /* No key could be attributed: the call failed before reaching one, or the
     key has since been deleted. Saying so beats defaulting to the comforting
     half of the answer. */
  return <p className="text-muted-foreground">No key recorded for this call.</p>
}

/**
 * One sentence per phase change for a screen reader, and nothing per second.
 *
 * Built from settled facts only — never the elapsed clock — so the live region
 * stays quiet while a call runs and speaks once when it finishes.
 */
function announcement(tasks: MeterTask[], hiddenCount: number): string {
  const parts = tasks.map((task) => {
    if (task.phase === 'failed') return `${task.featureLabel} failed. ${task.error ?? ''}`.trim()
    if (task.phase === 'running') return `${task.featureLabel} is running.`
    if (task.phase === 'settling') return `${task.featureLabel} answered; reading usage.`
    if (task.settlement) {
      const total = task.settlement.usage.inputTokens + task.settlement.usage.outputTokens
      return `${task.featureLabel} finished, ${number(total)} tokens.`
    }
    return `${task.featureLabel} finished.`
  })
  if (hiddenCount > 0) parts.push(`${hiddenCount} more running.`)
  return parts.join(' ')
}
