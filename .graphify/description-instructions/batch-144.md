# Node Description Batch 145 of 166

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

- "meetings_actions_duplicateinput": "duplicateInput" | kind=code-symbol | source=src/features/meetings/actions.ts:L672 | neighbors=[actions.ts]
- "meetings_actions_empty": "EMPTY" | kind=code-symbol | source=src/features/meetings/actions.ts:L248 | neighbors=[actions.ts]
- "meetings_actions_endsafterstart": "endsAfterStart()" | kind=code-symbol | source=src/features/meetings/actions.ts:L72 | neighbors=[actions.ts]
- "meetings_actions_endsafterstarterror": "endsAfterStartError" | kind=code-symbol | source=src/features/meetings/actions.ts:L74 | neighbors=[actions.ts]
- "meetings_actions_meetingfields": "meetingFields" | kind=code-symbol | source=src/features/meetings/actions.ts:L49 | neighbors=[actions.ts]
- "meetings_actions_meetinginput": "meetingInput" | kind=code-symbol | source=src/features/meetings/actions.ts:L79 | neighbors=[actions.ts]
- "meetings_actions_meetingupdateinput": "meetingUpdateInput" | kind=code-symbol | source=src/features/meetings/actions.ts:L81 | neighbors=[actions.ts]
- "meetings_actions_rescheduleinput": "rescheduleInput" | kind=code-symbol | source=src/features/meetings/actions.ts:L85 | neighbors=[actions.ts]
- "meetings_actions_test_asadmin": "asAdmin()" | kind=code-symbol | source=src/features/meetings/actions.test.ts:L110 | neighbors=[actions.test.ts]
- "meetings_actions_test_ascreator": "asCreator()" | kind=code-symbol | source=src/features/meetings/actions.test.ts:L105 | neighbors=[actions.test.ts]
- "meetings_actions_test_asother": "asOther()" | kind=code-symbol | source=src/features/meetings/actions.test.ts:L106 | neighbors=[actions.test.ts]
- "meetings_actions_test_authmock_writespy_deletespy_logactivitymock_deletecalendareventmock_blobdelmock": "{ authMock, writeSpy, deleteSpy, logActivityMock, deleteCalendarEventMock, blob…" | kind=code-symbol | source=src/features/meetings/actions.test.ts:L9 | neighbors=[actions.test.ts]
- "meetings_actions_test_basemeeting": "baseMeeting()" | kind=code-symbol | source=src/features/meetings/actions.test.ts:L112 | neighbors=[actions.test.ts]
- "meetings_actions_test_meetingqueue": "meetingQueue" | kind=code-symbol | source=src/features/meetings/actions.test.ts:L36 | neighbors=[actions.test.ts]
- "meetings_actions_test_updatereturningqueue": "updateReturningQueue" | kind=code-symbol | source=src/features/meetings/actions.test.ts:L38 | neighbors=[actions.test.ts]
- "meetings_actions_test_userqueue": "userQueue" | kind=code-symbol | source=src/features/meetings/actions.test.ts:L37 | neighbors=[actions.test.ts]
- "meetings_ai_actions_acceptsuggestioninput": "acceptSuggestionInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L4262 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_actionitemout": "ActionItemOut" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L319 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_addfollowupinput": "addFollowupInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2859 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_addtypednoteinput": "addTypedNoteInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3429 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_allowed_keyframe_types": "ALLOWED_KEYFRAME_TYPES" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1860 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_assignfollowupinput": "assignFollowupInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3330 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_assignspeakerinput": "assignSpeakerInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3649 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_assignspeakerresult": "AssignSpeakerResult" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3757 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_attributefollowupinput": "attributeFollowupInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2751 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_authorusers": "authorUsers" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3162 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_carriedforwarditemgroup": "CarriedForwardItemGroup" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L219 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_closeasstaleinput": "closeAsStaleInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2703 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_copyresponseinput": "copyResponseInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2970 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_deadlinenote": "DeadlineNote" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L166 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_editsegmentinput": "editSegmentInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3508 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_empty_scope": "EMPTY_SCOPE" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L128 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_finalizerecordinginput": "finalizeRecordingInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1565 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_finalizerecordingresult": "FinalizeRecordingResult" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1574 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_followupcarryrow": "FollowupCarryRow" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L749 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_followupnoteinput": "followupNoteInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2802 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_followupstatus": "FollowupStatus" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L184 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_followupwritecontext": "FollowupWriteContext" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2537 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_idinput": "idInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L162 | neighbors=[ai-actions.ts]
- "meetings_ai_actions_livetranscriptinput": "liveTranscriptInput" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L163 | neighbors=[ai-actions.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-144.json

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
