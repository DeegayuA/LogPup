# Node Description Batch 38 of 166

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

- "deadlines_deadline_csv_parsedeadlinecsv": "parseDeadlineCsv()" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L285 | neighbors=[deadline-csv.ts, isDeadlineExampleRow(), validateDeadlineCsvRow(), deadline-csv.test.ts, import-actions.ts]
- "drizzle_0000_complete_adam_warlock_public_apps": "public.apps" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L84 | neighbors=[0000_complete_adam_warlock.sql, assignments, meetings, sprints, tasks]
- "drizzle_0014_meeting_note_timeline_meeting_task_suggestions": "meeting_task_suggestions" | kind=code-symbol | source=drizzle/0014_meeting_note_timeline.sql:L31 | neighbors=[0014_meeting_note_timeline.sql, public.meeting_note_segments, public.meetings, public.tasks, public.users]
- "e2e_auth_setup": "auth.setup.ts" | kind=code-symbol | source=e2e/auth.setup.ts:L1 | neighbors=[authFile, escapeForRegExp(), env.ts, seed-user.ts, seedDevUser()]
- "finance_cost_margin": "margin()" | kind=code-symbol | source=src/features/finance/cost.ts:L464 | neighbors=[cost.ts, roundMoney(), toAmount(), cost.test.ts, queries.ts]
- "finance_cost_toamount": "toAmount()" | kind=code-symbol | source=src/features/finance/cost.ts:L84 | neighbors=[cost.ts, coveringRate(), margin(), subscriptionAccrued(), queries.ts]
- "finance_queries_assertisodayrange": "assertIsoDayRange()" | kind=code-symbol | source=src/features/finance/queries.ts:L84 | neighbors=[queries.ts, effortMix(), portfolioCost(), projectCost(), projectMargin()]
- "finance_queries_portfoliocost": "portfolioCost()" | kind=code-symbol | source=src/features/finance/queries.ts:L440 | neighbors=[queries.ts, assertIsoDayRange(), loadPersonRates(), loadRoleRates(), page.tsx]
- "gemini_ai_features_estimateperusecostusd": "estimatePerUseCostUsd()" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L353 | neighbors=[ai-features-card.tsx, ai-meter-dock.tsx, ai-engine.ts, ai-features.ts, ai-features.test.ts]
- "gemini_ai_features_modelchoice": "ModelChoice" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L390 | neighbors=[ai-features-card.tsx, ai-model-select.tsx, ai-features.ts, model-catalog.ts, model-discovery.ts]
- "gemini_models_quick_models": "QUICK_MODELS" | kind=code-symbol | source=src/features/gemini/models.ts:L56 | neighbors=[advertised-models.test.ts, model-choice.ts, model-choice.test.ts, models.ts, pricing.test.ts]
- "gemini_readiness_assessrecordingreadiness": "assessRecordingReadiness()" | kind=code-symbol | source=src/features/gemini/readiness.ts:L72 | neighbors=[dashboard-zones.tsx, actions.ts, readiness.ts, readiness.test.ts, page.tsx]
- "gemini_retry_backoffdelayms": "backoffDelayMs()" | kind=code-symbol | source=src/features/gemini/retry.ts:L63 | neighbors=[client.ts, retry.ts, parseRetryAfterMs(), retry.test.ts, live-client.ts]
- "history_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/people/history/loading.tsx:L1 | neighbors=[007c37f ., history-skeleton.tsx, HistoryDataSkeleton(), HistoryShellSkeleton(), LoadingCapacityHistory()]
- "home_scope_notice": "scope-notice.tsx" | kind=code-symbol | source=src/app/(public)/home/scope-notice.tsx:L1 | neighbors=[d0da911 test(gemini): a public page may…, page.tsx, ScopeNotice(), spotlight-card.tsx, SpotlightCard()]
- "id_record_timeline": "record-timeline.tsx" | kind=code-symbol | source=src/app/print/meetings/[id]/record-timeline.tsx:L1 | neighbors=[page.tsx, RecordRow, RecordTimeline(), ai-actions.ts, editNoteSegment()]
- "intel_actions_getbriefing": "getBriefing()" | kind=code-symbol | source=src/features/intel/actions.ts:L217 | neighbors=[briefing-card.tsx, dashboard-zones.tsx, intel-view.tsx, actions.ts, parseBriefing()]
- "intel_briefing_fallback_plural": "plural()" | kind=code-symbol | source=src/features/intel/briefing-fallback.ts:L20 | neighbors=[briefing-fallback.ts, deriveBriefing(), ownClauses(), priorityFor(), teamClauses()]
- "intel_prompt_isinapproute": "isInAppRoute()" | kind=code-symbol | source=src/features/intel/prompt.ts:L198 | neighbors=[actions.ts, answer-links.ts, context-pack.ts, prompt.ts, parsePriority()]
- "intel_signals_capacitysignals": "capacitySignals()" | kind=code-symbol | source=src/features/intel/signals.ts:L218 | neighbors=[signals.ts, buildSignals(), clip(), nameFor(), signals.test.ts]
- "intel_signals_mergeablemeetingsignal": "mergeableMeetingSignal()" | kind=code-symbol | source=src/features/intel/signals.ts:L410 | neighbors=[signals.ts, buildSignals(), clip(), plural(), signals.test.ts]
- "intel_signals_overduetasksignal": "overdueTaskSignal()" | kind=code-symbol | source=src/features/intel/signals.ts:L152 | neighbors=[signals.ts, buildSignals(), clip(), plural(), signals.test.ts]
- "intel_signals_signal": "Signal" | kind=code-symbol | source=src/features/intel/signals.ts:L38 | neighbors=[intel-view.tsx, signal-board.tsx, actions.ts, briefing-fallback.ts, signals.ts]
- "intel_signals_signalinput": "SignalInput" | kind=code-symbol | source=src/features/intel/signals.ts:L53 | neighbors=[briefing-fallback.ts, briefing-fallback.test.ts, context-pack.ts, signals.ts, signals.test.ts]
- "intel_signals_stalefollowupsignal": "staleFollowupSignal()" | kind=code-symbol | source=src/features/intel/signals.ts:L189 | neighbors=[signals.ts, buildSignals(), clip(), plural(), signals.test.ts]
- "intel_signals_workloggapsignal": "worklogGapSignal()" | kind=code-symbol | source=src/features/intel/signals.ts:L292 | neighbors=[signals.ts, buildSignals(), signals.test.ts, clip(), plural()]
- "lib_access_gate_canaccessapp": "canAccessApp()" | kind=code-symbol | source=src/lib/access-gate.ts:L12 | neighbors=[route.ts, access-gate.ts, access-gate.test.ts, actions.ts, proxy.ts]
- "lib_changelog": "changelog.ts" | kind=code-symbol | source=src/lib/changelog.ts:L1 | neighbors=[ChangelogEntry, overview.ts, overview.test.ts, page.tsx, version-badge.tsx]
- "lib_meeting_intent_stripmatch": "stripMatch()" | kind=code-symbol | source=src/lib/meeting-intent.ts:L52 | neighbors=[meeting-intent.ts, extractDay(), extractDuration(), extractTime(), parseMeetingIntent()]
- "lib_meeting_intent_test": "meeting-intent.test.ts" | kind=code-symbol | source=src/lib/meeting-intent.test.ts:L1 | neighbors=[meeting-intent.ts, parseMeetingIntent(), aug(), NOW, PEOPLE]
- "lib_phone_telhref": "telHref()" | kind=code-symbol | source=src/lib/phone.ts:L6 | neighbors=[contact-buttons.tsx, person-header.tsx, person-hover-card.tsx, phone.ts, phone.test.ts]
- "lib_prompt_truncate": "prompt-truncate.ts" | kind=code-symbol | source=src/lib/prompt-truncate.ts:L1 | neighbors=[5a95470 fix(meetings): transcripts stop…, truncateAtWordBoundary(), prompt-truncate.test.ts, ai-actions.ts, day-summary.ts]
- "lib_task_intent_intentperson": "IntentPerson" | kind=code-symbol | source=src/lib/task-intent.ts:L16 | neighbors=[task-composer.tsx, task-intent.ts, composer-plan.ts, paste-plan.ts, paste-plan.test.ts]
- "lib_task_intent_test": "task-intent.test.ts" | kind=code-symbol | source=src/lib/task-intent.test.ts:L1 | neighbors=[8d1b390 fix(i18n): Sinhala survives eve…, task-intent.ts, parseTaskIntent(), PEOPLE, TODAY]
- "lib_tech_tags_test": "tech-tags.test.ts" | kind=code-symbol | source=src/lib/tech-tags.test.ts:L1 | neighbors=[tech-tags.ts, canonicalizeTag(), CURATED_TECH_TAGS, filterTagSuggestions(), mergeTagSources()]
- "lib_working_days_isworkingday": "isWorkingDay()" | kind=code-symbol | source=src/lib/working-days.ts:L57 | neighbors=[escalation.ts, recurrence.ts, working-days.ts, working-days.test.ts, missing-days.ts]
- "maintenance_window_automessage": "autoMessage()" | kind=code-symbol | source=src/features/maintenance/window.ts:L371 | neighbors=[maintenance-controls.tsx, window.ts, formatDuration(), formatWindowRange(), window.test.ts]
- "maintenance_window_formatclock": "formatClock()" | kind=code-symbol | source=src/features/maintenance/window.ts:L307 | neighbors=[window.ts, clockFormatter(), formatMoment(), formatWindowRange(), write-freeze.ts]
- "maintenance_window_formatmoment": "formatMoment()" | kind=code-symbol | source=src/features/maintenance/window.ts:L312 | neighbors=[maintenance-overlay.tsx, window.ts, dayFormatter(), formatClock(), formatWindowRange()]
- "maintenance_window_formatwindowsummary": "formatWindowSummary()" | kind=code-symbol | source=src/features/maintenance/window.ts:L330 | neighbors=[maintenance-controls.tsx, window.ts, formatDuration(), formatWindowRange(), window.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-037.json

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
