# Node Description Batch 19 of 166

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

- "meeting_load_week_bucket": "week-bucket.ts" | kind=code-symbol | source=src/features/meeting-load/week-bucket.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, admin-queries.ts, gather.ts, queries.ts, trend-points.ts, localWeekStartIso()]
- "meetings_actions_createmeeting": "createMeeting()" | kind=code-symbol | source=src/features/meetings/actions.ts:L394 | neighbors=[meeting-form.tsx, meeting-header-actions.tsx, actions.ts, appNameById(), inviteWarning(), isForeignKeyViolation()]
- "meetings_actions_updatemeeting": "updateMeeting()" | kind=code-symbol | source=src/features/meetings/actions.ts:L772 | neighbors=[meeting-form.tsx, print-masthead-edit.tsx, actions.ts, appNameById(), canManageMeeting(), isForeignKeyViolation()]
- "meetings_glance_batch": "glance-batch.ts" | kind=code-symbol | source=src/features/meetings/glance-batch.ts:L1 | neighbors=[671c254 ., use-glance-map.tsx, meeting-notes-model.ts, MeetingGlance, glance-actions.ts, getMeetingGlances()]
- "meetings_language_switch_test": "language-switch.test.ts" | kind=code-symbol | source=src/features/meetings/language-switch.test.ts:L1 | neighbors=[language-switch.ts, containsSinhala(), estimateSpokenUnits(), isRestartStorm(), isSilentSinhalaFallback(), pickInterimLeader()]
- "meetings_recording_progress": "recording-progress.ts" | kind=code-symbol | source=src/features/meetings/recording-progress.ts:L1 | neighbors=[007c37f ., meeting-intel.tsx, capPercent(), formatRemaining(), MeetingProcessing, observedMsPerSegment()]
- "meetings_segment_queue_test": "segment-queue.test.ts" | kind=code-symbol | source=src/features/meetings/segment-queue.test.ts:L1 | neighbors=[72b853c feat(meetings): segment upload …, recording-segments.ts, segment-queue.ts, afterAttempt(), canRetry(), nextToUpload()]
- "motion_transitions": "transitions.ts" | kind=code-symbol | source=src/components/motion/transitions.ts:L1 | neighbors=[007c37f ., reveal.tsx, route-transition.tsx, stagger.tsx, Cubic, DURATION]
- "notifications_mention_rules": "mention-rules.ts" | kind=code-symbol | source=src/features/notifications/mention-rules.ts:L1 | neighbors=[8c996d9 feat(notifications): a mention …, classifyMention(), mentionAdvisory(), MentionFacts, nameList(), SUPPRESSED_REASONS]
- "notion_export": "export.ts" | kind=code-symbol | source=src/features/notion/export.ts:L1 | neighbors=[actions.ts, buildBlocks(), notion(), NotionParentError, resolveParentPageId(), SprintExportData]
- "people_as_of_date": "as-of-date.ts" | kind=code-symbol | source=src/features/people/as-of-date.ts:L1 | neighbors=[as-of-picker.tsx, handover-form.tsx, lk-holidays.ts, toIsoDateInTimeZone(), isoDay(), isoDaysAgo()]
- "people_capacity_hours": "capacity-hours.ts" | kind=code-symbol | source=src/features/people/capacity-hours.ts:L1 | neighbors=[f180d72 feat(people): capacity in hours…, schema.ts, SchedulePattern, allocatedHours(), hoursForFraction(), HoursLoad]
- "people_iso_day_isodaydiff": "isoDayDiff()" | kind=code-symbol | source=src/features/people/iso-day.ts:L68 | neighbors=[format.ts, audit-filters.ts, person-tasks-card.tsx, context-pack.ts, signals.ts, followup-split.ts]
- "people_now_test": "now.test.ts" | kind=code-symbol | source=src/features/people/now.test.ts:L1 | neighbors=[now.ts, actionSentence(), isOverdue(), nowHeadline(), NowTask, overdueCount()]
- "people_removal_queries_canholdwork": "canHoldWork()" | kind=code-symbol | source=src/features/people/removal-queries.ts:L167 | neighbors=[actions.ts, import-actions.ts, ai-actions.ts, load-actions.ts, queries.ts, removal-queries.ts]
- "pwa_pwa": "pwa.tsx" | kind=code-symbol | source=src/features/pwa/pwa.tsx:L1 | neighbors=[layout.tsx, utils.ts, cn(), InstallButton(), InstallPromptEvent, PwaRegister()]
- "settings_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/settings/loading.tsx:L1 | neighbors=[0ef5142 fix(ui): correctness, responsiv…, 232b7ef ., SettingsLoading(), card.tsx, Card(), CardContent()]
- "shared_help_note": "help-note.tsx" | kind=code-symbol | source=src/components/shared/help-note.tsx:L1 | neighbors=[473168b docs: restore the reasoning the…, 743b1f2 fix(ui): a false-positive tag m…, 89dee50 fix(ui): craft regressions the …, cohort-views.tsx, declare-absence-dialog.tsx, log-box.tsx]
- "shell_sidebar_model": "sidebar-model.ts" | kind=code-symbol | source=src/components/shell/sidebar-model.ts:L1 | neighbors=[3dcd417 feat(shell): collapse the sideb…, types.ts, commands.ts, sidebar.tsx, nextSidebarState(), resolveSidebarState()]
- "sprints_board_view_open_statuses": "OPEN_STATUSES" | kind=code-symbol | source=src/features/sprints/board-view.ts:L58 | neighbors=[contribution-queries.ts, queries.ts, ai-actions.ts, load-actions.ts, planner-actions.ts, handover-queries.ts]
- "sprints_roadmap_layout_test": "roadmap-layout.test.ts" | kind=code-symbol | source=src/features/sprints/roadmap-layout.test.ts:L1 | neighbors=[roadmap-layout.ts, BarGeometry, offsetOfDate(), packRows(), parseZoom(), PX_PER_DAY]
- "sprints_task_actions_test": "task-actions.test.ts" | kind=code-symbol | source=src/features/sprints/task-actions.test.ts:L1 | neighbors=[live.ts, liveTasks, schema.ts, tasks, task-actions.ts, asAdmin()]
- "sprints_task_actions_updatetask": "updateTask()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L385 | neighbors=[action-item-board.tsx, task-card.tsx, task-dialog.tsx, task-actions.ts, isForeignKeyViolation(), notifyAssignmentIfAny()]
- "ui_dialog_dialogclose": "DialogClose()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L22 | neighbors=[add-user-dialog.tsx, app-form-dialog.tsx, ask-bubble.tsx, declare-absence-dialog.tsx, meeting-detail-dialog.tsx, meeting-form.tsx]
- "ui_popover_popover": "Popover()" | kind=code-symbol | source=src/components/ui/popover.tsx:L8 | neighbors=[apps-table.tsx, capacity-heat-editable.tsx, jump-to-date.tsx, meeting-form.tsx, meeting-people-picker.tsx, meeting-project-select.tsx]
- "ui_popover_popovercontent": "PopoverContent()" | kind=code-symbol | source=src/components/ui/popover.tsx:L16 | neighbors=[apps-table.tsx, capacity-heat-editable.tsx, jump-to-date.tsx, meeting-form.tsx, meeting-people-picker.tsx, meeting-project-select.tsx]
- "ui_popover_popovertrigger": "PopoverTrigger()" | kind=code-symbol | source=src/components/ui/popover.tsx:L12 | neighbors=[apps-table.tsx, capacity-heat-editable.tsx, jump-to-date.tsx, meeting-form.tsx, meeting-people-picker.tsx, meeting-project-select.tsx]
- "worklog_entry_check_test": "entry-check.test.ts" | kind=code-symbol | source=src/features/worklog/entry-check.test.ts:L1 | neighbors=[3c30bf4 worklog: per-task hours substra…, entry-check.ts, CHECK_THRESHOLDS, CheckEntry, DayEvidence, findDiscrepancies()]
- "worklog_entry_suggestions": "entry-suggestions.ts" | kind=code-symbol | source=src/features/worklog/entry-suggestions.ts:L1 | neighbors=[2e02b26 feat(worklog): suggest a person…, project-roles.ts, ProjectRoleTone, buildEntrySuggestions(), dedupe(), EntrySuggestion]
- "worklog_worklog_day_resolveworkday": "resolveWorkDay()" | kind=code-symbol | source=src/features/worklog/worklog-day.ts:L20 | neighbors=[page.tsx, page.tsx, auto-score-sync.ts, catch-up-actions.ts, entry-evidence.ts, nudge-queries.ts]
- "activity_commands": "commands.ts" | kind=code-symbol | source=src/features/activity/commands.ts:L1 | neighbors=[commands, range(), shiftDays(), today(), filters.ts, activityParams()]
- "activity_describe": "describe.ts" | kind=code-symbol | source=src/features/activity/describe.ts:L1 | neighbors=[activityFilterHref(), describeActivityFilters(), isoDayLabel(), MONTHS, filters.ts, activityParams()]
- "activity_types_activityrow": "ActivityRow" | kind=code-symbol | source=src/features/activity/types.ts:L95 | neighbors=[actions.ts, format.ts, format.test.ts, queries.ts, search.ts, search.test.ts]
- "admin_actions_revalidateadminpaths": "revalidateAdminPaths()" | kind=code-symbol | source=src/features/admin/actions.ts:L98 | neighbors=[actions.ts, approveUser(), createUser(), rejectUser(), resetUserPassword(), revalidateUserDetailPaths()]
- "admin_audit_filters_auditparamstate": "AuditParamState" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L73 | neighbors=[audit-filters.ts, audit-filters.test.ts, audit-nl.ts, audit-nl-actions.ts, audit-queries.ts, audit-queries.test.ts]
- "app_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/loading.tsx:L1 | neighbors=[DashboardLoading(), dashboard-zones.tsx, AiZoneSkeleton(), MyDayZoneSkeleton(), PortfolioZoneSkeleton(), TeamZoneSkeleton()]
- "auth_capabilities_action": "Action" | kind=code-symbol | source=src/features/auth/capabilities.ts:L255 | neighbors=[sections.ts, actor.ts, capabilities.ts, capabilities.test.ts, deactivated.test.ts, page.tsx]
- "bugs_commands": "commands.ts" | kind=code-symbol | source=src/features/bugs/commands.ts:L1 | neighbors=[capabilities.ts, Actor, can(), actorFor(), commands, EMPTY_SCOPE]
- "commit:repo:github.com/DeegayuA/LogPup@8c996d90b0ede0020e064a49931632e04845b99b": "8c996d9 feat(notifications): a mention notifies exactly once, and says so when …" | kind=Commit | source=git | neighbors=[007c37f ., main, e73a38e fix(live): mint tokens with the…, schema.ts, 0061_mentions.sql, entity-kinds.ts]
- "commit:repo:github.com/DeegayuA/LogPup@bee388b47f0d707eaf3322d94c663e1169cb61cb": "bee388b feat(intel): fold the page into the bubble, behind one arrow" | kind=Commit | source=git | neighbors=[layout.tsx, main, 8fa8f26 feat(worklog): the whole day in…, ask-bubble.tsx, command-center.tsx, intel-view.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-018.json

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
