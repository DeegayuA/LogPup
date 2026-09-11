# Node Description Batch 131 of 166

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

- "components_roadmap_spine_remaininglabel": "remainingLabel()" | kind=code-symbol | source=src/features/sprints/components/roadmap-spine.tsx:L97 | neighbors=[roadmap-spine.tsx]
- "components_roadmap_spine_spinesprint": "SpineSprint" | kind=code-symbol | source=src/features/sprints/components/roadmap-spine.tsx:L42 | neighbors=[roadmap-spine.tsx]
- "components_roadmap_timeline_activedrag": "ActiveDrag" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L157 | neighbors=[roadmap-timeline.tsx]
- "components_roadmap_timeline_barmeta": "BarMeta()" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L1251 | neighbors=[roadmap-timeline.tsx]
- "components_roadmap_timeline_barmetalevel": "BarMetaLevel" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L1249 | neighbors=[roadmap-timeline.tsx]
- "components_roadmap_timeline_dragkind": "DragKind" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L156 | neighbors=[roadmap-timeline.tsx]
- "components_roadmap_timeline_no_tasks": "NO_TASKS" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L136 | neighbors=[roadmap-timeline.tsx]
- "components_roadmap_timeline_pad_days": "PAD_DAYS" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L92 | neighbors=[roadmap-timeline.tsx]
- "components_roadmap_timeline_parsedragid": "parseDragId()" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L162 | neighbors=[roadmap-timeline.tsx]
- "components_roadmap_timeline_status_bar": "STATUS_BAR" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L142 | neighbors=[roadmap-timeline.tsx]
- "components_roadmap_timeline_status_label": "STATUS_LABEL" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L150 | neighbors=[roadmap-timeline.tsx]
- "components_roadmap_timeline_tick": "Tick" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L184 | neighbors=[roadmap-timeline.tsx]
- "components_seat_select_seat_groups": "SEAT_GROUPS" | kind=code-symbol | source=src/features/admin/components/seat-select.tsx:L24 | neighbors=[seat-select.tsx]
- "components_sign_in_backdrop_rings": "RINGS" | kind=code-symbol | source=src/features/auth/components/sign-in-backdrop.tsx:L7 | neighbors=[sign-in-backdrop.tsx]
- "components_sign_in_backdrop_ringvars": "RingVars" | kind=code-symbol | source=src/features/auth/components/sign-in-backdrop.tsx:L19 | neighbors=[sign-in-backdrop.tsx]
- "components_sign_in_methods_lastusedtag": "LastUsedTag()" | kind=code-symbol | source=src/features/auth/components/sign-in-methods.tsx:L70 | neighbors=[sign-in-methods.tsx]
- "components_sign_in_methods_methods": "METHODS" | kind=code-symbol | source=src/features/auth/components/sign-in-methods.tsx:L32 | neighbors=[sign-in-methods.tsx]
- "components_sign_in_methods_remembersigninmethod": "rememberSignInMethod()" | kind=code-symbol | source=src/features/auth/components/sign-in-methods.tsx:L51 | neighbors=[sign-in-methods.tsx]
- "components_sign_in_methods_signinmethod": "SignInMethod" | kind=code-symbol | source=src/features/auth/components/sign-in-methods.tsx:L29 | neighbors=[sign-in-methods.tsx]
- "components_signal_board_filter": "Filter" | kind=code-symbol | source=src/features/intel/components/signal-board.tsx:L58 | neighbors=[signal-board.tsx]
- "components_signal_board_severity": "SEVERITY" | kind=code-symbol | source=src/features/intel/components/signal-board.tsx:L34 | neighbors=[signal-board.tsx]
- "components_signal_board_severity_order": "SEVERITY_ORDER" | kind=code-symbol | source=src/features/intel/components/signal-board.tsx:L23 | neighbors=[signal-board.tsx]
- "components_signal_board_signalrow": "SignalRow()" | kind=code-symbol | source=src/features/intel/components/signal-board.tsx:L229 | neighbors=[signal-board.tsx]
- "components_signal_board_tally": "tally()" | kind=code-symbol | source=src/features/intel/components/signal-board.tsx:L297 | neighbors=[signal-board.tsx]
- "components_signals_view_verdict_copy": "VERDICT_COPY" | kind=code-symbol | source=src/features/signals/components/signals-view.tsx:L26 | neighbors=[signals-view.tsx]
- "components_speaker_assignment_pendingassignment": "PendingAssignment" | kind=code-symbol | source=src/features/meetings/components/speaker-assignment.tsx:L36 | neighbors=[speaker-assignment.tsx]
- "components_speaker_assignment_speakerassignment": "SpeakerAssignment()" | kind=code-symbol | source=src/features/meetings/components/speaker-assignment.tsx:L78 | neighbors=[speaker-assignment.tsx]
- "components_speaker_assignment_speakerassignmentpanel": "SpeakerAssignmentPanel()" | kind=code-symbol | source=src/features/meetings/components/speaker-assignment.tsx:L359 | neighbors=[speaker-assignment.tsx]
- "components_speaker_assignment_speakerlabelchip": "SpeakerLabelChip()" | kind=code-symbol | source=src/features/meetings/components/speaker-assignment.tsx:L58 | neighbors=[speaker-assignment.tsx]
- "components_sprint_checkin_editor_reportedcheckin": "ReportedCheckin" | kind=code-symbol | source=src/features/sprints/components/sprint-checkin-editor.tsx:L10 | neighbors=[sprint-checkin-editor.tsx]
- "components_sprint_checkins_person": "Person" | kind=code-symbol | source=src/features/sprints/components/sprint-checkins.tsx:L10 | neighbors=[sprint-checkins.tsx]
- "components_sprint_edit_dialog_empty": "EMPTY" | kind=code-symbol | source=src/features/sprints/components/sprint-edit-dialog.tsx:L64 | neighbors=[sprint-edit-dialog.tsx]
- "components_sprint_edit_dialog_formstate": "FormState" | kind=code-symbol | source=src/features/sprints/components/sprint-edit-dialog.tsx:L52 | neighbors=[sprint-edit-dialog.tsx]
- "components_sprint_edit_dialog_status": "Status" | kind=code-symbol | source=src/features/sprints/components/sprint-edit-dialog.tsx:L42 | neighbors=[sprint-edit-dialog.tsx]
- "components_sprint_edit_dialog_status_options": "STATUS_OPTIONS" | kind=code-symbol | source=src/features/sprints/components/sprint-edit-dialog.tsx:L44 | neighbors=[sprint-edit-dialog.tsx]
- "components_sprint_form_dialog_fielderrors": "FieldErrors" | kind=code-symbol | source=src/features/sprints/components/sprint-form-dialog.tsx:L35 | neighbors=[sprint-form-dialog.tsx]
- "components_sprint_form_dialog_formstate": "FormState" | kind=code-symbol | source=src/features/sprints/components/sprint-form-dialog.tsx:L28 | neighbors=[sprint-form-dialog.tsx]
- "components_sprint_form_dialog_identifyfield": "identifyField()" | kind=code-symbol | source=src/features/sprints/components/sprint-form-dialog.tsx:L60 | neighbors=[sprint-form-dialog.tsx]
- "components_sprint_status_select_status": "Status" | kind=code-symbol | source=src/features/sprints/components/sprint-status-select.tsx:L14 | neighbors=[sprint-status-select.tsx]
- "components_sprint_status_select_status_options": "STATUS_OPTIONS" | kind=code-symbol | source=src/features/sprints/components/sprint-status-select.tsx:L16 | neighbors=[sprint-status-select.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-130.json

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
