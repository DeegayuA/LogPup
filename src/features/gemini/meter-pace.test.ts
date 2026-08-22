import { describe, expect, it } from 'vitest'

import {
  MAX_DURATION_SAMPLES,
  MIN_PACE_SAMPLES,
  PACE_EXEMPT,
  durationStorage,
  paceKey,
  paceView,
  recordDuration,
  stepsRemainingMs,
  typicalMs,
  type DurationHistory,
} from './meter-pace'

describe('recording durations', () => {
  it('keeps only the newest MAX_DURATION_SAMPLES', () => {
    let history: DurationHistory = {}
    for (let i = 1; i <= MAX_DURATION_SAMPLES + 3; i += 1) {
      history = recordDuration(history, 'k', i * 1000)
    }
    expect(history.k).toHaveLength(MAX_DURATION_SAMPLES)
    expect(history.k[0]).toBe(4000)
  })

  it('refuses nonsense durations', () => {
    expect(recordDuration({}, 'k', 0)).toEqual({})
    expect(recordDuration({}, 'k', -5)).toEqual({})
    expect(recordDuration({}, 'k', Number.NaN)).toEqual({})
  })

  it('separates a pinned model from the default chain', () => {
    // A Pro median is severalfold Flash's; one key inheriting the other's
    // history would put a wrong "typical" beside a live clock.
    expect(paceKey('daily-briefing', 'gemini-2.5-pro')).not.toBe(paceKey('daily-briefing', null))
  })
})

describe('typicalMs', () => {
  it('stays silent below MIN_PACE_SAMPLES — two runs are an anecdote', () => {
    let history: DurationHistory = {}
    for (let i = 0; i < MIN_PACE_SAMPLES - 1; i += 1) {
      history = recordDuration(history, 'k', 40_000)
    }
    expect(typicalMs(history, 'k')).toBeNull()
    history = recordDuration(history, 'k', 40_000)
    expect(typicalMs(history, 'k')).toEqual({ p50: 40_000, samples: MIN_PACE_SAMPLES })
  })

  it('takes the median, so one slow outlier cannot move the typical', () => {
    let history: DurationHistory = {}
    for (const ms of [30_000, 31_000, 32_000, 300_000]) history = recordDuration(history, 'k', ms)
    expect(typicalMs(history, 'k')?.p50).toBe(31_500)
  })
})

describe('paceView never claims completion', () => {
  it('CANNOT reach 100 however long the call runs', () => {
    // 199s elapsed of a 200s typical is 99.5% — the one ratio that separates
    // flooring-and-capping from rounding, which would print 100 here.
    expect(paceView(199_000, 200_000).percent).toBe(99)
    expect(paceView(200_000, 200_000).percent).toBe(99)
    expect(paceView(500_000, 200_000).percent).toBe(99)
  })

  it('overrun drops the countdown instead of going negative', () => {
    const over = paceView(65_000, 60_000)
    expect(over.overrun).toBe(true)
    expect(over.remainingMs).toBeNull()
    const under = paceView(45_000, 60_000)
    expect(under.overrun).toBe(false)
    expect(under.remainingMs).toBe(15_000)
  })

  it('a broken typical yields nothing rather than dividing by zero', () => {
    expect(paceView(10_000, 0)).toEqual({ percent: 0, remainingMs: null, overrun: false })
  })
})

describe('stepsRemainingMs', () => {
  it('needs two finished steps — one is a sample, not a rate', () => {
    expect(stepsRemainingMs({ done: 1, total: 10, failed: 0 }, 30_000)).toBeNull()
    expect(stepsRemainingMs({ done: 2, total: 10, failed: 0 }, 30_000)).toBe(120_000)
  })

  it('a failed step is not outstanding — nobody is sending it', () => {
    // 4 done, 1 failed, 5 total: nothing left to wait for.
    expect(stepsRemainingMs({ done: 4, total: 5, failed: 1 }, 40_000)).toBeNull()
  })
})

describe('the exempt list holds the features whose duration is fiction', () => {
  it('exempts the meeting write-up and live sessions', () => {
    expect(PACE_EXEMPT.has('meeting-intel')).toBe(true)
    expect(PACE_EXEMPT.has('live-captions')).toBe(true)
    expect(PACE_EXEMPT.has('daily-briefing')).toBe(false)
  })
})

describe('durationStorage survives whatever localStorage hands back', () => {
  it('round-trips a history', () => {
    const history = recordDuration(recordDuration({}, 'k', 1000), 'k', 2000)
    expect(durationStorage.parse(durationStorage.serialize(history))).toEqual(history)
  })

  it('turns garbage into an empty history, never a throw', () => {
    expect(durationStorage.parse(null)).toEqual({})
    expect(durationStorage.parse('not json')).toEqual({})
    expect(durationStorage.parse('[1,2]')).toEqual({})
    expect(durationStorage.parse('{"k": "nope", "j": [-1, 0], "ok": [5]}')).toEqual({ ok: [5] })
  })
})
