# Node Description Batch 25 of 166

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

- "lib_lk_holidays_test": "lk-holidays.test.ts" | kind=code-symbol | source=src/lib/lk-holidays.test.ts:L1 | neighbors=[lk-holidays.ts, excusesWork(), getHolidayIconKind(), getLkHoliday(), getLkHolidayName(), isLkSunday()]
- "lib_mention_match_test": "mention-match.test.ts" | kind=code-symbol | source=src/lib/mention-match.test.ts:L1 | neighbors=[8d1b390 fix(i18n): Sinhala survives eve…, mention-match.ts, findMentionQuery(), matchMentions(), atEnd(), ids()]
- "lib_rate_limit": "rate-limit.ts" | kind=code-symbol | source=src/lib/rate-limit.ts:L1 | neighbors=[actions.ts, auth.ts, createRateLimiter(), loginRateLimiter, RateLimiter, RateLimiterOptions]
- "load_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/meetings/load/loading.tsx:L1 | neighbors=[007c37f ., 5c7efa5 feat(meeting-load): four surfac…, a1e0845 ., MeetingLoadLoading(), page-header.tsx, PageHeader()]
- "maintenance_commands": "commands.ts" | kind=code-symbol | source=src/features/maintenance/commands.ts:L1 | neighbors=[8bacbca ., capabilities.ts, isAdminRole(), commands, events.ts, types.ts]
- "maintenance_freeze_snapshot": "freeze-snapshot.ts" | kind=code-symbol | source=src/features/maintenance/freeze-snapshot.ts:L1 | neighbors=[8bacbca ., write-gate.ts, write-gate.test.ts, actions.ts, freeze.ts, maintenanceMightBeArmed()]
- "maintenance_write_actions": "write-actions.ts" | kind=code-symbol | source=src/features/maintenance/write-actions.ts:L1 | neighbors=[actor.ts, 8bacbca ., capabilities.ts, Action, actionsAllowedDuringMaintenance(), isFrozenByMaintenance()]
- "meetings_actions_appnamebyid": "appNameById()" | kind=code-symbol | source=src/features/meetings/actions.ts:L190 | neighbors=[actions.ts, createMeeting(), deleteMeeting(), rescheduleMeeting(), retryCalendarInvite(), setMeetingApps()]
- "meetings_actions_revalidatemeetingpaths": "revalidateMeetingPaths()" | kind=code-symbol | source=src/features/meetings/actions.ts:L232 | neighbors=[actions.ts, createMeeting(), deleteMeeting(), rescheduleMeeting(), retryCalendarInvite(), setMeetingApps()]
- "meetings_ai_actions_fetchattendees": "fetchAttendees()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L677 | neighbors=[ai-actions.ts, analyzeMeetingAudio(), finalizeMeetingRecordingInner(), getMeetingIntel(), getMeetingNoteTimeline(), getMeetingPrep()]
- "meetings_ai_actions_finalizemeetingrecordinginner": "finalizeMeetingRecordingInner()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1605 | neighbors=[ai-actions.ts, finalizeMeetingRecording(), attendeeAppsPromptBlock(), canManageMeeting(), fetchAttendeeAppLists(), fetchAttendees()]
- "meetings_ai_actions_getmeetingnotetimeline": "getMeetingNoteTimeline()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3230 | neighbors=[note-timeline.tsx, page.tsx, ai-actions.ts, canReadMeetingIntel(), fetchApprovedUsers(), fetchAttendees()]
- "meetings_app_labels": "app-labels.ts" | kind=code-symbol | source=src/features/meetings/app-labels.ts:L1 | neighbors=[meeting-project-select.tsx, meetings-time-grid.tsx, page.tsx, actions.ts, formatAppNames(), MeetingApp]
- "meetings_calendar_overlap": "calendar-overlap.ts" | kind=code-symbol | source=src/features/meetings/calendar-overlap.ts:L1 | neighbors=[meetings-time-grid.tsx, effectiveEnd(), laneFraction(), layoutOverlaps(), OverlapEvent, overlapMap()]
- "meetings_calendar_overlap_test": "calendar-overlap.test.ts" | kind=code-symbol | source=src/features/meetings/calendar-overlap.test.ts:L1 | neighbors=[calendar-overlap.ts, laneFraction(), layoutOverlaps(), OverlapEvent, overlapMap(), at()]
- "meetings_calendar_view_visiblerange": "VisibleRange" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L193 | neighbors=[meetings-calendar.tsx, meetings-views.tsx, calendar-view.ts, calendar-view.test.ts, endOfMonthIso(), rangeFrom()]
- "meetings_glance_batch_test": "glance-batch.test.ts" | kind=code-symbol | source=src/features/meetings/glance-batch.test.ts:L1 | neighbors=[671c254 ., glance-actions.ts, getMeetingGlances(), glance-batch.ts, getMeetingGlancesChunked(), action]
- "meetings_recurrence_partsof": "partsOf()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L71 | neighbors=[recurrence.ts, dayNumber(), expand(), monthIndex(), nthOfMonth(), occurrenceInstant()]
- "meetings_segment_store": "segment-store.ts" | kind=code-symbol | source=src/features/meetings/segment-store.ts:L1 | neighbors=[meeting-intel.tsx, keyFor(), loadParkedSegments(), openDb(), ParkedSegment, parkSegment()]
- "motion_route_transition": "route-transition.tsx" | kind=code-symbol | source=src/components/motion/route-transition.tsx:L1 | neighbors=[layout.tsx, 007c37f ., hydrated.ts, isHydrated(), RouteTransition(), transitions.ts]
- "pending_loading": "loading.tsx" | kind=code-symbol | source=src/app/pending/loading.tsx:L1 | neighbors=[PendingLoading(), brand-mark.tsx, BrandMark(), card.tsx, Card(), CardContent()]
- "people_allocation": "allocation.ts" | kind=code-symbol | source=src/features/people/allocation.ts:L1 | neighbors=[capacity-heat-editable.tsx, actions.ts, AllocationRow, CapacitySummary, summarizeAllocations(), allocation-history.ts]
- "progress_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/progress/loading.tsx:L1 | neighbors=[0ef5142 fix(ui): correctness, responsiv…, progress-apps-lane.tsx, ProgressAppsLaneSkeleton(), progress-matrix.tsx, ProgressMatrixSkeleton(), ProgressLoading()]
- "registry_limits": "limits.ts" | kind=code-symbol | source=src/features/search/registry/limits.ts:L1 | neighbors=[search-providers.ts, search-providers.ts, command-center.tsx, search-providers.ts, search-providers.ts, likePattern()]
- "settings_overview_test": "overview.test.ts" | kind=code-symbol | source=src/features/settings/overview.test.ts:L1 | neighbors=[readiness.ts, ReadinessLevel, changelog.ts, ChangelogEntry, overview.ts, describeAiStatus()]
- "shell_theme_toggle": "theme-toggle.tsx" | kind=code-symbol | source=src/components/shell/theme-toggle.tsx:L1 | neighbors=[layout.tsx, header.tsx, theme-provider.tsx, useTheme(), ThemeToggle(), button.tsx]
- "signals_figure_figure": "Figure" | kind=code-symbol | source=src/features/signals/figure.ts:L33 | neighbors=[signals-view.tsx, architect.ts, lead.ts, member.ts, pm.ts, roles.test.ts]
- "sprints_board_view_taskstatus": "TaskStatus" | kind=code-symbol | source=src/features/sprints/board-view.ts:L31 | neighbors=[change-request-appliers.ts, board.tsx, task-dialog.tsx, notes.ts, board-view.ts, checkins.ts]
- "sprints_composer_plan": "composer-plan.ts" | kind=code-symbol | source=src/features/sprints/composer-plan.ts:L1 | neighbors=[task-composer.tsx, task-intent.ts, IntentPerson, parseTaskIntent(), ComposerPlan, planFor()]
- "sprints_paste_plan_test": "paste-plan.test.ts" | kind=code-symbol | source=src/features/sprints/paste-plan.test.ts:L1 | neighbors=[task-intent.ts, IntentPerson, paste-plan.ts, isBulkPaste(), resolveAssigneeName(), splitPasteLocally()]
- "sprints_promises_test": "promises.test.ts" | kind=code-symbol | source=src/features/sprints/promises.test.ts:L1 | neighbors=[03e2c3f feat(deadlines): grade and orde…, promises.ts, gradePromises(), PromiseRow, promisesSummary(), slipLineFor()]
- "worklog_coverage_test": "coverage.test.ts" | kind=code-symbol | source=src/features/worklog/coverage.test.ts:L1 | neighbors=[coverage.ts, computeCoverage(), CoverageInput, formatCoverage(), HOLIDAYS, input()]
- "worklog_entries_validateentry": "validateEntry()" | kind=code-symbol | source=src/features/worklog/entries.ts:L177 | neighbors=[catch-up-offline.ts, catch-up-parse.ts, entries.ts, entries.test.ts, entry-actions.ts, entry-draft-prompt.ts]
- "worklog_entry_form_test": "entry-form.test.ts" | kind=code-symbol | source=src/features/worklog/entry-form.test.ts:L1 | neighbors=[afba1c3 feat(worklog): the hours form c…, entries.ts, validateEntry(), entry-form.ts, buildEntryPayload(), EntryFormFields]
- "worklog_entry_language_parseentryline": "parseEntryLine()" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L160 | neighbors=[day-hours-card.tsx, day-one-line.tsx, log-box.tsx, catch-up-offline.ts, entry-language.ts, escape()]
- "worklog_entry_suggestions_test": "entry-suggestions.test.ts" | kind=code-symbol | source=src/features/worklog/entry-suggestions.test.ts:L1 | neighbors=[2e02b26 feat(worklog): suggest a person…, project-roles.ts, ProjectRoleTone, entry-suggestions.ts, buildEntrySuggestions(), SuggestionInput]
- "worklog_holiday_listing_buildholidaycalendar": "buildHolidayCalendar()" | kind=code-symbol | source=src/features/worklog/holiday-listing.ts:L61 | neighbors=[org-holidays-card.tsx, auto-score-sync.ts, catch-up-actions.ts, holiday-listing.ts, holiday-listing.test.ts, nudge-queries.ts]
- "worklog_holiday_listing_closesthestudio": "closesTheStudio()" | kind=code-symbol | source=src/features/worklog/holiday-listing.ts:L127 | neighbors=[org-holidays-card.tsx, auto-score-sync.ts, catch-up-actions.ts, holiday-listing.ts, holiday-listing.test.ts, nudge-queries.ts]
- "worklog_note_app_tags_test": "note-app-tags.test.ts" | kind=code-symbol | source=src/features/worklog/note-app-tags.test.ts:L1 | neighbors=[11575db fix(worklog): project chips can…, 8382eb6 fix(worklog): project tags beco…, note-app-tags.ts, AppRef, noteHasAppTag(), splitNoteAppTags()]
- "worklog_org_holidays": "org-holidays.ts" | kind=code-symbol | source=src/features/worklog/org-holidays.ts:L1 | neighbors=[coverage-queries.ts, holiday-listing.ts, isOrgHolidayInForce(), OrgHolidayRow, orgHolidaySet(), org-holidays.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-024.json

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
