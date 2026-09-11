# Node Description Batch 26 of 166

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

- "worklog_progress_params_resolveprogresswindow": "resolveProgressWindow()" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L151 | neighbors=[page.tsx, progress-params.ts, addDaysIso(), eachDayInclusive(), firstOfMonth(), mondayOf()]
- "worklog_schedules_studio_default_pattern": "STUDIO_DEFAULT_PATTERN" | kind=code-symbol | source=src/features/worklog/schedules.ts:L15 | neighbors=[capacity-hours.ts, capacity-hours.test.ts, coverage.ts, coverage-queries.ts, entry-evidence.ts, missing-days.ts]
- "activity_describe_test": "describe.test.ts" | kind=code-symbol | source=src/features/activity/describe.test.ts:L1 | neighbors=[describe.ts, activityFilterHref(), describeActivityFilters(), isoDayLabel(), EMPTY, filters.ts]
- "activity_filters_activityparams": "activityParams()" | kind=code-symbol | source=src/features/activity/filters.ts:L133 | neighbors=[commands.ts, describe.ts, filters.ts, filters.test.ts, page.tsx, activity-filter-bar.tsx]
- "activity_filters_test": "filters.test.ts" | kind=code-symbol | source=src/features/activity/filters.test.ts:L1 | neighbors=[filters.ts, activityConditions(), activityParams(), activitySearchCondition(), decodeActivityCursor(), encodeActivityCursor()]
- "admin_bulk_actions_runbatch": "runBatch()" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L54 | neighbors=[bulk-actions.ts, bulkArchiveApps(), bulkDeleteApps(), bulkSetAppLead(), bulkSetUserActive(), bulkSetUserEmploymentType()]
- "admin_danger_logic_plural": "plural()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L52 | neighbors=[danger-logic.ts, emptyTrashPhrase(), emptyTrashSummary(), purgeProgressMessage(), resetAppSummary(), wipeRecordingsPhrase()]
- "admin_trash_actions_restoreassignment": "restoreAssignment()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L405 | neighbors=[trash-actions.ts, appNameById(), isUniqueViolation(), nameForUser(), revalidateAssignmentTrashPaths(), slugForApp()]
- "admin_trash_actions_revalidateappentitytrashpaths": "revalidateAppEntityTrashPaths()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L105 | neighbors=[trash-actions.ts, purgeBug(), purgeTask(), restoreBug(), restoreTask(), revalidateTrashPaths()]
- "animate_ui_stat_number_statnumber": "StatNumber()" | kind=code-symbol | source=src/components/animate-ui/stat-number.tsx:L38 | neighbors=[stat-number.tsx, useStaticNumber(), active-sprints.tsx, board-toolbar.tsx, capacity-card.tsx, directory.tsx]
- "apps_activity_test": "activity.test.ts" | kind=code-symbol | source=src/features/apps/activity.test.ts:L1 | neighbors=[activity.ts, AppActivityItem, assignmentActivityTitle(), groupActivityByDay(), mergeActivity(), relativeDayLabel()]
- "apps_mine_test": "mine.test.ts" | kind=code-symbol | source=src/features/apps/mine.test.ts:L1 | neighbors=[mine.ts, isMine(), MembershipRow, MINE_LABEL, MineKind, app()]
- "apps_repo_metadata": "repo-metadata.ts" | kind=code-symbol | source=src/features/apps/repo-metadata.ts:L1 | neighbors=[actions.ts, fetchReadme(), fetchRepoContext(), githubHeaders(), parseGitHubRepo(), RepoContext]
- "apps_tabs_boardhref": "boardHref()" | kind=code-symbol | source=src/features/apps/tabs.ts:L106 | neighbors=[activity-queries.ts, tabs.ts, tabs.test.ts, app-header.tsx, load-actions.ts, planner.ts]
- "apps_tabs_test": "tabs.test.ts" | kind=code-symbol | source=src/features/apps/tabs.test.ts:L1 | neighbors=[tabs.ts, APP_TAB_IDS, appTabHref(), AppTabId, boardHref(), normalizeAppTab()]
- "auth_capabilities_employmenttype": "EmploymentType" | kind=code-symbol | source=src/features/auth/capabilities.ts:L33 | neighbors=[bulk-actions.ts, queries.ts, capabilities.ts, employment-select.tsx, user-table.tsx, zones.test.ts]
- "bugs_bug_display_bug_statuses": "BUG_STATUSES" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L27 | neighbors=[bug-csv.ts, bug-csv.test.ts, bug-display.ts, bug-display.test.ts, report-input.ts, bug-list.tsx]
- "bugs_bug_display_bugseveritylabel": "bugSeverityLabel()" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L77 | neighbors=[actions.ts, bug-display.ts, bug-display.test.ts, search-providers.ts, bug-csv-import-dialog.tsx, bug-list.tsx]
- "bugs_bug_display_bugstatuslabel": "bugStatusLabel()" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L81 | neighbors=[actions.ts, bug-display.ts, bug-display.test.ts, search-providers.ts, bug-csv-import-dialog.tsx, bug-list.tsx]
- "bugs_report_input_bugfilters": "BugFilters" | kind=code-symbol | source=src/features/bugs/report-input.ts:L208 | neighbors=[actions.ts, page.tsx, queries.ts, queue-page.ts, report-input.ts, bug-list.tsx]
- "commit:repo:github.com/DeegayuA/LogPup@029ff459c452673889306fc02e3723ea059bfcb8": "029ff45 feat(search): worklog and activity join the palette, and two stale exem…" | kind=Commit | source=git | neighbors=[commands.ts, main, 7b6d19c docs: cost spec — gate aggregat…, commands.ts, registry.test.ts, commands.ts]
- "commit:repo:github.com/DeegayuA/LogPup@047a7e79288159a2438410a1adef2000f0497f6f": "047a7e7 feat(people): change someone's workload from their own page" | kind=Commit | source=git | neighbors=[main, e890757 test(search): and it is not sea…, assign-dialog.tsx, assignments-card.tsx, page.tsx, queries.ts]
- "commit:repo:github.com/DeegayuA/LogPup@056203d1652ab091db93a4880a82b004ed84de91": "056203d fix(worklog): stop printing the grammar legend twice on one screen" | kind=Commit | source=git | neighbors=[main, ac3c551 fix(db): usage_duration takes s…, day-hours-card.tsx, day-one-line.tsx, day-panel.tsx, entry-grammar-help.tsx]
- "commit:repo:github.com/DeegayuA/LogPup@0caca2ebf541f241382d84cf65dfdf17d79e1a36": "0caca2e feat(worklog): who may review somebody's day, and the table to put it in" | kind=Commit | source=git | neighbors=[capabilities.ts, main, a34ddfb fix(worklog): the review rule r…, 0058_worklog_reviews.sql, review-rules.ts, review-rules.test.ts]
- "commit:repo:github.com/DeegayuA/LogPup@104afee11a94484c14004c8053cae4a1f5dc5bd5": "104afee feat(dashboard): the dashboard is a list of zones, not a chain of terna…" | kind=Commit | source=git | neighbors=[page.tsx, main, e5f8bbf feat(sprints): one door for tas…, dashboard-zones.tsx, zones.ts, zones.test.ts]
- "commit:repo:github.com/DeegayuA/LogPup@17ab9cc3404857dca49a405aa3b68e3c4406a51f": "17ab9cc refactor(tasks): route sql-template status filters through OPEN_STATUSES" | kind=Commit | source=git | neighbors=[contribution-queries.ts, queries.ts, main, 563cc1c fix(live): stop blaming the use…, queries.ts, queries.test.ts]
- "commit:repo:github.com/DeegayuA/LogPup@35d16f8bb08255225428d64f6c2a7b3aa66a6f6e": "35d16f8 feat(finance): server layer for project cost, worth and margin" | kind=Commit | source=git | neighbors=[353c6e9 docs(deadlines): pre-0049 tasks…, types.ts, main, 59aa7b9 feat(search): people's cohort v…, cost.ts, queries.ts]
- "commit:repo:github.com/DeegayuA/LogPup@41d5428e651a50a31b6c24c4bbb294192c1cf2fd": "41d5428 feat(people): the short read on a person, from the page's own numbers" | kind=Commit | source=git | neighbors=[main, de769e3 refactor(csv): one RFC 4180 par…, person-summary-card.tsx, page.tsx, summary.ts, summary-actions.ts]
- "commit:repo:github.com/DeegayuA/LogPup@563cc1c07bf4d30fa592034b3ca3cf933d3c8669": "563cc1c fix(live): stop blaming the user's key for our own bugs, and try the se…" | kind=Commit | source=git | neighbors=[17ab9cc refactor(tasks): route sql-temp…, main, abcd631 feat(db): a task can have sever…, live-client.ts, live-client.test.ts, live-protocol.ts]
- "commit:repo:github.com/DeegayuA/LogPup@702dd6812255f37711bbe7620471939fb489db68": "702dd68 feat(db): takes become a thing the database knows about" | kind=Commit | source=git | neighbors=[main, 007c37f ., live.ts, live.test.ts, schema.ts, 0060_meeting_recordings.sql]
- "commit:repo:github.com/DeegayuA/LogPup@817bf89bf93772bb6d9efbf27102e0997cce996e": "817bf89 ." | kind=Commit | source=git | neighbors=[main, 00ce430 feat(fonts): bundle Noto Sans S…, recording-takes.tsx, live.test.ts, recording-actions.ts, recording-queries.ts]
- "commit:repo:github.com/DeegayuA/LogPup@8382eb689467825e00bf2d59d0187f59c6c0df32": "8382eb6 fix(worklog): project tags become links, and the amber squares get a na…" | kind=Commit | source=git | neighbors=[03e2c3f feat(deadlines): grade and orde…, main, 2e02b26 feat(worklog): suggest a person…, note-app-tags.ts, note-app-tags.test.ts, page.tsx]
- "commit:repo:github.com/DeegayuA/LogPup@8fa8f26f22d6825cf6b2209990766e334ac4cbf5": "8fa8f26 feat(worklog): the whole day in one field, showing what it heard as you…" | kind=Commit | source=git | neighbors=[main, 6c9beed test(search): the github featur…, day-one-line.tsx, day-panel.tsx, entry-language.ts, entry-language.test.ts]
- "commit:repo:github.com/DeegayuA/LogPup@c1235a27915e70c640a7190df80c4ca9c714fcf3": "c1235a2 docs(public): restore the four explanations the rewrite dropped, and th…" | kind=Commit | source=git | neighbors=[89dee50 fix(ui): craft regressions the …, main, bddbb00 fix(intel): a day you already a…, page.tsx, page.tsx, layout.tsx]
- "commit:repo:github.com/DeegayuA/LogPup@c2dbc08a0fbbde4e2ae32755b74c9096b13b37f0": "c2dbc08 fix(admin): stop approved change requests bypassing the deadline helper…" | kind=Commit | source=git | neighbors=[change-request-actions.ts, change-request-appliers.ts, change-request-appliers.test.ts, capabilities.ts, main, 353c6e9 docs(deadlines): pre-0049 tasks…]
- "commit:repo:github.com/DeegayuA/LogPup@c93474ba9aa5ab4b842d067ef46824ba1d61a34c": "c93474b feat(notifications): a scheduled tick that prunes what nobody will read" | kind=Commit | source=git | neighbors=[8d28f33 feat(notifications): dedupe, a …, main, 364f1af fix(search): ⌘K was handing eve…, live.test.ts, retention.ts, retention.test.ts]
- "commit:repo:github.com/DeegayuA/LogPup@cdc541dbfb92ce96756512e567b80285f45829b9": "cdc541d feat(deadlines): let a PM upload the plan, and check it first" | kind=Commit | source=git | neighbors=[2bd871d feat(apps): download the team, …, main, 4d94451 feat(meetings): a recurrence ru…, deadline-csv.ts, deadline-csv.test.ts, import-actions.ts]
- "commit:repo:github.com/DeegayuA/LogPup@e2820437747ba286b037c2b43b72ac3f94715bee": "e282043 feat(deadlines): grade the date column, and give it one writer" | kind=Commit | source=git | neighbors=[82d20fd docs(home): the KNOWN LIMIT par…, main, d8dbc1f test(search): declare the new f…, schema.ts, 0049_deadline_grading.sql, due-date.ts]
- "commit:repo:github.com/DeegayuA/LogPup@e5f8bbf4a87b5d7a26eda5660f84d3d652a69aad": "e5f8bbf feat(sprints): one door for task status, so completed_at cannot lie" | kind=Commit | source=git | neighbors=[104afee feat(dashboard): the dashboard …, change-request-appliers.ts, main, 8d28f33 feat(notifications): dedupe, a …, task-actions.ts, task-status.ts]
- "commit:repo:github.com/DeegayuA/LogPup@e8e9934dc598c06a530f184653abc278e36bcd3d": "e8e9934 refactor(tasks): query open work by OPEN_STATUSES, not ne(status, 'done…" | kind=Commit | source=git | neighbors=[c2bc5fd refactor(tasks): route in-memor…, main, 17ab9cc refactor(tasks): route sql-temp…, load-actions.ts, planner-actions.ts, handover-queries.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-025.json

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
