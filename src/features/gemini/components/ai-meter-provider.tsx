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
import {
  AI_FEATURES,
  estimatePerUseCostUsd,
  type AiFeatureId,
} from '@/features/gemini/ai-features'
import {
  SETTLE_WINDOW_MS,
  addTask,
  dismissTask as dropTask,
  expireSettled,
  patchTask,
  type MeterOriginPoint,
  type MeterSettlement,
  type MeterTask,
} from '@/features/gemini/meter-tasks'
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

export type AiMeterApi = {
  /**
   * Runs `work`, showing a meter for it until it settles, and returns exactly
   * what `work` returned. Failures propagate untouched — the meter reports
   * them, it does not handle them.
   */
  track<T>(featureId: AiFeatureId, origin: MeterOriginSource, work: () => Promise<T>): Promise<T>
  /** True while this tab has any AI call in flight. */
  busy: boolean
}

const NOOP_API: AiMeterApi = {
  track: (_featureId, _origin, work) => work(),
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

/** The centre of whatever was clicked, in viewport coordinates. */
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
  /* A pointer resting on the dock holds every finished meter in place — see
     expireSettled. Someone reading a cost is not someone who wants it to
     vanish mid-sentence. */
  const [paused, setPaused] = React.useState(false)
  /* One clock for the whole dock, not one per card: the only genuinely live
     number is elapsed time, and it moves at the same rate for everybody. */
  const [now, setNow] = React.useState(() => Date.now())

  /* Read at flight time, not at render time — the anchor is the empty
     placeholder the dock always renders, so a card knows where it is going
     before it exists. */
  const dockAnchor = React.useRef<HTMLDivElement>(null)
  const tasksRef = React.useRef(tasks)
  tasksRef.current = tasks
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

  /**
   * Asks the ledger for this task's rows until they arrive or the window
   * closes.
   *
   * Stops the moment the task is dismissed: a poll outliving the card it
   * feeds is a request per second for a number with nowhere to go.
   */
  const settle = React.useCallback(async (task: MeterTask) => {
    const deadline = task.startedAt + SETTLE_WINDOW_MS
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
            // blocked call carries its error code, not a result.
            phase: tasksRef.current.find((t) => t.id === task.id)?.phase === 'failed' ? 'failed' : 'done',
          }),
        )
        return
      }
      if (Date.now() >= deadline) {
        setTasks((current) => patchTask(current, task.id, { unrecorded: true }))
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
      if (!feature) return work()

      const startedAt = Date.now()
      const chosenModel = context?.models[featureId] ?? null
      const task: MeterTask = {
        id: nextTaskId(),
        featureId,
        featureLabel: feature.label,
        chain: feature.chain,
        estimateLabel: feature.estimate.label,
        estimateUsd: estimatePerUseCostUsd(feature.estimate, chosenModel, new Date(startedAt)),
        requestedModel: chosenModel,
        startedAt,
        endedAt: null,
        phase: 'running',
        origin: point,
        settlement: null,
        unrecorded: false,
        error: null,
      }
      setTasks((current) => addTask(current, task))
      setNow(startedAt)

      // Fetched once per tab, lazily: the running meter is otherwise entirely
      // static registry data, and a round trip per click would add latency to
      // the one moment this UI is meant to feel immediate.
      if (!context) {
        void meterContext().then((res) => {
          if (alive.current && res.ok) setContext(res.data)
        })
      }

      const finish = (patch: Partial<MeterTask>) => {
        if (!alive.current) return
        setTasks((current) => patchTask(current, task.id, { endedAt: Date.now(), ...patch }))
        void settle(task)
      }

      try {
        const value = await work()
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
    [context, settle],
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
      />
    </AiMeterContext.Provider>
  )
}
