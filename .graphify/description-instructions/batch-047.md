# Node Description Batch 48 of 166

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

- "intel_context_pack_loadworkspacesnapshot": "loadWorkspaceSnapshot()" | kind=code-symbol | source=src/features/intel/context-pack.ts:L87 | neighbors=[actions.ts, context-pack.ts, buildGrounding(), sourcesFromGrounding()]
- "intel_prompt_buildaskprompt": "buildAskPrompt()" | kind=code-symbol | source=src/features/intel/prompt.ts:L72 | neighbors=[actions.ts, prompt.ts, defence(), prompt.test.ts]
- "intel_prompt_buildbriefingprompt": "buildBriefingPrompt()" | kind=code-symbol | source=src/features/intel/prompt.ts:L103 | neighbors=[actions.ts, prompt.ts, defence(), prompt.test.ts]
- "lib_agenda_topics_matchagendatopic": "matchAgendaTopic()" | kind=code-symbol | source=src/lib/agenda-topics.ts:L640 | neighbors=[agenda-topics.ts, findEarliestKeywordMatch(), agenda-topics.test.ts, attendee-score.ts]
- "lib_app_match": "app-match.ts" | kind=code-symbol | source=src/lib/app-match.ts:L1 | neighbors=[meeting-form.tsx, AppOption, matchApp(), app-match.test.ts]
- "lib_brand": "brand.ts" | kind=code-symbol | source=src/lib/brand.ts:L1 | neighbors=[apple-icon.tsx, manifest.ts, pawSvg(), route.tsx]
- "lib_changelog_changelogentry": "ChangelogEntry" | kind=code-symbol | source=src/lib/changelog.ts:L3 | neighbors=[changelog.ts, overview.ts, overview.test.ts, version-badge.tsx]
- "lib_crypto_decryptsecret": "decryptSecret()" | kind=code-symbol | source=src/lib/crypto.ts:L37 | neighbors=[client.ts, model-discovery.ts, crypto.ts, keyFromSecret()]
- "lib_escalation_escalationstep": "EscalationStep" | kind=code-symbol | source=src/lib/escalation.ts:L21 | neighbors=[escalation.ts, workingDaysBetween(), escalation.test.ts, promises.ts]
- "lib_event_identity_identifyevent": "identifyEvent()" | kind=code-symbol | source=src/lib/event-identity.ts:L153 | neighbors=[event-identity.ts, attendeeOverlap(), titleSimilarity(), event-identity.test.ts]
- "lib_event_identity_titlesimilarity": "titleSimilarity()" | kind=code-symbol | source=src/lib/event-identity.ts:L119 | neighbors=[event-identity.ts, identifyEvent(), event-identity.test.ts, normaliseTitle()]
- "lib_field_reconcile_reconcileattendees": "reconcileAttendees()" | kind=code-symbol | source=src/lib/field-reconcile.ts:L103 | neighbors=[field-reconcile.ts, asSet(), reconcileMeeting(), field-reconcile.test.ts]
- "lib_field_reconcile_reconcilemeeting": "reconcileMeeting()" | kind=code-symbol | source=src/lib/field-reconcile.ts:L184 | neighbors=[field-reconcile.ts, reconcileAttendees(), reconcileScalar(), field-reconcile.test.ts]
- "lib_fuzzy_fuzzymatches": "fuzzyMatches()" | kind=code-symbol | source=src/lib/fuzzy.ts:L41 | neighbors=[fuzzy.ts, meeting-intent.ts, mention-match.ts, task-intent.ts]
- "lib_lk_holidays_lk_holidays": "LK_HOLIDAYS" | kind=code-symbol | source=src/lib/lk-holidays.ts:L74 | neighbors=[org-holidays-card.tsx, lk-holidays.ts, holiday-listing.ts, holiday-listing.test.ts]
- "lib_meeting_intent_extracttime": "extractTime()" | kind=code-symbol | source=src/lib/meeting-intent.ts:L154 | neighbors=[meeting-intent.ts, stripMatch(), toClock(), parseMeetingIntent()]
- "lib_mention_match_classify": "classify()" | kind=code-symbol | source=src/lib/mention-match.ts:L135 | neighbors=[mention-match.ts, tokensCoverWords(), wordsOf(), matchMentions()]
- "lib_mention_match_matchmentions": "matchMentions()" | kind=code-symbol | source=src/lib/mention-match.ts:L167 | neighbors=[mention-textarea.tsx, mention-match.ts, classify(), mention-match.test.ts]
- "lib_phone_test": "phone.test.ts" | kind=code-symbol | source=src/lib/phone.test.ts:L1 | neighbors=[phone.ts, normalizePhone(), telHref(), waHref()]
- "lib_poll_schedule_test": "poll-schedule.test.ts" | kind=code-symbol | source=src/lib/poll-schedule.test.ts:L1 | neighbors=[poll-schedule.ts, nextPollDelay(), shouldPoll(), SCHEDULE]
- "lib_project_roles_isreviewerrole": "isReviewerRole()" | kind=code-symbol | source=src/lib/project-roles.ts:L32 | neighbors=[project-roles.ts, roleBadgeTone(), project-roles.test.ts, queries.ts]
- "lib_project_roles_test": "project-roles.test.ts" | kind=code-symbol | source=src/lib/project-roles.test.ts:L1 | neighbors=[project-roles.ts, isProjectManagerRole(), isReviewerRole(), roleBadgeTone()]
- "lib_prompt_truncate_truncateatwordboundary": "truncateAtWordBoundary()" | kind=code-symbol | source=src/lib/prompt-truncate.ts:L18 | neighbors=[prompt-truncate.ts, prompt-truncate.test.ts, ai-actions.ts, day-summary.ts]
- "lib_recurrence_adddays": "addDays()" | kind=code-symbol | source=src/lib/recurrence.ts:L87 | neighbors=[recurrence.ts, at(), expandRecurrence(), weekStart()]
- "lib_recurrence_weekstart": "weekStart()" | kind=code-symbol | source=src/lib/recurrence.ts:L98 | neighbors=[recurrence.ts, expandRecurrence(), addDays(), weekdayOf()]
- "lib_session_getsessionuser": "getSessionUser()" | kind=code-symbol | source=src/lib/session.ts:L35 | neighbors=[session.ts, getSession, catch-up-actions.ts, entry-ai-actions.ts]
- "lib_sort_order": "sort-order.ts" | kind=code-symbol | source=src/lib/sort-order.ts:L1 | neighbors=[roadmap-timeline.tsx, SortOrdered, sortOrderForIndex(), sort-order.test.ts]
- "lib_sort_order_test": "sort-order.test.ts" | kind=code-symbol | source=src/lib/sort-order.test.ts:L1 | neighbors=[sort-order.ts, SortOrdered, sortOrderForIndex(), items()]
- "lib_task_intent_multi_test": "task-intent-multi.test.ts" | kind=code-symbol | source=src/lib/task-intent-multi.test.ts:L1 | neighbors=[task-intent.ts, PEOPLE, TODAY, parseTaskIntent()]
- "lib_tech_tags_canonicalizetag": "canonicalizeTag()" | kind=code-symbol | source=src/lib/tech-tags.ts:L76 | neighbors=[actions.ts, tech-tags-input.tsx, tech-tags.ts, tech-tags.test.ts]
- "lib_tech_tags_curated_tech_tags": "CURATED_TECH_TAGS" | kind=code-symbol | source=src/lib/tech-tags.ts:L39 | neighbors=[actions.ts, app-form-dialog.tsx, tech-tags.ts, tech-tags.test.ts]
- "lib_working_days_test": "working-days.test.ts" | kind=code-symbol | source=src/lib/working-days.test.ts:L1 | neighbors=[working-days.ts, isHalfWorkingDay(), isWorkingDay(), WorkingDayFraction]
- "load_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/meetings/load/error.tsx:L1 | neighbors=[a1e0845 ., MeetingLoadError(), button.tsx, Button()]
- "maintenance_freeze_maintenanceactivenow": "maintenanceActiveNow()" | kind=code-symbol | source=src/features/maintenance/freeze.ts:L96 | neighbors=[actor.ts, freeze.ts, readMaintenanceWindow(), write-freeze.ts]
- "maintenance_freeze_snapshot_notemaintenancearmed": "noteMaintenanceArmed()" | kind=code-symbol | source=src/features/maintenance/freeze-snapshot.ts:L32 | neighbors=[write-gate.test.ts, actions.ts, freeze.ts, freeze-snapshot.ts]
- "maintenance_lifecycle_runmaintenancelifecycle": "runMaintenanceLifecycle()" | kind=code-symbol | source=src/features/maintenance/lifecycle.ts:L118 | neighbors=[maintenance-mount.tsx, lifecycle.ts, announceToEveryone(), claim()]
- "maintenance_window_defaultwindow": "defaultWindow()" | kind=code-symbol | source=src/features/maintenance/window.ts:L243 | neighbors=[maintenance-controls.tsx, window.ts, atLocalTime(), window.test.ts]
- "maintenance_window_formatduration": "formatDuration()" | kind=code-symbol | source=src/features/maintenance/window.ts:L182 | neighbors=[window.ts, autoMessage(), formatWindowSummary(), window.test.ts]
- "maintenance_window_maintenance_kinds": "MAINTENANCE_KINDS" | kind=code-symbol | source=src/features/maintenance/window.ts:L33 | neighbors=[maintenance-controls.tsx, actions.ts, window.ts, window.test.ts]
- "maintenance_window_maintenancekind": "MaintenanceKind" | kind=code-symbol | source=src/features/maintenance/window.ts:L34 | neighbors=[maintenance-chrome.ts, maintenance-controls.tsx, lifecycle.ts, window.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-047.json

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
