# Node Description Batch 15 of 166

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

- "commit:repo:github.com/DeegayuA/LogPup@89dee50947301bb6bf744b3ca19adf4bffe4658b": "89dee50 fix(ui): craft regressions the sweep introduced into its own surfaces" | kind=Commit | source=git | neighbors=[264e022 fix(home): align three read sit…, page.tsx, page.tsx, main, c1235a2 docs(public): restore the four …, ai-model-select.tsx]
- "components_ai_meter_provider_meteroriginsource": "MeterOriginSource" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L61 | neighbors=[ai-meter-provider.tsx, app-form-dialog.tsx, ask-panel.tsx, audit-ask.tsx, catch-up-panel.tsx, day-hours-card.tsx]
- "components_danger_app_reset_card": "danger-app-reset-card.tsx" | kind=code-symbol | source=src/features/admin/components/danger-app-reset-card.tsx:L1 | neighbors=[b33670d feat(ui): make the three select…, danger-actions.ts, resetApp(), danger-logic.ts, purgeProgressMessage(), resetAppPhrase()]
- "components_employment_select": "employment-select.tsx" | kind=code-symbol | source=src/features/admin/components/employment-select.tsx:L1 | neighbors=[capabilities.ts, EMPLOYMENT_TYPES, EmploymentType, hasCappablePower(), UserRole, CapNotice()]
- "components_mention_textarea_mentionuser": "MentionUser" | kind=code-symbol | source=src/components/mention-textarea.tsx:L8 | neighbors=[action-item-board.tsx, app-comments.tsx, meeting-header-actions.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx, meeting-list.tsx]
- "components_seat_select": "seat-select.tsx" | kind=code-symbol | source=src/features/admin/components/seat-select.tsx:L1 | neighbors=[10e7430 fix(ui): a clipped seat descrip…, capabilities.ts, ROLE_LABELS, UserRole, SEAT_GROUPS, SeatSelect()]
- "components_section_empty": "section-empty.tsx" | kind=code-symbol | source=src/features/people/components/section-empty.tsx:L1 | neighbors=[allocation-history-card.tsx, app-role-history-card.tsx, assignments-card.tsx, cohort-views.tsx, history-views.tsx, person-activity-card.tsx]
- "components_sprint_checkin_editor": "sprint-checkin-editor.tsx" | kind=code-symbol | source=src/features/sprints/components/sprint-checkin-editor.tsx:L1 | neighbors=[meeting-prep.tsx, GapHint(), parsePercent(), ReportedCheckin, SprintCheckinEditor(), checkin-actions.ts]
- "components_your_series_card": "your-series-card.tsx" | kind=code-symbol | source=src/features/meeting-load/components/your-series-card.tsx:L1 | neighbors=[5c7efa5 feat(meeting-load): four surfac…, suggestion-decision-buttons.tsx, SuggestionDecisionButtons(), evidenceLine(), YourSeriesCard(), suggest.ts]
- "dashboard_ai_engine_test": "ai-engine.test.ts" | kind=code-symbol | source=src/features/dashboard/ai-engine.test.ts:L1 | neighbors=[ai-engine.ts, AiEngineTotals, buildAiEngineRows(), formatRate(), formatTokenCount(), modelFactsFor()]
- "db_schema_apps": "apps" | kind=code-symbol | source=src/db/schema.ts:L237 | neighbors=[actions.ts, backup.ts, clear-test-data.test.ts, trash-actions.ts, trash-actions.test.ts, trash-queries.ts]
- "db_write_gate_test": "write-gate.test.ts" | kind=code-symbol | source=src/db/write-gate.test.ts:L1 | neighbors=[8bacbca ., schema.ts, activityLog, notifications, tasks, users]
- "gemini_prefs_aifeaturedisabledmessage": "aiFeatureDisabledMessage()" | kind=code-symbol | source=src/features/gemini/prefs.ts:L59 | neighbors=[actions.ts, prefs.ts, isAiFeatureEnabled(), actions.ts, ai-actions.ts, assistant-actions.ts]
- "github_evidence": "evidence.ts" | kind=code-symbol | source=src/features/github/evidence.ts:L1 | neighbors=[de4812e feat(github): commits become wo…, index.ts, Db, schema.ts, users, app-client.ts]
- "lib_event_identity": "event-identity.ts" | kind=code-symbol | source=src/lib/event-identity.ts:L1 | neighbors=[40c5d41 feat(calendar): decide whether …, attendeeOverlap(), canAutoMerge(), CandidateEvent, CandidateMeeting, Identification]
- "lib_event_identity_test": "event-identity.test.ts" | kind=code-symbol | source=src/lib/event-identity.test.ts:L1 | neighbors=[40c5d41 feat(calendar): decide whether …, event-identity.ts, attendeeOverlap(), canAutoMerge(), CandidateEvent, CandidateMeeting]
- "lib_project_roles": "project-roles.ts" | kind=code-symbol | source=src/lib/project-roles.ts:L1 | neighbors=[project-manager.ts, isProjectManagerRole(), isReviewerRole(), ProjectRoleTone, roleBadgeTone(), project-roles.test.ts]
- "meeting_load_trend_points": "trend-points.ts" | kind=code-symbol | source=src/features/meeting-load/trend-points.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, dashboard-zones.tsx, meeting-load-card.tsx, meeting-load-trend.tsx, observed-change.ts, queries.ts]
- "meetings_actions_test": "actions.test.ts" | kind=code-symbol | source=src/features/meetings/actions.test.ts:L1 | neighbors=[live.ts, liveMeetings, schema.ts, meetings, users, actions.ts]
- "meetings_ai_actions_canreadmeetingintel": "canReadMeetingIntel()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L595 | neighbors=[page.tsx, ai-actions.ts, addFollowup(), meetingAppIds(), copyFollowupResponseToNotes(), getMeetingIntel()]
- "meetings_attendance_history": "attendance-history.ts" | kind=code-symbol | source=src/features/meetings/attendance-history.ts:L1 | neighbors=[actions.ts, ai-actions.ts, AttendanceAsOf, AttendanceChange, AttendanceEntry, AttendanceEntryInput]
- "meetings_coverage_test": "coverage.test.ts" | kind=code-symbol | source=src/features/meetings/coverage.test.ts:L1 | neighbors=[c2f2819 feat(meetings): work out which …, coverage.ts, compareAsks(), coverageHeadline(), coverageTargetKey(), CoverAsk]
- "meetings_event_color_eventdotclasses": "eventDotClasses()" | kind=code-symbol | source=src/features/meetings/event-color.ts:L114 | neighbors=[activity-feed.tsx, app-card.tsx, capacity-heat.tsx, capacity-heat-editable.tsx, cohort-views.tsx, directory.tsx]
- "meetings_ics_test": "ics.test.ts" | kind=code-symbol | source=src/features/meetings/ics.test.ts:L1 | neighbors=[ics.ts, buildIcs(), escapeIcsText(), foldIcsLine(), formatIcsUtc(), googleCalendarUrl()]
- "meetings_language_switch": "language-switch.ts" | kind=code-symbol | source=src/features/meetings/language-switch.ts:L1 | neighbors=[meeting-intel.tsx, ActiveLanguage, containsSinhala(), countMatches(), estimateSpokenUnits(), InterimLeaderInput]
- "meetings_segment_queue": "segment-queue.ts" | kind=code-symbol | source=src/features/meetings/segment-queue.ts:L1 | neighbors=[72b853c feat(meetings): segment upload …, meeting-intel.tsx, recording-segments.ts, afterAttempt(), canRetry(), isOutstanding()]
- "meetings_text_replace_test": "text-replace.test.ts" | kind=code-symbol | source=src/features/meetings/text-replace.test.ts:L1 | neighbors=[f823a54 feat(meetings): correct a mishe…, text-replace.ts, applyReplacements(), diffSingleWord(), editDistance(), findOccurrences()]
- "motion_stagger": "stagger.tsx" | kind=code-symbol | source=src/components/motion/stagger.tsx:L1 | neighbors=[007c37f ., directory.tsx, meeting-list.tsx, reveal.tsx, hydrated.ts, isHydrated()]
- "people_allocation_history_test": "allocation-history.test.ts" | kind=code-symbol | source=src/features/people/allocation-history.test.ts:L1 | neighbors=[allocation-history.ts, allocationTotalSeries(), buildAllocationTimeline(), buildHistoryEntry(), CapacityAsOf, ChangeKind]
- "people_cohort_filter_test": "cohort-filter.test.ts" | kind=code-symbol | source=src/features/people/cohort-filter.test.ts:L1 | neighbors=[ae2feea feat(people): filtering and ord…, cohort-filter.ts, FilterableProject, filterSortProjects(), hasActiveProjectFilters(), ProjectFilters]
- "people_cohorts": "cohorts.ts" | kind=code-symbol | source=src/features/people/cohorts.ts:L1 | neighbors=[743b1f2 fix(ui): a false-positive tag m…, cohort-views.tsx, buildOverlapReport(), buildProjectCohorts(), buildSharedPeople(), CohortMember]
- "shell_sidebar_store": "sidebar-store.ts" | kind=code-symbol | source=src/components/shell/sidebar-store.ts:L1 | neighbors=[3dcd417 feat(shell): collapse the sideb…, command-center.tsx, sidebar.tsx, sidebar-model.ts, nextSidebarState(), resolveSidebarState()]
- "signals_corroborate_test": "corroborate.test.ts" | kind=code-symbol | source=src/features/signals/corroborate.test.ts:L1 | neighbors=[d5b6409 ., corroborate.ts, CHECKED_CHANNELS, corroborateDay(), corroborateRange(), DayInput]
- "sprints_board_view_isterminal": "isTerminal()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L73 | neighbors=[day-hours-card.tsx, ask-derivation.ts, followups.ts, notes.ts, planner.ts, task-workload.ts]
- "sprints_task_status": "task-status.ts" | kind=code-symbol | source=src/features/sprints/task-status.ts:L1 | neighbors=[change-request-appliers.ts, 001694a refactor(tasks): express the co…, a9d31f4 refactor(tasks): add isTerminal…, e5f8bbf feat(sprints): one door for tas…, eb38ea0 fix(tasks): stamp completed_at …, task-actions.ts]
- "ui_table": "table.tsx" | kind=code-symbol | source=src/components/ui/table.tsx:L1 | neighbors=[apps-table.tsx, history-views.tsx, org-holidays-card.tsx, user-table.tsx, utils.ts, cn()]
- "worklog_entry_draft_prompt_test": "entry-draft-prompt.test.ts" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.test.ts:L1 | neighbors=[5e32b09 fix(worklog): Fill my day ignor…, 6909ea3 feat(worklog): AI drafts the da…, de4812e feat(github): commits become wo…, entries.ts, entry-draft-prompt.ts, buildEntryDraftPrompt()]
- "worklog_entry_language_test": "entry-language.test.ts" | kind=code-symbol | source=src/features/worklog/entry-language.test.ts:L1 | neighbors=[8e5308d feat(worklog): one grammar for …, 8fa8f26 feat(worklog): the whole day in…, entry-language.ts, CATEGORY_WORDS, describeGrammar(), describeLine()]
- "worklog_note_app_tags": "note-app-tags.ts" | kind=code-symbol | source=src/features/worklog/note-app-tags.ts:L1 | neighbors=[11575db fix(worklog): project chips can…, 8382eb6 fix(worklog): project tags beco…, worklog-form.tsx, guest-projects.ts, AppRef, normalise()]
- "admin_audit_nl": "audit-nl.ts" | kind=code-symbol | source=src/features/admin/audit-nl.ts:L1 | neighbors=[types.ts, ACTIVITY_ENTITY_TYPES, ACTIVITY_VERBS, audit-filters.ts, AuditParamState, applyAuditNlPatch()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-014.json

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
