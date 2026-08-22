// The registry of user-facing AI features: what appears in Settings → AI
// features and the admin adoption panel, which per-call ledger slugs roll
// up into each row, and the static per-use estimate shown before any
// history exists. Wave features register here as they ship — Settings, the
// pref guard, and adoption reporting pick them up with no further wiring.

import { estimateCostUsd } from '@/features/gemini/pricing'

export type AiCallSlug =
  | 'meeting.segment'
  | 'meeting.synthesis'
  | 'meeting.followups'
  | 'meeting.assistant'
  | 'worklog.draft'
  | 'worklog.entries-draft'
  | 'worklog.entries-check'
  | 'sprint.draft'
  | 'app.metadata'
  | 'speech.dictation'
  | 'speech.tts'
  | 'live.session'
  | 'workspace.ask'
  | 'workspace.briefing'
  | 'person.summary'
  | 'audit.filter'

/**
 * Which endpoint family a feature calls, and therefore which MODEL_CHOICES
 * list its per-feature model picker offers. `text` covers every
 * generateContent call, dictation included — it sends an audio part but any
 * multimodal text model can serve it. `tts` and `live` are genuinely
 * different endpoints and cannot substitute for one another.
 */
export type FeatureKind = 'text' | 'tts' | 'live'

/**
 * The static per-use estimate a feature's Settings row shows before any real
 * history exists.
 *
 * `tokens` is the representative shape of ONE use of the whole feature, and
 * `tokens.model` is the model that shape is priced on by default.
 *
 * `chosenModelApplies` exists because a feature can span several Gemini calls
 * while the user's model choice governs only SOME of them. It names the slice
 * of `tokens` the choice actually reprices; the remainder (`tokens` minus this
 * sub-shape) stays priced on `tokens.model`. Omit it — as every single-call
 * feature does — and the choice reprices the whole shape.
 *
 * It must never exceed `tokens` in either direction; ai-features.test.ts
 * enforces that.
 */
