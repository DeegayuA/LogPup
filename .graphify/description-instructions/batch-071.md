# Node Description Batch 72 of 166

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

- "meetings_language_switch_containssinhala": "containsSinhala()" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L170 | neighbors=[meeting-intel.tsx, language-switch.ts, language-switch.test.ts]
- "meetings_language_switch_isrestartstorm": "isRestartStorm()" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L301 | neighbors=[meeting-intel.tsx, language-switch.ts, language-switch.test.ts]
- "meetings_language_switch_issilentsinhalafallback": "isSilentSinhalaFallback()" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L277 | neighbors=[meeting-intel.tsx, language-switch.ts, language-switch.test.ts]
- "meetings_language_switch_pickutterance": "pickUtterance()" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L88 | neighbors=[meeting-intel.tsx, language-switch.ts, language-switch.test.ts]
- "meetings_language_switch_shouldflush": "shouldFlush()" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L132 | neighbors=[meeting-intel.tsx, language-switch.ts, language-switch.test.ts]
- "meetings_language_switch_utterancecandidate": "UtteranceCandidate" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L42 | neighbors=[meeting-intel.tsx, language-switch.ts, language-switch.test.ts]
- "meetings_list_filter_matcheslistfilter": "matchesListFilter()" | kind=code-symbol | source=src/features/meetings/list-filter.ts:L52 | neighbors=[meetings-views.tsx, list-filter.ts, list-filter.test.ts]
- "meetings_load_actions_canreadloadboard": "canReadLoadBoard()" | kind=code-symbol | source=src/features/meetings/load-actions.ts:L100 | neighbors=[load-actions.ts, dismissSuggestion(), getMeetingLoadSuggestions()]
- "meetings_load_actions_dismisssuggestion": "dismissSuggestion()" | kind=code-symbol | source=src/features/meetings/load-actions.ts:L330 | neighbors=[load-board.tsx, load-actions.ts, canReadLoadBoard()]
- "meetings_meeting_url_isvalidmeetingurl": "isValidMeetingUrl()" | kind=code-symbol | source=src/features/meetings/meeting-url.ts:L30 | neighbors=[meeting-form.tsx, meeting-url.ts, meeting-url.test.ts]
- "meetings_notes_assemblemeetingprep": "assembleMeetingPrep()" | kind=code-symbol | source=src/features/meetings/notes.ts:L575 | neighbors=[ai-actions.ts, notes.ts, notes.test.ts]
- "meetings_notes_attendeeprep": "AttendeePrep" | kind=code-symbol | source=src/features/meetings/notes.ts:L546 | neighbors=[meeting-prep.tsx, ai-actions.ts, notes.ts]
- "meetings_notes_autoassigncandidate": "AutoAssignCandidate" | kind=code-symbol | source=src/features/meetings/notes.ts:L274 | neighbors=[ai-actions.ts, notes.ts, notes.test.ts]
- "meetings_notes_buildautoassignnotification": "buildAutoAssignNotification()" | kind=code-symbol | source=src/features/meetings/notes.ts:L412 | neighbors=[ai-actions.ts, notes.ts, notes.test.ts]
- "meetings_notes_canundoautoassign": "canUndoAutoAssign()" | kind=code-symbol | source=src/features/meetings/notes.ts:L370 | neighbors=[ai-actions.ts, notes.ts, notes.test.ts]
- "meetings_notes_ordernotesegments": "orderNoteSegments()" | kind=code-symbol | source=src/features/meetings/notes.ts:L716 | neighbors=[ai-actions.ts, notes.ts, notes.test.ts]
- "meetings_notes_partitionautoassign": "partitionAutoAssign()" | kind=code-symbol | source=src/features/meetings/notes.ts:L335 | neighbors=[ai-actions.ts, notes.ts, notes.test.ts]
- "meetings_notes_planspeakerassignment": "planSpeakerAssignment()" | kind=code-symbol | source=src/features/meetings/notes.ts:L128 | neighbors=[ai-actions.ts, notes.ts, notes.test.ts]
- "meetings_notes_resolvesuggestedappid": "resolveSuggestedAppId()" | kind=code-symbol | source=src/features/meetings/notes.ts:L448 | neighbors=[ai-actions.ts, notes.ts, notes.test.ts]
- "meetings_notes_shouldautoassign": "shouldAutoAssign()" | kind=code-symbol | source=src/features/meetings/notes.ts:L304 | neighbors=[ai-actions.ts, notes.ts, notes.test.ts]
- "meetings_notes_speakermapping": "SpeakerMapping" | kind=code-symbol | source=src/features/meetings/notes.ts:L17 | neighbors=[ai-actions.ts, followups.ts, notes.ts]
- "meetings_planner_buildagenda": "buildAgenda()" | kind=code-symbol | source=src/features/meetings/planner.ts:L512 | neighbors=[meeting-planner.tsx, planner.ts, planner.test.ts]
- "meetings_planner_candidatereason": "candidateReason()" | kind=code-symbol | source=src/features/meetings/planner.ts:L202 | neighbors=[planner.ts, assembleMeetingPlan(), listNames()]
- "meetings_planner_meetingplan": "MeetingPlan" | kind=code-symbol | source=src/features/meetings/planner.ts:L115 | neighbors=[meeting-planner.tsx, planner.ts, planner-actions.ts]
- "meetings_queries_getmeetingbyid": "getMeetingById" | kind=code-symbol | source=src/features/meetings/queries.ts:L380 | neighbors=[page.tsx, queries.ts, getMeetingSummaryById()]
- "meetings_queries_getmeetingsforapp": "getMeetingsForApp()" | kind=code-symbol | source=src/features/meetings/queries.ts:L364 | neighbors=[queries.ts, hydrate(), page.tsx]
- "meetings_queries_getmeetingsforday": "getMeetingsForDay()" | kind=code-symbol | source=src/features/meetings/queries.ts:L281 | neighbors=[list-actions.ts, queries.ts, hydrate()]
- "meetings_queries_getmeetingsforrange": "getMeetingsForRange()" | kind=code-symbol | source=src/features/meetings/queries.ts:L323 | neighbors=[list-actions.ts, queries.ts, hydrate()]
- "meetings_queries_getmeetingsummarybyid": "getMeetingSummaryById()" | kind=code-symbol | source=src/features/meetings/queries.ts:L407 | neighbors=[page.tsx, queries.ts, getMeetingById]
- "meetings_recording_progress_formatremaining": "formatRemaining()" | kind=code-symbol | source=src/features/meetings/recording-progress.ts:L184 | neighbors=[meeting-intel.tsx, recording-progress.ts, recording-progress.test.ts]
- "meetings_recording_queries_meetingrecordings": "MeetingRecordings" | kind=code-symbol | source=src/features/meetings/recording-queries.ts:L30 | neighbors=[recording-takes.tsx, recording-actions.ts, recording-queries.ts]
- "meetings_recording_segments_concatenatesegments": "concatenateSegments()" | kind=code-symbol | source=src/features/meetings/recording-segments.ts:L141 | neighbors=[ai-actions.ts, recording-segments.ts, recording-segments.test.ts]
- "meetings_recording_segments_hinttail": "hintTail()" | kind=code-symbol | source=src/features/meetings/recording-segments.ts:L105 | neighbors=[meeting-intel.tsx, recording-segments.ts, recording-segments.test.ts]
- "meetings_recording_segments_isretriablesegmenterror": "isRetriableSegmentError()" | kind=code-symbol | source=src/features/meetings/recording-segments.ts:L75 | neighbors=[meeting-intel.tsx, recording-segments.ts, recording-segments.test.ts]
- "meetings_recording_segments_segmentretrydelayms": "segmentRetryDelayMs()" | kind=code-symbol | source=src/features/meetings/recording-segments.ts:L60 | neighbors=[meeting-intel.tsx, recording-segments.ts, recording-segments.test.ts]
- "meetings_recording_segments_shouldcutsegment": "shouldCutSegment()" | kind=code-symbol | source=src/features/meetings/recording-segments.ts:L37 | neighbors=[meeting-intel.tsx, recording-segments.ts, recording-segments.test.ts]
- "meetings_recurrence_daysinmonth": "daysInMonth()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L109 | neighbors=[recurrence.ts, expand(), nthWeekdayOf()]
- "meetings_recurrence_isofromdaynumber": "isoFromDayNumber()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L88 | neighbors=[recurrence.ts, expand(), isoOf()]
- "meetings_recurrence_monthindex": "monthIndex()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L104 | neighbors=[recurrence.ts, expand(), partsOf()]
- "meetings_recurrence_occurrenceinstant": "occurrenceInstant()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L229 | neighbors=[recurrence.ts, partsOf(), recurrence.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-071.json

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
