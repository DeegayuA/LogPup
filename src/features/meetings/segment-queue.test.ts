import { describe, expect, it } from 'vitest'

import { SEGMENT_UPLOAD_ATTEMPTS } from './recording-segments'
import {
  afterAttempt,
  canRetry,
  nextToUpload,
  phaseLabel,
  queueProgress,
  requeue,
  type QueuedSegment,
} from './segment-queue'

const seg = (index: number, phase: QueuedSegment['phase'], attempt = 0): QueuedSegment => ({
  index,
  phase,
  attempt,
})

describe('one in flight, lowest index first', () => {
  it('sends nothing while a segment is uploading', () => {
    expect(nextToUpload([seg(1, 'uploading'), seg(2, 'queued')])).toBeNull()
  })

  it('sends the lowest waiting index, whatever order the list is in', () => {
    expect(nextToUpload([seg(3, 'queued'), seg(1, 'queued'), seg(2, 'queued')])?.index).toBe(1)
  })

  it('sends nothing when nothing is waiting', () => {
    expect(nextToUpload([seg(1, 'done'), seg(2, 'failed')])).toBeNull()
  })
})

describe('order survives a failure in the middle', () => {
  it('sends the retrying segment BEFORE the one behind it', () => {
    // THE case this module exists for. Segment 2 failed once and 3 is waiting.
    // Concurrent uploads would let 3 reach the server first, and a transcript
    // assembled in arrival order is a meeting rearranged — still readable,
    // which is exactly why nobody would catch it.
    const queue = [seg(1, 'done'), seg(2, 'retrying', 1), seg(3, 'queued')]
    expect(nextToUpload(queue)?.index).toBe(2)
  })

  it('lets a permanently failed segment stop blocking the rest', () => {
    // Out of attempts and waiting on a person. Holding a forty-minute
    // recording hostage to one unsendable chunk loses more than it protects.
    const queue = [seg(1, 'done'), seg(2, 'failed', SEGMENT_UPLOAD_ATTEMPTS), seg(3, 'queued')]
    expect(nextToUpload(queue)?.index).toBe(3)
  })

  it('puts a manually retried segment back ahead of later work', () => {
    const revived = requeue(seg(2, 'failed', SEGMENT_UPLOAD_ATTEMPTS))
    expect(revived.phase).toBe('retrying')
    expect(revived.attempt).toBe(0)
    expect(nextToUpload([seg(1, 'done'), revived, seg(3, 'queued')])?.index).toBe(2)
  })
})

describe('attempts', () => {
  it('marks done on success', () => {
    expect(afterAttempt(seg(1, 'uploading'), 'ok').phase).toBe('done')
  })

  it('returns to retrying while attempts remain, counting the spent one', () => {
    const after = afterAttempt(seg(1, 'uploading'), 'error')
    expect(after.phase).toBe('retrying')
    expect(after.attempt).toBe(1)
  })

  it('fails only once the attempts from recording-segments are spent', () => {
    let s = seg(1, 'uploading')
    for (let i = 0; i < SEGMENT_UPLOAD_ATTEMPTS - 1; i += 1) {
      s = afterAttempt({ ...s, phase: 'uploading' }, 'error')
      expect(s.phase).toBe('retrying')
    }
    s = afterAttempt({ ...s, phase: 'uploading' }, 'error')
    expect(s.phase).toBe('failed')
    expect(canRetry(s)).toBe(false)
  })
})

describe('progress never overstates what is safe', () => {
  it('is 0 for an empty queue rather than dividing by zero', () => {
    expect(queueProgress([]).percent).toBe(0)
  })

  it('CANNOT reach 100 while a segment is still queued', () => {
    // 199 of 200 = 99.5%, which Math.round takes UP to 100. That is the only
    // ratio that distinguishes flooring-and-capping from rounding, and a
    // positive control proved the earlier 99-of-100 fixture did not: it reads
    // as 99 under both, so it asserted nothing.
    const queue = [...Array(199).keys()].map((i) => seg(i, 'done'))
    queue.push(seg(199, 'queued'))
    const progress = queueProgress(queue)
    expect(progress.percent).toBe(99)
    expect(progress.percent).toBeLessThan(100)
    expect(progress.outstanding).toBe(1)
  })

  it('CANNOT reach 100 while a segment has failed', () => {
    const queue = [...Array(199).keys()].map((i) => seg(i, 'done'))
    queue.push(seg(199, 'failed', SEGMENT_UPLOAD_ATTEMPTS))
    const progress = queueProgress(queue)
    expect(progress.percent).toBe(99)
    expect(progress.failed).toBe(1)
    // ...and it does not claim to still be working on something nobody is
    // sending: a failed segment waits on a person, not on the queue.
    expect(progress.working).toBe(false)
  })

  it('reaches 100 only when every segment is acknowledged', () => {
    const progress = queueProgress([seg(0, 'done'), seg(1, 'done')])
    expect(progress.percent).toBe(100)
    expect(progress.outstanding).toBe(0)
    expect(progress.working).toBe(false)
  })

  it('counts uploading and retrying as outstanding, not as done', () => {
    const progress = queueProgress([seg(0, 'done'), seg(1, 'uploading'), seg(2, 'retrying', 1)])
    expect(progress.done).toBe(1)
    expect(progress.outstanding).toBe(2)
    expect(progress.working).toBe(true)
  })
})

describe('phaseLabel says which attempt a person is on', () => {
  it('numbers attempts from one', () => {
    expect(phaseLabel(seg(1, 'retrying', 1))).toBe(
      `Retrying (attempt 2 of ${SEGMENT_UPLOAD_ATTEMPTS})`,
    )
    expect(phaseLabel(seg(1, 'uploading'))).toBe('Uploading')
    expect(phaseLabel(seg(1, 'queued'))).toBe('Waiting')
    expect(phaseLabel(seg(1, 'done'))).toBe('Transcribed')
  })

  it('tells somebody a failed segment is theirs to act on', () => {
    expect(phaseLabel(seg(1, 'failed', SEGMENT_UPLOAD_ATTEMPTS))).toContain('retry')
  })
})
