# Ask LogPup — knowledge index, graph and grounded answers

Date: 2026-09-06. Status: approved design, awaiting implementation plan.

## 1. Goal

"Ask LogPup for everything." One box that answers questions about the
workspace — people, projects, meetings, notes, follow-ups, tasks, worklogs,
absences, bugs — and, when asked, about the outside world; fast, cheap in
tokens, always returning *something* even without a Gemini key; and kept
current automatically as data is written.

Today's Ask (`src/features/intel/`) packs a fixed 8k-char snapshot of the
caller's own tasks, follow-ups and worklog gaps. It cannot answer "what did we
decide about X in the Alpha meeting last month" because nothing about the
question decides what is read. This design replaces the retrieval, keeps the
prompt discipline, and adds a knowledge index + entity graph under it.

### Decisions already made with the user

| Decision | Choice |
|---|---|
| Visibility | Inherit today's read rules. Index everything; every read is filtered by the capability matrix **and** meeting visibility. No new rule. |
| Graph | Internal entity graph drives retrieval **and** a visual map page. |
| Web | Gemini `google_search` tool on the caller's own BYOK keys. |
| Retrieval | **Hybrid.** FTS + graph always (works with no key anywhere); embeddings layered on when a key exists — at write time on the writer's own keys, at ask time on the asker's. |
| Embedding model | `gemini-embedding-2` (8,192-token input, auto-normalised 768-d, no `taskType`); `gemini-embedding-001` is the fallback if the catalog on a key lacks it. |
| Write-time embedding | Yes — writer's **own** keys only, one attempt, never touches `failCount`, gated by the writer's "Workspace index" switch, metered to the writer. |
| Web on free keys | Yes — per-**key** chain: paid key → 3.x `ASK_MODELS`; free key → `gemini-2.5-flash` (free grounding, 500 searches/day). |
| Background embedding on the shared paid key | Yes — `gemini_keys.allow_background` opt-in, rows shown as "background indexing" on the owner's Settings, never against their personal budget. |

### Non-goals

No thread/conversation table (localStorage stays). No new sidebar row. No
new npm dependency. No `updated_at` columns on source tables. No trigger
outbox. No drizzle-kit generate.

## 2. Architecture

```
write path                       ask path
----------                       --------
server action                    askWorkspace(question, web, history)
  └ logActivity(input)             ├ Promise.all:
      └ after(reindexFromActivity) │   seeds (TS, folded titles)
          ├ toDrafts() per kind    │   snapshot (loadWorkspaceSnapshot)
          ├ upsert nodes (seq-guarded)   FTS (dual-config tsv, OR-prefix query)
          └ embed changed chunks   │   vector (asker's key; skipped silently)
            on writer's own keys   ├ graph 1-hop (live FK joins)
                                   ├ fuse (weighted RRF) → reaches() post-check
explicit reindexEntity() at the    ├ packRanked (COMPUTED block + ranked nodes)
writers that bypass logActivity    ├ callGeminiGrounded (or retrieval-only)
                                   └ AskAnswer {mode, grounding, sources, related, …}
nightly (notify-tick step 4)
  reconcile every kind by source_hash → embed backlog on shared pool → sync state
```

Feature directory: `src/features/knowledge/` (index, retrieval, map, palette
wiring). `src/features/intel/` keeps the panel, prompt, chat history and the
`askWorkspace` action, which now calls into `knowledge/`.

## 3. Data model — migration `0071_knowledge_index`

