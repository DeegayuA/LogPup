# Node Description Batch 1 of 166

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

- "meetings_ai_actions": "ai-actions.ts" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1 | neighbors=[trash-actions.test.ts, 3c0bc01 ., 53262eb feat(tasks): several people can…, 5a95470 fix(meetings): transcripts stop…, action-item-board.tsx, attribution-inline.tsx]
- "db_schema": "schema.ts" | kind=code-symbol | source=src/db/schema.ts:L1 | neighbors=[filters.ts, log.ts, queries.ts, actions.ts, app-grant-actions.ts, audit-queries.ts]
- "components_meeting_intel": "meeting-intel.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-intel.tsx:L1 | neighbors=[007c37f ., 2b9e5c5 feat(meetings): rebuild the rec…, 3c0bc01 ., 644d391 feat(meetings): ask before clos…, c5251d4 fix(gemini): six holes an adver…, d5b6409 .]
- "branch:repo:github.com/DeegayuA/LogPup#main": "main" | kind=Branch | source=git | neighbors=[001694a refactor(tasks): express the co…, 007c37f ., 00ce430 feat(fonts): bundle Noto Sans S…, 00d6621 fix(intel): one hung Gemini cal…, 029ff45 feat(search): worklog and activ…, 03e2c3f feat(deadlines): grade and orde…]
- "ui_button": "button.tsx" | kind=code-symbol | source=src/components/ui/button.tsx:L1 | neighbors=[error.tsx, page.tsx, error.tsx, error.tsx, error.tsx, page.tsx]
- "components_dashboard_zones": "dashboard-zones.tsx" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L1 | neighbors=[loading.tsx, page.tsx, 104afee feat(dashboard): the dashboard …, 514d33b feat(meetings): a meeting can b…, 5c7efa5 feat(meeting-load): four surfac…, queries.ts]
- "ui_button_button": "Button()" | kind=code-symbol | source=src/components/ui/button.tsx:L44 | neighbors=[error.tsx, page.tsx, error.tsx, error.tsx, error.tsx, page.tsx]
- "lib_utils": "utils.ts" | kind=code-symbol | source=src/lib/utils.ts:L1 | neighbors=[page.tsx, alta-vision-logo.tsx, action-item-board.tsx, active-sprints.tsx, admin-nav.tsx, ai-engine-card.tsx]
- "lib_utils_cn": "cn()" | kind=code-symbol | source=src/lib/utils.ts:L4 | neighbors=[page.tsx, alta-vision-logo.tsx, action-item-board.tsx, active-sprints.tsx, admin-nav.tsx, ai-engine-card.tsx]
- "people_queries": "queries.ts" | kind=code-symbol | source=src/features/people/queries.ts:L1 | neighbors=[page.tsx, page.tsx, 047a7e7 feat(people): change someone's …, 17ab9cc refactor(tasks): route sql-temp…, 2bd871d feat(apps): download the team, …, 514d33b feat(meetings): a meeting can b…]
- "slug_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/apps/[slug]/page.tsx:L1 | neighbors=[2bd871d feat(apps): download the team, …, 514d33b feat(meetings): a meeting can b…, 9f936b5 Add app aliases and auto-scored…, a4b271b Improve leave types and worklog…, d33e084 feat(finance): give the cost mo…, activity-queries.ts]
- "worklog_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L1 | neighbors=[09468aa feat(worklog): the team view ca…, 3ac9d68 ., 419d875 Unify worklog logging with AI c…, 51008f1 feat(worklog): one click fills …, 58b4984 fix(worklog): the team grid sto…, 8382eb6 fix(worklog): project tags beco…]
- "auth_capabilities": "capabilities.ts" | kind=code-symbol | source=src/features/auth/capabilities.ts:L1 | neighbors=[page.tsx, actions.ts, approval-queries.ts, audit-queries.ts, audit-queries.test.ts, bulk-actions.ts]
- "db_index": "index.ts" | kind=code-symbol | source=src/db/index.ts:L1 | neighbors=[log.ts, queries.ts, actions.ts, app-grant-actions.ts, audit-queries.ts, backup.ts]
- "db_index_db": "Db" | kind=code-symbol | source=src/db/index.ts:L10 | neighbors=[log.ts, queries.ts, actions.ts, app-grant-actions.ts, audit-queries.ts, backup.ts]
- "db_live": "live.ts" | kind=code-symbol | source=src/db/live.ts:L1 | neighbors=[queries.ts, audit-queries.ts, audit-queries.test.ts, danger-actions.ts, danger-actions.test.ts, trash-actions.ts]
- "components_user_table": "user-table.tsx" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L1 | neighbors=[0ef5142 fix(ui): correctness, responsiv…, d8efe40 feat(admin): reset a teammate's…, actions.ts, removeUser(), resetUserPassword(), setUserActive()]
- "id_page": "page.tsx" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L1 | neighbors=[047a7e7 feat(people): change someone's …, 41d5428 feat(people): the short read on…, 514d33b feat(meetings): a meeting can b…, a4b271b Improve leave types and worklog…, d70c02b fix(ui): bilingual live text su…, actor.ts]
- "components_meeting_list": "meeting-list.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-list.tsx:L1 | neighbors=[007c37f ., 3c0bc01 ., 514d33b feat(meetings): a meeting can b…, 671c254 ., add-to-calendar.tsx, icsHref()]
- "meetings_actions": "actions.ts" | kind=code-symbol | source=src/features/meetings/actions.ts:L1 | neighbors=[danger-actions.ts, 2b1ac4a feat(calendar): the organiser i…, 514d33b feat(meetings): a meeting can b…, 72473a0 feat(meetings): alt-drag a bloc…, add-to-calendar.tsx, meeting-detail-dialog.tsx]
- "components_meeting_form": "meeting-form.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L1 | neighbors=[514d33b feat(meetings): a meeting can b…, a1e0845 ., load-board.tsx, meeting-detail-dialog.tsx, add-to-calendar.tsx, icsHref()]
- "components_meetings_time_grid": "meetings-time-grid.tsx" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1 | neighbors=[72473a0 feat(meetings): alt-drag a bloc…, meetings-calendar.tsx, meeting-glance.ts, durationLabel(), MeetingTiming, meetings-month-calendar.tsx]
- "auth_actor": "actor.ts" | kind=code-symbol | source=src/features/auth/actor.ts:L1 | neighbors=[page.tsx, actions.ts, app-grant-actions.ts, audit-nl-actions.ts, bulk-actions.ts, change-request-actions.ts]
- "admin_actions": "actions.ts" | kind=code-symbol | source=src/features/admin/actions.ts:L1 | neighbors=[log.ts, logActivity(), approveUser(), approveUserInput, clearTestData(), createUser()]
- "notifications_notify": "notify.ts" | kind=code-symbol | source=src/features/notifications/notify.ts:L1 | neighbors=[comment-actions.ts, 8bacbca ., 8c996d9 feat(notifications): a mention …, 8d28f33 feat(notifications): dedupe, a …, budget-notify.ts, lifecycle.ts]
- "components_command_center": "command-center.tsx" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L1 | neighbors=[layout.tsx, 007c37f ., 3ba31df feat(shell): every admin sectio…, 3dcd417 feat(shell): collapse the sideb…, 473168b docs: restore the reasoning the…, a1e227e feat(search): a zero-hit search…]
- "lib_lk_holidays": "lk-holidays.ts" | kind=code-symbol | source=src/lib/lk-holidays.ts:L1 | neighbors=[audit-nl-actions.ts, page.tsx, queries.ts, app-activity.tsx, board.tsx, maintenance-details-dialog.tsx]
- "components_apps_table": "apps-table.tsx" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L1 | neighbors=[page.tsx, bulk-actions.ts, bulkArchiveApps(), bulkDeleteApps(), bulkSetAppLead(), bulk-logic.ts]
- "components_note_timeline": "note-timeline.tsx" | kind=code-symbol | source=src/features/meetings/components/note-timeline.tsx:L1 | neighbors=[3c0bc01 ., f823a54 feat(meetings): correct a mishe…, meeting-intel.tsx, action-item-board.tsx, ActionItemSuggestionsList(), buildAssigneePool()]
- "components_cohort_views": "cohort-views.tsx" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L1 | neighbors=[743b1f2 fix(ui): a false-positive tag m…, 8dd587b feat(people): filter and sort t…, d614dea feat(people): rank the overlaps…, app-health.ts, dayDiff(), sprintDayProgress()]
- "admin_danger_actions": "danger-actions.ts" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L1 | neighbors=[log.ts, logActivity(), backup.ts, buildSnapshot(), encryptSnapshot(), BackupDownload]
- "db_schema_users": "users" | kind=code-symbol | source=src/db/schema.ts:L130 | neighbors=[queries.ts, actions.ts, audit-queries.ts, audit-queries.test.ts, backup.ts, bulk-actions.ts]
- "components_day_hours_card": "day-hours-card.tsx" | kind=code-symbol | source=src/features/worklog/components/day-hours-card.tsx:L1 | neighbors=[056203d fix(worklog): stop printing the…, 1b4f4ee feat(worklog): log an hour by w…, 3c0bc01 ., 3ed16a6 feat(worklog): fix an entry's k…, 51008f1 feat(worklog): one click fills …, 695a047 fix(worklog): one fill button, …]
- "components_action_item_board": "action-item-board.tsx" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L1 | neighbors=[3c0bc01 ., f823a54 feat(meetings): correct a mishe…, ActionItemActions, ActionItemAssignee(), ActionItemDueDate(), ActionItemSuggestionsList()]
- "sprints_task_actions": "task-actions.ts" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L1 | neighbors=[2865231 feat(deadlines): route all thre…, 3c0bc01 ., 53262eb feat(tasks): several people can…, e5f8bbf feat(sprints): one door for tas…, action-item-board.tsx, board.tsx]
- "components_meeting_notes": "meeting-notes.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-notes.tsx:L1 | neighbors=[3c0bc01 ., e2090c6 feat(meetings): "Not tracked" r…, f823a54 feat(meetings): correct a mishe…, meeting-intel.tsx, action-item-board.tsx, ActionItemAssignee()]
- "components_roadmap_timeline": "roadmap-timeline.tsx" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L1 | neighbors=[roadmap.tsx, ActiveDrag, BarBody(), BarMeta(), BarMetaLevel, buildTicks()]
- "gemini_client": "client.ts" | kind=code-symbol | source=src/features/gemini/client.ts:L1 | neighbors=[audit-nl-actions.ts, actions.ts, 00d6621 fix(intel): one hung Gemini cal…, 59873cc feat(gemini): a monthly AI budg…, f8a9b00 feat(gemini): the meter learns …, actions.ts]
- "worklog_queries": "queries.ts" | kind=code-symbol | source=src/features/worklog/queries.ts:L1 | neighbors=[09468aa feat(worklog): the team view ca…, 8382eb6 fix(worklog): project tags beco…, 9f936b5 Add app aliases and auto-scored…, a4b271b Improve leave types and worklog…, ce0fabf feat(worklog): a refused day of…, catch-up-panel.tsx]
- "components_log_box": "log-box.tsx" | kind=code-symbol | source=src/features/worklog/components/log-box.tsx:L1 | neighbors=[3ac9d68 ., 419d875 Unify worklog logging with AI c…, 9f936b5 Add app aliases and auto-scored…, app-aliases.ts, AliasedApp, ai-meter-provider.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-000.json

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
