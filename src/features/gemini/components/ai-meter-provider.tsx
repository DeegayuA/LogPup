'use client'

/**
 * The live AI meter's brain: one place that knows every AI call this tab has
 * in flight, what each of them is allowed to say, and when to stop saying it.
 *
 * WIRING IS ONE LINE AT EACH CALL SITE. `track` wraps the promise and returns
 * it unchanged — value for value, throw for throw — so a button becomes
 * metered without changing what it does:
 *
 *   const res = await meter.track('daily-briefing', event, () => getBriefing())
 *
 * That transparency is the point. A meter that made call sites restructure
 * themselves would get wired into three of them and quietly skipped by the
 * rest, and a meter that covers most AI work is worse than none: the corner
 * would be empty during the calls nobody remembered to wrap, which reads as
 * "nothing is running".
 *
 * WHAT IT DOES NOT DO. It never focuses anything, never blocks, never
 * confirms. Every AI call in this app was started by somebody who then went
 * back to what they were doing; a panel that took the caret away from a
 * half-typed note to announce a token count would be charging the user for
 * the privilege of being informed.
 */

import * as React from 'react'
import { AI_FEATURES, type AiFeatureId } from '@/features/gemini/ai-features'
import {
  CARD_FLIGHT_HEIGHT,
  SETTLE_WINDOW_MS,
  addTask,
  closeSettleWindow,
  dismissTask as dropTask,
  expireSettled,
  flightDelta,
  patchTask,
  reportSteps,
  type MeterOriginPoint,
  type MeterSettlement,
  type MeterSteps,
  type MeterTask,
} from '@/features/gemini/meter-tasks'
import {
  PACE_EXEMPT,
  durationStorage,
  paceKey,
  recordDuration,
  typicalMs,
  type DurationHistory,
} from '@/features/gemini/meter-pace'
import { meterContext, meterSettlement, type MeterContext } from '@/features/gemini/meter-actions'
import { AiMeterDock } from '@/features/gemini/components/ai-meter-dock'

/**
 * Anything a call site can hand over as "where the click was".
 *
 * A React event is the usual one, and the rect is read from it SYNCHRONOUSLY
 * (React nulls `currentTarget` once the handler returns), which is why `track`
 * resolves the origin on its first line and before any await.
 */
export type MeterOriginSource =
  | React.MouseEvent<Element>
  | React.SyntheticEvent<Element>
  | Element
  | MeterOriginPoint
  | null
  | undefined

/**
 * Handed to `work` so a call site that OWNS a real count — a meeting's
 * transcribed segments — can report it. Every zero-arg closure stays
 * assignable, so the whole app compiled unchanged the day this appeared;
 * opting in is adding a parameter, not restructuring a call site.
 */
export type MeterTaskHandle = {
  /** Report where this task's countable work stands. Ignored unless the
   *  task is still running and the numbers are coherent. */
  steps(next: MeterSteps): void
}

export type AiMeterApi = {
  /**
   * Runs `work`, showing a meter for it until it settles, and returns exactly
   * what `work` returned. Failures propagate untouched — the meter reports
   * them, it does not handle them.
   */
  track<T>(
    featureId: AiFeatureId,
    origin: MeterOriginSource,
    work: (handle: MeterTaskHandle) => Promise<T>,
  ): Promise<T>
  /** True while this tab has any AI call in flight. */
  busy: boolean
}

const NOOP_HANDLE: MeterTaskHandle = { steps: () => undefined }

const NOOP_API: AiMeterApi = {
  track: (_featureId, _origin, work) => work(NOOP_HANDLE),
  busy: false,
}

/**
 * Defaults to a pass-through rather than throwing on a missing provider.
 *
 * A component rendered outside the app shell — a print route, a test, a story
 * — should still be able to call its own AI action. Refusing to run the work
 * because nothing is watching would make the meter load-bearing for the
 * feature it only exists to describe.
 */
const AiMeterContext = React.createContext<AiMeterApi>(NOOP_API)

export function useAiMeter(): AiMeterApi {
  return React.useContext(AiMeterContext)
}

/**
 * The centre of whatever was clicked, in viewport coordinates.
 *
 * Exported because some call sites cannot hand the event straight to `track`:
 * a question asked inside a `startTransition`, or a draft kicked off from a
 * `useEffect`, runs after the handler has returned and React has already
 * nulled `currentTarget`. Those sites freeze the point at click time with this
 * and pass the point instead — which is the same fact, read while it still
 * exists.
 */
export function meterOrigin(source: MeterOriginSource): MeterOriginPoint | null {
  return originPoint(source)
}

