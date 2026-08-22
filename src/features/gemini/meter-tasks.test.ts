import { describe, expect, it } from 'vitest'
import {
  DONE_LINGER_MS,
  addTask,
  dismissTask,
  dockView,
  expireSettled,
  flightDelta,
  markUnrecorded,
  patchTask,
  type MeterTask,
} from './meter-tasks'

const task = (over: Partial<MeterTask> = {}): MeterTask => ({
  id: 't1',
  featureId: 'daily-briefing',
  featureLabel: 'Daily briefing',
  chain: 'Analysis',
  estimateLabel: 'per briefing',
  estimateUsd: 0.0075,
  requestedModel: 'gemini-3.6-flash',
  startedAt: 1_000,
  endedAt: null,
  phase: 'running',
  origin: { x: 200, y: 400 },
  settlement: null,
  unrecorded: false,
  error: null,
  ...over,
})

describe('carrying several tasks at once', () => {
  it('keeps every task, because concurrent AI calls are the normal case', () => {
    const tasks = addTask(addTask([], task({ id: 'a' })), task({ id: 'b' }))
    expect(tasks.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('shows the newest first — the one the user just triggered', () => {
    const tasks = [task({ id: 'old', startedAt: 1 }), task({ id: 'new', startedAt: 9 })]
    expect(dockView(tasks).visible.map((t) => t.id)).toEqual(['new', 'old'])
  })

  it('collapses the overflow to a count instead of dropping it', () => {
    const tasks = [1, 2, 3, 4, 5].map((n) => task({ id: `t${n}`, startedAt: n }))
    const view = dockView(tasks, { maxVisible: 3 })
    expect(view.visible).toHaveLength(3)
    expect(view.hiddenCount).toBe(2)
    // The count is the whole point: five calls are running, and a dock that
    // rendered three and said nothing would be under-reporting the workspace.
    expect(view.runningCount).toBe(5)
  })

  it('pulls a failure to the front however old it is', () => {
    // A hidden error is the one outcome the dock exists to prevent, so age
    // does not get to bury it under three fresher successes.
    const tasks = [
      task({ id: 'fail', startedAt: 1, phase: 'failed', error: 'Key rejected' }),
      task({ id: 'a', startedAt: 5 }),
      task({ id: 'b', startedAt: 6 }),
      task({ id: 'c', startedAt: 7 }),
    ]
    const view = dockView(tasks, { maxVisible: 3 })
    expect(view.visible[0]?.id).toBe('fail')
    expect(view.failedCount).toBe(1)
  })

  it('counts a settling task as still running, because it has not reported yet', () => {
    // The model has answered but the ledger row has not landed. Anything that
    // told the user "done" here would be claiming a number it has not read.
    expect(dockView([task({ phase: 'settling' })]).runningCount).toBe(1)
  })

  it('is empty when nothing is tracked, so the dock renders no chrome', () => {
    expect(dockView([]).empty).toBe(true)
  })
})

describe('when a task finishes', () => {
  it('lets a successful meter linger, then drops it', () => {
    const done = [task({ phase: 'done', endedAt: 1_000 })]
    expect(expireSettled(done, 1_000 + DONE_LINGER_MS - 1)).toHaveLength(1)
    expect(expireSettled(done, 1_000 + DONE_LINGER_MS)).toHaveLength(0)
  })

  it('never expires a failure on a timer', () => {
    // Only a person dismissing it makes an error leave. Auto-hiding one is
    // disposing of the report, not delivering it.
    const failed = [task({ phase: 'failed', endedAt: 1_000, error: 'Gemini is busy' })]
    expect(expireSettled(failed, 1_000 + DONE_LINGER_MS * 100)).toHaveLength(1)
  })

  it('holds everything while the pointer rests on the dock', () => {
    // Someone reading a cost is not someone who wants it to vanish mid-word.
    const done = [task({ phase: 'done', endedAt: 1_000 })]
    expect(expireSettled(done, 9_999_999, { paused: true })).toHaveLength(1)
  })

  it('keeps a running task no matter how long it has run', () => {
    const running = [task({ phase: 'running', endedAt: null })]
    expect(expireSettled(running, 9_999_999)).toHaveLength(1)
  })

  it('marks a task unrecorded rather than settling it at zero', () => {
    // Zero tokens says "this call was free". No ledger row says "this app
    // cannot tell you". Only the second is true, so they must not collapse.
    const [marked] = markUnrecorded([task({ phase: 'done' })], 't1')
    expect(marked.unrecorded).toBe(true)
    expect(marked.settlement).toBeNull()
  })
})

describe('patching and dismissing', () => {
  it('patches only the named task', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b' })]
    const patched = patchTask(tasks, 'b', { phase: 'done', endedAt: 5 })
    expect(patched[0].phase).toBe('running')
    expect(patched[1].phase).toBe('done')
  })

  it('drops only the dismissed task', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b' })]
    expect(dismissTask(tasks, 'a').map((t) => t.id)).toEqual(['b'])
  })
})

describe('the flight', () => {
  const dock = { left: 900, top: 20, width: 300, height: 100 }

  it('is a delta from the dock back to the button, so only transform moves', () => {
    const delta = flightDelta({ x: 200, y: 400 }, dock)
    expect(delta).toEqual({ x: 200 - 1050, y: 400 - 70 })
  })

  it('is null with no origin, so a keyboard-started task appears in place', () => {
    // A shortcut, a background retry, a task started while the tab was
    // hidden: there is no button to fly from, and inventing a corner to fly
    // from would animate a fiction.
    expect(flightDelta(null, dock)).toBeNull()
  })

  it('is null when the click landed on the dock itself', () => {
    // Below a few pixels the "flight" is a twitch, which reads as a glitch.
    expect(flightDelta({ x: 1052, y: 72 }, dock)).toBeNull()
  })
})
