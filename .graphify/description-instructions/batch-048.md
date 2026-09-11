# Node Description Batch 49 of 166

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

- "maintenance_window_todatetimelocal": "toDatetimeLocal()" | kind=code-symbol | source=src/features/maintenance/window.ts:L200 | neighbors=[maintenance-controls.tsx, window.ts, window.test.ts, pad2()]
- "maintenance_write_freeze_assertwritable": "assertWritable()" | kind=code-symbol | source=src/features/maintenance/write-freeze.ts:L58 | neighbors=[write-freeze.ts, MaintenanceFreezeError, maintenanceFreezeMessage(), maintenanceWriteFrozen()]
- "meeting_load_actions_acceptloadsuggestion": "acceptLoadSuggestion()" | kind=code-symbol | source=src/features/meeting-load/actions.ts:L131 | neighbors=[suggestion-decision-buttons.tsx, actions.ts, decide(), deepLinkFor()]
- "meeting_load_admin_queries_getalldecidedkeys": "getAllDecidedKeys()" | kind=code-symbol | source=src/features/meeting-load/admin-queries.ts:L28 | neighbors=[dashboard-zones.tsx, admin-queries.ts, getAllSuggestionsForAdmin(), getSuggestionsForOrganizer()]
- "meeting_load_admin_queries_getallsuggestionsforadmin": "getAllSuggestionsForAdmin()" | kind=code-symbol | source=src/features/meeting-load/admin-queries.ts:L42 | neighbors=[page.tsx, admin-queries.ts, getAllDecidedKeys(), withNames()]
- "meeting_load_admin_queries_getsuggestionsfororganizer": "getSuggestionsForOrganizer()" | kind=code-symbol | source=src/features/meeting-load/admin-queries.ts:L55 | neighbors=[admin-queries.ts, getAllDecidedKeys(), withNames(), page.tsx]
- "meeting_load_churn_serieschurncount": "seriesChurnCount()" | kind=code-symbol | source=src/features/meeting-load/churn.ts:L29 | neighbors=[churn.ts, inviteChurnBetween(), churn.test.ts, queries.ts]
- "meeting_load_gather_gatherloadfacts": "gatherLoadFacts()" | kind=code-symbol | source=src/features/meeting-load/gather.ts:L87 | neighbors=[actions.ts, admin-queries.ts, gather.ts, queries.ts]
- "meeting_load_observed_change_observedchangefor": "observedChangeFor()" | kind=code-symbol | source=src/features/meeting-load/observed-change.ts:L43 | neighbors=[admin-queries.ts, observed-change.ts, average(), observed-change.test.ts]
- "meeting_load_participation_participationfor": "participationFor()" | kind=code-symbol | source=src/features/meeting-load/participation.ts:L31 | neighbors=[gather.ts, participation.ts, participation.test.ts, queries.ts]
- "meeting_load_queries_getweeklyloadtable": "getWeeklyLoadTable()" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L88 | neighbors=[dashboard-zones.tsx, page.tsx, queries.ts, page.tsx]
- "meeting_load_series_groups_groupintoseries": "groupIntoSeries()" | kind=code-symbol | source=src/features/meeting-load/series-groups.ts:L75 | neighbors=[gather.ts, queries.ts, series-groups.ts, series-groups.test.ts]
- "meeting_load_suggest_aggregatesuggestions": "aggregateSuggestions()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L467 | neighbors=[queries.ts, suggest.ts, oneDecimal(), suggest.test.ts]
- "meeting_load_suggest_analyzedoccurrence": "AnalyzedOccurrence" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L34 | neighbors=[gather.ts, redaction-boundary.test.ts, suggest.ts, suggest.test.ts]
- "meeting_load_suggest_ruleshareslot": "ruleShareSlot()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L291 | neighbors=[suggest.ts, inviteJaccard(), sameWeekCount(), suggest()]
- "meeting_load_suggest_seriesmetrics": "SeriesMetrics" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L59 | neighbors=[gather.ts, redaction-boundary.test.ts, suggest.ts, suggest.test.ts]
- "meeting_load_suggest_suggestion": "Suggestion" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L80 | neighbors=[meeting-load-admin-card.tsx, your-series-card.tsx, admin-queries.ts, suggest.ts]
- "meeting_load_trend_points_buildloadtrend": "buildLoadTrend()" | kind=code-symbol | source=src/features/meeting-load/trend-points.ts:L28 | neighbors=[dashboard-zones.tsx, queries.ts, trend-points.ts, trend-points.test.ts]
- "meeting_load_trend_points_loadtrenddata": "LoadTrendData" | kind=code-symbol | source=src/features/meeting-load/trend-points.ts:L16 | neighbors=[meeting-load-card.tsx, meeting-load-trend.tsx, queries.ts, trend-points.ts]
- "meeting_load_trend_points_test": "trend-points.test.ts" | kind=code-symbol | source=src/features/meeting-load/trend-points.test.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, trend-points.ts, buildLoadTrend(), NOW]
- "meeting_load_week_bucket_test": "week-bucket.test.ts" | kind=code-symbol | source=src/features/meeting-load/week-bucket.test.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, week-bucket.ts, localWeekStartIso(), weekStartIsoOffset()]
- "meeting_load_week_bucket_weekstartisooffset": "weekStartIsoOffset()" | kind=code-symbol | source=src/features/meeting-load/week-bucket.ts:L42 | neighbors=[admin-queries.ts, trend-points.ts, week-bucket.ts, week-bucket.test.ts]
- "meetings_actions_isforeignkeyviolation": "isForeignKeyViolation()" | kind=code-symbol | source=src/features/meetings/actions.ts:L137 | neighbors=[actions.ts, createMeeting(), setMeetingApps(), updateMeeting()]
- "meetings_actions_mirroredappid": "mirroredAppId()" | kind=code-symbol | source=src/features/meetings/actions.ts:L217 | neighbors=[actions.ts, createMeeting(), setMeetingApps(), updateMeeting()]
- "meetings_actions_synccalendarinvite": "syncCalendarInvite()" | kind=code-symbol | source=src/features/meetings/actions.ts:L300 | neighbors=[actions.ts, createMeeting(), retryCalendarInvite(), attendeeEmails()]
- "meetings_actions_synccalendartime": "syncCalendarTime()" | kind=code-symbol | source=src/features/meetings/actions.ts:L367 | neighbors=[actions.ts, rescheduleMeeting(), moveWarning(), updateMeeting()]
- "meetings_ai_actions_attendeeappspromptblock": "attendeeAppsPromptBlock()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L737 | neighbors=[ai-actions.ts, analyzeMeetingAudio(), unionAppOptions(), finalizeMeetingRecordingInner()]
- "meetings_ai_actions_copyfollowupresponsetonotes": "copyFollowupResponseToNotes()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2983 | neighbors=[meeting-intel.tsx, ai-actions.ts, authorizeFollowupWrite(), canReadMeetingIntel()]
- "meetings_ai_actions_editnotesegment": "editNoteSegment()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3514 | neighbors=[note-timeline.tsx, record-timeline.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_finalizemeetingrecording": "finalizeMeetingRecording()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1594 | neighbors=[meeting-intel.tsx, ai-actions.ts, finalizeMeetingRecordingInner(), recordingFailure()]
- "meetings_ai_actions_getmeetingprep": "getMeetingPrep()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2216 | neighbors=[meeting-prep.tsx, ai-actions.ts, canReadMeetingIntel(), fetchAttendees()]
- "meetings_ai_actions_resolvefollowup": "resolveFollowup()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2591 | neighbors=[meeting-intel.tsx, ai-actions.ts, authorizeFollowupWrite(), canReadMeetingIntel()]
- "meetings_ai_actions_setspeakermapping": "setSpeakerMapping()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L4065 | neighbors=[note-timeline.tsx, print-speaker-names.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_transcribesegment": "transcribeSegment()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1436 | neighbors=[meeting-intel.tsx, ai-actions.ts, recordingFailure(), transcribeSegmentInner()]
- "meetings_ai_actions_transcribesegmentinner": "transcribeSegmentInner()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1455 | neighbors=[ai-actions.ts, transcribeSegment(), canManageMeeting(), fetchAttendees()]
- "meetings_ai_actions_unionappoptions": "unionAppOptions()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L724 | neighbors=[ai-actions.ts, analyzeMeetingAudio(), attendeeAppsPromptBlock(), finalizeMeetingRecordingInner()]
- "meetings_ai_actions_updatetasksuggestion": "updateTaskSuggestion()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L4214 | neighbors=[action-item-board.tsx, meeting-notes.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_uploadmeetingkeyframe": "uploadMeetingKeyframe()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1889 | neighbors=[use-screen-keyframes.ts, ai-actions.ts, canManageMeeting(), keyframeProxyUrl()]
- "meetings_ai_actions_writeopenfollowupnote": "writeOpenFollowupNote()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2815 | neighbors=[ai-actions.ts, deferFollowupReason(), noteFollowup(), authorizeFollowupWrite()]
- "meetings_ask_derivation_overdueasktext": "overdueAskText()" | kind=code-symbol | source=src/features/meetings/ask-derivation.ts:L93 | neighbors=[ask-derivation.ts, plural(), load-actions.ts, planner.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-048.json

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
