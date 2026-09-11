# Node Description Batch 51 of 166

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

- "meetings_notes_normalizeduedate": "normalizeDueDate()" | kind=code-symbol | source=src/features/meetings/notes.ts:L157 | neighbors=[ai-actions.ts, notes.ts, suggestionToTaskPayload(), notes.test.ts]
- "meetings_notes_resolvespeakername": "resolveSpeakerName()" | kind=code-symbol | source=src/features/meetings/notes.ts:L77 | neighbors=[page.tsx, notes.ts, resolveSpeakerNameForLabel(), notes.test.ts]
- "meetings_notes_resolvespeakeruserid": "resolveSpeakerUserId()" | kind=code-symbol | source=src/features/meetings/notes.ts:L45 | neighbors=[ai-actions.ts, followups.ts, notes.ts, notes.test.ts]
- "meetings_notes_suggestiontotaskpayload": "suggestionToTaskPayload()" | kind=code-symbol | source=src/features/meetings/notes.ts:L218 | neighbors=[ai-actions.ts, notes.ts, normalizeDueDate(), notes.test.ts]
- "meetings_planner_assemblemeetingplan": "assembleMeetingPlan()" | kind=code-symbol | source=src/features/meetings/planner.ts:L251 | neighbors=[planner.ts, planner-actions.ts, candidateReason(), planner.test.ts]
- "meetings_queries_listmeetingswindowed": "listMeetingsWindowed()" | kind=code-symbol | source=src/features/meetings/queries.ts:L214 | neighbors=[list-actions.ts, page.tsx, queries.ts, hydrate()]
- "meetings_recording_progress_meetingprocessing": "MeetingProcessing" | kind=code-symbol | source=src/features/meetings/recording-progress.ts:L93 | neighbors=[recording-progress.ts, capPercent(), observedMsPerSegment(), recording-progress.test.ts]
- "meetings_recording_progress_observedmspersegment": "observedMsPerSegment()" | kind=code-symbol | source=src/features/meetings/recording-progress.ts:L85 | neighbors=[meeting-intel.tsx, recording-progress.ts, MeetingProcessing, recording-progress.test.ts]
- "meetings_recurrence_daynumber": "dayNumber()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L83 | neighbors=[recurrence.ts, partsOf(), expand(), weekIndex()]
- "meetings_recurrence_isoof": "isoOf()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L76 | neighbors=[recurrence.ts, expand(), isoFromDayNumber(), nthWeekdayOf()]
- "meetings_recurrence_nthofmonth": "nthOfMonth()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L114 | neighbors=[recurrence.ts, expand(), partsOf(), rruleFor()]
- "meetings_recurrence_nthweekdayof": "nthWeekdayOf()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L123 | neighbors=[recurrence.ts, expand(), daysInMonth(), isoOf()]
- "meetings_recurrence_weekdayof": "weekdayOf()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L93 | neighbors=[recurrence.ts, expand(), rruleFor(), partsOf()]
- "meetings_reschedule": "reschedule.ts" | kind=code-symbol | source=src/features/meetings/reschedule.ts:L1 | neighbors=[meetings-month-calendar.tsx, dayKeyToDate(), moveMeetingToDay(), reschedule.test.ts]
- "meetings_rsvp_actions_respondtomeeting": "respondToMeeting()" | kind=code-symbol | source=src/features/meetings/rsvp-actions.ts:L66 | neighbors=[meeting-list.tsx, meeting-rsvp.tsx, rsvp-actions.ts, attendanceHistoryStatements()]
- "meetings_screen_keyframes_formatcapturedat": "formatCapturedAt()" | kind=code-symbol | source=src/features/meetings/screen-keyframes.ts:L192 | neighbors=[screen-filmstrip.tsx, ai-actions.ts, screen-keyframes.ts, screen-keyframes.test.ts]
- "meetings_segment_store_parksegment": "parkSegment()" | kind=code-symbol | source=src/features/meetings/segment-store.ts:L110 | neighbors=[meeting-intel.tsx, segment-store.ts, keyFor(), runTransaction()]
- "meetings_series_key_purposescompatible": "purposesCompatible()" | kind=code-symbol | source=src/features/meetings/series-key.ts:L301 | neighbors=[suggest.ts, coverage.ts, series-key.ts, series-key.test.ts]
- "meetings_series_key_serieskey": "seriesKey()" | kind=code-symbol | source=src/features/meetings/series-key.ts:L156 | neighbors=[series-groups.ts, attendee-series.ts, series-key.ts, series-key.test.ts]
- "meetings_split_upcoming_test": "split-upcoming.test.ts" | kind=code-symbol | source=src/features/meetings/split-upcoming.test.ts:L1 | neighbors=[split-upcoming.ts, splitByUpcoming(), meeting(), now]
- "meetings_summary_length_summarydepthinstruction": "summaryDepthInstruction()" | kind=code-symbol | source=src/features/meetings/summary-length.ts:L54 | neighbors=[ai-actions.ts, summary-length.ts, estimateMinutesFromTranscript(), summary-length.test.ts]
- "meetings_text_replace_actions_applymeetingreplacements": "applyMeetingReplacements()" | kind=code-symbol | source=src/features/meetings/text-replace-actions.ts:L226 | neighbors=[replace-review-dialog.tsx, text-replace-actions.ts, decodeTargetId(), fetchTargets()]
- "meetings_text_replace_actions_fetchtargets": "fetchTargets()" | kind=code-symbol | source=src/features/meetings/text-replace-actions.ts:L113 | neighbors=[text-replace-actions.ts, applyMeetingReplacements(), encodeTargetId(), findMeetingReplacements()]
- "meetings_text_replace_actions_findmeetingreplacements": "findMeetingReplacements()" | kind=code-symbol | source=src/features/meetings/text-replace-actions.ts:L192 | neighbors=[correct-selection.tsx, note-timeline.tsx, text-replace-actions.ts, fetchTargets()]
- "meetings_text_replace_diffsingleword": "diffSingleWord()" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L159 | neighbors=[note-timeline.tsx, text-replace.ts, tokenize(), text-replace.test.ts]
- "meetings_text_replace_normalizeselectedterm": "normalizeSelectedTerm()" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L218 | neighbors=[correct-selection.tsx, text-replace.ts, tokenize(), text-replace.test.ts]
- "meetings_text_replace_occurrence": "Occurrence" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L35 | neighbors=[replace-review-dialog.tsx, text-replace.ts, text-replace-actions.ts, text-replace.test.ts]
- "meetings_time_drag_dragcreaterange": "dragCreateRange()" | kind=code-symbol | source=src/features/meetings/time-drag.ts:L190 | neighbors=[meetings-time-grid.tsx, time-drag.ts, draggedMinutes(), time-drag.test.ts]
- "meetings_time_drag_draggedminutes": "draggedMinutes()" | kind=code-symbol | source=src/features/meetings/time-drag.ts:L25 | neighbors=[meetings-time-grid.tsx, time-drag.ts, dragCreateRange(), time-drag.test.ts]
- "mini_calendar_index_minicalendarday": "MiniCalendarDay()" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L288 | neighbors=[upcoming-filter.tsx, index.tsx, formatDate(), useMiniCalendar()]
- "mini_calendar_index_minicalendardays": "MiniCalendarDays()" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L258 | neighbors=[upcoming-filter.tsx, index.tsx, getDays(), useMiniCalendar()]
- "motion_hydrated_ishydrated": "isHydrated()" | kind=code-symbol | source=src/components/motion/hydrated.ts:L41 | neighbors=[hydrated.ts, reveal.tsx, route-transition.tsx, stagger.tsx]
- "notifications_mention_rules_mentionadvisory": "mentionAdvisory()" | kind=code-symbol | source=src/features/notifications/mention-rules.ts:L90 | neighbors=[mention-rules.ts, nameList(), mention-rules.test.ts, notify.ts]
- "notifications_notify_dropineligiblerecipients": "dropIneligibleRecipients()" | kind=code-symbol | source=src/features/notifications/notify.ts:L311 | neighbors=[notify.ts, createNotifications(), gateKey(), loadScopes()]
- "notifications_notify_insertall": "insertAll()" | kind=code-symbol | source=src/features/notifications/notify.ts:L551 | neighbors=[notify.ts, createNotifications(), collapsingArbiter(), permanentArbiter()]
- "notifications_queries_listnotifications": "listNotifications" | kind=code-symbol | source=src/features/notifications/queries.ts:L44 | neighbors=[dashboard-zones.tsx, notification-bell.tsx, actions.ts, queries.ts]
- "notifications_queries_notificationitem": "NotificationItem" | kind=code-symbol | source=src/features/notifications/queries.ts:L17 | neighbors=[notification-bell-client.tsx, notifications-card.tsx, actions.ts, queries.ts]
- "notifications_queries_unreadnotificationcount": "unreadNotificationCount" | kind=code-symbol | source=src/features/notifications/queries.ts:L68 | neighbors=[dashboard-zones.tsx, notification-bell.tsx, actions.ts, queries.ts]
- "notifications_retention_retentioncutoffs": "RetentionCutoffs" | kind=code-symbol | source=src/features/notifications/retention.ts:L50 | neighbors=[retention.ts, assertUsable(), retention.test.ts, route.ts]
- "notify_tick_route_get": "GET()" | kind=code-symbol | source=src/app/api/cron/notify-tick/route.ts:L213 | neighbors=[route.ts, isAuthorized(), nudgeUnloggedDays(), pruneExpiredNotifications()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-050.json

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
