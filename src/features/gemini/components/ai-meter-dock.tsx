'use client'

/**
 * The corner the live AI meter lives in.
 *
 * It has one job and one prohibition. The job: while any AI call is running,
 * say what is running, what it is expected to cost, and — once the answer is
 * back and this app's own ledger has caught up — what it actually did cost.
 * The prohibition: never show a number nobody measured.
 *
 * That prohibition rules out the two denominators this UI would most like.
 * Tokens do not exist until the response arrives (there is no streaming
 * client — see ai-meter.ts), so a bar filling on tokens would be animating a
 * guess. And Google enforces the free tier per PROJECT, per minute and per
 * day, publishing no endpoint for what is left, so a "quota remaining" bar
 * would be inferred from local records and wrong the moment the same key is
 * used from a script or a second deployment. Both stay refused, permanently.
 *
 * Two denominators ARE defensible, and the gauge below renders exactly those
 * (meterView derives them — the component cannot fudge the wording):
 *
 *   1. STEPS — server-acknowledged units the call site counted (a meeting's
 *      transcribed segments). The one percent allowed to mean work done,
 *      floored and held at 99 while anything is outstanding.
 *   2. PACE — elapsed against this browser's own median for the same
 *      feature+model (meter-pace.ts), measured by this meter itself. A claim
 *      about TIME, labelled "of typical", never "complete"; its bar is
 *      visually capped short of full and reports indeterminate to ARIA,
 *      because pace cannot make a completion claim.
 *
 * Motion reads as evidence, which is exactly why it is spent on the things
 * that are genuinely true — this panel came from that button, it is still
 * working, and this much of the measured denominator has passed — and on
 * nothing that resembles a measurement nobody made.
 */

