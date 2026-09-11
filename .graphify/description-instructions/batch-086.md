# Node Description Batch 87 of 166

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

- "components_dashboard_zones_myworkzoneskeleton": "MyWorkZoneSkeleton()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L541 | neighbors=[dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_portfoliozone": "PortfolioZone()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L882 | neighbors=[dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_rosterforapps": "rosterForApps()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L690 | neighbors=[dashboard-zones.tsx, CoverageZone()]
- "components_dashboard_zones_teamzone": "TeamZone()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L554 | neighbors=[dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_trailzone": "TrailZone()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L1113 | neighbors=[dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_trailzoneskeleton": "TrailZoneSkeleton()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L1126 | neighbors=[dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_unreadmentionspill": "UnreadMentionsPill()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L1150 | neighbors=[page.tsx, dashboard-zones.tsx]
- "components_dashboard_zones_zone_views": "ZONE_VIEWS" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L210 | neighbors=[page.tsx, dashboard-zones.tsx]
- "components_day_hours_card_dayhourscard": "DayHoursCard()" | kind=code-symbol | source=src/features/worklog/components/day-hours-card.tsx:L169 | neighbors=[day-hours-card.tsx, day-panel.tsx]
- "components_day_panel_daypanel": "DayPanel()" | kind=code-symbol | source=src/features/worklog/components/day-panel.tsx:L52 | neighbors=[day-panel.tsx, page.tsx]
- "components_db_clear_button_dbclearbutton": "DbClearButton()" | kind=code-symbol | source=src/features/admin/components/db-clear-button.tsx:L20 | neighbors=[db-clear-button.tsx, page.tsx]
- "components_delete_app_card_deleteappcard": "DeleteAppCard()" | kind=code-symbol | source=src/features/apps/components/delete-app-card.tsx:L32 | neighbors=[delete-app-card.tsx, page.tsx]
- "components_delete_bug_button_deletebugbutton": "DeleteBugButton()" | kind=code-symbol | source=src/features/bugs/components/delete-bug-button.tsx:L32 | neighbors=[bug-list.tsx, delete-bug-button.tsx]
- "components_directory_parsesort": "parseSort()" | kind=code-symbol | source=src/features/people/components/directory.tsx:L56 | neighbors=[directory.tsx, PeopleDirectory()]
- "components_employment_select_capnotice": "CapNotice()" | kind=code-symbol | source=src/features/admin/components/employment-select.tsx:L68 | neighbors=[employment-select.tsx, user-table.tsx]
- "components_employment_select_employmentselect": "EmploymentSelect()" | kind=code-symbol | source=src/features/admin/components/employment-select.tsx:L27 | neighbors=[employment-select.tsx, user-table.tsx]
- "components_entry_grammar_help_category_label": "CATEGORY_LABEL" | kind=code-symbol | source=src/features/worklog/components/entry-grammar-help.tsx:L29 | neighbors=[day-hours-card.tsx, entry-grammar-help.tsx]
- "components_export_button_exportbutton": "ExportButton()" | kind=code-symbol | source=src/features/notion/components/export-button.tsx:L9 | neighbors=[export-button.tsx, page.tsx]
- "components_first_log_nudge_banner_firstlognudgebanner": "FirstLogNudgeBanner()" | kind=code-symbol | source=src/features/worklog/components/first-log-nudge-banner.tsx:L18 | neighbors=[first-log-nudge.tsx, first-log-nudge-banner.tsx]
- "components_first_log_nudge_firstlognudge": "FirstLogNudge()" | kind=code-symbol | source=src/features/worklog/components/first-log-nudge.tsx:L23 | neighbors=[page.tsx, first-log-nudge.tsx]
- "components_gemini_keys_card_geminikeyscard": "GeminiKeysCard()" | kind=code-symbol | source=src/features/gemini/components/gemini-keys-card.tsx:L53 | neighbors=[gemini-keys-card.tsx, page.tsx]
- "components_github_login_field_githubloginfield": "GithubLoginField()" | kind=code-symbol | source=src/features/auth/components/github-login-field.tsx:L23 | neighbors=[github-login-field.tsx, page.tsx]
- "components_google_one_tap_googleonetap": "GoogleOneTap()" | kind=code-symbol | source=src/features/auth/components/google-one-tap.tsx:L54 | neighbors=[google-one-tap.tsx, page.tsx]
- "components_handover_form_handoverform": "HandoverForm()" | kind=code-symbol | source=src/features/people/components/handover-form.tsx:L55 | neighbors=[handover-form.tsx, page.tsx]
- "components_history_filters_historyfilters": "HistoryFilters()" | kind=code-symbol | source=src/features/people/components/history-filters.tsx:L31 | neighbors=[history-filters.tsx, page.tsx]
- "components_history_skeleton_historyshellskeleton": "HistoryShellSkeleton()" | kind=code-symbol | source=src/features/people/components/history-skeleton.tsx:L39 | neighbors=[history-skeleton.tsx, loading.tsx]
- "components_history_views_historyappstable": "HistoryAppsTable()" | kind=code-symbol | source=src/features/people/components/history-views.tsx:L270 | neighbors=[history-views.tsx, page.tsx]
- "components_history_views_historychangelog": "HistoryChangeLog()" | kind=code-symbol | source=src/features/people/components/history-views.tsx:L399 | neighbors=[history-views.tsx, page.tsx]
- "components_history_views_historypeopletable": "HistoryPeopleTable()" | kind=code-symbol | source=src/features/people/components/history-views.tsx:L119 | neighbors=[history-views.tsx, page.tsx]
- "components_history_views_overloadcard": "OverloadCard()" | kind=code-symbol | source=src/features/people/components/history-views.tsx:L489 | neighbors=[history-views.tsx, page.tsx]
- "components_intel_skeletons_briefingcardskeleton": "BriefingCardSkeleton()" | kind=code-symbol | source=src/features/intel/components/intel-skeletons.tsx:L17 | neighbors=[dashboard-zones.tsx, intel-skeletons.tsx]
- "components_intel_view_intelview": "IntelView()" | kind=code-symbol | source=src/features/intel/components/intel-view.tsx:L47 | neighbors=[ask-bubble.tsx, intel-view.tsx]
- "components_jump_to_date_jumptodate": "JumpToDate()" | kind=code-symbol | source=src/features/meetings/components/jump-to-date.tsx:L27 | neighbors=[jump-to-date.tsx, upcoming-filter.tsx]
- "components_live_transcription_status_livetranscriptioncostnotice": "LiveTranscriptionCostNotice()" | kind=code-symbol | source=src/features/transcription/components/live-transcription-status.tsx:L107 | neighbors=[live-transcription-status.tsx, meeting-intel.tsx]
- "components_live_transcription_status_livetranscriptionstatus": "LiveTranscriptionStatus()" | kind=code-symbol | source=src/features/transcription/components/live-transcription-status.tsx:L41 | neighbors=[live-transcription-status.tsx, meeting-intel.tsx]
- "components_load_board_loadboard": "LoadBoard()" | kind=code-symbol | source=src/features/meetings/components/load-board.tsx:L36 | neighbors=[load-board.tsx, page.tsx]
- "components_log_box_logbox": "LogBox()" | kind=code-symbol | source=src/features/worklog/components/log-box.tsx:L108 | neighbors=[log-box.tsx, page.tsx]
- "components_log_box_logboxgap": "LogBoxGap" | kind=code-symbol | source=src/features/worklog/components/log-box.tsx:L92 | neighbors=[log-box.tsx, page.tsx]
- "components_logged_days_list_loggeddayslist": "LoggedDaysList()" | kind=code-symbol | source=src/features/worklog/components/logged-days-list.tsx:L43 | neighbors=[logged-days-list.tsx, page.tsx]
- "components_maintenance_banner_maintenancebanner": "MaintenanceBanner()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-banner.tsx:L27 | neighbors=[maintenance-banner.tsx, maintenance-gate.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-086.json

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
