# Node Description Batch 81 of 166

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

- "worklog_queries_listallliveappsforpicker": "listAllLiveAppsForPicker()" | kind=code-symbol | source=src/features/worklog/queries.ts:L154 | neighbors=[catch-up-actions.ts, page.tsx, queries.ts]
- "worklog_queries_myabsence": "MyAbsence" | kind=code-symbol | source=src/features/worklog/queries.ts:L221 | neighbors=[declare-absence-dialog.tsx, pending-absence-list.tsx, queries.ts]
- "worklog_schedules_schedulerow": "ScheduleRow" | kind=code-symbol | source=src/features/worklog/schedules.ts:L55 | neighbors=[nudge-queries.ts, queries.ts, schedules.ts]
- "activity_actions_colombodayend": "colomboDayEnd()" | kind=code-symbol | source=src/features/activity/actions.ts:L74 | neighbors=[actions.ts, loadOlderActivity()]
- "activity_actions_colombodaystart": "colomboDayStart()" | kind=code-symbol | source=src/features/activity/actions.ts:L71 | neighbors=[actions.ts, loadOlderActivity()]
- "activity_commands_commands": "commands" | kind=code-symbol | source=src/features/activity/commands.ts:L40 | neighbors=[commands.ts, commands.ts]
- "activity_page_activitypage": "ActivityPage()" | kind=code-symbol | source=src/app/(app)/activity/page.tsx:L107 | neighbors=[page.tsx, paramState()]
- "activity_page_colombodayend": "colomboDayEnd()" | kind=code-symbol | source=src/app/(app)/activity/page.tsx:L91 | neighbors=[page.tsx, ActivityTrailSection()]
- "activity_page_colombodaystart": "colomboDayStart()" | kind=code-symbol | source=src/app/(app)/activity/page.tsx:L88 | neighbors=[page.tsx, ActivityTrailSection()]
- "activity_page_paramstate": "paramState()" | kind=code-symbol | source=src/app/(app)/activity/page.tsx:L96 | neighbors=[page.tsx, ActivityPage()]
- "activity_queries_listactivityactors": "listActivityActors" | kind=code-symbol | source=src/features/activity/queries.ts:L75 | neighbors=[page.tsx, queries.ts]
- "activity_queries_listactivityapps": "listActivityApps" | kind=code-symbol | source=src/features/activity/queries.ts:L85 | neighbors=[page.tsx, queries.ts]
- "activity_queries_listrecentactivity": "listRecentActivity" | kind=code-symbol | source=src/features/activity/queries.ts:L106 | neighbors=[queries.ts, dashboard-zones.tsx]
- "activity_types_activity_verbs": "ACTIVITY_VERBS" | kind=code-symbol | source=src/features/activity/types.ts:L53 | neighbors=[types.ts, audit-nl.ts]
- "activity_types_activityinput": "ActivityInput" | kind=code-symbol | source=src/features/activity/types.ts:L77 | neighbors=[log.ts, types.ts]
- "admin_actions_dbclearenabled": "dbClearEnabled()" | kind=code-symbol | source=src/features/admin/actions.ts:L30 | neighbors=[actions.ts, clearTestData()]
- "admin_actions_duplicateusermessage": "duplicateUserMessage()" | kind=code-symbol | source=src/features/admin/actions.ts:L462 | neighbors=[actions.ts, createUser()]
- "admin_actions_isuniqueviolation": "isUniqueViolation()" | kind=code-symbol | source=src/features/admin/actions.ts:L150 | neighbors=[actions.ts, removeUser()]
- "admin_audit_filters_audit_sort_keys": "AUDIT_SORT_KEYS" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L27 | neighbors=[audit-filters.ts, audit-trail.tsx]
- "admin_audit_filters_audit_sort_labels": "AUDIT_SORT_LABELS" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L33 | neighbors=[audit-filters.ts, audit-trail.tsx]
- "admin_audit_filters_auditsortdir": "AuditSortDir" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L31 | neighbors=[audit-filters.ts, audit-queries.ts]
- "admin_audit_filters_first": "first()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L119 | neighbors=[audit-filters.ts, parseAuditParams()]
- "admin_audit_filters_rawsearchparams": "RawSearchParams" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L117 | neighbors=[audit-filters.ts, page.tsx]
- "admin_audit_filters_swapifbackwards": "swapIfBackwards()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L156 | neighbors=[audit-filters.ts, parseAuditParams()]
- "admin_audit_nl_actions_askauditfilters": "askAuditFilters()" | kind=code-symbol | source=src/features/admin/audit-nl-actions.ts:L52 | neighbors=[audit-nl-actions.ts, audit-ask.tsx]
- "admin_audit_queries_auditentry": "AuditEntry" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L17 | neighbors=[audit-queries.ts, audit-trail.tsx]
- "admin_audit_queries_auditfacets": "AuditFacets" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L236 | neighbors=[audit-queries.ts, audit-filter-bar.tsx]
- "admin_audit_queries_auditorderby": "auditOrderBy()" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L141 | neighbors=[audit-queries.ts, listAuditTrail()]
- "admin_audit_queries_auditpage": "AuditPage" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L35 | neighbors=[audit-queries.ts, audit-trail.tsx]
- "admin_audit_queries_auditsearchcondition": "auditSearchCondition()" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L84 | neighbors=[audit-queries.ts, auditConditions()]
- "admin_audit_queries_listauditfacets": "listAuditFacets" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L254 | neighbors=[audit-queries.ts, page.tsx]
- "admin_audit_queries_listrecentaudit": "listRecentAudit()" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L285 | neighbors=[audit-queries.ts, listAuditTrail()]
- "admin_backup_encryptionkey": "encryptionKey()" | kind=code-symbol | source=src/features/admin/backup.ts:L11 | neighbors=[backup.ts, encryptSnapshot()]
- "admin_bulk_logic_bulknouns": "BulkNouns" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L129 | neighbors=[bulk-logic.ts, bulk-bar.tsx]
- "admin_bulk_logic_csvcell": "csvCell()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L173 | neighbors=[bulk-logic.ts, bulk-logic.test.ts]
- "admin_bulk_logic_headerstate": "HeaderState" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L67 | neighbors=[bulk-logic.ts, bulk-select.tsx]
- "admin_bulk_logic_isselected": "isSelected()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L20 | neighbors=[bulk-logic.ts, bulk-logic.test.ts]
- "admin_change_request_actions_currentrowfor": "currentRowFor()" | kind=code-symbol | source=src/features/admin/change-request-actions.ts:L238 | neighbors=[change-request-actions.ts, approveChangeRequest()]
- "admin_change_request_actions_withdrawchangerequest": "withdrawChangeRequest()" | kind=code-symbol | source=src/features/admin/change-request-actions.ts:L213 | neighbors=[change-request-actions.ts, unexpected()]
- "admin_change_request_appliers_asisodate": "asIsoDate()" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L165 | neighbors=[change-request-appliers.ts, buildTaskDeadlineSet()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-080.json

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
