# Node Description Batch 104 of 166

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

- "meetings_planner_planpersonrow": "PlanPersonRow" | kind=code-symbol | source=src/features/meetings/planner.ts:L132 | neighbors=[planner.ts, planner-actions.ts]
- "meetings_planner_planprojectrow": "PlanProjectRow" | kind=code-symbol | source=src/features/meetings/planner.ts:L122 | neighbors=[planner.ts, planner-actions.ts]
- "meetings_planner_planrolerow": "PlanRoleRow" | kind=code-symbol | source=src/features/meetings/planner.ts:L134 | neighbors=[planner.ts, planner-actions.ts]
- "meetings_planner_plansprintrow": "PlanSprintRow" | kind=code-symbol | source=src/features/meetings/planner.ts:L149 | neighbors=[planner.ts, planner-actions.ts]
- "meetings_planner_plantaskrow": "PlanTaskRow" | kind=code-symbol | source=src/features/meetings/planner.ts:L141 | neighbors=[planner.ts, planner-actions.ts]
- "meetings_queries_attachapps": "attachApps()" | kind=code-symbol | source=src/features/meetings/queries.ts:L122 | neighbors=[queries.ts, hydrate()]
- "meetings_queries_attachattendees": "attachAttendees()" | kind=code-symbol | source=src/features/meetings/queries.ts:L73 | neighbors=[queries.ts, hydrate()]
- "meetings_queries_getupcomingmeetingsforuser": "getUpcomingMeetingsForUser()" | kind=code-symbol | source=src/features/meetings/queries.ts:L414 | neighbors=[queries.ts, hydrate()]
- "meetings_queries_listmeetings": "listMeetings()" | kind=code-symbol | source=src/features/meetings/queries.ts:L175 | neighbors=[queries.ts, hydrate()]
- "meetings_queries_pastmeetingcursor": "PastMeetingCursor" | kind=code-symbol | source=src/features/meetings/queries.ts:L191 | neighbors=[list-actions.ts, queries.ts]
- "meetings_recording_actions_closerecordingtake": "closeRecordingTake()" | kind=code-symbol | source=src/features/meetings/recording-actions.ts:L83 | neighbors=[meeting-intel.tsx, recording-actions.ts]
- "meetings_recording_actions_deleterecordingtake": "deleteRecordingTake()" | kind=code-symbol | source=src/features/meetings/recording-actions.ts:L119 | neighbors=[recording-takes.tsx, recording-actions.ts]
- "meetings_recording_actions_getmeetingrecordings": "getMeetingRecordings()" | kind=code-symbol | source=src/features/meetings/recording-actions.ts:L230 | neighbors=[recording-takes.tsx, recording-actions.ts]
- "meetings_recording_actions_openrecordingtake": "openRecordingTake()" | kind=code-symbol | source=src/features/meetings/recording-actions.ts:L44 | neighbors=[meeting-intel.tsx, recording-actions.ts]
- "meetings_recording_actions_restorerecordingtake": "restoreRecordingTake()" | kind=code-symbol | source=src/features/meetings/recording-actions.ts:L175 | neighbors=[recording-takes.tsx, recording-actions.ts]
- "meetings_recording_progress_cappercent": "capPercent()" | kind=code-symbol | source=src/features/meetings/recording-progress.ts:L171 | neighbors=[recording-progress.ts, MeetingProcessing]
- "meetings_recording_progress_segmentsnapshot": "SegmentSnapshot" | kind=code-symbol | source=src/features/meetings/recording-progress.ts:L27 | neighbors=[recording-progress.ts, recording-progress.test.ts]
- "meetings_recording_progress_takesnapshot": "TakeSnapshot" | kind=code-symbol | source=src/features/meetings/recording-progress.ts:L39 | neighbors=[recording-progress.ts, recording-progress.test.ts]
- "meetings_recording_queries_listmeetingrecordings": "listMeetingRecordings()" | kind=code-symbol | source=src/features/meetings/recording-queries.ts:L51 | neighbors=[recording-actions.ts, recording-queries.ts]
- "meetings_recording_queries_recordingtake": "RecordingTake" | kind=code-symbol | source=src/features/meetings/recording-queries.ts:L19 | neighbors=[recording-takes.tsx, recording-queries.ts]
- "meetings_recurrence_recurrencerule": "RecurrenceRule" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L31 | neighbors=[recurrence.ts, recurrence.test.ts]
- "meetings_rsvp_actions_removemeetingattendee": "removeMeetingAttendee()" | kind=code-symbol | source=src/features/meetings/rsvp-actions.ts:L147 | neighbors=[rsvp-actions.ts, attendanceHistoryStatements()]
- "meetings_rsvp_actions_setmeetinglink": "setMeetingLink()" | kind=code-symbol | source=src/features/meetings/rsvp-actions.ts:L224 | neighbors=[meeting-rsvp.tsx, rsvp-actions.ts]
- "meetings_search_providers_searchproviders": "searchProviders" | kind=code-symbol | source=src/features/meetings/search-providers.ts:L42 | neighbors=[search-providers.ts, providers.ts]
- "meetings_segment_queue_afterattempt": "afterAttempt()" | kind=code-symbol | source=src/features/meetings/segment-queue.ts:L75 | neighbors=[segment-queue.ts, segment-queue.test.ts]
- "meetings_segment_queue_canretry": "canRetry()" | kind=code-symbol | source=src/features/meetings/segment-queue.ts:L63 | neighbors=[segment-queue.ts, segment-queue.test.ts]
- "meetings_segment_queue_isoutstanding": "isOutstanding()" | kind=code-symbol | source=src/features/meetings/segment-queue.ts:L41 | neighbors=[segment-queue.ts, isSettled()]
- "meetings_segment_queue_issettled": "isSettled()" | kind=code-symbol | source=src/features/meetings/segment-queue.ts:L36 | neighbors=[segment-queue.ts, isOutstanding()]
- "meetings_segment_queue_requeue": "requeue()" | kind=code-symbol | source=src/features/meetings/segment-queue.ts:L86 | neighbors=[segment-queue.ts, segment-queue.test.ts]
- "meetings_segment_queue_segmentphase": "SegmentPhase" | kind=code-symbol | source=src/features/meetings/segment-queue.ts:L26 | neighbors=[meeting-intel.tsx, segment-queue.ts]
- "meetings_segment_store_keyfor": "keyFor()" | kind=code-symbol | source=src/features/meetings/segment-store.ts:L43 | neighbors=[segment-store.ts, parkSegment()]
- "meetings_segment_store_opendb": "openDb()" | kind=code-symbol | source=src/features/meetings/segment-store.ts:L54 | neighbors=[segment-store.ts, runTransaction()]
- "meetings_share_actions_getmeetingshareinfo": "getMeetingShareInfo()" | kind=code-symbol | source=src/features/meetings/share-actions.ts:L38 | neighbors=[meeting-share-dialog.tsx, share-actions.ts]
- "meetings_share_actions_meetingshareinfo": "MeetingShareInfo" | kind=code-symbol | source=src/features/meetings/share-actions.ts:L12 | neighbors=[meeting-share-dialog.tsx, share-actions.ts]
- "meetings_share_buildmeetingsharemessage": "buildMeetingShareMessage()" | kind=code-symbol | source=src/features/meetings/share.ts:L16 | neighbors=[meeting-share-dialog.tsx, share.ts]
- "meetings_share_mailtohref": "mailtoHref()" | kind=code-symbol | source=src/features/meetings/share.ts:L38 | neighbors=[meeting-share-dialog.tsx, share.ts]
- "meetings_split_upcoming": "split-upcoming.ts" | kind=code-symbol | source=src/features/meetings/split-upcoming.ts:L1 | neighbors=[splitByUpcoming(), split-upcoming.test.ts]
- "meetings_split_upcoming_splitbyupcoming": "splitByUpcoming()" | kind=code-symbol | source=src/features/meetings/split-upcoming.ts:L18 | neighbors=[split-upcoming.ts, split-upcoming.test.ts]
- "meetings_text_replace_actions_decodetargetid": "decodeTargetId()" | kind=code-symbol | source=src/features/meetings/text-replace-actions.ts:L44 | neighbors=[text-replace-actions.ts, applyMeetingReplacements()]
- "meetings_text_replace_actions_encodetargetid": "encodeTargetId()" | kind=code-symbol | source=src/features/meetings/text-replace-actions.ts:L40 | neighbors=[text-replace-actions.ts, fetchTargets()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-103.json

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