import * as React from 'react'
/* `m`, not `motion`: this file renders inside the shell's <LazyMotion strict>
   (see components/motion/motion-provider.tsx), where the full `motion` import
   throws rather than quietly re-bundling the library it was told not to. The
   two are the same component with the same props — `m` just expects its
   features to have been provided from above. */
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import {
  AudioLines,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Radio,
  ScanSearch,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react'

import { formatUsd } from '@/features/gemini/pricing'
import { AI_FEATURES, estimatePerUseCostUsd } from '@/features/gemini/ai-features'
import { formatElapsed, meterView, type MeterView } from '@/features/gemini/ai-meter'
import {
  canRetry,
  dockView,
  isKeyFailure,
  stepPercent,
  type MeterTask,
} from '@/features/gemini/meter-tasks'
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

const number = (value: number) => value.toLocaleString()

export function AiMeterDock({
  tasks,
  now,
  context,
  anchorRef,
  onDismiss,
  onRetry,
  onHoverChange,
  onFlightConsumed,
}: {
  tasks: MeterTask[]
  now: number
  context: MeterContext | null
  anchorRef: React.RefObject<HTMLDivElement | null>
  onDismiss: (id: string) => void
  onRetry: (id: string) => void
  onHoverChange: (hovered: boolean) => void
  onFlightConsumed: (id: string) => void
}) {
  const view = dockView(tasks)
  /* A person's click outranks the default until the task it points at leaves
     the dock; then the model's ordering (failures first, newest next) takes
     back over rather than leaving a stale choice pinned. */
  const [expandedOverride, setExpandedOverride] = React.useState<string | null>(null)
  const expandedId =
    expandedOverride && view.visible.some((t) => t.id === expandedOverride)
      ? expandedOverride
      : view.defaultExpandedId

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

      {/* Two or more tasks collapse to rows with ONE expanded — three stacked
          cards would bury the page this dock is required not to. The choice
          of which opens expanded (failures first, then newest) is dockView's,
          in the pure model; a click here only overrides it. */}
      {view.density === 'stack' ? (
        <p className="pointer-events-auto self-end rounded-full bg-popover px-3 py-1 text-xs text-muted-foreground shadow-sm ring-1 ring-foreground/10">
          <span className="font-mono tabular-nums">{view.visible.length + view.hiddenCount}</span> AI
          tasks · <span className="font-mono tabular-nums">{view.runningCount}</span> running
          {view.failedCount > 0 ? (
            <span className="text-destructive">
              {' '}
              · <span className="font-mono tabular-nums">{view.failedCount}</span> failed
            </span>
          ) : null}
        </p>
      ) : null}
      <AnimatePresence initial={false}>
        {view.visible.map((task) =>
          view.density === 'cards' || task.id === expandedId ? (
            <MeterCard
              key={task.id}
              task={task}
              now={now}
              context={context}
              onDismiss={onDismiss}
              onRetry={onRetry}
              onFlightConsumed={onFlightConsumed}
              /* Only a click's expansion moves focus — the clicked row is
                 about to unmount, and focus falling to <body> strands a
                 keyboard user (WCAG 2.4.3). A default expansion (a failure
                 re-sorting to front) steals nothing: nobody asked for it. */
              focusOnMount={task.id === expandedOverride}
            />
          ) : (
            <MeterStripRow
              key={task.id}
              task={task}
              now={now}
              onExpand={() => setExpandedOverride(task.id)}
              onDismiss={onDismiss}
              onRetry={onRetry}
            />
          ),
        )}
        {view.hiddenCount > 0 ? (
          <m.p
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
          </m.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function MeterCard({
  task,
  now,
  context,
  onDismiss,
  onRetry,
  onFlightConsumed,
  focusOnMount = false,
}: {
  task: MeterTask
  now: number
  context: MeterContext | null
  onDismiss: (id: string) => void
  onRetry: (id: string) => void
  onFlightConsumed: (id: string) => void
  focusOnMount?: boolean
}) {
  const reduced = useReducedMotion()
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  /* THE FLIGHT IS ONE-SHOT. The stack swaps a task between row and card under
     the same key, and a swap is a remount — so without this, a card promoted
     back from a row would replay its fly-in from a button position that
     stopped existing minutes and one scroll ago. Consuming the flight on the
     first mount (patchTask flight->null in the provider) makes every later
     mount take the designed in-place fade instead. Idempotent, so listing the
     full deps is safe: once consumed, the guard never fires again. */
  React.useEffect(() => {
    if (task.flight) onFlightConsumed(task.id)
  }, [task.flight, task.id, onFlightConsumed])

  /* Focus the card when a click on the strip row expanded it — that click
     destroyed the button that held focus. tabIndex -1: focusable by script,
     never added to the tab order. */
  React.useEffect(() => {
    if (focusOnMount) rootRef.current?.focus()
    // Mount-only by intent; focusOnMount changing later must not re-steal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Measured in the click handler that created this task, not here: the
     flight describes where the card CAME FROM, which is a fact about one
     instant that no longer exists by the time this renders. Reduced motion
     drops it and keeps everything else. */
  const flight = reduced ? null : task.flight

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
    steps: task.steps,
    typical: task.typical,
  })

  const running = task.phase === 'running'
  const settling = task.phase === 'settling'
  const failed = task.phase === 'failed'
  const estimated = task.settlement?.tokensEstimated ?? false

  /* DERIVED, not frozen onto the task when it started. The pinned model
     arrives with the meter context a moment after the first call begins, and a
     figure captured before it landed would quote the default chain's price for
     a call the user had explicitly routed elsewhere. Deriving here means the
     estimate corrects itself the instant the context resolves — still inside
     the call it belongs to. */
  const chosenModel = context?.models[task.featureId] ?? null
  const feature = AI_FEATURES.find((f) => f.id === task.featureId)
  const estimateUsd = feature
    ? estimatePerUseCostUsd(feature.estimate, chosenModel, new Date(task.startedAt))
    : null

  return (
    <m.div
      ref={rootRef}
      tabIndex={-1}
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
        /* Worn only while the call is actually in flight — see .ai-working in
           globals.css. It is a status light, so it has to leave the moment the
           status does. */
        (running || settling) && 'ai-working',
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
        {view.progress ? <ProgressLine progress={view.progress} /> : null}
        {failed && task.error ? (
          <p className="text-destructive">{task.error}</p>
        ) : null}

        {/* The way back. A failed AI call used to leave nothing but a dismiss
            X — the only route to trying again was to find whatever button
            started it, which for a background draft is not on screen.

            The keys link appears ONLY for a rejected or spent key, because
            that is the one failure retrying cannot fix: it fails again, the
            same way, after the same wait. Offering it for a malformed
            response would send somebody to check a key that is working. */}
        {canRetry(task) ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onRetry(task.id)}
              className="rounded-md border border-border px-2 py-1 font-medium transition-colors duration-(--dur-quick) hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Try again
            </button>
            {isKeyFailure(task) ? (
              <a
                href="/profile"
                className="rounded-md px-1.5 py-1 text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors duration-(--dur-quick) hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Check keys
              </a>
            ) : null}
          </div>
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
                {estimateUsd === null ? 'price unknown' : formatUsd(estimateUsd)}
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
            value={chosenModel ?? `${task.chain} chain (default)`}
          />
        ) : null}

        {view.tokens ? (
          <>
            <Row
              /* A live session never returns usageMetadata — it streams
                 browser-direct, and the ledger holds a rate x duration
                 reservation the app itself wrote. live-token.ts states the
                 rule outright: every UI showing one of those rows says
                 "approximately". So the LABEL changes, not just a footnote. */
              label={estimated ? 'Tokens (approx.)' : 'Tokens'}
              value={
                <span className="tabular-nums">
                  {estimated ? '≈' : ''}
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
                    <span className="text-muted-foreground">
                      {' '}
                      {estimated ? 'from an estimate' : 'indicative'}
                    </span>
                  </span>
                )
              }
            />
            {estimated ? (
              <p className="text-muted-foreground">
                Live sessions stream straight from the browser, so Gemini never reports their
                usage. This is the rate LogPup reserved for the slice, not a measurement.
              </p>
            ) : null}
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
            <m.div
              key="details"
              initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: DUR_BASE, ease: EASE_ENTER }}
              className="space-y-1.5 overflow-hidden border-t border-border/70 pt-2 text-muted-foreground"
            >
              <Row label="Chain" value={task.chain} />
              {task.typical ? (
                <Row
                  wrap
                  label="Typical"
                  /* The denominator confesses where it came from. "This
                     browser" is load-bearing: the median is this device's own
                     completed runs, not a fleet statistic. */
                  value={
                    <span className="font-mono tabular-nums">
                      ~{formatElapsed(task.typical.p50)}
                      <span className="text-muted-foreground">
                        {' '}
                        · median of your last {task.typical.samples} runs (this browser)
                      </span>
                    </span>
                  }
                />
              ) : null}
              {task.steps ? (
                <Row
                  label="Steps"
                  value={
                    <span className="font-mono tabular-nums">
                      {task.steps.done} done
                      {task.steps.failed > 0 ? ` · ${task.steps.failed} failed` : ''}
                      {' '}· {Math.max(0, task.steps.total - task.steps.done - task.steps.failed)}{' '}
                      to go
                    </span>
                  }
                />
              ) : null}
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
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>
    </m.div>
  )
}

function Row({
  label,
  value,
  wrap = false,
}: {
  label: string
  value: React.ReactNode
  /** Rows whose tail carries meaning (the Typical row's "(this browser)")
   *  wrap to a second line — truncation would eat exactly the qualifier the
   *  number depends on, on every card width this dock renders at. */
  wrap?: boolean
}) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 text-right', wrap ? 'break-words' : 'truncate')}>{value}</span>
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

const CHAIN_GLYPH: Record<string, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  Quick: Zap,
  Analysis: ScanSearch,
  Synthesis: FileText,
  Voice: AudioLines,
  Live: Radio,
}

