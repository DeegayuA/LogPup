# Node Description Batch 40 of 166

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

- "notifications_notify_extractmentioneduserids": "extractMentionedUserIds()" | kind=code-symbol | source=src/features/notifications/notify.ts:L610 | neighbors=[comment-actions.ts, actions.ts, ai-actions.ts, notify.ts, escapeRegExp()]
- "notifications_notify_rules_applydailycap": "applyDailyCap()" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L302 | neighbors=[notify.ts, notify-rules.ts, dailyCapFor(), dedupeKeyFor(), notify-rules.test.ts]
- "notifications_notify_rules_dedupekeyfor": "dedupeKeyFor()" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L72 | neighbors=[notify.ts, notify-rules.ts, applyDailyCap(), segment(), notify-rules.test.ts]
- "notion_export_upsertsprintpage": "upsertSprintPage()" | kind=code-symbol | source=src/features/notion/export.ts:L81 | neighbors=[actions.ts, export.ts, buildBlocks(), notion(), resolveParentPageId()]
- "notion_parent_page": "parent-page.ts" | kind=code-symbol | source=src/features/notion/parent-page.ts:L1 | neighbors=[export.ts, NotionPageCandidate, ParentPageDecision, pickParentPage(), parent-page.test.ts]
- "onboarding_schema": "schema.ts" | kind=code-symbol | source=src/features/onboarding/schema.ts:L1 | neighbors=[actions.ts, phone.ts, normalizePhone(), onboardingInput, schema.test.ts]
- "people_allocation_history_changekind": "ChangeKind" | kind=code-symbol | source=src/features/people/allocation-history.ts:L3 | neighbors=[allocation-history-card.tsx, actions.ts, allocation-history.ts, allocation-history.test.ts, capacity-compare.ts]
- "people_allocation_history_historyrow": "HistoryRow" | kind=code-symbol | source=src/features/people/allocation-history.ts:L12 | neighbors=[allocation-history.ts, allocation-history.test.ts, capacity-compare.ts, capacity-compare.test.ts, queries.ts]
- "people_allocation_history_selectrowsasof": "selectRowsAsOf()" | kind=code-symbol | source=src/features/people/allocation-history.ts:L43 | neighbors=[attendance-history.ts, attendance-history.test.ts, allocation-history.ts, CapacityAsOf, allocation-history.test.ts]
- "people_capacity_compare_overloadstretches": "overloadStretches()" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L230 | neighbors=[capacity-compare.ts, daysBetween(), totalsAt(), capacity-compare.test.ts, queries.ts]
- "people_capacity_hours_round1": "round1()" | kind=code-symbol | source=src/features/people/capacity-hours.ts:L119 | neighbors=[capacity-hours.ts, allocatedHours(), hoursForFraction(), HoursLoad, weeklyCapacityHours()]
- "people_capacity_hours_weeklycapacityhours": "weeklyCapacityHours()" | kind=code-symbol | source=src/features/people/capacity-hours.ts:L54 | neighbors=[capacity-hours.ts, allocatedHours(), HoursLoad, capacity-hours.test.ts, round1()]
- "people_followup_split_test": "followup-split.test.ts" | kind=code-symbol | source=src/features/people/followup-split.test.ts:L1 | neighbors=[d7a4a59 fix(people): a follow-up that a…, followup-split.ts, PersonFollowupRow, splitPersonFollowups(), followup()]
- "people_format_instant_formatbusinessmeetingrange": "formatBusinessMeetingRange()" | kind=code-symbol | source=src/features/people/format-instant.ts:L139 | neighbors=[person-meetings-card.tsx, format-instant.ts, formatBusinessTime(), formatBusinessWeekdayDayMonth(), format-instant.test.ts]
- "people_history_params_historyhref": "historyHref()" | kind=code-symbol | source=src/features/people/history-params.ts:L87 | neighbors=[as-of-picker.tsx, history-filters.tsx, history-views.tsx, history-params.ts, history-params.test.ts]
- "people_history_params_historyparams": "HistoryParams" | kind=code-symbol | source=src/features/people/history-params.ts:L26 | neighbors=[as-of-picker.tsx, history-filters.tsx, history-views.tsx, page.tsx, history-params.ts]
- "people_history_params_test": "history-params.test.ts" | kind=code-symbol | source=src/features/people/history-params.test.ts:L1 | neighbors=[history-params.ts, historyHref(), parseHistoryParams(), resolveHistoryWindow(), NOW]
- "people_iso_day_isoweekstart": "isoWeekStart()" | kind=code-symbol | source=src/features/people/iso-day.ts:L63 | neighbors=[iso-day.ts, isoDayAdd(), toUtcMidnight(), iso-day.test.ts, queries.ts]
- "people_iso_day_toutcmidnight": "toUtcMidnight()" | kind=code-symbol | source=src/features/people/iso-day.ts:L41 | neighbors=[iso-day.ts, isoDayAdd(), isoDayDiff(), isoWeekStart(), isIsoDay()]
- "people_meeting_window_test": "meeting-window.test.ts" | kind=code-symbol | source=src/features/people/meeting-window.test.ts:L1 | neighbors=[meeting-window.ts, PersonMeetingRow, splitPersonMeetings(), meeting(), NOW]
- "people_queries_assignableapp": "AssignableApp" | kind=code-symbol | source=src/features/people/queries.ts:L123 | neighbors=[assign-dialog.tsx, assignments-card.tsx, capacity-heat.tsx, capacity-heat-editable.tsx, queries.ts]
- "people_queries_getpersonfollowups": "getPersonFollowups" | kind=code-symbol | source=src/features/people/queries.ts:L885 | neighbors=[dashboard-zones.tsx, page.tsx, context-pack.ts, queries.ts, summary-actions.ts]
- "people_queries_getpersonworkload": "getPersonWorkload" | kind=code-symbol | source=src/features/people/queries.ts:L824 | neighbors=[dashboard-zones.tsx, page.tsx, context-pack.ts, queries.ts, summary-actions.ts]
- "people_removal_queries_test": "removal-queries.test.ts" | kind=code-symbol | source=src/features/people/removal-queries.test.ts:L1 | neighbors=[schema.ts, users, removal-queries.ts, dialect, sqlOf()]
- "people_summary_derivepersonsummary": "derivePersonSummary()" | kind=code-symbol | source=src/features/people/summary.ts:L79 | neighbors=[page.tsx, summary.ts, summary-actions.ts, plural(), summary.test.ts]
- "people_task_workload_duestate": "DueState" | kind=code-symbol | source=src/features/people/task-workload.ts:L45 | neighbors=[dashboard-zones.tsx, person-tasks-card.tsx, context-pack.ts, task-workload.ts, task-workload.test.ts]
- "people_task_workload_persontaskrow": "PersonTaskRow" | kind=code-symbol | source=src/features/people/task-workload.ts:L31 | neighbors=[dashboard-zones.tsx, person-tasks-card.tsx, queries.ts, task-workload.ts, task-workload.test.ts]
- "people_task_workload_taskload": "TaskLoad" | kind=code-symbol | source=src/features/people/task-workload.ts:L113 | neighbors=[my-day-stats.ts, my-day-stats.test.ts, person-stats.ts, queries.ts, task-workload.ts]
- "registry_kinds": "kinds.ts" | kind=code-symbol | source=src/features/search/registry/kinds.ts:L1 | neighbors=[command-center.tsx, KIND_META, KindMeta, types.ts, PaletteRecent]
- "registry_types_palettecontext": "PaletteContext" | kind=code-symbol | source=src/features/search/registry/types.ts:L35 | neighbors=[commands.ts, command-center.tsx, commands.ts, registry.test.ts, types.ts]
- "shared_drag_surface": "drag-surface.tsx" | kind=code-symbol | source=src/components/shared/drag-surface.tsx:L1 | neighbors=[meetings-month-calendar.tsx, roadmap-timeline.tsx, buildDragAnnouncements(), DragSurface(), useDragSensors()]
- "shared_help_note_helpnote": "HelpNote()" | kind=code-symbol | source=src/components/shared/help-note.tsx:L35 | neighbors=[cohort-views.tsx, declare-absence-dialog.tsx, log-box.tsx, help-note.tsx, page.tsx]
- "shared_holiday_icon_holidaycategorylabel": "holidayCategoryLabel()" | kind=code-symbol | source=src/components/shared/holiday-icon.tsx:L40 | neighbors=[meetings-agenda.tsx, meetings-month-calendar.tsx, meetings-time-grid.tsx, index.tsx, holiday-icon.tsx]
- "shared_holiday_icon_holidayicons": "HolidayIcons()" | kind=code-symbol | source=src/components/shared/holiday-icon.tsx:L81 | neighbors=[meetings-agenda.tsx, meetings-month-calendar.tsx, meetings-time-grid.tsx, index.tsx, holiday-icon.tsx]
- "shared_holiday_icon_holidaytoneclass": "holidayToneClass()" | kind=code-symbol | source=src/components/shared/holiday-icon.tsx:L48 | neighbors=[meetings-agenda.tsx, meetings-month-calendar.tsx, meetings-time-grid.tsx, index.tsx, holiday-icon.tsx]
- "shared_lazy_disclosure": "lazy-disclosure.tsx" | kind=code-symbol | source=src/components/shared/lazy-disclosure.tsx:L1 | neighbors=[page.tsx, utils.ts, cn(), LazyDisclosure(), page.tsx]
- "shell_nav_items_test": "nav-items.test.ts" | kind=code-symbol | source=src/components/shell/nav-items.test.ts:L1 | neighbors=[nav-items.ts, adminNavItems, getVisibleNavItems(), navItems, progressNavItem]
- "shell_sidebar_model_sidebarstate": "SidebarState" | kind=code-symbol | source=src/components/shell/sidebar-model.ts:L27 | neighbors=[types.ts, sidebar.tsx, sidebar-model.ts, sidebar-model.test.ts, sidebar-store.ts]
- "shell_theme_provider_usetheme": "useTheme()" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L148 | neighbors=[appearance-card.tsx, command-center.tsx, theme-provider.tsx, theme-toggle.tsx, sonner.tsx]
- "shell_version_badge_versionbadge": "VersionBadge()" | kind=code-symbol | source=src/components/shell/version-badge.tsx:L84 | neighbors=[mobile-nav.tsx, sidebar.tsx, version-badge.tsx, dayLabel(), groupByDay()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-039.json

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
