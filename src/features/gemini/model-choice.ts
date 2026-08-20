// Turns a user's per-feature model choice (user_ai_prefs.model) into the
// actual fallback chain an AI action calls Gemini with. The registry
// (ai-features.ts) says WHICH models a feature's kind may offer in the
// picker; this file says WHICH CHAIN CONSTANT (models.ts) that feature's
// call sites already pass, and how a choice folds into it.

import type { AiFeatureId } from '@/features/gemini/ai-features'
import {
  ANALYSIS_MODELS,
  ASSISTANT_MODELS,
  LIVE_MODEL_FALLBACK_ORDER,
  QUICK_MODELS,
  SYNTHESIS_MODELS,
  TTS_MODEL_FALLBACK_ORDER,
} from '@/features/gemini/models'

/**
 * Per-feature default chain, taken from what each feature's AI action
 * already passes as `models` (or falls through to when it passes nothing):
 *
 * - meeting-intel     -> SYNTHESIS_MODELS   (ai-actions.ts synthesis pass)
 * - meeting-assistant -> ASSISTANT_MODELS   (assistant-actions.ts)
 * - live-captions     -> LIVE_MODEL_FALLBACK_ORDER (live-token.ts default)
 * - read-aloud        -> TTS_MODEL_FALLBACK_ORDER  (speech/actions.ts)
 * - dictation         -> ANALYSIS_MODELS    (speech/actions.ts calls
 *                         callGeminiWithAudio with no `models` override, so
 *                         it falls through to GEMINI_MODEL_FALLBACK_ORDER —
 *                         the same array ANALYSIS_MODELS names, and the
 *                         right fit: dictation IS per-segment audio
 *                         transcription, just one clip instead of a meeting)
 * - worklog-draft     -> ANALYSIS_MODELS    (draft-actions.ts: callGemini
 *                         with no `models` override, same default chain)
 * - sprint-draft      -> ANALYSIS_MODELS    (suggest-actions.ts: ditto)
 * - app-metadata      -> QUICK_MODELS       (apps/actions.ts)
 */
const DEFAULT_CHAIN: Record<AiFeatureId, readonly string[]> = {
  'meeting-intel': SYNTHESIS_MODELS,
  'meeting-assistant': ASSISTANT_MODELS,
  'live-captions': LIVE_MODEL_FALLBACK_ORDER,
  'read-aloud': TTS_MODEL_FALLBACK_ORDER,
  dictation: ANALYSIS_MODELS,
  'worklog-draft': ANALYSIS_MODELS,
  'sprint-draft': ANALYSIS_MODELS,
  'app-metadata': QUICK_MODELS,
}

/** The chain a feature calls Gemini with when the user has chosen nothing. */
export function defaultChainFor(featureId: AiFeatureId): readonly string[] {
  return DEFAULT_CHAIN[featureId]
}

/**
 * Resolve the chain an AI action should actually call Gemini with.
 *
 * `chosenModel` is PREPENDED to the feature's default chain, never
 * substituted for it. Google deprecates preview models on about two weeks'
 * notice, and `-latest` aliases hot-swap underneath you — a retired model
 * answers 404, which client.ts already treats as "advance to the next model
 * in the chain". So prepending means a user who pinned a model that later
 * disappears keeps working: their calls quietly fall through to the
 * default. Replacing the chain would turn every Google deprecation into a
 * support ticket for whoever pinned that model. Do not "simplify" this to a
 * straight replacement.
 */
export function resolveChain(featureId: AiFeatureId, chosenModel: string | null): readonly string[] {
  const defaultChain = defaultChainFor(featureId)
  if (chosenModel === null) return defaultChain
  // Dedupe: the chosen model must appear exactly once, at the front — never
  // attempted twice just because it also sits somewhere in the default chain.
  return [chosenModel, ...defaultChain.filter((model) => model !== chosenModel)]
}
