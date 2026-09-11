# Node Description Batch 69 of 166

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

- "maintenance_events": "events.ts" | kind=code-symbol | source=src/features/maintenance/events.ts:L1 | neighbors=[8bacbca ., maintenance-gate.tsx, commands.ts]
- "maintenance_freeze_readmaintenancerow": "readMaintenanceRow" | kind=code-symbol | source=src/features/maintenance/freeze.ts:L46 | neighbors=[freeze.ts, readMaintenanceWindow(), lifecycle.ts]
- "maintenance_freeze_snapshot_maintenancemightbearmed": "maintenanceMightBeArmed()" | kind=code-symbol | source=src/features/maintenance/freeze-snapshot.ts:L37 | neighbors=[write-gate.ts, freeze.ts, freeze-snapshot.ts]
- "maintenance_lifecycle_announcescheduled": "announceScheduled()" | kind=code-symbol | source=src/features/maintenance/lifecycle.ts:L148 | neighbors=[actions.ts, lifecycle.ts, announceToEveryone()]
- "maintenance_lifecycle_announcetoeveryone": "announceToEveryone()" | kind=code-symbol | source=src/features/maintenance/lifecycle.ts:L100 | neighbors=[lifecycle.ts, announceScheduled(), runMaintenanceLifecycle()]
- "maintenance_window_atlocaltime": "atLocalTime()" | kind=code-symbol | source=src/features/maintenance/window.ts:L229 | neighbors=[window.ts, defaultWindow(), nextSixAm()]
- "maintenance_window_backonlinemessage": "backOnlineMessage()" | kind=code-symbol | source=src/features/maintenance/window.ts:L390 | neighbors=[lifecycle.ts, window.ts, window.test.ts]
- "maintenance_window_extend_steps": "EXTEND_STEPS" | kind=code-symbol | source=src/features/maintenance/window.ts:L272 | neighbors=[maintenance-controls.tsx, window.ts, window.test.ts]
- "maintenance_window_fromdatetimelocal": "fromDatetimeLocal()" | kind=code-symbol | source=src/features/maintenance/window.ts:L208 | neighbors=[maintenance-controls.tsx, window.ts, window.test.ts]
- "maintenance_window_isurgent": "isUrgent()" | kind=code-symbol | source=src/features/maintenance/window.ts:L409 | neighbors=[maintenance-banner.tsx, window.ts, window.test.ts]
- "maintenance_window_maintenance_modes": "MAINTENANCE_MODES" | kind=code-symbol | source=src/features/maintenance/window.ts:L30 | neighbors=[maintenance-controls.tsx, actions.ts, window.ts]
- "maintenance_window_maintenance_presets": "MAINTENANCE_PRESETS" | kind=code-symbol | source=src/features/maintenance/window.ts:L262 | neighbors=[maintenance-controls.tsx, window.ts, window.test.ts]
- "maintenance_window_mode_labels": "MODE_LABELS" | kind=code-symbol | source=src/features/maintenance/window.ts:L351 | neighbors=[maintenance-controls.tsx, maintenance-details-dialog.tsx, window.ts]
- "maintenance_window_mode_summaries": "MODE_SUMMARIES" | kind=code-symbol | source=src/features/maintenance/window.ts:L357 | neighbors=[maintenance-controls.tsx, maintenance-details-dialog.tsx, window.ts]
- "maintenance_window_nextphasechangeatms": "nextPhaseChangeAtMs()" | kind=code-symbol | source=src/features/maintenance/window.ts:L147 | neighbors=[maintenance-gate.tsx, window.ts, window.test.ts]
- "maintenance_window_pad2": "pad2()" | kind=code-symbol | source=src/features/maintenance/window.ts:L158 | neighbors=[window.ts, formatCountdown(), toDatetimeLocal()]
- "maintenance_write_actions_isfrozenbymaintenance": "isFrozenByMaintenance()" | kind=code-symbol | source=src/features/maintenance/write-actions.ts:L29 | neighbors=[actor.ts, write-actions.ts, write-actions.test.ts]
- "maintenance_write_freeze_maintenancefreezeerror": "MaintenanceFreezeError" | kind=code-symbol | source=src/features/maintenance/write-freeze.ts:L14 | neighbors=[write-freeze.ts, assertWritable(), .constructor()]
- "maintenance_write_freeze_maintenancewritefrozen": "maintenanceWriteFrozen()" | kind=code-symbol | source=src/features/maintenance/write-freeze.ts:L42 | neighbors=[write-freeze.ts, assertWritable(), canManageMaintenance()]
- "meeting_load_actions_dismissloadsuggestion": "dismissLoadSuggestion()" | kind=code-symbol | source=src/features/meeting-load/actions.ts:L150 | neighbors=[suggestion-decision-buttons.tsx, actions.ts, decide()]
- "meeting_load_actions_revalidateall": "revalidateAll()" | kind=code-symbol | source=src/features/meeting-load/actions.ts:L81 | neighbors=[actions.ts, decide(), reopenLoadDecision()]
- "meeting_load_admin_queries_withnames": "withNames()" | kind=code-symbol | source=src/features/meeting-load/admin-queries.ts:L74 | neighbors=[admin-queries.ts, getAllSuggestionsForAdmin(), getSuggestionsForOrganizer()]
- "meeting_load_churn_invitechurnbetween": "inviteChurnBetween()" | kind=code-symbol | source=src/features/meeting-load/churn.ts:L17 | neighbors=[churn.ts, seriesChurnCount(), churn.test.ts]
- "meeting_load_collisions_computecollisions": "computeCollisions()" | kind=code-symbol | source=src/features/meeting-load/collisions.ts:L36 | neighbors=[collisions.ts, collisions.test.ts, queries.ts]
- "meeting_load_density_coverageof": "coverageOf()" | kind=code-symbol | source=src/features/meeting-load/density.ts:L51 | neighbors=[density.ts, density.test.ts, queries.ts]
- "meeting_load_density_deadlinescount": "deadlinesCount()" | kind=code-symbol | source=src/features/meeting-load/density.ts:L35 | neighbors=[density.ts, splitOutputs(), density.test.ts]
- "meeting_load_load_math_rsvpadoption": "rsvpAdoption()" | kind=code-symbol | source=src/features/meeting-load/load-math.ts:L80 | neighbors=[load-math.ts, load-math.test.ts, queries.ts]
- "meeting_load_observed_change_observedchange": "ObservedChange" | kind=code-symbol | source=src/features/meeting-load/observed-change.ts:L29 | neighbors=[meeting-load-admin-card.tsx, admin-queries.ts, observed-change.ts]
- "meeting_load_participation_islowparticipation": "isLowParticipation()" | kind=code-symbol | source=src/features/meeting-load/participation.ts:L76 | neighbors=[participation.ts, participation.test.ts, suggest.ts]
- "meeting_load_queries_perapploadrow": "PerAppLoadRow" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L49 | neighbors=[per-app-load.tsx, queries.ts, redaction-boundary.test.ts]
- "meeting_load_queries_seriestablerow": "SeriesTableRow" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L51 | neighbors=[series-load-table.tsx, queries.ts, redaction-boundary.test.ts]
- "meeting_load_queries_weeklyloadrow": "WeeklyLoadRow" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L38 | neighbors=[weekly-load-table.tsx, queries.ts, redaction-boundary.test.ts]
- "meeting_load_series_groups_seriesoccurrenceinput": "SeriesOccurrenceInput" | kind=code-symbol | source=src/features/meeting-load/series-groups.ts:L27 | neighbors=[gather.ts, series-groups.ts, series-groups.test.ts]
- "meeting_load_suggest_coverage": "coverage()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L133 | neighbors=[suggest.ts, ruleCancelReview(), ruleRecordOrReview()]
- "meeting_load_suggest_invitejaccard": "inviteJaccard()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L261 | neighbors=[suggest.ts, ruleShareSlot(), suggest.test.ts]
- "meeting_load_suggest_onedecimal": "oneDecimal()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L138 | neighbors=[suggest.ts, aggregateSuggestions(), ruleRecordOrReview()]
- "meeting_load_suggest_rulerecordorreview": "ruleRecordOrReview()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L339 | neighbors=[suggest.ts, coverage(), oneDecimal()]
- "meeting_load_suggest_suggestionkind": "SuggestionKind" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L31 | neighbors=[suggestion-decision-buttons.tsx, actions.ts, suggest.ts]
- "meetings_actions_teamforapp": "teamForApp()" | kind=code-symbol | source=src/features/meetings/actions.ts:L1292 | neighbors=[meeting-form.tsx, actions.ts, requireSession()]
- "meetings_ai_actions_addfollowup": "addFollowup()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2882 | neighbors=[meeting-intel.tsx, ai-actions.ts, canReadMeetingIntel()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-068.json

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
