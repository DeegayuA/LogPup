import { describe, expect, it } from 'vitest'
import {
  FAILING_KEY_THRESHOLD,
  assessRecordingReadiness,
  estimateSessionShare,
  indicativeHoursPerKey,
  type KeyHealth,
} from './readiness'

const NOW = new Date('2026-08-12T12:00:00Z')
const MINUTES_AGO = new Date(NOW.getTime() - 30 * 60 * 1000)

const key = (id: string, failCount = 0, active = true, lastUsedAt: Date | null = MINUTES_AGO): KeyHealth => ({
  id,
  label: `key ${id}`,
  active,
  failCount,
  lastUsedAt,
})

describe('assessRecordingReadiness', () => {
  it('is blocked with no keys, and still says recording works', () => {
    const readiness = assessRecordingReadiness([], NOW)
    expect(readiness.level).toBe('blocked')
    expect(readiness.healthyCount).toBe(0)
    // The distinction the copy has to keep: no key stops TRANSCRIPTION, not
    // recording — the audio is captured and kept either way.
    expect(readiness.advice).toContain('Recording still works')
  })

  it('ignores inactive keys entirely', () => {
    expect(assessRecordingReadiness([key('a', 0, false)], NOW).level).toBe('blocked')
  })

  it('is ready when every active key is healthy', () => {
    const readiness = assessRecordingReadiness([key('a'), key('b')], NOW)
    expect(readiness).toMatchObject({
      level: 'ready',
      healthyCount: 2,
      failingCount: 0,
      advice: null,
    })
    expect(readiness.headline).toContain('2 Gemini keys')
  })

  it('treats a key below the threshold as still healthy', () => {
    // One bad moment is not an exhausted key — callGemini resets failCount on
    // any success, so only an unbroken run of failures means anything.
    expect(assessRecordingReadiness([key('a', FAILING_KEY_THRESHOLD - 1)], NOW).level).toBe('ready')
  })

  it('is degraded when some keys are failing but others work', () => {
    const readiness = assessRecordingReadiness([key('a'), key('b', FAILING_KEY_THRESHOLD)], NOW)
    expect(readiness).toMatchObject({ level: 'degraded', healthyCount: 1, failingCount: 1 })
  })

  it('is blocked when every active key is failing', () => {
    const readiness = assessRecordingReadiness(
      [key('a', FAILING_KEY_THRESHOLD), key('b', FAILING_KEY_THRESHOLD + 4)],
      NOW,
    )
    expect(readiness).toMatchObject({ level: 'blocked', healthyCount: 0, failingCount: 2 })
    expect(readiness.headline).toContain('out of quota')
  })

  it('does not name a single cause it cannot actually distinguish', () => {
    // failCount cannot tell a rejected key from an exhausted one from a
    // project without access to a model — asserting one would send people to
    // fix the wrong thing.
    const readiness = assessRecordingReadiness([key('a', FAILING_KEY_THRESHOLD)], NOW)
    expect(readiness.headline).toContain('rejected')
    expect(readiness.headline).toContain('out of quota')
    expect(readiness.headline).toContain('access')
  })

  it('stops counting failures once they are stale — a reset quota is not still empty', () => {
    // failCount only resets on a SUCCESS, so a key exhausted yesterday keeps
    // its failures until something spends a request on it. Reporting that as
    // "out of quota" the next morning would be advice to buy a key nobody
    // needs.
    const yesterday = new Date(NOW.getTime() - 20 * 60 * 60 * 1000)
    const stale = key('a', FAILING_KEY_THRESHOLD + 2, true, yesterday)
    expect(assessRecordingReadiness([stale], NOW)).toMatchObject({
      level: 'ready',
      healthyCount: 1,
      failingCount: 0,
    })
  })

  it('treats a never-used key as working rather than failing', () => {
    expect(assessRecordingReadiness([key('a', 99, true, null)], NOW).level).toBe('ready')
  })
})

describe('estimateSessionShare', () => {
  it('scales with duration and divides across keys', () => {
    const oneHourOneKey = estimateSessionShare(3600, 1)
    expect(estimateSessionShare(7200, 1)).toBeCloseTo(oneHourOneKey * 2, 10)
    expect(estimateSessionShare(3600, 2)).toBeCloseTo(oneHourOneKey / 2, 10)
  })

  it('is zero for a zero-length session or no keys — never Infinity or NaN', () => {
    expect(estimateSessionShare(0, 3)).toBe(0)
    expect(estimateSessionShare(3600, 0)).toBe(0)
  })
})

describe('indicativeHoursPerKey', () => {
  it('matches the published 25-tokens-per-second audio rate', () => {
    // 1,000,000 / (25 * 3600) ≈ 11.1 hours.
    expect(indicativeHoursPerKey()).toBeCloseTo(11.11, 1)
  })
})
