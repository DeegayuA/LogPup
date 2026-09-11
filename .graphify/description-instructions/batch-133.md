# Node Description Batch 134 of 166

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

- "dashboard_zones_dashboardzone": "DashboardZone" | kind=code-symbol | source=src/features/dashboard/zones.ts:L168 | neighbors=[zones.ts]
- "dashboard_zones_grant_rank": "GRANT_RANK" | kind=code-symbol | source=src/features/dashboard/zones.ts:L176 | neighbors=[zones.ts]
- "dashboard_zones_test_actorfor": "actorFor()" | kind=code-symbol | source=src/features/dashboard/zones.test.ts:L24 | neighbors=[zones.test.ts]
- "dashboard_zones_test_grantof": "grantOf()" | kind=code-symbol | source=src/features/dashboard/zones.test.ts:L41 | neighbors=[zones.test.ts]
- "dashboard_zones_test_zoneids": "zoneIds()" | kind=code-symbol | source=src/features/dashboard/zones.test.ts:L39 | neighbors=[zones.test.ts]
- "dashboard_zones_zone_by_id": "ZONE_BY_ID" | kind=code-symbol | source=src/features/dashboard/zones.ts:L137 | neighbors=[zones.ts]
- "dashboard_zones_zonedefinition": "ZoneDefinition" | kind=code-symbol | source=src/features/dashboard/zones.ts:L45 | neighbors=[zones.ts]
- "db_index_getdb": "getDb()" | kind=code-symbol | source=src/db/index.ts:L14 | neighbors=[index.ts]
- "db_index_write_methods": "WRITE_METHODS" | kind=code-symbol | source=src/db/index.ts:L24 | neighbors=[index.ts]
- "db_live_livebugreportsas": "liveBugReportsAs()" | kind=code-symbol | source=src/db/live.ts:L23 | neighbors=[live.ts]
- "db_live_livemeetingseries": "liveMeetingSeries" | kind=code-symbol | source=src/db/live.ts:L52 | neighbors=[live.ts]
- "db_live_livemeetingseriesas": "liveMeetingSeriesAs()" | kind=code-symbol | source=src/db/live.ts:L37 | neighbors=[live.ts]
- "db_live_livenotesegmentsas": "liveNoteSegmentsAs()" | kind=code-symbol | source=src/db/live.ts:L31 | neighbors=[live.ts]
- "db_live_liverecordings": "liveRecordings" | kind=code-symbol | source=src/db/live.ts:L54 | neighbors=[live.ts]
- "db_live_liverecordingsas": "liveRecordingsAs()" | kind=code-symbol | source=src/db/live.ts:L41 | neighbors=[live.ts]
- "db_live_liverecordingsegments": "liveRecordingSegments" | kind=code-symbol | source=src/db/live.ts:L53 | neighbors=[live.ts]
- "db_live_liverecordingsegmentsas": "liveRecordingSegmentsAs()" | kind=code-symbol | source=src/db/live.ts:L39 | neighbors=[live.ts]
- "db_live_livescreenshotsas": "liveScreenshotsAs()" | kind=code-symbol | source=src/db/live.ts:L33 | neighbors=[live.ts]
- "db_live_livesprintsas": "liveSprintsAs()" | kind=code-symbol | source=src/db/live.ts:L29 | neighbors=[live.ts]
- "db_live_liveworklogentriesas": "liveWorklogEntriesAs()" | kind=code-symbol | source=src/db/live.ts:L35 | neighbors=[live.ts]
- "db_live_qb": "qb" | kind=code-symbol | source=src/db/live.ts:L10 | neighbors=[live.ts]
- "db_live_test_alias_re": "ALIAS_RE" | kind=code-symbol | source=src/db/live.test.ts:L193 | neighbors=[live.test.ts]
- "db_live_test_allowlist": "ALLOWLIST" | kind=code-symbol | source=src/db/live.test.ts:L101 | neighbors=[live.test.ts]
- "db_live_test_allowlistset": "allowlistSet" | kind=code-symbol | source=src/db/live.test.ts:L157 | neighbors=[live.test.ts]
- "db_live_test_check4matchindexes": "check4MatchIndexes()" | kind=code-symbol | source=src/db/live.test.ts:L526 | neighbors=[live.test.ts]
- "db_live_test_child_alias_re": "CHILD_ALIAS_RE" | kind=code-symbol | source=src/db/live.test.ts:L208 | neighbors=[live.test.ts]
- "db_live_test_child_from_re": "CHILD_FROM_RE" | kind=code-symbol | source=src/db/live.test.ts:L200 | neighbors=[live.test.ts]
- "db_live_test_child_join_re": "CHILD_JOIN_RE" | kind=code-symbol | source=src/db/live.test.ts:L207 | neighbors=[live.test.ts]
- "db_live_test_delete_allowed_functions": "DELETE_ALLOWED_FUNCTIONS" | kind=code-symbol | source=src/db/live.test.ts:L347 | neighbors=[live.test.ts]
- "db_live_test_delete_always_allowed_files": "DELETE_ALWAYS_ALLOWED_FILES" | kind=code-symbol | source=src/db/live.test.ts:L331 | neighbors=[live.test.ts]
- "db_live_test_entries": "entries" | kind=code-symbol | source=src/db/live.test.ts:L92 | neighbors=[live.test.ts]
- "db_live_test_fileentry": "FileEntry" | kind=code-symbol | source=src/db/live.test.ts:L71 | neighbors=[live.test.ts]
- "db_live_test_offender": "Offender" | kind=code-symbol | source=src/db/live.test.ts:L731 | neighbors=[live.test.ts]
- "db_live_test_raw_from_re": "RAW_FROM_RE" | kind=code-symbol | source=src/db/live.test.ts:L191 | neighbors=[live.test.ts]
- "db_live_test_raw_join_re": "RAW_JOIN_RE" | kind=code-symbol | source=src/db/live.test.ts:L192 | neighbors=[live.test.ts]
- "db_live_test_readschildtable": "readsChildTable()" | kind=code-symbol | source=src/db/live.test.ts:L211 | neighbors=[live.test.ts]
- "db_live_test_repo_root": "REPO_ROOT" | kind=code-symbol | source=src/db/live.test.ts:L69 | neighbors=[live.test.ts]
- "db_live_test_src_dir": "SRC_DIR" | kind=code-symbol | source=src/db/live.test.ts:L68 | neighbors=[live.test.ts]
- "db_live_test_walk": "walk()" | kind=code-symbol | source=src/db/live.test.ts:L73 | neighbors=[live.test.ts]
- "db_schema_absencestatus": "absenceStatus" | kind=code-symbol | source=src/db/schema.ts:L65 | neighbors=[schema.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-133.json

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
