# Node Description Batch 101 of 166

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

- "meeting_load_queries_getseriestable": "getSeriesTable()" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L157 | neighbors=[page.tsx, queries.ts]
- "meeting_load_queries_getsuggestionsaggregate": "getSuggestionsAggregate()" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L205 | neighbors=[dashboard-zones.tsx, queries.ts]
- "meeting_load_queries_weeklyhours": "weeklyHours()" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L73 | neighbors=[queries.ts, getInvitedHoursTrend()]
- "meeting_load_series_groups_test_daysbefore": "daysBefore()" | kind=code-symbol | source=src/features/meeting-load/series-groups.test.ts:L5 | neighbors=[series-groups.test.ts, occurrence()]
- "meeting_load_series_groups_test_occurrence": "occurrence()" | kind=code-symbol | source=src/features/meeting-load/series-groups.test.ts:L7 | neighbors=[series-groups.test.ts, daysBefore()]
- "meeting_load_suggest_allowed_occurrence_keys": "ALLOWED_OCCURRENCE_KEYS" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L99 | neighbors=[suggest.ts, suggest.test.ts]
- "meeting_load_suggest_median": "median()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L126 | neighbors=[suggest.ts, ruleShorten()]
- "meeting_load_suggest_rulecancelreview": "ruleCancelReview()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L170 | neighbors=[suggest.ts, coverage()]
- "meeting_load_suggest_ruleshorten": "ruleShorten()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L219 | neighbors=[suggest.ts, median()]
- "meeting_load_suggest_sameweekcount": "sameWeekCount()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L271 | neighbors=[suggest.ts, ruleShareSlot()]
- "meeting_load_suggest_test_analyzed": "analyzed()" | kind=code-symbol | source=src/features/meeting-load/suggest.test.ts:L14 | neighbors=[suggest.test.ts, series()]
- "meeting_load_suggest_test_series": "series()" | kind=code-symbol | source=src/features/meeting-load/suggest.test.ts:L27 | neighbors=[suggest.test.ts, analyzed()]
- "meeting_load_trend_points_weekhours": "WeekHours" | kind=code-symbol | source=src/features/meeting-load/trend-points.ts:L14 | neighbors=[observed-change.ts, trend-points.ts]
- "meetings_actions_appidsformeeting": "appIdsForMeeting()" | kind=code-symbol | source=src/features/meetings/actions.ts:L175 | neighbors=[actions.ts, meetingById()]
- "meetings_actions_appnamesbyids": "appNamesByIds()" | kind=code-symbol | source=src/features/meetings/actions.ts:L197 | neighbors=[actions.ts, setMeetingApps()]
- "meetings_actions_attendeeemails": "attendeeEmails()" | kind=code-symbol | source=src/features/meetings/actions.ts:L282 | neighbors=[actions.ts, syncCalendarInvite()]
- "meetings_actions_invitewarning": "inviteWarning()" | kind=code-symbol | source=src/features/meetings/actions.ts:L114 | neighbors=[actions.ts, createMeeting()]
- "meetings_actions_movewarning": "moveWarning()" | kind=code-symbol | source=src/features/meetings/actions.ts:L121 | neighbors=[actions.ts, syncCalendarTime()]
- "meetings_actions_retryfailedmessage": "retryFailedMessage()" | kind=code-symbol | source=src/features/meetings/actions.ts:L119 | neighbors=[actions.ts, retryCalendarInvite()]
- "meetings_ai_actions_assignfollowupperson": "assignFollowupPerson()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3346 | neighbors=[ai-actions.ts, authorizeFollowupWrite()]
- "meetings_ai_actions_assignmenthistorystatements": "assignmentHistoryStatements()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3691 | neighbors=[ai-actions.ts, assignSpeaker()]
- "meetings_ai_actions_attendancehistorystatements": "attendanceHistoryStatements()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3722 | neighbors=[ai-actions.ts, assignSpeaker()]
- "meetings_ai_actions_carriedforwarditem": "CarriedForwardItem" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L205 | neighbors=[meeting-intel.tsx, ai-actions.ts]
- "meetings_ai_actions_deriveandinsertfollowups": "deriveAndInsertFollowups()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L961 | neighbors=[ai-actions.ts, persistMeetingAnalysis()]
- "meetings_ai_actions_fetchfollowuptargets": "fetchFollowupTargets()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L853 | neighbors=[ai-actions.ts, getMeetingIntel()]
- "meetings_ai_actions_fetchnextsegmentindex": "fetchNextSegmentIndex()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2190 | neighbors=[ai-actions.ts, getMeetingIntel()]
- "meetings_ai_actions_fetchspeakerlabels": "fetchSpeakerLabels()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3147 | neighbors=[ai-actions.ts, getSpeakerAssignmentData()]
- "meetings_ai_actions_fetchunattributedfollowups": "fetchUnattributedFollowups()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L906 | neighbors=[ai-actions.ts, getMeetingIntel()]
- "meetings_ai_actions_followuptargetoption": "FollowupTargetOption" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L244 | neighbors=[meeting-intel.tsx, ai-actions.ts]
- "meetings_ai_actions_keyframeproxyurl": "keyframeProxyUrl()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1850 | neighbors=[ai-actions.ts, uploadMeetingKeyframe()]
- "meetings_ai_actions_linkedtaskview": "LinkedTaskView" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L198 | neighbors=[meeting-intel.tsx, ai-actions.ts]
- "meetings_ai_actions_meetingainotesview": "MeetingAiNotesView" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L170 | neighbors=[meeting-notes.tsx, ai-actions.ts]
- "meetings_ai_actions_nextmeetingsuggestion": "NextMeetingSuggestion" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2428 | neighbors=[next-meeting-card.tsx, ai-actions.ts]
- "meetings_ai_actions_notetimelinedata": "NoteTimelineData" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3103 | neighbors=[note-timeline.tsx, ai-actions.ts]
- "meetings_ai_actions_speakerassignmentdata": "SpeakerAssignmentData" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3079 | neighbors=[speaker-assignment.tsx, ai-actions.ts]
- "meetings_ai_actions_speakerrow": "SpeakerRow" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3029 | neighbors=[page.tsx, ai-actions.ts]
- "meetings_app_labels_meetingapp": "MeetingApp" | kind=code-symbol | source=src/features/meetings/app-labels.ts:L9 | neighbors=[app-labels.ts, queries.ts]
- "meetings_ask_derivation_checkinaskcontext": "checkinAskContext()" | kind=code-symbol | source=src/features/meetings/ask-derivation.ts:L135 | neighbors=[ask-derivation.ts, planner.ts]
- "meetings_ask_derivation_checkinasktext": "checkinAskText()" | kind=code-symbol | source=src/features/meetings/ask-derivation.ts:L120 | neighbors=[ask-derivation.ts, planner.ts]
- "meetings_ask_derivation_ispastdue": "isPastDue()" | kind=code-symbol | source=src/features/meetings/ask-derivation.ts:L50 | neighbors=[ask-derivation.ts, overdueRowsByUserApp()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-100.json

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
