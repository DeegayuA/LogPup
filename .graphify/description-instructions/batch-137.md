# Node Description Batch 138 of 166

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

- "gemini_ai_features_test_shut_down_model_ids": "SHUT_DOWN_MODEL_IDS" | kind=code-symbol | source=src/features/gemini/ai-features.test.ts:L16 | neighbors=[ai-features.test.ts]
- "gemini_ai_features_unmappedslug": "UnmappedSlug" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L467 | neighbors=[ai-features.ts]
- "gemini_ai_meter_test_at": "AT" | kind=code-symbol | source=src/features/gemini/ai-meter.test.ts:L5 | neighbors=[ai-meter.test.ts]
- "gemini_ai_meter_test_input": "input()" | kind=code-symbol | source=src/features/gemini/ai-meter.test.ts:L7 | neighbors=[ai-meter.test.ts]
- "gemini_budget_budgetinput": "BudgetInput" | kind=code-symbol | source=src/features/gemini/budget.ts:L41 | neighbors=[budget.ts]
- "gemini_budget_test_at": "at()" | kind=code-symbol | source=src/features/gemini/budget.test.ts:L14 | neighbors=[budget.test.ts]
- "gemini_client_extractinlineaudio": "extractInlineAudio()" | kind=code-symbol | source=src/features/gemini/client.ts:L141 | neighbors=[client.ts]
- "gemini_client_extracttext": "extractText()" | kind=code-symbol | source=src/features/gemini/client.ts:L133 | neighbors=[client.ts]
- "gemini_client_geminierror_constructor": ".constructor()" | kind=code-symbol | source=src/features/gemini/client.ts:L39 | neighbors=[GeminiError]
- "gemini_client_geminierrorcode": "GeminiErrorCode" | kind=code-symbol | source=src/features/gemini/client.ts:L28 | neighbors=[client.ts]
- "gemini_client_geminifile": "GeminiFile" | kind=code-symbol | source=src/features/gemini/client.ts:L632 | neighbors=[client.ts]
- "gemini_client_geminipart": "GeminiPart" | kind=code-symbol | source=src/features/gemini/client.ts:L45 | neighbors=[client.ts]
- "gemini_client_geminipartsinput": "GeminiPartsInput" | kind=code-symbol | source=src/features/gemini/client.ts:L56 | neighbors=[client.ts]
- "gemini_client_geminispeechaudio": "GeminiSpeechAudio" | kind=code-symbol | source=src/features/gemini/client.ts:L138 | neighbors=[client.ts]
- "gemini_client_generatecontentresponse": "GenerateContentResponse" | kind=code-symbol | source=src/features/gemini/client.ts:L114 | neighbors=[client.ts]
- "gemini_client_modelattemptresult": "ModelAttemptResult" | kind=code-symbol | source=src/features/gemini/client.ts:L109 | neighbors=[client.ts]
- "gemini_client_responseextractor": "ResponseExtractor" | kind=code-symbol | source=src/features/gemini/client.ts:L130 | neighbors=[client.ts]
- "gemini_key_census_personkeycensus": "PersonKeyCensus" | kind=code-symbol | source=src/features/gemini/key-census.ts:L40 | neighbors=[key-census.ts]
- "gemini_key_census_test_key": "key()" | kind=code-symbol | source=src/features/gemini/key-census.test.ts:L4 | neighbors=[key-census.test.ts]
- "gemini_meter_actions_estimated_token_slugs": "ESTIMATED_TOKEN_SLUGS" | kind=code-symbol | source=src/features/gemini/meter-actions.ts:L98 | neighbors=[meter-actions.ts]
- "gemini_meter_actions_meterkeypicture": "MeterKeyPicture" | kind=code-symbol | source=src/features/gemini/meter-actions.ts:L68 | neighbors=[meter-actions.ts]
- "gemini_meter_actions_meterkeytier": "MeterKeyTier" | kind=code-symbol | source=src/features/gemini/meter-actions.ts:L66 | neighbors=[meter-actions.ts]
- "gemini_meter_actions_metersettlementdto": "MeterSettlementDto" | kind=code-symbol | source=src/features/gemini/meter-actions.ts:L100 | neighbors=[meter-actions.ts]
- "gemini_meter_actions_settleinput": "settleInput" | kind=code-symbol | source=src/features/gemini/meter-actions.ts:L52 | neighbors=[meter-actions.ts]
- "gemini_meter_tasks_metertaskphase": "MeterTaskPhase" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L30 | neighbors=[meter-tasks.ts]
- "gemini_meter_tasks_test_task": "task()" | kind=code-symbol | source=src/features/gemini/meter-tasks.test.ts:L17 | neighbors=[meter-tasks.test.ts]
- "gemini_model_catalog_paid_tier_only": "PAID_TIER_ONLY" | kind=code-symbol | source=src/features/gemini/model-catalog.ts:L53 | neighbors=[model-catalog.ts]
- "gemini_model_catalog_test_text": "text()" | kind=code-symbol | source=src/features/gemini/model-catalog.test.ts:L20 | neighbors=[model-catalog.test.ts]
- "gemini_model_choice_default_chain": "DEFAULT_CHAIN" | kind=code-symbol | source=src/features/gemini/model-choice.ts:L66 | neighbors=[model-choice.ts]
- "gemini_model_discovery_modelcatalog": "ModelCatalog" | kind=code-symbol | source=src/features/gemini/model-discovery.ts:L46 | neighbors=[model-discovery.ts]
- "gemini_model_discovery_resetmodelcatalogcache": "resetModelCatalogCache()" | kind=code-symbol | source=src/features/gemini/model-discovery.ts:L85 | neighbors=[model-discovery.ts]
- "gemini_pricing_price_table": "PRICE_TABLE" | kind=code-symbol | source=src/features/gemini/pricing.ts:L16 | neighbors=[pricing.ts]
- "gemini_pricing_pricerow": "PriceRow" | kind=code-symbol | source=src/features/gemini/pricing.ts:L10 | neighbors=[pricing.ts]
- "gemini_queries_listkeyownership": "listKeyOwnership()" | kind=code-symbol | source=src/features/gemini/queries.ts:L229 | neighbors=[queries.ts]
- "gemini_readiness_iscurrentlyfailing": "isCurrentlyFailing()" | kind=code-symbol | source=src/features/gemini/readiness.ts:L143 | neighbors=[readiness.ts]
- "gemini_readiness_test_key": "key()" | kind=code-symbol | source=src/features/gemini/readiness.test.ts:L13 | neighbors=[readiness.test.ts]
- "gemini_readiness_test_minutes_ago": "MINUTES_AGO" | kind=code-symbol | source=src/features/gemini/readiness.test.ts:L11 | neighbors=[readiness.test.ts]
- "gemini_readiness_test_now": "NOW" | kind=code-symbol | source=src/features/gemini/readiness.test.ts:L10 | neighbors=[readiness.test.ts]
- "gemini_retry_retriable_statuses": "RETRIABLE_STATUSES" | kind=code-symbol | source=src/features/gemini/retry.ts:L23 | neighbors=[retry.ts]
- "gemini_rotation_test_key": "key()" | kind=code-symbol | source=src/features/gemini/rotation.test.ts:L4 | neighbors=[rotation.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-137.json

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
