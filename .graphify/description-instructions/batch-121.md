# Node Description Batch 122 of 166

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

- "components_app_role_history_card_role_dot": "ROLE_DOT" | kind=code-symbol | source=src/features/people/components/app-role-history-card.tsx:L15 | neighbors=[app-role-history-card.tsx]
- "components_app_role_history_card_role_label": "ROLE_LABEL" | kind=code-symbol | source=src/features/people/components/app-role-history-card.tsx:L14 | neighbors=[app-role-history-card.tsx]
- "components_appearance_card_accent_labels": "ACCENT_LABELS" | kind=code-symbol | source=src/features/settings/components/appearance-card.tsx:L36 | neighbors=[appearance-card.tsx]
- "components_appearance_card_options": "OPTIONS" | kind=code-symbol | source=src/features/settings/components/appearance-card.tsx:L19 | neighbors=[appearance-card.tsx]
- "components_apps_table_apps": "APPS" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L73 | neighbors=[apps-table.tsx]
- "components_apps_table_csv_headers": "CSV_HEADERS" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L324 | neighbors=[apps-table.tsx]
- "components_apps_table_labelled": "Labelled()" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L166 | neighbors=[apps-table.tsx]
- "components_apps_table_leadselect": "LeadSelect()" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L84 | neighbors=[apps-table.tsx]
- "components_apps_table_pmselect": "PmSelect()" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L128 | neighbors=[apps-table.tsx]
- "components_apps_table_status_label": "STATUS_LABEL" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L66 | neighbors=[apps-table.tsx]
- "components_apps_table_status_variant": "STATUS_VARIANT" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L60 | neighbors=[apps-table.tsx]
- "components_as_of_picker_presets": "PRESETS" | kind=code-symbol | source=src/features/people/components/as-of-picker.tsx:L14 | neighbors=[as-of-picker.tsx]
- "components_ask_panel_answerpending": "AnswerPending()" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L504 | neighbors=[ask-panel.tsx]
- "components_ask_panel_asked_at": "ASKED_AT" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L102 | neighbors=[ask-panel.tsx]
- "components_ask_panel_askedbubble": "AskedBubble()" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L416 | neighbors=[ask-panel.tsx]
- "components_ask_panel_clearchat": "clearChat()" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L91 | neighbors=[ask-panel.tsx]
- "components_ask_panel_no_chat": "NO_CHAT" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L44 | neighbors=[ask-panel.tsx]
- "components_ask_panel_subscribetochat": "subscribeToChat()" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L66 | neighbors=[ask-panel.tsx]
- "components_assign_dialog_assignsubject": "AssignSubject" | kind=code-symbol | source=src/features/people/components/assign-dialog.tsx:L35 | neighbors=[assign-dialog.tsx]
- "components_assignments_card_app_status_label": "APP_STATUS_LABEL" | kind=code-symbol | source=src/features/people/components/assignments-card.tsx:L32 | neighbors=[assignments-card.tsx]
- "components_audit_csv_button_audit_csv_headers": "AUDIT_CSV_HEADERS" | kind=code-symbol | source=src/features/admin/components/audit-csv-button.tsx:L8 | neighbors=[audit-csv-button.tsx]
- "components_audit_filter_bar_datefilter": "DateFilter()" | kind=code-symbol | source=src/features/admin/components/audit-filter-bar.tsx:L38 | neighbors=[audit-filter-bar.tsx]
- "components_audit_filter_bar_searchfilter": "SearchFilter()" | kind=code-symbol | source=src/features/admin/components/audit-filter-bar.tsx:L79 | neighbors=[audit-filter-bar.tsx]
- "components_audit_skeleton_dayskeleton": "DaySkeleton()" | kind=code-symbol | source=src/features/admin/components/audit-skeleton.tsx:L50 | neighbors=[audit-skeleton.tsx]
- "components_audit_skeleton_row_widths": "ROW_WIDTHS" | kind=code-symbol | source=src/features/admin/components/audit-skeleton.tsx:L48 | neighbors=[audit-skeleton.tsx]
- "components_audit_trail_appchip": "AppChip()" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L134 | neighbors=[audit-trail.tsx]
- "components_audit_trail_auditempty": "AuditEmpty()" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L381 | neighbors=[audit-trail.tsx]
- "components_audit_trail_auditrow": "AuditRow()" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L251 | neighbors=[audit-trail.tsx]
- "components_audit_trail_daymarker": "DayMarker()" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L325 | neighbors=[audit-trail.tsx]
- "components_audit_trail_empty_copy": "EMPTY_COPY" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L366 | neighbors=[audit-trail.tsx]
- "components_audit_trail_filterlink": "FilterLink()" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L54 | neighbors=[audit-trail.tsx]
- "components_audit_trail_pager": "Pager()" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L425 | neighbors=[audit-trail.tsx]
- "components_audit_trail_rowdetails": "RowDetails()" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L192 | neighbors=[audit-trail.tsx]
- "components_audit_trail_selfapprovedchip": "SelfApprovedChip()" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L159 | neighbors=[audit-trail.tsx]
- "components_audit_trail_sortstrip": "SortStrip()" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L86 | neighbors=[audit-trail.tsx]
- "components_audit_trail_subject": "Subject()" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L172 | neighbors=[audit-trail.tsx]
- "components_avatar_upload_tosquarewebp": "toSquareWebp()" | kind=code-symbol | source=src/features/auth/components/avatar-upload.tsx:L18 | neighbors=[avatar-upload.tsx]
- "components_board_applymove": "applyMove()" | kind=code-symbol | source=src/features/sprints/components/board.tsx:L77 | neighbors=[board.tsx]
- "components_board_optimisticmove": "OptimisticMove" | kind=code-symbol | source=src/features/sprints/components/board.tsx:L58 | neighbors=[board.tsx]
- "components_board_skeleton_bar": "Bar()" | kind=code-symbol | source=src/features/sprints/components/board-skeleton.tsx:L27 | neighbors=[board-skeleton.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-121.json

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
