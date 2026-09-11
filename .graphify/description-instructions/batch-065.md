# Node Description Batch 66 of 166

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

- "gemini_audio_strategy_shoulduseinlineaudio": "shouldUseInlineAudio()" | kind=code-symbol | source=src/features/gemini/audio-strategy.ts:L11 | neighbors=[audio-strategy.ts, audio-strategy.test.ts, client.ts]
- "gemini_budget_budgetladderstep": "budgetLadderStep()" | kind=code-symbol | source=src/features/gemini/budget.ts:L120 | neighbors=[budget.ts, budget-notify.ts, budget.test.ts]
- "gemini_budget_budgetmonth": "budgetMonth()" | kind=code-symbol | source=src/features/gemini/budget.ts:L127 | neighbors=[budget.ts, budget-notify.ts, budget.test.ts]
- "gemini_budget_budgetstate": "BudgetState" | kind=code-symbol | source=src/features/gemini/budget.ts:L55 | neighbors=[budget.ts, budget-queries.ts, budget.test.ts]
- "gemini_budget_isoverbudget": "isOverBudget()" | kind=code-symbol | source=src/features/gemini/budget.ts:L108 | neighbors=[budget.ts, budget.test.ts, client.ts]
- "gemini_budget_warnbudgetmessage": "warnBudgetMessage()" | kind=code-symbol | source=src/features/gemini/budget.ts:L158 | neighbors=[budget.ts, budget-notify.ts, budget.test.ts]
- "gemini_client_callgeminispeech": "callGeminiSpeech()" | kind=code-symbol | source=src/features/gemini/client.ts:L602 | neighbors=[client.ts, callGeminiCore(), actions.ts]
- "gemini_client_callgeminiwithimages": "callGeminiWithImages()" | kind=code-symbol | source=src/features/gemini/client.ts:L768 | neighbors=[client.ts, callGemini(), ai-actions.ts]
- "gemini_client_gemini_model_fallback_order": "GEMINI_MODEL_FALLBACK_ORDER" | kind=code-symbol | source=src/features/gemini/client.ts:L21 | neighbors=[client.ts, models.ts, ai-actions.ts]
- "gemini_client_uploadfiletogemini": "uploadFileToGemini()" | kind=code-symbol | source=src/features/gemini/client.ts:L644 | neighbors=[client.ts, buildAudioPart(), buildImagePart()]
- "gemini_meter_actions_metersettlement": "meterSettlement()" | kind=code-symbol | source=src/features/gemini/meter-actions.ts:L166 | neighbors=[ai-meter-provider.tsx, meter-actions.ts, spentToday()]
- "gemini_meter_actions_spenttoday": "spentToday()" | kind=code-symbol | source=src/features/gemini/meter-actions.ts:L251 | neighbors=[meter-actions.ts, MeterContext, meterSettlement()]
- "gemini_meter_pace_durationhistory": "DurationHistory" | kind=code-symbol | source=src/features/gemini/meter-pace.ts:L41 | neighbors=[ai-meter-provider.tsx, meter-pace.ts, meter-pace.test.ts]
- "gemini_meter_pace_durationstorage": "durationStorage" | kind=code-symbol | source=src/features/gemini/meter-pace.ts:L114 | neighbors=[ai-meter-provider.tsx, meter-pace.ts, meter-pace.test.ts]
- "gemini_meter_pace_pace_exempt": "PACE_EXEMPT" | kind=code-symbol | source=src/features/gemini/meter-pace.ts:L31 | neighbors=[ai-meter-provider.tsx, meter-pace.ts, meter-pace.test.ts]
- "gemini_meter_pace_pacekey": "paceKey()" | kind=code-symbol | source=src/features/gemini/meter-pace.ts:L43 | neighbors=[ai-meter-provider.tsx, meter-pace.ts, meter-pace.test.ts]
- "gemini_meter_pace_paceview": "PaceView" | kind=code-symbol | source=src/features/gemini/meter-pace.ts:L76 | neighbors=[ai-meter.ts, meter-pace.ts, meter-pace.test.ts]
- "gemini_meter_pace_recordduration": "recordDuration()" | kind=code-symbol | source=src/features/gemini/meter-pace.ts:L53 | neighbors=[ai-meter-provider.tsx, meter-pace.ts, meter-pace.test.ts]
- "gemini_meter_pace_stepsremainingms": "stepsRemainingMs()" | kind=code-symbol | source=src/features/gemini/meter-pace.ts:L104 | neighbors=[ai-meter.ts, meter-pace.ts, meter-pace.test.ts]
- "gemini_meter_pace_typicalms": "typicalMs()" | kind=code-symbol | source=src/features/gemini/meter-pace.ts:L64 | neighbors=[ai-meter-provider.tsx, meter-pace.ts, meter-pace.test.ts]
- "gemini_meter_tasks_addtask": "addTask()" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L172 | neighbors=[ai-meter-provider.tsx, meter-tasks.ts, meter-tasks.test.ts]
- "gemini_meter_tasks_canretry": "canRetry()" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L392 | neighbors=[ai-meter-dock.tsx, meter-retry.test.ts, meter-tasks.ts]
- "gemini_meter_tasks_closesettlewindow": "closeSettleWindow()" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L267 | neighbors=[ai-meter-provider.tsx, meter-tasks.ts, meter-tasks.test.ts]
- "gemini_meter_tasks_dismisstask": "dismissTask()" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L184 | neighbors=[ai-meter-provider.tsx, meter-tasks.ts, meter-tasks.test.ts]
- "gemini_meter_tasks_dockview": "DockView" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L279 | neighbors=[ai-meter-dock.tsx, meter-tasks.ts, meter-tasks.test.ts]
- "gemini_meter_tasks_expiresettled": "expireSettled()" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L240 | neighbors=[ai-meter-provider.tsx, meter-tasks.ts, meter-tasks.test.ts]
- "gemini_meter_tasks_flightdelta": "flightDelta()" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L358 | neighbors=[ai-meter-provider.tsx, meter-tasks.ts, meter-tasks.test.ts]
- "gemini_meter_tasks_iskeyfailure": "isKeyFailure()" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L403 | neighbors=[ai-meter-dock.tsx, meter-retry.test.ts, meter-tasks.ts]
- "gemini_meter_tasks_meteroriginpoint": "MeterOriginPoint" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L33 | neighbors=[ai-meter-provider.tsx, meeting-assistant.tsx, meter-tasks.ts]
- "gemini_model_catalog_labelfor": "labelFor()" | kind=code-symbol | source=src/features/gemini/model-catalog.ts:L128 | neighbors=[model-catalog.ts, buildModelCatalog(), model-catalog.test.ts]
- "gemini_model_catalog_rawgeminimodel": "RawGeminiModel" | kind=code-symbol | source=src/features/gemini/model-catalog.ts:L36 | neighbors=[model-catalog.ts, model-catalog.test.ts, model-discovery.ts]
- "gemini_model_catalog_stabilityof": "stabilityOf()" | kind=code-symbol | source=src/features/gemini/model-catalog.ts:L114 | neighbors=[model-catalog.ts, buildModelCatalog(), model-catalog.test.ts]
- "gemini_model_catalog_versionof": "versionOf()" | kind=code-symbol | source=src/features/gemini/model-catalog.ts:L145 | neighbors=[model-catalog.ts, compareModels(), model-catalog.test.ts]
- "gemini_model_choice_isfeaturerouted": "isFeatureRouted()" | kind=code-symbol | source=src/features/gemini/model-choice.ts:L124 | neighbors=[ai-features-card.tsx, model-choice.ts, actions.ts]
- "gemini_model_discovery_isselectablemodel": "isSelectableModel()" | kind=code-symbol | source=src/features/gemini/model-discovery.ts:L126 | neighbors=[actions.ts, model-discovery.ts, getModelCatalog()]
- "gemini_prefs_resolveprefs": "resolvePrefs()" | kind=code-symbol | source=src/features/gemini/prefs.ts:L18 | neighbors=[ai-features.test.ts, prefs.ts, getAiPrefs()]
- "gemini_queries_aggregateaiusage": "aggregateAiUsage()" | kind=code-symbol | source=src/features/gemini/queries.ts:L102 | neighbors=[ai-features-card.tsx, dashboard-zones.tsx, queries.ts]
- "gemini_queries_listgeminikeys": "listGeminiKeys()" | kind=code-symbol | source=src/features/gemini/queries.ts:L30 | neighbors=[ai-features-card.tsx, queries.ts, page.tsx]
- "gemini_readiness_estimatesessionshare": "estimateSessionShare()" | kind=code-symbol | source=src/features/gemini/readiness.ts:L160 | neighbors=[meeting-intel.tsx, readiness.ts, readiness.test.ts]
- "gemini_readiness_indicativehoursperkey": "indicativeHoursPerKey()" | kind=code-symbol | source=src/features/gemini/readiness.ts:L167 | neighbors=[meeting-intel.tsx, readiness.ts, readiness.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-065.json

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
