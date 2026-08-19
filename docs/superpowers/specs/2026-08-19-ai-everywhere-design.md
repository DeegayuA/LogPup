# AI Everywhere — usage ledger, key economy, settings hub, and feature waves

**Date:** 2026-08-19
**Status:** Approved (design), pending implementation plan
**Owner decisions locked:** Gemini-only with multiple keys per user; per-key opt-in org sharing with explicit consent; approved in full (Part A + Part B).

## Goal

Make LogPup fully AI-enabled: every surface with manual synthesis pain gets an AI assist, and the user's AI keys become a managed, visible economy — how many keys, free or paid, what each feature costs (estimated and measured), per-feature on/off, and copy that actively teaches users how to get more free quota.

## Ground truth this design is built on (verified 2026-08-19)

1. **Gemini quota is per Google Cloud project, not per API key.** Five keys minted in one project share one quota bucket. The only way multiple keys multiply free quota is one project per key. Current UI copy ("adding more keys spreads out free-tier rate limits") is true only if users happen to use separate projects — the copy must teach this explicitly.
2. **No usage/balance API exists** for the Gemini Developer API. No documented rate-limit headers either. A BYOK app must self-count tokens from `usageMetadata` in each response and treat HTTP 429 as the only quota signal. Today `client.ts` discards `usageMetadata` entirely; the only persisted signals are `gemini_keys.fail_count` and `last_used_at`.
3. **Official paid pricing (per 1M tokens):** Gemini 3.7/3.6 Flash $0.75 in / $3.75 out (promotional until 2026-12-31, then $1.50/$7.50); 3.5 Flash $1.50/$9.00; 3.5 Flash-Lite $0.30/$2.50; 2.5 Flash $0.30/$2.50; 2.5 Flash-Lite $0.10/$0.40; 2.5 Pro $1.25/$10.00; TTS $1.00/1M text in + $20.00/1M audio out; Live API audio $3.00/1M in ($0.005/min), $12.00/1M out ($0.018/min). Free tier: text models, TTS chains, and Live are "free of charge"; 2.5 Pro TTS is paid-only.
4. **Free-tier prompts are used by Google to improve products; paid-tier prompts are not.** This is a disclosure obligation in the key-sharing consent UI.
5. **Free-tier limits are no longer published per model.** Best third-party numbers post-Dec-2025: flash-lite ~15 RPM / 1,000 RPD; flash ~10 RPM / 250 RPD; pro ~5 RPM / 50–100 RPD. All numbers shown to users must say "approximately" — consistent with the existing `readiness.ts` stance (indicative 1M tokens/day/key).

## Existing infrastructure this builds on (do not rebuild)

- `src/features/gemini/client.ts` — `callGeminiCore` (key LRU rotation, 3-layer retry/fallback, error taxonomy NO_KEYS / AUTH_FAILED / TRANSIENT_BUSY / BAD_RESPONSE / ALL_KEYS_FAILED), `callGemini`, `callGeminiSpeech`, `callGeminiWithAudio`, `callGeminiWithImages`.
- `src/features/gemini/models.ts` — chains: QUICK (flash-lite first), ANALYSIS (flash), SYNTHESIS (pro first), ASSISTANT, TTS; Live chain in `transcription/live-protocol.ts`.
- `gemini_keys` table (`schema.ts` ~456): per-user, max 5, AES-256-GCM encrypted, `active`, `fail_count`, `last_used_at`, last4 display. Hard delete (keys are secrets — stays hard; exempt from the soft-delete rule the way privacy prunes are).
- `src/features/gemini/readiness.ts` — health from `fail_count`/`last_used_at` only, never live-probes.
- Existing AI features (all BYOK, all caller-keyed): meeting segment transcription + Pro synthesis + follow-up resolution + task suggestions + keyframe vision; meeting Q&A assistant; live transcription; worklog note draft; sprint name/goal draft; app metadata from repo; dictation STT; chunked TTS.
- Built-but-unwired: attendee recommendations (`meetingAttendeeRecommendations` in schema, deterministic `attendee-score.ts` ledger with an A1 AI-relevance slot; `gemini-validator.ts` never written; no UI).

---

# Part A — Foundation

## A1. Usage ledger

