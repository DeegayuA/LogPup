# Node Description Batch 144 of 166

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

- "load_page_metadata": "metadata" | kind=code-symbol | source=src/app/(app)/meetings/load/page.tsx:L16 | neighbors=[page.tsx]
- "load_page_tablesskeleton": "TablesSkeleton()" | kind=code-symbol | source=src/app/(app)/meetings/load/page.tsx:L158 | neighbors=[page.tsx]
- "maintenance_actions_arminput": "armInput" | kind=code-symbol | source=src/features/maintenance/actions.ts:L23 | neighbors=[actions.ts]
- "maintenance_freeze_maintenancerow": "MaintenanceRow" | kind=code-symbol | source=src/features/maintenance/freeze.ts:L15 | neighbors=[freeze.ts]
- "maintenance_window_extendstep": "ExtendStep" | kind=code-symbol | source=src/features/maintenance/window.ts:L269 | neighbors=[window.ts]
- "maintenance_window_maintenancepreset": "MaintenancePreset" | kind=code-symbol | source=src/features/maintenance/window.ts:L255 | neighbors=[window.ts]
- "maintenance_window_test_armed": "armed()" | kind=code-symbol | source=src/features/maintenance/window.test.ts:L25 | neighbors=[window.test.ts]
- "maintenance_window_test_row": "row()" | kind=code-symbol | source=src/features/maintenance/window.test.ts:L40 | neighbors=[window.test.ts]
- "maintenance_window_windowrange": "WindowRange" | kind=code-symbol | source=src/features/maintenance/window.ts:L235 | neighbors=[window.ts]
- "maintenance_write_freeze_maintenancefreezeerror_constructor": ".constructor()" | kind=code-symbol | source=src/features/maintenance/write-freeze.ts:L16 | neighbors=[MaintenanceFreezeError]
- "meeting_load_actions_decisioninput": "decisionInput" | kind=code-symbol | source=src/features/meeting-load/actions.ts:L32 | neighbors=[actions.ts]
- "meeting_load_actions_kinds": "KINDS" | kind=code-symbol | source=src/features/meeting-load/actions.ts:L28 | neighbors=[actions.ts]
- "meeting_load_churn_test_occ": "occ()" | kind=code-symbol | source=src/features/meeting-load/churn.test.ts:L4 | neighbors=[churn.test.ts]
- "meeting_load_collisions_collisionresult": "CollisionResult" | kind=code-symbol | source=src/features/meeting-load/collisions.ts:L27 | neighbors=[collisions.ts]
- "meeting_load_density_modelsegment": "ModelSegment" | kind=code-symbol | source=src/features/meeting-load/density.ts:L55 | neighbors=[density.ts]
- "meeting_load_density_outputcounts": "OutputCounts" | kind=code-symbol | source=src/features/meeting-load/density.ts:L30 | neighbors=[density.ts]
- "meeting_load_gather_isoweekof": "isoWeekOf()" | kind=code-symbol | source=src/features/meeting-load/gather.ts:L79 | neighbors=[gather.ts]
- "meeting_load_gather_meetingfact": "MeetingFact" | kind=code-symbol | source=src/features/meeting-load/gather.ts:L38 | neighbors=[gather.ts]
- "meeting_load_load_math_occurrencehoursinput": "OccurrenceHoursInput" | kind=code-symbol | source=src/features/meeting-load/load-math.ts:L23 | neighbors=[load-math.ts]
- "meeting_load_load_math_occurrencehoursresult": "OccurrenceHoursResult" | kind=code-symbol | source=src/features/meeting-load/load-math.ts:L30 | neighbors=[load-math.ts]
- "meeting_load_load_math_rsvpadoptioninput": "RsvpAdoptionInput" | kind=code-symbol | source=src/features/meeting-load/load-math.ts:L64 | neighbors=[load-math.ts]
- "meeting_load_load_math_test_at": "at()" | kind=code-symbol | source=src/features/meeting-load/load-math.test.ts:L4 | neighbors=[load-math.test.ts]
- "meeting_load_observed_change_observedchangeinput": "ObservedChangeInput" | kind=code-symbol | source=src/features/meeting-load/observed-change.ts:L19 | neighbors=[observed-change.ts]
- "meeting_load_observed_change_test_decided": "DECIDED" | kind=code-symbol | source=src/features/meeting-load/observed-change.test.ts:L7 | neighbors=[observed-change.test.ts]
- "meeting_load_observed_change_test_weeks": "weeks()" | kind=code-symbol | source=src/features/meeting-load/observed-change.test.ts:L4 | neighbors=[observed-change.test.ts]
- "meeting_load_participation_participationmedians": "ParticipationMedians" | kind=code-symbol | source=src/features/meeting-load/participation.ts:L43 | neighbors=[participation.ts]
- "meeting_load_queries_getmyoverlaphours": "getMyOverlapHours()" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L243 | neighbors=[queries.ts]
- "meeting_load_queries_getmypendinginvites": "getMyPendingInvites()" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L221 | neighbors=[queries.ts]
- "meeting_load_queries_medianof": "medianOf()" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L191 | neighbors=[queries.ts]
- "meeting_load_redaction_boundary_test_expectnonames": "expectNoNames()" | kind=code-symbol | source=src/features/meeting-load/redaction-boundary.test.ts:L24 | neighbors=[redaction-boundary.test.ts]
- "meeting_load_redaction_boundary_test_namey": "NAMEY" | kind=code-symbol | source=src/features/meeting-load/redaction-boundary.test.ts:L22 | neighbors=[redaction-boundary.test.ts]
- "meeting_load_series_groups_seriesgroup": "SeriesGroup" | kind=code-symbol | source=src/features/meeting-load/series-groups.ts:L40 | neighbors=[series-groups.ts]
- "meeting_load_series_groups_test_now": "NOW" | kind=code-symbol | source=src/features/meeting-load/series-groups.test.ts:L4 | neighbors=[series-groups.test.ts]
- "meeting_load_suggest_passesgates": "passesGates()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L148 | neighbors=[suggest.ts]
- "meeting_load_suggest_ruletriminvite": "ruleTrimInvite()" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L378 | neighbors=[suggest.ts]
- "meeting_load_suggest_test_kinds": "kinds()" | kind=code-symbol | source=src/features/meeting-load/suggest.test.ts:L47 | neighbors=[suggest.test.ts]
- "meeting_load_suggest_test_no_keys": "NO_KEYS" | kind=code-symbol | source=src/features/meeting-load/suggest.test.ts:L12 | neighbors=[suggest.test.ts]
- "meeting_load_trend_points_loadtrendpoint": "LoadTrendPoint" | kind=code-symbol | source=src/features/meeting-load/trend-points.ts:L15 | neighbors=[trend-points.ts]
- "meeting_load_trend_points_test_now": "NOW" | kind=code-symbol | source=src/features/meeting-load/trend-points.test.ts:L4 | neighbors=[trend-points.test.ts]
- "meetings_actions_attendeeref": "AttendeeRef" | kind=code-symbol | source=src/features/meetings/actions.ts:L280 | neighbors=[actions.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-143.json

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