export type AiFeatureEstimate = {
  label: string // e.g. "per meeting hour", "per draft"
  tokens: { model: string; inputTokens: number; outputTokens: number }
  chosenModelApplies?: { inputTokens: number; outputTokens: number }
}

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
  estimate: AiFeatureEstimate
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
      // ~12 five-minute audio segments (SEGMENT_TARGET_MS, ~108k in / ~8k out
      // between them) plus ONE synthesis pass over their concatenated
      // transcripts and the captured screens (~12k in / ~4k out). Priced on
      // the flash default since the segment calls dominate the volume.
      //
      // THE SPLIT IS LOAD-BEARING. A user's chosen model governs
      // meeting.synthesis ONLY — meeting.segment and meeting.followups always
      // run the default flash chain (see both synthesis call sites in
      // meetings/ai-actions.ts and DEFAULT_CHAIN in model-choice.ts). So
      // `chosenModelApplies` is exactly that one synthesis call, and
      // estimatePerUseCostUsd reprices only it, leaving the ~12 segment calls
      // at the flash rate. If that ruling ever changes, this sub-shape moves
      // with it — otherwise the Settings row quotes a figure its own footnote
      // ("segments aren't repriced") flatly contradicts.
      tokens: { model: 'gemini-3.6-flash', inputTokens: 120_000, outputTokens: 12_000 },
      chosenModelApplies: { inputTokens: 12_000, outputTokens: 4_000 },
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
    id: 'worklog-entries-draft',
    label: 'Hours drafting',
    description: 'Proposes where a day’s hours went, from your meetings and your own activity.',
    chain: 'Analysis',
    kind: 'text',
    slugs: ['worklog.entries-draft'],
    estimate: {
      label: 'per draft',
      // One call over a day's evidence pack: the meetings somebody sat in, that
      // day's activity rows (capped at 60) and their in-progress tasks — a few
      // dozen short lines. Output is at most twelve proposed entries
      // (MAX_PROPOSED_ENTRIES) of four small fields each.
      //
      // Larger than worklog-draft's 2k/200 because that feature drafts one
      // paragraph from activity alone; this one also carries meetings with
      // their times and projects, and the task ids it is fenced to.
      //
      // No chosenModelApplies: one call, so the choice reprices the whole
      // shape, which is correct.
      tokens: { model: 'gemini-3.6-flash', inputTokens: 4_000, outputTokens: 500 },
    },
  },
  {
    id: 'worklog-entries-check',
    label: 'Hours cross-check',
    description: 'Puts what the app noticed about a saved day into plain words.',
    chain: 'Quick',
    kind: 'text',
    slugs: ['worklog.entries-check'],
    estimate: {
      label: 'per check that finds something',
      // THE LABEL IS THE POINT. This feature does not call a model on most
      // saves at all: findDiscrepancies (entry-check.ts) is pure, and when it
      // returns nothing the action returns before a prompt exists. Silence is
      // the common case, so a "per save" figure would overstate the real cost
      // several times over; this quotes the call that actually happens.
      //
      // Tiny, and deliberately so: the prompt is a handful of already-computed
      // observations with their facts, and the reply is one short sentence
      // each. The model never sees the entries, the meetings, the activity log
      // or the schedule — it is asked only to reword, which is what keeps a
      // feature about somebody's working hours both cheap and incapable of
      // finding anything on its own.
      tokens: { model: 'gemini-3.5-flash-lite', inputTokens: 900, outputTokens: 150 },
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
  {
    id: 'workspace-ask',
    label: 'Ask the workspace',
    description: 'Answers a question about your work from tasks, follow-ups, sprints, and meetings.',
    chain: 'Analysis',
    kind: 'text',
    slugs: ['workspace.ask'],
    estimate: {
      label: 'per question',
      // The grounding pack is capped at 8,000 characters (context-pack.ts)
      // plus the question and the rules block. Output matches
      // meeting-assistant exactly: both prompts cap the answer at 90 words
      // because both are short enough to be read aloud.
      //
      // No chosenModelApplies — one call, so the choice reprices the whole
      // shape, which is correct.
      tokens: { model: 'gemini-3.6-flash', inputTokens: 8_000, outputTokens: 150 },
    },
  },
  {
    id: 'daily-briefing',
    label: 'Daily briefing',
    description: 'Writes the morning read on what needs attention across the workspace.',
    chain: 'Analysis',
    kind: 'text',
    slugs: ['workspace.briefing'],
    estimate: {
      label: 'per briefing',
      // Same capped pack as the question above; the output is larger because a
      // briefing is a headline, a short paragraph and up to three priorities
      // rather than one spoken sentence.
      tokens: { model: 'gemini-3.6-flash', inputTokens: 8_000, outputTokens: 400 },
    },
  },
  {
    id: 'person-summary',
    label: 'Person summary',
    description: 'Writes the short read on a person’s recent work from their page’s own numbers.',
    chain: 'Analysis',
    kind: 'text',
    slugs: ['person.summary'],
    estimate: {
      label: 'per summary',
      // The prompt is the same compact fact sheet the stat strip renders —
      // counts and names, never raw rows — so input stays small; the output
      // is two to three sentences.
      tokens: { model: 'gemini-3.6-flash', inputTokens: 1_500, outputTokens: 150 },
    },
  },
  {
    id: 'audit-filter',
    label: 'Audit filtering in words',
    description: 'Turns a question about the audit log into the page’s own filters.',
    chain: 'Quick',
    kind: 'text',
    slugs: ['audit.filter'],
    estimate: {
      label: 'per question',
      // The smallest call in the registry, and deliberately so: the prompt is
      // the two closed vocabularies plus one sentence, and the reply is a
      // handful of filter values. It reads NO audit rows — the model never
      // sees the log, only the question — which is what keeps a feature over
      // the record of who did what cheap and, more importantly, incapable of
      // leaking it into a prompt.
      tokens: { model: 'gemini-3.6-flash', inputTokens: 700, outputTokens: 80 },
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
 * The per-use dollar estimate for one feature under the model this user
 * chose — THE one place that turns a registry estimate into a figure shown
 * to a person.
 *
 * The token shape never moves: it is what a representative use of this
 * feature costs in tokens, and a model choice does not change how much audio
 * an hour of meeting contains. Only the RATE applied to it moves, and only
 * over the calls the choice actually governs:
 *
 *   - no `chosenModelApplies` -> the whole shape reprices (single-call
 *     features: every call is the chosen model's).
 *   - with `chosenModelApplies` -> that sub-shape prices on the chosen
 *     model, the remainder stays on `tokens.model`, because those calls
 *     genuinely still run the default chain.
 *
 * Any unpriced model on either side returns null ("price unknown"), never a
 * partial sum — half a price is more misleading than no price.
 */
export function estimatePerUseCostUsd(
  estimate: AiFeatureEstimate,
  chosenModel: string | null,
  at: Date,
): number | null {
  const { tokens, chosenModelApplies } = estimate
  if (chosenModel === null) return estimateCostUsd({ ...tokens, at })
  if (!chosenModelApplies) return estimateCostUsd({ ...tokens, model: chosenModel, at })

  const remainder = estimateCostUsd({
    model: tokens.model,
    inputTokens: tokens.inputTokens - chosenModelApplies.inputTokens,
    outputTokens: tokens.outputTokens - chosenModelApplies.outputTokens,
    at,
  })
  const chosen = estimateCostUsd({
    model: chosenModel,
    inputTokens: chosenModelApplies.inputTokens,
    outputTokens: chosenModelApplies.outputTokens,
    at,
  })
  if (remainder === null || chosen === null) return null
  return remainder + chosen
}

/**
 * One selectable model for a feature's `kind`. `stability` tells the user
 * what kind of promise the id carries: `stable` GA models, `preview` models
 * Google can retire on ~two weeks' notice, and `alias` ids like
 * gemini-flash-latest that hot-swap underneath you without warning at all.
 * `freeTier: false` means a free key gets 401/403 on every call to that
 * model, forever. The CALL still succeeds — client.ts treats auth failures as
 * "advance to the next model on this key", so it lands on the default model —
 * but the choice is silently ignored and one request per call is spent
 * discovering that. Nothing downstream can report it (the user just sees a
 * normal result), so the picker warns at the point of choice.
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
 *
 * Also absent from `text`, on purpose: gemini-omni-flash and
 * gemini-3-flash-preview. resolveChain (model-choice.ts) prepends a user's
 * pinned model in front of the default chain so a model that later
 * disappears (404) quietly falls through — but that guarantee does NOT
 * cover HTTP 400, which client.ts classifies as `kind: 'bad'` and aborts
 * the whole call with no fallback. Both ids are undocumented enough that no
 * published price could be found for either (pricing.ts), and three `text`
 * features (app.metadata, sprint.draft, meeting.synthesis) send
 * responseMimeType: 'application/json' — if either model rejects JSON mode,
 * it does so with a 400, not a 404, turning that feature into a permanent
 * raw error for anyone who pinned it. A model we can neither price nor
 * guarantee a fallback for isn't a choice worth offering. This is unlike
 * the three other deliberately-unpriced models kept below
 * (gemini-3.1-flash-lite, gemini-2.5-pro-preview-tts,
 * gemini-3.5-live-translate-preview): those are documented models whose
 * failure modes are known — only the price is missing.
 */
export const MODEL_CHOICES: Record<FeatureKind, readonly ModelChoice[]> = {
  text: [
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', stability: 'stable', freeTier: true },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', stability: 'stable', freeTier: true },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', stability: 'stable', freeTier: true },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', stability: 'stable', freeTier: true },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', stability: 'stable', freeTier: true },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', stability: 'preview', freeTier: true },
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