New table `ai_usage_events`:

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | FK users, cascade | the caller (whose action spent quota) |
| key_id | uuid nullable | FK gemini_keys ON DELETE SET NULL |
| key_owner_id | FK users nullable | denormalized so shared-key attribution survives key deletion |
| key_last4 | text | display snapshot |
| feature | text | slug, e.g. `meeting.segment`, `meeting.synthesis`, `meeting.followups`, `meeting.assistant`, `worklog.draft`, `sprint.draft`, `sprint.checkin-draft`, `app.metadata`, `speech.dictation`, `speech.tts`, `live.session`, `dashboard.brief`, `task.draft`, `task.dedupe`, `command.parse`, `activity.digest`, `person.prep`, `meeting.agenda`, `worklog.team-rollup`, `meeting.attendee-ai`, `capacity.advisor` |
| model | text | model that actually answered |
| input_tokens | int | from `usageMetadata.promptTokenCount`, 0 if absent |
| output_tokens | int | from `usageMetadata.candidatesTokenCount`, 0 if absent |
| status | text | `ok` \| error kind (`auth`/`quota`/`overloaded`/`bad`) |
| created_at | timestamp | |

Recording rules:
- `client.ts` parses `usageMetadata` from every response (add to the `GenerateContentResponse` type) and inserts one row per top-level call (the call that succeeded, or one row with the final error kind if the whole call failed). Per-key/per-model internal retries are NOT individually logged — the ledger answers "what did this feature use", not "replay the retry loop". `fail_count` already covers key health.
- Insert is fire-and-forget: `void insert().catch(log)` — a ledger failure must never fail or slow an AI call. No awaiting in the response path.
- Every call site passes a `feature` slug via a new `opts.feature` (required — TypeScript makes omission a compile error).
- Live API is browser-direct (WebSocket with ephemeral token); the server cannot see its tokens. On session end (or token re-mint), log a `live.session` row with minutes-based estimated tokens (25 audio tokens/sec, the existing `session-budget.ts` constant), flagged by `status='ok'` and model = live model. All UI showing Live usage says "approximately".
- TTS responses include usage metadata where available; when absent, estimate output tokens from audio bytes and mark approximate.
- Retention: ledger rows are usage accounting, not content — they store no prompt or response text. Prune rows older than 12 months (fits existing privacy-prune pattern; exempt from soft-delete rule).

## A2. Pricing module

`src/features/gemini/pricing.ts`, pure and unit-tested:
- `PRICE_TABLE`: per-model `{ inputPer1M, outputPer1M, note? }` in USD, including the 3.6/3.7 Flash promo row with `until: 2026-12-31` and post-promo prices; TTS audio-out price; Live audio in/out.
- `priceForModel(model, at: Date)` — resolves promo windows; unknown model returns null (UI shows "price unknown", never invents).
- `estimateCostUsd({model, inputTokens, outputTokens, at})` — computed at read time so a price-table fix re-prices history.
- `FEATURE_ESTIMATES`: static per-use estimates (typical tokens per use × current price) so Settings can show "≈$0.002 per draft" before the user has any history. Every displayed figure is prefixed "≈" and labeled indicative.
- Display currency: USD (Google bills USD). No conversion.

Honesty rules (inherited from `readiness.ts`): measured tokens are exact; dollar figures are indicative ("what this would cost on the paid tier"); free-tier keys always show **$0 charged**.

## A3. Key sharing (org pool)

- `gemini_keys.shared boolean NOT NULL DEFAULT false`.
- Consent gate: turning sharing on (at add time or later via toggle) opens an AlertDialog stating: (1) anyone in this LogPup org can spend this key's quota on their own AI features; (2) on the free tier Google uses prompts to improve its products; (3) usage by others is visible to you per user; (4) you can stop sharing or delete the key anytime. Confirm required; no pre-checked box.
- Selection order in `callGeminiCore` (and `live-token.ts`, which duplicates key selection): caller's own active keys LRU-first (unchanged) → then shared active keys owned by others, LRU-first. A shared key's failure bookkeeping (`fail_count`, `last_used_at`) is identical regardless of who used it.
- Live transcription and Files-API uploads work per-key already (parts builder invoked per key) — shared keys flow through the same path.
- Attribution: `ai_usage_events` rows carry both `user_id` (caller) and `key_owner_id`, so the owner's key detail view can show "used by" grouped by caller.
- Deactivating (`active=false`) or unsharing takes effect on the next call — no session pinning.
- Key delete stays a hard delete; ledger rows survive via `SET NULL` + snapshots.

## A4. Free/paid key tier

