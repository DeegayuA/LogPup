# Node Description Batch 149 of 166

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

- "meetings_glance_actions_test_nextmeetingat": "nextMeetingAt" | kind=code-symbol | source=src/features/meetings/glance-actions.test.ts:L27 | neighbors=[glance-actions.test.ts]
- "meetings_glance_actions_test_notesjson": "notesJson" | kind=code-symbol | source=src/features/meetings/glance-actions.test.ts:L57 | neighbors=[glance-actions.test.ts]
- "meetings_glance_actions_test_now": "now" | kind=code-symbol | source=src/features/meetings/glance-actions.test.ts:L25 | neighbors=[glance-actions.test.ts]
- "meetings_glance_batch_test_action": "action" | kind=code-symbol | source=src/features/meetings/glance-batch.test.ts:L12 | neighbors=[glance-batch.test.ts]
- "meetings_glance_batch_test_ids": "ids()" | kind=code-symbol | source=src/features/meetings/glance-batch.test.ts:L15 | neighbors=[glance-batch.test.ts]
- "meetings_glance_core_empty_scope": "EMPTY_SCOPE" | kind=code-symbol | source=src/features/meetings/glance-core.ts:L103 | neighbors=[glance-core.ts]
- "meetings_glance_core_glanceattendeerow": "GlanceAttendeeRow" | kind=code-symbol | source=src/features/meetings/glance-core.ts:L54 | neighbors=[glance-core.ts]
- "meetings_glance_core_glancenotesrow": "GlanceNotesRow" | kind=code-symbol | source=src/features/meetings/glance-core.ts:L46 | neighbors=[glance-core.ts]
- "meetings_ics_calendarlinkinput": "CalendarLinkInput" | kind=code-symbol | source=src/features/meetings/ics.ts:L245 | neighbors=[ics.ts]
- "meetings_ics_icsperson": "IcsPerson" | kind=code-symbol | source=src/features/meetings/ics.ts:L40 | neighbors=[ics.ts]
- "meetings_ics_test_base": "base" | kind=code-symbol | source=src/features/meetings/ics.test.ts:L30 | neighbors=[ics.test.ts]
- "meetings_ics_test_octets": "octets()" | kind=code-symbol | source=src/features/meetings/ics.test.ts:L26 | neighbors=[ics.test.ts]
- "meetings_keyframe_access_keyframeaccessinput": "KeyframeAccessInput" | kind=code-symbol | source=src/features/meetings/keyframe-access.ts:L20 | neighbors=[keyframe-access.ts]
- "meetings_language_switch_interimleaderinput": "InterimLeaderInput" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L208 | neighbors=[language-switch.ts]
- "meetings_language_switch_pickutteranceinput": "PickUtteranceInput" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L50 | neighbors=[language-switch.ts]
- "meetings_language_switch_test_en": "en()" | kind=code-symbol | source=src/features/meetings/language-switch.test.ts:L16 | neighbors=[language-switch.test.ts]
- "meetings_language_switch_test_si": "si()" | kind=code-symbol | source=src/features/meetings/language-switch.test.ts:L17 | neighbors=[language-switch.test.ts]
- "meetings_list_actions_cursorinput": "cursorInput" | kind=code-symbol | source=src/features/meetings/list-actions.ts:L22 | neighbors=[list-actions.ts]
- "meetings_list_actions_dayinput": "dayInput" | kind=code-symbol | source=src/features/meetings/list-actions.ts:L26 | neighbors=[list-actions.ts]
- "meetings_list_actions_rangeinput": "rangeInput" | kind=code-symbol | source=src/features/meetings/list-actions.ts:L78 | neighbors=[list-actions.ts]
- "meetings_list_filter_filterablemeeting": "FilterableMeeting" | kind=code-symbol | source=src/features/meetings/list-filter.ts:L34 | neighbors=[list-filter.ts]
- "meetings_list_filter_list_filters": "LIST_FILTERS" | kind=code-symbol | source=src/features/meetings/list-filter.ts:L20 | neighbors=[list-filter.ts]
- "meetings_list_filter_test_attendee": "attendee()" | kind=code-symbol | source=src/features/meetings/list-filter.test.ts:L8 | neighbors=[list-filter.test.ts]
- "meetings_list_filter_test_glance": "glance()" | kind=code-symbol | source=src/features/meetings/list-filter.test.ts:L16 | neighbors=[list-filter.test.ts]
- "meetings_list_filter_test_meeting": "meeting()" | kind=code-symbol | source=src/features/meetings/list-filter.test.ts:L12 | neighbors=[list-filter.test.ts]
- "meetings_list_search_searchablemeeting": "SearchableMeeting" | kind=code-symbol | source=src/features/meetings/list-search.ts:L20 | neighbors=[list-search.ts]
- "meetings_list_search_test_row": "Row" | kind=code-symbol | source=src/features/meetings/list-search.test.ts:L4 | neighbors=[list-search.test.ts]
- "meetings_list_search_test_titles": "titles()" | kind=code-symbol | source=src/features/meetings/list-search.test.ts:L15 | neighbors=[list-search.test.ts]
- "meetings_load_actions_loadperson": "LoadPerson" | kind=code-symbol | source=src/features/meetings/load-actions.ts:L54 | neighbors=[load-actions.ts]
- "meetings_load_actions_meetingloadboard": "MeetingLoadBoard" | kind=code-symbol | source=src/features/meetings/load-actions.ts:L72 | neighbors=[load-actions.ts]
- "meetings_load_actions_reopenloaddecision": "reopenLoadDecision()" | kind=code-symbol | source=src/features/meetings/load-actions.ts:L370 | neighbors=[load-actions.ts]
- "meetings_loading_meetingsloading": "MeetingsLoading()" | kind=code-symbol | source=src/app/(app)/meetings/loading.tsx:L17 | neighbors=[loading.tsx]
- "meetings_meeting_url_http_url": "HTTP_URL" | kind=code-symbol | source=src/features/meetings/meeting-url.ts:L10 | neighbors=[meeting-url.ts]
- "meetings_meeting_url_test_parse": "parse()" | kind=code-symbol | source=src/features/meetings/meeting-url.test.ts:L5 | neighbors=[meeting-url.test.ts]
- "meetings_next_meeting_nextmeetingdescription": "NextMeetingDescription" | kind=code-symbol | source=src/features/meetings/next-meeting.ts:L63 | neighbors=[next-meeting.ts]
- "meetings_notes_attendeeappprep": "AttendeeAppPrep" | kind=code-symbol | source=src/features/meetings/notes.ts:L511 | neighbors=[notes.ts]
- "meetings_notes_autoassigndecision": "AutoAssignDecision" | kind=code-symbol | source=src/features/meetings/notes.ts:L313 | neighbors=[notes.ts]
- "meetings_notes_autoassignnotificationinput": "AutoAssignNotificationInput" | kind=code-symbol | source=src/features/meetings/notes.ts:L382 | neighbors=[notes.ts]
- "meetings_notes_checkintarget": "CheckinTarget" | kind=code-symbol | source=src/features/meetings/notes.ts:L537 | neighbors=[notes.ts]
- "meetings_notes_meetingtaskcontext": "MeetingTaskContext" | kind=code-symbol | source=src/features/meetings/notes.ts:L172 | neighbors=[notes.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-148.json

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
