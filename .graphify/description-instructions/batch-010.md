# Node Description Batch 11 of 166

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

- "meetings_notes_test": "notes.test.ts" | kind=code-symbol | source=src/features/meetings/notes.test.ts:L1 | neighbors=[3c0bc01 ., notes.ts, assembleMeetingPrep(), AutoAssignCandidate, AutoAssignedTaskFields, buildAutoAssignNotification()]
- "pending_page": "page.tsx" | kind=code-symbol | source=src/app/pending/page.tsx:L1 | neighbors=[queries.ts, getOwnPhone(), onboarding-form.tsx, OnboardingForm(), auth.ts, org-from-domain.ts]
- "people_followup_split": "followup-split.ts" | kind=code-symbol | source=src/features/people/followup-split.ts:L1 | neighbors=[d7a4a59 fix(people): a follow-up that a…, person-followups-card.tsx, my-day-stats.ts, my-day-stats.test.ts, signals.ts, signals.test.ts]
- "people_history_params": "history-params.ts" | kind=code-symbol | source=src/features/people/history-params.ts:L1 | neighbors=[as-of-picker.tsx, history-filters.tsx, history-views.tsx, page.tsx, as-of-date.ts, isoDaysAgo()]
- "shell_account_menu": "account-menu.tsx" | kind=code-symbol | source=src/components/shell/account-menu.tsx:L1 | neighbors=[layout.tsx, capabilities.ts, roleLabel(), UserRole, auth.ts, utils.ts]
- "shell_header": "header.tsx" | kind=code-symbol | source=src/components/shell/header.tsx:L1 | neighbors=[layout.tsx, 473168b docs: restore the reasoning the…, 89dee50 fix(ui): craft regressions the …, 8bacbca ., capabilities.ts, UserRole]
- "signals_figure": "figure.ts" | kind=code-symbol | source=src/features/signals/figure.ts:L1 | neighbors=[d5b6409 ., signals-view.tsx, architect.ts, lead.ts, member.ts, pm.ts]
- "sprints_roadmap_layout": "roadmap-layout.ts" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L1 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, page.tsx, BarGeometry, offsetOfDate(), packRows()]
- "transcription_live_client_livetranscriptionsession": "LiveTranscriptionSession" | kind=code-symbol | source=src/features/transcription/live-client.ts:L74 | neighbors=[use-live-transcription.ts, live-client.ts, .clearTimers(), .connect(), .constructor(), .fail()]
- "ui_input_group": "input-group.tsx" | kind=code-symbol | source=src/components/ui/input-group.tsx:L1 | neighbors=[directory.tsx, history-filters.tsx, progress-filters.tsx, command.tsx, utils.ts, cn()]
- "ui_textarea": "textarea.tsx" | kind=code-symbol | source=src/components/ui/textarea.tsx:L1 | neighbors=[app-form-dialog.tsx, ask-panel.tsx, bug-content-editor.tsx, day-panel.tsx, declare-absence-dialog.tsx, log-box.tsx]
- "activity_queries": "queries.ts" | kind=code-symbol | source=src/features/activity/queries.ts:L1 | neighbors=[actions.ts, page.tsx, filters.ts, activityConditions(), listActivity(), listActivityActors]
- "apps_app_health_test": "app-health.test.ts" | kind=code-symbol | source=src/features/apps/app-health.test.ts:L1 | neighbors=[app-health.ts, AppHealth, AppHealthInput, AppSprintSnapshot, AppTaskCounts, completionPct()]
- "commit:repo:github.com/DeegayuA/LogPup@de4812e78935d39f330ecb6c02c0e0fc9086e21a": "de4812e feat(github): commits become worklog evidence, inert until the App exis…" | kind=Commit | source=git | neighbors=[1eedff1 feat(people): a project's team …, actions.ts, queries.ts, main, 0a2e8bb feat(gemini): ask Google what m…, github-login-field.tsx]
- "components_app_contributions": "app-contributions.tsx" | kind=code-symbol | source=src/features/apps/components/app-contributions.tsx:L1 | neighbors=[contribution-queries.ts, AppContribution, AppContributions(), Stat(), contact-buttons.tsx, ContactButtons()]
- "components_as_of_picker": "as-of-picker.tsx" | kind=code-symbol | source=src/features/people/components/as-of-picker.tsx:L1 | neighbors=[AsOfPicker(), PRESETS, utils.ts, cn(), as-of-date.ts, isoDaysAgo()]
- "components_meeting_panels_model_test": "meeting-panels-model.test.ts" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.test.ts:L1 | neighbors=[meeting-panels-model.ts, ActiveFilters, clearFilters(), countByKind(), FilterableItem, filterItems()]
- "components_note_timeline_model": "note-timeline-model.ts" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L1 | neighbors=[action-item-board.tsx, meeting-notes.tsx, note-timeline.tsx, meeting-notes-model.ts, parseSpokenDueDate(), ActionItemEditPatch]
- "components_past_meetings_section": "past-meetings-section.tsx" | kind=code-symbol | source=src/features/meetings/components/past-meetings-section.tsx:L1 | neighbors=[671c254 ., meetings-views.tsx, meeting-chips.tsx, SkeletonBlock(), meeting-list.tsx, MeetingList()]
- "components_use_glance_map": "use-glance-map.tsx" | kind=code-symbol | source=src/features/meetings/components/use-glance-map.tsx:L1 | neighbors=[671c254 ., meeting-list.tsx, meetings-views.tsx, triage-rail.tsx, meeting-glance.ts, meeting-notes-model.ts]
- "gemini_ai_meter": "ai-meter.ts" | kind=code-symbol | source=src/features/gemini/ai-meter.ts:L1 | neighbors=[13be4b6 ., bd5f524 feat(gemini): the honest half o…, f8a9b00 feat(gemini): the meter learns …, ai-meter-dock.tsx, formatElapsed(), localSpend()]
- "gemini_usage_summary": "usage-summary.ts" | kind=code-symbol | source=src/features/gemini/usage-summary.ts:L1 | neighbors=[ai-adoption-card.tsx, ai-features-card.tsx, dashboard-zones.tsx, ai-engine.ts, ai-engine.test.ts, queries.ts]
- "meetings_followups_test": "followups.test.ts" | kind=code-symbol | source=src/features/meetings/followups.test.ts:L1 | neighbors=[3c0bc01 ., 8d1b390 fix(i18n): Sinhala survives eve…, followups.ts, buildFollowupRows(), decideFollowupResolutionOnTaskStatusCha…, filterValidIds()]
- "notifications_actions": "actions.ts" | kind=code-symbol | source=src/features/notifications/actions.ts:L1 | neighbors=[notification-bell-client.tsx, index.ts, Db, schema.ts, notifications, action-result.ts]
- "people_person_stats": "person-stats.ts" | kind=code-symbol | source=src/features/people/person-stats.ts:L1 | neighbors=[dashboard-zones.tsx, person-stat-row.tsx, my-day-stats.ts, page.tsx, history-stats.ts, capacity-bar.tsx]
- "registry_providers": "providers.ts" | kind=code-symbol | source=src/features/search/registry/providers.ts:L1 | neighbors=[search-providers.ts, searchProviders, search-providers.ts, searchProviders, search-providers.ts, searchProviders]
- "roles_lead": "lead.ts" | kind=code-symbol | source=src/features/signals/roles/lead.ts:L1 | neighbors=[d5b6409 ., LeadAssignment, LeadCompletion, LeadReview, LeadScorecard, LeadScorecardInput]
- "roles_pm": "pm.ts" | kind=code-symbol | source=src/features/signals/roles/pm.ts:L1 | neighbors=[d5b6409 ., CommittedTask, isoOf(), PmBlockedTask, PmCheckin, PmFollowup]
- "shared_holiday_icon": "holiday-icon.tsx" | kind=code-symbol | source=src/components/shared/holiday-icon.tsx:L1 | neighbors=[meetings-agenda.tsx, meetings-month-calendar.tsx, meetings-time-grid.tsx, meetings-views.tsx, index.tsx, lk-holidays.ts]
- "shell_version_badge": "version-badge.tsx" | kind=code-symbol | source=src/components/shell/version-badge.tsx:L1 | neighbors=[mobile-nav.tsx, sidebar.tsx, changelog.ts, ChangelogEntry, lk-holidays.ts, utils.ts]
- "ui_page_header_pageheader": "PageHeader()" | kind=code-symbol | source=src/components/ui/page-header.tsx:L3 | neighbors=[layout.tsx, page.tsx, page.tsx, page.tsx, page.tsx, loading.tsx]
- "admin_change_request_queries": "change-request-queries.ts" | kind=code-symbol | source=src/features/admin/change-request-queries.ts:L1 | neighbors=[approval-queries.ts, getApprovalsInbox(), getMyRequests(), InboxRequest, select, toInbox()]
- "bugs_search_providers": "search-providers.ts" | kind=code-symbol | source=src/features/bugs/search-providers.ts:L1 | neighbors=[actor.ts, capabilities.ts, effectiveGrant(), bug-display.ts, bugSeverityLabel(), bugStatusLabel()]
- "commit:repo:github.com/DeegayuA/LogPup@232b7ef7f930b0a6f72f6ee10b025ea44ea0db97": "232b7ef ." | kind=Commit | source=git | neighbors=[page.tsx, loading.tsx, page.tsx, page.tsx, main, e38a385 feat(worklog): what a logged da…]
- "components_ai_adoption_card": "ai-adoption-card.tsx" | kind=code-symbol | source=src/features/admin/components/ai-adoption-card.tsx:L1 | neighbors=[page.tsx, AiAdoptionCard(), AiAdoptionCardProps, VERDICT_BADGE, ai-features.ts, queries.ts]
- "components_appearance_card": "appearance-card.tsx" | kind=code-symbol | source=src/features/settings/components/appearance-card.tsx:L1 | neighbors=[007c37f ., ACCENT_LABELS, AppearanceCard(), OPTIONS, utils.ts, cn()]
- "components_capacity_bar": "capacity-bar.tsx" | kind=code-symbol | source=src/features/people/components/capacity-bar.tsx:L1 | neighbors=[assignments-card.tsx, BAND_SUFFIX, CapacityBand, CapacityBar(), FILL, utils.ts]
- "components_intel_view": "intel-view.tsx" | kind=code-symbol | source=src/features/intel/components/intel-view.tsx:L1 | neighbors=[00d6621 fix(intel): one hung Gemini cal…, bee388b feat(intel): fold the page into…, ask-bubble.tsx, briefing-card.tsx, BriefingCard(), IntelView()]
- "components_signal_board": "signal-board.tsx" | kind=code-symbol | source=src/features/intel/components/signal-board.tsx:L1 | neighbors=[intel-view.tsx, Filter, SEVERITY, SEVERITY_ORDER, SignalBoard(), SignalRow()]
- "components_signals_view": "signals-view.tsx" | kind=code-symbol | source=src/features/signals/components/signals-view.tsx:L1 | neighbors=[d5b6409 ., FigureCell(), formatFigure(), SignalsHelp(), SignalsView(), unitSuffix()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-010.json

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
