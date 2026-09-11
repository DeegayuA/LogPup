# Node Description Batch 102 of 166

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

- "meetings_ask_derivation_stalledcount": "stalledCount()" | kind=code-symbol | source=src/features/meetings/ask-derivation.ts:L104 | neighbors=[ask-derivation.ts, planner.ts]
- "meetings_assistant_actions_askmeeting": "askMeeting()" | kind=code-symbol | source=src/features/meetings/assistant-actions.ts:L52 | neighbors=[meeting-assistant.tsx, assistant-actions.ts]
- "meetings_attendance_history_attendanceasof": "AttendanceAsOf" | kind=code-symbol | source=src/features/meetings/attendance-history.ts:L75 | neighbors=[attendance-history.ts, attendance-history.test.ts]
- "meetings_attendance_history_attendancechange": "AttendanceChange" | kind=code-symbol | source=src/features/meetings/attendance-history.ts:L17 | neighbors=[attendance-history.ts, rsvp-actions.ts]
- "meetings_attendance_history_attendancehistoryrow": "AttendanceHistoryRow" | kind=code-symbol | source=src/features/meetings/attendance-history.ts:L22 | neighbors=[attendance-history.ts, attendance-history.test.ts]
- "meetings_attendance_history_attendanceresponse": "AttendanceResponse" | kind=code-symbol | source=src/features/meetings/attendance-history.ts:L19 | neighbors=[attendance-history.ts, rsvp-actions.ts]
- "meetings_attendee_score_candidatefacts": "CandidateFacts" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L280 | neighbors=[attendee-score.ts, attendee-score.test.ts]
- "meetings_attendee_score_caveat_templates": "CAVEAT_TEMPLATES" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L528 | neighbors=[attendee-score.ts, attendee-score.test.ts]
- "meetings_attendee_score_caveatcode": "CaveatCode" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L61 | neighbors=[attendee-score.ts, attendee-score.test.ts]
- "meetings_attendee_score_e1recency": "e1Recency()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L610 | neighbors=[attendee-score.ts, scoreFollowups()]
- "meetings_attendee_score_escaperegexp": "escapeRegExp()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L640 | neighbors=[attendee-score.ts, findTechTagHit()]
- "meetings_attendee_score_maxtier": "maxTier()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L395 | neighbors=[attendee-score.ts, scoreCandidate()]
- "meetings_attendee_score_reason_templates": "REASON_TEMPLATES" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L414 | neighbors=[attendee-score.ts, attendee-score.test.ts]
- "meetings_attendee_score_reasoncode": "ReasonCode" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L39 | neighbors=[attendee-score.ts, attendee-score.test.ts]
- "meetings_attendee_score_scorecontext": "ScoreContext" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L134 | neighbors=[attendee-score.ts, attendee-score.test.ts]
- "meetings_attendee_score_scoredcandidate": "ScoredCandidate" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L84 | neighbors=[attendee-score.ts, attendee-score.test.ts]
- "meetings_attendee_score_scorepinned": "scorePinned()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L734 | neighbors=[attendee-score.ts, scoreCandidate()]
- "meetings_attendee_score_test_basefacts": "baseFacts()" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L48 | neighbors=[attendee-score.test.ts, kitchenSink()]
- "meetings_attendee_score_test_e1item": "e1Item()" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L950 | neighbors=[attendee-score.test.ts, daysBefore()]
- "meetings_attendee_score_tier": "Tier" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L37 | neighbors=[attendee-score.ts, attendee-score.test.ts]
- "meetings_attendee_score_tierall": "tierAll()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L1276 | neighbors=[attendee-score.ts, attendee-score.test.ts]
- "meetings_attendee_series_sameseries": "sameSeries()" | kind=code-symbol | source=src/features/meetings/attendee-series.ts:L29 | neighbors=[attendee-series.ts, attendee-series.test.ts]
- "meetings_calendar_grid_offsetformatter": "offsetFormatter()" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L158 | neighbors=[calendar-grid.ts, zoneOffsetMs()]
- "meetings_calendar_overlap_effectiveend": "effectiveEnd()" | kind=code-symbol | source=src/features/meetings/calendar-overlap.ts:L68 | neighbors=[calendar-overlap.ts, layoutOverlaps()]
- "meetings_calendar_overlap_overlapevent": "OverlapEvent" | kind=code-symbol | source=src/features/meetings/calendar-overlap.ts:L34 | neighbors=[calendar-overlap.ts, calendar-overlap.test.ts]
- "meetings_calendar_view_iscalendarview": "isCalendarView()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L59 | neighbors=[calendar-view.ts, calendar-view.test.ts]
- "meetings_calendar_view_rangefrom": "rangeFrom()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L201 | neighbors=[calendar-view.ts, VisibleRange]
- "meetings_calendar_view_view_label": "VIEW_LABEL" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L63 | neighbors=[meetings-calendar.tsx, calendar-view.ts]
- "meetings_calendar_view_view_step_unit": "VIEW_STEP_UNIT" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L73 | neighbors=[meetings-calendar.tsx, calendar-view.ts]
- "meetings_commands_commands": "commands" | kind=code-symbol | source=src/features/meetings/commands.ts:L13 | neighbors=[commands.ts, commands.ts]
- "meetings_coverage_compareasks": "compareAsks()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L240 | neighbors=[coverage.ts, coverage.test.ts]
- "meetings_coverage_coveragegroup": "CoverageGroup" | kind=code-symbol | source=src/features/meetings/coverage.ts:L136 | neighbors=[coverage.ts, load-actions.ts]
- "meetings_coverage_coverageheadline": "coverageHeadline()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L503 | neighbors=[coverage.ts, coverage.test.ts]
- "meetings_coverage_uniquesorted": "uniqueSorted()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L298 | neighbors=[coverage.ts, coverAsks()]
- "meetings_followup_move_actions_deletefollowup": "deleteFollowup()" | kind=code-symbol | source=src/features/meetings/followup-move-actions.ts:L163 | neighbors=[meeting-intel.tsx, followup-move-actions.ts]
- "meetings_followup_move_actions_editfollowuptext": "editFollowupText()" | kind=code-symbol | source=src/features/meetings/followup-move-actions.ts:L216 | neighbors=[meeting-intel.tsx, followup-move-actions.ts]
- "meetings_followup_move_actions_movefollowupstonextmeeting": "moveFollowupsToNextMeeting()" | kind=code-symbol | source=src/features/meetings/followup-move-actions.ts:L47 | neighbors=[meeting-intel.tsx, followup-move-actions.ts]
- "meetings_followup_move_actions_updatemeetingsummary": "updateMeetingSummary()" | kind=code-symbol | source=src/features/meetings/followup-move-actions.ts:L289 | neighbors=[meeting-notes.tsx, followup-move-actions.ts]
- "meetings_followups_carriedforwardentry": "CarriedForwardEntry" | kind=code-symbol | source=src/features/meetings/followups.ts:L125 | neighbors=[ai-actions.ts, followups.ts]
- "meetings_followups_carriedforwardgroup": "CarriedForwardGroup" | kind=code-symbol | source=src/features/meetings/followups.ts:L138 | neighbors=[ai-actions.ts, followups.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-101.json

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
