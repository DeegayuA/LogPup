// The model routing table: which Gemini model (chain) each kind of work in
// LogPup uses, in fallback order. One place to look, one place to bump.
//
// Every chain is ordered best-first; the caller walks it left to right when a
// model is overloaded/retired (see callGemini/callGeminiCore in client.ts and
// mintLiveToken in ../transcription/live-token.ts). Keys stay per-user
// (BYOK, free tier) whatever the chain says — chains change WHICH model is
// asked, never WHOSE quota pays for it.
//
// Server-only concern by convention: nothing here reads NEXT_PUBLIC_* vars.
// The one browser-facing model choice (the Live transcription model, which
// must be overridable per-build) lives in ../transcription/live-protocol.ts
// where Next's literal-substitution rule for NEXT_PUBLIC_* can be respected;
// its chain is re-exported here so this file still names every scenario.

import {
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  GEMINI_MODEL_FALLBACK_ORDER,
} from '@/features/gemini/client'
import { LIVE_MODEL_FALLBACK_ORDER } from '@/features/transcription/live-protocol'

export { DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL, LIVE_MODEL_FALLBACK_ORDER }

/**
 * Understanding work — meeting analysis, per-segment audio transcription,
 * follow-up resolution, app descriptions. The default chain callGemini
 * already walks; named here so call sites can say what they mean.
 */
export const ANALYSIS_MODELS: readonly string[] = GEMINI_MODEL_FALLBACK_ORDER

/**
 * Short interactive answers (the meeting voice assistant): same models as
 * analysis today — flash-tier is both the fastest and the cheapest thing on
 * a free key — kept as its own name so the assistant can diverge (e.g. to a
 * lite model) without touching analysis.
 */
export const ASSISTANT_MODELS: readonly string[] = GEMINI_MODEL_FALLBACK_ORDER

/**
 * Text-to-speech ("AI talks back"). Both models answer generateContent with
 * responseModalities:['AUDIO'] and emit 24kHz mono 16-bit PCM. The 3.1 TTS
 * preview is the current best voice; the 2.5 preview is the fallback for
 * keys/projects where the newer preview is not yet (or no longer) available.
 */
export const TTS_MODEL_FALLBACK_ORDER: readonly string[] = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
]

/**
 * Voice used for spoken output. One fixed prebuilt voice — a stable "LogPup
 * voice" beats a per-call roulette; change it here, everywhere follows.
 */
export const TTS_VOICE = 'Kore'
