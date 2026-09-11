# Node Description Batch 17 of 166

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
For an entity node (any other kind — e.g. a person, place, event, object),
describe what the entity is and its role, grounded in its type, its
relations (neighbors) and the provided citations/evidence — e.g.
"Lady Carfax, a wealthy heiress who disappears en route to Lausanne.".
Ground entity descriptions in the citations/evidence when present; do not
speculate beyond the context, so a node with no supporting context may be
left out of the reply.
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "shared_card_quick_menu": "card-quick-menu.tsx" | kind=code-symbol | source=src/components/shared/card-quick-menu.tsx:L1 | neighbors=[task-card.tsx, utils.ts, cn(), CardQuickMenu(), QuickMenuItem, button.tsx]
- "shell_shortcuts_overlay": "shortcuts-overlay.tsx" | kind=code-symbol | source=src/components/shell/shortcuts-overlay.tsx:L1 | neighbors=[command-center.tsx, nav-items.ts, navItems, ShortcutRow(), ShortcutsOverlay(), dialog.tsx]
- "sprints_checkin_queries": "checkin-queries.ts" | kind=code-symbol | source=src/features/sprints/checkin-queries.ts:L1 | neighbors=[sprint-checkins.tsx, ai-actions.ts, planner-actions.ts, page.tsx, index.ts, Db]
- "sprints_paste_plan": "paste-plan.ts" | kind=code-symbol | source=src/features/sprints/paste-plan.ts:L1 | neighbors=[task-composer.tsx, paste-actions.ts, task-intent.ts, IntentPerson, composer-plan.ts, planFor()]
- "transcription_session_budget": "session-budget.ts" | kind=code-symbol | source=src/features/transcription/session-budget.ts:L1 | neighbors=[live-transcription-status.tsx, meeting-intel.tsx, use-live-transcription.ts, readiness.ts, live-client.ts, AutoStopInput]
- "ui_dialog_dialogtrigger": "DialogTrigger()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L14 | neighbors=[add-user-dialog.tsx, app-form-dialog.tsx, assign-dialog.tsx, bug-csv-import-dialog.tsx, declare-absence-dialog.tsx, meeting-form.tsx]
- "worklog_auto_score": "auto-score.ts" | kind=code-symbol | source=src/features/worklog/auto-score.ts:L1 | neighbors=[9f936b5 Add app aliases and auto-scored…, day-panel.tsx, log-box.tsx, logged-days-list.tsx, autoScoreFromHours(), mayAutoScore()]
- "worklog_catch_up_parse_test": "catch-up-parse.test.ts" | kind=code-symbol | source=src/features/worklog/catch-up-parse.test.ts:L1 | neighbors=[3ac9d68 ., 419d875 Unify worklog logging with AI c…, catch-up-parse.ts, buildCatchUpPrompt(), CATCH_UP_CATEGORIES, CatchUpCandidateDay]
- "worklog_entry_check_prompt": "entry-check-prompt.ts" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.ts:L1 | neighbors=[6909ea3 feat(worklog): AI drafts the da…, entry-ai-actions.ts, entry-check.ts, Observation, ObservationKind, allowedNumbers()]
- "admin_layout": "layout.tsx" | kind=code-symbol | source=src/app/(app)/admin/layout.tsx:L1 | neighbors=[AdminLayout(), sections.ts, visibleSections(), actor.ts, loadActor, capabilities.ts]
- "apps_activity": "activity.ts" | kind=code-symbol | source=src/features/apps/activity.ts:L1 | neighbors=[ActivityDayGroup, AppActivityItem, AppActivityKind, assignmentActivityTitle(), groupActivityByDay(), mergeActivity()]
- "apps_update_input": "update-input.ts" | kind=code-symbol | source=src/features/apps/update-input.ts:L1 | neighbors=[actions.ts, app-health.ts, AppStatus, AppBeforeState, AppChangeNames, AppChangeSummary]
- "auth_capabilities_effectivegrant": "effectiveGrant()" | kind=code-symbol | source=src/features/auth/capabilities.ts:L366 | neighbors=[layout.tsx, search-providers.ts, actor.ts, capabilities.ts, can(), capFor()]
- "calendar_google_calendar_test": "google-calendar.test.ts" | kind=code-symbol | source=src/features/calendar/google-calendar.test.ts:L1 | neighbors=[google-calendar.ts, buildConferenceDataRequest(), CalendarErrorKey, classifyCalendarError(), describeCalendarError(), extractMeetLink()]
- "commit:repo:github.com/DeegayuA/LogPup@3c30bf4cff6aad39fed7fbef0edf2692f646caeb": "3c30bf4 worklog: per-task hours substrate (worklog_entries + pure check)" | kind=Commit | source=git | neighbors=[1eb625d docs(intel): name the gap-list …, main, dd6f2fd feat(worklog): define how long …, live.ts, live.test.ts, schema.ts]
- "commit:repo:github.com/DeegayuA/LogPup@3dcd4177a628ef41c0b168bf4bfcea39f16e24fe": "3dcd417 feat(shell): collapse the sidebar to an icon rail" | kind=Commit | source=git | neighbors=[layout.tsx, main, 929997a feat(meetings): /meetings opens…, command-center.tsx, registry.test.ts, types.ts]
- "commit:repo:github.com/DeegayuA/LogPup@f8a9b007f5bbfb1bfe458079a94650bd3f98f640": "f8a9b00 feat(gemini): the meter learns the two percentages it may honestly show" | kind=Commit | source=git | neighbors=[5718264 feat(admin): overview answers "…, main, 717069e feat(admin): the page that says…, ai-meter-dock.tsx, ai-meter-provider.tsx, meeting-intel.tsx]
- "components_attribution_inline": "attribution-inline.tsx" | kind=code-symbol | source=src/features/meetings/components/attribution-inline.tsx:L1 | neighbors=[3c0bc01 ., AttributionContext, AttributionInline(), meeting-people-picker.tsx, MeetingPeoplePicker(), ai-actions.ts]
- "components_avatar_upload": "avatar-upload.tsx" | kind=code-symbol | source=src/features/auth/components/avatar-upload.tsx:L1 | neighbors=[avatar-actions.ts, removeOwnAvatar(), uploadOwnAvatar(), AvatarUpload(), toSquareWebp(), avatar.tsx]
- "components_maintenance_banner": "maintenance-banner.tsx" | kind=code-symbol | source=src/features/maintenance/components/maintenance-banner.tsx:L1 | neighbors=[8bacbca ., MaintenanceBanner(), maintenance-chrome.ts, KIND_ICONS, utils.ts, cn()]
- "components_meeting_pip": "meeting-pip.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-pip.tsx:L1 | neighbors=[2b9e5c5 feat(meetings): rebuild the rec…, meeting-intel.tsx, adoptStyles(), clock(), DocumentPipHost, MeetingPip()]
- "components_person_stat_row": "person-stat-row.tsx" | kind=code-symbol | source=src/features/people/components/person-stat-row.tsx:L1 | neighbors=[stat-number.tsx, StatNumber(), PersonStatRow(), RING_TONE, VALUE_TONE, utils.ts]
- "components_roadmap": "roadmap.tsx" | kind=code-symbol | source=src/features/sprints/components/roadmap.tsx:L1 | neighbors=[capabilities.ts, isAdminRole(), Roadmap(), roadmap-timeline.tsx, RoadmapTimeline(), session.ts]
- "components_triage_queue_pager": "triage-queue-pager.tsx" | kind=code-symbol | source=src/features/bugs/components/triage-queue-pager.tsx:L1 | neighbors=[page.tsx, actions.ts, loadMoreTriageBugs(), queries.ts, BugQueueRow, report-input.ts]
- "db_schema_meetingainotes": "meetingAiNotes" | kind=code-symbol | source=src/db/schema.ts:L1024 | neighbors=[backup.ts, schema.ts, meeting-load.spec.ts, context-pack.ts, gather.ts, ai-actions.ts]
- "e2e_smoke_spec": "smoke.spec.ts" | kind=code-symbol | source=e2e/smoke.spec.ts:L1 | neighbors=[index.ts, Db, schema.ts, apps, meetings, env.ts]
- "gemini_client_geminierror": "GeminiError" | kind=code-symbol | source=src/features/gemini/client.ts:L37 | neighbors=[client.ts, callGeminiCore(), .constructor(), actions.ts, ai-actions.ts, assistant-actions.ts]
- "gemini_models": "models.ts" | kind=code-symbol | source=src/features/gemini/models.ts:L1 | neighbors=[advertised-models.test.ts, model-choice.ts, model-choice.test.ts, client.ts, GEMINI_MODEL_FALLBACK_ORDER, QUICK_MODELS]
- "intel_signals_buildsignals": "buildSignals()" | kind=code-symbol | source=src/features/intel/signals.ts:L450 | neighbors=[actions.ts, briefing-fallback.test.ts, signals.ts, capacitySignals(), mergeableMeetingSignal(), overdueTaskSignal()]
- "lib_lk_holidays_getlkholiday": "getLkHoliday()" | kind=code-symbol | source=src/lib/lk-holidays.ts:L170 | neighbors=[meetings-agenda.tsx, meetings-month-calendar.tsx, meetings-time-grid.tsx, worklog-calendar.tsx, fortnight.tsx, lk-holidays.ts]
- "lib_phone": "phone.ts" | kind=code-symbol | source=src/lib/phone.ts:L1 | neighbors=[actions.ts, actions.ts, contact-buttons.tsx, meeting-share-dialog.tsx, person-header.tsx, person-hover-card.tsx]
- "meeting_load_participation": "participation.ts" | kind=code-symbol | source=src/features/meeting-load/participation.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, gather.ts, isLowParticipation(), median(), OccurrenceParticipation, participationFor()]
- "meeting_load_suggest_test": "suggest.test.ts" | kind=code-symbol | source=src/features/meeting-load/suggest.test.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, suggest.ts, aggregateSuggestions(), ALLOWED_OCCURRENCE_KEYS, AnalyzedOccurrence, inviteJaccard()]
- "meetings_calendar_grid_test": "calendar-grid.test.ts" | kind=code-symbol | source=src/features/meetings/calendar-grid.test.ts:L1 | neighbors=[calendar-grid.ts, clampPxPerHour(), clipToDay(), DayWindow, EventGeometry, hourLabel()]
- "meetings_calendar_view_isotodisplaydate": "isoToDisplayDate()" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L272 | neighbors=[jump-to-date.tsx, meeting-list.tsx, meetings-agenda.tsx, meetings-calendar.tsx, meetings-day-rail.tsx, meetings-time-grid.tsx]
- "meetings_coverage_coverasks": "coverAsks()" | kind=code-symbol | source=src/features/meetings/coverage.ts:L367 | neighbors=[coverage.ts, better(), coverageTargetKey(), earliestWorkingDay(), isEligibleGroup(), meetingMinutes()]
- "meetings_list_filter_test": "list-filter.test.ts" | kind=code-symbol | source=src/features/meetings/list-filter.test.ts:L1 | neighbors=[671c254 ., meeting-glance.ts, AttendeeResponse, meeting-notes-model.ts, MeetingGlance, list-filter.ts]
- "meetings_recording_segments": "recording-segments.ts" | kind=code-symbol | source=src/features/meetings/recording-segments.ts:L1 | neighbors=[meeting-intel.tsx, ai-actions.ts, ConcatenatedSegments, concatenateSegments(), hintTail(), isRetriableSegmentError()]
- "meetings_time_drag_test": "time-drag.test.ts" | kind=code-symbol | source=src/features/meetings/time-drag.test.ts:L1 | neighbors=[calendar-grid.ts, time-drag.ts, dragCreateRange(), draggedMinutes(), isRealMove(), isRealResize()]
- "motion_reveal": "reveal.tsx" | kind=code-symbol | source=src/components/motion/reveal.tsx:L1 | neighbors=[page.tsx, 007c37f ., pending-absence-list.tsx, hydrated.ts, isHydrated(), Reveal()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-016.json

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
