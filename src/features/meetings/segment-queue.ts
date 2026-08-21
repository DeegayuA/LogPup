import { SEGMENT_UPLOAD_ATTEMPTS } from '@/features/meetings/recording-segments'

/**
 * The order segments upload in, and how much of a recording is actually safe.
 *
 * Pure — no network, no IndexedDB, no React. The recorder owns the blobs and
 * the transport; this owns the two questions previously answered by whatever
 * happened to resolve first:
 *
 *   1. WHICH SEGMENT GOES NEXT. Strictly ascending, one in flight. Uploads ran
 *      concurrently, so a slow segment 2 and a fast segment 3 could reach the
 *      server out of order — and a transcript assembled in that order is a
 *      meeting rearranged, which still reads as a real conversation and is
 *      therefore wrong in a way nobody spots afterwards.
 *
 *   2. HOW MUCH IS DONE. Only a segment the server has ACKNOWLEDGED counts.
 *      Queued, uploading, retrying and failed are all outstanding, and
 *      progress must never round up to 100% while any remain. A number that
 *      overstates what is safe is worse than one admitting a failure, because
 *      it is the number somebody closes the tab on.
 *
 * Retry counts and backoff are NOT redefined here: SEGMENT_UPLOAD_ATTEMPTS and
 * segmentRetryDelayMs stay in recording-segments.ts as the single source.
 */

export type SegmentPhase = 'queued' | 'uploading' | 'retrying' | 'done' | 'failed'

export type QueuedSegment = {
  index: number
  phase: SegmentPhase
  /** Attempts SPENT so far. 0 before the first try. */
  attempt: number
}

/** Terminal for progress purposes: the server has it. */
export function isSettled(segment: QueuedSegment): boolean {
  return segment.phase === 'done'
}

/** Still owed to the server — queued, in flight, retrying, or given up on. */
export function isOutstanding(segment: QueuedSegment): boolean {
  return !isSettled(segment)
}

/**
 * The next segment to send, or null when one is already in flight or nothing
 * is waiting.
 *
 * LOWEST INDEX FIRST, and never while another is uploading. A `failed` segment
 * does NOT block the ones behind it — it has spent its attempts and is waiting
 * on a person — but a `retrying` one does, because it still owns its place in
 * the order.
 */
export function nextToUpload(segments: readonly QueuedSegment[]): QueuedSegment | null {
  if (segments.some((s) => s.phase === 'uploading')) return null
  const waiting = segments
    .filter((s) => s.phase === 'queued' || s.phase === 'retrying')
    .sort((a, b) => a.index - b.index)
  return waiting[0] ?? null
}

/** Whether this segment may be tried again automatically. */
export function canRetry(segment: QueuedSegment): boolean {
  return segment.attempt < SEGMENT_UPLOAD_ATTEMPTS
}

/**
 * Advance one segment after an attempt finishes.
 *
 * A failure with attempts left returns to `retrying` and keeps its index, so
 * the queue still sends it before anything behind it. Out of attempts it is
 * `failed` and stops blocking — holding a forty-minute recording hostage to
 * one unsendable chunk loses more than it protects.
 */
export function afterAttempt(segment: QueuedSegment, outcome: 'ok' | 'error'): QueuedSegment {
  if (outcome === 'ok') return { ...segment, phase: 'done' }
  const attempt = segment.attempt + 1
  return {
    ...segment,
    attempt,
    phase: attempt < SEGMENT_UPLOAD_ATTEMPTS ? 'retrying' : 'failed',
  }
}

/** A person pressing Retry on a failed segment puts it back in line. */
export function requeue(segment: QueuedSegment): QueuedSegment {
  return { ...segment, phase: 'retrying', attempt: 0 }
}

export type QueueProgress = {
  total: number
  done: number
  outstanding: number
  failed: number
  /** 0–100, integer. NEVER 100 while anything is outstanding. */
  percent: number
  /** True while any segment is queued, uploading or retrying. */
  working: boolean
}

export function queueProgress(segments: readonly QueuedSegment[]): QueueProgress {
  const total = segments.length
  const done = segments.filter(isSettled).length
  const failed = segments.filter((s) => s.phase === 'failed').length
  const outstanding = total - done

  // Floor, then hold at 99 while anything is outstanding. Both halves matter:
  // rounding 9/10 up would claim 100% with a segment still in flight, and
  // showing 100% beside a "1 to retry" chip is the contradiction that makes
  // somebody trust neither number.
  const raw = total === 0 ? 0 : Math.floor((done / total) * 100)
  const percent = outstanding > 0 ? Math.min(raw, 99) : raw

  return {
    total,
    done,
    outstanding,
    failed,
    percent,
    working: segments.some((s) => s.phase !== 'done' && s.phase !== 'failed'),
  }
}

/** What a per-segment row says. Attempt numbers are 1-based for a reader. */
export function phaseLabel(segment: QueuedSegment): string {
  switch (segment.phase) {
    case 'queued':
      return 'Waiting'
    case 'uploading':
      return segment.attempt > 0
        ? `Retrying (attempt ${segment.attempt + 1} of ${SEGMENT_UPLOAD_ATTEMPTS})`
        : 'Uploading'
    case 'retrying':
      return `Retrying (attempt ${segment.attempt + 1} of ${SEGMENT_UPLOAD_ATTEMPTS})`
    case 'done':
      return 'Transcribed'
    case 'failed':
      return 'Failed — retry to send again'
  }
}