- `gemini_keys.tier text NOT NULL DEFAULT 'free'` (`free` | `paid`). Chosen by the user when adding (radio, default free) and editable later — Google gives no API to detect it.
- Display consequences only (no routing change): free key usage shows "value used ≈$X · $0 charged"; paid key usage shows "estimated charge ≈$X (approximate — check Google billing for the real invoice)".
- Paid keys also carry a footnote that paid-tier prompts are not used for Google product improvement.

## A5. Settings AI hub

Settings page (`/settings`) gains an **AI features** card (read-outs live on /settings per the established split; key CRUD stays on /profile):

- One row per AI feature: name + one-line "what it does", model tier word (Quick/Analysis/Synthesis/Voice/Live), "≈$ per use" static estimate, last-30-days measured usage (calls · tokens · ≈$ value), and an on/off Switch.
- Header strip: this month total calls, tokens, ≈$ value, $ charged (sum of paid-key estimates; $0 when all free), and keys summary (N keys · M shared with you / by you).
- Defaults: **every toggle ON** (the product stance is fully AI-enabled; a missing key — not a pref — is the natural off state).
- Storage: new `user_ai_prefs` table (`user_id` FK, `feature` text, `enabled` boolean, PK (user_id, feature)). Absent row = enabled. Server actions check the pref before calling Gemini (disabled → the same degradation path as NO_KEYS but with copy "You turned this off in Settings"); client hides the corresponding buttons via a prefs read.
- Toggles are per-user. Live transcription's build-level flag remains a read-only fact (unchanged).
- Revalidation: prefs actions revalidate `/settings`; the hub is a server component reading ledger aggregates via one grouped query.

### Key card copy rewrite (on /profile)

- Teach the real quota model: "Google's free-tier limits are per project, not per key. To actually multiply your free quota, create each key in its **own project** in Google AI Studio." Link to aistudio.google.com.
- Keep 5-key cap and existing validation.
- Per-key row gains: tier badge (Free/Paid), Shared badge when shared, and (for own shared keys) a "used by" breakdown from the ledger.
- Nudges: existing empty states already push free keys; add a "1 key = 1 quota — add a second key from a new project" hint when the user has exactly one key and any 429-driven failure in the last 12h.

## A6. Admin feature-adoption panel

Added 2026-08-19 from the owner requirement: *"I need to know which features people are using, which don't, to see how to improve less used features."* Needs no new schema — `ai_usage_events` already carries `user_id` + `feature`.

- Admin-only card on `/admin`, 30-day rolling window: per feature, distinct people who used it, adoption share of active users, call count, last use, and a state badge whose **word** carries the meaning (Used by most / A few people / Nobody yet).
- The registry drives the table, so **every** registered feature is listed including the ones with zero rows — an untouched feature is the finding, and a query-driven table would hide it. A dedicated "untouched in 30 days" line names them.
- Per-person drill-down: who made how many calls, and which features each person has touched.
- Audience note: all users are technical software engineers. Copy states mechanisms and raw counts plainly rather than simplifying them.

## A7. Migrations

Two hand-written SQL migrations + journal entries (model: 0031). Never `drizzle-kit generate`. Next number taken from every worktree's `_journal.json` (siblings: `../LogPup-sdd-*`). Verify with `information_schema` after `npm run db:migrate`, not exit code. `--> statement-breakpoint` between statements, never inside comments.

1. `ai_usage_events` table + indexes (`user_id, created_at`; `key_owner_id, created_at`; `feature, created_at`).
2. `gemini_keys` add `shared`, `tier`; `user_ai_prefs` table.

---

# Part B — Feature waves

Every feature below: gated by key presence AND its pref toggle; degradation is visible and honest (no key → dashed empty state + "add a key" CTA, never silence); every call passes a `feature` slug; writes require human confirmation (the auto-assign cap + undo pattern from meetings is the ceiling for autonomy); errors surface `GeminiError` messages verbatim; bilingual output allowed where source data is code-switched (never force-translate).

Model-chain assignments follow the existing routing philosophy: QUICK for mechanical text, ANALYSIS for per-item work, SYNTHESIS only for write-ups a person actually reads.

## Wave 1

