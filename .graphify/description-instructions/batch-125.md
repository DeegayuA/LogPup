# Node Description Batch 126 of 166

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

- "components_meeting_detail_dialog_section": "Section()" | kind=code-symbol | source=src/features/meetings/components/meeting-detail-dialog.tsx:L75 | neighbors=[meeting-detail-dialog.tsx]
- "components_meeting_form_editablemeeting": "EditableMeeting" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L230 | neighbors=[meeting-form.tsx]
- "components_meeting_form_emptystate": "emptyState()" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L117 | neighbors=[meeting-form.tsx]
- "components_meeting_form_formstate": "FormState" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L58 | neighbors=[meeting-form.tsx]
- "components_meeting_form_quickaddpreview": "QuickAddPreview" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L153 | neighbors=[meeting-form.tsx]
- "components_meeting_form_resolvequickadd": "resolveQuickAdd()" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L161 | neighbors=[meeting-form.tsx]
- "components_meeting_form_statefrommeeting": "stateFromMeeting()" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L243 | neighbors=[meeting-form.tsx]
- "components_meeting_form_withteamprefill": "withTeamPrefill()" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L92 | neighbors=[meeting-form.tsx]
- "components_meeting_glance_meetingsoverview": "MeetingsOverview" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L137 | neighbors=[meeting-glance.ts]
- "components_meeting_glance_meetingstate": "MeetingState" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L67 | neighbors=[meeting-glance.ts]
- "components_meeting_glance_overviewmeeting": "OverviewMeeting" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L131 | neighbors=[meeting-glance.ts]
- "components_meeting_glance_rsvptally": "RsvpTally" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L16 | neighbors=[meeting-glance.ts]
- "components_meeting_glance_test_attendee": "attendee()" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.test.ts:L14 | neighbors=[meeting-glance.test.ts]
- "components_meeting_glance_test_meeting": "meeting()" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.test.ts:L162 | neighbors=[meeting-glance.test.ts]
- "components_meeting_glance_test_now": "now" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.test.ts:L12 | neighbors=[meeting-glance.test.ts]
- "components_meeting_glance_test_timing": "timing()" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.test.ts:L93 | neighbors=[meeting-glance.test.ts]
- "components_meeting_header_actions_splithalf": "SplitHalf()" | kind=code-symbol | source=src/features/meetings/components/meeting-header-actions.tsx:L143 | neighbors=[meeting-header-actions.tsx]
- "components_meeting_intel_active_language_label": "ACTIVE_LANGUAGE_LABEL" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L304 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_addfollowupform": "AddFollowupForm()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L4630 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_aroundthetablepanel": "AroundTheTablePanel()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L455 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_capturemode": "CaptureMode" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L251 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_composer_copy": "COMPOSER_COPY" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L389 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_composerfield": "ComposerField" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L386 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_draftkey": "draftKey()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L436 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_eventtarget": "EventTarget" | kind=code-symbol | neighbors=[SpeechRecognitionLike]
- "components_meeting_intel_followuprow": "FollowupRow()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L4263 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_formatbytes": "formatBytes()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L336 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_intelskeleton": "IntelSkeleton()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L4116 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_language_options": "LANGUAGE_OPTIONS" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L285 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_languagepreference": "LanguagePreference" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L284 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_linked_task_status_label": "LINKED_TASK_STATUS_LABEL" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L4140 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_linked_task_status_tone": "LINKED_TASK_STATUS_TONE" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L4145 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_linkedtaskchip": "LinkedTaskChip()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L4157 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_opencomposer": "OpenComposer" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L387 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_otherlanguage": "otherLanguage()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L308 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_parselanguagepreference": "parseLanguagePreference()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L295 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_permanent_recognition_errors": "PERMANENT_RECOGNITION_ERRORS" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L262 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_pickmimetype": "pickMimeType()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L328 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_plannerwithnoteshandoff": "PlannerWithNotesHandoff()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L525 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_planthemeetingpanel": "PlanTheMeetingPanel()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L489 | neighbors=[meeting-intel.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-125.json

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
