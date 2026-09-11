# Node Description Batch 32 of 166

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

- "lib_phone_wahref": "waHref()" | kind=code-symbol | source=src/lib/phone.ts:L37 | neighbors=[contact-buttons.tsx, meeting-share-dialog.tsx, person-header.tsx, person-hover-card.tsx, phone.ts, phone.test.ts]
- "lib_poll_schedule": "poll-schedule.ts" | kind=code-symbol | source=src/lib/poll-schedule.ts:L1 | neighbors=[use-smart-poll.ts, nextPollDelay(), PollConditions, PollSchedule, shouldPoll(), poll-schedule.test.ts]
- "lib_project_roles_isprojectmanagerrole": "isProjectManagerRole()" | kind=code-symbol | source=src/lib/project-roles.ts:L20 | neighbors=[project-manager.ts, project-roles.ts, roleBadgeTone(), project-roles.test.ts, glance-actions.ts, queries.ts]
- "lib_project_roles_projectroletone": "ProjectRoleTone" | kind=code-symbol | source=src/lib/project-roles.ts:L17 | neighbors=[project-roles.ts, card-actions.ts, cohort-filter.ts, draft-prompt.ts, entry-suggestions.ts, entry-suggestions.test.ts]
- "lib_recurrence_expandrecurrence": "expandRecurrence()" | kind=code-symbol | source=src/lib/recurrence.ts:L109 | neighbors=[recurrence.ts, addDays(), RecurrenceError, weekdayOf(), weekStart(), recurrence.test.ts]
- "lib_recurrence_weekdayof": "weekdayOf()" | kind=code-symbol | source=src/lib/recurrence.ts:L93 | neighbors=[recurrence.ts, describeRecurrence(), expandRecurrence(), recurrence.test.ts, at(), weekStart()]
- "lib_slug": "slug.ts" | kind=code-symbol | source=src/lib/slug.ts:L1 | neighbors=[actions.ts, meeting-load.spec.ts, smoke.spec.ts, soft-delete.spec.ts, slugify(), slug.test.ts]
- "lib_slug_slugify": "slugify()" | kind=code-symbol | source=src/lib/slug.ts:L1 | neighbors=[actions.ts, meeting-load.spec.ts, smoke.spec.ts, soft-delete.spec.ts, slug.ts, slug.test.ts]
- "maintenance_window_formatcountdown": "formatCountdown()" | kind=code-symbol | source=src/features/maintenance/window.ts:L169 | neighbors=[maintenance-banner.tsx, maintenance-details-dialog.tsx, maintenance-overlay.tsx, window.ts, pad2(), window.test.ts]
- "meeting_load_actions_decide": "decide()" | kind=code-symbol | source=src/features/meeting-load/actions.ts:L88 | neighbors=[actions.ts, acceptLoadSuggestion(), isUniqueViolation(), mayDecide(), revalidateAll(), dismissLoadSuggestion()]
- "meeting_load_collisions": "collisions.ts" | kind=code-symbol | source=src/features/meeting-load/collisions.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, CollisionResult, computeCollisions(), WeekMeetingInterval, collisions.test.ts, queries.ts]
- "meeting_load_collisions_test": "collisions.test.ts" | kind=code-symbol | source=src/features/meeting-load/collisions.test.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, collisions.ts, computeCollisions(), at(), meeting(), WeekMeetingInterval]
- "meeting_load_density_test": "density.test.ts" | kind=code-symbol | source=src/features/meeting-load/density.test.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, density.ts, coverageOf(), deadlinesCount(), partitionByModel(), splitOutputs()]
- "meeting_load_suggest_suggest": "suggest()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L424 | neighbors=[admin-queries.ts, queries.ts, redaction-boundary.test.ts, suggest.ts, ruleShareSlot(), suggest.test.ts]
- "meeting_load_week_bucket_localweekstartiso": "localWeekStartIso()" | kind=code-symbol | source=src/features/meeting-load/week-bucket.ts:L23 | neighbors=[admin-queries.ts, gather.ts, queries.ts, trend-points.ts, week-bucket.ts, week-bucket.test.ts]
- "meetings_ai_actions_asarray": "asArray()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L314 | neighbors=[ai-actions.ts, asActionItems(), asSpeakerSegments(), getMeetingIntel(), persistMeetingAnalysis(), resolveAddressedFollowups()]
- "meetings_ai_actions_getspeakerassignmentdata": "getSpeakerAssignmentData()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3383 | neighbors=[speaker-assignment.tsx, ai-actions.ts, canReadMeetingIntel(), fetchAttendees(), fetchOrgPeople(), fetchSpeakerLabels()]
- "meetings_app_labels_formatappnames": "formatAppNames()" | kind=code-symbol | source=src/features/meetings/app-labels.ts:L25 | neighbors=[meeting-project-select.tsx, meetings-time-grid.tsx, page.tsx, actions.ts, app-labels.ts, search-providers.ts]
- "meetings_attendee_prefill": "attendee-prefill.ts" | kind=code-symbol | source=src/features/meetings/attendee-prefill.ts:L1 | neighbors=[meeting-form.tsx, addEveryone(), applyQuickAddAttendees(), applyTeamPrefill(), AttendeeSelection, attendee-prefill.test.ts]
- "meetings_attendee_score_scorevoice": "scoreVoice()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L906 | neighbors=[attendee-score.ts, scoreCandidate(), daysBetween(), e4e5Recency(), fmtDayMonth(), renderReason()]
- "meetings_attendee_series": "attendee-series.ts" | kind=code-symbol | source=src/features/meetings/attendee-series.ts:L1 | neighbors=[232b7ef ., sameSeries(), SeriesCandidate, series-key.ts, seriesKey(), attendee-series.test.ts]
- "meetings_calendar_grid_daywindow": "DayWindow" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L211 | neighbors=[meetings-calendar.tsx, meetings-time-grid.tsx, calendar-grid.ts, remember(), zonedDayStartMs(), calendar-grid.test.ts]
- "meetings_calendar_view_isoparts": "isoParts()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L145 | neighbors=[calendar-view.ts, addCalendarMonths(), endOfMonthIso(), isoToDisplayDate(), mondayIndex(), startOfMonthIso()]
- "meetings_commands": "commands.ts" | kind=code-symbol | source=src/features/meetings/commands.ts:L1 | neighbors=[671c254 ., a1e0845 ., commands, types.ts, CommandDescriptor, commands.ts]
- "meetings_coverage_personminutes": "personMinutes()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L220 | neighbors=[coverage.ts, coverAsks(), isEligibleGroup(), meetingMinutes(), score(), coverage.test.ts]
- "meetings_event_color_eventcolorslot": "eventColorSlot()" | kind=code-symbol | source=src/features/meetings/event-color.ts:L46 | neighbors=[event-color.ts, eventColorClasses(), eventDotClasses(), eventFadedClasses(), eventSolidClasses(), event-color.test.ts]
- "meetings_ics_buildics": "buildIcs()" | kind=code-symbol | source=src/features/meetings/ics.ts:L176 | neighbors=[route.ts, ics.ts, escapeIcsText(), formatIcsUtc(), personLine(), ics.test.ts]
- "meetings_ics_googlecalendarurl": "googleCalendarUrl()" | kind=code-symbol | source=src/features/meetings/ics.ts:L267 | neighbors=[add-to-calendar.tsx, meeting-list.tsx, ics.ts, formatIcsUtc(), linkDetails(), ics.test.ts]
- "meetings_keyframe_access": "keyframe-access.ts" | kind=code-symbol | source=src/features/meetings/keyframe-access.ts:L1 | neighbors=[capabilities.ts, isAdminRole(), canServeKeyframe(), KeyframeAccessInput, keyframe-access.test.ts, route.ts]
- "meetings_legacy_notes": "legacy-notes.ts" | kind=code-symbol | source=src/features/meetings/legacy-notes.ts:L1 | neighbors=[ai-actions.ts, index.ts, Db, schema.ts, meetingNoteSegments, haveNoteSegmentsEverExisted()]
- "meetings_list_search": "list-search.ts" | kind=code-symbol | source=src/features/meetings/list-search.ts:L1 | neighbors=[671c254 ., meetings-views.tsx, filterMeetingsBySearch(), fold(), SearchableMeeting, list-search.test.ts]
- "meetings_next_meeting_describenextmeeting": "describeNextMeeting()" | kind=code-symbol | source=src/features/meetings/next-meeting.ts:L76 | neighbors=[meeting-chips.tsx, meeting-list.tsx, next-meeting-card.tsx, next-meeting.ts, relativeDays(), next-meeting.test.ts]
- "meetings_note_labels": "note-labels.ts" | kind=code-symbol | source=src/features/meetings/note-labels.ts:L1 | neighbors=[trash-actions.ts, trash-grouping.ts, trash-grouping.test.ts, ai-actions.ts, keyframeDeleteLabel(), noteSegmentDeleteLabel()]
- "meetings_planner_test": "planner.test.ts" | kind=code-symbol | source=src/features/meetings/planner.test.ts:L1 | neighbors=[planner.ts, assembleMeetingPlan(), AssembleMeetingPlanInput, buildAgenda(), askKeys(), input()]
- "meetings_recording_segments_test": "recording-segments.test.ts" | kind=code-symbol | source=src/features/meetings/recording-segments.test.ts:L1 | neighbors=[recording-segments.ts, concatenateSegments(), hintTail(), isRetriableSegmentError(), segmentRetryDelayMs(), shouldCutSegment()]
- "meetings_recurrence_rrulefor": "rruleFor()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L250 | neighbors=[recurrence.ts, nthOfMonth(), partsOf(), stride(), weekdayOf(), recurrence.test.ts]
- "meetings_share": "share.ts" | kind=code-symbol | source=src/features/meetings/share.ts:L1 | neighbors=[meeting-share-dialog.tsx, buildMeetingShareMessage(), mailtoHref(), format-instant.ts, formatBusinessTime(), formatBusinessWeekdayDayMonth()]
- "meetings_summary_length": "summary-length.ts" | kind=code-symbol | source=src/features/meetings/summary-length.ts:L1 | neighbors=[5a95470 fix(meetings): transcripts stop…, ai-actions.ts, estimateMinutesFromAudioBytes(), estimateMinutesFromTranscript(), summaryDepthInstruction(), summary-length.test.ts]
- "meetings_text_replace_findoccurrences": "findOccurrences()" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L251 | neighbors=[text-replace.ts, text-replace-actions.ts, editDistance(), fuzzyBudget(), tokenize(), text-replace.test.ts]
- "meetings_visibility_meetingvisibleto": "meetingVisibleTo()" | kind=code-symbol | source=src/features/meetings/visibility.ts:L30 | neighbors=[route.ts, glance-actions.ts, queries.ts, search-providers.ts, visibility.ts, queries.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-031.json

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
