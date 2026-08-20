// The registry of user-facing AI features: what appears in Settings → AI
// features and the admin adoption panel, which per-call ledger slugs roll
// up into each row, and the static per-use estimate shown before any
// history exists. Wave features register here as they ship — Settings, the
// pref guard, and adoption reporting pick them up with no further wiring.

export type AiCallSlug =
  | 'meeting.segment'
  | 'meeting.synthesis'
  | 'meeting.followups'
  | 'meeting.assistant'
  | 'worklog.draft'
  | 'sprint.draft'
  | 'app.metadata'
  | 'speech.dictation'
  | 'speech.tts'
  | 'live.session'

/**
 * Which endpoint family a feature calls, and therefore which MODEL_CHOICES
 * list its per-feature model picker offers. `text` covers every
 * generateContent call, dictation included — it sends an audio part but any
 * multimodal text model can serve it. `tts` and `live` are genuinely
 * different endpoints and cannot substitute for one another.
 */
export type FeatureKind = 'text' | 'tts' | 'live'

/**
 * What a registry entry must look like. Only ever used to CHECK the entries
 * below (`satisfies`), never to annotate them: annotating the array would
 * widen every id back to `string` and make the derived AiFeatureId circular
 * (TS2456/TS2502). The ids are read off the data instead — see below.
 */
type AiFeatureShape = {
  id: string
  label: string
  description: string
  chain: 'Quick' | 'Analysis' | 'Synthesis' | 'Voice' | 'Live'
  kind: FeatureKind
  slugs: readonly AiCallSlug[]
  estimate: {
    label: string // e.g. "per meeting hour", "per draft"
    tokens: { model: string; inputTokens: number; outputTokens: number }
  }
}

export const AI_FEATURES = [
  {
    id: 'meeting-intel',
    label: 'Meeting intelligence',
    description: 'Transcribes recordings and writes the summary, action items, and follow-ups.',
    chain: 'Synthesis',
    kind: 'text',
    slugs: ['meeting.segment', 'meeting.synthesis', 'meeting.followups'],
    estimate: {
      label: 'per meeting hour',
      // ~12 audio segments plus one synthesis pass; priced on the flash
      // default since the segment calls dominate the volume.
      tokens: { model: 'gemini-3.6-flash', inputTokens: 120_000, outputTokens: 12_000 },
    },
  },
  {
    id: 'meeting-assistant',
    label: 'Meeting Q&A assistant',
    description: 'Answers questions about one meeting from its own transcript and notes.',
    chain: 'Analysis',
    kind: 'text',
    slugs: ['meeting.assistant'],
    estimate: {
      label: 'per question',
      tokens: { model: 'gemini-3.6-flash', inputTokens: 20_000, outputTokens: 150 },
    },
  },
  {
    id: 'live-captions',
    label: 'Live captions',
    description: 'Streams live transcription while a meeting records.',
    chain: 'Live',
    kind: 'live',
    slugs: ['live.session'],
    estimate: {
      label: 'per meeting hour',
      // 25 audio tokens/sec (session-budget.ts) — the same estimate the
      // ledger logs for live sessions; there is no measured figure.
      tokens: { model: 'gemini-3.1-flash-live-preview', inputTokens: 90_000, outputTokens: 4_000 },
    },
  },
  {
    id: 'read-aloud',
    label: 'Read aloud',
    description: 'Speaks summaries and answers out loud.',
    chain: 'Voice',
    kind: 'tts',
    slugs: ['speech.tts'],
    estimate: {
      label: 'per read-aloud',
      tokens: { model: 'gemini-3.1-flash-tts-preview', inputTokens: 1_000, outputTokens: 4_000 },
    },
  },
  {
    id: 'dictation',
    label: 'Dictation',
    description: 'Turns a short voice note into text, Sinhala and English alike.',
    chain: 'Voice',
    kind: 'text',
    slugs: ['speech.dictation'],
    estimate: {
      label: 'per dictation',
      tokens: { model: 'gemini-3.6-flash', inputTokens: 1_500, outputTokens: 100 },
    },
  },
  {
    id: 'worklog-draft',
    label: 'Worklog drafting',
    description: 'Drafts your daily note from your own activity.',
    chain: 'Analysis',
    kind: 'text',
    slugs: ['worklog.draft'],
    estimate: {
      label: 'per draft',
      tokens: { model: 'gemini-3.6-flash', inputTokens: 2_000, outputTokens: 200 },
    },
  },
  {
    id: 'sprint-draft',
    label: 'Sprint drafting',
    description: 'Suggests a sprint name and goal from open tasks and recent meetings.',
    chain: 'Analysis',
    kind: 'text',
    slugs: ['sprint.draft'],
    estimate: {
      label: 'per draft',
      tokens: { model: 'gemini-3.6-flash', inputTokens: 3_000, outputTokens: 150 },
    },
  },
  {
    id: 'app-metadata',
    label: 'App descriptions',
    description: 'Drafts an app name, description, and tags from its GitHub README.',
    chain: 'Quick',
    kind: 'text',
    slugs: ['app.metadata'],
    estimate: {
      label: 'per generation',
      tokens: { model: 'gemini-3.5-flash-lite', inputTokens: 3_000, outputTokens: 200 },
    },
  },
] as const satisfies readonly AiFeatureShape[]

