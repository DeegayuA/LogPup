'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  meterOrigin,
  useAiMeter,
  type MeterOriginSource,
} from '@/features/gemini/components/ai-meter-provider'
import { synthesizeSpeech } from '../actions'
import { sinhalaFraction, toSpokenText } from '../spoken-text'
import { base64ToBytes, parsePcmRate, pcmToWav } from '../wav'

/**
 * "AI talks back": speaks a piece of text aloud, with the same
 * degrade-don't-disappear ladder the transcription side uses.
 *
 *  1. Gemini TTS — a real voice, and the only rung that pronounces Sinhala
 *     properly (browser voices for si-LK effectively do not exist).
 *  2. The browser's own speechSynthesis — free, offline, no quota; the
 *     fallback whenever the Gemini call fails (no key, quota exhausted,
 *     model unavailable).
 *  3. Nothing — reported to the caller as an error, never as silence.
 *
 * The rung actually used is exposed so the UI can say so rather than let a
 * robotic browser voice imply the AI feature is broken.
 */
export type SpeechHandle = {
  speaking: boolean
  /** True while waiting for Gemini's audio (before any sound plays). */
  loading: boolean
  /** Which rung produced the audio currently playing, if any. */
  engine: 'gemini' | 'browser' | null
  error: string | null
  speak: (text: string, origin?: MeterOriginSource) => Promise<void>
  stop: () => void
}

