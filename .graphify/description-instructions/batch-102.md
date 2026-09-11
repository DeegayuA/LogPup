# Node Description Batch 103 of 166

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

- "meetings_followups_decidefollowupresolutionontaskstatuschange": "decideFollowupResolutionOnTaskStatusChange()" | kind=code-symbol | source=src/features/meetings/followups.ts:L451 | neighbors=[followups.ts, followups.test.ts]
- "meetings_followups_matchpersontoattendee": "matchPersonToAttendee()" | kind=code-symbol | source=src/features/meetings/followups.ts:L33 | neighbors=[followups.ts, followups.test.ts]
- "meetings_followups_normalizematchtokens": "normalizeMatchTokens()" | kind=code-symbol | source=src/features/meetings/followups.ts:L280 | neighbors=[followups.ts, followupTaskSimilarity()]
- "meetings_glance_batch_glancebatchresult": "GlanceBatchResult" | kind=code-symbol | source=src/features/meetings/glance-batch.ts:L16 | neighbors=[use-glance-map.tsx, glance-batch.ts]
- "meetings_glance_core_asarray": "asArray()" | kind=code-symbol | source=src/features/meetings/glance-core.ts:L99 | neighbors=[glance-core.ts, buildGlanceMap()]
- "meetings_glance_core_carriedintomeeting": "carriedIntoMeeting()" | kind=code-symbol | source=src/features/meetings/glance-core.ts:L85 | neighbors=[glance-actions.test.ts, glance-core.ts]
- "meetings_glance_core_glancefollowuprow": "GlanceFollowupRow" | kind=code-symbol | source=src/features/meetings/glance-core.ts:L62 | neighbors=[glance-actions.test.ts, glance-core.ts]
- "meetings_glance_core_glancemeetingrow": "GlanceMeetingRow" | kind=code-symbol | source=src/features/meetings/glance-core.ts:L38 | neighbors=[glance-actions.test.ts, glance-core.ts]
- "meetings_ics_foldicsline": "foldIcsLine()" | kind=code-symbol | source=src/features/meetings/ics.ts:L125 | neighbors=[ics.ts, ics.test.ts]
- "meetings_ics_icseventinput": "IcsEventInput" | kind=code-symbol | source=src/features/meetings/ics.ts:L47 | neighbors=[ics.ts, ics.test.ts]
- "meetings_ics_quoteparam": "quoteParam()" | kind=code-symbol | source=src/features/meetings/ics.ts:L149 | neighbors=[ics.ts, personLine()]
- "meetings_ics_test_lines": "lines()" | kind=code-symbol | source=src/features/meetings/ics.test.ts:L22 | neighbors=[ics.test.ts, unfold()]
- "meetings_ics_test_unfold": "unfold()" | kind=code-symbol | source=src/features/meetings/ics.test.ts:L17 | neighbors=[ics.test.ts, lines()]
- "meetings_keyframe_access_test": "keyframe-access.test.ts" | kind=code-symbol | source=src/features/meetings/keyframe-access.test.ts:L1 | neighbors=[keyframe-access.ts, canServeKeyframe()]
- "meetings_language_switch_activelanguage": "ActiveLanguage" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L39 | neighbors=[meeting-intel.tsx, language-switch.ts]
- "meetings_language_switch_countmatches": "countMatches()" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L155 | neighbors=[language-switch.ts, estimateSpokenUnits()]
- "meetings_legacy_notes_havenotesegmentseverexisted": "haveNoteSegmentsEverExisted()" | kind=code-symbol | source=src/features/meetings/legacy-notes.ts:L25 | neighbors=[ai-actions.ts, legacy-notes.ts]
- "meetings_list_actions_fetchmeetingsforday": "fetchMeetingsForDay()" | kind=code-symbol | source=src/features/meetings/list-actions.ts:L59 | neighbors=[meetings-views.tsx, list-actions.ts]
- "meetings_list_actions_fetchmeetingsforrange": "fetchMeetingsForRange()" | kind=code-symbol | source=src/features/meetings/list-actions.ts:L89 | neighbors=[meetings-views.tsx, list-actions.ts]
- "meetings_list_actions_fetcholderpast": "fetchOlderPast()" | kind=code-symbol | source=src/features/meetings/list-actions.ts:L33 | neighbors=[meetings-views.tsx, list-actions.ts]
- "meetings_list_search_fold": "fold()" | kind=code-symbol | source=src/features/meetings/list-search.ts:L27 | neighbors=[list-search.ts, filterMeetingsBySearch()]
- "meetings_load_actions_headlinefor": "headlineFor()" | kind=code-symbol | source=src/features/meetings/load-actions.ts:L312 | neighbors=[load-actions.ts, getMeetingLoadSuggestions()]
- "meetings_load_actions_isodayadd": "isoDayAdd()" | kind=code-symbol | source=src/features/meetings/load-actions.ts:L83 | neighbors=[load-actions.ts, getMeetingLoadSuggestions()]
- "meetings_load_actions_loadsuggestion": "LoadSuggestion" | kind=code-symbol | source=src/features/meetings/load-actions.ts:L56 | neighbors=[load-board.tsx, load-actions.ts]
- "meetings_next_meeting_relativedays": "relativeDays()" | kind=code-symbol | source=src/features/meetings/next-meeting.ts:L128 | neighbors=[next-meeting.ts, describeNextMeeting()]
- "meetings_notes_appoption": "AppOption" | kind=code-symbol | source=src/features/meetings/notes.ts:L435 | neighbors=[ai-actions.ts, notes.ts]
- "meetings_notes_attendeecheckinprep": "AttendeeCheckinPrep" | kind=code-symbol | source=src/features/meetings/notes.ts:L524 | neighbors=[meeting-prep.tsx, notes.ts]
- "meetings_notes_autoassignedtaskfields": "AutoAssignedTaskFields" | kind=code-symbol | source=src/features/meetings/notes.ts:L350 | neighbors=[notes.ts, notes.test.ts]
- "meetings_notes_autoassignnotificationpayload": "AutoAssignNotificationPayload" | kind=code-symbol | source=src/features/meetings/notes.ts:L392 | neighbors=[ai-actions.ts, notes.ts]
- "meetings_notes_notesource": "NoteSource" | kind=code-symbol | source=src/features/meetings/notes.ts:L15 | neighbors=[ai-actions.ts, notes.ts]
- "meetings_notes_orderablesegment": "OrderableSegment" | kind=code-symbol | source=src/features/meetings/notes.ts:L697 | neighbors=[notes.ts, notes.test.ts]
- "meetings_page_hourslabel": "hoursLabel()" | kind=code-symbol | source=src/app/(app)/meetings/page.tsx:L174 | neighbors=[page.tsx, WeekSummaryLine()]
- "meetings_page_weeksummaryline": "WeekSummaryLine()" | kind=code-symbol | source=src/app/(app)/meetings/page.tsx:L188 | neighbors=[page.tsx, hoursLabel()]
- "meetings_planner_actions_getmeetingplanner": "getMeetingPlanner()" | kind=code-symbol | source=src/features/meetings/planner-actions.ts:L64 | neighbors=[meeting-planner.tsx, planner-actions.ts]
- "meetings_planner_askkind": "AskKind" | kind=code-symbol | source=src/features/meetings/planner.ts:L50 | neighbors=[meeting-planner.tsx, planner.ts]
- "meetings_planner_assemblemeetingplaninput": "AssembleMeetingPlanInput" | kind=code-symbol | source=src/features/meetings/planner.ts:L163 | neighbors=[planner.ts, planner.test.ts]
- "meetings_planner_listnames": "listNames()" | kind=code-symbol | source=src/features/meetings/planner.ts:L190 | neighbors=[planner.ts, candidateReason()]
- "meetings_planner_planfollowuprow": "PlanFollowupRow" | kind=code-symbol | source=src/features/meetings/planner.ts:L153 | neighbors=[planner.ts, planner-actions.ts]
- "meetings_planner_plannerask": "PlannerAsk" | kind=code-symbol | source=src/features/meetings/planner.ts:L52 | neighbors=[meeting-planner.tsx, planner.ts]
- "meetings_planner_plannercandidate": "PlannerCandidate" | kind=code-symbol | source=src/features/meetings/planner.ts:L88 | neighbors=[meeting-planner.tsx, planner.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-102.json

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
