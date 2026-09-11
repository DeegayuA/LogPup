# Node Description Batch 23 of 166

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

- "speech_chunk_speech": "chunk-speech.ts" | kind=code-symbol | source=src/features/speech/chunk-speech.ts:L1 | neighbors=[2607f59 fix(speech): read-aloud budgets…, actions.ts, chunkForSpeech(), cutAt(), effectiveSpeechLength(), rawLimitFor()]
- "speech_spoken_text": "spoken-text.ts" | kind=code-symbol | source=src/features/speech/spoken-text.ts:L1 | neighbors=[2607f59 fix(speech): read-aloud budgets…, use-speech.ts, actions.ts, chunk-speech.ts, rawLimitFor(), sinhalaFraction()]
- "sprints_actions_slugforapp": "slugForApp()" | kind=code-symbol | source=src/features/sprints/actions.ts:L76 | neighbors=[actions.ts, createSprint(), deleteSprint(), renameSprint(), reorderSprint(), resortSprintsByDate()]
- "sprints_assignment_notice": "assignment-notice.ts" | kind=code-symbol | source=src/features/sprints/assignment-notice.ts:L1 | neighbors=[04583d8 feat(sprints): the words a task…, AssignmentInput, AssignmentNotice, buildAssignmentNotice(), clip(), shouldNotifyAssignee()]
- "sprints_checkins_checkingap": "CheckinGap" | kind=code-symbol | source=src/features/sprints/checkins.ts:L54 | neighbors=[meeting-prep.tsx, sprint-checkin-editor.tsx, sprint-checkins.tsx, ask-derivation.ts, notes.ts, planner.ts]
- "sprints_due_date_test": "due-date.test.ts" | kind=code-symbol | source=src/features/sprints/due-date.test.ts:L1 | neighbors=[353c6e9 docs(deadlines): pre-0049 tasks…, e282043 feat(deadlines): grade the date…, due-date.ts, applyDueDate(), DueDateError, DueState]
- "sprints_roadmap_geometry": "roadmap-geometry.ts" | kind=code-symbol | source=src/features/sprints/roadmap-geometry.ts:L1 | neighbors=[addDays(), daysFromOffset(), diffDaysInclusive(), parseIsoDate(), resizeEnd(), resizeStart()]
- "transcription_live_protocol_test": "live-protocol.test.ts" | kind=code-symbol | source=src/features/transcription/live-protocol.test.ts:L1 | neighbors=[563cc1c fix(live): stop blaming the use…, e73a38e fix(live): mint tokens with the…, live-protocol.ts, buildAudioMessage(), buildAuthTokenRequest(), buildSetupMessage()]
- "trash_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/admin/trash/page.tsx:L1 | neighbors=[trash-queries.ts, getTrash(), actor.ts, loadActor, capabilities.ts, can()]
- "ui_button_buttonvariants": "buttonVariants" | kind=code-symbol | source=src/components/ui/button.tsx:L7 | neighbors=[meeting-list.tsx, meeting-rsvp.tsx, roadmap-timeline.tsx, sprint-edit-dialog.tsx, page.tsx, page.tsx]
- "ui_dropdown_menu_dropdownmenu": "DropdownMenu()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L9 | neighbors=[add-to-calendar.tsx, board-bulk-bar.tsx, board-toolbar.tsx, meeting-list.tsx, notification-bell-client.tsx, card-quick-menu.tsx]
- "ui_dropdown_menu_dropdownmenucontent": "DropdownMenuContent()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L21 | neighbors=[add-to-calendar.tsx, board-bulk-bar.tsx, board-toolbar.tsx, meeting-list.tsx, notification-bell-client.tsx, card-quick-menu.tsx]
- "ui_dropdown_menu_dropdownmenutrigger": "DropdownMenuTrigger()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L17 | neighbors=[add-to-calendar.tsx, board-bulk-bar.tsx, board-toolbar.tsx, meeting-list.tsx, notification-bell-client.tsx, card-quick-menu.tsx]
- "ui_kbd": "kbd.tsx" | kind=code-symbol | source=src/components/ui/kbd.tsx:L1 | neighbors=[ask-bubble.tsx, ask-panel.tsx, command-center.tsx, signal-board.tsx, shortcuts-overlay.tsx, sidebar.tsx]
- "ui_tooltip": "tooltip.tsx" | kind=code-symbol | source=src/components/ui/tooltip.tsx:L1 | neighbors=[gemini-keys-card.tsx, meeting-intel-sheet.tsx, meeting-list.tsx, utils.ts, cn(), Tooltip()]
- "worklog_day_app_mix": "day-app-mix.ts" | kind=code-symbol | source=src/features/worklog/day-app-mix.ts:L1 | neighbors=[e38a385 feat(worklog): what a logged da…, progress-matrix.tsx, buildDayMix(), buildMixLegend(), DayEntry, LegendEntry]
- "worklog_draft_prompt": "draft-prompt.ts" | kind=code-symbol | source=src/features/worklog/draft-prompt.ts:L1 | neighbors=[dda9cf6 feat(worklog): the AI draft kno…, draft-actions.ts, project-roles.ts, ProjectRoleTone, buildWorklogDraftPrompt(), DraftActivity]
- "worklog_entries_entrycategory": "EntryCategory" | kind=code-symbol | source=src/features/worklog/entries.ts:L20 | neighbors=[day-hours-card.tsx, entry-grammar-help.tsx, catch-up-parse.ts, entries.ts, entry-check.ts, entry-draft-prompt.ts]
- "worklog_nudge": "nudge.ts" | kind=code-symbol | source=src/features/worklog/nudge.ts:L1 | neighbors=[9f936b5 Add app aliases and auto-scored…, route.ts, missing-days.ts, nudgeBody(), NudgeInput, planWorklogNudges()]
- "worklog_review_rules_test": "review-rules.test.ts" | kind=code-symbol | source=src/features/worklog/review-rules.test.ts:L1 | neighbors=[0caca2e feat(worklog): who may review s…, capabilities.ts, Actor, UserRole, review-rules.ts, canReviewWorklogDay()]
- "worklog_schedules_patternforday": "patternForDay()" | kind=code-symbol | source=src/features/worklog/schedules.ts:L68 | neighbors=[auto-score-sync.ts, catch-up-actions.ts, coverage-queries.ts, entry-evidence.ts, nudge-queries.ts, page.tsx]
- "activity_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/activity/loading.tsx:L1 | neighbors=[LoadingActivity(), activity-skeleton.tsx, ActivityControlsSkeleton(), ActivityTrailSkeleton(), skeleton.tsx, Skeleton()]
- "admin_approval_badge_test": "approval-badge.test.ts" | kind=code-symbol | source=src/features/admin/approval-badge.test.ts:L1 | neighbors=[approval-badge.ts, approvalBadgeLabel(), approvalBadgeText(), approvalTotal(), NO_APPROVALS, showApprovals()]
- "admin_audit_filters_parseauditparams": "parseAuditParams()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L124 | neighbors=[audit-filters.ts, defaultAuditDir(), first(), swapIfBackwards(), audit-filters.test.ts, audit-nl-actions.ts]
- "admin_audit_nl_test": "audit-nl.test.ts" | kind=code-symbol | source=src/features/admin/audit-nl.test.ts:L1 | neighbors=[audit-filters.ts, parseAuditParams(), audit-nl.ts, applyAuditNlPatch(), auditNlSchema, buildAuditNlPrompt()]
- "admin_change_request_routing": "change-request-routing.ts" | kind=code-symbol | source=src/features/admin/change-request-routing.ts:L1 | neighbors=[change-request-actions.ts, change-request-queries.ts, mayReview(), ReviewableRequest, capabilities.ts, Actor]
- "admin_change_request_routing_test": "change-request-routing.test.ts" | kind=code-symbol | source=src/features/admin/change-request-routing.test.ts:L1 | neighbors=[change-request-routing.ts, mayReview(), actor(), request(), capabilities.ts, Actor]
- "admin_sections_test": "sections.test.ts" | kind=code-symbol | source=src/features/admin/sections.test.ts:L1 | neighbors=[sections.ts, ADMIN_SECTIONS, actor(), hrefs(), visibleSections(), capabilities.ts]
- "admin_trash_actions_checkconfirm": "checkConfirm()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L571 | neighbors=[trash-actions.ts, purgeApp(), purgeBug(), purgeKeyframe(), purgeMeeting(), purgeSegment()]
- "admin_trash_actions_slugforapp": "slugForApp()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L55 | neighbors=[trash-actions.ts, purgeBug(), purgeSprint(), restoreAssignment(), restoreBug(), restoreSprint()]
- "admin_trash_grouping_trashgroup": "TrashGroup" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L54 | neighbors=[danger-actions.test.ts, danger-logic.ts, danger-logic.test.ts, trash-grouping.ts, trash-queries.ts, trash-card.tsx]
- "admin_trash_grouping_trashkind": "TrashKind" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L37 | neighbors=[danger-actions.ts, danger-actions.test.ts, danger-logic.ts, danger-logic.test.ts, trash-grouping.ts, trash-card.tsx]
- "apps_app_aliases_matchapp": "matchApp()" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L150 | neighbors=[app-aliases.ts, appVocabulary(), containsWord(), deriveAcronyms(), typoBudget(), words()]
- "apps_app_health_completionpct": "completionPct()" | kind=code-symbol | source=src/features/apps/app-health.ts:L137 | neighbors=[app-health.ts, AppHealth, app-health.test.ts, browse.ts, app-card.tsx, app-header.tsx]
- "apps_app_health_daydiff": "dayDiff()" | kind=code-symbol | source=src/features/apps/app-health.ts:L78 | neighbors=[activity.ts, app-health.ts, utcMs(), daysSince(), inclusiveDayCount(), sprintDayProgress()]
- "apps_mine": "mine.ts" | kind=code-symbol | source=src/features/apps/mine.ts:L1 | neighbors=[isMine(), MembershipRow, MINE_LABEL, MineKind, mine.test.ts, e594a52 feat(apps): each app carries it…]
- "auth_enforcement_test": "enforcement.test.ts" | kind=code-symbol | source=src/features/auth/enforcement.test.ts:L1 | neighbors=[actor.ts, as(), authMock, chain(), deleteSpy, insertSpy]
- "brand_alta_vision_logo": "alta-vision-logo.tsx" | kind=code-symbol | source=src/components/brand/alta-vision-logo.tsx:L1 | neighbors=[AltaVisionLogo(), utils.ts, cn(), page.tsx, layout.tsx, mobile-nav.tsx]
- "bugs_report_input_test": "report-input.test.ts" | kind=code-symbol | source=src/features/bugs/report-input.test.ts:L1 | neighbors=[report-input.ts, bugFilterHref(), bugReportInput, bugTriageInput, parseBugFilters(), stripIssueTemplate()]
- "commit:repo:github.com/DeegayuA/LogPup@2607f59b4ea90fef4894daa101fa98ea3bcbb14e": "2607f59 fix(speech): read-aloud budgets and fallbacks learn that Sinhala is not…" | kind=Commit | source=git | neighbors=[main, 5a95470 fix(meetings): transcripts stop…, use-speech.ts, chunk-speech.ts, chunk-speech.test.ts, spoken-text.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-022.json

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
