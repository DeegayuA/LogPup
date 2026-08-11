'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { requestLiveToken } from '../actions'
import { type LiveStatus, LiveTranscriptionSession } from '../live-client'
import { EMPTY_TRANSCRIPT, type TranscriptState, fullText } from '../transcript-buffer'
import { type AutoStopReason } from '../session-budget'

export type LiveTranscriptionHandle = {
  status: LiveStatus
  /** Text from completed turns. Mirrors meeting-intel's `finalText`. */
  finalText: string
  /** Text for the turn in flight. Mirrors meeting-intel's `interimText`. */
  interimText: string
  /** Everything so far — feed this to the existing `liveTranscriptHint` flow. */
  combinedText: string
  /**
   * User-facing explanation when the live path degraded. Non-null means the
   * caller MUST fall back and show this; never swallow it.
   */
  notice: string | null
  /** True only once real transcription has arrived on the current session. */
  isTranscribing: boolean
  start: (stream: MediaStream) => Promise<void>
  stop: () => void
}

/**
 * React binding for {@link LiveTranscriptionSession}.
 *
 * The transcript is mirrored into a ref as well as state because the consumer
 * (meeting-intel) reads the latest transcript from inside non-React callbacks —
 * MediaRecorder's `ondataavailable` and the finalize path — where a captured
 * state value would be stale.
 */
export function useLiveTranscription(meetingId: string): LiveTranscriptionHandle {
  const [status, setStatus] = useState<LiveStatus>('idle')
  const [transcript, setTranscript] = useState<TranscriptState>(EMPTY_TRANSCRIPT)
  const [notice, setNotice] = useState<string | null>(null)

  const sessionRef = useRef<LiveTranscriptionSession | null>(null)
  const transcriptRef = useRef<TranscriptState>(EMPTY_TRANSCRIPT)

  const stop = useCallback(() => {
    sessionRef.current?.stop()
    sessionRef.current = null
  }, [])

  // A live socket must never outlive the component that owns it: an unmounted
  // panel with an open session would keep streaming (and billing) invisibly.
  useEffect(() => stop, [stop])

  const start = useCallback(
    async (stream: MediaStream) => {
      stop()
      setNotice(null)
      transcriptRef.current = EMPTY_TRANSCRIPT
      setTranscript(EMPTY_TRANSCRIPT)

      const session = new LiveTranscriptionSession({
        stream,
        requestToken: async () => {
          const result = await requestLiveToken(meetingId)
          if (!result.ok) throw new Error(result.error)
          return { token: result.data.token, model: result.data.model }
        },
        callbacks: {
          onStatusChange: setStatus,
          onTranscript: (next) => {
            transcriptRef.current = next
            setTranscript(next)
          },
          onFailure: (message) => setNotice(message),
          onAutoStop: (reason: AutoStopReason) => {
            setNotice(
              reason === 'max-duration'
                ? 'Live transcription stopped at the 1-hour limit to protect your Gemini quota. Recording continues.'
                : 'Live transcription stopped after 5 minutes of silence. Recording continues.',
            )
          },
        },
      })

      sessionRef.current = session
      await session.start()
    },
    [meetingId, stop],
  )

  return {
    status,
    finalText: transcript.committed,
    interimText: transcript.interim,
    combinedText: fullText(transcript),
    notice,
    // Deliberately not `status === 'live' || status === 'listening'`: a connected
    // socket that has produced nothing is not transcribing, and saying otherwise
    // is the exact dishonesty that hid the previous bug.
    isTranscribing: status === 'live',
    start,
    stop,
  }
}
