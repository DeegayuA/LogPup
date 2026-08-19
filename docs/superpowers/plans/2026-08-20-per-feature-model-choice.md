# Per-Feature Model Choice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let each user pick, per AI feature, which Gemini model serves it — from a curated list that cannot contain a model incapable of serving that feature.

**Architecture:** `user_ai_prefs` gains a nullable `model` column (NULL = use the default chain). Each registry feature declares a `kind` (`text` | `tts` | `live`), and `MODEL_CHOICES` lists only models valid for that kind. A chosen model is **prepended** to the feature's existing fallback chain, never substituted for it, so a retired model degrades instead of breaking.

**Tech Stack:** Next.js 16 App Router, Drizzle + Neon Postgres, TypeScript strict, Vitest, Tailwind v4 + shadcn/base-ui, zod.

**Spec:** `docs/superpowers/specs/2026-08-19-per-feature-model-choice-design.md`

## Global Constraints

- **Migrations:** hand-written SQL only, NEVER `drizzle-kit generate`. `IF NOT EXISTS` on every ADD. `--> statement-breakpoint` between statements, never inside a comment. Journal `when` strictly increasing. Verify with `information_schema`, never the runner's exit code. Take the next free number — 0035/0036 are the AI foundation's, 0037–0041 are other sessions'.
- **Git:** stage explicit paths only. NEVER `git add -A`, `commit -a`, `stash`, `reset --hard`. Before committing run `git diff --cached --stat` AND `git diff --cached`; this tree has several sessions working in it and one earlier commit swallowed 65 lines of another session's refactor exactly that way.
- **Prepend, never replace.** A user's chosen model is the first chain entry; the default chain always follows. This is what makes a Google deprecation degrade quietly instead of breaking a feature.
- **No fabricated prices.** A model absent from `PRICE_TABLE` shows "price unknown" — never zero, never a guess.
- **Verification:** `npx tsc --noEmit` (snapshot before, compare after — other sessions' errors are not yours) and `npx vitest run src/features/gemini src/features/transcription`. Do NOT run `npm run build`.

---

### Task 1: Migration — `user_ai_prefs.model`

**Files:** Create `drizzle/00XX_ai_pref_model.sql`; modify `drizzle/meta/_journal.json`, `src/db/schema.ts`.

**Interfaces:** Produces `userAiPrefs.model: text | null`.

- [ ] **Step 1: Pick the number.** Read `drizzle/meta/_journal.json` in this worktree AND every sibling (`../LogPup-sdd-*`, `../LogPup-mobile`). Use the next unused index and a `when` strictly greater than every existing entry. Numbers have collided across branches before.

- [ ] **Step 2: Write the SQL.**

```sql
-- Which model this user picked for this feature. NULL means "use the feature's
-- default chain" — the same absent-means-default convention `enabled` follows.
-- A chosen model is PREPENDED to that chain, never substituted for it, so a
-- model Google retires degrades to the default instead of breaking the feature.
ALTER TABLE "user_ai_prefs" ADD COLUMN IF NOT EXISTS "model" text;
```

- [ ] **Step 3: Journal entry** — `{ "idx": <n>, "version": "7", "when": <ms>, "tag": "00XX_ai_pref_model", "breakpoints": true }`.

- [ ] **Step 4: Schema** — add `model: text('model')` to `userAiPrefs` in `src/db/schema.ts`, with the comment above condensed to two lines.

- [ ] **Step 5: Apply and verify against the catalog.**

```bash
npm run db:migrate
```
Then query `information_schema.columns` for `table_name='user_ai_prefs' AND column_name='model'` and confirm one row. The runner has reported success while applying nothing in this repo.

- [ ] **Step 6: Commit** `feat: user_ai_prefs.model column for per-feature model choice`.

---

### Task 2: Registry kinds, model catalog, and prices

**Files:** `src/features/gemini/ai-features.ts`, `src/features/gemini/pricing.ts`, `src/features/gemini/ai-features.test.ts`.

**Interfaces:** Produces `FeatureKind`, `ModelChoice`, `MODEL_CHOICES`, and `kind` on every `AiFeatureDef`.

- [ ] **Step 1: Add the kind to each feature.** `text` for meeting-intel, meeting-assistant, worklog-draft, sprint-draft, app-metadata, dictation; `tts` for read-aloud; `live` for live-captions. Dictation is `text` — it calls `generateContent` with an audio part, so any multimodal text model serves it.

- [ ] **Step 2: Add the catalog.**

```ts
export type FeatureKind = 'text' | 'tts' | 'live'

/** One selectable model. `freeTier: false` means a free key gets 401/403 on
 *  every call — the UI must say so at the point of choice, because nothing
 *  downstream can explain a permanent auth failure to the user. */
export type ModelChoice = {
  id: string
  label: string
  stability: 'stable' | 'preview' | 'alias'
  freeTier: boolean
}

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
    { id: 'gemini-2.5-flash-native-audio-preview-12-2025', label: 'Gemini 2.5 Flash Live', stability: 'preview', freeTier: true },
    { id: 'gemini-3.5-live-translate-preview', label: 'Gemini 3.5 Live Translate', stability: 'preview', freeTier: true },
  ],
}
```

Shut-down models (`gemini-3.1-flash-lite-preview`, `gemini-3-pro-preview`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`) are deliberately absent. Do not add them.

- [ ] **Step 3: Price the new entries** in `pricing.ts` for every id above that lacks a `PRICE_TABLE` row. Where a published price is genuinely unknown, add NO row — `priceForModel` returning null renders "price unknown", which is the honest outcome. Never invent a figure.

- [ ] **Step 4: Extend the registry test** — every feature has a `kind`; every `kind` has a non-empty list; no id appears in two kinds; no shut-down id appears anywhere; every id either prices or is deliberately unpriced.

- [ ] **Step 5: Run tests, commit.**

---

### Task 3: `resolveChain` — TDD

**Files:** Create `src/features/gemini/model-choice.ts`, `src/features/gemini/model-choice.test.ts`.

**Interfaces:** Produces `resolveChain(featureId: AiFeatureId, chosenModel: string | null): readonly string[]`, and `defaultChainFor(featureId)`.

- [ ] **Step 1: Write the failing tests.**

```ts
import { describe, expect, it } from 'vitest'
import { resolveChain } from '@/features/gemini/model-choice'
import { QUICK_MODELS } from '@/features/gemini/models'

describe('resolveChain', () => {
  it('returns the default chain untouched when nothing is chosen', () => {
    expect(resolveChain('app-metadata', null)).toEqual([...QUICK_MODELS])
  })

  it('prepends the chosen model, keeping the default chain as fallback', () => {
    const chain = resolveChain('app-metadata', 'gemini-2.5-pro')
    expect(chain[0]).toBe('gemini-2.5-pro')
    expect(chain.slice(1)).toEqual([...QUICK_MODELS])
  })

  it('never attempts the same model twice', () => {
    const chosen = QUICK_MODELS[0]
    const chain = resolveChain('app-metadata', chosen)
    expect(chain.filter((m) => m === chosen)).toHaveLength(1)
    expect(chain[0]).toBe(chosen)
  })

  it('keeps a fallback even when the choice is already the chain head', () => {
    expect(resolveChain('app-metadata', QUICK_MODELS[0]).length).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run — expect FAIL (module not found).**

- [ ] **Step 3: Implement.** Map each `AiFeatureId` to its existing chain constant from `models.ts` (`QUICK_MODELS`, `ANALYSIS_MODELS`, `SYNTHESIS_MODELS`, `ASSISTANT_MODELS`, `TTS_MODEL_FALLBACK_ORDER`, `LIVE_MODEL_FALLBACK_ORDER`). Prepend and dedupe. Comment WHY prepending rather than replacing: a pinned model that Google retires answers 404, which the client already treats as "advance to the next model", so the user keeps working.

- [ ] **Step 4: Run — expect PASS. Commit.**

---

### Task 4: Prefs shape, action, and call sites

**Files:** `src/features/gemini/prefs.ts`, `src/features/gemini/actions.ts`, every AI action that passes a model chain, plus their tests.

**Interfaces:** Produces `getAiPrefs(userId): Record<AiFeatureId, { enabled: boolean; model: string | null }>`; `setAiFeatureModel(feature, model | null)`.

- [ ] **Step 1: Change the prefs shape** — `resolvePrefs` returns `{ enabled, model }` per feature; absent row still means `{ enabled: true, model: null }`. Update its unit tests first, watch them fail, then implement.

- [ ] **Step 2: Update EVERY caller.** `isAiFeatureEnabled` and `aiFeatureDisabledMessage` read `.enabled`; the Settings card reads both. The compiler finds these — do not suppress with a cast.

- [ ] **Step 3: Add the action.**

```ts
export async function setAiFeatureModel(
  feature: AiFeatureId,
  model: string | null,
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  const def = AI_FEATURES.find((f) => f.id === feature)
  if (!def) return err('Unknown AI feature')
  // The dropdown is not the security boundary: a model outside this feature's
  // kind cannot serve it, so reject rather than let it fail at call time.
  if (model !== null && !MODEL_CHOICES[def.kind].some((c) => c.id === model)) {
    return err('That model cannot serve this feature')
  }
  await db
    .insert(userAiPrefs)
    .values({ userId: session.user.id, feature, enabled: true, model, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [userAiPrefs.userId, userAiPrefs.feature],
      set: { model, updatedAt: new Date() },
    })
  revalidatePath('/settings')
  return ok(undefined)
}
```

Note the upsert sets `enabled` only on INSERT: a user picking a model for a feature they never toggled must not accidentally disable it, and must not silently re-enable one they turned off.

- [ ] **Step 4: Thread the resolved chain** into each AI action: read the caller's prefs, call `resolveChain(featureId, prefs[featureId].model)`, pass the result as `models`. Every action already passes a chain constant — replace the constant, change nothing else.

- [ ] **Step 5: Test the rejection path** (wrong-kind model rejected server-side), run the suite, commit.

---

### Task 5: The Select in Settings

**Files:** `src/features/gemini/components/ai-features-card.tsx`, plus a small client component for the select.

- [ ] **Step 1: Add the control** beside each row's switch. Options come from `MODEL_CHOICES[feature.kind]`, plus a first "Default (recommended)" option mapping to `null`.

- [ ] **Step 2: Each option shows** its label, its price from `priceForModel` (or "price unknown"), and its stability when not `stable`. A `freeTier: false` option is labelled "paid keys only".

- [ ] **Step 3: Warn on a paid-only choice** when the user holds no key marked `tier: 'paid'` — inline, at the point of choice, not at use time. Copy states the consequence plainly: every call will be refused until a paid key is added.

- [ ] **Step 4: Recompute the row's per-use estimate** from the chosen model, so the card never quotes one model's price beside another model's token shape.

- [ ] **Step 5: Disable the select when the feature's switch is off.** Verify the repo's Select component API first (`src/components/ui/select.tsx`) — Base UI needs an items map or a function child, or the trigger renders a raw UUID/value instead of a label.

- [ ] **Step 6: Typecheck, test, commit.**
