# Node Description Batch 97 of 166

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

- "gemini_key_census_keyownership": "KeyOwnership" | kind=code-symbol | source=src/features/gemini/key-census.ts:L31 | neighbors=[key-census.ts, key-census.test.ts]
- "gemini_meter_tasks_metersettlement": "MeterSettlement" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L43 | neighbors=[ai-meter-provider.tsx, meter-tasks.ts]
- "gemini_model_catalog_comparemodels": "compareModels()" | kind=code-symbol | source=src/features/gemini/model-catalog.ts:L158 | neighbors=[model-catalog.ts, versionOf()]
- "gemini_model_choice_defaultchainfor": "defaultChainFor()" | kind=code-symbol | source=src/features/gemini/model-choice.ts:L96 | neighbors=[model-choice.ts, resolveChain()]
- "gemini_model_discovery_firstusablekey": "firstUsableKey()" | kind=code-symbol | source=src/features/gemini/model-discovery.ts:L200 | neighbors=[model-discovery.ts, fetchCatalog()]
- "gemini_model_discovery_readmodels": "readModels()" | kind=code-symbol | source=src/features/gemini/model-discovery.ts:L181 | neighbors=[model-discovery.ts, fetchCatalog()]
- "gemini_prefs_aiprefvalue": "AiPrefValue" | kind=code-symbol | source=src/features/gemini/prefs.ts:L10 | neighbors=[ai-engine.ts, prefs.ts]
- "gemini_pricing_modelprice": "ModelPrice" | kind=code-symbol | source=src/features/gemini/pricing.ts:L8 | neighbors=[ai-engine.ts, pricing.ts]
- "gemini_queries_aggregateadoption": "aggregateAdoption()" | kind=code-symbol | source=src/features/gemini/queries.ts:L168 | neighbors=[ai-adoption-card.tsx, queries.ts]
- "gemini_queries_geminikeyrow": "GeminiKeyRow" | kind=code-symbol | source=src/features/gemini/queries.ts:L7 | neighbors=[gemini-keys-card.tsx, queries.ts]
- "gemini_queries_peruserfeatureusage": "perUserFeatureUsage()" | kind=code-symbol | source=src/features/gemini/queries.ts:L196 | neighbors=[ai-adoption-card.tsx, queries.ts]
- "gemini_queries_sharedkeyusagebycaller": "sharedKeyUsageByCaller()" | kind=code-symbol | source=src/features/gemini/queries.ts:L139 | neighbors=[queries.ts, page.tsx]
- "gemini_retry_parseretryafterms": "parseRetryAfterMs()" | kind=code-symbol | source=src/features/gemini/retry.ts:L80 | neighbors=[retry.ts, backoffDelayMs()]
- "gemini_retry_sleep": "sleep()" | kind=code-symbol | source=src/features/gemini/retry.ts:L92 | neighbors=[client.ts, retry.ts]
- "gemini_usage_recordaiusage": "recordAiUsage()" | kind=code-symbol | source=src/features/gemini/usage.ts:L38 | neighbors=[client.ts, usage.ts]
- "github_app_client_b64url": "b64url()" | kind=code-symbol | source=src/features/github/app-client.ts:L19 | neighbors=[app-client.ts, appJwt()]
- "github_app_client_gh": "gh()" | kind=code-symbol | source=src/features/github/app-client.ts:L67 | neighbors=[app-client.ts, commitsByAuthor()]
- "github_config_githubappconfig": "GithubAppConfig" | kind=code-symbol | source=src/features/github/config.ts:L16 | neighbors=[app-client.ts, config.ts]
- "home_bento_features_bentofeatures": "BentoFeatures()" | kind=code-symbol | source=src/app/(public)/home/bento-features.tsx:L16 | neighbors=[bento-features.tsx, page.tsx]
- "home_capabilities_grid_capabilitiesgrid": "CapabilitiesGrid()" | kind=code-symbol | source=src/app/(public)/home/capabilities-grid.tsx:L80 | neighbors=[capabilities-grid.tsx, page.tsx]
- "home_fortnight_fortnight": "Fortnight()" | kind=code-symbol | source=src/app/(public)/home/fortnight.tsx:L111 | neighbors=[bento-features.tsx, fortnight.tsx]
- "home_hero_showcase_geminimodel": "GeminiModel" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L113 | neighbors=[hero-showcase.tsx, GeminiModelSpec]
- "home_hero_showcase_geminimodelspec": "GeminiModelSpec" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L101 | neighbors=[hero-showcase.tsx, GeminiModel]
- "home_hero_showcase_heroshowcase": "HeroShowcase()" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L418 | neighbors=[hero-showcase.tsx, page.tsx]
- "home_mouse_follower_mousefollower": "MouseFollower()" | kind=code-symbol | source=src/app/(public)/home/mouse-follower.tsx:L5 | neighbors=[mouse-follower.tsx, page.tsx]
- "home_ops_metrics_strip_opsmetricsstrip": "OpsMetricsStrip()" | kind=code-symbol | source=src/app/(public)/home/ops-metrics-strip.tsx:L77 | neighbors=[ops-metrics-strip.tsx, page.tsx]
- "home_plates_platebriefing": "PlateBriefing()" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L133 | neighbors=[page.tsx, plates.tsx]
- "home_plates_platecapacity": "PlateCapacity()" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L374 | neighbors=[page.tsx, plates.tsx]
- "home_plates_platewriteup": "PlateWriteup()" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L535 | neighbors=[page.tsx, plates.tsx]
- "home_scope_notice_scopenotice": "ScopeNotice()" | kind=code-symbol | source=src/app/(public)/home/scope-notice.tsx:L5 | neighbors=[page.tsx, scope-notice.tsx]
- "hooks_use_is_in_view_useisinview": "useIsInView()" | kind=code-symbol | source=src/hooks/use-is-in-view.tsx:L16 | neighbors=[use-is-in-view.tsx, counting-number.tsx]
- "hooks_use_is_in_view_useisinviewoptions": "UseIsInViewOptions" | kind=code-symbol | source=src/hooks/use-is-in-view.tsx:L10 | neighbors=[use-is-in-view.tsx, counting-number.tsx]
- "hooks_use_prefetch_intent": "use-prefetch-intent.ts" | kind=code-symbol | source=src/hooks/use-prefetch-intent.ts:L1 | neighbors=[command-center.tsx, usePrefetchIntent()]
- "hooks_use_prefetch_intent_useprefetchintent": "usePrefetchIntent()" | kind=code-symbol | source=src/hooks/use-prefetch-intent.ts:L31 | neighbors=[command-center.tsx, use-prefetch-intent.ts]
- "ics_route_get": "GET()" | kind=code-symbol | source=src/app/api/meetings/[id]/ics/route.ts:L44 | neighbors=[route.ts, sequenceFor()]
- "ics_route_sequencefor": "sequenceFor()" | kind=code-symbol | source=src/app/api/meetings/[id]/ics/route.ts:L40 | neighbors=[route.ts, GET()]
- "id_page_durationlabel": "durationLabel()" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L116 | neighbors=[page.tsx, MeetingPrintPage()]
- "id_page_generatemetadata": "generateMetadata()" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L65 | neighbors=[page.tsx, safeForFilename()]
- "id_page_readparam": "readParam()" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L282 | neighbors=[page.tsx, MeetingPrintPage()]
- "id_page_safeforfilename": "safeForFilename()" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L82 | neighbors=[page.tsx, generateMetadata()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-096.json

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
