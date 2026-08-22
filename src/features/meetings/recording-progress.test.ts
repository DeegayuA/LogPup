import { describe, expect, it } from 'vitest'
import {
  MIN_RATE_SAMPLES,
  formatRemaining,
  meetingProcessing,
  observedMsPerSegment,
  type SegmentSnapshot,
  type TakeSnapshot,
} from './recording-progress'

const seg = (index: number, state: SegmentSnapshot['state'], tookMs?: number): SegmentSnapshot => ({
  index,
  state,
  ...(tookMs === undefined ? {} : { tookMs }),
})

const take = (over: Partial<TakeSnapshot> = {}): TakeSnapshot => ({
  takeIndex: 1,
  label: null,
  startedAt: 1_000,
  endedAt: 2_000,
  segments: [],
  ...over,
})

describe('rounds', () => {
  it('counts each take as a round', () => {
    // A studio presses record ten or fifteen times in one meeting. Each press
    // is a round, and the meeting is the sum of them.
    const takes = [1, 2, 3].map((i) => take({ takeIndex: i, segments: [seg(0, 'done', 5_000)] }))
    expect(meetingProcessing(takes).rounds).toBe(3)
  })

  it('separates rounds still going from rounds finished', () => {
    const takes = [
      take({ takeIndex: 1, segments: [seg(0, 'done', 5_000)] }),
      take({ takeIndex: 2, endedAt: null, segments: [seg(1, 'uploading')] }),
    ]
    const result = meetingProcessing(takes)
    expect(result.roundsActive).toBe(1)
    expect(result.takes[1].active).toBe(true)
  })

  it('treats a take still recording as active even with every segment done', () => {
    // endedAt null means the mic is still open. More segments are coming.
    const t = take({ endedAt: null, segments: [seg(0, 'done', 4_000)] })
    expect(meetingProcessing([t]).takes[0].active).toBe(true)
  })
})

describe('percentage', () => {
  it('is null before anything has been cut, never zero', () => {
    // No segments means no denominator. "0%" would claim there is one and
    // that the run is at the bottom of it.
    expect(meetingProcessing([take({ segments: [] })]).percent).toBeNull()
    expect(meetingProcessing([]).percent).toBeNull()
  })

  it('counts done over total across every take', () => {
    const takes = [
      take({ takeIndex: 1, segments: [seg(0, 'done', 4_000), seg(1, 'done', 4_000)] }),
      take({ takeIndex: 2, segments: [seg(2, 'done', 4_000), seg(3, 'pending')] }),
    ]
    expect(meetingProcessing(takes).percent).toBe(75)
  })

  it('holds at 99 until the last segment really lands', () => {
    // The last segment is the one somebody sits and watches. A bar at 100%
    // beside a spinner teaches the reader the number is decorative — and then
    // the honest numbers next to it are not believed either.
    const segs = Array.from({ length: 200 }, (_, i) => seg(i, i < 199 ? 'done' : 'uploading', 4_000))
    expect(meetingProcessing([take({ segments: segs })]).percent).toBe(99)
  })

  it('reaches 100 only when everything is done', () => {
    const segs = [seg(0, 'done', 4_000), seg(1, 'done', 4_000)]
    expect(meetingProcessing([take({ segments: segs })]).percent).toBe(100)
  })

  it('does not count a failed segment as finished', () => {
    // Failures are retried, not abandoned. Counting one as done would promise
    // a finish line the run has not reached.
    const segs = [seg(0, 'done', 4_000), seg(1, 'failed')]
    const result = meetingProcessing([take({ segments: segs })])
    expect(result.percent).toBe(50)
    expect(result.failed).toBe(1)
  })
})

describe('time remaining', () => {
  it('says nothing until two segments have finished', () => {
    // One segment's duration includes the model warming and the first upload
    // negotiating. A rate built from it alone overstates every meeting.
    expect(observedMsPerSegment([8_000])).toBeNull()
    expect(MIN_RATE_SAMPLES).toBe(2)
    const result = meetingProcessing([take({ segments: [seg(0, 'done', 8_000), seg(1, 'pending')] })])
    expect(result.remainingMs).toBeNull()
    expect(result.estimatePending).toBe(true)
  })

  it('estimates from the rate this run is actually achieving', () => {
    // Two done at 10s each, two to go — twenty seconds, measured from the
    // machine in front of the user rather than a historical average.
    const segs = [seg(0, 'done', 10_000), seg(1, 'done', 10_000), seg(2, 'pending'), seg(3, 'pending')]
    const result = meetingProcessing([take({ segments: segs })])
    expect(result.remainingMs).toBe(20_000)
    expect(result.estimatePending).toBe(false)
  })

  it('resists one slow segment, which a mean would not', () => {
    // A retry storm on one segment must not tell somebody to wait when they
    // need not — being wrong in that direction is the costly one.
    expect(observedMsPerSegment([10_000, 10_000, 10_000, 240_000])).toBe(10_000)
  })

  it('counts a failed segment as still outstanding', () => {
    const segs = [seg(0, 'done', 10_000), seg(1, 'done', 10_000), seg(2, 'failed')]
    expect(meetingProcessing([take({ segments: segs })]).remainingMs).toBe(10_000)
  })

  it('is null when there is nothing left to wait for', () => {
    const segs = [seg(0, 'done', 10_000), seg(1, 'done', 10_000)]
    const result = meetingProcessing([take({ segments: segs })])
    expect(result.remainingMs).toBeNull()
    expect(result.estimatePending).toBe(false)
  })

  it('pools the rate across takes, because the machine is the same one', () => {
    const takes = [
      take({ takeIndex: 1, segments: [seg(0, 'done', 6_000)] }),
      take({ takeIndex: 2, segments: [seg(1, 'done', 6_000), seg(2, 'pending')] }),
    ]
    expect(meetingProcessing(takes).remainingMs).toBe(6_000)
  })
})

describe('how the estimate is worded', () => {
  it('says nothing at all when there is no estimate', () => {
    expect(formatRemaining(null)).toBeNull()
  })

  it('refuses to count seconds', () => {
    // A per-second countdown implies a precision the rate does not have, and
    // watching it jump from 12s to 40s is worse than not being told.
    expect(formatRemaining(20_000)).toBe('under a minute left')
    expect(formatRemaining(59_000)).toBe('under a minute left')
  })

  it('rounds to minutes, then to hours', () => {
    expect(formatRemaining(64_000)).toBe('about a minute left')
    expect(formatRemaining(9 * 60_000)).toBe('about 9 minutes left')
    expect(formatRemaining(125 * 60_000)).toBe('about 2h 5m left')
    expect(formatRemaining(120 * 60_000)).toBe('about 2h left')
  })
})
