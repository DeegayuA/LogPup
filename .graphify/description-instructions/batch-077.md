# Node Description Batch 78 of 166

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

- "sprints_queries_board": "Board" | kind=code-symbol | source=src/features/sprints/queries.ts:L37 | neighbors=[board.tsx, actions.ts, queries.ts]
- "sprints_roadmap_geometry_parseisodate": "parseIsoDate()" | kind=code-symbol | source=src/features/sprints/roadmap-geometry.ts:L29 | neighbors=[roadmap-geometry.ts, addDays(), diffDaysInclusive()]
- "sprints_roadmap_geometry_resizeend": "resizeEnd()" | kind=code-symbol | source=src/features/sprints/roadmap-geometry.ts:L87 | neighbors=[roadmap-geometry.ts, addDays(), roadmap-geometry.test.ts]
- "sprints_roadmap_geometry_resizestart": "resizeStart()" | kind=code-symbol | source=src/features/sprints/roadmap-geometry.ts:L77 | neighbors=[roadmap-geometry.ts, addDays(), roadmap-geometry.test.ts]
- "sprints_roadmap_geometry_shiftrange": "shiftRange()" | kind=code-symbol | source=src/features/sprints/roadmap-geometry.ts:L68 | neighbors=[roadmap-geometry.ts, addDays(), roadmap-geometry.test.ts]
- "sprints_roadmap_layout_snapdays": "snapDays()" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L153 | neighbors=[roadmap-timeline.tsx, roadmap-layout.ts, roadmap-layout.test.ts]
- "sprints_roadmap_layout_span": "Span" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L46 | neighbors=[roadmap-timeline.tsx, roadmap-layout.ts, roadmap-layout.test.ts]
- "sprints_roadmap_layout_zoom": "Zoom" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L26 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, roadmap-layout.ts]
- "sprints_roadmap_layout_zoom_label": "ZOOM_LABEL" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L36 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, roadmap-layout.ts]
- "sprints_roadmap_layout_zoom_levels": "ZOOM_LEVELS" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L25 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, roadmap-layout.ts]
- "sprints_sprint_date_range_parseisodate": "parseIsoDate()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L21 | neighbors=[sprint-date-range.ts, addCalendarDays(), dayDelta()]
- "sprints_task_actions_notifyassignmentifany": "notifyAssignmentIfAny()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L197 | neighbors=[task-actions.ts, createTask(), updateTask()]
- "sprints_task_actions_revalidateapps": "revalidateApps()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L222 | neighbors=[task-actions.ts, bulkUpdateTasks(), revalidateApp()]
- "sprints_task_actions_sprintisinapp": "sprintIsInApp()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L258 | neighbors=[task-actions.ts, createTask(), updateTask()]
- "sprints_task_assignees_diffassignees": "diffAssignees()" | kind=code-symbol | source=src/features/sprints/task-assignees.ts:L152 | neighbors=[task-assignees.ts, normalizeAssigneeIds(), setTaskAssignees()]
- "sprints_task_assignees_orderassignees": "orderAssignees()" | kind=code-symbol | source=src/features/sprints/task-assignees.ts:L116 | neighbors=[task-assignees.ts, getTaskAssignees(), setTaskAssignees()]
- "sprints_task_assignees_test": "task-assignees.test.ts" | kind=code-symbol | source=src/features/sprints/task-assignees.test.ts:L1 | neighbors=[53262eb feat(tasks): several people can…, task-assignees.ts, { dbStub }]
- "sprints_task_assignees_withprimaryassignee": "withPrimaryAssignee()" | kind=code-symbol | source=src/features/sprints/task-assignees.ts:L86 | neighbors=[task-actions.ts, task-assignees.ts, normalizeAssigneeIds()]
- "sprints_task_rank_compareranked": "compareRanked()" | kind=code-symbol | source=src/features/sprints/task-rank.ts:L149 | neighbors=[board.tsx, task-rank.ts, task-rank.test.ts]
- "sprints_task_rank_needsrebalance": "needsRebalance()" | kind=code-symbol | source=src/features/sprints/task-rank.ts:L68 | neighbors=[task-rank.ts, planInsert(), task-rank.test.ts]
- "sprints_task_rank_neighboursat": "neighboursAt()" | kind=code-symbol | source=src/features/sprints/task-rank.ts:L83 | neighbors=[task-rank.ts, planInsert(), task-rank.test.ts]
- "sprints_task_rank_rankbetween": "rankBetween()" | kind=code-symbol | source=src/features/sprints/task-rank.ts:L54 | neighbors=[task-rank.ts, planInsert(), task-rank.test.ts]
- "sprints_task_rank_rankforappend": "rankForAppend()" | kind=code-symbol | source=src/features/sprints/task-rank.ts:L138 | neighbors=[task-actions.ts, task-rank.ts, task-rank.test.ts]
- "sprints_task_rank_rebalance": "rebalance()" | kind=code-symbol | source=src/features/sprints/task-rank.ts:L97 | neighbors=[task-rank.ts, planInsert(), task-rank.test.ts]
- "transcription_flag_parselivetranscriptionflag": "parseLiveTranscriptionFlag()" | kind=code-symbol | source=src/features/transcription/flag.ts:L19 | neighbors=[flag.ts, isLiveTranscriptionEnabled(), flag.test.ts]
- "transcription_live_client_livestatus": "LiveStatus" | kind=code-symbol | source=src/features/transcription/live-client.ts:L33 | neighbors=[live-transcription-status.tsx, use-live-transcription.ts, live-client.ts]
- "transcription_live_client_livetranscriptionsession_start": ".start()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L120 | neighbors=[LiveTranscriptionSession, .connect(), .startWatchdog()]
- "transcription_live_client_livetranscriptionsession_teardownsocket": ".teardownSocket()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L342 | neighbors=[LiveTranscriptionSession, .handleEvent(), .stop()]
- "transcription_live_protocol_buildaudiomessage": "buildAudioMessage()" | kind=code-symbol | source=src/features/transcription/live-protocol.ts:L185 | neighbors=[live-client.ts, live-protocol.ts, live-protocol.test.ts]
- "transcription_live_protocol_buildauthtokenrequest": "buildAuthTokenRequest()" | kind=code-symbol | source=src/features/transcription/live-protocol.ts:L172 | neighbors=[live-protocol.ts, buildSetupMessage(), live-protocol.test.ts]
- "transcription_live_protocol_livesocketurl": "liveSocketUrl()" | kind=code-symbol | source=src/features/transcription/live-protocol.ts:L80 | neighbors=[live-client.ts, live-protocol.ts, live-protocol.test.ts]
- "transcription_live_protocol_parsedurationms": "parseDurationMs()" | kind=code-symbol | source=src/features/transcription/live-protocol.ts:L258 | neighbors=[live-protocol.ts, parseServerEvent(), live-protocol.test.ts]
- "transcription_pcm_bytestobase64": "bytesToBase64()" | kind=code-symbol | source=src/features/transcription/pcm.ts:L104 | neighbors=[pcm.ts, encodeAudioChunk(), pcm.test.ts]
- "transcription_pcm_downsampleto": "downsampleTo()" | kind=code-symbol | source=src/features/transcription/pcm.ts:L30 | neighbors=[pcm.ts, encodeAudioChunk(), pcm.test.ts]
- "transcription_pcm_floatto16bitpcm": "floatTo16BitPCM()" | kind=code-symbol | source=src/features/transcription/pcm.ts:L75 | neighbors=[pcm.ts, encodeAudioChunk(), pcm.test.ts]
- "transcription_pcm_int16tolittleendianbytes": "int16ToLittleEndianBytes()" | kind=code-symbol | source=src/features/transcription/pcm.ts:L85 | neighbors=[pcm.ts, encodeAudioChunk(), pcm.test.ts]
- "transcription_session_budget_formatcostestimate": "formatCostEstimate()" | kind=code-symbol | source=src/features/transcription/session-budget.ts:L90 | neighbors=[live-transcription-status.tsx, session-budget.ts, session-budget.test.ts]
- "transcription_session_budget_formatduration": "formatDuration()" | kind=code-symbol | source=src/features/transcription/session-budget.ts:L97 | neighbors=[live-transcription-status.tsx, session-budget.ts, session-budget.test.ts]
- "transcription_session_budget_isapproachingcap": "isApproachingCap()" | kind=code-symbol | source=src/features/transcription/session-budget.ts:L65 | neighbors=[meeting-intel.tsx, session-budget.ts, session-budget.test.ts]
- "transcription_transcript_buffer_committurn": "commitTurn()" | kind=code-symbol | source=src/features/transcription/transcript-buffer.ts:L61 | neighbors=[live-client.ts, transcript-buffer.ts, transcript-buffer.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-077.json

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
