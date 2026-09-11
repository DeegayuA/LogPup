# Node Description Batch 98 of 166

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

- "id_print_masthead_edit_meetingeditbase": "MeetingEditBase" | kind=code-symbol | source=src/app/print/meetings/[id]/print-masthead-edit.tsx:L38 | neighbors=[page.tsx, print-masthead-edit.tsx]
- "id_print_speaker_names_printspeakernames": "PrintSpeakerNames()" | kind=code-symbol | source=src/app/print/meetings/[id]/print-speaker-names.tsx:L25 | neighbors=[page.tsx, print-speaker-names.tsx]
- "id_print_toolbar": "print-toolbar.tsx" | kind=code-symbol | source=src/app/print/meetings/[id]/print-toolbar.tsx:L1 | neighbors=[page.tsx, PrintToolbar()]
- "id_print_toolbar_printtoolbar": "PrintToolbar()" | kind=code-symbol | source=src/app/print/meetings/[id]/print-toolbar.tsx:L23 | neighbors=[page.tsx, print-toolbar.tsx]
- "id_record_timeline_recordrow": "RecordRow" | kind=code-symbol | source=src/app/print/meetings/[id]/record-timeline.tsx:L26 | neighbors=[page.tsx, record-timeline.tsx]
- "id_record_timeline_recordtimeline": "RecordTimeline()" | kind=code-symbol | source=src/app/print/meetings/[id]/record-timeline.tsx:L37 | neighbors=[page.tsx, record-timeline.tsx]
- "insights_page_admininsightspage": "AdminInsightsPage()" | kind=code-symbol | source=src/app/(app)/admin/insights/page.tsx:L49 | neighbors=[page.tsx, shift()]
- "insights_page_projectszone": "ProjectsZone()" | kind=code-symbol | source=src/app/(app)/admin/insights/page.tsx:L76 | neighbors=[page.tsx, shift()]
- "intel_actions_askcitation": "AskCitation" | kind=code-symbol | source=src/features/intel/actions.ts:L36 | neighbors=[actions.ts, answer-links.ts]
- "intel_actions_getsignals": "getSignals()" | kind=code-symbol | source=src/features/intel/actions.ts:L279 | neighbors=[intel-view.tsx, actions.ts]
- "intel_actions_parsebriefing": "parseBriefing()" | kind=code-symbol | source=src/features/intel/actions.ts:L330 | neighbors=[actions.ts, getBriefing()]
- "intel_actions_splitanswer": "splitAnswer()" | kind=code-symbol | source=src/features/intel/actions.ts:L300 | neighbors=[actions.ts, askWorkspace()]
- "intel_answer_links_findlabelnearend": "findLabelNearEnd()" | kind=code-symbol | source=src/features/intel/answer-links.ts:L109 | neighbors=[answer-links.ts, splitAnswerLinks()]
- "intel_answer_links_pushtext": "pushText()" | kind=code-symbol | source=src/features/intel/answer-links.ts:L119 | neighbors=[answer-links.ts, splitAnswerLinks()]
- "intel_answer_links_titlecase": "titleCase()" | kind=code-symbol | source=src/features/intel/answer-links.ts:L169 | neighbors=[answer-links.ts, readableLabel()]
- "intel_briefing_fallback_joinclauses": "joinClauses()" | kind=code-symbol | source=src/features/intel/briefing-fallback.ts:L25 | neighbors=[briefing-fallback.ts, deriveBriefing()]
- "intel_briefing_fallback_priorityfor": "priorityFor()" | kind=code-symbol | source=src/features/intel/briefing-fallback.ts:L44 | neighbors=[briefing-fallback.ts, plural()]
- "intel_briefing_fallback_test_derive": "derive()" | kind=code-symbol | source=src/features/intel/briefing-fallback.test.ts:L35 | neighbors=[briefing-fallback.test.ts, input()]
- "intel_briefing_fallback_test_input": "input()" | kind=code-symbol | source=src/features/intel/briefing-fallback.test.ts:L18 | neighbors=[briefing-fallback.test.ts, derive()]
- "intel_bubble_bus_bubbleview": "BubbleView" | kind=code-symbol | source=src/features/intel/bubble-bus.ts:L23 | neighbors=[ask-bubble.tsx, bubble-bus.ts]
- "intel_bubble_bus_subscribeintelbubble": "subscribeIntelBubble()" | kind=code-symbol | source=src/features/intel/bubble-bus.ts:L52 | neighbors=[ask-bubble.tsx, bubble-bus.ts]
- "intel_commands_commands": "commands" | kind=code-symbol | source=src/features/intel/commands.ts:L37 | neighbors=[commands.ts, commands.ts]
- "intel_context_pack_entrylines": "entryLines()" | kind=code-symbol | source=src/features/intel/context-pack.ts:L326 | neighbors=[context-pack.ts, buildGrounding()]
- "intel_context_pack_render": "render()" | kind=code-symbol | source=src/features/intel/context-pack.ts:L341 | neighbors=[context-pack.ts, fit()]
- "intel_context_pack_sourcesfromgrounding": "sourcesFromGrounding()" | kind=code-symbol | source=src/features/intel/context-pack.ts:L369 | neighbors=[context-pack.ts, loadWorkspaceSnapshot()]
- "intel_context_pack_workspacesnapshot": "WorkspaceSnapshot" | kind=code-symbol | source=src/features/intel/context-pack.ts:L81 | neighbors=[actions.ts, context-pack.ts]
- "intel_prompt_parsedpriority": "ParsedPriority" | kind=code-symbol | source=src/features/intel/prompt.ts:L122 | neighbors=[briefing-card.tsx, prompt.ts]
- "intel_signals_namefor": "nameFor()" | kind=code-symbol | source=src/features/intel/signals.ts:L122 | neighbors=[signals.ts, capacitySignals()]
- "intel_signals_signalkind": "SignalKind" | kind=code-symbol | source=src/features/intel/signals.ts:L27 | neighbors=[briefing-fallback.ts, signals.ts]
- "intel_signals_signalseverity": "SignalSeverity" | kind=code-symbol | source=src/features/intel/signals.ts:L25 | neighbors=[signal-board.tsx, signals.ts]
- "lib_agenda_topics_escaperegexp": "escapeRegExp()" | kind=code-symbol | source=src/lib/agenda-topics.ts:L587 | neighbors=[agenda-topics.ts, findEarliestKeywordMatch()]
- "lib_agenda_topics_topic_buckets": "TOPIC_BUCKETS" | kind=code-symbol | source=src/lib/agenda-topics.ts:L64 | neighbors=[agenda-topics.ts, agenda-topics.test.ts]
- "lib_app_match_appoption": "AppOption" | kind=code-symbol | source=src/lib/app-match.ts:L14 | neighbors=[meeting-form.tsx, app-match.ts]
- "lib_auth_ismissingcolumnerror": "isMissingColumnError()" | kind=code-symbol | source=src/lib/auth.ts:L69 | neighbors=[auth.ts, selectUsers()]
- "lib_auth_selectusers": "selectUsers()" | kind=code-symbol | source=src/lib/auth.ts:L101 | neighbors=[auth.ts, isMissingColumnError()]
- "lib_escalation_nextday": "nextDay()" | kind=code-symbol | source=src/lib/escalation.ts:L62 | neighbors=[escalation.ts, workingDaysBetween()]
- "lib_escalation_notificationkindfor": "notificationKindFor()" | kind=code-symbol | source=src/lib/escalation.ts:L142 | neighbors=[escalation.ts, escalation.test.ts]
- "lib_escalation_notifying_steps": "NOTIFYING_STEPS" | kind=code-symbol | source=src/lib/escalation.ts:L58 | neighbors=[escalation.ts, escalation.test.ts]
- "lib_escalation_step_notification_kind": "STEP_NOTIFICATION_KIND" | kind=code-symbol | source=src/lib/escalation.ts:L49 | neighbors=[escalation.ts, escalation.test.ts]
- "lib_event_identity_canautomerge": "canAutoMerge()" | kind=code-symbol | source=src/lib/event-identity.ts:L215 | neighbors=[event-identity.ts, event-identity.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-097.json

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
