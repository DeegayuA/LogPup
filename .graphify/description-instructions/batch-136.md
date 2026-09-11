# Node Description Batch 137 of 166

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

- "finance_cost_projectcostfigure": "ProjectCostFigure" | kind=code-symbol | source=src/features/finance/cost.ts:L281 | neighbors=[cost.ts]
- "finance_cost_rateinterval": "RateInterval" | kind=code-symbol | source=src/features/finance/cost.ts:L42 | neighbors=[cost.ts]
- "finance_cost_resolvedrate": "ResolvedRate" | kind=code-symbol | source=src/features/finance/cost.ts:L63 | neighbors=[cost.ts]
- "finance_cost_suppressedcostfigure": "SuppressedCostFigure" | kind=code-symbol | source=src/features/finance/cost.ts:L299 | neighbors=[cost.ts]
- "finance_cost_test_person": "person()" | kind=code-symbol | source=src/features/finance/cost.test.ts:L21 | neighbors=[cost.test.ts]
- "finance_cost_test_role": "role()" | kind=code-symbol | source=src/features/finance/cost.test.ts:L12 | neighbors=[cost.test.ts]
- "finance_queries_attributedtaskentry": "AttributedTaskEntry" | kind=code-symbol | source=src/features/finance/queries.ts:L117 | neighbors=[queries.ts]
- "finance_queries_effortmixqueryresult": "EffortMixQueryResult" | kind=code-symbol | source=src/features/finance/queries.ts:L407 | neighbors=[queries.ts]
- "finance_queries_portfoliocostresult": "PortfolioCostResult" | kind=code-symbol | source=src/features/finance/queries.ts:L425 | neighbors=[queries.ts]
- "finance_queries_portfoliocostrow": "PortfolioCostRow" | kind=code-symbol | source=src/features/finance/queries.ts:L413 | neighbors=[queries.ts]
- "finance_queries_projectcostqueryresult": "ProjectCostQueryResult" | kind=code-symbol | source=src/features/finance/queries.ts:L188 | neighbors=[queries.ts]
- "finance_queries_projectmarginfigure": "ProjectMarginFigure" | kind=code-symbol | source=src/features/finance/queries.ts:L287 | neighbors=[queries.ts]
- "finance_queries_projectmarginresult": "ProjectMarginResult" | kind=code-symbol | source=src/features/finance/queries.ts:L298 | neighbors=[queries.ts]
- "finance_queries_projectworthfigure": "ProjectWorthFigure" | kind=code-symbol | source=src/features/finance/queries.ts:L221 | neighbors=[queries.ts]
- "finance_queries_projectworthresult": "ProjectWorthResult" | kind=code-symbol | source=src/features/finance/queries.ts:L231 | neighbors=[queries.ts]
- "finance_rate_actions_closepersonrateinput": "closePersonRateInput" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L263 | neighbors=[rate-actions.ts]
- "finance_rate_actions_closerolerateinput": "closeRoleRateInput" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L151 | neighbors=[rate-actions.ts]
- "finance_rate_actions_currencyinput": "currencyInput" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L65 | neighbors=[rate-actions.ts]
- "finance_rate_actions_hourlyinput": "hourlyInput" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L76 | neighbors=[rate-actions.ts]
- "finance_rate_actions_isodayinput": "isoDayInput" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L71 | neighbors=[rate-actions.ts]
- "finance_rate_actions_moneyinput": "moneyInput" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L77 | neighbors=[rate-actions.ts]
- "finance_rate_actions_setpersonrateinput": "setPersonRateInput" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L205 | neighbors=[rate-actions.ts]
- "finance_rate_actions_setprojectvalueinput": "setProjectValueInput" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L317 | neighbors=[rate-actions.ts]
- "finance_rate_actions_setrolerateinput": "setRoleRateInput" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L83 | neighbors=[rate-actions.ts]
- "gemini_actions_addkeyinput": "addKeyInput" | kind=code-symbol | source=src/features/gemini/actions.ts:L21 | neighbors=[actions.ts]
- "gemini_actions_idinput": "idInput" | kind=code-symbol | source=src/features/gemini/actions.ts:L19 | neighbors=[actions.ts]
- "gemini_actions_test_authmock_upsertspy": "{ authMock, upsertSpy }" | kind=code-symbol | source=src/features/gemini/actions.test.ts:L9 | neighbors=[actions.test.ts]
- "gemini_actions_test_dbmock_fetchmock": "{ dbMock, fetchMock }" | kind=code-symbol | source=src/features/gemini/actions.test.ts:L22 | neighbors=[actions.test.ts]
- "gemini_actions_test_key_row": "KEY_ROW" | kind=code-symbol | source=src/features/gemini/actions.test.ts:L28 | neighbors=[actions.test.ts]
- "gemini_actions_tierinput": "tierInput" | kind=code-symbol | source=src/features/gemini/actions.ts:L31 | neighbors=[actions.ts]
- "gemini_actions_toggleinput": "toggleInput" | kind=code-symbol | source=src/features/gemini/actions.ts:L26 | neighbors=[actions.ts]
- "gemini_advertised_models_test_advertisedmodels": "advertisedModels()" | kind=code-symbol | source=src/features/gemini/advertised-models.test.ts:L47 | neighbors=[advertised-models.test.ts]
- "gemini_advertised_models_test_hardcodedrates": "hardcodedRates()" | kind=code-symbol | source=src/features/gemini/advertised-models.test.ts:L166 | neighbors=[advertised-models.test.ts]
- "gemini_advertised_models_test_public_dir": "PUBLIC_DIR" | kind=code-symbol | source=src/features/gemini/advertised-models.test.ts:L44 | neighbors=[advertised-models.test.ts]
- "gemini_advertised_models_test_ratehit": "RateHit" | kind=code-symbol | source=src/features/gemini/advertised-models.test.ts:L140 | neighbors=[advertised-models.test.ts]
- "gemini_advertised_models_test_ratesintext": "ratesInText()" | kind=code-symbol | source=src/features/gemini/advertised-models.test.ts:L150 | neighbors=[advertised-models.test.ts]
- "gemini_advertised_models_test_repo_root": "REPO_ROOT" | kind=code-symbol | source=src/features/gemini/advertised-models.test.ts:L43 | neighbors=[advertised-models.test.ts]
- "gemini_ai_features_aifeaturedef": "AiFeatureDef" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L332 | neighbors=[ai-features.ts]
- "gemini_ai_features_aifeatureshape": "AiFeatureShape" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L65 | neighbors=[ai-features.ts]
- "gemini_ai_features_by_slug": "BY_SLUG" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L471 | neighbors=[ai-features.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-136.json

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
