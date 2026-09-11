# Node Description Batch 146 of 166

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

- "meetings_ai_actions_orgpersonoption": "OrgPersonOption" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3072 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_perpersonnote": "PerPersonNote" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L165 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_questionnote": "QuestionNote" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L168 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_reopenfollowupinput": "reopenFollowupInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2535 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_resolvefollowupinput": "resolveFollowupInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2523 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_setautoassigninput": "setAutoAssignInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2308 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_setnextmeetinginput": "setNextMeetingInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2337 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_setspeakermappinginput": "setSpeakerMappingInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L4044 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_speakersegmentout": "SpeakerSegmentOut" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L318 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_speakerusers": "speakerUsers" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3161 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_suggestedusers": "suggestedUsers" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3163 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_suggestionapps": "suggestionApps" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3169 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_suggestiontargetapps": "suggestionTargetApps" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3172 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_suggestiontasks": "suggestionTasks" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3168 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_suggestnextmeetinginput": "suggestNextMeetingInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2426 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_termnote": "TermNote" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L167 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_test_ascreator": "asCreator()" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L110 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_test_asother": "asOther()" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L111 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_test_authmock_writespy_deletespy_logactivitymock": "{ authMock, writeSpy, deleteSpy, logActivityMock }" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L11 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_test_basemeeting": "baseMeeting()" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L113 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_test_basesuggestion": "baseSuggestion()" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L252 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_test_basetask": "baseTask()" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L269 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_test_meetingqueue": "meetingQueue" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L53 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_test_screenshotqueue": "screenshotQueue" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L54 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_test_segmentqueue": "segmentQueue" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L55 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_test_suggestionqueue": "suggestionQueue" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L56 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_test_taskqueue": "taskQueue" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L57 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_test_updatereturningqueue": "updateReturningQueue" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L58 | neighbors=[ai-actions.test.ts]
- "meetings_ai_actions_trackactioniteminput": "trackActionItemInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L4106 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_transcribesegmentinput": "transcribeSegmentInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1374 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_transcribesegmentresult": "TranscribeSegmentResult" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1379 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_unassignedfollowupview": "UnassignedFollowupView" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3096 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_updatesuggestioninput": "updateSuggestionInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L4176 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_uploadkeyframeinput": "uploadKeyframeInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1871 | neighbors=[ai-actions.ts]
- "meetings_ask_derivation_asktaskrow": "AskTaskRow" | kind=code-symbol | source=src/features/meetings/ask-derivation.ts:L31 | neighbors=[ask-derivation.ts]
- "meetings_ask_derivation_overduerow": "OverdueRow" | kind=code-symbol | source=src/features/meetings/ask-derivation.ts:L56 | neighbors=[ask-derivation.ts]
- "meetings_assistant_actions_askinput": "askInput" | kind=code-symbol | source=src/features/meetings/assistant-actions.ts:L38 | neighbors=[assistant-actions.ts]
- "meetings_assistant_actions_meetinganswer": "MeetingAnswer" | kind=code-symbol | source=src/features/meetings/assistant-actions.ts:L47 | neighbors=[assistant-actions.ts]
- "meetings_attendance_history_attendanceentry": "AttendanceEntry" | kind=code-symbol | source=src/features/meetings/attendance-history.ts:L39 | neighbors=[attendance-history.ts]
- "meetings_attendance_history_attendanceentryinput": "AttendanceEntryInput" | kind=code-symbol | source=src/features/meetings/attendance-history.ts:L29 | neighbors=[attendance-history.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-145.json

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
