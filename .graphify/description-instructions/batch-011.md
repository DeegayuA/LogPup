# Node Description Batch 12 of 166

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

- "components_use_live_transcription": "use-live-transcription.ts" | kind=code-symbol | source=src/features/transcription/components/use-live-transcription.ts:L1 | neighbors=[d5b6409 ., e73a38e fix(live): mint tokens with the…, meeting-intel.tsx, ai-meter-provider.tsx, useAiMeter(), LiveTranscriptionHandle]
- "db_schema_meetings": "meetings" | kind=code-symbol | source=src/db/schema.ts:L643 | neighbors=[actions.ts, backup.ts, change-request-appliers.ts, clear-test-data.test.ts, trash-actions.ts, trash-actions.test.ts]
- "gemini_budget_notify": "budget-notify.ts" | kind=code-symbol | source=src/features/gemini/budget-notify.ts:L1 | neighbors=[59873cc feat(gemini): a monthly AI budg…, index.ts, Db, schema.ts, users, budget.ts]
- "intel_answer_links": "answer-links.ts" | kind=code-symbol | source=src/features/intel/answer-links.ts:L1 | neighbors=[6e7c05f fix(intel): stop printing a per…, d269096 feat(intel): keep the Ask LogPu…, d78a3e1 fix(intel): the briefing links …, ask-panel.tsx, briefing-card.tsx, actions.ts]
- "lib_mention_match": "mention-match.ts" | kind=code-symbol | source=src/lib/mention-match.ts:L1 | neighbors=[8d1b390 fix(i18n): Sinhala survives eve…, mention-textarea.tsx, fuzzy.ts, fuzzyMatches(), ActiveMention, classify()]
- "meetings_ask_derivation": "ask-derivation.ts" | kind=code-symbol | source=src/features/meetings/ask-derivation.ts:L1 | neighbors=[7228d54 refactor(meetings): one derivat…, c2bc5fd refactor(tasks): route in-memor…, AskTaskRow, checkinAskContext(), checkinAskText(), isPastDue()]
- "meetings_ics": "ics.ts" | kind=code-symbol | source=src/features/meetings/ics.ts:L1 | neighbors=[add-to-calendar.tsx, meeting-list.tsx, route.ts, buildIcs(), CalendarLinkInput, escapeIcsText()]
- "meetings_search_providers": "search-providers.ts" | kind=code-symbol | source=src/features/meetings/search-providers.ts:L1 | neighbors=[514d33b feat(meetings): a meeting can b…, index.ts, Db, live.ts, liveApps, liveMeetings]
- "roles_member": "member.ts" | kind=code-symbol | source=src/features/signals/roles/member.ts:L1 | neighbors=[d5b6409 ., MemberCompletion, MemberScorecard, MemberScorecardInput, shared.ts, daysBetween()]
- "sprints_actions_test": "actions.test.ts" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L1 | neighbors=[live.ts, liveSprints, liveTasks, schema.ts, sprints, tasks]
- "sprints_search_providers": "search-providers.ts" | kind=code-symbol | source=src/features/sprints/search-providers.ts:L1 | neighbors=[364f1af fix(search): ⌘K was handing eve…, providers.ts, actor.ts, capabilities.ts, effectiveGrant(), GrantLevel]
- "ui_popover": "popover.tsx" | kind=code-symbol | source=src/components/ui/popover.tsx:L1 | neighbors=[apps-table.tsx, capacity-heat-editable.tsx, jump-to-date.tsx, meeting-form.tsx, meeting-people-picker.tsx, meeting-project-select.tsx]
- "ui_textarea_textarea": "Textarea()" | kind=code-symbol | source=src/components/ui/textarea.tsx:L5 | neighbors=[app-form-dialog.tsx, ask-panel.tsx, bug-content-editor.tsx, day-panel.tsx, declare-absence-dialog.tsx, log-box.tsx]
- "worklog_org_holiday_actions": "org-holiday-actions.ts" | kind=code-symbol | source=src/features/worklog/org-holiday-actions.ts:L1 | neighbors=[org-holidays-card.tsx, log.ts, logActivity(), actor.ts, requireCapability(), index.ts]
- "apps_contribution_queries": "contribution-queries.ts" | kind=code-symbol | source=src/features/apps/contribution-queries.ts:L1 | neighbors=[AppContribution, getAppContributions, rankContributors(), index.ts, Db, live.ts]
- "commit:repo:github.com/DeegayuA/LogPup@3ac9d682fef64df0b9016a6884200e563b07f769": "3ac9d68 ." | kind=Commit | source=git | neighbors=[main, 4e4cf9f Ask LogPup: knowledge index, gr…, day-panel.tsx, log-box.tsx, logged-days-list.tsx, actions.ts]
- "commit:repo:github.com/DeegayuA/LogPup@5c7efa500f39a98f94930addcf7165e70707b3cc": "5c7efa5 feat(meeting-load): four surfaces for a number that has to be honest" | kind=Commit | source=git | neighbors=[page.tsx, main, 8249431 test(meeting-load): end-to-end …, dashboard-zones.tsx, meeting-load-admin-card.tsx, meeting-load-card.tsx]
- "components_ai_meter_provider_useaimeter": "useAiMeter()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L121 | neighbors=[ai-meter-provider.tsx, app-form-dialog.tsx, ask-panel.tsx, audit-ask.tsx, briefing-card.tsx, catch-up-panel.tsx]
- "components_bug_triage_controls": "bug-triage-controls.tsx" | kind=code-symbol | source=src/features/bugs/components/bug-triage-controls.tsx:L1 | neighbors=[bug-list.tsx, actions.ts, triageBug(), bug-display.ts, BUG_STATUSES, BugSeverity]
- "components_dashboard_zones_pairedcards": "pairedCards()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L158 | neighbors=[dashboard-zones.tsx, AiZone(), AiZoneSkeleton(), ApprovalsZone(), ApprovalsZoneSkeleton(), CoverageZone()]
- "components_github_login_field": "github-login-field.tsx" | kind=code-symbol | source=src/features/auth/components/github-login-field.tsx:L1 | neighbors=[de4812e feat(github): commits become wo…, actions.ts, setOwnGithubLogin(), GithubLoginField(), button.tsx, Button()]
- "components_history_filters": "history-filters.tsx" | kind=code-symbol | source=src/features/people/components/history-filters.tsx:L1 | neighbors=[HistoryFilters(), HistoryFiltersInner(), utils.ts, cn(), history-params.ts, COMPARE_WINDOWS]
- "components_meeting_header_actions": "meeting-header-actions.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-header-actions.tsx:L1 | neighbors=[514d33b feat(meetings): a meeting can b…, 671c254 ., 95b092e feat(meetings): quick note and …, meeting-form.tsx, MeetingForm(), MeetingHeaderActions()]
- "components_person_summary_card": "person-summary-card.tsx" | kind=code-symbol | source=src/features/people/components/person-summary-card.tsx:L1 | neighbors=[41d5428 feat(people): the short read on…, PersonSummaryCard(), utils.ts, cn(), summary.ts, summary-actions.ts]
- "components_sprint_checkins": "sprint-checkins.tsx" | kind=code-symbol | source=src/features/sprints/components/sprint-checkins.tsx:L1 | neighbors=[sprint-checkin-editor.tsx, GapHint(), SprintCheckinEditor(), Person, SprintCheckins(), checkin-queries.ts]
- "db_live_livesprints": "liveSprints" | kind=code-symbol | source=src/db/live.ts:L48 | neighbors=[danger-actions.ts, danger-actions.test.ts, queries.ts, live.ts, ai-actions.ts, planner-actions.ts]
- "e2e_meeting_load_spec": "meeting-load.spec.ts" | kind=code-symbol | source=e2e/meeting-load.spec.ts:L1 | neighbors=[8249431 test(meeting-load): end-to-end …, index.ts, Db, schema.ts, apps, meetingAiNotes]
- "gemini_advertised_models_test": "advertised-models.test.ts" | kind=code-symbol | source=src/features/gemini/advertised-models.test.ts:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, 3d461b5 fix(home): derive advertised Ge…, d0da911 test(gemini): a public page may…, advertisedModels(), hardcodedRates(), PUBLIC_DIR]
- "gemini_meter_tasks_test": "meter-tasks.test.ts" | kind=code-symbol | source=src/features/gemini/meter-tasks.test.ts:L1 | neighbors=[13be4b6 ., a4b271b Improve leave types and worklog…, c5251d4 fix(gemini): six holes an adver…, d5b6409 ., f8a9b00 feat(gemini): the meter learns …, meter-tasks.ts]
- "gemini_model_choice_resolvechain": "resolveChain()" | kind=code-symbol | source=src/features/gemini/model-choice.ts:L170 | neighbors=[audit-nl-actions.ts, actions.ts, ai-engine.ts, model-choice.ts, defaultChainFor(), model-choice.test.ts]
- "gemini_readiness": "readiness.ts" | kind=code-symbol | source=src/features/gemini/readiness.ts:L1 | neighbors=[ai-engine-card.tsx, dashboard-zones.tsx, meeting-intel.tsx, actions.ts, queries.ts, assessRecordingReadiness()]
- "home_fortnight": "fortnight.tsx" | kind=code-symbol | source=src/app/(public)/home/fortnight.tsx:L1 | neighbors=[d0da911 test(gemini): a public page may…, bento-features.tsx, Fortnight(), getDeterministicLog(), SampleLog, SATURDAY_TASKS_POOL]
- "lib_meeting_intent": "meeting-intent.ts" | kind=code-symbol | source=src/lib/meeting-intent.ts:L1 | neighbors=[meeting-form.tsx, fuzzy.ts, fuzzyMatches(), addDays(), extractApp(), extractDay()]
- "maintenance_write_freeze": "write-freeze.ts" | kind=code-symbol | source=src/features/maintenance/write-freeze.ts:L1 | neighbors=[8bacbca ., write-gate.ts, capabilities.ts, UserRole, lk-holidays.ts, session.ts]
- "meetings_recording_queries": "recording-queries.ts" | kind=code-symbol | source=src/features/meetings/recording-queries.ts:L1 | neighbors=[817bf89 ., recording-takes.tsx, recording-actions.ts, index.ts, Db, live.ts]
- "meetings_share_actions": "share-actions.ts" | kind=code-symbol | source=src/features/meetings/share-actions.ts:L1 | neighbors=[meeting-share-dialog.tsx, capabilities.ts, isAdminRole(), index.ts, Db, live.ts]
- "notifications_queries": "queries.ts" | kind=code-symbol | source=src/features/notifications/queries.ts:L1 | neighbors=[8bacbca ., dashboard-zones.tsx, notification-bell.tsx, notification-bell-client.tsx, notifications-card.tsx, actions.ts]
- "onboarding_actions": "actions.ts" | kind=code-symbol | source=src/features/onboarding/actions.ts:L1 | neighbors=[onboarding-form.tsx, index.ts, Db, schema.ts, users, action-result.ts]
- "people_iso_day_isodayof": "isoDayOf()" | kind=code-symbol | source=src/features/people/iso-day.ts:L73 | neighbors=[format.ts, audit-filters.ts, activity-filter-bar.tsx, allocation-trend.tsx, dashboard-zones.tsx, rate-actions.ts]
- "people_search_providers": "search-providers.ts" | kind=code-symbol | source=src/features/people/search-providers.ts:L1 | neighbors=[364f1af fix(search): ⌘K was handing eve…, actor.ts, capabilities.ts, effectiveGrant(), index.ts, Db]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-011.json

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
