# Node Description Batch 50 of 166

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

- "meetings_ask_derivation_overduerowsbyuserapp": "overdueRowsByUserApp()" | kind=code-symbol | source=src/features/meetings/ask-derivation.ts:L72 | neighbors=[ask-derivation.ts, isPastDue(), load-actions.ts, planner.ts]
- "meetings_ask_derivation_plural": "plural()" | kind=code-symbol | source=src/features/meetings/ask-derivation.ts:L39 | neighbors=[ask-derivation.ts, overdueAskText(), stalledAskText(), planner.ts]
- "meetings_ask_derivation_stalledasktext": "stalledAskText()" | kind=code-symbol | source=src/features/meetings/ask-derivation.ts:L108 | neighbors=[ask-derivation.ts, plural(), load-actions.ts, planner.ts]
- "meetings_attendee_prefill_applyquickaddattendees": "applyQuickAddAttendees()" | kind=code-symbol | source=src/features/meetings/attendee-prefill.ts:L65 | neighbors=[meeting-form.tsx, attendee-prefill.ts, applyTeamPrefill(), attendee-prefill.test.ts]
- "meetings_attendee_prefill_applyteamprefill": "applyTeamPrefill()" | kind=code-symbol | source=src/features/meetings/attendee-prefill.ts:L33 | neighbors=[meeting-form.tsx, attendee-prefill.ts, applyQuickAddAttendees(), attendee-prefill.test.ts]
- "meetings_attendee_score_fmtdaymonth": "fmtDayMonth()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L657 | neighbors=[attendee-score.ts, scoreCandidate(), scoreTasks(), scoreVoice()]
- "meetings_attendee_score_scoretasks": "scoreTasks()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L745 | neighbors=[attendee-score.ts, scoreCandidate(), fmtDayMonth(), renderReason()]
- "meetings_auto_title_test": "auto-title.test.ts" | kind=code-symbol | source=src/features/meetings/auto-title.test.ts:L1 | neighbors=[auto-title.ts, autoMeetingTitle(), isAutoMeetingTitle(), AUG_12_10AM_LK]
- "meetings_calendar_grid_zoneoffsetms": "zoneOffsetMs()" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L179 | neighbors=[calendar-grid.ts, zonedDayStartMs(), offsetFormatter(), recurrence.ts]
- "meetings_calendar_overlap_layoutoverlaps": "layoutOverlaps()" | kind=code-symbol | source=src/features/meetings/calendar-overlap.ts:L86 | neighbors=[calendar-overlap.ts, effectiveEnd(), overlapMap(), calendar-overlap.test.ts]
- "meetings_calendar_overlap_overlapmap": "overlapMap()" | kind=code-symbol | source=src/features/meetings/calendar-overlap.ts:L143 | neighbors=[meetings-time-grid.tsx, calendar-overlap.ts, layoutOverlaps(), calendar-overlap.test.ts]
- "meetings_calendar_view_isisodate": "isIsoDate()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L91 | neighbors=[meetings-views.tsx, calendar-view.ts, parseFocusedDate(), calendar-view.test.ts]
- "meetings_calendar_view_mondayindex": "mondayIndex()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L159 | neighbors=[calendar-view.ts, isoParts(), startOfWeekIso(), calendar-view.test.ts]
- "meetings_calendar_view_parsecalendarview": "parseCalendarView()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L81 | neighbors=[meetings-views.tsx, calendar-view.ts, calendar-view.test.ts, page.tsx]
- "meetings_calendar_view_startofweekiso": "startOfWeekIso()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L164 | neighbors=[calendar-view.ts, mondayIndex(), calendar-view.test.ts, VisibleRange]
- "meetings_calendar_view_stepfocuseddate": "stepFocusedDate()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L242 | neighbors=[meetings-calendar.tsx, calendar-view.ts, addCalendarMonths(), calendar-view.test.ts]
- "meetings_calendar_view_toiso": "toIso()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L150 | neighbors=[calendar-view.ts, addCalendarMonths(), endOfMonthIso(), startOfMonthIso()]
- "meetings_coverage_iseligiblegroup": "isEligibleGroup()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L323 | neighbors=[coverage.ts, coverAsks(), personMinutes(), separateCost()]
- "meetings_coverage_meetingminutes": "meetingMinutes()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L206 | neighbors=[coverage.ts, coverAsks(), personMinutes(), coverage.test.ts]
- "meetings_coverage_score": "score()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L331 | neighbors=[coverage.ts, better(), coverAsks(), personMinutes()]
- "meetings_event_color_eventfadedclasses": "eventFadedClasses()" | kind=code-symbol | source=src/features/meetings/event-color.ts:L160 | neighbors=[meetings-month-calendar.tsx, event-color.ts, eventColorSlot(), event-color.test.ts]
- "meetings_event_color_eventsolidclasses": "eventSolidClasses()" | kind=code-symbol | source=src/features/meetings/event-color.ts:L155 | neighbors=[meetings-month-calendar.tsx, event-color.ts, eventColorSlot(), event-color.test.ts]
- "meetings_event_color_meetingcolorkey": "meetingColorKey()" | kind=code-symbol | source=src/features/meetings/event-color.ts:L61 | neighbors=[meetings-month-calendar.tsx, meetings-time-grid.tsx, event-color.ts, event-color.test.ts]
- "meetings_followups_findmatchingfollowup": "findMatchingFollowup()" | kind=code-symbol | source=src/features/meetings/followups.ts:L342 | neighbors=[ai-actions.ts, followups.ts, followupTaskSimilarity(), followups.test.ts]
- "meetings_followups_indexunattributedbytext": "indexUnattributedByText()" | kind=code-symbol | source=src/features/meetings/followups.ts:L396 | neighbors=[meeting-intel.tsx, followups.ts, followupTextKey(), followups.test.ts]
- "meetings_followups_openfollowupitem": "OpenFollowupItem" | kind=code-symbol | source=src/features/meetings/followups.ts:L114 | neighbors=[ai-actions.ts, followups.ts, followups.test.ts, glance-core.ts]
- "meetings_followups_selectcarriedforward": "selectCarriedForward()" | kind=code-symbol | source=src/features/meetings/followups.ts:L181 | neighbors=[ai-actions.ts, followups.ts, followups.test.ts, glance-core.ts]
- "meetings_glance_batch_getmeetingglanceschunked": "getMeetingGlancesChunked()" | kind=code-symbol | source=src/features/meetings/glance-batch.ts:L26 | neighbors=[use-glance-map.tsx, glance-batch.ts, glance-batch.test.ts, page.tsx]
- "meetings_glance_core_buildglancemap": "buildGlanceMap()" | kind=code-symbol | source=src/features/meetings/glance-core.ts:L151 | neighbors=[glance-actions.ts, glance-actions.test.ts, glance-core.ts, asArray()]
- "meetings_glance_core_decideintelreadable": "decideIntelReadable()" | kind=code-symbol | source=src/features/meetings/glance-core.ts:L116 | neighbors=[meetings-views.tsx, glance-actions.ts, glance-actions.test.ts, glance-core.ts]
- "meetings_ics_formaticsutc": "formatIcsUtc()" | kind=code-symbol | source=src/features/meetings/ics.ts:L84 | neighbors=[ics.ts, buildIcs(), googleCalendarUrl(), ics.test.ts]
- "meetings_language_switch_estimatespokenunits": "estimateSpokenUnits()" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L191 | neighbors=[language-switch.ts, countMatches(), pickInterimLeader(), language-switch.test.ts]
- "meetings_language_switch_pickinterimleader": "pickInterimLeader()" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L237 | neighbors=[meeting-intel.tsx, language-switch.ts, estimateSpokenUnits(), language-switch.test.ts]
- "meetings_list_filter_listfilter": "ListFilter" | kind=code-symbol | source=src/features/meetings/list-filter.ts:L18 | neighbors=[triage-rail.tsx, upcoming-filter.tsx, list-filter.ts, list-filter.test.ts]
- "meetings_list_filter_parselistfilter": "parseListFilter()" | kind=code-symbol | source=src/features/meetings/list-filter.ts:L27 | neighbors=[meetings-views.tsx, triage-rail.tsx, list-filter.ts, list-filter.test.ts]
- "meetings_list_search_filtermeetingsbysearch": "filterMeetingsBySearch()" | kind=code-symbol | source=src/features/meetings/list-search.ts:L31 | neighbors=[meetings-views.tsx, list-search.ts, fold(), list-search.test.ts]
- "meetings_meeting_url_meetingurlschema": "meetingUrlSchema" | kind=code-symbol | source=src/features/meetings/meeting-url.ts:L18 | neighbors=[actions.ts, meeting-url.ts, meeting-url.test.ts, rsvp-actions.ts]
- "meetings_meeting_url_test": "meeting-url.test.ts" | kind=code-symbol | source=src/features/meetings/meeting-url.test.ts:L1 | neighbors=[meeting-url.ts, isValidMeetingUrl(), meetingUrlSchema, parse()]
- "meetings_next_meeting_nextmeetingduedate": "nextMeetingDueDate()" | kind=code-symbol | source=src/features/meetings/next-meeting.ts:L45 | neighbors=[meeting-intel.tsx, ai-actions.ts, next-meeting.ts, next-meeting.test.ts]
- "meetings_next_meeting_parsecolombowallclock": "parseColomboWallClock()" | kind=code-symbol | source=src/features/meetings/next-meeting.ts:L152 | neighbors=[ai-actions.ts, next-meeting.ts, next-meeting.test.ts, queries.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-049.json

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
