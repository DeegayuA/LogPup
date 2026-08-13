'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { synthesizeSpeech } from '../actions'
import { toSpokenText } from '../spoken-text'
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
  speak: (text: string) => Promise<void>
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

  const speakInBrowser = useCallback((text: string): boolean => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
    const utterance = new SpeechSynthesisUtterance(text)
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
    return true
  }, [])

  const speak = useCallback(
    async (text: string) => {
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
        const res = await synthesizeSpeech(trimmed)
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
          // Gemini returns headerless PCM; browsers only play containerised
          // audio, so it is wrapped in a WAV header here (see wav.ts).
          const pcm = base64ToBytes(res.data.audioBase64)
          const wav = pcmToWav(pcm, parsePcmRate(res.data.mimeType))
          const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
          objectUrlRef.current = url
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => {
            cleanupAudio()
            setSpeaking(false)
            setEngine(null)
          }
          audio.onerror = () => {
            cleanupAudio()
            setSpeaking(false)
            setEngine(null)
            setError('That audio could not be played')
          }
          await audio.play()
          // stop() can land while play() is in flight — without this the
          // element keeps playing behind a UI that says it stopped, and
          // `speaking` sticks on with no handler left to clear it. The stale
          // stop() already paused THIS element via the refs, so only the
          // local handles need dropping — cleanupAudio on the shared refs
          // here could kill a newer invocation's audio instead.
          if (genRef.current !== gen) {
            audio.pause()
            URL.revokeObjectURL(url)
            return
          }
          setEngine('gemini')
          setSpeaking(true)
          played = true
          return
        }
        // Gemini refused (no key, quota, model gone). The browser voice is a
        // worse voice, not a worse outcome — say which one is talking.
        if (genRef.current === gen && speakInBrowser(trimmed)) {
          played = true
          setError(`${res.error} Using this device's voice instead.`)
          return
        }
        setError(res.error)
      } catch {
        // Covers a rejected play() too (autoplay policy, decode failure) —
        // the element and its object URL must go either way.
        cleanupAudio()
        if (genRef.current !== gen) return
        if (speakInBrowser(trimmed)) {
          played = true
          setError("Could not reach the speech service — using this device's voice.")
          return
        }
        setError('Could not read that aloud')
      } finally {
        setLoading(false)
        if (!played) {
          setSpeaking(false)
          setEngine(null)
        }
      }
    },
    [cleanupAudio, speakInBrowser, stop],
  )

  return { speaking, loading, engine, error, speak, stop }
}