function originPoint(source: MeterOriginSource): MeterOriginPoint | null {
  if (!source) return null
  if ('x' in source && 'y' in source && typeof source.x === 'number') {
    return { x: source.x, y: source.y }
  }
  const element =
    source instanceof Element
      ? source
      : ((source as React.SyntheticEvent<Element>).currentTarget ?? null)
  if (!(element instanceof Element)) return null
  const rect = element.getBoundingClientRect()
  // A zero-sized rect means the element is gone or display:none — there is no
  // honest point to fly from, and the dock's answer to that is to appear in
  // place rather than invent one.
  if (rect.width === 0 && rect.height === 0) return null
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/**
 * How the settle poll paces itself, in milliseconds between attempts.
 *
 * Front-loaded because `after()` usually lands within a second, and stretched
 * out afterwards because a poll that has already missed twice is waiting on
 * something slow, not something imminent. The last interval repeats until
 * SETTLE_WINDOW_MS closes the window.
 */
const SETTLE_BACKOFF_MS = [350, 700, 1_200, 2_000, 3_000]

/** Does this look like the repo's ActionResult failure shape? */
function actionError(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null
  const result = value as { ok?: unknown; error?: unknown }
  if (result.ok === false && typeof result.error === 'string') return result.error
  return null
}

let taskSeq = 0
function nextTaskId(): string {
  taskSeq += 1
  return `meter-${taskSeq}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : taskSeq}`
}

export function AiMeterProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = React.useState<MeterTask[]>([])
  const [context, setContext] = React.useState<MeterContext | null>(null)
  /* Also held in a ref so `track` never changes identity when the context
     lands. Call sites put `track` in useCallback dependency lists (use-speech,
     use-dictation), and a `track` that churned would re-create their handlers
     every time any AI call started or stopped. */
  const contextRef = React.useRef(context)
  React.useEffect(() => {
    contextRef.current = context
  }, [context])
  /* A pointer resting on the dock holds every finished meter in place — see
     expireSettled. Someone reading a cost is not someone who wants it to
     vanish mid-sentence. */
  const [paused, setPaused] = React.useState(false)
  /* This browser's completed-run durations, loaded once and lazily — reading
     localStorage on every task would be a sync IO per click. A ref, not
     state: history feeds NEW tasks (frozen typical); nothing rendered watches
     it change. */
  const historyRef = React.useRef<DurationHistory | null>(null)
  const getHistory = React.useCallback((): DurationHistory => {
    if (historyRef.current) return historyRef.current
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(durationStorage.key)
    } catch {
      // Blocked storage reads as no history — first-run behaviour, no pace.
    }
    historyRef.current = durationStorage.parse(raw)
    return historyRef.current
  }, [])
  /* One clock for the whole dock, not one per card: the only genuinely live
     number is elapsed time, and it moves at the same rate for everybody. */
  const [now, setNow] = React.useState(() => Date.now())

  /* Read at flight time, not at render time — the anchor is the empty
     placeholder the dock always renders, so a card knows where it is going
     before it exists. */
  const dockAnchor = React.useRef<HTMLDivElement>(null)
  /* Synced in an effect rather than during render: a ref written while
     rendering is a side effect React is allowed to discard and re-run. It is
     read only by the settle loop below, which waits at least 350ms before
     looking, so being one commit behind cannot matter. */
  const tasksRef = React.useRef(tasks)
  React.useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])
  const alive = React.useRef(true)
  React.useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const busy = tasks.some((task) => task.phase === 'running' || task.phase === 'settling')

  // The elapsed tick runs only while something is actually in flight. A timer
  // left running on an idle tab is a re-render per second for a number nobody
  // is looking at.
  React.useEffect(() => {
    if (!busy) return
    const id = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(id)
  }, [busy])

  // Sweeping finished meters is likewise only worth a timer while there are
  // finished meters to sweep.
  const hasSettled = tasks.some((task) => task.phase === 'done')
  React.useEffect(() => {
    if (!hasSettled || paused) return
    const id = window.setInterval(() => {
      setTasks((current) => {
        const next = expireSettled(current, Date.now(), { paused: false })
        return next.length === current.length ? current : next
      })
    }, 1_000)
    return () => window.clearInterval(id)
  }, [hasSettled, paused])

  const dismiss = React.useCallback((id: string) => {
    setTasks((current) => dropTask(current, id))
  }, [])

  /* The flight is one-shot: the card consumes it on its first mount, so a
     later remount (the stack demoting and re-promoting a task) falls into the
     designed in-place fade instead of replaying a fly-in from a button
     position that no longer exists. */
  const consumeFlight = React.useCallback((id: string) => {
    setTasks((current) => patchTask(current, id, { flight: null }))
  }, [])

  /**
   * Asks the ledger for this task's rows until they arrive or the window
   * closes.
   *
   * Stops the moment the task is dismissed: a poll outliving the card it
   * feeds is a request per second for a number with nowhere to go.
   */
  const settle = React.useCallback(async (task: MeterTask) => {
    /* Measured from NOW — the moment the call returned — not from when the
       task started. `after()` only runs once the response is sent, so the wait
       for a ledger row begins at the end of the call, and a window anchored to
       the start would already be spent before the first poll for anything
       slower than SETTLE_WINDOW_MS. A meeting write-up takes minutes; every
       one of them would have reported "no usage recorded" for a call that had
       recorded usage perfectly well. */
    const deadline = Date.now() + SETTLE_WINDOW_MS
    for (let attempt = 0; ; attempt += 1) {
      const wait = SETTLE_BACKOFF_MS[Math.min(attempt, SETTLE_BACKOFF_MS.length - 1)]
      await new Promise((resolve) => setTimeout(resolve, wait))
      if (!alive.current) return
      if (!tasksRef.current.some((t) => t.id === task.id)) return

      let settlement: MeterSettlement | null = null
      try {
        const res = await meterSettlement(task.featureId, new Date(task.startedAt).toISOString())
        const dto = res.ok ? res.data : null
        if (dto) {
          settlement = {
            calls: dto.calls,
            okCalls: dto.okCalls,
            usage: { inputTokens: dto.inputTokens, outputTokens: dto.outputTokens },
            model: dto.model,
            models: dto.models,
            keyTier: dto.keyTier,
            ownKey: dto.ownKey,
            tokensEstimated: dto.tokensEstimated,
            today: dto.today,
          }
          // Today's recorded spend moves with every call, and the settle read
          // already paid for it — refresh the shared figure from the same row
          // rather than asking again.
          setContext((current) => (current ? { ...current, today: dto.today } : current))
        }
      } catch {
        // A failed settle read is not a failed AI call. The work succeeded;
        // only this app's account of it is missing, and the window below says
        // so in its own words rather than turning a good result red.
      }

      if (!alive.current) return
      if (settlement) {
        setTasks((current) =>
          patchTask(current, task.id, {
            settlement,
            // A task that already failed stays failed — the ledger row for a
            // blocked call carries its error code, not a result. Read from
            // `current` rather than a ref so the phase is the committed one.
            phase: current.find((t) => t.id === task.id)?.phase === 'failed' ? 'failed' : 'done',
          }),
        )
        return
      }
      if (Date.now() >= deadline) {
        // Both, not just the flag: a task left in 'settling' would show
        // "reading the usage ledger" forever and never expire, because only a
        // 'done' task is ever swept. Marking it done AND unrecorded is what
        // makes "we cannot say what this cost" a state the card can leave.
        setTasks((current) => closeSettleWindow(current, task.id))
        return
      }
    }
  }, [])

  const track = React.useCallback<AiMeterApi['track']>(
    async (featureId, origin, work) => {
      // FIRST, and before any await: React nulls an event's currentTarget the
      // moment the handler returns, so the rect has to be read here or not at
      // all.
      const point = originPoint(origin)
      const feature = AI_FEATURES.find((f) => f.id === featureId)
      if (!feature) return work(NOOP_HANDLE)

      /* Measured HERE, inside the click handler, for two reasons that happen
         to agree: it is the only moment the button's rect exists, and it is a
         legal place to read a ref (a component may not read one while
         rendering). The anchor is the zero-height placeholder the dock always
         renders, and it sits exactly where the newest card will land. */
      const anchor = dockAnchor.current?.getBoundingClientRect() ?? null
      const flight = flightDelta(
        point,
        anchor
          ? {
              left: anchor.left,
              top: anchor.top,
              width: anchor.width,
              height: CARD_FLIGHT_HEIGHT,
            }
          : null,
      )

      const startedAt = Date.now()
      /* The typical is FROZEN here, per feature+model, from this browser's own
         completed runs. Frozen so the bar's denominator cannot move under a
         watcher when a concurrent same-feature task lands; per-model because a
         pinned Pro's typical is severalfold Flash's. Exempt features (meeting
         write-ups, live sessions) get none — their duration tracks the
         meeting, not the model.

         NO CONTEXT, NO TYPICAL. Until meterContext has resolved, which model
         this user pinned is unknowable, so the pace key is unknowable — and
         reading the ':default' bucket would show a Flash-era typical beside a
         pinned-Pro run, the exact mislabel per-model keying exists to prevent.
         The first tracked call of a fresh tab shows elapsed only; the fetch it
         itself kicks off (below) makes every later call keyed correctly. */
      const typical =
        PACE_EXEMPT.has(featureId) || !contextRef.current
          ? null
          : typicalMs(getHistory(), paceKey(featureId, contextRef.current.models[featureId] ?? null))
      const task: MeterTask = {
        id: nextTaskId(),
        featureId,
        featureLabel: feature.label,
        chain: feature.chain,
        estimateLabel: feature.estimate.label,
        startedAt,
        endedAt: null,
        phase: 'running',
        origin: point,
        flight,
        settlement: null,
        unrecorded: false,
        error: null,
        steps: null,
        typical,
      }
      setTasks((current) => addTask(current, task))
      setNow(startedAt)

      /* Fetched once per tab, LAZILY — never on mount. The running meter is
         otherwise entirely static registry data, and fetching on mount would
         put a three-query round trip on every authed page load for people who
         never touch an AI feature. The two fields it supplies (the pinned
         model and the key picture) are derived in the card, not frozen onto
         the task, so they fill themselves in the moment this resolves —
         comfortably inside the first call it was fetched for. */
      if (!contextRef.current) {
        void meterContext().then((res) => {
          if (alive.current && res.ok) setContext(res.data)
        })
      }

      const handle: MeterTaskHandle = {
        steps: (next) => {
          if (!alive.current) return
          // Coherent numbers only, and only while running: a done>total report
          // or one arriving after Stop would put a lie on a bar this feature
          // exists to keep honest.
          if (next.total <= 0 || next.done < 0 || next.failed < 0) return
          if (next.done + next.failed > next.total) return
          setTasks((current) => {
            const target = current.find((t) => t.id === task.id)
            if (!target || target.phase !== 'running') return current
            return reportSteps(current, task.id, next)
          })
        },
      }

      const finish = (patch: Partial<MeterTask>) => {
        if (!alive.current) return
        const endedAt = Date.now()
        /* Only a task that DID ITS WORK teaches the typical. Failures measure
           the error path; exempt features have no typical to teach; and a call
           whose pinned-model context never resolved has no honest key to file
           under, so it teaches nothing (one lost sample per fresh tab).
           Storage is best-effort — a private window losing the history costs a
           pace line, never a meter. */
        if (patch.phase !== 'failed' && !PACE_EXEMPT.has(featureId) && contextRef.current) {
          const key = paceKey(featureId, contextRef.current.models[featureId] ?? null)
          /* Re-read before writing, so two tabs teaching at once merge instead
             of the slower tab clobbering the faster one's samples with its own
             stale cache. Failure to read just means this tab's view wins —
             the pre-existing behaviour, now the fallback. */
          try {
            historyRef.current = durationStorage.parse(
              window.localStorage.getItem(durationStorage.key),
            )
          } catch {
            // Keep the cached copy; see above.
          }
          historyRef.current = recordDuration(getHistory(), key, endedAt - startedAt)
          try {
            window.localStorage.setItem(durationStorage.key, durationStorage.serialize(historyRef.current))
          } catch {
            // Storage refused (quota, private mode) — the in-memory copy still
            // serves this tab, and that is the whole loss.
          }
        }
        setTasks((current) => patchTask(current, task.id, { endedAt, ...patch }))
        void settle(task)
      }

      try {
        const value = await work(handle)
        // The repo's actions report failure in their return value rather than
        // by throwing, so a meter that only watched for exceptions would
        // paint a rejected key green.
        const failure = actionError(value)
        finish(failure ? { phase: 'failed', error: failure } : { phase: 'settling' })
        return value
      } catch (error) {
        finish({
          phase: 'failed',
          error: error instanceof Error ? error.message : 'The AI call failed',
        })
        throw error
      }
    },
    // getHistory is a stable useCallback([]) — listed to satisfy the rule,
    // and identity-stable so `track` still never churns (call sites keep it
    // in their own dependency lists; see the contextRef comment above).
    [settle, getHistory],
  )

  const api = React.useMemo<AiMeterApi>(() => ({ track, busy }), [track, busy])

  return (
    <AiMeterContext.Provider value={api}>
      {children}
      <AiMeterDock
        tasks={tasks}
        now={now}
        context={context}
        anchorRef={dockAnchor}
        onDismiss={dismiss}
        onHoverChange={setPaused}
        onFlightConsumed={consumeFlight}
      />
    </AiMeterContext.Provider>
  )
}
