# Node Description Batch 31 of 166

Graphify is running in assistant/skill mode (no API key). You are the host
assistant (Claude Code / Codex / Gemini CLI). Read the prompt below and write
your JSON answer to the answer file.

## Prompt

You are documenting nodes in a knowledge graph.
For each entry below, write ONE concise factual plain-language sentence
describing what it is or does. Use only the provided context.
For a code symbol (kind=code-symbol — a function, class, or constant),
describe what the function/symbol does based on its name, source location
and neighbors — e.g. "Resolves the configured ontology profile from graphify.yaml.".
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "components_meeting_notes_model_parsespokenduedate": "parseSpokenDueDate()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L51 | neighbors=[meeting-notes-dialog.tsx, meeting-notes-model.ts, DueStatus, meeting-notes-model.test.ts, note-timeline-model.ts, ai-actions.ts]
- "components_meeting_panels_model_splitbilingualsummary": "splitBilingualSummary()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L209 | neighbors=[meeting-notes.tsx, meeting-notes-dialog.tsx, meeting-panels-model.ts, isSinhalaBlock(), meeting-panels-model.test.ts, page.tsx]
- "components_meeting_panels_panel": "Panel()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L353 | neighbors=[meeting-intel.tsx, meeting-notes.tsx, meeting-panels.tsx, kindAccentClass(), usePanels(), next-meeting-card.tsx]
- "components_month_summary": "month-summary.tsx" | kind=code-symbol | source=src/features/worklog/components/month-summary.tsx:L1 | neighbors=[89dee50 fix(ui): craft regressions the …, MonthSummary(), num(), utils.ts, cn(), page.tsx]
- "components_note_timeline_model_test": "note-timeline-model.test.ts" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.test.ts:L1 | neighbors=[note-timeline-model.ts, buildSuggestionUpdatePayload(), buildTaskUpdatePayload(), classifyDueDateInput(), findDueDateHint(), resolveActionItemEditTarget()]
- "components_sign_in_backdrop": "sign-in-backdrop.tsx" | kind=code-symbol | source=src/features/auth/components/sign-in-backdrop.tsx:L1 | neighbors=[3e3e1f7 fix(sign-in): restore the ring …, d0da911 test(gemini): a public page may…, RINGS, RingVars, SignInBackdrop(), page.tsx]
- "db_live_livebugreports": "liveBugReports" | kind=code-symbol | source=src/db/live.ts:L45 | neighbors=[queries.ts, queue-page.ts, queue-page.test.ts, search-providers.ts, live.ts, notify.ts]
- "db_schema_geminikeys": "geminiKeys" | kind=code-symbol | source=src/db/schema.ts:L947 | neighbors=[schema.ts, actions.ts, client.ts, meter-actions.ts, model-discovery.ts, queries.ts]
- "db_schema_meetingtasksuggestions": "meetingTaskSuggestions" | kind=code-symbol | source=src/db/schema.ts:L1327 | neighbors=[schema.ts, gather.ts, ai-actions.ts, ai-actions.test.ts, assistant-actions.ts, text-replace-actions.ts]
- "db_schema_notifications": "notifications" | kind=code-symbol | source=src/db/schema.ts:L1126 | neighbors=[schema.ts, write-gate.test.ts, actions.ts, notify.ts, queries.ts, route.ts]
- "drizzle_0000_complete_adam_warlock_public_users": "public.users" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L82 | neighbors=[0000_complete_adam_warlock.sql, apps, assignments, meeting_attendees, meetings, tasks]
- "drizzle_0038_rbac_tables_public_users": "public.users" | kind=code-symbol | source=drizzle/0038_rbac_tables.sql:L104 | neighbors=[0038_rbac_tables.sql, absences, app_grants, change_requests, org_holidays, work_schedules]
- "drizzle_0048_project_finance": "0048_project_finance.sql" | kind=code-symbol | source=drizzle/0048_project_finance.sql:L1 | neighbors=[85c3961 feat(finance): cost and worth d…, person_rates, project_value, public.apps, public.users, rate_cards]
- "finance_cost_subscriptionaccrued": "subscriptionAccrued()" | kind=code-symbol | source=src/features/finance/cost.ts:L419 | neighbors=[cost.ts, addMonthsIso(), roundMoney(), toAmount(), cost.test.ts, queries.ts]
- "finance_rate_actions_unexpected": "unexpected()" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L55 | neighbors=[rate-actions.ts, closePersonRate(), closeRoleRate(), setPersonRate(), setProjectValue(), setRoleRate()]
- "gemini_ai_features_fallback_model_choices": "FALLBACK_MODEL_CHOICES" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L433 | neighbors=[ai-model-select.tsx, ai-engine.ts, advertised-models.test.ts, ai-features.ts, ai-features.test.ts, model-discovery.ts]
- "gemini_ai_features_featurekind": "FeatureKind" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L35 | neighbors=[ai-features-card.tsx, ai-model-select.tsx, ai-features.ts, ai-features.test.ts, model-catalog.ts, model-discovery.ts]
- "gemini_client_callgeminicore": "callGeminiCore()" | kind=code-symbol | source=src/features/gemini/client.ts:L350 | neighbors=[client.ts, callGemini(), callModelWithRetry(), GeminiError, recordFailure(), callGeminiSpeech()]
- "gemini_commands": "commands.ts" | kind=code-symbol | source=src/features/gemini/commands.ts:L1 | neighbors=[5d6c459 fix(home): resolve model rates …, cbd4a9c feat(search): gemini joins the …, commands, types.ts, CommandDescriptor, commands.ts]
- "gemini_key_census": "key-census.ts" | kind=code-symbol | source=src/features/gemini/key-census.ts:L1 | neighbors=[b6bde77 feat(gemini): key census — who …, creditLine(), KeyCensus, KeyOwnership, PersonKeyCensus, key-census.test.ts]
- "gemini_key_census_test": "key-census.test.ts" | kind=code-symbol | source=src/features/gemini/key-census.test.ts:L1 | neighbors=[b6bde77 feat(gemini): key census — who …, key-census.ts, creditLine(), KeyCensus, KeyOwnership, key()]
- "gemini_pricing_formatusd": "formatUsd()" | kind=code-symbol | source=src/features/gemini/pricing.ts:L97 | neighbors=[ai-engine-card.tsx, ai-features-card.tsx, ai-meter-dock.tsx, dashboard-zones.tsx, pricing.ts, pricing.test.ts]
- "github_commits_test": "commits.test.ts" | kind=code-symbol | source=src/features/github/commits.test.ts:L1 | neighbors=[de4812e feat(github): commits become wo…, commits.ts, commitPromptLines(), GithubCommitRow, row(), toCommitEvidence()]
- "github_config": "config.ts" | kind=code-symbol | source=src/features/github/config.ts:L1 | neighbors=[de4812e feat(github): commits become wo…, app-client.ts, GithubAppConfig, githubConfigured(), evidence.ts, queries.ts]
- "home_capabilities_grid": "capabilities-grid.tsx" | kind=code-symbol | source=src/app/(public)/home/capabilities-grid.tsx:L1 | neighbors=[d0da911 test(gemini): a public page may…, CAPABILITIES, CapabilitiesGrid(), spotlight-card.tsx, SpotlightCard(), page.tsx]
- "home_ops_metrics_strip": "ops-metrics-strip.tsx" | kind=code-symbol | source=src/app/(public)/home/ops-metrics-strip.tsx:L1 | neighbors=[d0da911 test(gemini): a public page may…, OpsMetricsStrip(), STUDIO_GEMINI_MODELS, utils.ts, cn(), page.tsx]
- "intel_answer_links_test": "answer-links.test.ts" | kind=code-symbol | source=src/features/intel/answer-links.test.ts:L1 | neighbors=[6e7c05f fix(intel): stop printing a per…, d269096 feat(intel): keep the Ask LogPu…, d78a3e1 fix(intel): the briefing links …, answer-links.ts, splitAnswerLinks(), CITES]
- "intel_prompt_test": "prompt.test.ts" | kind=code-symbol | source=src/features/intel/prompt.test.ts:L1 | neighbors=[0ef5105 fix(intel): a briefing priority…, prompt.ts, buildAskPrompt(), buildBriefingPrompt(), BASE, GROUNDING]
- "intel_signals_quietappsignals": "quietAppSignals()" | kind=code-symbol | source=src/features/intel/signals.ts:L377 | neighbors=[signals.ts, buildSignals(), clip(), dayOf(), plural(), signals.test.ts]
- "intel_signals_sprintrisksignals": "sprintRiskSignals()" | kind=code-symbol | source=src/features/intel/signals.ts:L262 | neighbors=[signals.ts, buildSignals(), clip(), plural(), remainingWorkingDays(), signals.test.ts]
- "intel_signals_unwrittenmeetingsignal": "unwrittenMeetingSignal()" | kind=code-symbol | source=src/features/intel/signals.ts:L333 | neighbors=[signals.ts, buildSignals(), signals.test.ts, clip(), dayOf(), plural()]
- "lib_agenda_topics_test": "agenda-topics.test.ts" | kind=code-symbol | source=src/lib/agenda-topics.test.ts:L1 | neighbors=[agenda-topics.ts, matchAgendaTopic(), GENERIC_KEYWORD_DENYLIST, TOPIC_BUCKETS, job-roles.ts, JOB_ROLES]
- "lib_allowed_domains": "allowed-domains.ts" | kind=code-symbol | source=src/lib/allowed-domains.ts:L1 | neighbors=[actions.ts, allowedDomains(), emailAllowed(), allowed-domains.test.ts, auth.ts, ai-actions.ts]
- "lib_allowed_domains_alloweddomains": "allowedDomains()" | kind=code-symbol | source=src/lib/allowed-domains.ts:L4 | neighbors=[actions.ts, allowed-domains.ts, emailAllowed(), allowed-domains.test.ts, auth.ts, ai-actions.ts]
- "lib_allowed_domains_emailallowed": "emailAllowed()" | kind=code-symbol | source=src/lib/allowed-domains.ts:L12 | neighbors=[actions.ts, allowed-domains.ts, allowedDomains(), allowed-domains.test.ts, auth.ts, ai-actions.ts]
- "lib_crypto": "crypto.ts" | kind=code-symbol | source=src/lib/crypto.ts:L1 | neighbors=[actions.ts, client.ts, model-discovery.ts, decryptSecret(), encryptSecret(), keyFromSecret()]
- "lib_dedupe": "dedupe.ts" | kind=code-symbol | source=src/lib/dedupe.ts:L1 | neighbors=[command-center.tsx, createDeduper(), Deduper, DeduperOptions, Entry, dedupe.test.ts]
- "lib_keyset_cursor": "keyset-cursor.ts" | kind=code-symbol | source=src/lib/keyset-cursor.ts:L1 | neighbors=[queries.ts, queue-page.ts, queue-page.test.ts, decodeKeysetCursor(), encodeKeysetCursor(), KeysetCursor]
- "lib_lk_holidays_ismercantileholiday": "isMercantileHoliday()" | kind=code-symbol | source=src/lib/lk-holidays.ts:L221 | neighbors=[lk-holidays.ts, excusesWork(), lk-holidays.test.ts, working-days.ts, coverage-queries.ts, entry-evidence.ts]
- "lib_phone_normalizephone": "normalizePhone()" | kind=code-symbol | source=src/lib/phone.ts:L18 | neighbors=[actions.ts, actions.ts, phone.ts, phone.test.ts, actions.ts, schema.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-030.json

Keep each description factual and concise (one sentence). No markdown, no prose
outside the JSON object. It is acceptable to omit a node if context is
insufficient — but include every node you can ground confidently.

Example answer format:
```json
{
  "node_id_1": "Resolves the configured ontology profile from graphify.yaml.",
  "node_id_2": "Colonel James Barclay, an antagonist in The Crooked Man."
}
```