/**
 * DERIVED, never hand-written. A parallel union would drift the moment a
 * feature is added or renamed, and the drift is silent where it hurts most:
 * resolvePrefs would hand back `undefined` for the orphan id and the pref
 * guard would read that as "off", refusing an ENABLED feature.
 */
export type AiFeatureId = (typeof AI_FEATURES)[number]['id']
export type AiFeatureDef = (typeof AI_FEATURES)[number]

/**
 * One selectable model for a feature's `kind`. `stability` tells the user
 * what kind of promise the id carries: `stable` GA models, `preview` models
 * Google can retire on ~two weeks' notice, and `alias` ids like
 * gemini-flash-latest that hot-swap underneath you without warning at all.
 * `freeTier: false` means a free key gets 401/403 on every call, forever —
 * that has no downstream fix, so the picker must warn at the point of choice.
 */
export type ModelChoice = {
  id: string
  label: string
  stability: 'stable' | 'preview' | 'alias'
  freeTier: boolean
}

/**
 * The curated, per-kind model catalog offered by each feature's model
 * picker — never the full Gemini catalog (which also lists image, video,
 * music, embedding, robotics and computer-use models no LogPup feature
 * calls). Shut-down models (gemini-3.1-flash-lite-preview,
 * gemini-3-pro-preview, gemini-2.0-flash, gemini-2.0-flash-lite) are
 * deliberately absent: offering one would offer a guaranteed, undiagnosable
 * permanent failure. Do not add them back.
 */
export const MODEL_CHOICES: Record<FeatureKind, readonly ModelChoice[]> = {
  text: [
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', stability: 'stable', freeTier: true },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', stability: 'stable', freeTier: true },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', stability: 'stable', freeTier: true },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', stability: 'stable', freeTier: true },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', stability: 'stable', freeTier: true },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', stability: 'preview', freeTier: true },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', stability: 'preview', freeTier: true },
    { id: 'gemini-omni-flash', label: 'Gemini Omni Flash', stability: 'preview', freeTier: true },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', stability: 'stable', freeTier: true },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', stability: 'stable', freeTier: true },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', stability: 'stable', freeTier: true },
    { id: 'gemini-flash-latest', label: 'Gemini Flash (latest)', stability: 'alias', freeTier: true },
  ],
  tts: [
    { id: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS', stability: 'preview', freeTier: true },
    { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS', stability: 'preview', freeTier: true },
    // Paid tier only. A free key gets 401/403 forever with no explanation.
    { id: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS', stability: 'preview', freeTier: false },
  ],
  live: [
    { id: 'gemini-3.1-flash-live-preview', label: 'Gemini 3.1 Flash Live', stability: 'preview', freeTier: true },
    {
      id: 'gemini-2.5-flash-native-audio-preview-12-2025',
      label: 'Gemini 2.5 Flash Live',
      stability: 'preview',
      freeTier: true,
    },
    { id: 'gemini-3.5-live-translate-preview', label: 'Gemini 3.5 Live Translate', stability: 'preview', freeTier: true },
  ],
}

/**
 * The same guard from the slug side: every AiCallSlug must be claimed by some
 * feature. An unclaimed slug would log usage that no Settings row, adoption
 * row, or pref switch can ever account for — featureForSlug throws on it at
 * runtime, and this makes it a build error instead.
 */
type UnmappedSlug = Exclude<AiCallSlug, (typeof AI_FEATURES)[number]['slugs'][number]>
const _allSlugsMapped: UnmappedSlug extends never ? true : never = true
void _allSlugsMapped

const BY_SLUG = new Map<AiCallSlug, AiFeatureDef>()
for (const feature of AI_FEATURES) {
  for (const slug of feature.slugs) BY_SLUG.set(slug, feature)
}

export function featureForSlug(slug: AiCallSlug): AiFeatureDef {
  const feature = BY_SLUG.get(slug)
  if (!feature) throw new Error(`No AI feature registered for slug "${slug}"`)
  return feature
}
