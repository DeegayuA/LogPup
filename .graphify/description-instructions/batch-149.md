# Node Description Batch 150 of 166

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

- "meetings_notes_namedspeakermapping": "NamedSpeakerMapping" | kind=code-symbol | source=src/features/meetings/notes.ts:L85 | neighbors=[notes.ts]
- "meetings_notes_prepassignmentrow": "PrepAssignmentRow" | kind=code-symbol | source=src/features/meetings/notes.ts:L477 | neighbors=[notes.ts]
- "meetings_notes_prepattendee": "PrepAttendee" | kind=code-symbol | source=src/features/meetings/notes.ts:L474 | neighbors=[notes.ts]
- "meetings_notes_prepcheckinrow": "PrepCheckinRow" | kind=code-symbol | source=src/features/meetings/notes.ts:L503 | neighbors=[notes.ts]
- "meetings_notes_prepsprintrow": "PrepSprintRow" | kind=code-symbol | source=src/features/meetings/notes.ts:L485 | neighbors=[notes.ts]
- "meetings_notes_preptaskrow": "PrepTaskRow" | kind=code-symbol | source=src/features/meetings/notes.ts:L496 | neighbors=[notes.ts]
- "meetings_notes_speakerassignmentplan": "SpeakerAssignmentPlan" | kind=code-symbol | source=src/features/meetings/notes.ts:L104 | neighbors=[notes.ts]
- "meetings_notes_speakernameparts": "SpeakerNameParts" | kind=code-symbol | source=src/features/meetings/notes.ts:L54 | neighbors=[notes.ts]
- "meetings_notes_taskcreatepayload": "TaskCreatePayload" | kind=code-symbol | source=src/features/meetings/notes.ts:L197 | neighbors=[notes.ts]
- "meetings_notes_tasksuggestionoverrides": "TaskSuggestionOverrides" | kind=code-symbol | source=src/features/meetings/notes.ts:L190 | neighbors=[notes.ts]
- "meetings_notes_tasksuggestionsource": "TaskSuggestionSource" | kind=code-symbol | source=src/features/meetings/notes.ts:L166 | neighbors=[notes.ts]
- "meetings_notes_test_eligible": "eligible()" | kind=code-symbol | source=src/features/meetings/notes.test.ts:L432 | neighbors=[notes.test.ts]
- "meetings_notes_test_seg": "seg()" | kind=code-symbol | source=src/features/meetings/notes.test.ts:L327 | neighbors=[notes.test.ts]
- "meetings_page_meetingspage": "MeetingsPage()" | kind=code-symbol | source=src/app/(app)/meetings/page.tsx:L30 | neighbors=[page.tsx]
- "meetings_page_metadata": "metadata" | kind=code-symbol | source=src/app/(app)/meetings/page.tsx:L24 | neighbors=[page.tsx]
- "meetings_page_yourseries": "YourSeries()" | kind=code-symbol | source=src/app/(app)/meetings/page.tsx:L215 | neighbors=[page.tsx]
- "meetings_planner_agendagroup": "AgendaGroup" | kind=code-symbol | source=src/features/meetings/planner.ts:L505 | neighbors=[planner.ts]
- "meetings_planner_ask_kinds": "ASK_KINDS" | kind=code-symbol | source=src/features/meetings/planner.ts:L49 | neighbors=[planner.ts]
- "meetings_planner_plancheckinrow": "PlanCheckinRow" | kind=code-symbol | source=src/features/meetings/planner.ts:L151 | neighbors=[planner.ts]
- "meetings_planner_plannerproject": "PlannerProject" | kind=code-symbol | source=src/features/meetings/planner.ts:L100 | neighbors=[planner.ts]
- "meetings_planner_plannerrole": "PlannerRole" | kind=code-symbol | source=src/features/meetings/planner.ts:L41 | neighbors=[planner.ts]
- "meetings_planner_plannerrolehold": "PlannerRoleHold" | kind=code-symbol | source=src/features/meetings/planner.ts:L79 | neighbors=[planner.ts]
- "meetings_planner_test_askkeys": "askKeys()" | kind=code-symbol | source=src/features/meetings/planner.test.ts:L35 | neighbors=[planner.test.ts]
- "meetings_planner_test_input": "input()" | kind=code-symbol | source=src/features/meetings/planner.test.ts:L14 | neighbors=[planner.test.ts]
- "meetings_queries_meetingattendee": "MeetingAttendee" | kind=code-symbol | source=src/features/meetings/queries.ts:L10 | neighbors=[queries.ts]
- "meetings_queries_meetingcolumns": "meetingColumns" | kind=code-symbol | source=src/features/meetings/queries.ts:L54 | neighbors=[queries.ts]
- "meetings_queries_meetingrow": "MeetingRow" | kind=code-symbol | source=src/features/meetings/queries.ts:L149 | neighbors=[queries.ts]
- "meetings_recording_actions_idinput": "idInput" | kind=code-symbol | source=src/features/meetings/recording-actions.ts:L30 | neighbors=[recording-actions.ts]
- "meetings_recording_progress_segmentstate": "SegmentState" | kind=code-symbol | source=src/features/meetings/recording-progress.ts:L24 | neighbors=[recording-progress.ts]
- "meetings_recording_progress_takeprogress": "TakeProgress" | kind=code-symbol | source=src/features/meetings/recording-progress.ts:L48 | neighbors=[recording-progress.ts]
- "meetings_recording_progress_test_seg": "seg()" | kind=code-symbol | source=src/features/meetings/recording-progress.test.ts:L11 | neighbors=[recording-progress.test.ts]
- "meetings_recording_progress_test_take": "take()" | kind=code-symbol | source=src/features/meetings/recording-progress.test.ts:L17 | neighbors=[recording-progress.test.ts]
- "meetings_recording_segments_concatenatedsegments": "ConcatenatedSegments" | kind=code-symbol | source=src/features/meetings/recording-segments.ts:L117 | neighbors=[recording-segments.ts]
- "meetings_recording_segments_transcribedsegment": "TranscribedSegment" | kind=code-symbol | source=src/features/meetings/recording-segments.ts:L115 | neighbors=[recording-segments.ts]
- "meetings_recurrence_monthlymode": "MonthlyMode" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L29 | neighbors=[recurrence.ts]
- "meetings_recurrence_recurrencefreq": "RecurrenceFreq" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L28 | neighbors=[recurrence.ts]
- "meetings_recurrence_rrule_days": "RRULE_DAYS" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L64 | neighbors=[recurrence.ts]
- "meetings_recurrence_test_weekly": "weekly()" | kind=code-symbol | source=src/features/meetings/recurrence.test.ts:L11 | neighbors=[recurrence.test.ts]
- "meetings_rsvp_actions_responses": "RESPONSES" | kind=code-symbol | source=src/features/meetings/rsvp-actions.ts:L60 | neighbors=[rsvp-actions.ts]
- "meetings_rsvp_actions_responseschema": "responseSchema" | kind=code-symbol | source=src/features/meetings/rsvp-actions.ts:L61 | neighbors=[rsvp-actions.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-149.json

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
