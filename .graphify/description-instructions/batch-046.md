# Node Description Batch 47 of 166

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

- "finance_cost_rateforpersononday": "rateForPersonOnDay()" | kind=code-symbol | source=src/features/finance/cost.ts:L150 | neighbors=[cost.ts, coveringRate(), cost.test.ts, queries.ts]
- "finance_cost_roundmoney": "roundMoney()" | kind=code-symbol | source=src/features/finance/cost.ts:L97 | neighbors=[cost.ts, costForEntries(), margin(), subscriptionAccrued()]
- "finance_queries_loadpersonrates": "loadPersonRates()" | kind=code-symbol | source=src/features/finance/queries.ts:L104 | neighbors=[queries.ts, portfolioCost(), projectCost(), projectMargin()]
- "finance_queries_loadrolerates": "loadRoleRates()" | kind=code-symbol | source=src/features/finance/queries.ts:L91 | neighbors=[queries.ts, portfolioCost(), projectCost(), projectMargin()]
- "gemini_ai_meter_formatelapsed": "formatElapsed()" | kind=code-symbol | source=src/features/gemini/ai-meter.ts:L123 | neighbors=[ai-meter-dock.tsx, ai-meter.ts, MeterView, ai-meter.test.ts]
- "gemini_ai_meter_meterview": "MeterView" | kind=code-symbol | source=src/features/gemini/ai-meter.ts:L69 | neighbors=[ai-meter-dock.tsx, ai-meter.ts, formatElapsed(), ai-meter.test.ts]
- "gemini_budget_overbudgetmessage": "overBudgetMessage()" | kind=code-symbol | source=src/features/gemini/budget.ts:L137 | neighbors=[budget.ts, budget-notify.ts, budget.test.ts, client.ts]
- "gemini_client_callgeminiwithaudio": "callGeminiWithAudio()" | kind=code-symbol | source=src/features/gemini/client.ts:L737 | neighbors=[client.ts, callGemini(), ai-actions.ts, actions.ts]
- "gemini_meter_actions_metercontext": "MeterContext" | kind=code-symbol | source=src/features/gemini/meter-actions.ts:L80 | neighbors=[ai-meter-dock.tsx, ai-meter-provider.tsx, meter-actions.ts, spentToday()]
- "gemini_meter_retry_test": "meter-retry.test.ts" | kind=code-symbol | source=src/features/gemini/meter-retry.test.ts:L1 | neighbors=[9cd44c8 ., meter-tasks.ts, canRetry(), isKeyFailure()]
- "gemini_meter_tasks_metersteps": "MeterSteps" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L76 | neighbors=[ai-meter-provider.tsx, ai-meter.ts, meter-pace.ts, meter-tasks.ts]
- "gemini_meter_tasks_metertask": "MeterTask" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L82 | neighbors=[ai-meter-dock.tsx, ai-meter-provider.tsx, meter-tasks.ts, meter-tasks.test.ts]
- "gemini_meter_tasks_patchtask": "patchTask()" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L176 | neighbors=[ai-meter-provider.tsx, meter-tasks.ts, reportSteps(), meter-tasks.test.ts]
- "gemini_meter_tasks_reportsteps": "reportSteps()" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L195 | neighbors=[ai-meter-provider.tsx, meter-tasks.ts, patchTask(), meter-tasks.test.ts]
- "gemini_meter_tasks_steppercent": "stepPercent()" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L225 | neighbors=[ai-meter-dock.tsx, ai-meter.ts, meter-tasks.ts, meter-tasks.test.ts]
- "gemini_model_catalog_classifymodel": "classifyModel()" | kind=code-symbol | source=src/features/gemini/model-catalog.ts:L71 | neighbors=[model-catalog.ts, buildModelCatalog(), modelIdFrom(), model-catalog.test.ts]
- "gemini_model_catalog_modelidfrom": "modelIdFrom()" | kind=code-symbol | source=src/features/gemini/model-catalog.ts:L56 | neighbors=[model-catalog.ts, buildModelCatalog(), classifyModel(), model-catalog.test.ts]
- "gemini_model_choice_test": "model-choice.test.ts" | kind=code-symbol | source=src/features/gemini/model-choice.test.ts:L1 | neighbors=[model-choice.ts, resolveChain(), models.ts, QUICK_MODELS]
- "gemini_model_discovery_fetchcatalog": "fetchCatalog()" | kind=code-symbol | source=src/features/gemini/model-discovery.ts:L142 | neighbors=[model-discovery.ts, firstUsableKey(), readModels(), getModelCatalog()]
- "gemini_model_discovery_getmodelcatalog": "getModelCatalog()" | kind=code-symbol | source=src/features/gemini/model-discovery.ts:L97 | neighbors=[ai-features-card.tsx, model-discovery.ts, fetchCatalog(), isSelectableModel()]
- "gemini_models_synthesis_models": "SYNTHESIS_MODELS" | kind=code-symbol | source=src/features/gemini/models.ts:L44 | neighbors=[advertised-models.test.ts, model-choice.ts, models.ts, pricing.test.ts]
- "gemini_models_tts_model_fallback_order": "TTS_MODEL_FALLBACK_ORDER" | kind=code-symbol | source=src/features/gemini/models.ts:L75 | neighbors=[advertised-models.test.ts, model-choice.ts, models.ts, pricing.test.ts]
- "gemini_prefs_isaifeatureenabled": "isAiFeatureEnabled()" | kind=code-symbol | source=src/features/gemini/prefs.ts:L45 | neighbors=[prefs.ts, aiFeatureDisabledMessage(), getAiPrefs(), actions.ts]
- "gemini_queries_listpoolkeyhealth": "listPoolKeyHealth()" | kind=code-symbol | source=src/features/gemini/queries.ts:L69 | neighbors=[dashboard-zones.tsx, actions.ts, queries.ts, page.tsx]
- "gemini_readiness_recordingreadiness": "RecordingReadiness" | kind=code-symbol | source=src/features/gemini/readiness.ts:L60 | neighbors=[ai-engine-card.tsx, meeting-intel.tsx, actions.ts, readiness.ts]
- "gemini_rotation": "rotation.ts" | kind=code-symbol | source=src/features/gemini/rotation.ts:L1 | neighbors=[client.ts, model-discovery.ts, orderKeysForRotation(), rotation.test.ts]
- "gemini_rotation_orderkeysforrotation": "orderKeysForRotation()" | kind=code-symbol | source=src/features/gemini/rotation.ts:L9 | neighbors=[client.ts, model-discovery.ts, rotation.ts, rotation.test.ts]
- "gemini_usage_summary_featureusagesummary": "FeatureUsageSummary" | kind=code-symbol | source=src/features/gemini/usage-summary.ts:L38 | neighbors=[ai-features-card.tsx, ai-engine.ts, ai-engine.test.ts, usage-summary.ts]
- "gemini_usage_summary_summarizeusage": "summarizeUsage()" | kind=code-symbol | source=src/features/gemini/usage-summary.ts:L61 | neighbors=[ai-features-card.tsx, dashboard-zones.tsx, usage-summary.ts, usage-summary.test.ts]
- "gemini_usage_summary_totalsfor": "totalsFor()" | kind=code-symbol | source=src/features/gemini/usage-summary.ts:L101 | neighbors=[ai-features-card.tsx, dashboard-zones.tsx, usage-summary.ts, usage-summary.test.ts]
- "github_app_client_commitsbyauthor": "commitsByAuthor()" | kind=code-symbol | source=src/features/github/app-client.ts:L88 | neighbors=[app-client.ts, gh(), installationToken(), evidence.ts]
- "github_commits_commitevidence": "CommitEvidence" | kind=code-symbol | source=src/features/github/commits.ts:L7 | neighbors=[app-client.ts, commits.ts, evidence.ts, entry-evidence.ts]
- "home_spotlight_card_spotlightcard": "SpotlightCard()" | kind=code-symbol | source=src/app/(public)/home/spotlight-card.tsx:L12 | neighbors=[bento-features.tsx, capabilities-grid.tsx, scope-notice.tsx, spotlight-card.tsx]
- "hooks_use_is_in_view": "use-is-in-view.tsx" | kind=code-symbol | source=src/hooks/use-is-in-view.tsx:L1 | neighbors=[007c37f ., useIsInView(), UseIsInViewOptions, counting-number.tsx]
- "id_print_masthead_edit_usemeetingwrite": "useMeetingWrite()" | kind=code-symbol | source=src/app/print/meetings/[id]/print-masthead-edit.tsx:L61 | neighbors=[print-masthead-edit.tsx, EditableAgenda(), EditableAttendees(), EditableTitle()]
- "id_print_speaker_names": "print-speaker-names.tsx" | kind=code-symbol | source=src/app/print/meetings/[id]/print-speaker-names.tsx:L1 | neighbors=[page.tsx, PrintSpeakerNames(), ai-actions.ts, setSpeakerMapping()]
- "intel_actions_briefing": "Briefing" | kind=code-symbol | source=src/features/intel/actions.ts:L61 | neighbors=[briefing-card.tsx, intel-view.tsx, actions.ts, briefing-fallback.ts]
- "intel_chat_history_appendturn": "appendTurn()" | kind=code-symbol | source=src/features/intel/chat-history.ts:L48 | neighbors=[ask-panel.tsx, chat-history.ts, capBytes(), chat-history.test.ts]
- "intel_chat_history_capbytes": "capBytes()" | kind=code-symbol | source=src/features/intel/chat-history.ts:L62 | neighbors=[chat-history.ts, appendTurn(), serializedBytes(), chat-history.test.ts]
- "intel_context_pack_buildgrounding": "buildGrounding()" | kind=code-symbol | source=src/features/intel/context-pack.ts:L399 | neighbors=[context-pack.ts, entryLines(), fit(), loadWorkspaceSnapshot()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-046.json

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
