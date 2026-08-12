'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import {
  GeminiError,
  callGeminiSpeech,
  callGeminiWithAudio,
} from '@/features/gemini/client'
import { TTS_MODEL_FALLBACK_ORDER, TTS_VOICE } from '@/features/gemini/models'
import { truncateForSpeech } from '@/features/speech/spoken-text'

/**
 * Voice in / voice out for the UI, meeting-agnostic: dictation (short mic
 * clip → text, for typing by voice anywhere) and synthesis (text → spoken
 * audio, the "AI talks back" half). Both run on the CALLER's own Gemini
 * keys — auth() is the only gate, because the only quota a caller can spend
 * here is their own.
 */

// A dictation is one spoken note, not a meeting recording — 60s of 32kbps
// Opus is ~240KB, so 2MB is generous headroom, and far under the 8MB server
// action body limit (next.config.ts).
const MAX_DICTATION_BYTES = 2 * 1024 * 1024

// Over-long text is TRUNCATED at a sentence boundary (truncateForSpeech,
// spoken-text.ts) and reported as truncated — never refused. The main caller
// is "read this meeting summary aloud", and a real summary runs well past any
// tight ceiling; rejecting those made the marquee use of the feature fail
// over to the device voice every time, which is the silent degradation this
// codebase treats as a bug.

const DICTATION_PROMPT = `Transcribe this short spoken note from a Sri Lankan software team member.
Speakers routinely CODE-SWITCH between Sinhala and English — often mid-sentence — and that is normal,
not an error. Transcribe each phrase in whichever language it was ACTUALLY spoken in: Sinhala words in
Sinhala script (සිංහල), English words in Latin script, on the same line. Technical/product terms said
in English (e.g. "sprint", "deploy", "bug", "PR", app or feature names) stay in English/Latin script.
Return ONLY the transcribed text — no labels, no quotes, no commentary. If the audio contains no
discernible speech, return an empty string.`

export type DictationResult = { text: string }

/**
 * Short-clip speech-to-text for voice typing. The client records a few
 * seconds of mic audio and gets back plain code-switched text to insert
 * into whatever field it was dictating for.
 */
export async function transcribeDictation(formData: FormData): Promise<ActionResult<DictationResult>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const audio = formData.get('audio')
  if (!(audio instanceof File) || audio.size === 0) return err('No audio received')
  if (audio.size > MAX_DICTATION_BYTES) {
    return err('That dictation came out too large — keep voice notes under a minute')
  }

  try {
    const { text } = await callGeminiWithAudio(
      session.user.id,
      [{ text: DICTATION_PROMPT }],
      Buffer.from(await audio.arrayBuffer()),
      audio.type || 'audio/webm',
    )
    return ok({ text: text.trim() })
  } catch (error) {
    if (error instanceof GeminiError) return err(error.message)
    return err('Could not transcribe that — try again')
  }
}

const speakInput = z.object({
  // No max here: over-long text is truncated below, not refused.
  text: z.string().trim().min(1),
})

export type SpokenAudio = {
  /** base64 raw PCM — see speech/wav.ts for turning it into a playable WAV. */
  audioBase64: string
  mimeType: string
  model: string
  /** True when only the first MAX_TTS_CHARS were spoken — the UI must say so. */
  truncated: boolean
}

/**
 * Text → spoken audio on the Gemini TTS model chain (models.ts). The client
 * is responsible for playback (and for its own browser speechSynthesis
 * fallback when this fails — that fallback lives client-side because the
 * server has no speakers).
 */
export async function synthesizeSpeech(text: string): Promise<ActionResult<SpokenAudio>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const parsed = speakInput.safeParse({ text })
  if (!parsed.success) return err('Nothing to read aloud')

  const spokenText = truncateForSpeech(parsed.data.text)
  const truncated = spokenText.length < parsed.data.text.length

  try {
    const spoken = await callGeminiSpeech(session.user.id, spokenText, {
      models: TTS_MODEL_FALLBACK_ORDER,
      voiceName: TTS_VOICE,
    })
    return ok({ ...spoken, truncated })
  } catch (error) {
    if (error instanceof GeminiError) return err(error.message)
    return err('Could not generate speech — try again')
  }
}