export function useSpeech(): SpeechHandle {
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [engine, setEngine] = useState<'gemini' | 'browser' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  // Generation counter, NOT a boolean: each speak() takes a ticket, and stop()
  // (or a newer speak) advances the counter, invalidating every older ticket.
  // The boolean this replaces had a real race — speak(B) during speak(A)'s
  // in-flight synthesis reset it to false, which UN-cancelled A: both clips
  // then played over each other and only B's could be stopped.
  const genRef = useRef(0)

  const cleanupAudio = useCallback(() => {
    const audio = audioRef.current
    audioRef.current = null
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.pause()
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    genRef.current += 1
    cleanupAudio()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
    setLoading(false)
    setEngine(null)
  }, [cleanupAudio])

  // Audio must never outlive the component — a page navigation with a voice
  // still talking is its own small horror.
  useEffect(() => stop, [stop])

  // Warm the browser voice registry once: getVoices() is free and kicks off
  // the async voice-list load, so the fallback rung doesn't pay Chromium's
  // TTS-service spin-up lag at the exact moment Gemini has already failed.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
    }
  }, [])

  const speakInBrowser = useCallback(
    (text: string): 'spoken' | 'no-sinhala-voice' | 'unavailable' => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return 'unavailable'
      const utterance = new SpeechSynthesisUtterance(text)
      // speechSynthesis.speak() accepts ANY text and fires onend normally even
      // when the chosen voice skips every character it cannot render — so for
      // Sinhala the language must be asked for explicitly, and a reading that
      // would silently drop most of the content must be refused instead:
      // rung 3 of the ladder is an honest error, never silence.
      const sinhala = sinhalaFraction(text)
      if (sinhala > 0) {
        const voice = window.speechSynthesis
          .getVoices()
          .find((v) => v.lang.toLowerCase().startsWith('si'))
        if (voice) {
          utterance.voice = voice
          utterance.lang = voice.lang
        } else if (sinhala > 0.3) {
          // Mostly Sinhala with no Sinhala voice installed: the default
          // (page-language, i.e. English) voice would skip the Sinhala and
          // report success. Refuse rather than claim the device is reading it.
          return 'no-sinhala-voice'
        } else {
          // Mostly English with scattered Sinhala: still worth hearing, but
          // ask for si-LK so a capable engine can render the Sinhala runs.
          utterance.lang = 'si-LK'
        }
      }
      utterance.onend = () => {
        setSpeaking(false)
        setEngine(null)
      }
      utterance.onerror = () => {
        setSpeaking(false)
        setEngine(null)
      }
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
      setEngine('browser')
      setSpeaking(true)
      return 'spoken'
    },
    [],
  )

  const meterApi = useAiMeter()
  const speak = useCallback(
    async (text: string, originSource?: MeterOriginSource) => {
      // Frozen on the first line: speak() awaits before it ever reaches
      // synthesizeSpeech, and React nulls an event's currentTarget as soon as
      // its handler returns.
      const origin = meterOrigin(originSource)
      // Callers hand over what is on screen, which for the meeting summary is
      // Markdown. Stripping it here rather than at each call site means no
      // future caller can accidentally have "hash hash Decisions made" read
      // out loud — and it is a no-op for text that was never Markdown.
      const trimmed = toSpokenText(text.trim())
      if (!trimmed) return

      stop()
      // This invocation's ticket. Anything that advances the counter from here
      // on — a stop(), or a newer speak() calling stop() — makes every check
      // below bail out, and can never re-arm an older invocation.
      const gen = ++genRef.current
      setError(null)
      setLoading(true)

      let played = false
      try {
        // Chunk 0 only. The rest are fetched while this one is already
        // playing — a whole summary in one response exceeds the platform's
        // buffered-response ceiling and fails outright, and waiting for all
        // of it would put 15-45s of silence first anyway. See chunk-speech.ts.
        //
        // ONE meter for the whole reading, wrapped around chunk 0 alone. The
        // later chunks are the same feature, the same key and the same slug
        // inside the same settle window, so the ledger sums them into this
        // card by itself — while a meter per chunk would put five cards in
        // the corner for one press of Play.
        const res = await meterApi.track('read-aloud', origin, () =>
          synthesizeSpeech(trimmed, 0),
        )
        // Stale ticket: a stop() or newer speak() happened while Gemini was
        // generating. No cleanup — this invocation owns no audio yet, and the
        // shared refs may already belong to the newer one.
        if (genRef.current !== gen) return
        if (res.ok) {
          if (res.data.truncated) {
            // Never let a shortened reading pass as the whole thing — the
            // listener would believe they had heard all of it.
            setError('That was long, so only the first few minutes are read aloud.')
          }

          const { chunkCount } = res.data
          // Chunk n+1 is requested as soon as chunk n starts playing, so the
          // next clip is usually decoded and waiting by the time this one
          // ends. Depth 1 on purpose: deeper prefetch spends the caller's
          // own free-tier rate limit on audio they may stop before reaching.
          let ahead: ReturnType<typeof synthesizeSpeech> | null = null

          const playChunk = async (
            data: { audioBase64: string; mimeType: string },
            index: number,
          ): Promise<void> => {
            // Gemini returns headerless PCM; browsers only play containerised
            // audio, so it is wrapped in a WAV header here (see wav.ts).
            const pcm = base64ToBytes(data.audioBase64)
            const wav = pcmToWav(pcm, parsePcmRate(data.mimeType))
            const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
            objectUrlRef.current = url
            const audio = new Audio(url)
            audioRef.current = audio

            const next = index + 1
            // Start the next request BEFORE awaiting this chunk's playback.
            ahead = next < chunkCount ? synthesizeSpeech(trimmed, next) : null

            const finished = new Promise<void>((resolve) => {
              audio.onended = () => resolve()
              audio.onerror = () => {
                setError('That audio could not be played')
                resolve()
              }
            })

            await audio.play()
            if (genRef.current !== gen) {
              audio.pause()
              URL.revokeObjectURL(url)
              return
            }
            setEngine('gemini')
            setSpeaking(true)
            // Sound is out, so the caller is no longer waiting even though
            // later chunks are still being fetched behind it.
            setLoading(false)

            await finished
            if (genRef.current !== gen) return

            cleanupAudio()
            const pending = ahead
            if (!pending) {
              setSpeaking(false)
              setEngine(null)
              return
            }
            const nextRes = await pending
            if (genRef.current !== gen) return
            if (!nextRes.ok) {
              // Mid-reading failure: say so rather than falling silent
              // partway through, which is indistinguishable from having
              // reached the end.
              setSpeaking(false)
              setEngine(null)
              setError('The rest of that could not be read aloud.')
              return
            }
            await playChunk(nextRes.data, next)
          }

          await playChunk(res.data, 0)
          played = true
          return
        }
        // Gemini refused (no key, quota, model gone). The browser voice is a
        // worse voice, not a worse outcome — say which one is talking.
        if (genRef.current === gen) {
          const rung = speakInBrowser(trimmed)
          if (rung === 'spoken') {
            played = true
            setError(`${res.error} Using this device's voice instead.`)
            return
          }
          setError(
            rung === 'no-sinhala-voice'
              ? `${res.error} This device has no Sinhala voice, so the reading stopped rather than skip the Sinhala parts.`
              : res.error,
          )
          return
        }
        setError(res.error)
      } catch {
        // Covers a rejected play() too (autoplay policy, decode failure) —
        // the element and its object URL must go either way.
        cleanupAudio()
        if (genRef.current !== gen) return
        const rung = speakInBrowser(trimmed)
        if (rung === 'spoken') {
          played = true
          setError("Could not reach the speech service — using this device's voice.")
          return
        }
        setError(
          rung === 'no-sinhala-voice'
            ? 'Could not reach the speech service, and this device has no Sinhala voice to fall back to.'
            : 'Could not read that aloud',
        )
      } finally {
        setLoading(false)
        if (!played) {
          setSpeaking(false)
          setEngine(null)
        }
      }
    },
    [cleanupAudio, meterApi, speakInBrowser, stop],
  )

  return { speaking, loading, engine, error, speak, stop }
}
