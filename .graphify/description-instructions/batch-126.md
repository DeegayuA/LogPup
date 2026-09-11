# Node Description Batch 127 of 166

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

- "components_meeting_intel_recordingsegment": "RecordingSegment" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L351 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_sheet_meetingintelsheetbody": "MeetingIntelSheetBody()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel-sheet.tsx:L183 | neighbors=[meeting-intel-sheet.tsx]
- "components_meeting_intel_sheet_response_word": "RESPONSE_WORD" | kind=code-symbol | source=src/features/meetings/components/meeting-intel-sheet.tsx:L63 | neighbors=[meeting-intel-sheet.tsx]
- "components_meeting_intel_singleenginenotice": "singleEngineNotice()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L320 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_speechrecognitionalternativelike": "SpeechRecognitionAlternativeLike" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L190 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_speechrecognitionconstructorlike": "SpeechRecognitionConstructorLike" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L230 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_speechrecognitionresultlike": "SpeechRecognitionResultLike" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L197 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_speechrecognitionresultlistlike": "SpeechRecognitionResultListLike" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L202 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_storedvalue": "storedValue()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L440 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_unattributedrow": "UnattributedRow()" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L4192 | neighbors=[meeting-intel.tsx]
- "components_meeting_intel_window": "Window" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L234 | neighbors=[meeting-intel.tsx]
- "components_meeting_list_chipbutton": "ChipButton()" | kind=code-symbol | source=src/features/meetings/components/meeting-list.tsx:L369 | neighbors=[meeting-list.tsx]
- "components_meeting_list_inlinersvp": "InlineRsvp()" | kind=code-symbol | source=src/features/meetings/components/meeting-list.tsx:L569 | neighbors=[meeting-list.tsx]
- "components_meeting_list_meetinglistgroupby": "MeetingListGroupBy" | kind=code-symbol | source=src/features/meetings/components/meeting-list.tsx:L107 | neighbors=[meeting-list.tsx]
- "components_meeting_list_meetingrow": "MeetingRow()" | kind=code-symbol | source=src/features/meetings/components/meeting-list.tsx:L634 | neighbors=[meeting-list.tsx]
- "components_meeting_list_response_word": "RESPONSE_WORD" | kind=code-symbol | source=src/features/meetings/components/meeting-list.tsx:L95 | neighbors=[meeting-list.tsx]
- "components_meeting_list_rowchips": "RowChips()" | kind=code-symbol | source=src/features/meetings/components/meeting-list.tsx:L388 | neighbors=[meeting-list.tsx]
- "components_meeting_list_timingchip": "TimingChip()" | kind=code-symbol | source=src/features/meetings/components/meeting-list.tsx:L352 | neighbors=[meeting-list.tsx]
- "components_meeting_notes_dialog_actionline": "ActionLine()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-dialog.tsx:L367 | neighbors=[meeting-notes-dialog.tsx]
- "components_meeting_notes_dialog_duechip": "DueChip()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-dialog.tsx:L409 | neighbors=[meeting-notes-dialog.tsx]
- "components_meeting_notes_dialog_notesskeleton": "NotesSkeleton()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-dialog.tsx:L442 | neighbors=[meeting-notes-dialog.tsx]
- "components_meeting_notes_dialog_suggestionstate": "suggestionState()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-dialog.tsx:L354 | neighbors=[meeting-notes-dialog.tsx]
- "components_meeting_notes_duechip": "DueChip()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes.tsx:L950 | neighbors=[meeting-notes.tsx]
- "components_meeting_notes_model_actionitemreconciliation": "ActionItemReconciliation" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L230 | neighbors=[meeting-notes-model.ts]
- "components_meeting_notes_model_actionitemsuggestionref": "ActionItemSuggestionRef" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L228 | neighbors=[meeting-notes-model.ts]
- "components_meeting_notes_model_actionoutcome": "ActionOutcome" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L282 | neighbors=[meeting-notes-model.ts]
- "components_meeting_notes_model_deadlinelike": "DeadlineLike" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L87 | neighbors=[meeting-notes-model.ts]
- "components_meeting_notes_model_intellike": "IntelLike" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L465 | neighbors=[meeting-notes-model.ts]
- "components_meeting_notes_model_normalize": "normalize()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L101 | neighbors=[meeting-notes-model.ts]
- "components_meeting_notes_model_perpersonlike": "PerPersonLike" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L86 | neighbors=[meeting-notes-model.ts]
- "components_meeting_notes_model_sameowner": "sameOwner()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L115 | neighbors=[meeting-notes-model.ts]
- "components_meeting_notes_model_spoken_formats": "SPOKEN_FORMATS" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L40 | neighbors=[meeting-notes-model.ts]
- "components_meeting_notes_model_status_rank": "STATUS_RANK" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L120 | neighbors=[meeting-notes-model.ts]
- "components_meeting_notes_model_test_deferred": "deferred()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.test.ts:L286 | neighbors=[meeting-notes-model.test.ts]
- "components_meeting_notes_model_test_now": "now" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.test.ts:L15 | neighbors=[meeting-notes-model.test.ts]
- "components_meeting_notes_model_untrackeddueview": "UntrackedDueView" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L376 | neighbors=[meeting-notes-model.ts]
- "components_meeting_notes_untrackedactionrow": "UntrackedActionRow()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes.tsx:L705 | neighbors=[meeting-notes.tsx]
- "components_meeting_panels_broadcastpanelprefs": "broadcastPanelPrefs()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L188 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_densitytoggle": "DensityToggle()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L559 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_empty_open_map": "EMPTY_OPEN_MAP" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L202 | neighbors=[meeting-panels.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-126.json

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
