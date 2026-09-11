# Node Description Batch 34 of 166

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

- "transcription_live_client_livetranscriptionsession_stop": ".stop()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L133 | neighbors=[LiveTranscriptionSession, .fail(), .clearTimers(), .setStatus(), .teardownAudio(), .teardownSocket()]
- "transcription_pcm_test": "pcm.test.ts" | kind=code-symbol | source=src/features/transcription/pcm.test.ts:L1 | neighbors=[pcm.ts, bytesToBase64(), downsampleTo(), encodeAudioChunk(), floatTo16BitPCM(), int16ToLittleEndianBytes()]
- "ui_avatar_avatargroup": "AvatarGroup()" | kind=code-symbol | source=src/components/ui/avatar.tsx:L80 | neighbors=[app-card.tsx, meeting-intel-sheet.tsx, meeting-list.tsx, meetings-day-rail.tsx, progress-apps-lane.tsx, avatar.tsx]
- "ui_command_command": "Command()" | kind=code-symbol | source=src/components/ui/command.tsx:L20 | neighbors=[command-center.tsx, meeting-form.tsx, meeting-people-picker.tsx, meeting-project-select.tsx, command.tsx, search-select.tsx]
- "ui_command_commandempty": "CommandEmpty()" | kind=code-symbol | source=src/components/ui/command.tsx:L108 | neighbors=[command-center.tsx, meeting-form.tsx, meeting-people-picker.tsx, meeting-project-select.tsx, command.tsx, search-select.tsx]
- "ui_command_commandgroup": "CommandGroup()" | kind=code-symbol | source=src/components/ui/command.tsx:L121 | neighbors=[command-center.tsx, meeting-form.tsx, meeting-people-picker.tsx, meeting-project-select.tsx, command.tsx, search-select.tsx]
- "ui_command_commandinput": "CommandInput()" | kind=code-symbol | source=src/components/ui/command.tsx:L69 | neighbors=[command-center.tsx, meeting-form.tsx, meeting-people-picker.tsx, meeting-project-select.tsx, command.tsx, search-select.tsx]
- "ui_command_commanditem": "CommandItem()" | kind=code-symbol | source=src/components/ui/command.tsx:L156 | neighbors=[command-center.tsx, meeting-form.tsx, meeting-people-picker.tsx, meeting-project-select.tsx, command.tsx, search-select.tsx]
- "ui_command_commandlist": "CommandList()" | kind=code-symbol | source=src/components/ui/command.tsx:L92 | neighbors=[command-center.tsx, meeting-form.tsx, meeting-people-picker.tsx, meeting-project-select.tsx, command.tsx, search-select.tsx]
- "ui_dropdown_menu_dropdownmenuseparator": "DropdownMenuSeparator()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L223 | neighbors=[add-to-calendar.tsx, board-bulk-bar.tsx, board-toolbar.tsx, card-quick-menu.tsx, account-menu.tsx, dropdown-menu.tsx]
- "ui_input_group_inputgroupaddon": "InputGroupAddon()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L46 | neighbors=[directory.tsx, history-filters.tsx, progress-filters.tsx, command.tsx, input-group.tsx, inputGroupAddonVariants]
- "ui_radio_group": "radio-group.tsx" | kind=code-symbol | source=src/components/ui/radio-group.tsx:L1 | neighbors=[gemini-keys-card.tsx, maintenance-controls.tsx, utils.ts, cn(), RadioGroup(), RadioGroupItem()]
- "ui_spotlight_card": "spotlight-card.tsx" | kind=code-symbol | source=src/components/ui/spotlight-card.tsx:L1 | neighbors=[ask-panel.tsx, briefing-card.tsx, utils.ts, cn(), SpotlightCard(), useMediaQuery()]
- "ui_stat_tile_stattile": "StatTile()" | kind=code-symbol | source=src/components/ui/stat-tile.tsx:L32 | neighbors=[page.tsx, app-header.tsx, dashboard-zones.tsx, directory.tsx, triage-rail.tsx, stat-tile.tsx]
- "worklog_absence_kinds_exemptingabsences": "exemptingAbsences()" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L236 | neighbors=[absence-kinds.ts, absence-kinds.test.ts, auto-score-sync.ts, catch-up-actions.ts, nudge-queries.ts, page.tsx]
- "worklog_auto_score_sync_syncautoscore": "syncAutoScore()" | kind=code-symbol | source=src/features/worklog/auto-score-sync.ts:L92 | neighbors=[actions.ts, auto-score-sync.ts, backfillAutoScores(), noteFromEntries(), scheduledMinutesFor(), entry-actions.ts]
- "worklog_catch_up_parse_catchupcandidateday": "CatchUpCandidateDay" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L68 | neighbors=[log-box.tsx, catch-up-actions.ts, catch-up-offline.ts, catch-up-offline.test.ts, catch-up-parse.ts, catch-up-parse.test.ts]
- "worklog_coverage_formatcoverage": "formatCoverage()" | kind=code-symbol | source=src/features/worklog/coverage.ts:L198 | neighbors=[coverage-figure.tsx, progress-matrix.tsx, coverage.ts, num(), coverage.test.ts, page.tsx]
- "worklog_day_app_mix_test": "day-app-mix.test.ts" | kind=code-symbol | source=src/features/worklog/day-app-mix.test.ts:L1 | neighbors=[e38a385 feat(worklog): what a logged da…, day-app-mix.ts, buildDayMix(), buildMixLegend(), DayEntry, entry()]
- "worklog_day_state_classifyday": "classifyDay()" | kind=code-symbol | source=src/features/worklog/day-state.ts:L63 | neighbors=[progress-matrix.tsx, worklog-calendar.tsx, day-state.ts, dayStateText(), day-state.test.ts, page.tsx]
- "worklog_day_state_loggedtone": "loggedTone()" | kind=code-symbol | source=src/features/worklog/day-state.ts:L110 | neighbors=[logged-days-list.tsx, progress-matrix.tsx, worklog-calendar.tsx, day-state.ts, day-state.test.ts, page.tsx]
- "worklog_day_state_test": "day-state.test.ts" | kind=code-symbol | source=src/features/worklog/day-state.test.ts:L1 | neighbors=[e8b2ac2 feat(worklog): hours you logged…, day-state.ts, classifyDay(), dayStateText(), isHalfDay(), loggedTone()]
- "worklog_entries_entry_categories": "ENTRY_CATEGORIES" | kind=code-symbol | source=src/features/worklog/entries.ts:L17 | neighbors=[day-hours-card.tsx, catch-up-parse.ts, entries.ts, entries.test.ts, entry-actions.ts, entry-draft-prompt.ts]
- "worklog_entries_totalminutes": "totalMinutes()" | kind=code-symbol | source=src/features/worklog/entries.ts:L47 | neighbors=[day-hours-card.tsx, auto-score-sync.ts, entries.ts, entries.test.ts, entry-ai-actions.ts, entry-check.ts]
- "worklog_entry_form_buildentrypayload": "buildEntryPayload()" | kind=code-symbol | source=src/features/worklog/entry-form.ts:L56 | neighbors=[day-hours-card.tsx, day-one-line.tsx, log-box.tsx, entry-form.ts, entryFormProblem(), entry-form.test.ts]
- "worklog_entry_form_entryformproblem": "entryFormProblem()" | kind=code-symbol | source=src/features/worklog/entry-form.ts:L80 | neighbors=[day-hours-card.tsx, day-one-line.tsx, log-box.tsx, entry-form.ts, buildEntryPayload(), entry-form.test.ts]
- "worklog_guest_projects": "guest-projects.ts" | kind=code-symbol | source=src/features/worklog/guest-projects.ts:L1 | neighbors=[a4b271b Improve leave types and worklog…, worklog-form.tsx, partitionGuestApps(), note-app-tags.ts, noteHasAppTag(), guest-projects.test.ts]
- "worklog_progress_params_adddaysiso": "addDaysIso()" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L91 | neighbors=[progress-params.ts, eachDayInclusive(), mondayOf(), resolveProgressWindow(), progress-params.test.ts, progress-queries.ts]
- "worklog_schedules_scheduledminutesforfraction": "scheduledMinutesForFraction()" | kind=code-symbol | source=src/features/worklog/schedules.ts:L51 | neighbors=[log-box.tsx, auto-score-sync.ts, entry-evidence.ts, page.tsx, schedules.ts, schedules.test.ts]
- "activity_format_activityphraseparts": "activityPhraseParts()" | kind=code-symbol | source=src/features/activity/format.ts:L43 | neighbors=[format.ts, activityPhrase(), format.test.ts, activity-feed.tsx, audit-trail.tsx]
- "activity_search_rankactivitymatches": "rankActivityMatches()" | kind=code-symbol | source=src/features/activity/search.ts:L57 | neighbors=[actions.ts, page.tsx, search.ts, tokenize(), search.test.ts]
- "activity_types_activity_entity_types": "ACTIVITY_ENTITY_TYPES" | kind=code-symbol | source=src/features/activity/types.ts:L5 | neighbors=[actions.ts, page.tsx, types.ts, audit-nl.ts, activity-filter-bar.tsx]
- "activity_types_activityfilters": "ActivityFilters" | kind=code-symbol | source=src/features/activity/types.ts:L112 | neighbors=[actions.ts, filters.ts, page.tsx, queries.ts, types.ts]
- "admin_actions_removeuser": "removeUser()" | kind=code-symbol | source=src/features/admin/actions.ts:L190 | neighbors=[actions.ts, isUniqueViolation(), otherActiveSuperadminCount(), revalidateUserDetailPaths(), user-table.tsx]
- "admin_actions_revalidateuserdetailpaths": "revalidateUserDetailPaths()" | kind=code-symbol | source=src/features/admin/actions.ts:L108 | neighbors=[actions.ts, removeUser(), revalidateAdminPaths(), setUserPersonalEmail(), setUserTitle()]
- "admin_actions_setuseractive": "setUserActive()" | kind=code-symbol | source=src/features/admin/actions.ts:L305 | neighbors=[actions.ts, otherActiveSuperadminCount(), revalidateAdminPaths(), bulk-actions.ts, user-table.tsx]
- "admin_actions_setuserrole": "setUserRole()" | kind=code-symbol | source=src/features/admin/actions.ts:L251 | neighbors=[actions.ts, otherActiveSuperadminCount(), revalidateAdminPaths(), bulk-actions.ts, user-table.tsx]
- "admin_approval_badge_approvaltotal": "approvalTotal()" | kind=code-symbol | source=src/features/admin/approval-badge.ts:L27 | neighbors=[approval-badge.ts, approvalBadgeText(), showApprovals(), approval-badge.test.ts, page.tsx]
- "admin_audit_filters_audithref": "auditHref()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L193 | neighbors=[audit-filters.ts, auditQueryString(), auditSortHref(), audit-filters.test.ts, audit-trail.tsx]
- "admin_audit_filters_auditsorthref": "auditSortHref()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L200 | neighbors=[audit-filters.ts, auditHref(), nextAuditDir(), audit-filters.test.ts, audit-trail.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-033.json

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
