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
 * Understanding work — per-segment audio transcription, follow-up
 * resolution. The default chain callGemini already walks; named here so
 * call sites can say what they mean.
 */
export const ANALYSIS_MODELS: readonly string[] = GEMINI_MODEL_FALLBACK_ORDER

/**
 * The one pass over a whole meeting: reconciling speaker labels across every
 * segment, reading the captured screens, and writing minutes somebody will
 * act on.
 *
 * It gets the Pro model where the rest of the pipeline gets Flash, because
 * this is the only call whose output a person actually reads — and it runs
 * ONCE per meeting against N per-segment transcription calls, so the
 * expensive tier costs a rounding error of a free key's request budget.
 * Flash follows as the fallback: a slower write-up beats none, and Pro is a
 * preview model that can disappear on short notice.
 */
export const SYNTHESIS_MODELS: readonly string[] = [
  'gemini-3.1-pro-preview',
  ...GEMINI_MODEL_FALLBACK_ORDER,
]

/**
 * Short mechanical text work with an obvious right answer — a repo README
 * turned into a one-line app description, a meeting title from its agenda.
 * Flash-Lite first: these are the highest-frequency, lowest-stakes calls in
 * the product, and spending the flagship model on them is what leaves a free
 * key with nothing left for the meeting write-up that matters.
 */
export const QUICK_MODELS: readonly string[] = [
  'gemini-3.5-flash-lite',
  ...GEMINI_MODEL_FALLBACK_ORDER,
]

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
