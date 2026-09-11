# Node Description Batch 29 of 166

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

- "ui_kbd_kbd": "Kbd()" | kind=code-symbol | source=src/components/ui/kbd.tsx:L11 | neighbors=[ask-bubble.tsx, ask-panel.tsx, command-center.tsx, signal-board.tsx, shortcuts-overlay.tsx, sidebar.tsx]
- "ui_search_select_searchselect": "SearchSelect()" | kind=code-symbol | source=src/components/ui/search-select.tsx:L42 | neighbors=[assign-dialog.tsx, capacity-heat-editable.tsx, danger-app-reset-card.tsx, danger-meeting-delete-card.tsx, day-hours-card.tsx, worklog-form.tsx]
- "ui_switch": "switch.tsx" | kind=code-symbol | source=src/components/ui/switch.tsx:L1 | neighbors=[ai-feature-toggle.tsx, maintenance-controls.tsx, meeting-intel.tsx, user-table.tsx, utils.ts, cn()]
- "ui_tabs": "tabs.tsx" | kind=code-symbol | source=src/components/ui/tabs.tsx:L1 | neighbors=[utils.ts, cn(), Tabs(), TabsContent(), TabsList(), tabsListVariants]
- "worklog_absence_actions_test": "absence-actions.test.ts" | kind=code-symbol | source=src/features/worklog/absence-actions.test.ts:L1 | neighbors=[24fb822 fix(worklog): two absence write…, schema.ts, absences, absence-actions.ts, { authMock, logActivityMock, whereSpy, …, selectQueue]
- "worklog_absence_days_absencedays": "absenceDays()" | kind=code-symbol | source=src/features/worklog/absence-days.ts:L27 | neighbors=[context-pack.ts, absence-days.ts, absence-days.test.ts, auto-score-sync.ts, catch-up-actions.ts, nudge-queries.ts]
- "worklog_absence_kinds_absence_kind_labels": "ABSENCE_KIND_LABELS" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L185 | neighbors=[declare-absence-dialog.tsx, log-box.tsx, pending-absence-list.tsx, absence-kinds.ts, absence-kinds.test.ts, catch-up-parse.ts]
- "worklog_auto_score_test": "auto-score.test.ts" | kind=code-symbol | source=src/features/worklog/auto-score.test.ts:L1 | neighbors=[9f936b5 Add app aliases and auto-scored…, auto-score.ts, autoScoreFromHours(), mayAutoScore(), SCORE_SOURCES, scoreSourceLabel()]
- "worklog_catch_up_offline_readcatchuptextoffline": "readCatchUpTextOffline()" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L230 | neighbors=[log-box.tsx, catch-up-offline.ts, findAbsence(), findMarkers(), groupMarkers(), splitItems()]
- "worklog_catch_up_parse_readcatchupreply": "readCatchUpReply()" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L321 | neighbors=[catch-up-actions.ts, catch-up-parse.ts, readAbsence(), readEntries(), readText(), snapPercent()]
- "worklog_day_state_daystatetext": "dayStateText()" | kind=code-symbol | source=src/features/worklog/day-state.ts:L129 | neighbors=[progress-matrix.tsx, worklog-calendar.tsx, day-state.ts, classifyDay(), isHalfDay(), day-state.test.ts]
- "worklog_entry_actions_createworklogentry": "createWorklogEntry()" | kind=code-symbol | source=src/features/worklog/entry-actions.ts:L128 | neighbors=[day-hours-card.tsx, day-one-line.tsx, log-box.tsx, entry-actions.ts, resolveEntryAppId(), unexpected()]
- "worklog_nudge_test": "nudge.test.ts" | kind=code-symbol | source=src/features/worklog/nudge.test.ts:L1 | neighbors=[9f936b5 Add app aliases and auto-scored…, missing-days.ts, nudge.ts, nudgeBody(), NudgeInput, planWorklogNudges()]
- "worklog_org_holiday_queries_listorgholidays": "listOrgHolidays()" | kind=code-symbol | source=src/features/worklog/org-holiday-queries.ts:L30 | neighbors=[page.tsx, auto-score-sync.ts, catch-up-actions.ts, nudge-queries.ts, org-holiday-queries.ts, page.tsx]
- "worklog_progress_params_test": "progress-params.test.ts" | kind=code-symbol | source=src/features/worklog/progress-params.test.ts:L1 | neighbors=[progress-params.ts, addDaysIso(), eachDayInclusive(), mondayOf(), parseProgressParams(), progressHref()]
- "worklog_schedules_test": "schedules.test.ts" | kind=code-symbol | source=src/features/worklog/schedules.test.ts:L1 | neighbors=[dd6f2fd feat(worklog): define how long …, schedules.ts, overlaps(), patternForDay(), scheduledMinutesForFraction(), STUDIO_DEFAULT_PATTERN]
- "worklog_worklog_day_isfutureworkday": "isFutureWorkDay()" | kind=code-symbol | source=src/features/worklog/worklog-day.ts:L33 | neighbors=[actions.ts, entry-actions.ts, entry-ai-actions.ts, page.tsx, worklog-day.ts, resolveWorkDay()]
- "activity_filters_activityparamstate": "ActivityParamState" | kind=code-symbol | source=src/features/activity/filters.ts:L117 | neighbors=[describe.ts, describe.test.ts, filters.ts, page.tsx, activity-feed.tsx, activity-trail-pager.tsx]
- "admin_audit_filters_defaultauditdir": "defaultAuditDir()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L46 | neighbors=[audit-filters.ts, auditQueryString(), nextAuditDir(), parseAuditParams(), audit-filters.test.ts, audit-queries.ts]
- "admin_audit_queries_listaudittrail": "listAuditTrail()" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L159 | neighbors=[audit-queries.ts, auditConditions(), auditOrderBy(), canReadAudit(), listRecentAudit(), page.tsx]
- "admin_bulk_actions_test": "bulk-actions.test.ts" | kind=code-symbol | source=src/features/admin/bulk-actions.test.ts:L1 | neighbors=[bulk-actions.ts, asAdmin(), asNobody(), OK, refuse(), {
  requireCapabilityMock,
  archiveA…]
- "admin_bulk_logic_selectrange": "selectRange()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L37 | neighbors=[bulk-logic.ts, toggleSelected(), bulk-logic.test.ts, apps-table.tsx, trash-card.tsx, user-table.tsx]
- "admin_bulk_logic_tocsv": "toCsv()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L181 | neighbors=[bulk-logic.ts, bulk-logic.test.ts, bug-csv.ts, csv-download.ts, deadline-csv.ts, team-csv.test.ts]
- "admin_bulk_logic_toggleselected": "toggleSelected()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L24 | neighbors=[bulk-logic.ts, selectRange(), bulk-logic.test.ts, apps-table.tsx, trash-card.tsx, user-table.tsx]
- "admin_change_request_appliers_test": "change-request-appliers.test.ts" | kind=code-symbol | source=src/features/admin/change-request-appliers.test.ts:L1 | neighbors=[change-request-appliers.ts, buildTaskDeadlineSet(), detectConflict(), isSupportedEntityType(), SUPPORTED_ENTITY_TYPES, c2dbc08 fix(admin): stop approved chang…]
- "admin_change_request_queries_getapprovalsinbox": "getApprovalsInbox()" | kind=code-symbol | source=src/features/admin/change-request-queries.ts:L45 | neighbors=[approval-queries.ts, change-request-queries.ts, select, toInbox(), page.tsx, dashboard-zones.tsx]
- "admin_danger_logic_emptytrashphrase": "emptyTrashPhrase()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L55 | neighbors=[danger-actions.ts, danger-actions.test.ts, danger-logic.ts, plural(), danger-logic.test.ts, danger-trash-empty-card.tsx]
- "admin_danger_logic_purgeprogressmessage": "purgeProgressMessage()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L248 | neighbors=[danger-logic.ts, plural(), danger-logic.test.ts, danger-app-reset-card.tsx, danger-recordings-card.tsx, danger-trash-empty-card.tsx]
- "admin_danger_logic_wiperecordingsphrase": "wipeRecordingsPhrase()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L60 | neighbors=[danger-actions.ts, danger-actions.test.ts, danger-logic.ts, danger-logic.test.ts, plural(), danger-recordings-card.tsx]
- "admin_trash_actions_purgebug": "purgeBug()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L623 | neighbors=[danger-actions.ts, trash-actions.ts, checkConfirm(), revalidateAppEntityTrashPaths(), slugForApp(), trash-row-actions.tsx]
- "admin_trash_actions_purgemeeting": "purgeMeeting()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L656 | neighbors=[danger-actions.ts, trash-actions.ts, appNameById(), checkConfirm(), revalidateMeetingTrashPaths(), trash-row-actions.tsx]
- "admin_trash_actions_purgesprint": "purgeSprint()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L730 | neighbors=[danger-actions.ts, trash-actions.ts, checkConfirm(), revalidateTrashPaths(), slugForApp(), trash-row-actions.tsx]
- "apps_actions_updateapp": "updateApp()" | kind=code-symbol | source=src/features/apps/actions.ts:L365 | neighbors=[bulk-actions.ts, actions.ts, closeOpenAppRoleInterval(), nameForUser(), app-form-dialog.tsx, apps-table.tsx]
- "apps_app_aliases_aliasedapp": "AliasedApp" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L35 | neighbors=[app-aliases.ts, app-aliases.test.ts, log-box.tsx, catch-up-offline.ts, catch-up-offline.test.ts, catch-up-parse.ts]
- "apps_app_health_parsecalendardate": "parseCalendarDate()" | kind=code-symbol | source=src/features/apps/app-health.ts:L103 | neighbors=[app-health.ts, app-health.test.ts, app-activity.tsx, app-card.tsx, app-sprint-band.tsx, page.tsx]
- "apps_commands": "commands.ts" | kind=code-symbol | source=src/features/apps/commands.ts:L1 | neighbors=[commands, capabilities.ts, isAdminRole(), types.ts, CommandDescriptor, commands.ts]
- "apps_queries_appportfolioentry": "AppPortfolioEntry" | kind=code-symbol | source=src/features/apps/queries.ts:L46 | neighbors=[queries.ts, app-card.tsx, apps-browser.tsx, cohort-views.tsx, dashboard-zones.tsx, page.tsx]
- "apps_repo_metadata_fetchrepocontext": "fetchRepoContext()" | kind=code-symbol | source=src/features/apps/repo-metadata.ts:L81 | neighbors=[actions.ts, repo-metadata.ts, fetchReadme(), githubHeaders(), parseGitHubRepo(), RepoFetchError]
- "apps_role_history_approlekind": "AppRoleKind" | kind=code-symbol | source=src/features/apps/role-history.ts:L12 | neighbors=[actions.ts, queries.ts, role-history.ts, role-history.test.ts, app-role-history-card.tsx, queries.ts]
- "apps_tabs_apptabhref": "appTabHref()" | kind=code-symbol | source=src/features/apps/tabs.ts:L91 | neighbors=[activity-queries.ts, tabs.ts, tabs.test.ts, app-header.tsx, app-tab-nav.tsx, progress-apps-lane.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-028.json

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
