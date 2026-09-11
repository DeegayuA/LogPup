# Node Description Batch 90 of 166

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

- "components_notification_bell_client_notificationbellclient": "NotificationBellClient()" | kind=code-symbol | source=src/features/notifications/components/notification-bell-client.tsx:L53 | neighbors=[notification-bell.tsx, notification-bell-client.tsx]
- "components_notification_bell_notificationbell": "NotificationBell()" | kind=code-symbol | source=src/features/notifications/components/notification-bell.tsx:L5 | neighbors=[notification-bell.tsx, header.tsx]
- "components_notifications_card_notificationscard": "NotificationsCard()" | kind=code-symbol | source=src/features/dashboard/components/notifications-card.tsx:L60 | neighbors=[dashboard-zones.tsx, notifications-card.tsx]
- "components_onboarding_form_onboardingform": "OnboardingForm()" | kind=code-symbol | source=src/features/onboarding/components/onboarding-form.tsx:L17 | neighbors=[onboarding-form.tsx, page.tsx]
- "components_org_holidays_card_orgholidayscard": "OrgHolidaysCard()" | kind=code-symbol | source=src/features/worklog/components/org-holidays-card.tsx:L50 | neighbors=[org-holidays-card.tsx, page.tsx]
- "components_passkey_login_button_passkeyloginbutton": "PasskeyLoginButton()" | kind=code-symbol | source=src/features/auth/components/passkey-login-button.tsx:L23 | neighbors=[passkey-login-button.tsx, page.tsx]
- "components_passkey_nudge_banner_passkeynudgebanner": "PasskeyNudgeBanner()" | kind=code-symbol | source=src/features/auth/components/passkey-nudge-banner.tsx:L14 | neighbors=[passkey-nudge.tsx, passkey-nudge-banner.tsx]
- "components_passkey_nudge_passkeynudge": "PasskeyNudge()" | kind=code-symbol | source=src/features/auth/components/passkey-nudge.tsx:L24 | neighbors=[page.tsx, passkey-nudge.tsx]
- "components_passkeys_card_passkeyscard": "PasskeysCard()" | kind=code-symbol | source=src/features/auth/components/passkeys-card.tsx:L56 | neighbors=[passkeys-card.tsx, page.tsx]
- "components_past_meetings_section_ghostrows": "GhostRows()" | kind=code-symbol | source=src/features/meetings/components/past-meetings-section.tsx:L19 | neighbors=[past-meetings-section.tsx, upcoming-filter.tsx]
- "components_past_meetings_section_pastmeetingssection": "PastMeetingsSection()" | kind=code-symbol | source=src/features/meetings/components/past-meetings-section.tsx:L44 | neighbors=[meetings-views.tsx, past-meetings-section.tsx]
- "components_pending_absence_list_pendingabsencelist": "PendingAbsenceList()" | kind=code-symbol | source=src/features/worklog/components/pending-absence-list.tsx:L29 | neighbors=[pending-absence-list.tsx, page.tsx]
- "components_per_app_load_perappload": "PerAppLoad()" | kind=code-symbol | source=src/features/meeting-load/components/per-app-load.tsx:L13 | neighbors=[per-app-load.tsx, page.tsx]
- "components_person_activity_card_formatday": "formatDay()" | kind=code-symbol | source=src/features/people/components/person-activity-card.tsx:L58 | neighbors=[person-activity-card.tsx, PersonActivityCard()]
- "components_person_followups_card_firstname": "firstName()" | kind=code-symbol | source=src/features/people/components/person-followups-card.tsx:L38 | neighbors=[person-followups-card.tsx, PersonFollowupsCard()]
- "components_person_header_personheader": "PersonHeader()" | kind=code-symbol | source=src/features/people/components/person-header.tsx:L31 | neighbors=[person-header.tsx, page.tsx]
- "components_person_hover_card_personhovercard": "PersonHoverCard()" | kind=code-symbol | source=src/features/people/components/person-hover-card.tsx:L32 | neighbors=[meeting-planner.tsx, person-hover-card.tsx]
- "components_person_summary_card_personsummarycard": "PersonSummaryCard()" | kind=code-symbol | source=src/features/people/components/person-summary-card.tsx:L23 | neighbors=[person-summary-card.tsx, page.tsx]
- "components_person_tasks_card_duesuffix": "dueSuffix()" | kind=code-symbol | source=src/features/people/components/person-tasks-card.tsx:L67 | neighbors=[person-tasks-card.tsx, TaskRow()]
- "components_person_tasks_card_formatduedate": "formatDueDate()" | kind=code-symbol | source=src/features/people/components/person-tasks-card.tsx:L63 | neighbors=[person-tasks-card.tsx, TaskRow()]
- "components_phone_field_phonefield": "PhoneField()" | kind=code-symbol | source=src/features/auth/components/phone-field.tsx:L19 | neighbors=[phone-field.tsx, page.tsx]
- "components_plan_read_strip_planreadstrip": "PlanReadStrip()" | kind=code-symbol | source=src/features/sprints/components/plan-read-strip.tsx:L20 | neighbors=[plan-read-strip.tsx, page.tsx]
- "components_progress_apps_lane_noon": "noon()" | kind=code-symbol | source=src/features/worklog/components/progress-apps-lane.tsx:L31 | neighbors=[progress-apps-lane.tsx, SprintBlock()]
- "components_progress_apps_lane_progressappslane": "ProgressAppsLane()" | kind=code-symbol | source=src/features/worklog/components/progress-apps-lane.tsx:L80 | neighbors=[progress-apps-lane.tsx, page.tsx]
- "components_progress_apps_lane_sprintblock": "SprintBlock()" | kind=code-symbol | source=src/features/worklog/components/progress-apps-lane.tsx:L44 | neighbors=[progress-apps-lane.tsx, noon()]
- "components_progress_filters_noon": "noon()" | kind=code-symbol | source=src/features/worklog/components/progress-filters.tsx:L38 | neighbors=[progress-filters.tsx, ProgressFiltersInner()]
- "components_progress_filters_progressfilters": "ProgressFilters()" | kind=code-symbol | source=src/features/worklog/components/progress-filters.tsx:L42 | neighbors=[progress-filters.tsx, page.tsx]
- "components_progress_filters_progressfiltersinner": "ProgressFiltersInner()" | kind=code-symbol | source=src/features/worklog/components/progress-filters.tsx:L53 | neighbors=[progress-filters.tsx, noon()]
- "components_progress_matrix_compactcoverage": "compactCoverage()" | kind=code-symbol | source=src/features/worklog/components/progress-matrix.tsx:L58 | neighbors=[progress-matrix.tsx, num()]
- "components_progress_matrix_noon": "noon()" | kind=code-symbol | source=src/features/worklog/components/progress-matrix.tsx:L36 | neighbors=[progress-matrix.tsx, ProgressMatrix()]
- "components_progress_matrix_num": "num()" | kind=code-symbol | source=src/features/worklog/components/progress-matrix.tsx:L50 | neighbors=[progress-matrix.tsx, compactCoverage()]
- "components_project_finance_card_hours": "hours()" | kind=code-symbol | source=src/features/finance/components/project-finance-card.tsx:L49 | neighbors=[project-finance-card.tsx, CostFigure()]
- "components_project_finance_card_shiftdays": "shiftDays()" | kind=code-symbol | source=src/features/finance/components/project-finance-card.tsx:L213 | neighbors=[project-finance-card.tsx, ProjectFinanceCard()]
- "components_recent_activity_card_recentactivitycard": "RecentActivityCard()" | kind=code-symbol | source=src/features/dashboard/components/recent-activity-card.tsx:L20 | neighbors=[dashboard-zones.tsx, recent-activity-card.tsx]
- "components_recording_takes_recordingtakes": "RecordingTakes()" | kind=code-symbol | source=src/features/meetings/components/recording-takes.tsx:L40 | neighbors=[meeting-intel.tsx, recording-takes.tsx]
- "components_replace_review_dialog_defaultselection": "defaultSelection()" | kind=code-symbol | source=src/features/meetings/components/replace-review-dialog.tsx:L319 | neighbors=[replace-review-dialog.tsx, ReplaceReviewDialog()]
- "components_report_bug_dialog_reportbugdialog": "ReportBugDialog()" | kind=code-symbol | source=src/features/bugs/components/report-bug-dialog.tsx:L45 | neighbors=[report-bug-dialog.tsx, page.tsx]
- "components_roadmap_roadmap": "Roadmap()" | kind=code-symbol | source=src/features/sprints/components/roadmap.tsx:L31 | neighbors=[roadmap.tsx, page.tsx]
- "components_roadmap_spine_roadmapspine": "RoadmapSpine()" | kind=code-symbol | source=src/features/sprints/components/roadmap-spine.tsx:L103 | neighbors=[roadmap-spine.tsx, page.tsx]
- "components_roadmap_timeline_barbody": "BarBody()" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L1265 | neighbors=[roadmap-timeline.tsx, dragId()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-089.json

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
