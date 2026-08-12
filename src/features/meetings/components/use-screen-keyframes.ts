'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HASH_HEIGHT,
  HASH_WIDTH,
  KEYFRAME_JPEG_QUALITY,
  MAX_KEYFRAMES_PER_MEETING,
  SAMPLE_INTERVAL_MS,
  computeDHash,
  computeDownscaledDimensions,
  hammingDistance,
  shouldKeepFrame,
} from '@/features/meetings/screen-keyframes'
import { uploadMeetingKeyframe, type MeetingScreenshotView } from '@/features/meetings/ai-actions'

/**
 * The client half of change-detected screen capture — the piece the pure
 * logic in screen-keyframes.ts and the upload action in ai-actions.ts were
 * both written for, and which did not exist: a screen recording captured
 * audio only, so the final synthesis pass never saw a single slide, diagram
 * or code diff that was shared.
 *
 * Every SAMPLE_INTERVAL_MS it draws the shared video track to a canvas
 * twice: once at 9×8 to compute a perceptual hash (the keep/skip decision),
 * and — only when that decision says keep — once at up to 1280px on the long
 * edge to produce the JPEG that is actually uploaded. A frame that did not
 * perceptually change costs one tiny canvas draw and nothing else.
 *
 * Everything here is best-effort by construction: a failed draw, encode or
 * upload skips that frame and the next tick tries again. Screen capture is
 * enrichment layered on a recording — it must never be able to interrupt one.
 */
export type ScreenKeyframesHandle = {
  /** Frames kept and uploaded so far, oldest first. */
  frames: MeetingScreenshotView[]
  /** True once the cap is reached — the UI says so rather than going quiet. */
  atCap: boolean
  /**
   * Why capture stopped early, when it did — the screen share ended, or the
   * server kept refusing. Non-null means the strip is no longer growing and
   * the UI must say so instead of implying nothing has changed on screen.
   */
  stoppedReason: string | null
  start: (video: MediaStreamTrack, startedAt: number) => void
  stop: () => void
  /** Drops one frame from local state after the caller deletes it server-side. */
  forget: (id: string) => void
}