1. **Dashboard morning brief** (`dashboard.brief`, ANALYSIS) — button in MyDayZone: synthesizes the 4 stat tiles' underlying rows (due/overdue tasks, follow-ups owed, today's meetings, unread mentions) into a ≤120-word brief + 3 suggested priorities, with a "standup draft" variant (first-person, past-day worklog + today plan). Read-aloud via existing SpeakButton. Nothing auto-runs; nothing is stored except the ledger row.
2. **Task drafting + duplicate check** (`task.draft`, `task.dedupe`, QUICK) — in task-composer/task-dialog: "Draft description" expands a title into description + acceptance bullets using app context (app name, tech tags, sprint goal); on create, a dedupe pass compares the new title against open task titles in that app (single QUICK call with the candidate list; returns suspected duplicates for the user to dismiss or open). Both human-confirmed; never blocks creation.
3. **⌘K AI fallback parse** (`command.parse`, QUICK) — when the rule-based `parseTaskIntent` fails or names don't resolve, offer "Ask AI to parse" which maps the phrase to {assignee, title, app, due} constrained to real people/apps provided in the prompt (id-whitelist pattern from `followups.ts`). Preview-then-confirm, same as today's rule-based flow.
4. **Activity catch-up digest** (`activity.digest`, ANALYSIS) — on /activity: "Catch me up" summarizes activity rows since the caller's last worklog/session into grouped bullets (per app, per person), with the burst-collapsed trail as input. Read-only.

## Wave 2

5. **Person 1:1 prep** (`person.prep`, ANALYSIS) — on people/[id]: synthesize the 7 existing reads (workload buckets, follow-up debt with ages, meetings attended, allocation history) into 1:1 talking points. Visible to admins and the person themself.
6. **Meeting agenda draft** (`meeting.agenda`, ANALYSIS) — in MeetingForm / meeting page pre-start: draft agenda from open carried-forward follow-ups of invited attendees, the app's active sprint state, and the previous meeting's AI summary. Editable text, never auto-saved.
7. **Sprint check-in note draft** (`sprint.checkin-draft`, QUICK) — in sprint-checkin-editor: draft the note from the board delta since the last check-in (moved/done/new tasks) + GapHint numbers. Self-only, same as worklog drafting.
8. **Admin team-week rollup** (`worklog.team-rollup`, ANALYSIS, admin-only) — on /worklog TeamHistory: digest the week's team rows into per-person one-liners + anomaly flags (missing days, percent-vs-board gaps via `checkinGap`). Read-out only.
9. **Attendee recommender wiring** (`meeting.attendee-ai`, QUICK) — implement the missing `gemini-validator.ts` filling the A1 AI-relevance slot in `attendee-score.ts` (id-whitelisted, caveated), persist to the existing `meetingAttendeeRecommendations` table, surface tiers in MeetingForm attendee picker with reasons. `ctx.aiUnavailable` path already designed for the no-key case.
10. **Capacity/allocation advisor** (`capacity.advisor`, ANALYSIS, admin-only) — on people/history + capacity heat: "Suggest rebalance" produces observations (overloaded people, under-allocated apps, trend callouts) as text with linked names. Suggestions only; allocation edits stay manual.

## Explicitly out of scope

- Other providers (Groq/OpenRouter/Mistral) — revisit only if Gemini free tier becomes insufficient in practice.
- Embeddings/semantic search for ⌘K.
- Org-wide auto-pooling of unshared keys; any server-held org key.
- Real-time spend meters or hard budget caps (no API exists to make them honest).
- Automatic tier detection of keys.

---

# Cross-cutting

## Error handling
- Ledger insert failures: logged server-side, invisible to users, never retried in-request.
- Shared-key exhaustion mid-call: existing rotation continues to next key; if all (own + shared) fail, existing `ALL_KEYS_FAILED` copy extended to mention shared keys were tried.
- Pref-disabled feature reached server-side (stale client): typed error, copy "This AI feature is off in your Settings", never a crash.
- Missing `usageMetadata`: log zeros, count the call, never block.

## Testing
- `pricing.ts`: unit tests for promo-window resolution, unknown models, estimate math.
- Ledger: unit test the aggregate query (30-day window, per-feature grouping, caller vs owner attribution); integration test that a `callGemini` success and failure each produce exactly one row with the right slug.
- Key selection: unit test own-first-then-shared LRU ordering, unshare taking effect next call.
- Prefs: server action rejects when disabled; absent row = enabled.
- Feature waves: each new action gets the same treatment as existing ones (zod-validated output, id-whitelist tests where the model picks from lists, empty-input honesty tests like "Nothing to draft from yet").
- Existing enforcement tests (soft-delete, event colors) untouched.

## Rollout
1. Phase A (foundation) — one commit per unit: migrations, ledger + client wiring, pricing, sharing, tier, settings hub + key card copy.
2. Wave 1 — 4 features, each its own commit.
3. Wave 2 — 6 features, each its own commit.
Main worktree only; explicit-path staging (parallel RBAC session shares this tree); no stash, no `-A`.
