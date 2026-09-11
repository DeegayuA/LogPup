# Node Description Batch 8 of 166

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

- "ui_dialog_dialogcontent": "DialogContent()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L42 | neighbors=[action-item-board.tsx, add-user-dialog.tsx, app-form-dialog.tsx, assign-dialog.tsx, bug-csv-import-dialog.tsx, correct-selection.tsx]
- "ui_dialog_dialogdescription": "DialogDescription()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L140 | neighbors=[action-item-board.tsx, add-user-dialog.tsx, app-form-dialog.tsx, assign-dialog.tsx, bug-csv-import-dialog.tsx, correct-selection.tsx]
- "worklog_actions": "actions.ts" | kind=code-symbol | source=src/features/worklog/actions.ts:L1 | neighbors=[3ac9d68 ., 9f936b5 Add app aliases and auto-scored…, day-one-line.tsx, day-panel.tsx, log-box.tsx, worklog-form.tsx]
- "auth_actions": "actions.ts" | kind=code-symbol | source=src/features/auth/actions.ts:L1 | neighbors=[log.ts, logActivity(), loginWithPassword(), setOwnGithubLogin(), setOwnPassword(), setOwnPhone()]
- "bugs_report_input": "report-input.ts" | kind=code-symbol | source=src/features/bugs/report-input.ts:L1 | neighbors=[actions.ts, bug-csv.ts, page.tsx, queries.ts, queue-page.ts, bug-display.ts]
- "components_catch_up_panel": "catch-up-panel.tsx" | kind=code-symbol | source=src/features/worklog/components/catch-up-panel.tsx:L1 | neighbors=[55c832b fix(worklog): stop the catch-up…, 89dee50 fix(ui): craft regressions the …, 8e831ec feat(worklog): the catch-up led…, a4b271b Improve leave types and worklog…, ai-meter-provider.tsx, meterOrigin()]
- "components_meetings_agenda": "meetings-agenda.tsx" | kind=code-symbol | source=src/features/meetings/components/meetings-agenda.tsx:L1 | neighbors=[meeting-form.tsx, MeetingForm(), meeting-list.tsx, MeetingList(), MeetingsAgenda(), mention-textarea.tsx]
- "components_next_meeting_card": "next-meeting-card.tsx" | kind=code-symbol | source=src/features/meetings/components/next-meeting-card.tsx:L1 | neighbors=[3c0bc01 ., meeting-intel.tsx, meeting-chips.tsx, MetaChip(), meeting-form.tsx, MeetingForm()]
- "components_progress_filters": "progress-filters.tsx" | kind=code-symbol | source=src/features/worklog/components/progress-filters.tsx:L1 | neighbors=[noon(), ProgressFilters(), ProgressFiltersInner(), utils.ts, cn(), button.tsx]
- "home_page": "page.tsx" | kind=code-symbol | source=src/app/(public)/home/page.tsx:L1 | neighbors=[5d6c459 fix(home): resolve model rates …, c1235a2 docs(public): restore the four …, d0da911 test(gemini): a public page may…, bento-features.tsx, BentoFeatures(), capabilities-grid.tsx]
- "insights_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/admin/insights/page.tsx:L1 | neighbors=[717069e feat(admin): the page that says…, actor.ts, loadActor, capabilities.ts, can(), queries.ts]
- "meetings_event_color": "event-color.ts" | kind=code-symbol | source=src/features/meetings/event-color.ts:L1 | neighbors=[activity-feed.tsx, app-card.tsx, capacity-heat.tsx, capacity-heat-editable.tsx, cohort-views.tsx, directory.tsx]
- "meetings_recording_actions": "recording-actions.ts" | kind=code-symbol | source=src/features/meetings/recording-actions.ts:L1 | neighbors=[817bf89 ., meeting-intel.tsx, recording-takes.tsx, log.ts, logActivity(), index.ts]
- "meetings_series_key": "series-key.ts" | kind=code-symbol | source=src/features/meetings/series-key.ts:L1 | neighbors=[232b7ef ., series-groups.ts, suggest.ts, attendee-series.ts, coverage.ts, load-actions.ts]
- "notify_tick_route": "route.ts" | kind=code-symbol | source=src/app/api/cron/notify-tick/route.ts:L1 | neighbors=[9f936b5 Add app aliases and auto-scored…, c93474b feat(notifications): a schedule…, index.ts, Db, schema.ts, notifications]
- "notion_actions": "actions.ts" | kind=code-symbol | source=src/features/notion/actions.ts:L1 | neighbors=[export-button.tsx, actor.ts, requireCapability(), index.ts, Db, live.ts]
- "people_capacity_compare": "capacity-compare.ts" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L1 | neighbors=[history-views.tsx, page.tsx, capacity-bar.tsx, allocation-history.ts, ChangeKind, HistoryRow]
- "sprints_sprint_date_range": "sprint-date-range.ts" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L1 | neighbors=[app-health.ts, meeting-list.tsx, roadmap-timeline.tsx, sprint-edit-dialog.tsx, sprint-form-dialog.tsx, calendar-view.ts]
- "ui_datetime_wheel": "datetime-wheel.tsx" | kind=code-symbol | source=src/components/ui/datetime-wheel.tsx:L1 | neighbors=[action-item-board.tsx, meeting-detail-dialog.tsx, meeting-form.tsx, next-meeting-card.tsx, utils.ts, cn()]
- "ui_dialog_dialogheader": "DialogHeader()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L90 | neighbors=[action-item-board.tsx, add-user-dialog.tsx, app-form-dialog.tsx, assign-dialog.tsx, bug-csv-import-dialog.tsx, correct-selection.tsx]
- "ui_dropdown_menu": "dropdown-menu.tsx" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L1 | neighbors=[add-to-calendar.tsx, board-bulk-bar.tsx, board-toolbar.tsx, meeting-list.tsx, notification-bell-client.tsx, card-quick-menu.tsx]
- "ui_select_selectcontent": "SelectContent()" | kind=code-symbol | source=src/components/ui/select.tsx:L72 | neighbors=[action-item-board.tsx, activity-filter-bar.tsx, add-user-dialog.tsx, ai-model-select.tsx, app-form-dialog.tsx, apps-table.tsx]
- "ui_select_selectitem": "SelectItem()" | kind=code-symbol | source=src/components/ui/select.tsx:L124 | neighbors=[action-item-board.tsx, activity-filter-bar.tsx, add-user-dialog.tsx, ai-model-select.tsx, app-form-dialog.tsx, apps-table.tsx]
- "ui_select_selecttrigger": "SelectTrigger()" | kind=code-symbol | source=src/components/ui/select.tsx:L44 | neighbors=[action-item-board.tsx, activity-filter-bar.tsx, add-user-dialog.tsx, ai-model-select.tsx, app-form-dialog.tsx, apps-table.tsx]
- "ui_select_selectvalue": "SelectValue()" | kind=code-symbol | source=src/components/ui/select.tsx:L21 | neighbors=[action-item-board.tsx, activity-filter-bar.tsx, add-user-dialog.tsx, ai-model-select.tsx, app-form-dialog.tsx, apps-table.tsx]
- "worklog_coverage_queries": "coverage-queries.ts" | kind=code-symbol | source=src/features/worklog/coverage-queries.ts:L1 | neighbors=[dashboard-zones.tsx, context-pack.ts, capabilities.ts, Actor, can(), index.ts]
- "worklog_entry_draft_prompt": "entry-draft-prompt.ts" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L1 | neighbors=[1b4f4ee feat(worklog): log an hour by w…, 53ae2f3 feat(worklog): attribute hours …, 5e32b09 fix(worklog): Fill my day ignor…, 6909ea3 feat(worklog): AI drafts the da…, de4812e feat(github): commits become wo…, entry-ai-actions.ts]
- "worklog_schedules": "schedules.ts" | kind=code-symbol | source=src/features/worklog/schedules.ts:L1 | neighbors=[dd6f2fd feat(worklog): define how long …, declare-absence-dialog.tsx, log-box.tsx, capacity-hours.ts, capacity-hours.test.ts, absence-actions.ts]
- "commit:repo:github.com/DeegayuA/LogPup@3c0bc01144c0296d15255acd447c163b3935ec61": "3c0bc01 ." | kind=Commit | source=git | neighbors=[main, 671c254 ., action-item-board.tsx, attribution-inline.tsx, day-hours-card.tsx, day-panel.tsx]
- "components_allocation_history_card": "allocation-history-card.tsx" | kind=code-symbol | source=src/features/people/components/allocation-history-card.tsx:L1 | neighbors=[AllocationHistoryCard(), KIND_DOT, KIND_LABEL, allocation-trend.tsx, AllocationTrend(), section-empty.tsx]
- "components_load_board": "load-board.tsx" | kind=code-symbol | source=src/features/meetings/components/load-board.tsx:L1 | neighbors=[a1e0845 ., LoadBoard(), SuggestionCard(), meeting-form.tsx, MeetingForm(), load-actions.ts]
- "components_meeting_glance": "meeting-glance.ts" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L1 | neighbors=[671c254 ., meeting-detail-dialog.tsx, AttendeeResponse, durationLabel(), isAwaitingViewerRsvp(), MeetingsOverview]
- "components_mention_textarea": "mention-textarea.tsx" | kind=code-symbol | source=src/components/mention-textarea.tsx:L1 | neighbors=[action-item-board.tsx, app-comments.tsx, meeting-header-actions.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx, meeting-list.tsx]
- "components_person_followups_card": "person-followups-card.tsx" | kind=code-symbol | source=src/features/people/components/person-followups-card.tsx:L1 | neighbors=[a4b271b Improve leave types and worklog…, dashboard-zones.tsx, firstName(), FollowupList(), FollowupRow(), PersonFollowupsCard()]
- "components_recording_takes": "recording-takes.tsx" | kind=code-symbol | source=src/features/meetings/components/recording-takes.tsx:L1 | neighbors=[817bf89 ., meeting-intel.tsx, describeTake(), RecordingTakes(), utils.ts, cn()]
- "dashboard_zones": "zones.ts" | kind=code-symbol | source=src/features/dashboard/zones.ts:L1 | neighbors=[page.tsx, 104afee feat(dashboard): the dashboard …, dashboard-zones.tsx, capabilities.ts, Action, Actor]
- "db_schema_assignments": "assignments" | kind=code-symbol | source=src/db/schema.ts:L359 | neighbors=[actions.ts, backup.ts, clear-test-data.test.ts, trash-actions.ts, trash-actions.test.ts, contribution-queries.ts]
- "lib_session_getsession": "getSession" | kind=code-symbol | source=src/lib/session.ts:L30 | neighbors=[page.tsx, layout.tsx, page.tsx, page.tsx, actor.ts, maintenance-mount.tsx]
- "meetings_attendee_score_test": "attendee-score.test.ts" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L1 | neighbors=[attendee-score.ts, CandidateFacts, CAVEAT_TEMPLATES, CaveatCode, REASON_TEMPLATES, ReasonCode]
- "people_cohort_filter": "cohort-filter.ts" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L1 | neighbors=[ae2feea feat(people): filtering and ord…, cohort-views.tsx, project-roles.ts, ProjectRoleTone, roleBadgeTone(), FilterableProject]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-007.json

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
