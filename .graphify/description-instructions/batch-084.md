# Node Description Batch 85 of 166

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

- "components_ai_adoption_card_aiadoptioncard": "AiAdoptionCard()" | kind=code-symbol | source=src/features/admin/components/ai-adoption-card.tsx:L39 | neighbors=[page.tsx, ai-adoption-card.tsx]
- "components_ai_engine_card_aienginecard": "AiEngineCard()" | kind=code-symbol | source=src/features/dashboard/components/ai-engine-card.tsx:L72 | neighbors=[ai-engine-card.tsx, dashboard-zones.tsx]
- "components_ai_feature_toggle_aifeaturetoggle": "AiFeatureToggle()" | kind=code-symbol | source=src/features/gemini/components/ai-feature-toggle.tsx:L16 | neighbors=[ai-feature-toggle.tsx, ai-features-card.tsx]
- "components_ai_features_card_aifeaturescard": "AiFeaturesCard()" | kind=code-symbol | source=src/features/gemini/components/ai-features-card.tsx:L103 | neighbors=[ai-features-card.tsx, page.tsx]
- "components_ai_meter_dock_announcement": "announcement()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L822 | neighbors=[ai-meter-dock.tsx, AiMeterDock()]
- "components_ai_meter_dock_metercard": "MeterCard()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L197 | neighbors=[ai-meter-dock.tsx, number()]
- "components_ai_meter_dock_number": "number()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L79 | neighbors=[ai-meter-dock.tsx, MeterCard()]
- "components_ai_meter_provider_aimeterprovider": "AiMeterProvider()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L188 | neighbors=[layout.tsx, ai-meter-provider.tsx]
- "components_ai_meter_provider_metertaskhandle": "MeterTaskHandle" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L75 | neighbors=[ai-meter-provider.tsx, meeting-intel.tsx]
- "components_ai_meter_provider_originpoint": "originPoint()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L139 | neighbors=[ai-meter-provider.tsx, meterOrigin()]
- "components_ai_model_select_aimodelselect": "AiModelSelect()" | kind=code-symbol | source=src/features/gemini/components/ai-model-select.tsx:L48 | neighbors=[ai-features-card.tsx, ai-model-select.tsx]
- "components_ai_model_select_modelsuggestion": "ModelSuggestion" | kind=code-symbol | source=src/features/gemini/components/ai-model-select.tsx:L36 | neighbors=[ai-features-card.tsx, ai-model-select.tsx]
- "components_allocation_history_card_allocationhistorycard": "AllocationHistoryCard()" | kind=code-symbol | source=src/features/people/components/allocation-history-card.tsx:L40 | neighbors=[allocation-history-card.tsx, page.tsx]
- "components_app_activity_appactivity": "AppActivity()" | kind=code-symbol | source=src/features/apps/components/app-activity.tsx:L49 | neighbors=[app-activity.tsx, page.tsx]
- "components_app_card_appcard": "AppCard()" | kind=code-symbol | source=src/features/apps/components/app-card.tsx:L78 | neighbors=[app-card.tsx, apps-browser.tsx]
- "components_app_comments_appcomments": "AppComments()" | kind=code-symbol | source=src/features/apps/components/app-comments.tsx:L13 | neighbors=[app-comments.tsx, page.tsx]
- "components_app_contributions_appcontributions": "AppContributions()" | kind=code-symbol | source=src/features/apps/components/app-contributions.tsx:L56 | neighbors=[app-contributions.tsx, page.tsx]
- "components_app_header_appheader": "AppHeader()" | kind=code-symbol | source=src/features/apps/components/app-header.tsx:L50 | neighbors=[app-header.tsx, page.tsx]
- "components_app_role_history_card_approlehistorycard": "AppRoleHistoryCard()" | kind=code-symbol | source=src/features/apps/components/app-role-history-card.tsx:L26 | neighbors=[app-role-history-card.tsx, page.tsx]
- "components_app_role_history_card_personapprolehistorycard": "PersonAppRoleHistoryCard()" | kind=code-symbol | source=src/features/people/components/app-role-history-card.tsx:L27 | neighbors=[app-role-history-card.tsx, page.tsx]
- "components_app_sprint_band_appsprintband": "AppSprintBand()" | kind=code-symbol | source=src/features/apps/components/app-sprint-band.tsx:L22 | neighbors=[app-sprint-band.tsx, page.tsx]
- "components_app_tab_nav_apptabnav": "AppTabNav()" | kind=code-symbol | source=src/features/apps/components/app-tab-nav.tsx:L14 | neighbors=[app-tab-nav.tsx, page.tsx]
- "components_appearance_card_appearancecard": "AppearanceCard()" | kind=code-symbol | source=src/features/settings/components/appearance-card.tsx:L60 | neighbors=[appearance-card.tsx, page.tsx]
- "components_apps_browser_emptyhint": "emptyHint()" | kind=code-symbol | source=src/features/apps/components/apps-browser.tsx:L33 | neighbors=[apps-browser.tsx, AppsBrowser()]
- "components_apps_table_appstable": "AppsTable()" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L326 | neighbors=[page.tsx, apps-table.tsx]
- "components_apps_table_leadcell": "LeadCell()" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L205 | neighbors=[apps-table.tsx, useRowRun()]
- "components_apps_table_pmcell": "PmCell()" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L226 | neighbors=[apps-table.tsx, useRowRun()]
- "components_apps_table_rowactions": "RowActions()" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L247 | neighbors=[apps-table.tsx, useRowRun()]
- "components_as_of_picker_asofpicker": "AsOfPicker()" | kind=code-symbol | source=src/features/people/components/as-of-picker.tsx:L32 | neighbors=[as-of-picker.tsx, page.tsx]
- "components_ask_bubble_askbubble": "AskBubble()" | kind=code-symbol | source=src/features/intel/components/ask-bubble.tsx:L49 | neighbors=[layout.tsx, ask-bubble.tsx]
- "components_ask_panel_answerbody": "AnswerBody()" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L437 | neighbors=[ask-panel.tsx, toParagraphs()]
- "components_ask_panel_askpanel": "AskPanel()" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L111 | neighbors=[ask-bubble.tsx, ask-panel.tsx]
- "components_ask_panel_readchat": "readChat()" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L51 | neighbors=[ask-panel.tsx, pushTurn()]
- "components_ask_panel_toparagraphs": "toParagraphs()" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L520 | neighbors=[ask-panel.tsx, AnswerBody()]
- "components_ask_panel_writechat": "writeChat()" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L75 | neighbors=[ask-panel.tsx, pushTurn()]
- "components_assignments_card_assignmentscard": "AssignmentsCard()" | kind=code-symbol | source=src/features/people/components/assignments-card.tsx:L55 | neighbors=[assignments-card.tsx, page.tsx]
- "components_attribution_inline_attributioninline": "AttributionInline()" | kind=code-symbol | source=src/features/meetings/components/attribution-inline.tsx:L48 | neighbors=[attribution-inline.tsx, meeting-notes.tsx]
- "components_audit_ask_auditask": "AuditAsk()" | kind=code-symbol | source=src/features/admin/components/audit-ask.tsx:L30 | neighbors=[audit-ask.tsx, audit-filter-bar.tsx]
- "components_audit_csv_button_auditcsvbutton": "AuditCsvButton()" | kind=code-symbol | source=src/features/admin/components/audit-csv-button.tsx:L32 | neighbors=[audit-csv-button.tsx, audit-trail.tsx]
- "components_audit_filter_bar_auditfilterbar": "AuditFilterBar()" | kind=code-symbol | source=src/features/admin/components/audit-filter-bar.tsx:L164 | neighbors=[page.tsx, audit-filter-bar.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-084.json

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
