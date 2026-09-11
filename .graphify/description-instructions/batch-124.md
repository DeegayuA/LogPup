# Node Description Batch 125 of 166

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

- "components_directory_writefilterparams": "writeFilterParams()" | kind=code-symbol | source=src/features/people/components/directory.tsx:L75 | neighbors=[directory.tsx]
- "components_employment_select_labels": "LABELS" | kind=code-symbol | source=src/features/admin/components/employment-select.tsx:L19 | neighbors=[employment-select.tsx]
- "components_gemini_keys_card_geminikeyrowitem": "GeminiKeyRowItem()" | kind=code-symbol | source=src/features/gemini/components/gemini-keys-card.tsx:L216 | neighbors=[gemini-keys-card.tsx]
- "components_gemini_keys_card_usedbyrow": "UsedByRow" | kind=code-symbol | source=src/features/gemini/components/gemini-keys-card.tsx:L41 | neighbors=[gemini-keys-card.tsx]
- "components_google_one_tap_credentialresponse": "CredentialResponse" | kind=code-symbol | source=src/features/auth/components/google-one-tap.tsx:L27 | neighbors=[google-one-tap.tsx]
- "components_google_one_tap_googleidapi": "GoogleIdApi" | kind=code-symbol | source=src/features/auth/components/google-one-tap.tsx:L29 | neighbors=[google-one-tap.tsx]
- "components_google_one_tap_window": "Window" | kind=code-symbol | source=src/features/auth/components/google-one-tap.tsx:L47 | neighbors=[google-one-tap.tsx]
- "components_handover_form_action_moves": "ACTION_MOVES" | kind=code-symbol | source=src/features/people/components/handover-form.tsx:L31 | neighbors=[handover-form.tsx]
- "components_handover_form_manual_note": "MANUAL_NOTE" | kind=code-symbol | source=src/features/people/components/handover-form.tsx:L34 | neighbors=[handover-form.tsx]
- "components_health_dot_dot": "DOT" | kind=code-symbol | source=src/features/apps/components/health-dot.tsx:L22 | neighbors=[health-dot.tsx]
- "components_health_dot_text": "TEXT" | kind=code-symbol | source=src/features/apps/components/health-dot.tsx:L29 | neighbors=[health-dot.tsx]
- "components_history_filters_historyfiltersinner": "HistoryFiltersInner()" | kind=code-symbol | source=src/features/people/components/history-filters.tsx:L40 | neighbors=[history-filters.tsx]
- "components_history_views_band_word": "BAND_WORD" | kind=code-symbol | source=src/features/people/components/history-views.tsx:L107 | neighbors=[history-views.tsx]
- "components_history_views_clearfilterbutton": "ClearFilterButton()" | kind=code-symbol | source=src/features/people/components/history-views.tsx:L99 | neighbors=[history-views.tsx]
- "components_history_views_deltabadge": "DeltaBadge()" | kind=code-symbol | source=src/features/people/components/history-views.tsx:L45 | neighbors=[history-views.tsx]
- "components_history_views_personcell": "PersonCell()" | kind=code-symbol | source=src/features/people/components/history-views.tsx:L70 | neighbors=[history-views.tsx]
- "components_intel_skeletons_askpanelskeleton": "AskPanelSkeleton()" | kind=code-symbol | source=src/features/intel/components/intel-skeletons.tsx:L89 | neighbors=[intel-skeletons.tsx]
- "components_intel_skeletons_signalboardskeleton": "SignalBoardSkeleton()" | kind=code-symbol | source=src/features/intel/components/intel-skeletons.tsx:L56 | neighbors=[intel-skeletons.tsx]
- "components_intel_view_load": "Load" | kind=code-symbol | source=src/features/intel/components/intel-view.tsx:L45 | neighbors=[intel-view.tsx]
- "components_intel_view_regionerror": "RegionError()" | kind=code-symbol | source=src/features/intel/components/intel-view.tsx:L162 | neighbors=[intel-view.tsx]
- "components_live_transcription_status_status_copy": "STATUS_COPY" | kind=code-symbol | source=src/features/transcription/components/live-transcription-status.tsx:L22 | neighbors=[live-transcription-status.tsx]
- "components_live_transcription_status_statusicon": "StatusIcon()" | kind=code-symbol | source=src/features/transcription/components/live-transcription-status.tsx:L90 | neighbors=[live-transcription-status.tsx]
- "components_load_board_suggestioncard": "SuggestionCard()" | kind=code-symbol | source=src/features/meetings/components/load-board.tsx:L81 | neighbors=[load-board.tsx]
- "components_log_box_daylabel": "dayLabel()" | kind=code-symbol | source=src/features/worklog/components/log-box.tsx:L1079 | neighbors=[log-box.tsx]
- "components_log_box_derivedscorefor": "derivedScoreFor()" | kind=code-symbol | source=src/features/worklog/components/log-box.tsx:L1094 | neighbors=[log-box.tsx]
- "components_log_box_hassomethingtosave": "hasSomethingToSave()" | kind=code-symbol | source=src/features/worklog/components/log-box.tsx:L1105 | neighbors=[log-box.tsx]
- "components_log_box_reviewday": "ReviewDay" | kind=code-symbol | source=src/features/worklog/components/log-box.tsx:L101 | neighbors=[log-box.tsx]
- "components_log_box_score_presets": "SCORE_PRESETS" | kind=code-symbol | source=src/features/worklog/components/log-box.tsx:L90 | neighbors=[log-box.tsx]
- "components_log_box_token_class": "TOKEN_CLASS" | kind=code-symbol | source=src/features/worklog/components/log-box.tsx:L80 | neighbors=[log-box.tsx]
- "components_logged_days_list_loggedday": "LoggedDay" | kind=code-symbol | source=src/features/worklog/components/logged-days-list.tsx:L31 | neighbors=[logged-days-list.tsx]
- "components_maintenance_gate_auth_paths": "AUTH_PATHS" | kind=code-symbol | source=src/features/maintenance/components/maintenance-gate.tsx:L52 | neighbors=[maintenance-gate.tsx]
- "components_maintenance_gate_bypass": "Bypass" | kind=code-symbol | source=src/features/maintenance/components/maintenance-gate.tsx:L57 | neighbors=[maintenance-gate.tsx]
- "components_maintenance_gate_never_changes": "NEVER_CHANGES()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-gate.tsx:L64 | neighbors=[maintenance-gate.tsx]
- "components_maintenance_gate_print_paths": "PRINT_PATHS" | kind=code-symbol | source=src/features/maintenance/components/maintenance-gate.tsx:L55 | neighbors=[maintenance-gate.tsx]
- "components_maintenance_gate_samewindow": "sameWindow()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-gate.tsx:L85 | neighbors=[maintenance-gate.tsx]
- "components_maintenance_gate_sha256hex": "sha256Hex()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-gate.tsx:L76 | neighbors=[maintenance-gate.tsx]
- "components_markdown_lite_renderinline": "renderInline()" | kind=code-symbol | source=src/components/markdown-lite.tsx:L13 | neighbors=[markdown-lite.tsx]
- "components_meeting_chips_chip_tone": "CHIP_TONE" | kind=code-symbol | source=src/features/meetings/components/meeting-chips.tsx:L53 | neighbors=[meeting-chips.tsx]
- "components_meeting_detail_dialog_meetingdetailbody": "MeetingDetailBody()" | kind=code-symbol | source=src/features/meetings/components/meeting-detail-dialog.tsx:L223 | neighbors=[meeting-detail-dialog.tsx]
- "components_meeting_detail_dialog_response_label": "RESPONSE_LABEL" | kind=code-symbol | source=src/features/meetings/components/meeting-detail-dialog.tsx:L68 | neighbors=[meeting-detail-dialog.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-124.json

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