/**
 * The one bar in this feature, and the rules that let it exist (see the file
 * header). Steps fill to their true percent and report it to ARIA. Pace is
 * VISUALLY capped short of full with a tick at the cap, and reports
 * indeterminate to ARIA (no aria-valuenow) — the bar physically cannot
 * present "done", because pace cannot claim it.
 */
function Gauge({ progress }: { progress: NonNullable<MeterView['progress']> }) {
  const fraction =
    progress.kind === 'steps' ? progress.percent / 100 : (progress.percent / 100) * 0.92
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      {...(progress.kind === 'steps' ? { 'aria-valuenow': progress.percent } : {})}
      aria-label={progress.kind === 'steps' ? 'Work transcribed' : 'Elapsed share of typical time'}
      className="relative h-1 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-(--dur-slow) motion-reduce:transition-none"
        style={{ transform: `scaleX(${Math.min(Math.max(fraction, 0), 1)})` }}
      />
      {progress.kind === 'pace' ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-[92%] w-px bg-muted-foreground/40"
        />
      ) : null}
    </div>
  )
}

/**
 * What the gauge means, said in words on the same line — a percent never
 * travels without its denominator. Steps say "at this pace" on their ETA
 * because it extrapolates this task's own rate; pace says "of typical" and
 * flips to "longer than typical" rather than counting past its end.
 */
