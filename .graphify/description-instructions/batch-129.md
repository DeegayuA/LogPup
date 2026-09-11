# Node Description Batch 130 of 166

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

- "components_note_timeline_model_duedateclassification": "DueDateClassification" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L97 | neighbors=[note-timeline-model.ts]
- "components_note_timeline_model_suggestionupdatepayload": "SuggestionUpdatePayload" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L58 | neighbors=[note-timeline-model.ts]
- "components_note_timeline_model_taskupdatepayload": "TaskUpdatePayload" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L64 | neighbors=[note-timeline-model.ts]
- "components_note_timeline_source_meta": "SOURCE_META" | kind=code-symbol | source=src/features/meetings/components/note-timeline.tsx:L79 | neighbors=[note-timeline.tsx]
- "components_notification_bell_client_iconfor": "iconFor()" | kind=code-symbol | source=src/features/notifications/components/notification-bell-client.tsx:L46 | neighbors=[notification-bell-client.tsx]
- "components_notification_bell_client_notification_icons": "NOTIFICATION_ICONS" | kind=code-symbol | source=src/features/notifications/components/notification-bell-client.tsx:L40 | neighbors=[notification-bell-client.tsx]
- "components_notification_bell_client_samesnapshot": "sameSnapshot()" | kind=code-symbol | source=src/features/notifications/components/notification-bell-client.tsx:L29 | neighbors=[notification-bell-client.tsx]
- "components_notifications_card_icons": "ICONS" | kind=code-symbol | source=src/features/dashboard/components/notifications-card.tsx:L9 | neighbors=[notifications-card.tsx]
- "components_notifications_card_rowbody": "RowBody()" | kind=code-symbol | source=src/features/dashboard/components/notifications-card.tsx:L22 | neighbors=[notifications-card.tsx]
- "components_pending_absence_list_pendingabsencerow": "PendingAbsenceRow()" | kind=code-symbol | source=src/features/worklog/components/pending-absence-list.tsx:L57 | neighbors=[pending-absence-list.tsx]
- "components_pending_approvals_card_pendingrow": "PendingRow()" | kind=code-symbol | source=src/features/admin/components/pending-approvals-card.tsx:L40 | neighbors=[pending-approvals-card.tsx]
- "components_person_activity_card_cell_classes": "CELL_CLASSES" | kind=code-symbol | source=src/features/people/components/person-activity-card.tsx:L39 | neighbors=[person-activity-card.tsx]
- "components_person_activity_card_swatch": "SWATCH" | kind=code-symbol | source=src/features/people/components/person-activity-card.tsx:L48 | neighbors=[person-activity-card.tsx]
- "components_person_followups_card_followuplist": "FollowupList()" | kind=code-symbol | source=src/features/people/components/person-followups-card.tsx:L99 | neighbors=[person-followups-card.tsx]
- "components_person_followups_card_followuprow": "FollowupRow()" | kind=code-symbol | source=src/features/people/components/person-followups-card.tsx:L149 | neighbors=[person-followups-card.tsx]
- "components_person_hover_card_personcardbody": "PersonCardBody()" | kind=code-symbol | source=src/features/people/components/person-hover-card.tsx:L98 | neighbors=[person-hover-card.tsx]
- "components_person_meetings_card_meetinglist": "MeetingList()" | kind=code-symbol | source=src/features/people/components/person-meetings-card.tsx:L101 | neighbors=[person-meetings-card.tsx]
- "components_person_meetings_card_response_class": "RESPONSE_CLASS" | kind=code-symbol | source=src/features/people/components/person-meetings-card.tsx:L28 | neighbors=[person-meetings-card.tsx]
- "components_person_meetings_card_response_label": "RESPONSE_LABEL" | kind=code-symbol | source=src/features/people/components/person-meetings-card.tsx:L21 | neighbors=[person-meetings-card.tsx]
- "components_person_stat_row_ring_tone": "RING_TONE" | kind=code-symbol | source=src/features/people/components/person-stat-row.tsx:L32 | neighbors=[person-stat-row.tsx]
- "components_person_stat_row_value_tone": "VALUE_TONE" | kind=code-symbol | source=src/features/people/components/person-stat-row.tsx:L26 | neighbors=[person-stat-row.tsx]
- "components_person_tasks_card_due_dot": "DUE_DOT" | kind=code-symbol | source=src/features/people/components/person-tasks-card.tsx:L27 | neighbors=[person-tasks-card.tsx]
- "components_person_tasks_card_due_tone": "DUE_TONE" | kind=code-symbol | source=src/features/people/components/person-tasks-card.tsx:L19 | neighbors=[person-tasks-card.tsx]
- "components_person_tasks_card_priority_dot": "PRIORITY_DOT" | kind=code-symbol | source=src/features/people/components/person-tasks-card.tsx:L43 | neighbors=[person-tasks-card.tsx]
- "components_person_tasks_card_priority_label": "PRIORITY_LABEL" | kind=code-symbol | source=src/features/people/components/person-tasks-card.tsx:L50 | neighbors=[person-tasks-card.tsx]
- "components_person_tasks_card_status_label": "STATUS_LABEL" | kind=code-symbol | source=src/features/people/components/person-tasks-card.tsx:L35 | neighbors=[person-tasks-card.tsx]
- "components_portfolio_summary_tile": "Tile" | kind=code-symbol | source=src/features/apps/components/portfolio-summary.tsx:L23 | neighbors=[portfolio-summary.tsx]
- "components_progress_apps_lane_initials": "initials()" | kind=code-symbol | source=src/features/worklog/components/progress-apps-lane.tsx:L35 | neighbors=[progress-apps-lane.tsx]
- "components_progress_matrix_formatminutes": "formatMinutes()" | kind=code-symbol | source=src/features/worklog/components/progress-matrix.tsx:L317 | neighbors=[progress-matrix.tsx]
- "components_progress_matrix_initials": "initials()" | kind=code-symbol | source=src/features/worklog/components/progress-matrix.tsx:L40 | neighbors=[progress-matrix.tsx]
- "components_progress_matrix_legend_states": "LEGEND_STATES" | kind=code-symbol | source=src/features/worklog/components/progress-matrix.tsx:L63 | neighbors=[progress-matrix.tsx]
- "components_progress_matrix_mixlegend": "MixLegend()" | kind=code-symbol | source=src/features/worklog/components/progress-matrix.tsx:L335 | neighbors=[progress-matrix.tsx]
- "components_progress_matrix_mixtitle": "mixTitle()" | kind=code-symbol | source=src/features/worklog/components/progress-matrix.tsx:L312 | neighbors=[progress-matrix.tsx]
- "components_project_finance_card_figure": "Figure()" | kind=code-symbol | source=src/features/finance/components/project-finance-card.tsx:L56 | neighbors=[project-finance-card.tsx]
- "components_recording_takes_describetake": "describeTake()" | kind=code-symbol | source=src/features/meetings/components/recording-takes.tsx:L228 | neighbors=[recording-takes.tsx]
- "components_replace_review_dialog_keyof": "keyOf()" | kind=code-symbol | source=src/features/meetings/components/replace-review-dialog.tsx:L26 | neighbors=[replace-review-dialog.tsx]
- "components_replace_review_dialog_kind_word": "KIND_WORD" | kind=code-symbol | source=src/features/meetings/components/replace-review-dialog.tsx:L36 | neighbors=[replace-review-dialog.tsx]
- "components_replace_review_dialog_replaceorigin": "ReplaceOrigin" | kind=code-symbol | source=src/features/meetings/components/replace-review-dialog.tsx:L54 | neighbors=[replace-review-dialog.tsx]
- "components_request_change_dialog_requestchangedialog": "RequestChangeDialog()" | kind=code-symbol | source=src/features/admin/components/request-change-dialog.tsx:L17 | neighbors=[request-change-dialog.tsx]
- "components_roadmap_spine_health_fill": "HEALTH_FILL" | kind=code-symbol | source=src/features/sprints/components/roadmap-spine.tsx:L68 | neighbors=[roadmap-spine.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-129.json

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
