# Node Description Batch 42 of 166

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

- "worklog_coverage_coveragesummary": "CoverageSummary" | kind=code-symbol | source=src/features/worklog/coverage.ts:L70 | neighbors=[coverage-figure.tsx, progress-matrix.tsx, coverage.ts, coverage-queries.ts, progress-queries.ts]
- "worklog_day_form": "day-form.ts" | kind=code-symbol | source=src/features/worklog/day-form.ts:L1 | neighbors=[c032099 fix(worklog): the Save button s…, worklog-form.tsx, DayFormFields, dayFormProblem(), day-form.test.ts]
- "worklog_day_state_ishalfday": "isHalfDay()" | kind=code-symbol | source=src/features/worklog/day-state.ts:L81 | neighbors=[worklog-calendar.tsx, day-state.ts, dayStateText(), day-state.test.ts, page.tsx]
- "worklog_entries_formathours": "formatHours()" | kind=code-symbol | source=src/features/worklog/entries.ts:L64 | neighbors=[day-hours-card.tsx, logged-days-list.tsx, day-summary.ts, entries.ts, entries.test.ts]
- "worklog_entry_actions_updateworklogentry": "updateWorklogEntry()" | kind=code-symbol | source=src/features/worklog/entry-actions.ts:L285 | neighbors=[day-hours-card.tsx, entry-actions.ts, resolveEntryAppId(), unexpected(), writer()]
- "worklog_entry_check_finddiscrepancies": "findDiscrepancies()" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L196 | neighbors=[entry-ai-actions.ts, entry-check.ts, hoursPhrase(), mergedMeetingMinutes(), entry-check.test.ts]
- "worklog_entry_check_observation": "Observation" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L63 | neighbors=[day-hours-card.tsx, entry-ai-actions.ts, entry-check.ts, entry-check-prompt.ts, entry-check-prompt.test.ts]
- "worklog_entry_evidence_loaddayevidence": "loadDayEvidence()" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L249 | neighbors=[entry-ai-actions.ts, entry-evidence.ts, dayWindow(), meetingsAttended(), scheduledMinutesFor()]
- "worklog_entry_language_grammarforprompt": "grammarForPrompt()" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L280 | neighbors=[catch-up-parse.ts, entry-draft-prompt.ts, entry-language.ts, describeGrammar(), entry-language.test.ts]
- "worklog_entry_queries_loggabletask": "LoggableTask" | kind=code-symbol | source=src/features/worklog/entry-queries.ts:L106 | neighbors=[day-hours-card.tsx, day-one-line.tsx, day-panel.tsx, log-box.tsx, entry-queries.ts]
- "worklog_note_app_tags_notehasapptag": "noteHasAppTag()" | kind=code-symbol | source=src/features/worklog/note-app-tags.ts:L66 | neighbors=[worklog-form.tsx, guest-projects.ts, note-app-tags.ts, note-app-tags.test.ts, toggleNoteAppTag()]
- "worklog_org_holiday_queries_orgholidayrow": "OrgHolidayRow" | kind=code-symbol | source=src/features/worklog/org-holiday-queries.ts:L5 | neighbors=[org-holidays-card.tsx, holiday-listing.ts, holiday-listing.test.ts, org-holiday-queries.ts, page.tsx]
- "worklog_org_holidays_orgholidayset": "orgHolidaySet()" | kind=code-symbol | source=src/features/worklog/org-holidays.ts:L29 | neighbors=[coverage-queries.ts, org-holidays.ts, isOrgHolidayInForce(), org-holidays.test.ts, queries.ts]
- "worklog_progress_params_eachdayinclusive": "eachDayInclusive()" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L98 | neighbors=[progress-params.ts, addDaysIso(), resolveProgressWindow(), progress-params.test.ts, progress-queries.ts]
- "worklog_progress_params_parseprogressparams": "parseProgressParams()" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L66 | neighbors=[page.tsx, progress-params.ts, first(), isValidIsoDay(), progress-params.test.ts]
- "worklog_queries_getmyworkschedule": "getMyWorkSchedule()" | kind=code-symbol | source=src/features/worklog/queries.ts:L381 | neighbors=[auto-score-sync.ts, catch-up-actions.ts, entry-evidence.ts, page.tsx, queries.ts]
- "worklog_worklog_day_test": "worklog-day.test.ts" | kind=code-symbol | source=src/features/worklog/worklog-day.test.ts:L1 | neighbors=[worklog-day.ts, isFutureWorkDay(), resolveWorkDay(), summarizeWorklogs(), worklogDaysBack()]
- "activity_actions_loadolderactivity": "loadOlderActivity()" | kind=code-symbol | source=src/features/activity/actions.ts:L78 | neighbors=[actions.ts, colomboDayEnd(), colomboDayStart(), activity-trail-pager.tsx]
- "activity_describe_describeactivityfilters": "describeActivityFilters()" | kind=code-symbol | source=src/features/activity/describe.ts:L45 | neighbors=[describe.ts, isoDayLabel(), describe.test.ts, page.tsx]
- "activity_filters_activityconditions": "activityConditions()" | kind=code-symbol | source=src/features/activity/filters.ts:L44 | neighbors=[filters.ts, activitySearchCondition(), filters.test.ts, queries.ts]
- "activity_filters_decodeactivitycursor": "decodeActivityCursor()" | kind=code-symbol | source=src/features/activity/filters.ts:L97 | neighbors=[actions.ts, filters.ts, filters.test.ts, page.tsx]
- "activity_filters_encodeactivitycursor": "encodeActivityCursor()" | kind=code-symbol | source=src/features/activity/filters.ts:L85 | neighbors=[actions.ts, filters.ts, filters.test.ts, page.tsx]
- "activity_format_activityphrase": "activityPhrase()" | kind=code-symbol | source=src/features/activity/format.ts:L26 | neighbors=[format.ts, activityPhraseParts(), format.test.ts, activity-feed.tsx]
- "activity_search_activityrowsearchtext": "activityRowSearchText()" | kind=code-symbol | source=src/features/activity/search.ts:L18 | neighbors=[actions.ts, page.tsx, search.ts, search.test.ts]
- "activity_search_fuzzyactivityfallback": "fuzzyActivityFallback()" | kind=code-symbol | source=src/features/activity/search.ts:L91 | neighbors=[page.tsx, search.ts, tokenize(), search.test.ts]
- "admin_actions_createuser": "createUser()" | kind=code-symbol | source=src/features/admin/actions.ts:L499 | neighbors=[actions.ts, duplicateUserMessage(), revalidateAdminPaths(), add-user-dialog.tsx]
- "admin_actions_otheractivesuperadmincount": "otherActiveSuperadminCount()" | kind=code-symbol | source=src/features/admin/actions.ts:L125 | neighbors=[actions.ts, removeUser(), setUserActive(), setUserRole()]
- "admin_approval_badge_approvalbadgetext": "approvalBadgeText()" | kind=code-symbol | source=src/features/admin/approval-badge.ts:L53 | neighbors=[approval-badge.ts, approvalTotal(), approval-badge.test.ts, sidebar.tsx]
- "admin_approval_badge_no_approvals": "NO_APPROVALS" | kind=code-symbol | source=src/features/admin/approval-badge.ts:L25 | neighbors=[approval-badge.ts, approval-badge.test.ts, approval-queries.ts, sidebar.tsx]
- "admin_approval_badge_showapprovals": "showApprovals()" | kind=code-symbol | source=src/features/admin/approval-badge.ts:L40 | neighbors=[approval-badge.ts, approvalTotal(), approval-badge.test.ts, sidebar.tsx]
- "admin_audit_filters_clearedauditstate": "clearedAuditState()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L216 | neighbors=[audit-filters.ts, clearAuditFiltersHref(), audit-filters.test.ts, audit-filter-bar.tsx]
- "admin_audit_filters_nextauditdir": "nextAuditDir()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L51 | neighbors=[audit-filters.ts, auditSortHref(), defaultAuditDir(), audit-filters.test.ts]
- "admin_backup_encryptsnapshot": "encryptSnapshot()" | kind=code-symbol | source=src/features/admin/backup.ts:L87 | neighbors=[backup.ts, encryptionKey(), danger-actions.ts, route.ts]
- "admin_bulk_logic_bulkoutcome": "BulkOutcome" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L90 | neighbors=[bulk-actions.ts, bulk-logic.ts, bulk-logic.test.ts, trash-card.tsx]
- "admin_bulk_logic_csvvalue": "CsvValue" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L162 | neighbors=[bulk-logic.ts, audit-csv-button.tsx, csv-download.ts, team-csv.ts]
- "admin_bulk_logic_normalizeheader": "normalizeHeader()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L289 | neighbors=[bulk-logic.ts, bug-csv.ts, bug-csv.test.ts, deadline-csv.ts]
- "admin_bulk_logic_splitcsvrows": "splitCsvRows()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L219 | neighbors=[bulk-logic.ts, bug-csv.ts, bug-csv.test.ts, deadline-csv.ts]
- "admin_bulk_logic_summarizeoutcomes": "summarizeOutcomes()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L102 | neighbors=[bulk-actions.ts, bulk-logic.ts, bulk-logic.test.ts, trash-card.tsx]
- "admin_change_request_actions_approvechangerequest": "approveChangeRequest()" | kind=code-symbol | source=src/features/admin/change-request-actions.ts:L95 | neighbors=[change-request-actions.ts, currentRowFor(), unexpected(), approval-actions.tsx]
- "admin_change_request_appliers_buildapplystatement": "buildApplyStatement()" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L171 | neighbors=[change-request-actions.ts, change-request-appliers.ts, buildTaskDeadlineSet(), buildTaskStatusSet()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-041.json

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
