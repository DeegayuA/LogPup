# Node Description Batch 121 of 166

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

- "components_ai_engine_card_usageline": "usageLine()" | kind=code-symbol | source=src/features/dashboard/components/ai-engine-card.tsx:L54 | neighbors=[ai-engine-card.tsx]
- "components_ai_features_card_describeusage": "describeUsage()" | kind=code-symbol | source=src/features/gemini/components/ai-features-card.tsx:L40 | neighbors=[ai-features-card.tsx]
- "components_ai_features_card_suggestmodelfor": "suggestModelFor()" | kind=code-symbol | source=src/features/gemini/components/ai-features-card.tsx:L74 | neighbors=[ai-features-card.tsx]
- "components_ai_meter_dock_billing": "Billing()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L595 | neighbors=[ai-meter-dock.tsx]
- "components_ai_meter_dock_chain_glyph": "CHAIN_GLYPH" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L640 | neighbors=[ai-meter-dock.tsx]
- "components_ai_meter_dock_ease_enter": "EASE_ENTER" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L74 | neighbors=[ai-meter-dock.tsx]
- "components_ai_meter_dock_ease_exit": "EASE_EXIT" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L75 | neighbors=[ai-meter-dock.tsx]
- "components_ai_meter_dock_gauge": "Gauge()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L655 | neighbors=[ai-meter-dock.tsx]
- "components_ai_meter_dock_meterstriprow": "MeterStripRow()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L733 | neighbors=[ai-meter-dock.tsx]
- "components_ai_meter_dock_progressline": "ProgressLine()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L687 | neighbors=[ai-meter-dock.tsx]
- "components_ai_meter_dock_row": "Row()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L565 | neighbors=[ai-meter-dock.tsx]
- "components_ai_meter_provider_actionerror": "actionError()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L168 | neighbors=[ai-meter-provider.tsx]
- "components_ai_meter_provider_aimeterapi": "AiMeterApi" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L81 | neighbors=[ai-meter-provider.tsx]
- "components_ai_meter_provider_aimetercontext": "AiMeterContext" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L119 | neighbors=[ai-meter-provider.tsx]
- "components_ai_meter_provider_nexttaskid": "nextTaskId()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L183 | neighbors=[ai-meter-provider.tsx]
- "components_ai_meter_provider_noop_api": "NOOP_API" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L104 | neighbors=[ai-meter-provider.tsx]
- "components_ai_meter_provider_noop_handle": "NOOP_HANDLE" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L102 | neighbors=[ai-meter-provider.tsx]
- "components_ai_meter_provider_settle_backoff_ms": "SETTLE_BACKOFF_MS" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L165 | neighbors=[ai-meter-provider.tsx]
- "components_ai_model_select_pricelabel": "priceLabel()" | kind=code-symbol | source=src/features/gemini/components/ai-model-select.tsx:L26 | neighbors=[ai-model-select.tsx]
- "components_allocation_history_card_kind_dot": "KIND_DOT" | kind=code-symbol | source=src/features/people/components/allocation-history-card.tsx:L26 | neighbors=[allocation-history-card.tsx]
- "components_allocation_history_card_kind_label": "KIND_LABEL" | kind=code-symbol | source=src/features/people/components/allocation-history-card.tsx:L18 | neighbors=[allocation-history-card.tsx]
- "components_app_activity_daylabel": "dayLabel()" | kind=code-symbol | source=src/features/apps/components/app-activity.tsx:L31 | neighbors=[app-activity.tsx]
- "components_app_activity_kind_icon": "KIND_ICON" | kind=code-symbol | source=src/features/apps/components/app-activity.tsx:L15 | neighbors=[app-activity.tsx]
- "components_app_activity_kind_label": "KIND_LABEL" | kind=code-symbol | source=src/features/apps/components/app-activity.tsx:L22 | neighbors=[app-activity.tsx]
- "components_app_card_health_accent": "HEALTH_ACCENT" | kind=code-symbol | source=src/features/apps/components/app-card.tsx:L40 | neighbors=[app-card.tsx]
- "components_app_card_status_label": "STATUS_LABEL" | kind=code-symbol | source=src/features/apps/components/app-card.tsx:L27 | neighbors=[app-card.tsx]
- "components_app_contributions_stat": "Stat()" | kind=code-symbol | source=src/features/apps/components/app-contributions.tsx:L11 | neighbors=[app-contributions.tsx]
- "components_app_form_dialog_appforminitialvalues": "AppFormInitialValues" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L97 | neighbors=[app-form-dialog.tsx]
- "components_app_form_dialog_emptystate": "emptyState" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L86 | neighbors=[app-form-dialog.tsx]
- "components_app_form_dialog_fielderrors": "FieldErrors" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L84 | neighbors=[app-form-dialog.tsx]
- "components_app_form_dialog_formstate": "FormState" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L68 | neighbors=[app-form-dialog.tsx]
- "components_app_form_dialog_identifyfield": "identifyField()" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L148 | neighbors=[app-form-dialog.tsx]
- "components_app_form_dialog_normalizerepourl": "normalizeRepoUrl()" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L129 | neighbors=[app-form-dialog.tsx]
- "components_app_form_dialog_repourlerror": "repoUrlError()" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L135 | neighbors=[app-form-dialog.tsx]
- "components_app_form_dialog_status": "Status" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L48 | neighbors=[app-form-dialog.tsx]
- "components_app_form_dialog_status_options": "STATUS_OPTIONS" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L50 | neighbors=[app-form-dialog.tsx]
- "components_app_form_dialog_toformstate": "toFormState()" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L113 | neighbors=[app-form-dialog.tsx]
- "components_app_header_headerstat": "HeaderStat" | kind=code-symbol | source=src/features/apps/components/app-header.tsx:L29 | neighbors=[app-header.tsx]
- "components_app_header_status_dot": "STATUS_DOT" | kind=code-symbol | source=src/features/apps/components/app-header.tsx:L15 | neighbors=[app-header.tsx]
- "components_app_header_status_label": "STATUS_LABEL" | kind=code-symbol | source=src/features/apps/components/app-header.tsx:L23 | neighbors=[app-header.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-120.json

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