Hand-written SQL + journal entry. Never `drizzle-kit generate`. Number
re-checked against every sibling worktree journal at commit time; `when` =
`1787158600000` (previous + 100000; must exceed the highest ledger
`created_at`). `--> statement-breakpoint` between statements, never inside a
comment. Every statement idempotent.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "knowledge_nodes" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind"            text NOT NULL,      -- person|app|meeting|note|followup|task|sprint|worklog|absence|bug|comment
  "entity_id"       text NOT NULL,      -- row id; worklog uses "<userId>:<day>"
  "chunk"           integer NOT NULL DEFAULT 0,
  "title"           text NOT NULL,
  "body"            text NOT NULL,      -- <= 3,000 chars, grapheme-safe cut
  "href"            text NOT NULL,      -- in-app route, must pass isInAppRoute
  "owner_id"        uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "app_ids"         uuid[] NOT NULL DEFAULT '{}',
  "meeting_id"      uuid REFERENCES "meetings"("id") ON DELETE CASCADE,   -- meeting family only
  "app_id"          uuid REFERENCES "apps"("id") ON DELETE CASCADE,       -- task/sprint/bug/comment only
  "occurred_at"     timestamptz,
  "status"          text,               -- task/followup/bug status prior
  "tsv"             tsvector GENERATED ALWAYS AS (
                      setweight(to_tsvector('simple',  fold(title)), 'A') ||
                      setweight(to_tsvector('english', fold(title)), 'A') ||
                      setweight(to_tsvector('simple',  fold(body)),  'B') ||
                      setweight(to_tsvector('english', fold(body)),  'B')) STORED,
  "embedding"       vector(768),
  "embedding_model" text,
  "embedded_at"     timestamptz,
  "source_hash"     text NOT NULL,      -- hash(CHUNKER_VERSION, title, body) — gates embedding only
  "source_seq"      bigint NOT NULL,    -- Date.now() captured in logActivity / cron ranAt; last-writer guard
  "updated_at"      timestamptz NOT NULL DEFAULT now(),
  "deleted_at"      timestamptz,
  UNIQUE ("kind", "entity_id", "chunk")
);
```

`fold(x)` is spelled inline as
`lower(replace(replace(normalize(x, NFC), chr(8205), ''), chr(8204), ''))` —
`normalize`, `replace`, `lower` are `provolatile = 'i'` on Neon (verified), so
the expression is legal in a generated column. The same fold lives in
`src/features/knowledge/fold.ts` for the question side; a fixture test
mirrors the SQL so the two cannot drift. `'english'` leaves Sinhala tokens
whole (verified on the dev DB) and stems Latin ones; `'simple'` keeps exact
forms for prefix matching.

Indexes: GIN on `tsv`; HNSW `vector_cosine_ops` partial `WHERE embedding IS
NOT NULL AND deleted_at IS NULL`; GIN on `app_ids`; btree
`(kind, entity_id)`; partial btree `(kind) WHERE deleted_at IS NULL AND chunk
= 0` (seed and map scans); btree `(meeting_id)`, `(owner_id)`.

```sql
CREATE TABLE IF NOT EXISTS "knowledge_sync_state" (
  "kind"           text PRIMARY KEY,     -- one row per node kind, plus 'embed'
  "reconciled_at"  timestamptz,
  "upserted"       integer NOT NULL DEFAULT 0,
  "tombstoned"     integer NOT NULL DEFAULT 0,
  "purged"         integer NOT NULL DEFAULT 0,
  "pending_embed"  integer NOT NULL DEFAULT 0,
  "last_429_at"    timestamptz,
  "last_error"     text,
  "updated_at"     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "ai_usage_events" ADD COLUMN IF NOT EXISTS "grounded_queries" integer;
ALTER TABLE "ai_usage_events" ADD COLUMN IF NOT EXISTS "initiated_by" text;      -- NULL = user, 'system' = cron
ALTER TABLE "gemini_keys"     ADD COLUMN IF NOT EXISTS "allow_background" boolean NOT NULL DEFAULT false;
```

No `knowledge_edges` table. Every relation (attended, owns, assigned_to,
about_app, in_meeting, in_sprint, reported) is a live FK join on `live_*`
views, so edges cannot drift and the migration stays small.

`schema.ts` declares `knowledgeNodes` (`tsv` via `customType` +
`generatedAlwaysAs`; `embedding` via `customType` for `vector(768)`),
`knowledgeSyncState`, the two `aiUsageEvents` columns and
`geminiKeys.allowBackground` **in the same commit as the SQL**, and the user
runs `npm run db:migrate` before that commit reaches main — a declared column
without its applied migration is a live outage on the shared dev DB.
`src/db/live.ts` gains `liveKnowledgeNodesAs`/`liveKnowledgeNodes` and a
`SOFT_TABLES` entry; `knowledgeNodeColumns` (no `tsv`, no `embedding`) is
the read list for every drizzle-built select. `schema-drift` compares column
names only, so the generated and vector columns pass.

## 4. Indexing

### 4.1 Drafts

`src/features/knowledge/indexers/<kind>.ts` exports a pure
`toDrafts(rows): NodeDraft[]`. Rows come from `live*` views only.

| kind | entity_id | chunk 0 | chunks 1..n | owner_id | app_ids | cascade col | occurred_at |
|---|---|---|---|---|---|---|---|
| person | user id | name + aliases + role + employment | — | self | current assignments | — | — |
| app | app id | name + aliases + description + techTags | — | pm | self | app_id=self | last activity |
| meeting | meeting id | title + AI summary (deadlines, perPerson, terms flattened); fallback first ~1k chars of segments | grapheme-safe segment groups ≤3k chars, speaker names resolved (users.name via speaker_id, else display_name) | creator | meeting_apps | meeting_id=self | starts_at |
| note | segment id | one typed/voice segment with speaker | — | author | inherits meeting | meeting_id | segment created |
| followup | followup id | text + status + due | — | assignee | inherits meeting | meeting_id | due, else created |
| task | task id | title + `status: … · due … · overdue N days · due moved Nx` + assignees | — | first assignee | app | app_id | created (Colombo) |
| sprint | sprint id | name + dates + open/total | — | — | app | app_id | end date |
| worklog | `<userId>:<day>` | daily percent + score source + note + each entry (app, minutes, note) | — | user | entries' apps | — | day |
| absence | absence id | kind label + range + status | — | user | — | — | from |
| bug | bug id | title + body + severity + status | — | reporter | app | app_id | created |
| comment | comment id | body + author | — | author | app | app_id | created |

Meeting-family drafts carry `meeting_id` so retrieval can join
`liveMeetings`. Body cuts are grapheme-safe (`\p{M}`-aware, per
`prompt-truncate.ts`); `CHUNKER_VERSION` is part of `source_hash` so a chunker
change re-embeds. A Sinhala test case pins the cut.

### 4.2 Reindex

`src/features/knowledge/reindex.ts`:

- `reindexFromActivity(input: ActivityInput)` — resolver table `AFFECTED`
  `satisfies Record<ActivityEntityType, (i) => Target[]>`, so a new entity type
  fails `tsc`. Worklog resolves from `metadata.day`; assignment resolves
  person + app from `metadata.userId/appId` (added at the three assignment
  sites, never parsed from `pagePath`); `change_request` from
  `metadata.targetType/targetId`; handover → leaver + successors + apps +
  reassigned tasks. Verb decides the op: `purged` → hard-delete nodes;
  `deleted` → tombstone subtree (no source read); anything else → rebuild.
- `reindexEntity(kind, entityId, { actorId, seq })` — one `db.batch` of reads,
  `toDrafts`, then one batch: multi-row `INSERT … ON CONFLICT (kind,
  entity_id, chunk) DO UPDATE SET … WHERE knowledge_nodes.source_seq <=
  excluded.source_seq`, chunk trim `DELETE … WHERE chunk >= n AND source_seq
  <= $seq`, `deleted_at = NULL` on rebuild. Round trips are constant in
  segment count. Content hash gates embedding only; ACL columns, `href`,
  `occurred_at`, `status` are always rewritten. Never throws.
- Embedding inside reindex: `callGeminiEmbed(actorId, changedChunks, {
  keyPolicy: 'own-only', maxAttempts: 1, countKeyFailures: false,
  ledgerFailures: false })`, at most `EMBED_CHUNKS_PER_REINDEX` (16) per
  invocation, only when `isAiFeatureEnabled(actorId, 'knowledge-index')` and
  the actor holds an active key. Anything left stays `embedding IS NULL` for
  the tick.

### 4.3 Hook and explicit calls

`logActivity()` gains, after its own try/catch:

```ts
const run = () => reindexFromActivity(input).catch((e) => console.error('[knowledge] reindex failed', e))
try { after(run) } catch { void run() }   // E468 outside a request scope (scripts, vitest)
```

`logActivity` is **not** the single choke point — verified: meeting AI
analysis, speaker mapping, follow-up assignment, handover, change-request
approval, worklog entry edits, sprint actions and auto-score sync never call
it. Each gets an explicit `after(() => reindexEntity(...))`:
`finalizeMeetingRecordingInner` tail (covers audio, live-transcript and
finalize paths), the shared speaker-backfill helper, `assignFollowupPerson`,
`writeOpenFollowupNote`, `applyHandover` (after its batch), `approveChangeRequest`,
`updateWorklogEntry`, `setDayNote`, the four sprint actions, `quickAssignTask`,
`submitOnboarding`, `syncAutoScore`/`backfillAutoScores`. A source-scan test
(`src/features/knowledge/hooks.test.ts`, live.test.ts shape) fails any file
under `src/features` that inserts/updates an indexed table without
referencing `logActivity` or `reindexEntity`, and any file inserting
`activityLog` directly outside `activity/log.ts` without a reindex call.

Accepted: `after()` runs once the response is sent, so an Ask issued within
~1s of a write reads the pre-write index.

### 4.4 Nightly reconcile — `notify-tick` step 4

Vercel Hobby allows two crons; `vercel.json` already has both. Knowledge sync
is the fourth ordered step of `src/app/api/cron/notify-tick/route.ts`
(after `backfillAutoScores`), own try/catch, reported as `knowledge`, header
comment rewritten to four steps. `maxDuration` stays 60. Budget:
`KNOWLEDGE_STEP_BUDGET_MS = 30_000` wall-clock, checked before each unit.

`src/features/knowledge/sync.ts` → `runKnowledgeSync(ranAt, deadlineMs)`:

1. **Reconcile per kind** (smallest kinds first): read all live rows →
   `toDrafts` → `source_hash`; read `(kind, entity_id, chunk, source_hash,
   deleted_at, owner_id, app_ids, meeting_id, status, occurred_at)`; pure
   `planReconcile(existing, drafts)` yields upserts (content hash differs OR
   any of those ACL/ranking columns differ — an app removed from a meeting
   must stop granting reach that night, not when the body next changes),
   tombstones (raw row soft-deleted), hard deletes (raw row gone),
   restores (`deleted_at` cleared), chunk trims. One raw-table probe per kind
   tells trashed from purged — `sync.ts` is the ONE allowlisted raw reader.
   Idempotent: a second run on an unchanged workspace plans nothing. This is
   the correctness guarantee; the hooks are a latency optimisation. Backfill =
   reconcile against an empty table.
2. **Embed backlog**: rows `WHERE (embedding IS NULL OR embedding_model <>
   KNOWLEDGE_EMBED.model) AND deleted_at IS NULL AND updated_at < ranAt - 30s`,
   batched by estimated tokens (`EMBED_BATCH_MAX_EST_TOKENS = 20_000`), at
   most 8 batches per tick. `callGeminiEmbed(keyOwnerId, texts, { keyPolicy:
   'shared-pool', initiatedBy: 'system' })`; owners skipped when their
   `knowledge-index` switch is off or `budgetLadderStep(readAiBudget(owner))`
   is non-null. **First 429 ends the step** (no backoff — it would burn the
   60s and the quota being protected).
3. **State**: upsert `knowledge_sync_state`; the panel shows "index refreshed
   <relative>".

Free-tier note: embedding quota is per model, so the tick competes only with
the embedding model's bucket, not the morning's flash quota.

### 4.5 Backfill script

`scripts/knowledge-backfill.ts`, `npm run knowledge:backfill [--embed]
[--kind meeting] [--limit 500]`, same `--env-file-if-exists --import tsx`
loader as `db:drift`. Calls `reconcileKind`/`runKnowledgeSync` directly with
an infinite deadline; `--embed` uses the runner's own keys (`keyPolicy:
'own-only'`). Never calls `logActivity`. Run by the user after
`db:migrate`.

### 4.6 Purge and trash

- Hard purges cascade through the FK columns: purging a meeting removes its
  meeting/note/followup nodes in the same statement; purging an app removes
  task/sprint/bug/comment nodes (meetings survive an app purge today, hence no
  `app_id` on meeting nodes). `purgeKnowledgeNodes(kind, id)` is called from
  the per-entity purge path via the `purged` verb; nightly anti-join is the
  backstop.
- Trash mirror: verb `deleted` tombstones the subtree
  (`UPDATE … SET deleted_at = now() WHERE (kind, entity_id) = root OR
  meeting_id = root OR app_id = root`); `restored` rebuilds. App
  archive changes nothing.
- `live.test.ts`: `DELETE_ALLOWED_FUNCTIONS` += `reindex.ts:
  ['trimChunks', 'purgeKnowledgeNodes']`, `sync.ts: ['purgeOrphans']`;
  `ALLOWLIST` += `sync.ts` (raw probe). Retrieval always filters
  `deleted_at IS NULL`.

## 5. Retrieval

`src/features/knowledge/retrieval.ts` + pure helpers. Per question:

1. **Fold + tokenise** (`fold.ts`, `query.ts`): `foldSearch(q)`; tokens =
   `[\p{L}\p{M}\p{N}]+` runs; drop `STOPLIST` (English function/question
   words + Sinhala particles ද/සහ/ගැන/මොනවද/කවුද/එක/එකක්/හරි/මේ/ඒක/අපි…,
   seeded from `ts_stat` on the dev DB, exported from one module that
   `meetings/followups.ts` also imports) and 1-char tokens.
2. **Date window** (`window.ts`): `today/yesterday/this|last week|month`,
   month names, `අද/ඊයේ/පසුගිය|ගිය සතියේ|මාසේ`, resolved in Asia/Colombo →
   `occurred_at BETWEEN`; tokens stripped; the resolved window is printed in
   the FACTS header.
3. **Seeds** (`seeds.ts`, TypeScript, no `pg_trgm`): titles of
   person/app/sprint/meeting chunk-0 nodes (~120 rows, cached 60s). Apps via
   `matchApps` from `apps/app-aliases.ts` (aliases, acronyms, unique prefixes,
   bounded typos, refuses ambiguity). People on any name token ≥4 chars or
   stored alias; all homonyms seed. Sprints/meetings on non-noise token
   coverage ≥0.6 with a digit guard (a title with a number seeds only when
   that exact number is in the question). Cap 5, order person > app >
   sprint > meeting. Pinned by a test table built from the real dev titles.
4. **Reach** (`acl.ts`): `ACL_ACTION: Record<Kind, Action>` — app/task/sprint/
   comment → `app.view` (what the ⌘K providers use), bug → `bug.view`, person →
   `user.view.detail`, worklog → `worklog.view`, absence → `absence.view`.
   `kindReach(actor)` buckets those kinds into all/scoped/own via
   `effectiveGrant`; none-kinds omitted; scoped with empty scope collapses to
   own; nothing reachable → skip the query.

   The **meeting family** (meeting/note/followup) never uses the
   `app_ids && scope` arm — that would hand every assigned member and client
   stakeholder the transcript of meetings they were not invited to. It
   mirrors the two live gates exactly: `meetingVisibleTo(actor.id)` (joined
   on `liveMeetings`, applied to every seat, admins included) AND the intel
   rule from `decideIntelReadable` — `effectiveGrant(meeting.intel.view) ===
   'all'` OR `owner_id = me` OR `me` is an attendee OR `app_ids` intersects
   `managedAppIds(me)` (free-text PM/lead roles via `managesApp`, resolved
   once per ask beside `loadActor`). Followup adds `owner_id = me`
   (assignee). Note/followup nodes inherit their meeting's `meeting_id`,
   `app_ids` and owner arms at index time and re-inherit on every meeting
   reindex.

   `reaches(actor, node, ctx)` is the pure post-check mirroring the SQL;
   both are tested for agreement over role × employment × kind × ownership
   fixtures, including: attendees-only meeting invisible to a non-attendee
   superadmin; attendee not assigned to the meeting's app still reaches it;
   scoped member not on the meeting does not reach its notes.
5. **Candidates**, one `Promise.all`:
   - FTS: `tsv @@ websearch_to_tsquery('simple', tokens joined ' OR ')` OR the
     `'english'` form, prefix (`tok:*`) on tokens ≥3 graphemes Latin / ≥2
     Sinhala; score `ts_rank(tsv, q, 1)` × per-kind freshness (tasks/followups/
     bugs: open 1.0, done 0.4, no decay; meetings/notes: 45-day half-life on
     `occurred_at`; worklog/absence: 14-day); limit 60.
   - Vector (asker has a key): `callGeminiEmbed(asker, [q], { keyPolicy:
     'own-only', maxAttempts: 1 })` → `embedding <=> $v`, `SET LOCAL
     hnsw.ef_search = 100`, iterative scan for scoped seats, limit 60. Any
     failure → list absent, silently.
   - Graph: 1-hop from seeds via live joins (`meeting_attendees`,
     `meeting_apps`, `assignments`, `tasks.assignee`/`task_assignees`,
     `bug_reports.reporter`), ordered `occurred_at DESC`, round-robin across
     relation, cap 40, same reach predicate.
   - Snapshot: `loadWorkspaceSnapshot` (existing) runs in the same batch.
   - Structural listing: when intent ∈ {summarise, list, show, what happened}
     **and** a window **and** a seed resolved, list chunk-0 nodes in the
     window linked to the seed, ordered by date, cap 25, with "(N more in this
     window)" so coverage is stated.
6. **Fuse** (`fuse.ts`): weighted RRF (FTS 1.0, vector 1.0, graph 0.5,
   structural 1.0); dedupe by `(kind, entity_id)` keeping the best chunk;
   per-kind caps before the cut (≤4 worklog, ≤6 note); ≤3 slots reserved for
   recent graph neighbours when seeds exist; `reaches()` post-check; top 14
   (25 for structural listings).
7. **Pack** (`pack.ts`): a fixed, never-truncated COMPUTED block (~700 chars
   from `signalInput`: capacities ≥100%, running sprints open/total + end,
   overdue count + oldest, follow-ups owed, worklog gap days, quiet apps),
   then `packRanked(nodes, 6_000 - computed, perNodeChars)` in fused order,
   one line per node `  - <kind> · <title> · <date> · <excerpt> [<route>]`,
   newlines folded, truncating from the ranked tail. `sourcesFromGrounding`
   still parses the citation block; the ranked list is returned directly as
   `sources` (cap 14, not 6).

Budget: ~2.2k input tokens, ≤600 output. Target < 5s on flash. Related chips
come from the graph neighbour set ordered by date (≤8).

## 6. Answer

`askWorkspace` keeps its name and file. Input:
`{ question (3..500), web: boolean = false, history: {q ≤300, a ≤500}[] ≤2 }`,
history server-truncated grapheme-safe to ≤800 chars total, rendered inside a
new `<<<HISTORY … HISTORY>>>` fence through `defence()` — **never** as
`role:'model'` contents. `HISTORY_OPEN/CLOSE` join `FENCES` and
`prompt.test.ts`. `SHARED_RULES` says HISTORY is prior conversation, not fact.

Ladder, in order, every rung returning `ok()`:

| condition | mode | reason line |
|---|---|---|
| feature off in Settings | retrieval-only | "AI is off in your Settings — here is what matched, ranked" |
| no active key | retrieval-only | "No Gemini key on this account — here is what matched, ranked" |
| `GeminiError` | retrieval-only | the error message verbatim (never silently degraded) |
| embed failed / no vector list | ai | — (hybrid falls back to FTS + graph) |
| key + vector | ai | — |

Retrieval runs before the feature-off/no-key decision; that decision only
gates the model call. `askAvailable()` returns `{ retrieval, ai, web }`.

Result:

```ts
type AskAnswer = {
  mode: 'ai' | 'retrieval-only'
  answer: string | null; model: string | null
  citations: AskCitation[]                 // in-app, as today
  grounded: boolean                        // kept for chat-history v1; alias of grounding !== 'none'
  grounding: 'workspace' | 'web' | 'both' | 'none'   // derived from data, never model text
  sources: AskSource[]                     // ranked list, ≤14
  related: AskSource[]                     // graph neighbours, ≤8, with focus key "kind:id"
  searched: string[]                       // groundingMetadata.webSearchQueries
  webSources: { title: string; url: string }[]
  searchSuggestions: string | null         // searchEntryPoint.renderedContent, verbatim
  webUnavailable: boolean                  // tool refused on this key; answered without web
  reason: string | null
}
```

**Web.** Two prompt builders: `buildAskPrompt` (unchanged rules, workspace
only) and `buildAskWebPrompt` (drops "you have no other knowledge"; facts
first; web only for what the facts cannot answer; never put a person, app,
task, meeting or sprint name from FACTS into a search; say when a sentence
came from the web). Chain chosen per key inside the rotation: `tier ===
'paid'` → `ASK_MODELS`, else `ASK_WEB_FREE_MODELS = ['gemini-2.5-flash',
'gemini-2.5-flash-lite']`. Tool refusal (first 400/403/429 on a key+model
with tools) → immediate re-issue of the same pair without tools; no
`failCount`, no failure ledger row; `webUnavailable = true`. Rendering
follows Google's terms: `searchEntryPoint.renderedContent` verbatim in a
sandboxed `<iframe srcdoc>` directly under the answer, web links unmodified
in a separate "From the web" row (never through `splitAnswerLinks`), neither
persisted to localStorage; `searched[]` shown as plain text (privacy
footprint) and may be persisted. `grounded_queries` on the ledger row prices
web per search query (3.x rate; 2.5 rows stay unpriced, never $0).

## 7. Keys, metering, registry

- `src/features/gemini/ai-features.ts`: `AiCallSlug` += `'knowledge.embed'`;
  `FeatureKind` += `'embed'`; chain label `'Index'`; feature row
  `knowledge-index` ("Workspace index", kind `embed`, slugs
  `['knowledge.embed']`, estimate `{ model: KNOWLEDGE_EMBED.model,
  inputTokens: 500, outputTokens: 0 }`, label "per indexed change"); the
  switch is the person's opt-out for their key (write-time and, for owners,
  nightly). `workspace-ask` estimate → 2,200 / 600, comment rewritten;
  registry label → "Ask LogPup". `FALLBACK_MODEL_CHOICES.embed` lists the
  embedding models; `classifyModel` returns `'embed'` for `embedContent`
  models; catalog literal gains `embed: []`; `ai-features-card` renders no
  picker for `embed`; `setAiFeatureModel` rejects models for that kind.
- `models.ts`: `ASK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']`,
  `ASK_WEB_FREE_MODELS`, `KNOWLEDGE_EMBED = { model: 'gemini-embedding-2',
  fallback: 'gemini-embedding-001', dims: 768 }`, `EMBED_MODELS`.
  `model-choice.ts` `DEFAULT_CHAIN`: `'workspace-ask': ASK_MODELS`,
  `'knowledge-index': EMBED_MODELS`. `callGeminiEmbed` pins the embed chain,
  never reads `userAiPrefs.model`, honours `enabled`.
- `pricing.ts`: rows for both embedding models (input-only), `GROUNDING_PRICE`
  keyed by model (3.x per query; 2.5 → `null`), `estimateCostUsd(…,
  groundedQueries)`. `pricing.test.ts` CHAINS gains the three new chains.
- `client.ts`: `CoreOptions { keyPolicy: 'caller' | 'own-only' |
  'shared-pool'; initiatedBy: 'user' | 'system'; maxAttempts;
  countKeyFailures; ledgerFailures }`. `shared-pool` = `active AND shared AND
  (tier = 'free' OR allow_background)`, LRU only; `system` skips the
  `OVER_BUDGET` door (per-tick caps govern) and is stamped on the row.
  `callGemini` opts gain `tools`, `systemInstruction`; `callGeminiGrounded`
  returns `{ text, model, grounding, groundedQueries }`; `callGeminiEmbed`
  hits `models/<m>:batchEmbedContents` with `outputDimensionality: 768`, on
  400 halves the batch once then returns `null`s, on 429/503 returns `null`s.
  `ModelAttemptResult.kind` += `'tool-refused'`.
- `usage.ts` / `budget-queries.ts` / `usage-summary.ts`: `groundedQueries`,
  `initiatedBy` on the input; embed rows use `usageMetadata.promptTokenCount`
  when present else the char estimate (Sinhala ≈1 token/char, Latin /4) so a
  priced row is never $0; `readAiBudget`, `notifyBudgetThreshold` and
  `paidChargeUsd` exclude `initiated_by = 'system'`; Settings shows
  "Background indexing (shared key)" and "web searches" lines.
- Profile → Gemini keys: shared keys owned by the viewer get a "Use for
  background indexing" switch (`allow_background`), off by default. The
  user opts the paid shared key in there.
- No new env vars.

## 8. UI

- **Ask panel** (`intel/components/ask-panel.tsx`): Web switch left of the
  Kbd row, rendered when `ask.web`, default off, remembered in
  `logpup.intel.askWeb.v1` (tolerant localStorage, `useSyncExternalStore`),
  helper copy states the tier fact in English + `lang="si"` Sinhala.
  AnswerBody order: prose (`bilingualText`), citation chips, `<AnswerWeb>`
  (From the web row, Search Suggestions iframe, Searched footprint — the
  ONLY component rendering off-site links), Related chips + "Map" chip
  (`usePrefetchIntent`), footer switched on `(mode, grounding, webUnavailable)`.
  Retrieval-only turn: reason line, ordered source list (kind icon, title
  link, kind label en/si, date), related chips; zero sources → inline
  empty state "Nothing matched / කිසිවක් ගැළපුණේ නැහැ" with "Open map".
  Loading: skeleton lines + chip rows, live region "Answer ready" / "Matches
  ready". Error: unchanged `role="alert"` block; tool refusal is not an error.
- **Chat history**: `CHAT_KEY` stays v1; `isTurn` widened (`mode` default
  `'ai'`, `answer`/`model` nullable, `grounding` derived from `grounded` when
  absent); `webSources`/`searchSuggestions` never written.
- **Bubble / layout / palette**: `AskBubble` prop `ask: {retrieval, ai, web}`;
  the Ask half shows for every signed-in seat; palette fallback row reads
  "Ask about “q”" when `ai`, else "Look through notes for “q”".
- **Map** `/map?focus=kind:id` (`src/app/(app)/map/page.tsx` +
  `loading.tsx`), not in `navItems`; reached from palette command
  `knowledge.map` ("Workspace map", keywords incl. සිතියම), the answer's Map
  chip, and small ghost "Map" buttons on `/people/<id>` and `/apps/<slug>`
  headers. Server: `getKnowledgeMap(focus)` → BFS 2 hops over live joins,
  hop-1 by date, cap 80, `reaches()` + meeting visibility per node, edges
  kept only when both ends survive, `truncated` count. Client: pure
  deterministic force layout (`layout.ts`, radial start by hop, 120
  iterations inside `useMemo`, tested for determinism/bounds/no overlap), SVG
  `aria-hidden`, pan/zoom (0.5–2.5) + Fit, click refocuses (positions
  preserved for surviving nodes), side panel shows kind/title/date/relation
  with Open, "Ask about this" (prefills the bubble), Focus here; legend when
  nothing selected; sr-only node list grouped by hop for keyboard users.
  States: skeleton page, `aria-busy` refetch, empty ("Nothing links here
  yet"), `notFound()` for unreachable focus, `RegionError` with Retry,
  truncation line.
- **⌘K**: `knowledge/search-providers.ts` (id `knowledge`, rank 70) covers
  note/followup/comment/worklog only, shared query builder, reach predicate
  + literal `meetingVisibleTo` join, hits kind `'note'` (new `PaletteRecent`
  type + `KIND_META.note`). `knowledge/commands.ts` adds the map row.
- **Six API skills**: dedupe — `getKnowledgeMap` 30s deduper by focus, not
  `askWorkspace` (metered spend); optimistic — map refocus flips immediately
  with rollback on error; streaming — no (≤600 tokens, trailing citation
  block); SWR — map deduper only; polling — none; preloading — chips and the
  Map chip carry prefetch-intent.
- **Bilingual**: English label + `<span lang="si">` (repo precedent); prose
  containers use `bilingualText`; label cuts via `truncateAtWordBoundary`.

## 9. Testing

Pure planner + thin runner everywhere; DB-touching runners use the repo's
`vi.mock('@/db')` chainable fake; SQL shapes asserted connection-free via
`QueryBuilder().toSQL()`. Tests are written red first; the `it()` names are
the spec.

Pure: `chunk.test.ts` (Sinhala 3k segment cuts, grapheme-safe, hash changes
on `CHUNKER_VERSION`/speaker name, stable on ACL rewrites), `fold.test.ts`
(SQL-mirroring fixture table), `query.test.ts` (four questions incl.
code-switched; no stoplist tokens; OR-joined; digits kept; all-stopword →
null; nasty punctuation never throws), `window.test.ts`, `seeds.test.ts`
(real dev titles: SLH Web vs SLH Mobile, Sprint 13/14, first names, Sinhala
name), `acl.test.ts` (`ACL_ACTION` ⊆ `ROLE_GRANTS` keys; every kind in exactly
one bucket; `reaches` ≡ SQL over role × employment × kind × ownership;
attendees-only meeting invisible to a non-attendee superadmin; attendee not
on the app still reaches), `retrieval-sql.test.ts` (rendered WHERE per
bucket; visibility arm for every seat; one `candidateWhere`, four callers;
seq guard on every reindex statement), `fuse.test.ts`, `pack.test.ts`
(COMPUTED never truncated; `sourcesFromGrounding` parses every line),
`reindex-map.test.ts` (exhaustiveness by `satisfies`; worklog/assignment/
change_request/handover resolvers; verb ops), `sync-plan.test.ts`
(idempotence; tombstone vs purge vs restore; chunk shrink), one indexer test
per kind, `embed-budget.test.ts`, `grounding.test.ts` (extractor +
discriminant), extensions to `prompt.test.ts` (HISTORY fence; web prompt
lacks the ONLY line and has the no-names rule; injected bodies inert),
`answer-links.test.ts`, `chat-history.test.ts`, `ai-features.test.ts`,
`pricing.test.ts`, `model-choice.test.ts`, `model-catalog.test.ts`,
`usage-summary.test.ts`, `layout.test.ts`.

Mocked-db: `activity/log.test.ts` (whole input to hook; E468 fallback;
reindex rejection swallowed), `reindex.test.ts` (round-trip count; never
throws; never touches `failCount`), `sync.test.ts` (one read per kind; empty
table = backfill; deadline; first 429 ends embeds; system rows), `gemini/
client-tools.test.ts` (tool-refused path; per-key web chain; shared-pool
filter; embed 429 → null), `intel/actions.test.ts` (ladder rungs return
`ok()`; history truncation; web gate), `budget-queries.test.ts`.

Scans: `live.test.ts` (twelve soft tables; allowlist + delete allow-list
entries), `visibility.test.ts` (indexer allowlisted with the true reason;
`retrieval.ts` passes on merit), `registry.test.ts`, new `hooks.test.ts`,
`cascade.test.ts` (every `PURGE_BY_KIND` kind has a cascade column or a
`purged` resolver).

Manual checklist (needs Neon or Gemini; recorded in the PR): migration
applied and verified via `information_schema` (extension, generated column,
HNSW, partial indexes; `db:status`/`db:drift` clean); fold functions
immutable; FTS probes for the four questions; embedding-2 availability on
each key via the catalog, 768-d vectors, `usageMetadata` presence; grounding
on a free key (2.5) and a paid key (3.x), refusal shape, widget renders in
the iframe, refusal leaves `fail_count` untouched; cron tick under 60s,
second tick zero writes; backfill counts match live counts, rerun = 0
writes, edit/trash/purge/restore propagate; two-browser ACL check
(non-attendee superadmin, scoped member, auditor, stakeholder); ladder in
the bubble for keyless / feature-off / busy; Settings lines; after() lag;
two-tab concurrency.

Playwright: extend `e2e/smoke.spec.ts` with the single-admin path (create
app + meeting, wait for the node, ask, citation chip links, trash → chip
gone).

## 10. Phasing

1. **Foundation** — migration + schema + live.ts; `fold`, `chunk`, indexers,
   `reindex`, `sync`, hook + explicit calls, backfill script, registry/
   pricing/client extensions, cron step 4. Ships dark (nothing reads it).
2. **Ask** — retrieval (`query`, `window`, `seeds`, `acl`, `fuse`, `pack`),
   `askWorkspace` rewrite, ladder, history fence, web (per-key chain, tool
   refusal, `AnswerWeb`), panel + bubble + palette availability.
3. **Graph surfaces** — map page, related chips, ⌘K knowledge provider and
   command, header Map buttons.

Each phase lands with its tests and scans green, `tsc` and `vitest` exit
codes read directly.
