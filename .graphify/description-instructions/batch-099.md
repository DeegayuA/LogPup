# Node Description Batch 100 of 166

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

- "maintenance_freeze_snapshot_resetmaintenancesnapshot": "resetMaintenanceSnapshot()" | kind=code-symbol | source=src/features/maintenance/freeze-snapshot.ts:L42 | neighbors=[write-gate.test.ts, freeze-snapshot.ts]
- "maintenance_lifecycle_claim": "claim()" | kind=code-symbol | source=src/features/maintenance/lifecycle.ts:L58 | neighbors=[lifecycle.ts, runMaintenanceLifecycle()]
- "maintenance_window_asms": "asMs()" | kind=code-symbol | source=src/features/maintenance/window.ts:L68 | neighbors=[window.ts, parseMaintenanceWindow()]
- "maintenance_window_astext": "asText()" | kind=code-symbol | source=src/features/maintenance/window.ts:L78 | neighbors=[window.ts, parseMaintenanceWindow()]
- "maintenance_window_clockformatter": "clockFormatter()" | kind=code-symbol | source=src/features/maintenance/window.ts:L284 | neighbors=[window.ts, formatClock()]
- "maintenance_window_dayformatter": "dayFormatter()" | kind=code-symbol | source=src/features/maintenance/window.ts:L293 | neighbors=[window.ts, formatMoment()]
- "maintenance_window_has": "has()" | kind=code-symbol | source=src/features/maintenance/window.ts:L82 | neighbors=[window.ts, parseMaintenanceWindow()]
- "maintenance_window_isoday": "isoDay()" | kind=code-symbol | source=src/features/maintenance/window.ts:L297 | neighbors=[window.ts, formatWindowRange()]
- "maintenance_window_kind_labels": "KIND_LABELS" | kind=code-symbol | source=src/features/maintenance/window.ts:L345 | neighbors=[maintenance-controls.tsx, window.ts]
- "maintenance_window_maintenancemode": "MaintenanceMode" | kind=code-symbol | source=src/features/maintenance/window.ts:L31 | neighbors=[maintenance-controls.tsx, window.ts]
- "maintenance_window_nextsixam": "nextSixAm()" | kind=code-symbol | source=src/features/maintenance/window.ts:L250 | neighbors=[window.ts, atLocalTime()]
- "maintenance_window_startedtitle": "startedTitle()" | kind=code-symbol | source=src/features/maintenance/window.ts:L397 | neighbors=[lifecycle.ts, window.ts]
- "maintenance_write_actions_actionsallowedduringmaintenance": "actionsAllowedDuringMaintenance()" | kind=code-symbol | source=src/features/maintenance/write-actions.ts:L35 | neighbors=[write-actions.ts, write-actions.test.ts]
- "maintenance_write_actions_maintenance_allowed_writes": "MAINTENANCE_ALLOWED_WRITES" | kind=code-symbol | source=src/features/maintenance/write-actions.ts:L26 | neighbors=[write-actions.ts, write-actions.test.ts]
- "maintenance_write_freeze_canmanagemaintenance": "canManageMaintenance()" | kind=code-symbol | source=src/features/maintenance/write-freeze.ts:L37 | neighbors=[write-freeze.ts, maintenanceWriteFrozen()]
- "maintenance_write_freeze_maintenancefreezemessage": "maintenanceFreezeMessage()" | kind=code-symbol | source=src/features/maintenance/write-freeze.ts:L49 | neighbors=[write-freeze.ts, assertWritable()]
- "meeting_load_actions_deeplinkfor": "deepLinkFor()" | kind=code-symbol | source=src/features/meeting-load/actions.ts:L143 | neighbors=[actions.ts, acceptLoadSuggestion()]
- "meeting_load_actions_isuniqueviolation": "isUniqueViolation()" | kind=code-symbol | source=src/features/meeting-load/actions.ts:L70 | neighbors=[actions.ts, decide()]
- "meeting_load_actions_maydecide": "mayDecide()" | kind=code-symbol | source=src/features/meeting-load/actions.ts:L46 | neighbors=[actions.ts, decide()]
- "meeting_load_actions_reopenloaddecision": "reopenLoadDecision()" | kind=code-symbol | source=src/features/meeting-load/actions.ts:L167 | neighbors=[actions.ts, revalidateAll()]
- "meeting_load_admin_queries_getacceptancebykind": "getAcceptanceByKind()" | kind=code-symbol | source=src/features/meeting-load/admin-queries.ts:L155 | neighbors=[page.tsx, admin-queries.ts]
- "meeting_load_admin_queries_getdismisseddecisions": "getDismissedDecisions()" | kind=code-symbol | source=src/features/meeting-load/admin-queries.ts:L78 | neighbors=[page.tsx, admin-queries.ts]
- "meeting_load_admin_queries_getobservedchangesforadmin": "getObservedChangesForAdmin()" | kind=code-symbol | source=src/features/meeting-load/admin-queries.ts:L100 | neighbors=[page.tsx, admin-queries.ts]
- "meeting_load_churn_occurrenceinvites": "OccurrenceInvites" | kind=code-symbol | source=src/features/meeting-load/churn.ts:L14 | neighbors=[churn.ts, gather.ts]
- "meeting_load_collisions_test_at": "at()" | kind=code-symbol | source=src/features/meeting-load/collisions.test.ts:L4 | neighbors=[collisions.test.ts, meeting()]
- "meeting_load_collisions_test_meeting": "meeting()" | kind=code-symbol | source=src/features/meeting-load/collisions.test.ts:L5 | neighbors=[collisions.test.ts, at()]
- "meeting_load_collisions_weekmeetinginterval": "WeekMeetingInterval" | kind=code-symbol | source=src/features/meeting-load/collisions.ts:L19 | neighbors=[collisions.ts, collisions.test.ts]
- "meeting_load_density_outputfacts": "OutputFacts" | kind=code-symbol | source=src/features/meeting-load/density.ts:L16 | neighbors=[density.ts, gather.ts]
- "meeting_load_density_partitionbymodel": "partitionByModel()" | kind=code-symbol | source=src/features/meeting-load/density.ts:L72 | neighbors=[density.ts, density.test.ts]
- "meeting_load_gather_churnfacts": "churnFacts()" | kind=code-symbol | source=src/features/meeting-load/gather.ts:L73 | neighbors=[gather.ts, queries.ts]
- "meeting_load_gather_loadfacts": "LoadFacts" | kind=code-symbol | source=src/features/meeting-load/gather.ts:L53 | neighbors=[gather.ts, queries.ts]
- "meeting_load_load_math_attendeeresponse": "AttendeeResponse" | kind=code-symbol | source=src/features/meeting-load/load-math.ts:L21 | neighbors=[gather.ts, load-math.ts]
- "meeting_load_load_math_rsvpadoptionresult": "RsvpAdoptionResult" | kind=code-symbol | source=src/features/meeting-load/load-math.ts:L65 | neighbors=[load-math.ts, queries.ts]
- "meeting_load_load_math_rsvpadoptionrow": "RsvpAdoptionRow" | kind=code-symbol | source=src/features/meeting-load/load-math.ts:L63 | neighbors=[gather.ts, load-math.ts]
- "meeting_load_observed_change_average": "average()" | kind=code-symbol | source=src/features/meeting-load/observed-change.ts:L33 | neighbors=[observed-change.ts, observedChangeFor()]
- "meeting_load_participation_median": "median()" | kind=code-symbol | source=src/features/meeting-load/participation.ts:L47 | neighbors=[participation.ts, seriesParticipationMedians()]
- "meeting_load_participation_occurrenceparticipation": "OccurrenceParticipation" | kind=code-symbol | source=src/features/meeting-load/participation.ts:L25 | neighbors=[participation.ts, suggest.ts]
- "meeting_load_participation_voicesegment": "VoiceSegment" | kind=code-symbol | source=src/features/meeting-load/participation.ts:L17 | neighbors=[gather.ts, participation.ts]
- "meeting_load_queries_getinvitedhourstrend": "getInvitedHoursTrend()" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L67 | neighbors=[queries.ts, weeklyHours()]
- "meeting_load_queries_getperappload": "getPerAppLoad()" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L125 | neighbors=[page.tsx, queries.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-099.json

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
