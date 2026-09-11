# Node Description Batch 56 of 166

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

- "worklog_note_app_tags_togglenoteapptag": "toggleNoteAppTag()" | kind=code-symbol | source=src/features/worklog/note-app-tags.ts:L88 | neighbors=[worklog-form.tsx, note-app-tags.ts, note-app-tags.test.ts, noteHasAppTag()]
- "worklog_page_calendarzone": "CalendarZone()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L451 | neighbors=[page.tsx, maxIso(), minIso(), shiftDay()]
- "worklog_page_shiftday": "shiftDay()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L263 | neighbors=[page.tsx, CalendarZone(), LogZone(), SummaryZone()]
- "worklog_page_summaryzone": "SummaryZone()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L294 | neighbors=[page.tsx, maxIso(), minIso(), shiftDay()]
- "worklog_progress_params_mondayof": "mondayOf()" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L109 | neighbors=[progress-params.ts, addDaysIso(), resolveProgressWindow(), progress-params.test.ts]
- "worklog_progress_params_progresshref": "progressHref()" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L184 | neighbors=[progress-filters.tsx, page.tsx, progress-params.ts, progress-params.test.ts]
- "worklog_queries_getmyapprovedabsences": "getMyApprovedAbsences()" | kind=code-symbol | source=src/features/worklog/queries.ts:L309 | neighbors=[auto-score-sync.ts, catch-up-actions.ts, page.tsx, queries.ts]
- "worklog_queries_getmyassignedapps": "getMyAssignedApps()" | kind=code-symbol | source=src/features/worklog/queries.ts:L436 | neighbors=[catch-up-actions.ts, draft-actions.ts, page.tsx, queries.ts]
- "worklog_queries_getteamapprovedabsences": "getTeamApprovedAbsences()" | kind=code-symbol | source=src/features/worklog/queries.ts:L346 | neighbors=[dashboard-zones.tsx, nudge-queries.ts, page.tsx, queries.ts]
- "worklog_queries_getteamroster": "getTeamRoster()" | kind=code-symbol | source=src/features/worklog/queries.ts:L498 | neighbors=[dashboard-zones.tsx, nudge-queries.ts, page.tsx, queries.ts]
- "worklog_queries_getteamworklogs": "getTeamWorklogs()" | kind=code-symbol | source=src/features/worklog/queries.ts:L167 | neighbors=[dashboard-zones.tsx, page.tsx, progress-queries.ts, queries.ts]
- "worklog_queries_getuserjoinday": "getUserJoinDay()" | kind=code-symbol | source=src/features/worklog/queries.ts:L45 | neighbors=[catch-up-actions.ts, entry-evidence.ts, page.tsx, queries.ts]
- "worklog_queries_pickerapp": "PickerApp" | kind=code-symbol | source=src/features/worklog/queries.ts:L139 | neighbors=[catch-up-panel.tsx, day-panel.tsx, worklog-form.tsx, queries.ts]
- "worklog_queries_test": "queries.test.ts" | kind=code-symbol | source=src/features/worklog/queries.test.ts:L1 | neighbors=[org-holidays.ts, queries.ts, rows, selected]
- "worklog_queries_userassignedapp": "UserAssignedApp" | kind=code-symbol | source=src/features/worklog/queries.ts:L422 | neighbors=[catch-up-panel.tsx, day-panel.tsx, worklog-form.tsx, queries.ts]
- "worklog_schedules_overlaps": "overlaps()" | kind=code-symbol | source=src/features/worklog/schedules.ts:L89 | neighbors=[declare-absence-dialog.tsx, absence-actions.ts, schedules.ts, schedules.test.ts]
- "worklog_worklog_day_worklogdaysback": "worklogDaysBack()" | kind=code-symbol | source=src/features/worklog/worklog-day.ts:L44 | neighbors=[page.tsx, worklog-day.ts, worklog-day.test.ts, resolveWorkDay()]
- "activity_describe_activityfilterhref": "activityFilterHref()" | kind=code-symbol | source=src/features/activity/describe.ts:L97 | neighbors=[describe.ts, describe.test.ts, activity-feed.tsx]
- "activity_describe_isodaylabel": "isoDayLabel()" | kind=code-symbol | source=src/features/activity/describe.ts:L26 | neighbors=[describe.ts, describeActivityFilters(), describe.test.ts]
- "activity_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/activity/error.tsx:L1 | neighbors=[ActivityError(), button.tsx, Button()]
- "activity_filters_activitysearchcondition": "activitySearchCondition()" | kind=code-symbol | source=src/features/activity/filters.ts:L22 | neighbors=[filters.ts, activityConditions(), filters.test.ts]
- "activity_format_activitydaysummary": "activityDaySummary()" | kind=code-symbol | source=src/features/activity/format.ts:L87 | neighbors=[format.ts, format.test.ts, activity-feed.tsx]
- "activity_format_groupactivitybursts": "groupActivityBursts()" | kind=code-symbol | source=src/features/activity/format.ts:L135 | neighbors=[format.ts, format.test.ts, activity-feed.tsx]
- "activity_format_groupactivitybyday": "groupActivityByDay()" | kind=code-symbol | source=src/features/activity/format.ts:L66 | neighbors=[format.ts, format.test.ts, activity-feed.tsx]
- "activity_log_test": "log.test.ts" | kind=code-symbol | source=src/features/activity/log.test.ts:L1 | neighbors=[log.ts, INPUT, { insertSpy, valuesSpy }]
- "activity_page_activitytrailsection": "ActivityTrailSection()" | kind=code-symbol | source=src/app/(app)/activity/page.tsx:L236 | neighbors=[page.tsx, colomboDayEnd(), colomboDayStart()]
- "activity_queries_listactivity": "listActivity()" | kind=code-symbol | source=src/features/activity/queries.ts:L14 | neighbors=[actions.ts, page.tsx, queries.ts]
- "activity_search_tokenize": "tokenize()" | kind=code-symbol | source=src/features/activity/search.ts:L22 | neighbors=[search.ts, fuzzyActivityFallback(), rankActivityMatches()]
- "admin_actions_approveuser": "approveUser()" | kind=code-symbol | source=src/features/admin/actions.ts:L759 | neighbors=[actions.ts, revalidateAdminPaths(), pending-approvals-card.tsx]
- "admin_actions_cleartestdata": "clearTestData()" | kind=code-symbol | source=src/features/admin/actions.ts:L37 | neighbors=[actions.ts, dbClearEnabled(), db-clear-button.tsx]
- "admin_actions_rejectuser": "rejectUser()" | kind=code-symbol | source=src/features/admin/actions.ts:L791 | neighbors=[actions.ts, revalidateAdminPaths(), pending-approvals-card.tsx]
- "admin_actions_resetuserpassword": "resetUserPassword()" | kind=code-symbol | source=src/features/admin/actions.ts:L391 | neighbors=[actions.ts, revalidateAdminPaths(), user-table.tsx]
- "admin_actions_setuseremploymenttype": "setUserEmploymentType()" | kind=code-symbol | source=src/features/admin/actions.ts:L831 | neighbors=[actions.ts, bulk-actions.ts, user-table.tsx]
- "admin_actions_setuserorgtags": "setUserOrgTags()" | kind=code-symbol | source=src/features/admin/actions.ts:L594 | neighbors=[actions.ts, revalidateAdminPaths(), user-table.tsx]
- "admin_actions_setuserpersonalemail": "setUserPersonalEmail()" | kind=code-symbol | source=src/features/admin/actions.ts:L671 | neighbors=[actions.ts, revalidateUserDetailPaths(), user-table.tsx]
- "admin_actions_setuserphone": "setUserPhone()" | kind=code-symbol | source=src/features/admin/actions.ts:L628 | neighbors=[actions.ts, revalidateAdminPaths(), user-table.tsx]
- "admin_actions_setusertitle": "setUserTitle()" | kind=code-symbol | source=src/features/admin/actions.ts:L719 | neighbors=[actions.ts, revalidateUserDetailPaths(), user-table.tsx]
- "admin_approval_badge_approvalbadgelabel": "approvalBadgeLabel()" | kind=code-symbol | source=src/features/admin/approval-badge.ts:L66 | neighbors=[approval-badge.ts, approval-badge.test.ts, sidebar.tsx]
- "admin_approval_badge_approvalcounts": "ApprovalCounts" | kind=code-symbol | source=src/features/admin/approval-badge.ts:L16 | neighbors=[approval-badge.ts, approval-queries.ts, sidebar.tsx]
- "admin_approval_queries_countpendingapprovals": "countPendingApprovals" | kind=code-symbol | source=src/features/admin/approval-queries.ts:L33 | neighbors=[approval-queries.ts, page.tsx, layout.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-055.json

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
