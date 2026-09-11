# Node Description Batch 88 of 166

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

- "components_maintenance_controls_maintenancecontrols": "MaintenanceControls()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-controls.tsx:L54 | neighbors=[maintenance-controls.tsx, maintenance-gate.tsx]
- "components_maintenance_details_dialog_maintenancedetailsdialog": "MaintenanceDetailsDialog()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-details-dialog.tsx:L33 | neighbors=[maintenance-details-dialog.tsx, maintenance-gate.tsx]
- "components_maintenance_gate_bypasskey": "bypassKey()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-gate.tsx:L59 | neighbors=[maintenance-gate.tsx, readStoredBypass()]
- "components_maintenance_gate_canmanagemaintenance": "canManageMaintenance()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-gate.tsx:L81 | neighbors=[maintenance-gate.tsx, MaintenanceGate()]
- "components_maintenance_gate_readstoredbypass": "readStoredBypass()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-gate.tsx:L66 | neighbors=[maintenance-gate.tsx, bypassKey()]
- "components_maintenance_mount_maintenancemount": "MaintenanceMount()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-mount.tsx:L22 | neighbors=[layout.tsx, maintenance-mount.tsx]
- "components_maintenance_overlay_maintenanceauthnotice": "MaintenanceAuthNotice()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-overlay.tsx:L133 | neighbors=[maintenance-gate.tsx, maintenance-overlay.tsx]
- "components_maintenance_overlay_maintenanceoverlay": "MaintenanceOverlay()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-overlay.tsx:L36 | neighbors=[maintenance-gate.tsx, maintenance-overlay.tsx]
- "components_meeting_assistant_meetingassistant": "MeetingAssistant()" | kind=code-symbol | source=src/features/meetings/components/meeting-assistant.tsx:L30 | neighbors=[meeting-assistant.tsx, meeting-intel.tsx]
- "components_meeting_chips_capchips": "capChips()" | kind=code-symbol | source=src/features/meetings/components/meeting-chips.tsx:L170 | neighbors=[meeting-chips.tsx, meeting-list.tsx]
- "components_meeting_chips_countchip": "CountChip()" | kind=code-symbol | source=src/features/meetings/components/meeting-chips.tsx:L96 | neighbors=[meeting-chips.tsx, meeting-list.tsx]
- "components_meeting_chips_questionschip": "QuestionsChip()" | kind=code-symbol | source=src/features/meetings/components/meeting-chips.tsx:L191 | neighbors=[meeting-chips.tsx, meeting-list.tsx]
- "components_meeting_chips_reconveneschip": "ReconvenesChip()" | kind=code-symbol | source=src/features/meetings/components/meeting-chips.tsx:L183 | neighbors=[meeting-chips.tsx, meeting-list.tsx]
- "components_meeting_form_hostof": "hostOf()" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L182 | neighbors=[meeting-form.tsx, describeQuickAdd()]
- "components_meeting_form_quickaddproblems": "quickAddProblems()" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L208 | neighbors=[meeting-form.tsx, MeetingForm()]
- "components_meeting_glance_plural": "plural()" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L82 | neighbors=[meeting-glance.ts, MeetingTiming]
- "components_meeting_header_actions_meetingheaderactions": "MeetingHeaderActions()" | kind=code-symbol | source=src/features/meetings/components/meeting-header-actions.tsx:L38 | neighbors=[meeting-header-actions.tsx, page.tsx]
- "components_meeting_intel_event": "Event" | kind=code-symbol | neighbors=[SpeechRecognitionErrorEventLike, SpeechRecognitionEventLike]
- "components_meeting_intel_meetingintelpanel": "MeetingIntelPanel()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L547 | neighbors=[meeting-intel.tsx, meeting-intel-sheet.tsx]
- "components_meeting_intel_sheet_meetingintelsheet": "MeetingIntelSheet()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel-sheet.tsx:L89 | neighbors=[meeting-intel-sheet.tsx, meetings-views.tsx]
- "components_meeting_intel_speechrecognitionerroreventlike": "SpeechRecognitionErrorEventLike" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L210 | neighbors=[meeting-intel.tsx, Event]
- "components_meeting_intel_speechrecognitioneventlike": "SpeechRecognitionEventLike" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L206 | neighbors=[meeting-intel.tsx, Event]
- "components_meeting_intel_speechrecognitionlike": "SpeechRecognitionLike" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L213 | neighbors=[meeting-intel.tsx, EventTarget]
- "components_meeting_list_grouplabel": "groupLabel()" | kind=code-symbol | source=src/features/meetings/components/meeting-list.tsx:L333 | neighbors=[meeting-list.tsx, groupMeetings()]
- "components_meeting_load_admin_card_meetingloadadmincard": "MeetingLoadAdminCard()" | kind=code-symbol | source=src/features/meeting-load/components/meeting-load-admin-card.tsx:L25 | neighbors=[page.tsx, meeting-load-admin-card.tsx]
- "components_meeting_load_card_meetingloadcard": "MeetingLoadCard()" | kind=code-symbol | source=src/features/meeting-load/components/meeting-load-card.tsx:L22 | neighbors=[dashboard-zones.tsx, meeting-load-card.tsx]
- "components_meeting_load_link_meetingloadlink": "MeetingLoadLink()" | kind=code-symbol | source=src/features/meetings/components/meeting-load-link.tsx:L21 | neighbors=[meeting-load-link.tsx, page.tsx]
- "components_meeting_load_link_meetingloadlinkfallback": "MeetingLoadLinkFallback()" | kind=code-symbol | source=src/features/meetings/components/meeting-load-link.tsx:L42 | neighbors=[meeting-load-link.tsx, page.tsx]
- "components_meeting_load_trend_meetingloadtrend": "MeetingLoadTrend()" | kind=code-symbol | source=src/features/meeting-load/components/meeting-load-trend.tsx:L20 | neighbors=[meeting-load-card.tsx, meeting-load-trend.tsx]
- "components_meeting_notes_dialog_summaryblocks": "summaryBlocks()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-dialog.tsx:L344 | neighbors=[meeting-notes-dialog.tsx, MeetingNotesDialog()]
- "components_meeting_notes_meetingnotesempty": "MeetingNotesEmpty()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes.tsx:L987 | neighbors=[meeting-intel.tsx, meeting-notes.tsx]
- "components_meeting_notes_model_actionitempromoter": "ActionItemPromoter" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L287 | neighbors=[meeting-notes.tsx, meeting-notes-model.ts]
- "components_meeting_notes_model_promoteoutcome": "PromoteOutcome" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L285 | neighbors=[meeting-notes-model.ts, meeting-notes-model.test.ts]
- "components_meeting_notes_resolvesummaryblocks": "resolveSummaryBlocks()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes.tsx:L666 | neighbors=[meeting-notes.tsx, MeetingAiNotes()]
- "components_meeting_panels_emptyfilterstate": "EmptyFilterState()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L695 | neighbors=[meeting-notes.tsx, meeting-panels.tsx]
- "components_meeting_panels_getdensitysnapshot": "getDensitySnapshot()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L192 | neighbors=[meeting-panels.tsx, readStored()]
- "components_meeting_panels_getsummarylanguagesnapshot": "getSummaryLanguageSnapshot()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L229 | neighbors=[meeting-panels.tsx, readStored()]
- "components_meeting_panels_kind_meta": "KIND_META" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L59 | neighbors=[meeting-intel.tsx, meeting-panels.tsx]
- "components_meeting_panels_kindaccentclass": "kindAccentClass()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L72 | neighbors=[meeting-panels.tsx, Panel()]
- "components_meeting_panels_meetingpanelsprovider": "MeetingPanelsProvider()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L264 | neighbors=[meeting-intel.tsx, meeting-panels.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-087.json

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