function ProgressLine({ progress }: { progress: NonNullable<MeterView['progress']> }) {
  return (
    <div className="space-y-1">
      {progress.kind === 'steps' ? (
        <p className="flex items-baseline justify-between gap-3">
          <span className="font-mono tabular-nums">
            {progress.done} of {progress.total} steps · {progress.percent}%
            {progress.failed > 0 ? (
              <span className="text-warning"> · {progress.failed} failed</span>
            ) : null}
          </span>
          {progress.remainingMs !== null ? (
            <span className="text-muted-foreground">
              ~{formatElapsed(progress.remainingMs)} left at this pace
            </span>
          ) : null}
        </p>
      ) : (
        <p className="flex items-baseline justify-between gap-3">
          <span className="font-mono tabular-nums">
            {progress.overrun ? (
              /* Wording change only — no colour shift, no pulse. Slow is not
                 an error, and in this dock colour is evidence. */
              <span className="text-muted-foreground">Longer than typical</span>
            ) : (
              <>{progress.percent}% of typical</>
            )}
          </span>
          <span className="text-muted-foreground">
            {progress.remainingMs !== null
              ? `~${formatElapsed(progress.remainingMs)} left if typical`
              : `typically ~${formatElapsed(progress.typicalMs)}`}
          </span>
        </p>
      )}
      <Gauge progress={progress} />
    </div>
  )
}

/**
 * One 40px row of the stack: identity, state, elapsed — nothing else. The
 * whole row is a button that expands it into the full card; dismiss appears
 * only once there is an outcome to dismiss, so a running task cannot be
 * swatted by a stray click aimed at reading it.
 */
function MeterStripRow({
  task,
  now,
  onExpand,
  onDismiss,
}: {
  task: MeterTask
  now: number
  onExpand: () => void
  onDismiss: (id: string) => void
}) {
  const reduced = useReducedMotion()
  const running = task.phase === 'running' || task.phase === 'settling'
  const failed = task.phase === 'failed'
  const Glyph = CHAIN_GLYPH[task.chain] ?? Zap
  // The SAME two rules the card's line obeys — stepPercent for the number and
  // the exhausted-steps gate for whether to speak at all. A row printing
  // "99%" through a whole synthesis while the expanded card shows a plain
  // spinner would be the dock disagreeing with itself about one task.
  const stepsAlive =
    task.phase === 'running' &&
    task.steps !== null &&
    task.steps.total > 0 &&
    task.steps.done + task.steps.failed < task.steps.total
  const percent = stepsAlive && task.steps ? `${stepPercent(task.steps)}%` : null
  return (
    <m.div
      layout={!reduced}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: DUR_BASE, ease: EASE_EXIT } }}
      transition={{ duration: DUR_BASE, ease: EASE_ENTER }}
      className={cn(
        'pointer-events-auto flex h-10 items-center gap-2 overflow-hidden rounded-lg bg-popover px-3 text-popover-foreground shadow-md ring-1',
        failed ? 'ring-destructive/40' : 'ring-foreground/10',
        // `running` here already folds in 'settling' — see its definition above.
        running && 'ai-working',
      )}
    >
      {/* NOT aria-expanded: pressing this replaces the row with the card and
          moves focus there — a navigation, not a disclosure toggle, and an
          aria-expanded that could never read true would be a lie to exactly
          the users who rely on it. */}
      <button
        type="button"
        onClick={onExpand}
        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Show details for ${task.featureLabel}`}
      >
        <span className="shrink-0" aria-hidden>
          {failed ? (
            <TriangleAlert className="size-4 text-destructive" />
          ) : running ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
          ) : (
            <Check className="size-4 text-success" />
          )}
        </span>
        <Glyph className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{task.featureLabel}</span>
        {percent ? (
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {percent}
          </span>
        ) : null}
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {formatElapsed((task.endedAt ?? now) - task.startedAt)}
        </span>
      </button>
      {!running ? (
        <button
          type="button"
          onClick={() => onDismiss(task.id)}
          className="-mr-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors duration-(--dur-quick) hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`Dismiss the ${task.featureLabel} meter`}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </m.div>
  )
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
      const about = task.settlement.tokensEstimated ? 'about ' : ''
      return `${task.featureLabel} finished, ${about}${number(total)} tokens.`
    }
    return `${task.featureLabel} finished.`
  })
  if (hiddenCount > 0) parts.push(`${hiddenCount} more running.`)
  return parts.join(' ')
}
