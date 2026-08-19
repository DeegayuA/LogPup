# AI Foundation (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI usage ledger, pricing module, key sharing + free/paid tiers, per-feature AI preferences, the Settings AI hub, and an admin feature-adoption panel that Part B's feature waves ride on.

**Architecture:** Every Gemini call gains a required `feature` slug and fire-and-forget usage logging into a new `ai_usage_events` table; key selection extends from "own keys LRU" to "own keys LRU, then org-shared keys LRU"; a pure pricing table converts logged tokens to indicative dollars at read time; per-user feature toggles live in `user_ai_prefs` (absent row = enabled) and are enforced in server actions; the same ledger answers "who uses what" for admins.

**Tech Stack:** Next.js 16 App Router (Server Actions), Drizzle + Neon Postgres, TypeScript strict, Vitest, Tailwind v4 + shadcn/base-ui, zod.

**Spec:** `docs/superpowers/specs/2026-08-19-ai-everywhere-design.md`

## Global Constraints

- **Audience:** every user is a technical software engineer. Copy states facts (rate limits, token counts, model names) plainly — no consumer hand-holding, no hiding the mechanism.
- **Migrations:** hand-written SQL only — NEVER `drizzle-kit generate`. `IF NOT EXISTS` on every CREATE/ADD. `--> statement-breakpoint` between statements, never inside a comment. Journal `when` strictly increasing (last entry: `1786600003000`). Verify with `information_schema` queries, never the runner's exit code. Never edit an applied `.sql` file.
- **Git:** stage explicit paths only (parallel session shares this tree). Never `git add -A`, `commit -a`, `stash`, `reset --hard`. Never commit `e2e/.auth/state.json`. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Honesty copy rule:** every derived dollar/token figure shown to users is prefixed `≈` and free keys always show `$0 charged`. Exact copy is given per task — use it verbatim.
- **Ledger must never break AI:** usage insert failures are swallowed (logged to console), never awaited in the response path, never surfaced to users.
- **No day-boundary math:** all usage windows are rolling intervals (`now − 30 days`), never calendar-day slicing.
- **Tests:** Vitest, pure functions only (repo convention — see `readiness.test.ts`, `overview.test.ts`). Single file: `npx vitest run src/path/file.test.ts`. Full suite: `npx vitest run`. Build: `npm run build`.
- **UI conventions:** Card + lucide icon titles; dashed rounded border + muted text for empty states; `font-mono`/`tabular-nums` for data values; badge word carries meaning (WCAG 1.4.1 — never color alone); consequential actions behind AlertDialog; sonner toasts; English copy.

---

### Task 1: Migration 0035 — `ai_usage_events` table + Drizzle schema

**Files:**
- Create: `drizzle/0035_ai_usage_events.sql`
- Modify: `drizzle/meta/_journal.json` (append entry)
- Modify: `src/db/schema.ts` (add table after `geminiKeys`, ~line 467)

**Interfaces:**
- Produces: `aiUsageEvents` Drizzle table export with columns `id, userId, keyId, keyOwnerId, keyLast4, feature, model, inputTokens, outputTokens, status, createdAt`.

- [ ] **Step 1: Write the migration SQL**

Create `drizzle/0035_ai_usage_events.sql`:

```sql
CREATE TABLE IF NOT EXISTS "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"key_id" uuid REFERENCES "gemini_keys"("id") ON DELETE SET NULL,
	"key_owner_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"key_last4" text,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL DEFAULT 0,
	"output_tokens" integer NOT NULL DEFAULT 0,
	"status" text NOT NULL DEFAULT 'ok',
	"created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_user_created_idx" ON "ai_usage_events" ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_key_owner_created_idx" ON "ai_usage_events" ("key_owner_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_feature_created_idx" ON "ai_usage_events" ("feature","created_at");
```

- [ ] **Step 2: Append the journal entry**

In `drizzle/meta/_journal.json`, append after the `0034_app_role_history` entry (keep valid JSON):

```json
{
  "idx": 35,
  "version": "7",
  "when": 1787155100000,
  "tag": "0035_ai_usage_events",
  "breakpoints": true
}
```

- [ ] **Step 3: Add the Drizzle table**

In `src/db/schema.ts`, immediately after the `geminiKeys` table definition (ends ~line 467), add:

```ts
// One row per top-level Gemini call (not per internal retry): who spent
// quota, on whose key, for which feature, and the token counts Gemini
// reported. Usage accounting only — no prompt or response text is ever
// stored here. key_owner_id and key_last4 are denormalized snapshots so
// shared-key attribution survives key deletion (key_id goes NULL).
// Rows older than 12 months are pruned (privacy-prune pattern; exempt
// from the soft-delete rule — there is nothing to restore).
export const aiUsageEvents = pgTable('ai_usage_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keyId: uuid('key_id').references(() => geminiKeys.id, { onDelete: 'set null' }),
  keyOwnerId: uuid('key_owner_id').references(() => users.id, { onDelete: 'set null' }),
  keyLast4: text('key_last4'),
  feature: text('feature').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  // 'ok' or the GeminiErrorCode that ended the call (e.g. 'AUTH_FAILED').
  status: text('status').notNull().default('ok'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('ai_usage_user_created_idx').on(t.userId, t.createdAt),
  index('ai_usage_key_owner_created_idx').on(t.keyOwnerId, t.createdAt),
  index('ai_usage_feature_created_idx').on(t.feature, t.createdAt),
])
```

(If `index` is not yet imported from `drizzle-orm/pg-core` in schema.ts, add it to the existing import — the file already uses `uniqueIndex`.)

- [ ] **Step 4: Apply and verify against information_schema**

```bash
npm run db:migrate
```

Then verify (exit code proves nothing — query the catalog):

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_usage_events' ORDER BY ordinal_position\`.then(r => { console.log(r.map(x => x.column_name)); if (r.length < 11) { console.error('MISSING TABLE OR COLUMNS'); process.exit(1); } });
"
```

Expected: 11 columns (id, user_id, key_id, key_owner_id, key_last4, feature, model, input_tokens, output_tokens, status, created_at).

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add drizzle/0035_ai_usage_events.sql drizzle/meta/_journal.json src/db/schema.ts
git commit -m "feat: ai_usage_events ledger table

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Migration 0036 — key `shared`/`tier` columns + `user_ai_prefs`

**Files:**
- Create: `drizzle/0036_key_sharing_prefs.sql`
- Modify: `drizzle/meta/_journal.json` (append entry)
- Modify: `src/db/schema.ts` (extend `geminiKeys`, add `userAiPrefs`)

**Interfaces:**
- Produces: `geminiKeys.shared: boolean` (default false), `geminiKeys.tier: text` (default `'free'`); `userAiPrefs` table with composite PK `(userId, feature)`, columns `enabled: boolean`, `updatedAt`.

- [ ] **Step 1: Write the migration SQL**

Create `drizzle/0036_key_sharing_prefs.sql`:

```sql
ALTER TABLE "gemini_keys" ADD COLUMN IF NOT EXISTS "shared" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "gemini_keys" ADD COLUMN IF NOT EXISTS "tier" text NOT NULL DEFAULT 'free';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_ai_prefs" (
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"feature" text NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp NOT NULL DEFAULT now(),
	CONSTRAINT "user_ai_prefs_pk" PRIMARY KEY ("user_id","feature")
);
```

- [ ] **Step 2: Append the journal entry**

```json
{
  "idx": 36,
  "version": "7",
  "when": 1787155200000,
  "tag": "0036_key_sharing_prefs",
  "breakpoints": true
}
```

- [ ] **Step 3: Update Drizzle schema**

In `src/db/schema.ts`, inside `geminiKeys`, after the `active` column add:

```ts
  // Org sharing: the owner explicitly opted this key into the org pool
  // (consent dialog in the keys card). Selection order is always the
  // caller's own keys first, then shared keys — see orderKeysForRotation.
  shared: boolean('shared').notNull().default(false),
  // 'free' | 'paid' — declared by the owner (Google exposes no way to
  // detect it). Display-only: free keys show "$0 charged", paid keys show
  // an indicative estimated charge.
  tier: text('tier').notNull().default('free'),
