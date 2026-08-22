import type { FeatureKind, ModelChoice } from '@/features/gemini/ai-features'

/**
 * Turning Google's own model list into the catalog LogPup's pickers offer.
 *
 * WHY THIS EXISTS. The catalog used to be a hand-written array. Every time
 * Google shipped a model somebody had to edit a file, and every time Google
 * retired one somebody had to remember to delete it — and forgetting meant
 * offering a choice that fails permanently and undiagnosably for whoever
 * picked it. Both halves of that were a person's job, and a person's job is
 * the half that does not happen.
 *
 * `GET /v1beta/models` answers both at once. A model that exists is in the
 * response; a model that has been shut down is NOT, which is a far better
 * guarantee than any blocklist — the list cannot go stale in the direction
 * that hurts.
 *
 * PURE by construction: no fetch, no `db`, no `new Date()`. The raw list
 * arrives as an argument (model-discovery.ts does the fetching), so every
 * classification rule below is testable against a fixture.
 *
 * WHAT DISCOVERY CANNOT ANSWER, and is therefore not guessed:
 *
 *  - PRICE. The API returns no rates. `pricing.ts` stays hand-maintained and
 *    `priceForModel` already returns null for anything it does not know,
 *    which the UI shows as "price unknown". A discovered model with no
 *    published rate is offered honestly rather than priced by invention.
 *  - FREE-TIER ELIGIBILITY. Nothing in the response says whether a free key
 *    may call a model. Assumed available, with a small list of known
 *    paid-only ids below — the cost of a wrong `true` is one request that
 *    falls through to the next model in the chain, and the cost of a wrong
 *    `false` is a usable model hidden forever.
 */

/** One entry as `GET /v1beta/models` returns it, narrowed to what is used. */
export type RawGeminiModel = {
  /** `models/gemini-3.7-flash`. */
  name?: unknown
  displayName?: unknown
  description?: unknown
  supportedGenerationMethods?: unknown
}

/**
 * Models a free key gets 401/403 on, forever.
 *
 * Not discoverable, so hand-kept — but kept SMALL, and as a denial list
 * rather than an allow list, so a new model is offered by default instead of
 * being invisible until somebody notices. A wrong entry here hides a working
 * model; a missing entry costs one request that falls through to the next
 * model in the chain. The cheap mistake is the one left possible.
 */
export const PAID_TIER_ONLY: readonly string[] = ['gemini-2.5-pro-preview-tts']

/** `models/gemini-3.7-flash` → `gemini-3.7-flash`. Anything else → ''. */
export function modelIdFrom(name: unknown): string {
  if (typeof name !== 'string') return ''
  const trimmed = name.trim()
  return trimmed.startsWith('models/') ? trimmed.slice('models/'.length) : trimmed
}

/**
 * Which picker a model belongs in, or null for one no LogPup feature calls.
 *
 * Decided on CAPABILITY (`supportedGenerationMethods`) with the id as a
 * tie-break, never on a list of known names — that is the whole point. The
 * full catalog also carries image, video, music, embedding, robotics and
 * computer-use models, and none of them belong in a picker whose choices get
 * passed to generateContent.
 */
export function classifyModel(raw: RawGeminiModel): FeatureKind | null {
  const id = modelIdFrom(raw.name)
  // Gemma, Imagen, Veo, Lyria, embeddings and the robotics line are all real
  // models on the same endpoint, and none of them answer a LogPup call.
  if (!id.startsWith('gemini-')) return null

  const methods = Array.isArray(raw.supportedGenerationMethods)
    ? raw.supportedGenerationMethods.filter((method): method is string => typeof method === 'string')
    : []

  // Text-to-speech is named rather than advertised in the method list — both
  // TTS models answer generateContent like any other.
  if (id.includes('-tts')) return 'tts'

  // The live picker wants the bidirectional-streaming models. `bidi` is the
  // authoritative signal; the name check catches a model whose method list
  // arrives empty, which the API does occasionally do for a new preview.
  if (
    methods.includes('bidiGenerateContent')
    || id.includes('-live')
    || id.includes('native-audio')
  ) {
    return 'live'
  }

  if (!methods.includes('generateContent')) return null

  // Image and video generation answer generateContent too, and would happily
  // be picked for a meeting write-up that then comes back with no text at all.
  if (id.includes('image') || id.includes('video') || id.includes('embedding')) return null

  return 'text'
}