export function useScreenKeyframes(meetingId: string): ScreenKeyframesHandle {
  const [frames, setFrames] = useState<MeetingScreenshotView[]>([])
  const [atCap, setAtCap] = useState(false)
  const [stoppedReason, setStoppedReason] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const firstSampleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const trackEndedRef = useRef<(() => void) | null>(null)
  const lastHashRef = useRef<boolean[] | null>(null)
  const keptCountRef = useRef(0)
  const startedAtRef = useRef(0)
  const failureCountRef = useRef(0)
  // One sample at a time: an upload can outlast the sample interval on a slow
  // connection, and overlapping ticks would race the hash cursor and could
  // blow past the cap.
  const busyRef = useRef(false)
  /**
   * Bumped by every start() and stop(). A sample captures it before its first
   * await and re-checks after each one, so a sample still parked on a slow
   * upload when the recording stops can never write its result into the NEXT
   * recording's state. A plain boolean cannot express that: start() clears
   * it, and the stale sample then sees a "running" session that is not its
   * own.
   */
  const epochRef = useRef(0)
  const stoppedRef = useRef(true)

  const stop = useCallback(() => {
    stoppedRef.current = true
    epochRef.current += 1
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (firstSampleRef.current) {
      clearTimeout(firstSampleRef.current)
      firstSampleRef.current = null
    }
    const track = trackRef.current
    if (track && trackEndedRef.current) track.removeEventListener('ended', trackEndedRef.current)
    trackEndedRef.current = null
    trackRef.current = null

    const video = videoElRef.current
    videoElRef.current = null
    if (video) {
      video.pause()
      video.srcObject = null
    }
    // The MediaStream wrapper is ours; the TRACK belongs to the caller's
    // getDisplayMedia stream and is stopped by their own cleanup.
    streamRef.current = null
    lastHashRef.current = null
    // busyRef is deliberately NOT cleared: an in-flight sample still owns the
    // guard and clears it in its own `finally`. Clearing it here would let the
    // next recording's first tick run concurrently with that stale sample.
  }, [])

  // Capture must never outlive the panel — a detached video element still
  // pulling frames from a live screen share is invisible work on a screen the
  // user believes nobody is reading.
  useEffect(() => stop, [stop])

  const sample = useCallback(async () => {
    if (busyRef.current || stoppedRef.current) return
    const video = videoElRef.current
    if (!video || video.readyState < 2 || video.videoWidth === 0) return

    const epoch = epochRef.current
    busyRef.current = true
    try {
      const hash = hashOfFrame(video)
      if (!hash) return

      const previous = lastHashRef.current
      const distance = previous ? hammingDistance(previous, hash) : 0
      const isFirst = previous === null
      if (!shouldKeepFrame(distance, isFirst, keptCountRef.current)) {
        if (keptCountRef.current >= MAX_KEYFRAMES_PER_MEETING) setAtCap(true)
        return
      }

      const blob = await encodeFrame(video)
      if (!blob || epochRef.current !== epoch) return

      const capturedAtMs = Math.max(0, Date.now() - startedAtRef.current)
      const file = new File([blob], `keyframe-${capturedAtMs}.jpg`, { type: 'image/jpeg' })
      const { width, height } = computeDownscaledDimensions(video.videoWidth, video.videoHeight)

      const res = await uploadMeetingKeyframe(meetingId, file, capturedAtMs, width, height)
      // A recording that stopped (or restarted) while this upload was in
      // flight must not have this frame written into its state.
      if (epochRef.current !== epoch) return

      if (!res.ok) {
        // The baseline is deliberately NOT advanced on failure: the next tick
        // must re-make the same decision, including the "always keep the
        // first frame" branch, which would otherwise be spent on a frame that
        // never reached the server.
        if (res.error.includes('cap for this meeting')) {
          keptCountRef.current = MAX_KEYFRAMES_PER_MEETING
          setAtCap(true)
          return
        }
        // Everything else that can refuse a keyframe here is permanent for
        // this meeting — storage not configured, not allowed to record it,
        // an image type the server won't take. Retrying a full 1280px JPEG
        // every 10 seconds for an hour against a refusal that cannot change
        // is pure waste, so give up after a few and say why.
        failureCountRef.current += 1
        if (failureCountRef.current >= MAX_CONSECUTIVE_UPLOAD_FAILURES) {
          setStoppedReason(res.error)
          stop()
        }
        return
      }

      failureCountRef.current = 0
      // The baseline advances ONLY on a frame that was actually kept, which
      // is what KEYFRAME_DIFF_THRESHOLD is documented against ("distance from
      // the last KEPT frame"). Advancing it on every look would compare each
      // frame to the one 10 seconds earlier, so a screen that drifts slowly —
      // someone scrolling a document, a diagram being built up — would never
      // clear the threshold in a single step and would never be captured at
      // all.
      lastHashRef.current = hash
      keptCountRef.current += 1
      setFrames((current) => [...current, res.data])
      if (keptCountRef.current >= MAX_KEYFRAMES_PER_MEETING) setAtCap(true)
    } catch {
      // Best-effort: a dropped frame is not worth a toast, let alone an
      // interruption to the recording this is enriching.
    } finally {
      busyRef.current = false
    }
  }, [meetingId, stop])

  const start = useCallback(
    (track: MediaStreamTrack, startedAt: number) => {
      stop()
      stoppedRef.current = false
      epochRef.current += 1
      startedAtRef.current = startedAt
      keptCountRef.current = 0
      failureCountRef.current = 0
      lastHashRef.current = null
      setFrames([])
      setAtCap(false)
      setStoppedReason(null)

      // "Stop sharing" in the browser's own bar ends the track, but the video
      // element keeps its last decoded frame — readyState and videoWidth stay
      // valid, so without this the sampler would spend the rest of the
      // meeting hashing one frozen image and the strip would quietly stop
      // growing while still claiming to be watching.
      const onEnded = () => {
        setStoppedReason('Screen sharing ended — no more screens will be captured.')
        stop()
      }
      track.addEventListener('ended', onEnded, { once: true })
      trackRef.current = track
      trackEndedRef.current = onEnded

      // A detached <video> is the only way to read pixels off a MediaStream
      // track — canvas cannot draw a track directly. Muted + playsInline so
      // no browser refuses to play it and no audio is duplicated.
      const stream = new MediaStream([track])
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      streamRef.current = stream
      videoElRef.current = video
      void video.play().catch(() => undefined)

      timerRef.current = setInterval(() => void sample(), SAMPLE_INTERVAL_MS)
      // The opening screen (a shared agenda, a starting slide) is always kept
      // by shouldKeepFrame, but a track that has only just started often has
      // no decodable frame yet — hence a short delay rather than an immediate
      // first sample, and a full interval would miss the opening entirely.
      firstSampleRef.current = setTimeout(() => void sample(), 1500)
    },
    [sample, stop],
  )

  const forget = useCallback((id: string) => {
    setFrames((current) => current.filter((frame) => frame.id !== id))
    keptCountRef.current = Math.max(0, keptCountRef.current - 1)
    setAtCap(false)
  }, [])

  return { frames, atCap, stoppedReason, start, stop, forget }
}

/**
 * How many consecutive upload refusals before capture gives up. Small on
 * purpose: every refusal this hook can hit that is not the per-meeting cap
 * is permanent for this meeting (storage unconfigured, not allowed to record
 * it, an image type the server rejects), so a few attempts is enough to rule
 * out a transient network blip without shipping a few hundred KB of JPEG
 * every ten seconds into a wall.
 */
const MAX_CONSECUTIVE_UPLOAD_FAILURES = 3

/**
 * Draws the current video frame at HASH_WIDTH × HASH_HEIGHT and returns its
 * dHash. Returns null when a canvas context is unavailable (one can be
 * refused under memory pressure) — the caller treats that as "skip this
 * tick", not as an error.
 */
function hashOfFrame(video: HTMLVideoElement): boolean[] | null {
  const canvas = document.createElement('canvas')
  canvas.width = HASH_WIDTH
  canvas.height = HASH_HEIGHT
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  context.drawImage(video, 0, 0, HASH_WIDTH, HASH_HEIGHT)
  const { data } = context.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT)

  const grayscale: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 601 luma — the standard perceptual weighting, so a colour change
    // a human would not read as "different content" (a tinted theme, a
    // coloured cursor) barely moves the value.
    grayscale.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }
  return computeDHash(grayscale)
}

/** Encodes the frame as a downscaled JPEG, or null if the browser refuses. */
async function encodeFrame(video: HTMLVideoElement): Promise<Blob | null> {
  const { width, height } = computeDownscaledDimensions(video.videoWidth, video.videoHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(video, 0, 0, width, height)

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', KEYFRAME_JPEG_QUALITY)
  })
}