```

After the `aiUsageEvents` table (Task 1), add:

```ts
// Per-user AI feature toggles. ABSENT ROW = ENABLED — the product default
// is fully AI-enabled; a row exists only once the user has touched the
// switch. Feature ids are the display-feature ids from
// src/features/gemini/ai-features.ts, not per-call slugs.
export const userAiPrefs = pgTable('user_ai_prefs', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull(),
  enabled: boolean('enabled').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ name: 'user_ai_prefs_pk', columns: [t.userId, t.feature] }),
])
```

(`primaryKey` comes from `drizzle-orm/pg-core` — add to the existing import if absent.)

- [ ] **Step 4: Apply and verify**

```bash
npm run db:migrate
node -e "
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
Promise.all([
  sql\`SELECT column_name FROM information_schema.columns WHERE table_name = 'gemini_keys' AND column_name IN ('shared','tier')\`,
  sql\`SELECT column_name FROM information_schema.columns WHERE table_name = 'user_ai_prefs'\`,
]).then(([a, b]) => { console.log(a, b); if (a.length !== 2 || b.length < 4) { console.error('SCHEMA MISMATCH'); process.exit(1); } });
"
```

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add drizzle/0036_key_sharing_prefs.sql drizzle/meta/_journal.json src/db/schema.ts
git commit -m "feat: gemini key sharing + tier columns, user_ai_prefs table

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Pricing module (`pricing.ts`) — TDD

**Files:**
- Create: `src/features/gemini/pricing.ts`
- Test: `src/features/gemini/pricing.test.ts`

**Interfaces:**
- Produces: `priceForModel(model: string, at: Date): ModelPrice | null`; `estimateCostUsd(args: { model: string; inputTokens: number; outputTokens: number; at: Date }): number | null`; `formatUsd(value: number): string`; type `ModelPrice = { inputPer1M: number; outputPer1M: number }`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/gemini/pricing.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { estimateCostUsd, formatUsd, priceForModel } from '@/features/gemini/pricing'

describe('priceForModel', () => {
  it('resolves the 3.6 flash promo price before 2027', () => {
    expect(priceForModel('gemini-3.6-flash', new Date('2026-08-19'))).toEqual({
      inputPer1M: 0.75,
      outputPer1M: 3.75,
    })
  })

  it('resolves the 3.6 flash post-promo price from 2027-01-01', () => {
    expect(priceForModel('gemini-3.6-flash', new Date('2027-01-01T00:00:00Z'))).toEqual({
      inputPer1M: 1.5,
      outputPer1M: 7.5,
    })
  })

  it('returns null for a model it does not know — never invents a price', () => {
    expect(priceForModel('gemini-99-mystery', new Date('2026-08-19'))).toBeNull()
  })

  it('prices the moving flash alias like the pinned default', () => {
    expect(priceForModel('gemini-flash-latest', new Date('2026-08-19'))).toEqual({
      inputPer1M: 0.75,
      outputPer1M: 3.75,
    })
  })
})

describe('estimateCostUsd', () => {
  it('computes input + output cost per million tokens', () => {
    expect(
      estimateCostUsd({
        model: 'gemini-3.6-flash',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        at: new Date('2026-08-19'),
      }),
    ).toBeCloseTo(4.5, 10)
  })

  it('returns null for unknown models', () => {
    expect(
      estimateCostUsd({ model: 'nope', inputTokens: 10, outputTokens: 10, at: new Date('2026-08-19') }),
    ).toBeNull()
  })
})

describe('formatUsd', () => {
  it('prefixes ≈ and keeps sub-cent amounts readable', () => {
    expect(formatUsd(0.00234)).toBe('≈$0.0023')
  })
  it('rounds ordinary amounts to cents', () => {
    expect(formatUsd(1.237)).toBe('≈$1.24')
  })
  it('shows a hard zero as $0.00 (still approximate-marked)', () => {
    expect(formatUsd(0)).toBe('≈$0.00')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/gemini/pricing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `pricing.ts`**

```ts
// Official Gemini API paid-tier prices, USD per 1M tokens, verified
// 2026-08-19 against ai.google.dev/gemini-api/docs/pricing. These convert
// LOGGED tokens into an INDICATIVE dollar value ("what this would cost on
// the paid tier") at read time — fixing a price here re-prices history.
// Free-tier keys are charged $0 regardless; every figure derived from this
// table is shown with a ≈ prefix. Unknown model → null, never a guess.

export type ModelPrice = { inputPer1M: number; outputPer1M: number }

type PriceRow = ModelPrice & {
  // Promo window: this row applies strictly before `until`; the row that
  // follows (same model, no `until`) applies after. Ordered first-match.
  until?: string // ISO date, exclusive
}

const PRICE_TABLE: Record<string, PriceRow[]> = {
  'gemini-3.7-flash': [
    { inputPer1M: 0.75, outputPer1M: 3.75, until: '2027-01-01' },
    { inputPer1M: 1.5, outputPer1M: 7.5 },
  ],
  'gemini-3.6-flash': [
    { inputPer1M: 0.75, outputPer1M: 3.75, until: '2027-01-01' },
    { inputPer1M: 1.5, outputPer1M: 7.5 },
  ],
  // The moving alias resolves to a current flash model — priced like the
  // pinned default so alias-served calls don't show "price unknown".
  'gemini-flash-latest': [
    { inputPer1M: 0.75, outputPer1M: 3.75, until: '2027-01-01' },
    { inputPer1M: 1.5, outputPer1M: 7.5 },
  ],
  'gemini-3.5-flash': [{ inputPer1M: 1.5, outputPer1M: 9.0 }],
  'gemini-3.5-flash-lite': [{ inputPer1M: 0.3, outputPer1M: 2.5 }],
  'gemini-3.1-pro-preview': [{ inputPer1M: 1.25, outputPer1M: 10.0 }],
  'gemini-2.5-flash': [{ inputPer1M: 0.3, outputPer1M: 2.5 }],
  'gemini-2.5-flash-lite': [{ inputPer1M: 0.1, outputPer1M: 0.4 }],
  'gemini-2.5-pro': [{ inputPer1M: 1.25, outputPer1M: 10.0 }],
  // TTS: text in, audio out.
  'gemini-3.1-flash-tts-preview': [{ inputPer1M: 1.0, outputPer1M: 20.0 }],
  'gemini-2.5-flash-preview-tts': [{ inputPer1M: 1.0, outputPer1M: 20.0 }],
  // Live API audio (browser-direct; tokens are ESTIMATED, see live-token.ts).
  'gemini-3.1-flash-live-preview': [{ inputPer1M: 3.0, outputPer1M: 12.0 }],
  'gemini-2.5-flash-native-audio-preview-12-2025': [{ inputPer1M: 3.0, outputPer1M: 12.0 }],
}

export function priceForModel(model: string, at: Date): ModelPrice | null {
  const rows = PRICE_TABLE[model]
  if (!rows) return null
  for (const row of rows) {
    if (!row.until || at < new Date(row.until)) {
      return { inputPer1M: row.inputPer1M, outputPer1M: row.outputPer1M }
    }
  }
  return null
}

export function estimateCostUsd(args: {
  model: string
  inputTokens: number
  outputTokens: number
  at: Date
}): number | null {
  const price = priceForModel(args.model, args.at)
  if (!price) return null
  return (
    (args.inputTokens / 1_000_000) * price.inputPer1M +
    (args.outputTokens / 1_000_000) * price.outputPer1M
  )
}

/**
 * Every dollar figure LogPup shows is derived (tokens × list price), never
 * a bill — the ≈ prefix is part of the format, not optional decoration.
 * Sub-cent amounts keep four decimals so "≈$0.0023" doesn't collapse to a
 * misleading "≈$0.00" for a real, nonzero cost.
 */
export function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return `≈$${value.toFixed(4)}`
  return `≈$${value.toFixed(2)}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/gemini/pricing.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/gemini/pricing.ts src/features/gemini/pricing.test.ts
git commit -m "feat: gemini pricing table with promo windows and honest formatting

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Feature registry + prefs module — TDD

**Files:**
- Create: `src/features/gemini/ai-features.ts`
- Create: `src/features/gemini/prefs.ts`
- Test: `src/features/gemini/ai-features.test.ts`

**Interfaces:**
- Produces (`ai-features.ts`): `type AiCallSlug`, `type AiFeatureId`, `AI_FEATURES: readonly AiFeatureDef[]` where `AiFeatureDef = { id: AiFeatureId; label: string; description: string; chain: 'Quick' | 'Analysis' | 'Synthesis' | 'Voice' | 'Live'; slugs: readonly AiCallSlug[]; estimate: { label: string; tokens: { model: string; inputTokens: number; outputTokens: number } } }`, `featureForSlug(slug: AiCallSlug): AiFeatureDef`.
- Produces (`prefs.ts`): `resolvePrefs(rows: { feature: string; enabled: boolean }[]): Record<AiFeatureId, boolean>` (pure), `getAiPrefs(userId)`, `isAiFeatureEnabled(userId, id)`, `aiFeatureDisabledMessage(userId, id)`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/gemini/ai-features.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AI_FEATURES, featureForSlug } from '@/features/gemini/ai-features'
import { resolvePrefs } from '@/features/gemini/prefs'
import { priceForModel } from '@/features/gemini/pricing'

describe('AI_FEATURES registry', () => {
  it('maps every slug to exactly one feature', () => {
    const seen = new Map<string, string>()
    for (const f of AI_FEATURES) {
      for (const slug of f.slugs) {
        expect(seen.has(slug), `slug ${slug} claimed by ${seen.get(slug)} and ${f.id}`).toBe(false)
        seen.set(slug, f.id)
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(10)
  })

  it('featureForSlug resolves a known slug', () => {
    expect(featureForSlug('worklog.draft').id).toBe('worklog-draft')
  })

  it('every estimate uses a model the pricing table knows', () => {
    for (const f of AI_FEATURES) {
      expect(
        priceForModel(f.estimate.tokens.model, new Date('2026-08-19')),
        `estimate model for ${f.id} has no price`,
      ).not.toBeNull()
    }
  })
})

describe('resolvePrefs', () => {
  it('defaults every feature to enabled when no rows exist', () => {
    const prefs = resolvePrefs([])
    for (const f of AI_FEATURES) expect(prefs[f.id]).toBe(true)
  })

  it('a stored false wins; unknown stored ids are ignored', () => {
    const prefs = resolvePrefs([
      { feature: 'worklog-draft', enabled: false },
      { feature: 'retired-feature', enabled: false },
    ])
    expect(prefs['worklog-draft']).toBe(false)
    expect(prefs['meeting-intel']).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/gemini/ai-features.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `ai-features.ts`**

```ts
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

export type AiFeatureId =
  | 'meeting-intel'
  | 'meeting-assistant'
  | 'live-captions'
  | 'read-aloud'
  | 'dictation'
  | 'worklog-draft'
  | 'sprint-draft'
  | 'app-metadata'

export type AiFeatureDef = {
  id: AiFeatureId
  label: string
  description: string
  chain: 'Quick' | 'Analysis' | 'Synthesis' | 'Voice' | 'Live'
  slugs: readonly AiCallSlug[]
  estimate: {
    label: string // e.g. "per meeting hour", "per draft"
    tokens: { model: string; inputTokens: number; outputTokens: number }
  }
}

export const AI_FEATURES: readonly AiFeatureDef[] = [
  {
    id: 'meeting-intel',
    label: 'Meeting intelligence',
    description: 'Transcribes recordings and writes the summary, action items, and follow-ups.',
    chain: 'Synthesis',
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
    slugs: ['app.metadata'],
    estimate: {
      label: 'per generation',
      tokens: { model: 'gemini-3.5-flash-lite', inputTokens: 3_000, outputTokens: 200 },
    },
  },
]

const BY_SLUG = new Map<AiCallSlug, AiFeatureDef>(
  AI_FEATURES.flatMap((f) => f.slugs.map((s) => [s, f] as const)),
)

export function featureForSlug(slug: AiCallSlug): AiFeatureDef {
  const feature = BY_SLUG.get(slug)
  if (!feature) throw new Error(`No AI feature registered for slug "${slug}"`)
  return feature
}
```

- [ ] **Step 4: Implement `prefs.ts`**

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { userAiPrefs } from '@/db/schema'
import { AI_FEATURES, type AiFeatureId } from '@/features/gemini/ai-features'

/**
 * Pure resolution: absent row = enabled (the product default is fully
 * AI-enabled), stored rows win, ids no feature claims anymore are ignored
 * (a retired feature's row must not break the map).
 */
export function resolvePrefs(
  rows: { feature: string; enabled: boolean }[],
): Record<AiFeatureId, boolean> {
  const prefs = Object.fromEntries(AI_FEATURES.map((f) => [f.id, true])) as Record<
    AiFeatureId,
    boolean
  >
  const known = new Set<string>(AI_FEATURES.map((f) => f.id))
  for (const row of rows) {
    if (known.has(row.feature)) prefs[row.feature as AiFeatureId] = row.enabled
  }
  return prefs
}

export async function getAiPrefs(userId: string): Promise<Record<AiFeatureId, boolean>> {
  const rows = await db
    .select({ feature: userAiPrefs.feature, enabled: userAiPrefs.enabled })
    .from(userAiPrefs)
    .where(eq(userAiPrefs.userId, userId))
  return resolvePrefs(rows)
}

export async function isAiFeatureEnabled(userId: string, id: AiFeatureId): Promise<boolean> {
  return (await getAiPrefs(userId))[id]
}

/**
 * Server-action gate: the user-facing refusal message when the caller has
 * switched this feature off, null when the call may proceed. This is the
 * "off" analog of the NO_KEYS error, and exactly as visible.
 */
export async function aiFeatureDisabledMessage(
  userId: string,
  id: AiFeatureId,
): Promise<string | null> {
  return (await isAiFeatureEnabled(userId, id)) ? null : 'This AI feature is off in your Settings.'
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/gemini/ai-features.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/gemini/ai-features.ts src/features/gemini/prefs.ts src/features/gemini/ai-features.test.ts
git commit -m "feat: AI feature registry and per-user pref resolution

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Usage recorder + rotation ordering — TDD

**Files:**
- Create: `src/features/gemini/usage.ts`
- Create: `src/features/gemini/rotation.ts`
- Test: `src/features/gemini/rotation.test.ts`

**Interfaces:**
- Produces (`usage.ts`): `recordAiUsage(event: AiUsageEventInput): void` — fire-and-forget, never throws.
- Produces (`rotation.ts`): `orderKeysForRotation<K extends { userId: string; shared: boolean; lastUsedAt: Date | null }>(callerId: string, rows: K[]): K[]`.

- [ ] **Step 1: Write the failing test**

Create `src/features/gemini/rotation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { orderKeysForRotation } from '@/features/gemini/rotation'

const key = (userId: string, shared: boolean, lastUsedAt: Date | null, id: string) => ({
  id,
  userId,
  shared,
  lastUsedAt,
})

describe('orderKeysForRotation', () => {
  it('puts own keys first (LRU, never-used before used), then shared keys LRU', () => {
    const rows = [
      key('me', false, new Date('2026-08-18'), 'own-used'),
      key('other', true, null, 'shared-fresh'),
      key('me', false, null, 'own-fresh'),
      key('other', true, new Date('2026-08-01'), 'shared-old'),
    ]
    expect(orderKeysForRotation('me', rows).map((k) => k.id)).toEqual([
      'own-fresh',
      'own-used',
      'shared-fresh',
      'shared-old',
    ])
  })

  it('drops another user’s unshared key even if the query leaked it', () => {
    const rows = [key('other', false, null, 'private-leak'), key('me', false, null, 'own')]
    expect(orderKeysForRotation('me', rows).map((k) => k.id)).toEqual(['own'])
  })

  it('own shared key counts as own, not as pool', () => {
    const rows = [
      key('other', true, null, 'pool'),
      key('me', true, new Date('2026-08-18'), 'own-shared'),
    ]
    expect(orderKeysForRotation('me', rows).map((k) => k.id)).toEqual(['own-shared', 'pool'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gemini/rotation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `rotation.ts`**

```ts
/**
 * Key order for one Gemini call: the caller's own active keys first
 * (least-recently-used first, never-used before used — the same LRU the
 * per-user pool has always run), then org-shared keys owned by others,
 * LRU again. Own keys first means a caller with working keys never spends
 * a teammate's shared quota; the pool is the fallback, not the default.
 * Pure so the ordering is testable without a database.
 */
export function orderKeysForRotation<
  K extends { userId: string; shared: boolean; lastUsedAt: Date | null },
>(callerId: string, rows: K[]): K[] {
  const lru = (a: K, b: K) => {
    if (a.lastUsedAt === null && b.lastUsedAt === null) return 0
    if (a.lastUsedAt === null) return -1
    if (b.lastUsedAt === null) return 1
    return a.lastUsedAt.getTime() - b.lastUsedAt.getTime()
  }
  const own = rows.filter((r) => r.userId === callerId).sort(lru)
  const pool = rows.filter((r) => r.userId !== callerId && r.shared).sort(lru)
  return [...own, ...pool]
}
```

- [ ] **Step 4: Implement `usage.ts`**

```ts
import { db } from '@/db'
import { aiUsageEvents } from '@/db/schema'
import type { AiCallSlug } from '@/features/gemini/ai-features'

export type AiUsageEventInput = {
  userId: string
  keyId?: string | null
  keyOwnerId?: string | null
  keyLast4?: string | null
  feature: AiCallSlug
  model: string
  inputTokens?: number
  outputTokens?: number
  /** 'ok' or the GeminiErrorCode that ended the call. */
  status: string
}

/**
 * Fire-and-forget ledger write. This sits inside the response path of
 * every AI call, so it must be free: not awaited, and a failure (missing
 * table, connection blip) is logged and swallowed — the ledger exists to
 * inform, never to cost someone a transcription.
 */
export function recordAiUsage(event: AiUsageEventInput): void {
  void db
    .insert(aiUsageEvents)
    .values({
      userId: event.userId,
      keyId: event.keyId ?? null,
      keyOwnerId: event.keyOwnerId ?? null,
      keyLast4: event.keyLast4 ?? null,
      feature: event.feature,
      model: event.model,
      inputTokens: event.inputTokens ?? 0,
      outputTokens: event.outputTokens ?? 0,
      status: event.status,
    })
    .catch((error) => {
      console.error('[ai-usage] ledger write failed (ignored):', error)
    })
}
```

- [ ] **Step 5: Run tests, typecheck**

Run: `npx vitest run src/features/gemini/rotation.test.ts` — expected PASS.
Run: `npx tsc --noEmit` — expected clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/gemini/usage.ts src/features/gemini/rotation.ts src/features/gemini/rotation.test.ts
git commit -m "feat: usage recorder and own-then-shared key rotation ordering

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Wire client.ts — shared keys, usageMetadata, ledger rows

**Files:**
- Modify: `src/features/gemini/client.ts`

**Interfaces:**
- Consumes: `orderKeysForRotation`, `recordAiUsage`.
- Produces: `callGemini`, `callGeminiSpeech`, `callGeminiWithAudio`, `callGeminiWithImages` accept `feature?: AiCallSlug` (optional here; Task 7 makes it required). Key selection includes shared keys. One ledger row per top-level call.

- [ ] **Step 1: Extend the response type and attempt result**

Extend `GenerateContentResponse` (~line 84):

```ts
type GenerateContentResponse = {
  candidates?: {
    content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] }
  }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
}
```

Change the ok arm of `ModelAttemptResult` (~line 79):

```ts
type ModelAttemptResult<T> =
  | { ok: true; value: T; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; kind: 'auth' | 'quota' | 'overloaded' | 'missing' | 'bad'; message: string }
```

In `callModelWithRetry`'s success branch (~lines 157-164):

```ts
    if (res.ok) {
      const json = (await res.json()) as GenerateContentResponse
      const value = extract(json)
      if (value === null) {
        return { ok: false, kind: 'bad', message: 'Gemini returned an empty response' }
      }
      return {
        ok: true,
        value,
        usage: {
          inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
        },
      }
    }
```

- [ ] **Step 2: Switch key selection to own-then-shared**

Add imports (merge `or` into the existing drizzle-orm import):

```ts
import { and, eq, or, sql } from 'drizzle-orm'
import { orderKeysForRotation } from '@/features/gemini/rotation'
import { recordAiUsage } from '@/features/gemini/usage'
import type { AiCallSlug } from '@/features/gemini/ai-features'
```

In `callGeminiCore` (~line 271) replace the key query:

```ts
  const rows = await db
    .select()
    .from(geminiKeys)
    .where(
      and(
        eq(geminiKeys.active, true),
        or(eq(geminiKeys.userId, userId), eq(geminiKeys.shared, true)),
      ),
    )
  // Own keys first (LRU), then org-shared keys (LRU) — a caller with
  // working keys of their own never drains a teammate's shared quota.
  const keys = orderKeysForRotation(userId, rows)
  const usedSharedPool = keys.some((key) => key.userId !== userId)
```

Update the NO_KEYS message (~line 278):

```ts
  if (keys.length === 0) {
    throw new GeminiError(
      'NO_KEYS',
      'No active Gemini API keys — add one in Profile (or ask a teammate to share one).',
    )
  }
```

Update the terminal `ALL_KEYS_FAILED` throw (~line 408):

```ts
  throw new GeminiError(
    'ALL_KEYS_FAILED',
    usedSharedPool
      ? 'Could not reach Gemini with any saved or org-shared key — check Profile → Gemini API keys or try again shortly.'
      : 'Could not reach Gemini with any saved key — check Profile → Gemini API keys or try again shortly.',
  )
```

- [ ] **Step 3: Thread `feature` through and log ledger rows**

Signature:

```ts
async function callGeminiCore<T>(
  userId: string,
  partsInput: GeminiPartsInput,
  models: readonly string[],
  generationConfig: Record<string, unknown> | undefined,
  extract: ResponseExtractor<T>,
  feature?: AiCallSlug,
): Promise<{ value: T; model: string }>
```

Success branch (~line 334), after the bookkeeping update, before `return`:

```ts
        if (feature) {
          recordAiUsage({
            userId,
            keyId: key.id,
            keyOwnerId: key.userId,
            keyLast4: key.last4,
            feature,
            model,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            status: 'ok',
          })
        }
        return { value: result.value, model }
```

Add this helper immediately above `callGeminiCore`:

```ts
function recordFailure(
  feature: AiCallSlug | undefined,
  userId: string,
  models: readonly string[],
  error: GeminiError,
): GeminiError {
  if (feature) {
    recordAiUsage({ userId, feature, model: models[0] ?? 'unknown', status: error.code })
  }
  return error
}
```

Change every `throw new GeminiError(CODE, msg)` **inside `callGeminiCore` only** (the NO_KEYS throw, the BAD_RESPONSE throw in the loop, and the four terminal throws) to:

```ts
throw recordFailure(feature, userId, models, new GeminiError(CODE, msg))
```

A blocked call is exactly the kind of event Settings and the adoption panel should count.

- [ ] **Step 4: Extend the public surfaces**

`callGemini`:

```ts
export async function callGemini(
  userId: string,
  partsInput: GeminiPartsInput,
  opts?: { model?: string; models?: readonly string[]; responseJson?: boolean; feature?: AiCallSlug },
): Promise<{ text: string; model: string }> {
  const { value: text, model } = await callGeminiCore(
    userId,
    partsInput,
    resolveModelChain(opts),
    opts?.responseJson ? { responseMimeType: 'application/json' } : undefined,
    extractText,
    opts?.feature,
  )
  return { text, model }
}
```

`callGeminiSpeech`: add `feature?: AiCallSlug` to its opts type, pass `opts.feature` as `callGeminiCore`'s sixth argument. `callGeminiWithAudio` / `callGeminiWithImages`: add `feature?: AiCallSlug` to their opts types (they forward `opts` to `callGemini`, so the pass-through is automatic).

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: clean; no call site is forced to change yet.

- [ ] **Step 6: Commit**

```bash
git add src/features/gemini/client.ts
git commit -m "feat: shared-key rotation, usageMetadata capture, ledger rows in gemini client

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Call-site sweep — every Gemini call names its feature

**Files:**
- Modify: `src/features/meetings/ai-actions.ts`, `src/features/meetings/assistant-actions.ts`, `src/features/worklog/draft-actions.ts`, `src/features/sprints/suggest-actions.ts`, `src/features/apps/actions.ts`, `src/features/speech/actions.ts`, `src/features/gemini/client.ts`

**Interfaces:**
- Produces: `feature` becomes REQUIRED in all four public opts types — a future call site that forgets it fails to compile.

- [ ] **Step 1: Find every call site**

```bash
grep -rn "callGemini\|callGeminiSpeech\|callGeminiWithAudio\|callGeminiWithImages" src --include="*.ts" | grep -v "src/features/gemini/client.ts" | grep -v test
```

Expected sites and slugs (if the grep finds more, map each to its nearest slug and say so in the commit message):

| File | Function | Slug |
|---|---|---|
| `meetings/ai-actions.ts` | `transcribeSegment` | `'meeting.segment'` |
| `meetings/ai-actions.ts` | `analyzeMeetingAudio` (legacy) | `'meeting.synthesis'` |
| `meetings/ai-actions.ts` | `finalizeMeetingRecording` | `'meeting.synthesis'` |
| `meetings/ai-actions.ts` | `resolveAddressedFollowups` | `'meeting.followups'` |
| `meetings/assistant-actions.ts` | `askMeeting` | `'meeting.assistant'` |
| `worklog/draft-actions.ts` | `draftWorklogNote` | `'worklog.draft'` |
| `sprints/suggest-actions.ts` | `suggestSprint` | `'sprint.draft'` |
| `apps/actions.ts` | `generateFromFacts` | `'app.metadata'` |
| `speech/actions.ts` | `transcribeDictation` | `'speech.dictation'` |
| `speech/actions.ts` | `synthesizeSpeech` | `'speech.tts'` |

- [ ] **Step 2: Add the slug at each call site**

Mechanical — add `feature: '<slug>'` to the existing opts object, e.g. in `worklog/draft-actions.ts`:

```ts
const { text } = await callGemini(session.user.id, [{ text: prompt }], {
  feature: 'worklog.draft',
})
```

Where a call passes no opts object, add one containing just `feature`. Where it passes `{ models: ... }` or `{ responseJson: true }`, add `feature` alongside.

- [ ] **Step 3: Flip `feature` to required**

In `client.ts`, change all four public opts types from `feature?: AiCallSlug` to `feature: AiCallSlug`, and `callGeminiCore`'s parameter likewise (drop the `if (feature)` guards — always record). `recordFailure`'s parameter becomes non-optional.

- [ ] **Step 4: Verify — the compiler is the test**

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/features/gemini/client.ts src/features/meetings/ai-actions.ts src/features/meetings/assistant-actions.ts src/features/worklog/draft-actions.ts src/features/sprints/suggest-actions.ts src/features/apps/actions.ts src/features/speech/actions.ts
git commit -m "feat: every gemini call names its feature slug for the usage ledger

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: live-token.ts — shared keys + live session ledger row

**Files:**
- Modify: `src/features/transcription/live-token.ts`

- [ ] **Step 1: Swap key selection**

In `mintLiveToken` (~line 137), replace the query + ordering with the Task 6 Step 2 pattern (`active AND (own OR shared)`, then `orderKeysForRotation(userId, rows)`), importing `or` from drizzle-orm and `orderKeysForRotation` from `@/features/gemini/rotation`. Use the Task 6 NO_KEYS wording ("…or ask a teammate to share one").

- [ ] **Step 2: Log the session estimate on successful mint**

In the success branch (~lines 165-175), after the `db.update(...)` bookkeeping and before `return`:

```ts
      // ESTIMATED, not measured: the Live socket runs browser-side, so the
      // server's only handle on its usage is "one token ≈ one ≤10-minute
      // session slice" at the session-budget rate. Every UI that surfaces
      // live.session rows must say "approximately".
      recordAiUsage({
        userId,
        keyId: key.id,
        keyOwnerId: key.userId,
        keyLast4: key.last4,
        feature: 'live.session',
        model,
        inputTokens: AUDIO_TOKENS_PER_SECOND * (TOKEN_TTL_MS / 1000),
        outputTokens: 0,
        status: 'ok',
      })
```

Import `recordAiUsage` from `@/features/gemini/usage` and `AUDIO_TOKENS_PER_SECOND` from `@/features/transcription/session-budget` (verify the export name; if it is not exported, export it there rather than duplicating the literal 25).

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/features/transcription/live-token.ts src/features/transcription/session-budget.ts
git commit -m "feat: live token mints use shared pool and log estimated session usage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Server actions — share, tier, prefs, guards

**Files:**
- Modify: `src/features/gemini/actions.ts`, `src/features/gemini/queries.ts`
- Modify: `src/features/worklog/draft-actions.ts`, `src/features/sprints/suggest-actions.ts`, `src/features/apps/actions.ts`, `src/features/speech/actions.ts`, `src/features/meetings/assistant-actions.ts`, `src/features/meetings/ai-actions.ts`, `src/features/transcription/actions.ts`

**Interfaces:**
- Produces: `setGeminiKeySharing(id, shared)`, `setGeminiKeyTier(id, tier)`, `setAiFeaturePref(feature, enabled)`, `addGeminiKey(label, key, opts?: { tier?: 'free' | 'paid' })`; `GeminiKeyRow` gains `shared: boolean` and `tier: string`.

- [ ] **Step 1: Extend `queries.ts`**

Add `shared` and `tier` to both `GeminiKeyRow` and the `listGeminiKeys` select:

```ts
export type GeminiKeyRow = {
  id: string
  label: string
  last4: string
  active: boolean
  shared: boolean
  tier: string
  failCount: number
  lastUsedAt: Date | null
  createdAt: Date
}
```

- [ ] **Step 2: Extend `actions.ts`**

Add near the other zod inputs:

```ts
const tierInput = z.enum(['free', 'paid'])
```

Extend `addGeminiKey` (existing session/validation/limit/validateGeminiKey code unchanged):

```ts
export async function addGeminiKey(
  label: string,
  key: string,
  opts?: { tier?: 'free' | 'paid' },
): Promise<ActionResult> {
  // ...existing checks...
  const tier = tierInput.safeParse(opts?.tier ?? 'free')
  if (!tier.success) return err('Invalid key tier')

  await db.insert(geminiKeys).values({
    userId: session.user.id,
    label: trimmedLabel,
    encryptedKey: encryptSecret(trimmedKey),
    last4: trimmedKey.slice(-4),
    tier: tier.data,
  })
  revalidatePath('/profile')
  return ok(undefined)
}
```

Add the three new actions (each follows `toggleGeminiKey`'s shape — session check, zod, user-scoped update, revalidate):

```ts
export async function setGeminiKeySharing(id: string, shared: boolean): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  const parsed = toggleInput.safeParse({ id, active: shared })
  if (!parsed.success) return err(parsed.error.issues[0].message)
  await db
    .update(geminiKeys)
    .set({ shared: parsed.data.active })
    .where(and(eq(geminiKeys.id, parsed.data.id), eq(geminiKeys.userId, session.user.id)))
  revalidatePath('/profile')
  return ok(undefined)
}

export async function setGeminiKeyTier(id: string, tier: 'free' | 'paid'): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  const parsedId = idInput.safeParse(id)
  const parsedTier = tierInput.safeParse(tier)
  if (!parsedId.success) return err(parsedId.error.issues[0].message)
  if (!parsedTier.success) return err('Invalid key tier')
  await db
    .update(geminiKeys)
    .set({ tier: parsedTier.data })
    .where(and(eq(geminiKeys.id, parsedId.data), eq(geminiKeys.userId, session.user.id)))
  revalidatePath('/profile')
  return ok(undefined)
}

export async function setAiFeaturePref(
  feature: AiFeatureId,
  enabled: boolean,
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  if (!AI_FEATURES.some((f) => f.id === feature)) return err('Unknown AI feature')
  await db
    .insert(userAiPrefs)
    .values({ userId: session.user.id, feature, enabled, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [userAiPrefs.userId, userAiPrefs.feature],
      set: { enabled, updatedAt: new Date() },
    })
  revalidatePath('/settings')
  return ok(undefined)
}
```

with imports `import { AI_FEATURES, type AiFeatureId } from '@/features/gemini/ai-features'` and `userAiPrefs` added to the `@/db/schema` import.

- [ ] **Step 3: Wire the pref guards**

In each action below, immediately after its session/permission checks and before any Gemini work (read each function first and match its existing error shape — `err(...)` for ActionResult actions):

| Action | Feature id |
|---|---|
| `draftWorklogNote` (worklog/draft-actions.ts) | `'worklog-draft'` |
| `suggestSprint` (sprints/suggest-actions.ts) | `'sprint-draft'` |
| `generateAppFromRepo`, `generateAppFromReadme` (apps/actions.ts) | `'app-metadata'` |
| `transcribeDictation` (speech/actions.ts) | `'dictation'` |
| `synthesizeSpeech` (speech/actions.ts) | `'read-aloud'` |
| `askMeeting` (meetings/assistant-actions.ts) | `'meeting-assistant'` |
| `transcribeSegment`, `finalizeMeetingRecording` (meetings/ai-actions.ts) | `'meeting-intel'` |
| `requestLiveToken` (transcription/actions.ts) | `'live-captions'` |

Example:

```ts
const disabled = await aiFeatureDisabledMessage(session.user.id, 'worklog-draft')
if (disabled) return err(disabled)
```

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/features/gemini/actions.ts src/features/gemini/queries.ts src/features/worklog/draft-actions.ts src/features/sprints/suggest-actions.ts src/features/apps/actions.ts src/features/speech/actions.ts src/features/meetings/assistant-actions.ts src/features/meetings/ai-actions.ts src/features/transcription/actions.ts
git commit -m "feat: key sharing/tier actions, AI pref action, feature guards in AI actions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Usage summaries and adoption math — TDD

**Files:**
- Create: `src/features/gemini/usage-summary.ts`
- Test: `src/features/gemini/usage-summary.test.ts`
- Modify: `src/features/gemini/queries.ts`

**Interfaces:**
- Produces (pure): `summarizeUsage(rows: UsageAggRow[], at: Date): FeatureUsageSummary[]`, `totalsFor(summaries): { calls; tokens; valueUsd; paidChargeUsd }`, `summarizeAdoption(rows: AdoptionAggRow[], activeUserCount: number): FeatureAdoption[]` where `AdoptionAggRow = { feature: string; userCount: number; calls: number; lastUsedAt: Date | null }` and `FeatureAdoption = { featureId: AiFeatureId; label: string; users: number; calls: number; adoptionPct: number; lastUsedAt: Date | null; verdict: 'strong' | 'partial' | 'unused' }`.
- Produces (`queries.ts`): `aggregateAiUsage(userId, since)`, `sharedKeyUsageByCaller(ownerId, since)`, `aggregateAdoption(since)`, `perUserFeatureUsage(since)`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/gemini/usage-summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { summarizeAdoption, summarizeUsage, totalsFor } from '@/features/gemini/usage-summary'
import { AI_FEATURES } from '@/features/gemini/ai-features'

const AT = new Date('2026-08-19')

describe('summarizeUsage', () => {
  it('rolls slugs up to display features and prices per model', () => {
    const rows = [
      { feature: 'worklog.draft', model: 'gemini-3.6-flash', keyTier: 'free', calls: 4, inputTokens: 8_000, outputTokens: 800 },
      { feature: 'meeting.segment', model: 'gemini-3.6-flash', keyTier: 'free', calls: 12, inputTokens: 120_000, outputTokens: 6_000 },
      { feature: 'meeting.synthesis', model: 'gemini-3.1-pro-preview', keyTier: 'free', calls: 1, inputTokens: 50_000, outputTokens: 4_000 },
    ]
    const meeting = summarizeUsage(rows, AT).find((s) => s.featureId === 'meeting-intel')!
    expect(meeting.calls).toBe(13)
    expect(meeting.tokens).toBe(180_000)
    expect(meeting.valueUsd).toBeGreaterThan(0)
    expect(meeting.paidChargeUsd).toBe(0)
  })

  it('counts paid-tier rows into paidChargeUsd', () => {
    const [s] = summarizeUsage(
      [{ feature: 'worklog.draft', model: 'gemini-3.6-flash', keyTier: 'paid', calls: 1, inputTokens: 1_000_000, outputTokens: 0 }],
      AT,
    )
    expect(s.paidChargeUsd).toBeCloseTo(0.75, 10)
    expect(s.valueUsd).toBeCloseTo(0.75, 10)
  })

  it('ignores retired slugs and prices unknown models at zero', () => {
    const summaries = summarizeUsage(
      [
        { feature: 'retired.slug', model: 'gemini-3.6-flash', keyTier: 'free', calls: 1, inputTokens: 10, outputTokens: 10 },
        { feature: 'worklog.draft', model: 'unknown-model', keyTier: 'free', calls: 2, inputTokens: 10, outputTokens: 10 },
      ],
      AT,
    )
    const wl = summaries.find((s) => s.featureId === 'worklog-draft')!
    expect(wl.calls).toBe(2)
    expect(wl.valueUsd).toBe(0)
  })
})

describe('totalsFor', () => {
  it('sums across features', () => {
    expect(
      totalsFor([
        { featureId: 'worklog-draft', calls: 2, tokens: 100, valueUsd: 0.5, paidChargeUsd: 0 },
        { featureId: 'dictation', calls: 3, tokens: 200, valueUsd: 0.25, paidChargeUsd: 0.25 },
      ]),
    ).toEqual({ calls: 5, tokens: 300, valueUsd: 0.75, paidChargeUsd: 0.25 })
  })
})

describe('summarizeAdoption', () => {
  it('lists every registered feature, including ones nobody used', () => {
    const rows = summarizeAdoption([], 10)
    expect(rows).toHaveLength(AI_FEATURES.length)
    expect(rows.every((r) => r.verdict === 'unused' && r.users === 0)).toBe(true)
  })

  it('computes adoption share against the active user count', () => {
    const rows = summarizeAdoption(
      [{ feature: 'worklog.draft', userCount: 8, calls: 40, lastUsedAt: new Date('2026-08-18') }],
      10,
    )
    const wl = rows.find((r) => r.featureId === 'worklog-draft')!
    expect(wl.users).toBe(8)
    expect(wl.adoptionPct).toBe(80)
    expect(wl.verdict).toBe('strong')
  })

  it('sums distinct-user counts across a feature’s slugs without double counting calls', () => {
    const rows = summarizeAdoption(
      [
        { feature: 'meeting.segment', userCount: 3, calls: 30, lastUsedAt: new Date('2026-08-18') },
        { feature: 'meeting.synthesis', userCount: 2, calls: 3, lastUsedAt: new Date('2026-08-19') },
      ],
      10,
    )
    const mi = rows.find((r) => r.featureId === 'meeting-intel')!
    expect(mi.calls).toBe(33)
    // Distinct users per slug cannot be summed — the max is the honest floor.
    expect(mi.users).toBe(3)
    expect(mi.lastUsedAt).toEqual(new Date('2026-08-19'))
  })

  it('marks a lightly-used feature partial, not strong', () => {
    const rows = summarizeAdoption(
      [{ feature: 'sprint.draft', userCount: 1, calls: 2, lastUsedAt: new Date('2026-08-10') }],
      10,
    )
    expect(rows.find((r) => r.featureId === 'sprint-draft')!.verdict).toBe('partial')
  })

  it('treats a zero active-user count as 0% rather than dividing by zero', () => {
    const rows = summarizeAdoption(
      [{ feature: 'worklog.draft', userCount: 0, calls: 0, lastUsedAt: null }],
      0,
    )
    expect(rows.find((r) => r.featureId === 'worklog-draft')!.adoptionPct).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/gemini/usage-summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `usage-summary.ts`**

```ts
// Pure rollups over grouped ledger rows.
//
// summarizeUsage answers "what did I spend" for one person (Settings).
// summarizeAdoption answers "who uses what" for admins — and deliberately
// lists EVERY registered feature, because the unused rows are the whole
// point of the panel: a feature nobody touched is the one to fix.

import { AI_FEATURES, type AiFeatureId } from '@/features/gemini/ai-features'
import { estimateCostUsd } from '@/features/gemini/pricing'

export type UsageAggRow = {
  feature: string
  model: string
  keyTier: string | null
  calls: number
  inputTokens: number
  outputTokens: number
}

export type FeatureUsageSummary = {
  featureId: AiFeatureId
  calls: number
  tokens: number
  valueUsd: number
  paidChargeUsd: number
}

const SLUG_TO_FEATURE = new Map<string, AiFeatureId>(
  AI_FEATURES.flatMap((f) => f.slugs.map((s) => [s as string, f.id] as const)),
)

export function summarizeUsage(rows: UsageAggRow[], at: Date): FeatureUsageSummary[] {
  const acc = new Map<AiFeatureId, FeatureUsageSummary>()
  for (const row of rows) {
    const featureId = SLUG_TO_FEATURE.get(row.feature)
    if (!featureId) continue // retired slug — old rows must not crash the page
    const cost =
      estimateCostUsd({
        model: row.model,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        at,
      }) ?? 0
    const entry = acc.get(featureId) ?? {
      featureId,
      calls: 0,
      tokens: 0,
      valueUsd: 0,
      paidChargeUsd: 0,
    }
    entry.calls += row.calls
    entry.tokens += row.inputTokens + row.outputTokens
    entry.valueUsd += cost
    if (row.keyTier === 'paid') entry.paidChargeUsd += cost
    acc.set(featureId, entry)
  }
  return [...acc.values()]
}

export function totalsFor(summaries: FeatureUsageSummary[]) {
  return summaries.reduce(
    (t, s) => ({
      calls: t.calls + s.calls,
      tokens: t.tokens + s.tokens,
      valueUsd: t.valueUsd + s.valueUsd,
      paidChargeUsd: t.paidChargeUsd + s.paidChargeUsd,
    }),
    { calls: 0, tokens: 0, valueUsd: 0, paidChargeUsd: 0 },
  )
}

export type AdoptionAggRow = {
  feature: string
  userCount: number
  calls: number
  lastUsedAt: Date | null
}

export type FeatureAdoption = {
  featureId: AiFeatureId
  label: string
  users: number
  calls: number
  adoptionPct: number
  lastUsedAt: Date | null
  verdict: 'strong' | 'partial' | 'unused'
}

/** A feature counts as adopted-strongly once half the team has used it. */
const STRONG_ADOPTION_SHARE = 0.5

export function summarizeAdoption(
  rows: AdoptionAggRow[],
  activeUserCount: number,
): FeatureAdoption[] {
  const byFeature = new Map<AiFeatureId, { users: number; calls: number; lastUsedAt: Date | null }>()
  for (const row of rows) {
    const featureId = SLUG_TO_FEATURE.get(row.feature)
    if (!featureId) continue
    const entry = byFeature.get(featureId) ?? { users: 0, calls: 0, lastUsedAt: null }
    // Distinct-user counts of two slugs cannot be added (the same person
    // usually triggers both), so the largest per-slug count is the honest
    // floor for "how many people touched this feature".
    entry.users = Math.max(entry.users, row.userCount)
    entry.calls += row.calls
    if (row.lastUsedAt && (!entry.lastUsedAt || row.lastUsedAt > entry.lastUsedAt)) {
      entry.lastUsedAt = row.lastUsedAt
    }
    byFeature.set(featureId, entry)
  }

  return AI_FEATURES.map((f) => {
    const entry = byFeature.get(f.id) ?? { users: 0, calls: 0, lastUsedAt: null }
    const adoptionPct =
      activeUserCount > 0 ? Math.round((entry.users / activeUserCount) * 100) : 0
    const verdict: FeatureAdoption['verdict'] =
      entry.users === 0
        ? 'unused'
        : entry.users >= activeUserCount * STRONG_ADOPTION_SHARE
          ? 'strong'
          : 'partial'
    return {
      featureId: f.id,
      label: f.label,
      users: entry.users,
      calls: entry.calls,
      adoptionPct,
      lastUsedAt: entry.lastUsedAt,
      verdict,
    }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/gemini/usage-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the aggregate queries**

Append to `src/features/gemini/queries.ts` (merge the drizzle-orm import):

```ts
import { and, asc, count, countDistinct, desc, eq, gte, max, ne, sql, sum } from 'drizzle-orm'
import { aiUsageEvents, users } from '@/db/schema'
import type { AdoptionAggRow, UsageAggRow } from '@/features/gemini/usage-summary'

/**
 * One person's ledger since `since`, grouped for summarizeUsage. Joins the
 * key's CURRENT tier (deleted key -> null -> treated as free, i.e. $0
 * charged — the honest floor, since a deleted key's tier is unknowable).
 */
export async function aggregateAiUsage(userId: string, since: Date): Promise<UsageAggRow[]> {
  const rows = await db
    .select({
      feature: aiUsageEvents.feature,
      model: aiUsageEvents.model,
      keyTier: geminiKeys.tier,
      calls: count(),
      inputTokens: sum(aiUsageEvents.inputTokens).mapWith(Number),
      outputTokens: sum(aiUsageEvents.outputTokens).mapWith(Number),
    })
    .from(aiUsageEvents)
    .leftJoin(geminiKeys, eq(aiUsageEvents.keyId, geminiKeys.id))
    .where(and(eq(aiUsageEvents.userId, userId), gte(aiUsageEvents.createdAt, since)))
    .groupBy(aiUsageEvents.feature, aiUsageEvents.model, geminiKeys.tier)
  return rows.map((r) => ({
    ...r,
    inputTokens: r.inputTokens ?? 0,
    outputTokens: r.outputTokens ?? 0,
  }))
}

/** Who spent an owner's shared keys — the per-key "used by" breakdown. */
export async function sharedKeyUsageByCaller(ownerId: string, since: Date) {
  return db
    .select({
      keyId: aiUsageEvents.keyId,
      keyLast4: aiUsageEvents.keyLast4,
      callerName: users.name,
      calls: count(),
      tokens: sql<number>`coalesce(sum(${aiUsageEvents.inputTokens} + ${aiUsageEvents.outputTokens}), 0)`.mapWith(Number),
    })
    .from(aiUsageEvents)
    .innerJoin(users, eq(aiUsageEvents.userId, users.id))
    .where(
      and(
        eq(aiUsageEvents.keyOwnerId, ownerId),
        ne(aiUsageEvents.userId, ownerId),
        gte(aiUsageEvents.createdAt, since),
      ),
    )
    .groupBy(aiUsageEvents.keyId, aiUsageEvents.keyLast4, users.name)
}

/** Org-wide, per-slug: how many DISTINCT people used it and how often. */
export async function aggregateAdoption(since: Date): Promise<AdoptionAggRow[]> {
  return db
    .select({
      feature: aiUsageEvents.feature,
      userCount: countDistinct(aiUsageEvents.userId),
      calls: count(),
      lastUsedAt: max(aiUsageEvents.createdAt),
    })
    .from(aiUsageEvents)
    .where(gte(aiUsageEvents.createdAt, since))
    .groupBy(aiUsageEvents.feature)
}

/** Per-person feature usage, for the admin drill-down. */
export async function perUserFeatureUsage(since: Date) {
  return db
    .select({
      userId: aiUsageEvents.userId,
      userName: users.name,
      feature: aiUsageEvents.feature,
      calls: count(),
      lastUsedAt: max(aiUsageEvents.createdAt),
    })
    .from(aiUsageEvents)
    .innerJoin(users, eq(aiUsageEvents.userId, users.id))
    .where(gte(aiUsageEvents.createdAt, since))
    .groupBy(aiUsageEvents.userId, users.name, aiUsageEvents.feature)
    .orderBy(desc(count()))
}
```

(Check the users display-name column in `schema.ts` — if it is not `name`, adjust all three references.)

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/features/gemini/usage-summary.ts src/features/gemini/usage-summary.test.ts src/features/gemini/queries.ts
git commit -m "feat: usage rollup, adoption math, and ledger aggregate queries

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Keys card UI — tier, sharing consent, used-by, honest copy

**Files:**
- Modify: `src/features/gemini/components/gemini-keys-card.tsx`
- Modify: `src/app/(app)/profile/page.tsx`

**Interfaces:**
- Produces: `GeminiKeysCard({ keys, usedBy }: { keys: GeminiKeyRow[]; usedBy: { keyId: string | null; callerName: string; calls: number }[] })`.

- [ ] **Step 1: Rewrite the copy**

Replace `CardDescription` (lines 85-89) with:

```tsx
        <CardDescription>
          Your personal keys power every AI feature. Google&rsquo;s free-tier limits are per
          <strong> project</strong>, not per key — to actually multiply your free quota, create
          each key in its own project in Google AI Studio. Keys are encrypted at rest and never
          shown again after saving.
        </CardDescription>
```

Replace the footer paragraph (lines 184-187) with:

```tsx
            <p className="text-xs text-muted-foreground">
              Free keys cost $0 and cover every LogPup feature (roughly 10&ndash;15 requests/min
              and a few hundred/day per project). One key per AI Studio project; add up to 5.
            </p>
```

Append to the empty-state paragraph (lines 93-96): ` Each key from a separate project multiplies your free quota.`

- [ ] **Step 2: Tier radio in the add form**

Add `const [tier, setTier] = useState<'free' | 'paid'>('free')`, pass `addGeminiKey(label, key, { tier })`, reset to `'free'` on success, and render inside the form above the submit row:

```tsx
          <fieldset className="flex items-center gap-4 text-sm">
            <legend className="sr-only">Key tier</legend>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="gemini-key-tier"
                checked={tier === 'free'}
                onChange={() => setTier('free')}
              />
              Free tier
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="gemini-key-tier"
                checked={tier === 'paid'}
                onChange={() => setTier('paid')}
              />
              Paid (billing linked)
            </label>
          </fieldset>
```

(If `src/components/ui/radio-group.tsx` exists, use it instead; match the repo's component set.)

Sharing is NOT offered at add time — keys are added personal and shared afterwards from the row, so consent has exactly one path.

- [ ] **Step 3: Badges, share toggle, tier flip on each row**

After the Active/Paused badge (~line 114):

```tsx
                <Badge variant="outline">{row.tier === 'paid' ? 'Paid' : 'Free'}</Badge>
                {row.shared ? <Badge variant="secondary">Shared</Badge> : null}
```

Handlers (same shape as `handleToggle`):

```tsx
  function handleShare(id: string, shared: boolean) {
    startTransition(async () => {
      try {
        const res = await setGeminiKeySharing(id, shared)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(shared ? 'Key shared with the org' : 'Key is personal again')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleTier(id: string, tier: 'free' | 'paid') {
    startTransition(async () => {
      try {
        const res = await setGeminiKeyTier(id, tier)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(tier === 'paid' ? 'Marked as paid tier' : 'Marked as free tier')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }
```

Controls in the row's button group — unshare is immediate, sharing goes through consent:

```tsx
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    disabled={isPending}
                    onClick={() => handleTier(row.id, row.tier === 'paid' ? 'free' : 'paid')}
                  >
                    <CreditCard />
                    <span className="sr-only">
                      {row.tier === 'paid' ? 'Mark key as free tier' : 'Mark key as paid tier'}
                    </span>
                  </Button>
                  {row.shared ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      disabled={isPending}
                      onClick={() => handleShare(row.id, false)}
                    >
                      <Users />
                      <span className="sr-only">Stop sharing key</span>
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                        <Users />
                        <span className="sr-only">Share key with org</span>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Share this key with everyone here?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Anyone in this LogPup org can spend &ldquo;{row.label}&rdquo;
                            (••••{row.last4}) on their own AI features once their own keys are
                            exhausted. On the free tier, Google uses prompts to improve its
                            products. You can see who used it, and you can stop sharing or
                            delete the key at any time.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={isPending}
                            onClick={() => handleShare(row.id, true)}
                          >
                            Share key
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
```

Import `CreditCard, Users` from lucide-react and `setGeminiKeySharing, setGeminiKeyTier` from the actions module.

- [ ] **Step 4: Used-by breakdown + single-key nudge**

Inside the `<li>`, after the badges/buttons (full-width line):

```tsx
                {row.shared && usedBy.some((u) => u.keyId === row.id) ? (
                  <p className="w-full text-xs text-muted-foreground">
                    Used in the last 30 days by{' '}
                    {usedBy
                      .filter((u) => u.keyId === row.id)
                      .map((u) => `${u.callerName} (${u.calls} call${u.calls === 1 ? '' : 's'})`)
                      .join(', ')}
                  </p>
                ) : null}
```

Above the add form, when the user has exactly one key that is currently failing:

```tsx
        {keys.length === 1 &&
        keys[0].failCount > 0 &&
        keys[0].lastUsedAt !== null &&
        Date.now() - keys[0].lastUsedAt.getTime() < 12 * 60 * 60 * 1000 ? (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Your only key has been hitting its limits. One key = one project&rsquo;s quota — add
            a second key from a new AI Studio project to keep AI features flowing.
          </p>
        ) : null}
```

- [ ] **Step 5: Wire the prop on /profile**

In `src/app/(app)/profile/page.tsx`, alongside the existing key fetch:

```tsx
const usedBy = await sharedKeyUsageByCaller(
  session.user.id,
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
)
// ...
<GeminiKeysCard keys={keys} usedBy={usedBy} />
```

(Import `sharedKeyUsageByCaller` from `@/features/gemini/queries`; match the page's existing fetch style.)

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit && npm run build
git add src/features/gemini/components/gemini-keys-card.tsx "src/app/(app)/profile/page.tsx"
git commit -m "feat: key tier, org sharing with consent, used-by breakdown, honest quota copy

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Settings AI hub

**Files:**
- Create: `src/features/gemini/components/ai-features-card.tsx` (server)
- Create: `src/features/gemini/components/ai-feature-toggle.tsx` (client)
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: The toggle (client)**

Create `ai-feature-toggle.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { setAiFeaturePref } from '@/features/gemini/actions'
import type { AiFeatureId } from '@/features/gemini/ai-features'

export function AiFeatureToggle({
  feature,
  label,
  enabled,
}: {
  feature: AiFeatureId
  label: string
  enabled: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleChange(next: boolean) {
    startTransition(async () => {
      try {
        const res = await setAiFeaturePref(feature, next)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(next ? `${label} on` : `${label} off`)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <Switch
      checked={enabled}
      disabled={isPending}
      onCheckedChange={handleChange}
      aria-label={`${label} AI feature`}
    />
  )
}
```

(Verify `src/components/ui/switch.tsx` exists and its change-handler prop name; match it.)

- [ ] **Step 2: The card (server)**

Create `ai-features-card.tsx`:

```tsx
import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AI_FEATURES } from '@/features/gemini/ai-features'
import { getAiPrefs } from '@/features/gemini/prefs'
import { estimateCostUsd, formatUsd } from '@/features/gemini/pricing'
import { aggregateAiUsage, listGeminiKeys } from '@/features/gemini/queries'
import { summarizeUsage, totalsFor } from '@/features/gemini/usage-summary'
import { AiFeatureToggle } from '@/features/gemini/components/ai-feature-toggle'

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export async function AiFeaturesCard({ userId }: { userId: string }) {
  const now = new Date()
  const since = new Date(now.getTime() - WINDOW_MS)
  const [prefs, aggRows, keys] = await Promise.all([
    getAiPrefs(userId),
    aggregateAiUsage(userId, since),
    listGeminiKeys(userId),
  ])
  const summaries = summarizeUsage(aggRows, now)
  const totals = totalsFor(summaries)
  const bySummary = new Map(summaries.map((s) => [s.featureId, s]))
  const sharedByMe = keys.filter((k) => k.shared).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Sparkles className="size-4" aria-hidden /> AI features
        </CardTitle>
        <CardDescription>
          Everything AI does here runs on your Gemini keys. Dollar figures are indicative — what
          the tokens would cost on Google&rsquo;s paid tier. Free keys are charged $0.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Last 30 days</dt>
            <dd className="font-mono tabular-nums">{totals.calls} calls</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tokens</dt>
            <dd className="font-mono tabular-nums">{totals.tokens.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Value used</dt>
            <dd className="font-mono tabular-nums">{formatUsd(totals.valueUsd)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Charged</dt>
            <dd className="font-mono tabular-nums">
              {totals.paidChargeUsd > 0 ? formatUsd(totals.paidChargeUsd) : '$0.00'}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          {keys.length} key{keys.length === 1 ? '' : 's'} saved
          {sharedByMe > 0 ? ` · ${sharedByMe} shared with the org` : ''}.
        </p>
        <ul className="flex flex-col divide-y">
          {AI_FEATURES.map((f) => {
            const used = bySummary.get(f.id)
            const perUse = estimateCostUsd({ ...f.estimate.tokens, at: now })
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground">{f.description}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {f.chain} ·{' '}
                    {perUse !== null
                      ? `${formatUsd(perUse)} ${f.estimate.label}`
                      : 'price unknown'}
                    {used
                      ? ` · 30d: ${used.calls} calls · ${formatUsd(used.valueUsd)} value`
                      : ' · 30d: not used'}
                  </span>
                </div>
                <AiFeatureToggle feature={f.id} label={f.label} enabled={prefs[f.id]} />
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Mount on /settings**

In `src/app/(app)/settings/page.tsx`, render `<AiFeaturesCard userId={session.user.id} />` immediately after the existing "AI & voice" card (~line 192), matching the page's section spacing. The existing readiness card stays — the hub complements it.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/features/gemini/components/ai-features-card.tsx src/features/gemini/components/ai-feature-toggle.tsx "src/app/(app)/settings/page.tsx"
git commit -m "feat: settings AI hub — per-feature toggles, costs, 30-day usage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Admin AI adoption panel

**Files:**
- Create: `src/features/admin/components/ai-adoption-card.tsx` (server component)
- Modify: `src/app/(app)/admin/page.tsx`

**Interfaces:**
- Consumes: `aggregateAdoption`, `perUserFeatureUsage` (Task 10), `summarizeAdoption` (Task 10), `AI_FEATURES`.
- Produces: `<AiAdoptionCard />` — org-wide, admin-only: per-feature distinct users, adoption %, call count, last use, plus the per-person drill-down and an explicit "nobody has used these" list.

- [ ] **Step 1: Build the card**

Create `src/features/admin/components/ai-adoption-card.tsx`:

```tsx
import { ChartNoAxesColumn } from 'lucide-react'
import { count, eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AI_FEATURES } from '@/features/gemini/ai-features'
import { aggregateAdoption, perUserFeatureUsage } from '@/features/gemini/queries'
import { summarizeAdoption } from '@/features/gemini/usage-summary'

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000

// The badge WORD carries the state (WCAG 1.4.1) — colour only reinforces it.
const VERDICT_BADGE = {
  strong: { word: 'Used by most', variant: 'default' as const },
  partial: { word: 'A few people', variant: 'secondary' as const },
  unused: { word: 'Nobody yet', variant: 'destructive' as const },
}

export async function AiAdoptionCard() {
  const now = new Date()
  const since = new Date(now.getTime() - WINDOW_MS)
  const [adoptionRows, perUser, [activeCount]] = await Promise.all([
    aggregateAdoption(since),
    perUserFeatureUsage(since),
    db.select({ value: count() }).from(users).where(eq(users.active, true)),
  ])
  const activeUsers = activeCount?.value ?? 0
  const adoption = summarizeAdoption(adoptionRows, activeUsers).sort((a, b) => b.users - a.users)
  const unused = adoption.filter((a) => a.verdict === 'unused')

  const featureLabel = new Map(AI_FEATURES.map((f) => [f.id, f.label]))
  const slugToLabel = new Map(
    AI_FEATURES.flatMap((f) => f.slugs.map((s) => [s as string, f.label] as const)),
  )
  const byPerson = new Map<string, { name: string; features: Set<string>; calls: number }>()
  for (const row of perUser) {
    const label = slugToLabel.get(row.feature)
    if (!label) continue
    const entry = byPerson.get(row.userId) ?? { name: row.userName, features: new Set(), calls: 0 }
    entry.features.add(label)
    entry.calls += row.calls
    byPerson.set(row.userId, entry)
  }
  const people = [...byPerson.values()].sort((a, b) => b.calls - a.calls)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <ChartNoAxesColumn className="size-4" aria-hidden /> AI feature adoption
        </CardTitle>
        <CardDescription>
          Who is actually using which AI feature, last 30 days, across {activeUsers} active
          {activeUsers === 1 ? ' person' : ' people'}. Counts are calls, not sessions; a feature
          nobody has touched is the one worth redesigning.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-normal">Feature</th>
                <th className="py-2 font-normal">People</th>
                <th className="py-2 font-normal">Share</th>
                <th className="py-2 font-normal">Calls</th>
                <th className="py-2 font-normal">Last used</th>
                <th className="py-2 font-normal">State</th>
              </tr>
            </thead>
            <tbody>
              {adoption.map((row) => (
                <tr key={row.featureId} className="border-b last:border-0">
                  <td className="py-2">{row.label}</td>
                  <td className="py-2 font-mono tabular-nums">{row.users}</td>
                  <td className="py-2 font-mono tabular-nums">{row.adoptionPct}%</td>
                  <td className="py-2 font-mono tabular-nums">{row.calls}</td>
                  <td className="py-2 font-mono text-xs">
                    {row.lastUsedAt ? row.lastUsedAt.toISOString().slice(0, 10) : '—'}
                  </td>
                  <td className="py-2">
                    <Badge variant={VERDICT_BADGE[row.verdict].variant}>
                      {VERDICT_BADGE[row.verdict].word}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {unused.length > 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm">
            <span className="font-medium">Untouched in 30 days:</span>{' '}
            {unused.map((u) => u.label).join(', ')}. Either nobody knows these exist, or they
            do not fit the work — worth asking before building more on top of them.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Per person</h3>
          {people.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No AI calls recorded yet in this window.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {people.map((p) => (
                <li key={p.name} className="flex flex-wrap items-baseline gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="font-mono tabular-nums text-xs text-muted-foreground">
                    {p.calls} calls
                  </span>
                  <span className="w-full text-xs text-muted-foreground">
                    {[...p.features].join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

Note on `featureLabel`: if the compiler flags it as unused after writing the component, delete that line — `slugToLabel` is the one the drill-down needs.

Note on the active-user count: check the `users` table for the actual "is active" column (`active`, `deactivatedAt`, or a soft-delete column). Use whatever the admin user table already filters on — read `src/app/(app)/admin/page.tsx` first and reuse its predicate rather than inventing one.

- [ ] **Step 2: Mount on /admin behind the existing admin guard**

In `src/app/(app)/admin/page.tsx`, render `<AiAdoptionCard />` as a new section (place it after the user table, before trash). The page already gates on admin — do not add a second check; confirm by reading the top of the file.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/features/admin/components/ai-adoption-card.tsx "src/app/(app)/admin/page.tsx"
git commit -m "feat: admin AI adoption panel — per-feature reach, unused features, per-person usage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: Entry-point gating + final verification

**Files:**
- Modify: `src/features/worklog/components/worklog-form.tsx` + `src/app/(app)/worklog/page.tsx`
- Modify: `src/features/sprints/components/sprint-form-dialog.tsx` + its server parent
- Modify: `src/features/apps/components/app-form-dialog.tsx` + its server parent

**Interfaces:**
- Consumes: `getAiPrefs`.
- Produces: the three one-click AI entry points disappear when their pref is off. (Speech/dictation buttons and meeting recording keep the Task 9 server guards — they mount in too many places for prop threading to pay, and the server message is the designed response there.)

- [ ] **Step 1: Thread the prop in each surface**

Worklog: in `worklog/page.tsx` add `const prefs = await getAiPrefs(session.user.id)` alongside the existing fetches and pass `aiDraftEnabled={prefs['worklog-draft']}` to `WorklogForm`; in `worklog-form.tsx` accept the prop and wrap the Draft-with-AI button:

```tsx
{aiDraftEnabled ? (
  <Button type="button" variant="outline" size="sm" onClick={handleDraft} disabled={isDrafting}>
    {/* existing button content unchanged */}
  </Button>
) : null}
```

Repeat for `sprint-form-dialog.tsx` (`prefs['sprint-draft']` → hide the Suggest button) and `app-form-dialog.tsx` (`prefs['app-metadata']` → hide the generate-from-repo controls). Read each dialog's server parent to find where props flow — the dialogs are client components, so the pref must come from the nearest server component.

- [ ] **Step 2: Full verification pass**

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

Expected: all green. Then smoke-test (`npm run dev`; if a dev server is already running from the parallel session, use it):
1. /profile — add form shows Free/Paid radio; a key row shows a Free badge; the share button opens the consent dialog naming the key; after confirming, a Shared badge appears.
2. /settings — the AI features card lists 8 features, all toggles on, totals strip reads 0 calls on a fresh ledger.
3. Toggle Worklog drafting off → /worklog hides "Draft with AI"; calling the action directly returns "This AI feature is off in your Settings."
4. Toggle back on and use "Draft with AI" with a valid key → within a minute /settings shows 1 call with nonzero tokens, and /admin's adoption table shows Worklog drafting with 1 person.
5. /admin — the adoption card lists every feature; untouched ones carry the "Nobody yet" badge and appear in the untouched line.

- [ ] **Step 3: Commit**

```bash
git add src/features/worklog/components/worklog-form.tsx "src/app/(app)/worklog/page.tsx" src/features/sprints/components/sprint-form-dialog.tsx src/features/apps/components/app-form-dialog.tsx
# stage the touched server parents explicitly by name as well
git commit -m "feat: hide AI entry points when their settings toggle is off

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Plan self-review notes (applied)

- The spec's "integration test that a callGemini success/failure produces one ledger row" is delivered as the compiler-enforced required `feature` field plus pure tests for `summarizeUsage`, `summarizeAdoption`, and `orderKeysForRotation`. The repo's suite is pure-function Vitest with no DB harness; building one is out of scope. Task 14's smoke list covers the end-to-end row.
- The spec's "client hides buttons via prefs read" is implemented for the three prop-threadable entry points (Task 14); speech buttons and meeting recording use the server guard message by design.
- Sharing at add time was simplified to share-after-add so consent has exactly one path (Task 11 Step 2).
- Admin adoption reporting (Task 13) was added after the spec was written, from the requirement "I need to know which features people are using, which don't, to see how to improve less used features." It needs no new schema — `ai_usage_events` already carries `user_id` + `feature`.
