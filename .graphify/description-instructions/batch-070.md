# Node Description Batch 71 of 166

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

- "meetings_attendee_score_test_daysbefore": "daysBefore()" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L25 | neighbors=[attendee-score.test.ts, e1Item(), kitchenSink()]
- "meetings_attendee_score_test_kitchensink": "kitchenSink()" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L1151 | neighbors=[attendee-score.test.ts, baseFacts(), daysBefore()]
- "meetings_attendee_series_test": "attendee-series.test.ts" | kind=code-symbol | source=src/features/meetings/attendee-series.test.ts:L1 | neighbors=[232b7ef ., attendee-series.ts, sameSeries()]
- "meetings_auto_title_automeetingtitle": "autoMeetingTitle()" | kind=code-symbol | source=src/features/meetings/auto-title.ts:L22 | neighbors=[meeting-form.tsx, auto-title.ts, auto-title.test.ts]
- "meetings_auto_title_isautomeetingtitle": "isAutoMeetingTitle()" | kind=code-symbol | source=src/features/meetings/auto-title.ts:L59 | neighbors=[meeting-form.tsx, auto-title.ts, auto-title.test.ts]
- "meetings_calendar_grid_clamppxperhour": "clampPxPerHour()" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L54 | neighbors=[meetings-calendar.tsx, calendar-grid.ts, calendar-grid.test.ts]
- "meetings_calendar_grid_cliptoday": "clipToDay()" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L260 | neighbors=[meetings-time-grid.tsx, calendar-grid.ts, calendar-grid.test.ts]
- "meetings_calendar_grid_eventgeometry": "EventGeometry" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L276 | neighbors=[meetings-time-grid.tsx, calendar-grid.ts, calendar-grid.test.ts]
- "meetings_calendar_grid_hourlabel": "hourLabel()" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L319 | neighbors=[meetings-time-grid.tsx, calendar-grid.ts, calendar-grid.test.ts]
- "meetings_calendar_grid_isalldaymeeting": "isAllDayMeeting()" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L118 | neighbors=[meetings-time-grid.tsx, calendar-grid.ts, calendar-grid.test.ts]
- "meetings_calendar_grid_isworkinghour": "isWorkingHour()" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L324 | neighbors=[meetings-time-grid.tsx, calendar-grid.ts, calendar-grid.test.ts]
- "meetings_calendar_grid_mineventminutes": "minEventMinutes()" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L89 | neighbors=[meetings-time-grid.tsx, calendar-grid.ts, calendar-grid.test.ts]
- "meetings_calendar_grid_minutesintoday": "minutesIntoDay()" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L312 | neighbors=[meetings-time-grid.tsx, calendar-grid.ts, calendar-grid.test.ts]
- "meetings_calendar_grid_remember": "remember()" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L153 | neighbors=[calendar-grid.ts, DayWindow, zonedDayStartMs()]
- "meetings_calendar_overlap_lanefraction": "laneFraction()" | kind=code-symbol | source=src/features/meetings/calendar-overlap.ts:L154 | neighbors=[meetings-time-grid.tsx, calendar-overlap.ts, calendar-overlap.test.ts]
- "meetings_calendar_view_calendarurlpatch": "calendarUrlPatch()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L129 | neighbors=[meetings-views.tsx, calendar-view.ts, calendar-view.test.ts]
- "meetings_calendar_view_calendarview": "CalendarView" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L27 | neighbors=[meetings-calendar.tsx, meetings-views.tsx, calendar-view.ts]
- "meetings_calendar_view_istimegridview": "isTimeGridView()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L54 | neighbors=[meetings-calendar.tsx, calendar-view.ts, calendar-view.test.ts]
- "meetings_coverage_better": "better()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L345 | neighbors=[coverage.ts, score(), coverAsks()]
- "meetings_coverage_coveragetargetkey": "coverageTargetKey()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L260 | neighbors=[coverage.ts, coverAsks(), coverage.test.ts]
- "meetings_coverage_coverask": "CoverAsk" | kind=code-symbol | source=src/features/meetings/coverage.ts:L66 | neighbors=[coverage.ts, coverage.test.ts, load-actions.ts]
- "meetings_coverage_earliestworkingday": "earliestWorkingDay()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L278 | neighbors=[coverage.ts, coverAsks(), coverage.test.ts]
- "meetings_coverage_separatecost": "separateCost()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L302 | neighbors=[coverage.ts, coverAsks(), isEligibleGroup()]
- "meetings_event_color_eventcolorclasses": "eventColorClasses()" | kind=code-symbol | source=src/features/meetings/event-color.ts:L109 | neighbors=[event-color.ts, eventColorSlot(), event-color.test.ts]
- "meetings_followups_attendeeref": "AttendeeRef" | kind=code-symbol | source=src/features/meetings/followups.ts:L18 | neighbors=[action-item-board.tsx, ai-actions.ts, followups.ts]
- "meetings_followups_buildfollowuprows": "buildFollowupRows()" | kind=code-symbol | source=src/features/meetings/followups.ts:L79 | neighbors=[ai-actions.ts, followups.ts, followups.test.ts]
- "meetings_followups_filtervalidids": "filterValidIds()" | kind=code-symbol | source=src/features/meetings/followups.ts:L246 | neighbors=[ai-actions.ts, followups.ts, followups.test.ts]
- "meetings_followups_followupkind": "FollowupKind" | kind=code-symbol | source=src/features/meetings/followups.ts:L16 | neighbors=[ai-actions.ts, followups.ts, glance-core.ts]
- "meetings_followups_followupmatchcandidate": "FollowupMatchCandidate" | kind=code-symbol | source=src/features/meetings/followups.ts:L328 | neighbors=[ai-actions.ts, followups.ts, followups.test.ts]
- "meetings_followups_followuptextkey": "followupTextKey()" | kind=code-symbol | source=src/features/meetings/followups.ts:L373 | neighbors=[followups.ts, indexUnattributedByText(), matchUnattributed()]
- "meetings_followups_selectunattributed": "selectUnattributed()" | kind=code-symbol | source=src/features/meetings/followups.ts:L236 | neighbors=[ai-actions.ts, followups.ts, followups.test.ts]
- "meetings_followups_unplacedunattributed": "unplacedUnattributed()" | kind=code-symbol | source=src/features/meetings/followups.ts:L430 | neighbors=[meeting-intel.tsx, followups.ts, followups.test.ts]
- "meetings_glance_actions_getmeetingglances": "getMeetingGlances()" | kind=code-symbol | source=src/features/meetings/glance-actions.ts:L55 | neighbors=[glance-actions.ts, glance-batch.ts, glance-batch.test.ts]
- "meetings_glance_core_assembleglanceresponse": "assembleGlanceResponse()" | kind=code-symbol | source=src/features/meetings/glance-core.ts:L220 | neighbors=[glance-actions.ts, glance-actions.test.ts, glance-core.ts]
- "meetings_ics_escapeicstext": "escapeIcsText()" | kind=code-symbol | source=src/features/meetings/ics.ts:L105 | neighbors=[ics.ts, buildIcs(), ics.test.ts]
- "meetings_ics_icsfilename": "icsFileName()" | kind=code-symbol | source=src/features/meetings/ics.ts:L236 | neighbors=[route.ts, ics.ts, ics.test.ts]
- "meetings_ics_linkdetails": "linkDetails()" | kind=code-symbol | source=src/features/meetings/ics.ts:L254 | neighbors=[ics.ts, googleCalendarUrl(), outlookCalendarUrl()]
- "meetings_ics_meetingicsuid": "meetingIcsUid()" | kind=code-symbol | source=src/features/meetings/ics.ts:L75 | neighbors=[route.ts, ics.ts, ics.test.ts]
- "meetings_ics_personline": "personLine()" | kind=code-symbol | source=src/features/meetings/ics.ts:L159 | neighbors=[ics.ts, buildIcs(), quoteParam()]
- "meetings_keyframe_access_canservekeyframe": "canServeKeyframe()" | kind=code-symbol | source=src/features/meetings/keyframe-access.ts:L35 | neighbors=[keyframe-access.ts, keyframe-access.test.ts, route.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-070.json

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
