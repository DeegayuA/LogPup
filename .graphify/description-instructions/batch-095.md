# Node Description Batch 96 of 166

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

- "finance_cost_pad": "pad()" | kind=code-symbol | source=src/features/finance/cost.ts:L364 | neighbors=[cost.ts, addMonthsIso()]
- "finance_cost_projectcostresult": "ProjectCostResult" | kind=code-symbol | source=src/features/finance/cost.ts:L304 | neighbors=[cost.ts, queries.ts]
- "finance_cost_subscriptionaccrual": "SubscriptionAccrual" | kind=code-symbol | source=src/features/finance/cost.ts:L345 | neighbors=[cost.ts, queries.ts]
- "finance_cost_subscriptionvalue": "SubscriptionValue" | kind=code-symbol | source=src/features/finance/cost.ts:L337 | neighbors=[cost.ts, queries.ts]
- "finance_queries_effortmix": "effortMix()" | kind=code-symbol | source=src/features/finance/queries.ts:L388 | neighbors=[queries.ts, assertIsoDayRange()]
- "finance_queries_projectworth": "projectWorth()" | kind=code-symbol | source=src/features/finance/queries.ts:L244 | neighbors=[project-finance-card.tsx, queries.ts]
- "finance_rate_actions_closepersonrate": "closePersonRate()" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L273 | neighbors=[rate-actions.ts, unexpected()]
- "finance_rate_actions_closerolerate": "closeRoleRate()" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L160 | neighbors=[rate-actions.ts, unexpected()]
- "finance_rate_actions_setpersonrate": "setPersonRate()" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L213 | neighbors=[rate-actions.ts, unexpected()]
- "finance_rate_actions_setprojectvalue": "setProjectValue()" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L356 | neighbors=[rate-actions.ts, unexpected()]
- "finance_rate_actions_setrolerate": "setRoleRate()" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L101 | neighbors=[rate-actions.ts, unexpected()]
- "gemini_actions_addgeminikey": "addGeminiKey()" | kind=code-symbol | source=src/features/gemini/actions.ts:L33 | neighbors=[gemini-keys-card.tsx, actions.ts]
- "gemini_actions_deletegeminikey": "deleteGeminiKey()" | kind=code-symbol | source=src/features/gemini/actions.ts:L73 | neighbors=[gemini-keys-card.tsx, actions.ts]
- "gemini_actions_getrecordingreadiness": "getRecordingReadiness()" | kind=code-symbol | source=src/features/gemini/actions.ts:L99 | neighbors=[meeting-intel.tsx, actions.ts]
- "gemini_actions_setaifeaturemodel": "setAiFeatureModel()" | kind=code-symbol | source=src/features/gemini/actions.ts:L178 | neighbors=[ai-model-select.tsx, actions.ts]
- "gemini_actions_setaifeaturepref": "setAiFeaturePref()" | kind=code-symbol | source=src/features/gemini/actions.ts:L147 | neighbors=[ai-feature-toggle.tsx, actions.ts]
- "gemini_actions_setgeminikeysharing": "setGeminiKeySharing()" | kind=code-symbol | source=src/features/gemini/actions.ts:L119 | neighbors=[gemini-keys-card.tsx, actions.ts]
- "gemini_actions_setgeminikeytier": "setGeminiKeyTier()" | kind=code-symbol | source=src/features/gemini/actions.ts:L132 | neighbors=[gemini-keys-card.tsx, actions.ts]
- "gemini_actions_togglegeminikey": "toggleGeminiKey()" | kind=code-symbol | source=src/features/gemini/actions.ts:L106 | neighbors=[gemini-keys-card.tsx, actions.ts]
- "gemini_ai_features_featureforslug": "featureForSlug()" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L476 | neighbors=[ai-features.ts, ai-features.test.ts]
- "gemini_ai_meter_localspend": "localSpend()" | kind=code-symbol | source=src/features/gemini/ai-meter.ts:L233 | neighbors=[ai-meter.ts, ai-meter.test.ts]
- "gemini_ai_meter_meterinput": "MeterInput" | kind=code-symbol | source=src/features/gemini/ai-meter.ts:L33 | neighbors=[ai-meter.ts, ai-meter.test.ts]
- "gemini_ai_meter_meterphase": "MeterPhase" | kind=code-symbol | source=src/features/gemini/ai-meter.ts:L25 | neighbors=[ai-meter.ts, meter-tasks.ts]
- "gemini_ai_meter_meterusage": "MeterUsage" | kind=code-symbol | source=src/features/gemini/ai-meter.ts:L28 | neighbors=[ai-meter.ts, meter-tasks.ts]
- "gemini_audio_strategy_test": "audio-strategy.test.ts" | kind=code-symbol | source=src/features/gemini/audio-strategy.test.ts:L1 | neighbors=[audio-strategy.ts, shouldUseInlineAudio()]
- "gemini_budget_budget": "Budget" | kind=code-symbol | source=src/features/gemini/budget.ts:L57 | neighbors=[budget.ts, budget-queries.ts]
- "gemini_budget_notify_notifybudgetthreshold": "notifyBudgetThreshold()" | kind=code-symbol | source=src/features/gemini/budget-notify.ts:L29 | neighbors=[budget-notify.ts, usage.ts]
- "gemini_budget_queries_getaibudget": "getAiBudget" | kind=code-symbol | source=src/features/gemini/budget-queries.ts:L26 | neighbors=[budget-queries.ts, client.ts]
- "gemini_budget_queries_readaibudget": "readAiBudget()" | kind=code-symbol | source=src/features/gemini/budget-queries.ts:L42 | neighbors=[budget-notify.ts, budget-queries.ts]
- "gemini_client_buildaudiopart": "buildAudioPart()" | kind=code-symbol | source=src/features/gemini/client.ts:L695 | neighbors=[client.ts, uploadFileToGemini()]
- "gemini_client_buildimagepart": "buildImagePart()" | kind=code-symbol | source=src/features/gemini/client.ts:L717 | neighbors=[client.ts, uploadFileToGemini()]
- "gemini_client_callmodelwithretry": "callModelWithRetry()" | kind=code-symbol | source=src/features/gemini/client.ts:L158 | neighbors=[client.ts, callGeminiCore()]
- "gemini_client_geminiimageinput": "GeminiImageInput" | kind=code-symbol | source=src/features/gemini/client.ts:L755 | neighbors=[client.ts, ai-actions.ts]
- "gemini_client_hasgeminikeys": "hasGeminiKeys()" | kind=code-symbol | source=src/features/gemini/client.ts:L58 | neighbors=[client.ts, actions.ts]
- "gemini_client_recordfailure": "recordFailure()" | kind=code-symbol | source=src/features/gemini/client.ts:L322 | neighbors=[client.ts, callGeminiCore()]
- "gemini_client_resolvemodelchain": "resolveModelChain()" | kind=code-symbol | source=src/features/gemini/client.ts:L310 | neighbors=[client.ts, callGemini()]
- "gemini_client_validategeminikey": "validateGeminiKey()" | kind=code-symbol | source=src/features/gemini/client.ts:L90 | neighbors=[actions.ts, client.ts]
- "gemini_commands_commands": "commands" | kind=code-symbol | source=src/features/gemini/commands.ts:L30 | neighbors=[commands.ts, commands.ts]
- "gemini_key_census_creditline": "creditLine()" | kind=code-symbol | source=src/features/gemini/key-census.ts:L112 | neighbors=[key-census.ts, key-census.test.ts]
- "gemini_key_census_keycensus": "KeyCensus" | kind=code-symbol | source=src/features/gemini/key-census.ts:L48 | neighbors=[key-census.ts, key-census.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-095.json

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
