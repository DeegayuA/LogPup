# Node Description Batch 35 of 166

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

- "admin_audit_filters_clearauditfiltershref": "clearAuditFiltersHref()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L220 | neighbors=[audit-filters.ts, auditQueryString(), clearedAuditState(), audit-filters.test.ts, audit-trail.tsx]
- "admin_audit_filters_hasauditfilters": "hasAuditFilters()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L209 | neighbors=[audit-filters.ts, audit-filters.test.ts, page.tsx, audit-filter-bar.tsx, audit-trail.tsx]
- "admin_bulk_logic_csvfilename": "csvFilename()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L191 | neighbors=[bulk-logic.ts, bulk-logic.test.ts, bug-csv.ts, csv-download.ts, deadline-csv.ts]
- "admin_bulk_logic_headerselectionstate": "headerSelectionState()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L69 | neighbors=[bulk-logic.ts, bulk-logic.test.ts, apps-table.tsx, trash-card.tsx, user-table.tsx]
- "admin_bulk_logic_pruneselection": "pruneSelection()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L82 | neighbors=[bulk-logic.ts, bulk-logic.test.ts, apps-table.tsx, trash-card.tsx, user-table.tsx]
- "admin_bulk_logic_toggleallselected": "toggleAllSelected()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L58 | neighbors=[bulk-logic.ts, bulk-logic.test.ts, apps-table.tsx, trash-card.tsx, user-table.tsx]
- "admin_change_request_actions_unexpected": "unexpected()" | kind=code-symbol | source=src/features/admin/change-request-actions.ts:L19 | neighbors=[change-request-actions.ts, approveChangeRequest(), createChangeRequest(), rejectChangeRequest(), withdrawChangeRequest()]
- "admin_danger_actions_revalidatedangerpaths": "revalidateDangerPaths()" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L65 | neighbors=[danger-actions.ts, deleteMeetingFromDanger(), emptyTrash(), resetApp(), wipeMeetingRecordings()]
- "admin_danger_logic_matchesconfirm": "matchesConfirm()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L47 | neighbors=[danger-actions.ts, danger-logic.ts, normalizeConfirm(), danger-logic.test.ts, danger-confirm-control.tsx]
- "admin_sections_visiblesections": "visibleSections()" | kind=code-symbol | source=src/features/admin/sections.ts:L105 | neighbors=[layout.tsx, page.tsx, sections.ts, sections.test.ts, layout.tsx]
- "admin_set_user_personal_email_test": "set-user-personal-email.test.ts" | kind=code-symbol | source=src/features/admin/set-user-personal-email.test.ts:L1 | neighbors=[actions.ts, asAdmin(), asMember(), { authMock, writeSpy }, personal-email-schema.ts]
- "admin_set_user_title_test": "set-user-title.test.ts" | kind=code-symbol | source=src/features/admin/set-user-title.test.ts:L1 | neighbors=[actions.ts, asAdmin(), asMember(), { authMock, writeSpy }, job-roles.ts]
- "admin_trash_actions_purgeapp": "purgeApp()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L584 | neighbors=[danger-actions.ts, trash-actions.ts, checkConfirm(), revalidateTrashPaths(), trash-row-actions.tsx]
- "admin_trash_actions_purgekeyframe": "purgeKeyframe()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L800 | neighbors=[danger-actions.ts, trash-actions.ts, checkConfirm(), revalidateTrashPaths(), trash-row-actions.tsx]
- "admin_trash_actions_purgesegment": "purgeSegment()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L763 | neighbors=[danger-actions.ts, trash-actions.ts, checkConfirm(), revalidateTrashPaths(), trash-row-actions.tsx]
- "admin_trash_actions_purgetask": "purgeTask()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L702 | neighbors=[danger-actions.ts, trash-actions.ts, checkConfirm(), revalidateAppEntityTrashPaths(), trash-row-actions.tsx]
- "admin_trash_actions_revalidatemeetingtrashpaths": "revalidateMeetingTrashPaths()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L98 | neighbors=[trash-actions.ts, purgeMeeting(), restoreMeeting(), revalidateTrashPaths(), slugForApp()]
- "admin_trash_grouping_trashrow": "TrashRow" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L39 | neighbors=[danger-actions.test.ts, danger-logic.test.ts, trash-grouping.ts, trash-card.tsx, trash-card-logic.ts]
- "apps_app_aliases_deriveacronyms": "deriveAcronyms()" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L78 | neighbors=[app-aliases.ts, appPromptLine(), words(), matchApp(), app-aliases.test.ts]
- "apps_app_health_appsprintsnapshot": "AppSprintSnapshot" | kind=code-symbol | source=src/features/apps/app-health.ts:L44 | neighbors=[app-health.ts, app-health.test.ts, queries.ts, app-sprint-band.tsx, page.tsx]
- "apps_app_health_appstatus": "AppStatus" | kind=code-symbol | source=src/features/apps/app-health.ts:L33 | neighbors=[app-health.ts, browse.ts, update-input.ts, app-card.tsx, app-header.tsx]
- "apps_app_health_healthlevel": "HealthLevel" | kind=code-symbol | source=src/features/apps/app-health.ts:L182 | neighbors=[app-health.ts, app-card.tsx, dashboard-zones.tsx, health-dot.tsx, planner.ts]
- "apps_browse_browsehref": "browseHref()" | kind=code-symbol | source=src/features/apps/browse.ts:L142 | neighbors=[browse.ts, browse.test.ts, page.tsx, apps-browser.tsx, dashboard-zones.tsx]
- "apps_browse_parsebrowseparams": "parseBrowseParams()" | kind=code-symbol | source=src/features/apps/browse.ts:L108 | neighbors=[browse.ts, firstValue(), browse.test.ts, page.tsx, dashboard-zones.tsx]
- "apps_queries_getappcounts": "getAppCounts()" | kind=code-symbol | source=src/features/apps/queries.ts:L421 | neighbors=[queries.ts, countWhere(), emptyTaskCounts(), latest(), page.tsx]
- "auth_capabilities_employment_types": "EMPLOYMENT_TYPES" | kind=code-symbol | source=src/features/auth/capabilities.ts:L32 | neighbors=[actions.ts, bulk-actions.ts, capabilities.ts, capabilities.test.ts, employment-select.tsx]
- "auth_capabilities_rolelabel": "roleLabel()" | kind=code-symbol | source=src/features/auth/capabilities.ts:L463 | neighbors=[capabilities.ts, capabilities.test.ts, page.tsx, page.tsx, account-menu.tsx]
- "auth_commands": "commands.ts" | kind=code-symbol | source=src/features/auth/commands.ts:L1 | neighbors=[commands, types.ts, CommandDescriptor, actions.ts, commands.ts]
- "auth_google_one_tap": "google-one-tap.ts" | kind=code-symbol | source=src/features/auth/google-one-tap.ts:L1 | neighbors=[GoogleIdentity, TokenInfo, VALID_ISSUERS, verifyGoogleIdToken(), auth.ts]
- "auth_personal_email_schema": "personal-email-schema.ts" | kind=code-symbol | source=src/features/auth/personal-email-schema.ts:L1 | neighbors=[actions.ts, set-user-personal-email.test.ts, personalEmailInput, add-user-dialog.tsx, user-table.tsx]
- "auth_webauthn_actions_completepasskeylogin": "completePasskeyLogin()" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L208 | neighbors=[webauthn-actions.ts, relyingParty(), sha256(), takeChallengeCookie(), passkey-login-button.tsx]
- "auth_webauthn_actions_relyingparty": "relyingParty()" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L48 | neighbors=[webauthn-actions.ts, beginPasskeyLogin(), beginPasskeyRegistration(), completePasskeyLogin(), completePasskeyRegistration()]
- "backup_route": "route.ts" | kind=code-symbol | source=src/app/api/cron/backup/route.ts:L1 | neighbors=[backup.ts, buildSnapshot(), encryptSnapshot(), GET(), isAuthorized()]
- "bugs_actions_revalidatebug": "revalidateBug()" | kind=code-symbol | source=src/features/bugs/actions.ts:L48 | neighbors=[actions.ts, deleteBug(), reportBug(), triageBug(), updateBugContent()]
- "bugs_bug_csv_parsebugcsv": "parseBugCsv()" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L484 | neighbors=[bug-csv.ts, isTemplateExampleRow(), validateBugCsvRow(), bug-csv.test.ts, import-actions.ts]
- "bugs_bug_csv_validatebugcsvrow": "validateBugCsvRow()" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L384 | neighbors=[bug-csv.ts, parseBugCsv(), bug-csv.test.ts, fieldReason(), normalizeValue()]
- "bugs_bug_display_bug_severities": "BUG_SEVERITIES" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L23 | neighbors=[bug-csv.ts, bug-csv.test.ts, bug-display.ts, bug-display.test.ts, report-input.ts]
- "bugs_bug_display_open_bug_statuses": "OPEN_BUG_STATUSES" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L44 | neighbors=[bug-display.ts, bug-display.test.ts, page.tsx, queries.ts, queue-page.ts]
- "bugs_import_actions_importbugcsvrows": "importBugCsvRows()" | kind=code-symbol | source=src/features/bugs/import-actions.ts:L246 | neighbors=[import-actions.ts, resolveImport(), revalidateBugs(), unexpected(), bug-csv-import-dialog.tsx]
- "calendar_google_calendar_client": "client()" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L3 | neighbors=[google-calendar.ts, createCalendarEvent(), deleteCalendarEvent(), updateCalendarEvent(), updateCalendarEventTime()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-034.json

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
