# Node Description Batch 73 of 166

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

- "meetings_recurrence_stride": "stride()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L67 | neighbors=[recurrence.ts, expand(), rruleFor()]
- "meetings_recurrence_weekindex": "weekIndex()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L100 | neighbors=[recurrence.ts, expand(), dayNumber()]
- "meetings_reschedule_daykeytodate": "dayKeyToDate()" | kind=code-symbol | source=src/features/meetings/reschedule.ts:L9 | neighbors=[meetings-month-calendar.tsx, reschedule.ts, reschedule.test.ts]
- "meetings_reschedule_movemeetingtoday": "moveMeetingToDay()" | kind=code-symbol | source=src/features/meetings/reschedule.ts:L34 | neighbors=[meetings-month-calendar.tsx, reschedule.ts, reschedule.test.ts]
- "meetings_reschedule_test": "reschedule.test.ts" | kind=code-symbol | source=src/features/meetings/reschedule.test.ts:L1 | neighbors=[reschedule.ts, dayKeyToDate(), moveMeetingToDay()]
- "meetings_rsvp_actions_attendancehistorystatements": "attendanceHistoryStatements()" | kind=code-symbol | source=src/features/meetings/rsvp-actions.ts:L36 | neighbors=[rsvp-actions.ts, removeMeetingAttendee(), respondToMeeting()]
- "meetings_screen_keyframes_computedhash": "computeDHash()" | kind=code-symbol | source=src/features/meetings/screen-keyframes.ts:L70 | neighbors=[use-screen-keyframes.ts, screen-keyframes.ts, screen-keyframes.test.ts]
- "meetings_screen_keyframes_computedownscaleddimensions": "computeDownscaledDimensions()" | kind=code-symbol | source=src/features/meetings/screen-keyframes.ts:L170 | neighbors=[use-screen-keyframes.ts, screen-keyframes.ts, screen-keyframes.test.ts]
- "meetings_screen_keyframes_hammingdistance": "hammingDistance()" | kind=code-symbol | source=src/features/meetings/screen-keyframes.ts:L92 | neighbors=[use-screen-keyframes.ts, screen-keyframes.ts, screen-keyframes.test.ts]
- "meetings_screen_keyframes_shouldkeepframe": "shouldKeepFrame()" | kind=code-symbol | source=src/features/meetings/screen-keyframes.ts:L137 | neighbors=[use-screen-keyframes.ts, screen-keyframes.ts, screen-keyframes.test.ts]
- "meetings_segment_queue_nexttoupload": "nextToUpload()" | kind=code-symbol | source=src/features/meetings/segment-queue.ts:L54 | neighbors=[meeting-intel.tsx, segment-queue.ts, segment-queue.test.ts]
- "meetings_segment_queue_phaselabel": "phaseLabel()" | kind=code-symbol | source=src/features/meetings/segment-queue.ts:L125 | neighbors=[meeting-intel.tsx, segment-queue.ts, segment-queue.test.ts]
- "meetings_segment_queue_queuedsegment": "QueuedSegment" | kind=code-symbol | source=src/features/meetings/segment-queue.ts:L28 | neighbors=[meeting-intel.tsx, segment-queue.ts, segment-queue.test.ts]
- "meetings_segment_queue_queueprogress": "QueueProgress" | kind=code-symbol | source=src/features/meetings/segment-queue.ts:L90 | neighbors=[meeting-intel.tsx, segment-queue.ts, segment-queue.test.ts]
- "meetings_segment_store_loadparkedsegments": "loadParkedSegments()" | kind=code-symbol | source=src/features/meetings/segment-store.ts:L137 | neighbors=[meeting-intel.tsx, segment-store.ts, runTransaction()]
- "meetings_segment_store_releasesegment": "releaseSegment()" | kind=code-symbol | source=src/features/meetings/segment-store.ts:L127 | neighbors=[meeting-intel.tsx, segment-store.ts, runTransaction()]
- "meetings_summary_length_estimateminutesfromaudiobytes": "estimateMinutesFromAudioBytes()" | kind=code-symbol | source=src/features/meetings/summary-length.ts:L40 | neighbors=[ai-actions.ts, summary-length.ts, summary-length.test.ts]
- "meetings_summary_length_estimateminutesfromtranscript": "estimateMinutesFromTranscript()" | kind=code-symbol | source=src/features/meetings/summary-length.ts:L32 | neighbors=[summary-length.ts, summaryDepthInstruction(), summary-length.test.ts]
- "meetings_text_replace_applyreplacements": "applyReplacements()" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L364 | neighbors=[text-replace.ts, text-replace-actions.ts, text-replace.test.ts]
- "meetings_text_replace_editdistance": "editDistance()" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L102 | neighbors=[text-replace.ts, findOccurrences(), text-replace.test.ts]
- "meetings_text_replace_fuzzybudget": "fuzzyBudget()" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L62 | neighbors=[text-replace.ts, findOccurrences(), text-replace.test.ts]
- "meetings_text_replace_groupoccurrences": "groupOccurrences()" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L415 | neighbors=[replace-review-dialog.tsx, text-replace.ts, text-replace.test.ts]
- "meetings_text_replace_searchtarget": "SearchTarget" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L26 | neighbors=[text-replace.ts, text-replace-actions.ts, text-replace.test.ts]
- "meetings_time_drag_isrealmove": "isRealMove()" | kind=code-symbol | source=src/features/meetings/time-drag.ts:L92 | neighbors=[meetings-time-grid.tsx, time-drag.ts, time-drag.test.ts]
- "meetings_time_drag_isrealresize": "isRealResize()" | kind=code-symbol | source=src/features/meetings/time-drag.ts:L160 | neighbors=[meetings-time-grid.tsx, time-drag.ts, time-drag.test.ts]
- "meetings_time_drag_movemeetingbydrag": "moveMeetingByDrag()" | kind=code-symbol | source=src/features/meetings/time-drag.ts:L52 | neighbors=[meetings-time-grid.tsx, time-drag.ts, time-drag.test.ts]
- "meetings_time_drag_resizemeetingendbydrag": "resizeMeetingEndByDrag()" | kind=code-symbol | source=src/features/meetings/time-drag.ts:L140 | neighbors=[meetings-time-grid.tsx, time-drag.ts, time-drag.test.ts]
- "meetings_time_drag_resizemeetingstartbydrag": "resizeMeetingStartByDrag()" | kind=code-symbol | source=src/features/meetings/time-drag.ts:L122 | neighbors=[meetings-time-grid.tsx, time-drag.ts, time-drag.test.ts]
- "mini_calendar_index_minicalendarnavigation": "MiniCalendarNavigation()" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L157 | neighbors=[upcoming-filter.tsx, index.tsx, useMiniCalendar()]
- "mini_calendar_index_minicalendartodaybutton": "MiniCalendarTodayButton()" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L202 | neighbors=[upcoming-filter.tsx, index.tsx, useMiniCalendar()]
- "motion_presence_list": "presence-list.tsx" | kind=code-symbol | source=src/components/motion/presence-list.tsx:L1 | neighbors=[007c37f ., pending-absence-list.tsx, PresenceList()]
- "motion_reveal_reveal": "Reveal()" | kind=code-symbol | source=src/components/motion/reveal.tsx:L48 | neighbors=[page.tsx, pending-absence-list.tsx, reveal.tsx]
- "motion_stagger_stagger": "Stagger()" | kind=code-symbol | source=src/components/motion/stagger.tsx:L53 | neighbors=[directory.tsx, meeting-list.tsx, stagger.tsx]
- "motion_stagger_staggeritem": "StaggerItem()" | kind=code-symbol | source=src/components/motion/stagger.tsx:L100 | neighbors=[directory.tsx, meeting-list.tsx, stagger.tsx]
- "motion_transitions_duration": "DURATION" | kind=code-symbol | source=src/components/motion/transitions.ts:L28 | neighbors=[route-transition.tsx, transitions.ts, transitions.test.ts]
- "motion_transitions_ease": "EASE" | kind=code-symbol | source=src/components/motion/transitions.ts:L41 | neighbors=[route-transition.tsx, transitions.ts, transitions.test.ts]
- "motion_transitions_entervariants": "enterVariants()" | kind=code-symbol | source=src/components/motion/transitions.ts:L124 | neighbors=[reveal.tsx, stagger.tsx, transitions.ts]
- "notifications_entity_kinds_entitykindforsource": "entityKindForSource()" | kind=code-symbol | source=src/features/notifications/entity-kinds.ts:L74 | neighbors=[entity-kinds.ts, entity-kinds.test.ts, notify.ts]
- "notifications_mention_rules_classifymention": "classifyMention()" | kind=code-symbol | source=src/features/notifications/mention-rules.ts:L63 | neighbors=[mention-rules.ts, mention-rules.test.ts, notify.ts]
- "notifications_notify_dropdeadentities": "dropDeadEntities()" | kind=code-symbol | source=src/features/notifications/notify.ts:L221 | neighbors=[notify.ts, createNotifications(), liveEntityIds()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-072.json

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
