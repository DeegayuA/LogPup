'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  meterOrigin,
  useAiMeter,
  type MeterOriginSource,
} from '@/features/gemini/components/ai-meter-provider'
import { transcribeDictation } from '../actions'

/**
 * Push-to-talk dictation: hold the mic open, then send one short clip to
 * Gemini and hand the caller plain text back.
 *
 * Deliberately NOT the Web Speech API that the meeting recorder falls back
 * to: Chrome ships no Sinhala model, so a browser recognizer cannot dictate
 * half of what this team actually says. One short generateContent call per
 * dictation is also cheap on a free key — a few seconds of audio, one
 * request — unlike a streaming session.
 *
 * The recorded clip is never persisted anywhere: it goes straight to the
 * server action and is dropped once the text comes back.
 */
export type DictationHandle = {
  /** True while the mic is open and capturing. */
  recording: boolean
  /** True while the captured clip is being transcribed. */
  transcribing: boolean
  /** Whether this browser can record at all (no MediaRecorder = no dictation). */
  supported: boolean
  error: string | null
  start: (origin?: MeterOriginSource) => Promise<void>
  stop: () => void
  cancel: () => void
}

const MAX_CLIP_MS = 60_000

export function useDictation(onText: (text: string) => void): DictationHandle {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const cancelledRef = useRef(false)
  const capRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The callback is read from a ref inside MediaRecorder's onstop, which is
  // registered once — a captured prop would be frozen at the render that
  // registered it. Written in an effect rather than during render: a ref
  // mutation during render is not guaranteed to survive a discarded render
  // pass, and the handler only ever fires after commit anyway.
  const onTextRef = useRef(onText)
  useEffect(() => {
    onTextRef.current = onText
  }, [onText])

  const supported = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined'

  const releaseDevice = useCallback(() => {
    if (capRef.current) {
      clearTimeout(capRef.current)
      capRef.current = null
    }
    const stream = streamRef.current
    streamRef.current = null
    if (stream) for (const track of stream.getTracks()) track.stop()
    recorderRef.current = null
  }, [])

  // A dictation must never outlive the field it belongs to — an unmounted
  // component with a live mic keeps the recording indicator lit.
  useEffect(
    () => () => {
      cancelledRef.current = true
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          /* already stopping */
        }
      }
      releaseDevice()
    },
    [releaseDevice],
  )

  const meter = useAiMeter()
  /* The origin is frozen at the START of the recording, not at the stop:
     transcription fires from recorder.onstop, seconds or minutes later, with
     no event in scope at all. The button the person pressed to begin is the
     honest place for the meter to have come from. */
  const originRef = useRef<ReturnType<typeof meterOrigin>>(null)
  const start = useCallback(async (originSource?: MeterOriginSource) => {
    originRef.current = meterOrigin(originSource)
    if (recorderRef.current || !supported) return
    setError(null)
    cancelledRef.current = false

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
    } catch {
      setError('Microphone unavailable — check permissions')
      return
    }
    // The permission prompt can outlive the component. Nothing after this
    // point would ever stop these tracks if the field has gone away, and the
    // OS recording indicator would stay lit with nobody listening.
    if (cancelledRef.current) {
      for (const track of stream.getTracks()) track.stop()
      return
    }

    let mimeType = ''
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus'
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm'
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      // Safari records AAC in an MP4 container and supports nothing else;
      // Gemini accepts audio/mp4 the same as WebM.
      mimeType = 'audio/mp4'
    }

    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: 32_000,
    })
    streamRef.current = stream
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      const parts = chunksRef.current
      chunksRef.current = []
      releaseDevice()
      setRecording(false)
      if (cancelledRef.current || parts.length === 0) return

      const blob = new Blob(parts, { type: parts[0]?.type || 'audio/webm' })
      setTranscribing(true)
      void (async () => {
        try {
          const formData = new FormData()
          formData.append('audio', new File([blob], 'dictation', { type: blob.type }))
          const res = await meter.track('dictation', originRef.current, () =>
            transcribeDictation(formData),
          )
          if (!res.ok) {
            setError(res.error)
            return
          }
          if (!res.data.text) {
            setError('Nothing was heard — try again closer to the mic')
            return
          }
          onTextRef.current(res.data.text)
        } catch {
          setError('Could not reach the server — try again')
        } finally {
          setTranscribing(false)
        }
      })()
    }

    recorder.start()
    setRecording(true)
    // Hard cap so a forgotten dictation cannot record forever (and cannot
    // exceed the server action's clip size limit).
    capRef.current = setTimeout(() => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    }, MAX_CLIP_MS)
  }, [meter, releaseDevice, supported])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    stop()
  }, [stop])

  return { recording, transcribing, supported, error, start, stop, cancel }
}
