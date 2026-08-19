# Per-feature model choice

**Date:** 2026-08-19
**Status:** Approved (design), not yet planned or built. Extends `2026-08-19-ai-everywhere-design.md`, which shipped the feature registry, `user_ai_prefs`, and the Settings AI hub this builds on.
**Owner decisions locked:** curated per-feature-kind model lists (not free text, not the full catalog); each user chooses for themselves.

## Goal

Every AI feature in Settings already has an on/off switch, an estimated cost per use, and 30 days of measured usage. Add one control per row: **which model this feature uses for me.**

## Why curation rather than the full catalog

The published Gemini catalog contains image (Nano Banana, Imagen), video (Veo), music (Lyria), embedding, robotics and computer-use endpoints. None of them can serve a text draft. Several listed models are already marked **shut down**: `gemini-3.1-flash-lite-preview`, `gemini-3-pro-preview`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`. A dropdown offering those offers guaranteed failure, and the user who picks one has no way to know why their feature stopped working.

So each feature declares a **kind**, and its dropdown offers only models that can actually serve it.

## Feature kinds

| Kind | Features | Offers |
|---|---|---|
| `text` | meeting intelligence, meeting Q&A, worklog drafting, sprint drafting, app descriptions, dictation | the text list |
| `tts` | read aloud | the TTS list |
| `live` | live captions | the Live list |

Dictation is `text` despite taking audio input: it calls `generateContent` with an audio part, so any multimodal text model serves it. TTS and Live are genuinely different endpoints and cannot be substituted for one another.

**Text:** `gemini-3.7-flash`, `gemini-3.6-flash` (current default), `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-omni-flash`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro`, and the moving alias `gemini-flash-latest`.

**TTS:** `gemini-3.1-flash-tts-preview` (current default), `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts`.

**Live:** `gemini-3.1-flash-live-preview` (current default), `gemini-2.5-flash-native-audio-preview-12-2025`, `gemini-3.5-live-translate-preview`.

## What every option must show

Three facts per option, because the point is an informed tradeoff:

1. **Price** — input/output per 1M tokens from `pricing.ts`. A model with no price-table entry shows "price unknown" and stays selectable; it must never show a fabricated or zero-looking number.
2. **Free-tier availability.** `gemini-2.5-pro-preview-tts` is **paid-tier only**. A user on a free key who selects it gets 401/403 on every call, forever, with no hint why. Label it "paid keys only", and warn at the point of choice when the user holds no paid-tier key — not silently at use time.
3. **Stability class** — stable, preview, or alias. Previews are deprecated with about two weeks' notice and `-latest` aliases hot-swap underneath you. Someone pinning a preview should know they pinned something that moves.

## Resolution — a choice is a preference, never a cliff

The chosen model becomes the **first entry** of the chain; the feature's existing default chain follows unchanged as fallback.

```
resolveChain(feature, chosenModel) =
  chosenModel ? dedupe([chosenModel, ...defaultChainFor(feature)]) : defaultChainFor(feature)
```

This is the most important rule here. The client already treats a 404 as "retired preview, advance to the next model" rather than a hard failure, so a user who pins a model Google later shuts down keeps working — their calls quietly fall through to the default. A design that REPLACED the chain instead of prepending to it would turn every model deprecation into a support ticket. Deduplicate so a chosen model already in the default chain is never attempted twice.

## Storage

```sql
ALTER TABLE "user_ai_prefs" ADD COLUMN IF NOT EXISTS "model" text;
```

NULL means "use the default chain" — the same absent-means-default convention `enabled` already follows. No backfill; existing rows keep NULL and behave exactly as today.

One hand-written migration. Take the next number from every worktree's `_journal.json` at implementation time — 0035/0036 are this plan's, 0037–0039 are the RBAC session's, 0040 was released by another session but confirm before claiming it. Verify with `information_schema`, never the runner's exit code.

## Surfaces

- `src/features/gemini/ai-features.ts` — each feature gains `kind: 'text' | 'tts' | 'live'`. New export `MODEL_CHOICES: Record<FeatureKind, ModelChoice[]>` where `ModelChoice = { id, label, stability: 'stable' | 'preview' | 'alias', freeTier: boolean }`. Pure data.
- `src/features/gemini/model-choice.ts` (new) — `resolveChain(featureId, chosenModel)`, pure and unit-tested.
- `src/features/gemini/prefs.ts` — `getAiPrefs` returns `{ enabled, model }` per feature instead of a bare boolean. **This is a breaking shape change**; every caller must be updated in the same commit.
- `src/features/gemini/actions.ts` — `setAiFeatureModel(feature, model | null)`, validating the model belongs to that feature's kind list. An id outside the list is rejected server-side; the dropdown is not the security boundary.
- Each AI action passes its resolved chain to the client call instead of the hard-coded chain constant.
- `ai-features-card.tsx` — a Select per row beside the existing switch, showing price, free-tier note and stability. Disabled when the feature's switch is off.

## Interaction with the cost display

The per-use estimate already shown on each row must recompute from the chosen model, or the card will quote one model's price beside another model's usage. This is the main reason the estimate lives in the registry as `{ model, inputTokens, outputTokens }` rather than as a hardcoded figure — swap the model, keep the token shape.

## Testing

- `model-choice.test.ts`: chosen model is prepended; the default chain still follows; no duplicate when the choice is already the default; NULL yields the default chain untouched.
- Registry test extension: every id in every `MODEL_CHOICES` list is priced or explicitly price-unknown; no shut-down model appears in any list; every feature's `kind` has a non-empty list.
- Action test: a model id from the wrong kind is rejected server-side.

## Explicitly out of scope

- Per-call or per-meeting model choice. This is per-user, per-feature.
- Admin org-wide defaults or locking. Declined: users spend their own quota under BYOK, so they choose their own tradeoff.
- Image, video, music, embedding, robotics and computer-use models. LogPup has no feature they serve; adding one is a new feature, not a dropdown entry.
- Auto-downgrading to a cheaper model as a key nears its quota. Attractive, but Google publishes no remaining-quota signal, so it cannot be done honestly.