/**
 * `stable`, `preview` or `alias`, read off the id.
 *
 * The API does not state this either, but the id is a reliable proxy and it
 * is the convention Google documents: `-latest` hot-swaps underneath you,
 * `-preview`/`-exp` can be retired on short notice, everything else is a
 * pinned version. The picker uses this only to warn, so a misread costs a
 * wrong caption rather than a broken call.
 */
export function stabilityOf(id: string): ModelChoice['stability'] {
  if (id.endsWith('-latest')) return 'alias'
  if (id.includes('-preview') || id.includes('-exp')) return 'preview'
  return 'stable'
}

/**
 * What to call it on screen.
 *
 * Google's own `displayName` first — it is the name in their documentation
 * and the one somebody will have read. Falling back to the id title-cased,
 * because a picker row reading `Gemini 4 Flash` is still better than one
 * reading nothing at all.
 */
export function labelFor(raw: RawGeminiModel, id: string): string {
  if (typeof raw.displayName === 'string' && raw.displayName.trim() !== '') {
    return raw.displayName.trim()
  }
  return id
    .split('-')
    .map((part) => (part === 'gemini' ? 'Gemini' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ')
}

/**
 * The version a model id carries, for ordering: `gemini-3.7-flash` → 3.7.
 *
 * Returns -1 for an id with no version at all (the `-latest` aliases), which
 * sorts them last — an alias is a useful safety net and a poor deliberate
 * choice, so it belongs at the bottom of a list somebody is picking from.
 */
export function versionOf(id: string): number {
  const match = /gemini-(\d+(?:\.\d+)?)/.exec(id)
  if (!match) return -1
  const value = Number(match[1])
  return Number.isFinite(value) ? value : -1
}

/**
 * Newest first, and stable before preview at the same version.
 *
 * Deliberately NOT alphabetical: `gemini-2.5` sorts above `gemini-3.7` as
 * text, which would put the oldest model at the top of every picker.
 */
export function compareModels(a: ModelChoice, b: ModelChoice): number {
  const byVersion = versionOf(b.id) - versionOf(a.id)
  if (byVersion !== 0) return byVersion
  const rank = (choice: ModelChoice) =>
    choice.stability === 'stable' ? 0 : choice.stability === 'preview' ? 1 : 2
  const byStability = rank(a) - rank(b)
  if (byStability !== 0) return byStability
  return a.id.localeCompare(b.id)
}

/**
 * The whole catalog, bucketed by picker.
 *
 * Duplicate ids are collapsed — the API paginates, and a caller stitching
 * pages together can hand the same model in twice. First wins, so a page
 * boundary cannot change what a model is called.
 */
export function buildModelCatalog(
  rawModels: readonly RawGeminiModel[],
): Record<FeatureKind, ModelChoice[]> {
  const catalog: Record<FeatureKind, ModelChoice[]> = { text: [], tts: [], live: [] }
  const seen = new Set<string>()

  for (const raw of rawModels) {
    const kind = classifyModel(raw)
    if (kind === null) continue
    const id = modelIdFrom(raw.name)
    if (seen.has(id)) continue
    seen.add(id)
    catalog[kind].push({
      id,
      label: labelFor(raw, id),
      stability: stabilityOf(id),
      freeTier: !PAID_TIER_ONLY.includes(id),
    })
  }

  for (const kind of ['text', 'tts', 'live'] as const) catalog[kind].sort(compareModels)
  return catalog
}
