# Node Description Batch 84 of 166

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

- "auth_webauthn_actions_passkeysummary": "PasskeySummary" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L279 | neighbors=[webauthn-actions.ts, passkeys-card.tsx]
- "auth_webauthn_actions_sha256": "sha256()" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L77 | neighbors=[webauthn-actions.ts, completePasskeyLogin()]
- "backup_route_get": "GET()" | kind=code-symbol | source=src/app/api/cron/backup/route.ts:L27 | neighbors=[route.ts, isAuthorized()]
- "backup_route_isauthorized": "isAuthorized()" | kind=code-symbol | source=src/app/api/cron/backup/route.ts:L17 | neighbors=[route.ts, GET()]
- "bugs_bug_csv_bugcsvtemplate": "bugCsvTemplate()" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L266 | neighbors=[bug-csv.ts, bug-csv.test.ts]
- "bugs_bug_csv_bugcsvtemplatefilename": "bugCsvTemplateFilename()" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L271 | neighbors=[bug-csv.ts, bug-csv.test.ts]
- "bugs_bug_csv_fieldreason": "fieldReason()" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L364 | neighbors=[bug-csv.ts, validateBugCsvRow()]
- "bugs_bug_csv_invalidbugcsvrow": "InvalidBugCsvRow" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L323 | neighbors=[bug-csv.ts, import-actions.ts]
- "bugs_bug_csv_normalizevalue": "normalizeValue()" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L281 | neighbors=[bug-csv.ts, validateBugCsvRow()]
- "bugs_bug_csv_test_file": "file()" | kind=code-symbol | source=src/features/bugs/bug-csv.test.ts:L31 | neighbors=[bug-csv.test.ts, reasonsFor()]
- "bugs_bug_csv_test_parseok": "parseOk()" | kind=code-symbol | source=src/features/bugs/bug-csv.test.ts:L36 | neighbors=[bug-csv.test.ts, reasonsFor()]
- "bugs_bug_csv_validbugcsvrow": "ValidBugCsvRow" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L310 | neighbors=[bug-csv.ts, import-actions.ts]
- "bugs_bug_display_settled_bug_statuses": "SETTLED_BUG_STATUSES" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L54 | neighbors=[bug-display.ts, bug-display.test.ts]
- "bugs_commands_commands": "commands" | kind=code-symbol | source=src/features/bugs/commands.ts:L45 | neighbors=[commands.ts, commands.ts]
- "bugs_import_actions_bugimportpreview": "BugImportPreview" | kind=code-symbol | source=src/features/bugs/import-actions.ts:L75 | neighbors=[import-actions.ts, bug-csv-import-dialog.tsx]
- "bugs_import_actions_revalidatebugs": "revalidateBugs()" | kind=code-symbol | source=src/features/bugs/import-actions.ts:L96 | neighbors=[import-actions.ts, importBugCsvRows()]
- "bugs_queries_bugrow": "BugRow" | kind=code-symbol | source=src/features/bugs/queries.ts:L42 | neighbors=[queries.ts, bug-list.tsx]
- "bugs_queries_getbugscope": "getBugScope()" | kind=code-symbol | source=src/features/bugs/queries.ts:L254 | neighbors=[actions.ts, queries.ts]
- "bugs_queries_getopenbugcountforapp": "getOpenBugCountForApp()" | kind=code-symbol | source=src/features/bugs/queries.ts:L149 | neighbors=[queries.ts, page.tsx]
- "bugs_queries_listbugsforapp": "listBugsForApp()" | kind=code-symbol | source=src/features/bugs/queries.ts:L102 | neighbors=[queries.ts, page.tsx]
- "bugs_queries_triagepage": "TriagePage" | kind=code-symbol | source=src/features/bugs/queries.ts:L199 | neighbors=[actions.ts, queries.ts]
- "bugs_report_input_bugcontentinput": "bugContentInput" | kind=code-symbol | source=src/features/bugs/report-input.ts:L162 | neighbors=[actions.ts, report-input.ts]
- "bugs_report_input_bugpagepath": "bugPagePath" | kind=code-symbol | source=src/features/bugs/report-input.ts:L26 | neighbors=[bug-csv.ts, report-input.ts]
- "bugs_report_input_bugqueuepageinput": "bugQueuePageInput" | kind=code-symbol | source=src/features/bugs/report-input.ts:L220 | neighbors=[actions.ts, report-input.ts]
- "bugs_search_providers_searchproviders": "searchProviders" | kind=code-symbol | source=src/features/bugs/search-providers.ts:L37 | neighbors=[search-providers.ts, providers.ts]
- "calendar_google_calendar_calendarerrorkey": "CalendarErrorKey" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L195 | neighbors=[google-calendar.ts, google-calendar.test.ts]
- "components_action_item_board_actionitemassignee": "ActionItemAssignee()" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L164 | neighbors=[action-item-board.tsx, meeting-notes.tsx]
- "components_action_item_board_actionitemduedate": "ActionItemDueDate()" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L225 | neighbors=[action-item-board.tsx, meeting-notes.tsx]
- "components_action_item_board_actionitemtitle": "ActionItemTitle()" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L416 | neighbors=[action-item-board.tsx, meeting-notes.tsx]
- "components_active_sprints_formatupcomingdate": "formatUpcomingDate()" | kind=code-symbol | source=src/features/dashboard/components/active-sprints.tsx:L41 | neighbors=[active-sprints.tsx, ActiveSprints()]
- "components_active_sprints_startsinlabel": "startsInLabel()" | kind=code-symbol | source=src/features/dashboard/components/active-sprints.tsx:L31 | neighbors=[active-sprints.tsx, ActiveSprints()]
- "components_activity_feed_activityfeed": "ActivityFeed()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L78 | neighbors=[activity-feed.tsx, recent-activity-card.tsx]
- "components_activity_feed_activitytrail": "ActivityTrail()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L480 | neighbors=[activity-feed.tsx, activity-trail-pager.tsx]
- "components_activity_feed_flatrow": "FlatRow()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L45 | neighbors=[activity-feed.tsx, initialOf()]
- "components_activity_feed_initialof": "initialOf()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L23 | neighbors=[activity-feed.tsx, FlatRow()]
- "components_activity_filter_bar_activityfilterbar": "ActivityFilterBar()" | kind=code-symbol | source=src/features/activity/components/activity-filter-bar.tsx:L188 | neighbors=[page.tsx, activity-filter-bar.tsx]
- "components_activity_graph_activitygraph": "ActivityGraph()" | kind=code-symbol | source=src/features/people/components/activity-graph.tsx:L43 | neighbors=[activity-graph.tsx, person-activity-card.tsx]
- "components_activity_trail_pager_activitytrailpager": "ActivityTrailPager()" | kind=code-symbol | source=src/features/activity/components/activity-trail-pager.tsx:L28 | neighbors=[page.tsx, activity-trail-pager.tsx]
- "components_add_user_dialog_adduserdialog": "AddUserDialog()" | kind=code-symbol | source=src/features/admin/components/add-user-dialog.tsx:L55 | neighbors=[add-user-dialog.tsx, page.tsx]
- "components_admin_nav_adminnav": "AdminNav()" | kind=code-symbol | source=src/features/admin/components/admin-nav.tsx:L23 | neighbors=[layout.tsx, admin-nav.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-083.json

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
