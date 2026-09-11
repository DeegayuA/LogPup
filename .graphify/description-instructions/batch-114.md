# Node Description Batch 115 of 166

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

- "admin_backup_backupusercolumns": "backupUserColumns" | kind=code-symbol | source=src/features/admin/backup.ts:L22 | neighbors=[backup.ts]
- "admin_bulk_actions_activeinput": "activeInput" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L127 | neighbors=[bulk-actions.ts]
- "admin_bulk_actions_employmentbulkinput": "employmentBulkInput" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L171 | neighbors=[bulk-actions.ts]
- "admin_bulk_actions_idsinput": "idsInput" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L38 | neighbors=[bulk-actions.ts]
- "admin_bulk_actions_leadinput": "leadInput" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L101 | neighbors=[bulk-actions.ts]
- "admin_bulk_actions_rolebulkinput": "roleBulkInput" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L152 | neighbors=[bulk-actions.ts]
- "admin_bulk_actions_test_asadmin": "asAdmin()" | kind=code-symbol | source=src/features/admin/bulk-actions.test.ts:L66 | neighbors=[bulk-actions.test.ts]
- "admin_bulk_actions_test_asnobody": "asNobody()" | kind=code-symbol | source=src/features/admin/bulk-actions.test.ts:L68 | neighbors=[bulk-actions.test.ts]
- "admin_bulk_actions_test_ok": "OK" | kind=code-symbol | source=src/features/admin/bulk-actions.test.ts:L63 | neighbors=[bulk-actions.test.ts]
- "admin_bulk_actions_test_refuse": "refuse()" | kind=code-symbol | source=src/features/admin/bulk-actions.test.ts:L64 | neighbors=[bulk-actions.test.ts]
- "admin_bulk_actions_test_requirecapabilitymock_archiveappmock_deleteappmock_updateappmock_setuseractivemock_setuserrolemock_setuseremploymenttypemock_supervisorrowsmock": "{\r\n  requireCapabilityMock,\r\n  archiveAppMock,\r\n  deleteAppMock,\r\n  updateAppMo…" | kind=code-symbol | source=src/features/admin/bulk-actions.test.ts:L13 | neighbors=[bulk-actions.test.ts]
- "admin_bulk_logic_bulkskip": "BulkSkip" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L94 | neighbors=[bulk-logic.ts]
- "admin_bulk_logic_selection": "Selection" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L18 | neighbors=[bulk-logic.ts]
- "admin_bulk_logic_test_apps": "APPS" | kind=code-symbol | source=src/features/admin/bulk-logic.test.ts:L19 | neighbors=[bulk-logic.test.ts]
- "admin_change_request_actions_createinput": "createInput" | kind=code-symbol | source=src/features/admin/change-request-actions.ts:L24 | neighbors=[change-request-actions.ts]
- "admin_change_request_actions_reviewinput": "reviewInput" | kind=code-symbol | source=src/features/admin/change-request-actions.ts:L82 | neighbors=[change-request-actions.ts]
- "admin_change_request_appliers_tables": "TABLES" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L54 | neighbors=[change-request-appliers.ts]
- "admin_change_request_appliers_task_statuses": "TASK_STATUSES" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L155 | neighbors=[change-request-appliers.ts]
- "admin_change_request_routing_reviewablerequest": "ReviewableRequest" | kind=code-symbol | source=src/features/admin/change-request-routing.ts:L3 | neighbors=[change-request-routing.ts]
- "admin_change_request_routing_test_actor": "actor()" | kind=code-symbol | source=src/features/admin/change-request-routing.test.ts:L5 | neighbors=[change-request-routing.test.ts]
- "admin_change_request_routing_test_request": "request()" | kind=code-symbol | source=src/features/admin/change-request-routing.test.ts:L8 | neighbors=[change-request-routing.test.ts]
- "admin_clear_test_data_test_assuperadmin": "asSuperadmin()" | kind=code-symbol | source=src/features/admin/clear-test-data.test.ts:L64 | neighbors=[clear-test-data.test.ts]
- "admin_clear_test_data_test_authmock_deletespy": "{ authMock, deleteSpy }" | kind=code-symbol | source=src/features/admin/clear-test-data.test.ts:L26 | neighbors=[clear-test-data.test.ts]
- "admin_clear_test_data_test_confirmform": "confirmForm()" | kind=code-symbol | source=src/features/admin/clear-test-data.test.ts:L55 | neighbors=[clear-test-data.test.ts]
- "admin_clear_test_data_test_deletedtables": "deletedTables()" | kind=code-symbol | source=src/features/admin/clear-test-data.test.ts:L53 | neighbors=[clear-test-data.test.ts]
- "admin_danger_actions_backupdownload": "BackupDownload" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L105 | neighbors=[danger-actions.ts]
- "admin_danger_actions_dangertargets": "DangerTargets" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L482 | neighbors=[danger-actions.ts]
- "admin_danger_actions_purge_by_kind": "PURGE_BY_KIND" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L399 | neighbors=[danger-actions.ts]
- "admin_danger_actions_test_asmember": "asMember()" | kind=code-symbol | source=src/features/admin/danger-actions.test.ts:L153 | neighbors=[danger-actions.test.ts]
- "admin_danger_actions_test_assuperadmin": "asSuperadmin()" | kind=code-symbol | source=src/features/admin/danger-actions.test.ts:L151 | neighbors=[danger-actions.test.ts]
- "admin_danger_actions_test_authmock_logactivitymock_gettrashmock_buildsnapshotmock_encryptsnapshotmock_deletemeetingmock_purgespies_reads_updatecalls_fakedb": "{\r\n  authMock,\r\n  logActivityMock,\r\n  getTrashMock,\r\n  buildSnapshotMock,\r\n  en…" | kind=code-symbol | source=src/features/admin/danger-actions.test.ts:L22 | neighbors=[danger-actions.test.ts]
- "admin_danger_actions_test_purgeorder": "purgeOrder()" | kind=code-symbol | source=src/features/admin/danger-actions.test.ts:L140 | neighbors=[danger-actions.test.ts]
- "admin_danger_actions_test_seedboard": "seedBoard()" | kind=code-symbol | source=src/features/admin/danger-actions.test.ts:L287 | neighbors=[danger-actions.test.ts]
- "admin_danger_actions_test_seedkeyframes": "seedKeyframes()" | kind=code-symbol | source=src/features/admin/danger-actions.test.ts:L352 | neighbors=[danger-actions.test.ts]
- "admin_danger_actions_test_seedmeeting": "seedMeeting()" | kind=code-symbol | source=src/features/admin/danger-actions.test.ts:L391 | neighbors=[danger-actions.test.ts]
- "admin_danger_actions_test_trashgroup": "trashGroup()" | kind=code-symbol | source=src/features/admin/danger-actions.test.ts:L135 | neighbors=[danger-actions.test.ts]
- "admin_danger_actions_test_trashrow": "trashRow()" | kind=code-symbol | source=src/features/admin/danger-actions.test.ts:L123 | neighbors=[danger-actions.test.ts]
- "admin_danger_actions_uuidinput": "uuidInput" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L61 | neighbors=[danger-actions.ts]
- "admin_danger_logic_test_group": "group()" | kind=code-symbol | source=src/features/admin/danger-logic.test.ts:L42 | neighbors=[danger-logic.test.ts]
- "admin_danger_logic_test_row": "row()" | kind=code-symbol | source=src/features/admin/danger-logic.test.ts:L30 | neighbors=[danger-logic.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-114.json

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
