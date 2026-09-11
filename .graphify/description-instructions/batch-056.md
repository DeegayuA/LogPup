# Node Description Batch 57 of 166

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

- "admin_audit_filters_auditdepthnotice": "auditDepthNotice()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L287 | neighbors=[audit-filters.ts, audit-filters.test.ts, audit-trail.tsx]
- "admin_audit_filters_auditemptykind": "auditEmptyKind()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L243 | neighbors=[audit-filters.ts, audit-filters.test.ts, audit-trail.tsx]
- "admin_audit_filters_auditpagecount": "auditPageCount()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L256 | neighbors=[audit-filters.ts, audit-filters.test.ts, audit-trail.tsx]
- "admin_audit_filters_auditrangelabel": "auditRangeLabel()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L266 | neighbors=[audit-filters.ts, audit-filters.test.ts, audit-trail.tsx]
- "admin_audit_filters_auditsortkey": "AuditSortKey" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L28 | neighbors=[audit-filters.ts, audit-queries.ts, audit-trail.tsx]
- "admin_audit_filters_colombodayend": "colomboDayEnd()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L348 | neighbors=[audit-filters.ts, audit-filters.test.ts, audit-queries.ts]
- "admin_audit_filters_colombodaystart": "colomboDayStart()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L344 | neighbors=[audit-filters.ts, audit-filters.test.ts, audit-queries.ts]
- "admin_audit_filters_groupauditbyday": "groupAuditByDay()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L316 | neighbors=[audit-filters.ts, audit-filters.test.ts, audit-trail.tsx]
- "admin_audit_filters_shouldgroupauditbyday": "shouldGroupAuditByDay()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L299 | neighbors=[audit-filters.ts, audit-filters.test.ts, audit-trail.tsx]
- "admin_audit_nl_applyauditnlpatch": "applyAuditNlPatch()" | kind=code-symbol | source=src/features/admin/audit-nl.ts:L100 | neighbors=[audit-nl.ts, audit-nl-actions.ts, audit-nl.test.ts]
- "admin_audit_nl_auditnlschema": "auditNlSchema" | kind=code-symbol | source=src/features/admin/audit-nl.ts:L43 | neighbors=[audit-nl.ts, audit-nl-actions.ts, audit-nl.test.ts]
- "admin_audit_nl_buildauditnlprompt": "buildAuditNlPrompt()" | kind=code-symbol | source=src/features/admin/audit-nl.ts:L65 | neighbors=[audit-nl.ts, audit-nl-actions.ts, audit-nl.test.ts]
- "admin_audit_nl_isemptyauditnlpatch": "isEmptyAuditNlPatch()" | kind=code-symbol | source=src/features/admin/audit-nl.ts:L120 | neighbors=[audit-nl.ts, audit-nl-actions.ts, audit-nl.test.ts]
- "admin_audit_queries_auditconditions": "auditConditions()" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L115 | neighbors=[audit-queries.ts, auditSearchCondition(), listAuditTrail()]
- "admin_audit_queries_canreadaudit": "canReadAudit()" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L60 | neighbors=[audit-queries.ts, countAuditTrail(), listAuditTrail()]
- "admin_audit_queries_countaudittrail": "countAuditTrail()" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L230 | neighbors=[audit-queries.ts, canReadAudit(), page.tsx]
- "admin_backup_buildsnapshot": "buildSnapshot()" | kind=code-symbol | source=src/features/admin/backup.ts:L34 | neighbors=[backup.ts, danger-actions.ts, route.ts]
- "admin_bulk_actions_bulkarchiveapps": "bulkArchiveApps()" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L75 | neighbors=[bulk-actions.ts, runBatch(), apps-table.tsx]
- "admin_bulk_actions_bulkdeleteapps": "bulkDeleteApps()" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L89 | neighbors=[bulk-actions.ts, runBatch(), apps-table.tsx]
- "admin_bulk_actions_bulksetapplead": "bulkSetAppLead()" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L107 | neighbors=[bulk-actions.ts, runBatch(), apps-table.tsx]
- "admin_bulk_actions_bulksetuseractive": "bulkSetUserActive()" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L139 | neighbors=[bulk-actions.ts, runBatch(), user-table.tsx]
- "admin_bulk_actions_bulksetuseremploymenttype": "bulkSetUserEmploymentType()" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L176 | neighbors=[bulk-actions.ts, runBatch(), user-table.tsx]
- "admin_bulk_actions_bulksetuserrole": "bulkSetUserRole()" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L157 | neighbors=[bulk-actions.ts, runBatch(), user-table.tsx]
- "admin_bulk_logic_bulkreport": "BulkReport" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L96 | neighbors=[bulk-actions.ts, bulk-logic.ts, bulk-bar.tsx]
- "admin_bulk_logic_bulkresulttone": "bulkResultTone()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L153 | neighbors=[bulk-logic.ts, bulk-logic.test.ts, bulk-bar.tsx]
- "admin_bulk_logic_describebulkresult": "describeBulkResult()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L139 | neighbors=[bulk-logic.ts, bulk-logic.test.ts, bulk-bar.tsx]
- "admin_bulk_logic_groupskipreasons": "groupSkipReasons()" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L117 | neighbors=[bulk-logic.ts, bulk-logic.test.ts, bulk-bar.tsx]
- "admin_change_request_actions_createchangerequest": "createChangeRequest()" | kind=code-symbol | source=src/features/admin/change-request-actions.ts:L44 | neighbors=[change-request-actions.ts, unexpected(), request-change-dialog.tsx]
- "admin_change_request_actions_rejectchangerequest": "rejectChangeRequest()" | kind=code-symbol | source=src/features/admin/change-request-actions.ts:L166 | neighbors=[change-request-actions.ts, unexpected(), approval-actions.tsx]
- "admin_change_request_appliers_buildtaskstatusset": "buildTaskStatusSet()" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L136 | neighbors=[change-request-appliers.ts, buildApplyStatement(), asTaskStatus()]
- "admin_change_request_appliers_detectconflict": "detectConflict()" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L39 | neighbors=[change-request-actions.ts, change-request-appliers.ts, change-request-appliers.test.ts]
- "admin_change_request_appliers_issupportedentitytype": "isSupportedEntityType()" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L23 | neighbors=[change-request-actions.ts, change-request-appliers.ts, change-request-appliers.test.ts]
- "admin_change_request_queries_select": "select" | kind=code-symbol | source=src/features/admin/change-request-queries.ts:L23 | neighbors=[change-request-queries.ts, getApprovalsInbox(), getMyRequests()]
- "admin_change_request_queries_toinbox": "toInbox()" | kind=code-symbol | source=src/features/admin/change-request-queries.ts:L79 | neighbors=[change-request-queries.ts, getApprovalsInbox(), getMyRequests()]
- "admin_danger_actions_deletemeetingfromdanger": "deleteMeetingFromDanger()" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L193 | neighbors=[danger-actions.ts, revalidateDangerPaths(), danger-meeting-delete-card.tsx]
- "admin_danger_logic_backupfilename": "backupFilename()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L283 | neighbors=[danger-actions.ts, danger-logic.ts, danger-logic.test.ts]
- "admin_danger_logic_backupsummary": "backupSummary()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L99 | neighbors=[danger-logic.ts, danger-logic.test.ts, danger-backup-card.tsx]
- "admin_danger_logic_backuptoolarge": "backupTooLarge()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L273 | neighbors=[danger-actions.ts, danger-logic.ts, danger-logic.test.ts]
- "admin_danger_logic_deletemeetingsummary": "deleteMeetingSummary()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L107 | neighbors=[danger-logic.ts, danger-logic.test.ts, danger-meeting-delete-card.tsx]
- "admin_danger_logic_formatbytes": "formatBytes()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L288 | neighbors=[danger-logic.ts, danger-logic.test.ts, danger-backup-card.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-056.json

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
