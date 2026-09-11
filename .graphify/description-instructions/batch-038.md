# Node Description Batch 39 of 166

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

- "maintenance_window_kind_headings": "KIND_HEADINGS" | kind=code-symbol | source=src/features/maintenance/window.ts:L339 | neighbors=[maintenance-banner.tsx, maintenance-details-dialog.tsx, maintenance-overlay.tsx, lifecycle.ts, window.ts]
- "maintenance_window_maintenancephase": "MaintenancePhase" | kind=code-symbol | source=src/features/maintenance/window.ts:L41 | neighbors=[maintenance-gate.tsx, freeze.ts, lifecycle.ts, window.ts, window.test.ts]
- "meeting_load_churn_test": "churn.test.ts" | kind=code-symbol | source=src/features/meeting-load/churn.test.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, churn.ts, inviteChurnBetween(), seriesChurnCount(), occ()]
- "meeting_load_density_splitoutputs": "splitOutputs()" | kind=code-symbol | source=src/features/meeting-load/density.ts:L39 | neighbors=[density.ts, deadlinesCount(), density.test.ts, gather.ts, queries.ts]
- "meeting_load_load_math_invitedhoursfor": "invitedHoursFor()" | kind=code-symbol | source=src/features/meeting-load/load-math.ts:L49 | neighbors=[admin-queries.ts, gather.ts, load-math.ts, load-math.test.ts, queries.ts]
- "meeting_load_load_math_test": "load-math.test.ts" | kind=code-symbol | source=src/features/meeting-load/load-math.test.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, load-math.ts, invitedHoursFor(), rsvpAdoption(), at()]
- "meeting_load_observed_change_test": "observed-change.test.ts" | kind=code-symbol | source=src/features/meeting-load/observed-change.test.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, observed-change.ts, observedChangeFor(), DECIDED, weeks()]
- "meeting_load_participation_seriesparticipationmedians": "seriesParticipationMedians()" | kind=code-symbol | source=src/features/meeting-load/participation.ts:L54 | neighbors=[participation.ts, median(), participation.test.ts, queries.ts, suggest.ts]
- "meeting_load_participation_test": "participation.test.ts" | kind=code-symbol | source=src/features/meeting-load/participation.test.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, participation.ts, isLowParticipation(), participationFor(), seriesParticipationMedians()]
- "meetings_ai_actions_accepttasksuggestion": "acceptTaskSuggestion()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L4281 | neighbors=[action-item-board.tsx, meeting-notes.tsx, ai-actions.ts, canManageMeeting(), linkFollowupToTask()]
- "meetings_ai_actions_assignspeaker": "assignSpeaker()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3801 | neighbors=[speaker-assignment.tsx, ai-actions.ts, assignmentHistoryStatements(), attendanceHistoryStatements(), canManageMeeting()]
- "meetings_ai_actions_tasksuggestionview": "TaskSuggestionView" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3039 | neighbors=[action-item-board.tsx, meeting-notes.tsx, meeting-notes-dialog.tsx, page.tsx, ai-actions.ts]
- "meetings_attendance_history_buildattendanceentry": "buildAttendanceEntry()" | kind=code-symbol | source=src/features/meetings/attendance-history.ts:L62 | neighbors=[actions.ts, ai-actions.ts, attendance-history.ts, attendance-history.test.ts, rsvp-actions.ts]
- "meetings_attendee_prefill_test": "attendee-prefill.test.ts" | kind=code-symbol | source=src/features/meetings/attendee-prefill.test.ts:L1 | neighbors=[attendee-prefill.ts, addEveryone(), applyQuickAddAttendees(), applyTeamPrefill(), roster]
- "meetings_attendee_score_daysbetween": "daysBetween()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L605 | neighbors=[attendee-score.ts, scoreCandidate(), scoreDiscussion(), scoreFollowups(), scoreVoice()]
- "meetings_attendee_score_scorediscussion": "scoreDiscussion()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L833 | neighbors=[attendee-score.ts, scoreCandidate(), daysBetween(), e4e5Recency(), renderReason()]
- "meetings_attendee_score_scorefollowups": "scoreFollowups()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L672 | neighbors=[attendee-score.ts, scoreCandidate(), daysBetween(), e1Recency(), renderReason()]
- "meetings_attendee_score_scoretopic": "scoreTopic()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L784 | neighbors=[attendee-score.ts, scoreCandidate(), findTechTagHit(), meaningfulTokenCount(), renderReason()]
- "meetings_auto_title": "auto-title.ts" | kind=code-symbol | source=src/features/meetings/auto-title.ts:L1 | neighbors=[meeting-form.tsx, lk-holidays.ts, autoMeetingTitle(), isAutoMeetingTitle(), auto-title.test.ts]
- "meetings_calendar_view_addcalendarmonths": "addCalendarMonths()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L182 | neighbors=[calendar-view.ts, isoParts(), toIso(), stepFocusedDate(), calendar-view.test.ts]
- "meetings_calendar_view_endofmonthiso": "endOfMonthIso()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L173 | neighbors=[calendar-view.ts, isoParts(), toIso(), calendar-view.test.ts, VisibleRange]
- "meetings_calendar_view_isodayinstant": "isoDayInstant()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L262 | neighbors=[meetings-agenda.tsx, meetings-time-grid.tsx, meetings-views.tsx, calendar-view.ts, calendar-view.test.ts]
- "meetings_calendar_view_parsefocuseddate": "parseFocusedDate()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L104 | neighbors=[meetings-views.tsx, calendar-view.ts, isIsoDate(), calendar-view.test.ts, page.tsx]
- "meetings_calendar_view_startofmonthiso": "startOfMonthIso()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L168 | neighbors=[calendar-view.ts, isoParts(), toIso(), calendar-view.test.ts, VisibleRange]
- "meetings_followups_followuptasksimilarity": "followupTaskSimilarity()" | kind=code-symbol | source=src/features/meetings/followups.ts:L306 | neighbors=[meeting-notes-model.ts, followups.ts, findMatchingFollowup(), normalizeMatchTokens(), followups.test.ts]
- "meetings_followups_matchunattributed": "matchUnattributed()" | kind=code-symbol | source=src/features/meetings/followups.ts:L412 | neighbors=[meeting-intel.tsx, meeting-notes.tsx, followups.ts, followupTextKey(), followups.test.ts]
- "meetings_ics_outlookcalendarurl": "outlookCalendarUrl()" | kind=code-symbol | source=src/features/meetings/ics.ts:L283 | neighbors=[add-to-calendar.tsx, meeting-list.tsx, ics.ts, linkDetails(), ics.test.ts]
- "meetings_list_search_test": "list-search.test.ts" | kind=code-symbol | source=src/features/meetings/list-search.test.ts:L1 | neighbors=[671c254 ., list-search.ts, filterMeetingsBySearch(), Row, titles()]
- "meetings_next_meeting_test": "next-meeting.test.ts" | kind=code-symbol | source=src/features/meetings/next-meeting.test.ts:L1 | neighbors=[3c0bc01 ., next-meeting.ts, describeNextMeeting(), nextMeetingDueDate(), parseColomboWallClock()]
- "meetings_note_labels_keyframedeletelabel": "keyframeDeleteLabel()" | kind=code-symbol | source=src/features/meetings/note-labels.ts:L19 | neighbors=[trash-actions.ts, trash-grouping.ts, trash-grouping.test.ts, ai-actions.ts, note-labels.ts]
- "meetings_note_labels_notesegmentdeletelabel": "noteSegmentDeleteLabel()" | kind=code-symbol | source=src/features/meetings/note-labels.ts:L18 | neighbors=[trash-actions.ts, trash-grouping.ts, trash-grouping.test.ts, ai-actions.ts, note-labels.ts]
- "meetings_notes_resolvespeakernameforlabel": "resolveSpeakerNameForLabel()" | kind=code-symbol | source=src/features/meetings/notes.ts:L92 | neighbors=[note-timeline.tsx, assistant-actions.ts, notes.ts, resolveSpeakerName(), notes.test.ts]
- "meetings_segment_store_runtransaction": "runTransaction()" | kind=code-symbol | source=src/features/meetings/segment-store.ts:L77 | neighbors=[segment-store.ts, loadParkedSegments(), parkSegment(), releaseSegment(), openDb()]
- "meetings_series_key_purposetoken": "PurposeToken" | kind=code-symbol | source=src/features/meetings/series-key.ts:L226 | neighbors=[suggest.ts, coverage.ts, load-actions.ts, series-key.ts, series-key.test.ts]
- "meetings_series_key_test": "series-key.test.ts" | kind=code-symbol | source=src/features/meetings/series-key.test.ts:L1 | neighbors=[232b7ef ., series-key.ts, purposesCompatible(), PurposeToken, seriesKey()]
- "meetings_summary_length_test": "summary-length.test.ts" | kind=code-symbol | source=src/features/meetings/summary-length.test.ts:L1 | neighbors=[5a95470 fix(meetings): transcripts stop…, summary-length.ts, estimateMinutesFromAudioBytes(), estimateMinutesFromTranscript(), summaryDepthInstruction()]
- "meetings_text_replace_actions_meetingreplacematches": "MeetingReplaceMatches" | kind=code-symbol | source=src/features/meetings/text-replace-actions.ts:L80 | neighbors=[correct-selection.tsx, meeting-notes.tsx, note-timeline.tsx, replace-review-dialog.tsx, text-replace-actions.ts]
- "mini_calendar_index_useminicalendar": "useMiniCalendar()" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L39 | neighbors=[index.tsx, MiniCalendarDay(), MiniCalendarDays(), MiniCalendarNavigation(), MiniCalendarTodayButton()]
- "motion_motion_provider": "motion-provider.tsx" | kind=code-symbol | source=src/components/motion/motion-provider.tsx:L1 | neighbors=[layout.tsx, 007c37f ., hydrated.ts, markHydrated(), MotionProvider()]
- "notifications_commands": "commands.ts" | kind=code-symbol | source=src/features/notifications/commands.ts:L1 | neighbors=[actions.ts, commands, types.ts, CommandDescriptor, commands.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-038.json

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
