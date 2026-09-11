# Node Description Batch 141 of 166

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

- "id_page_segmentwho": "segmentWho()" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L144 | neighbors=[page.tsx]
- "id_page_source_label": "SOURCE_LABEL" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L157 | neighbors=[page.tsx]
- "id_page_stampfmt": "stampFmt" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L106 | neighbors=[page.tsx]
- "id_page_statuspill": "StatusPill()" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L296 | neighbors=[page.tsx]
- "id_page_suggestionstatus": "suggestionStatus()" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L302 | neighbors=[page.tsx]
- "id_page_timefmt": "timeFmt" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L93 | neighbors=[page.tsx]
- "id_print_masthead_edit_editorbuttons": "EditorButtons()" | kind=code-symbol | source=src/app/print/meetings/[id]/print-masthead-edit.tsx:L95 | neighbors=[print-masthead-edit.tsx]
- "id_print_masthead_edit_openbutton": "OpenButton()" | kind=code-symbol | source=src/app/print/meetings/[id]/print-masthead-edit.tsx:L116 | neighbors=[print-masthead-edit.tsx]
- "insights_page_money": "money()" | kind=code-symbol | source=src/app/(app)/admin/insights/page.tsx:L44 | neighbors=[page.tsx]
- "insights_page_peoplezone": "PeopleZone()" | kind=code-symbol | source=src/app/(app)/admin/insights/page.tsx:L173 | neighbors=[page.tsx]
- "insights_page_tableskeleton": "TableSkeleton()" | kind=code-symbol | source=src/app/(app)/admin/insights/page.tsx:L263 | neighbors=[page.tsx]
- "intel_actions_askanswer": "AskAnswer" | kind=code-symbol | source=src/features/intel/actions.ts:L38 | neighbors=[actions.ts]
- "intel_actions_askinput": "askInput" | kind=code-symbol | source=src/features/intel/actions.ts:L31 | neighbors=[actions.ts]
- "intel_actions_briefingschema": "briefingSchema" | kind=code-symbol | source=src/features/intel/actions.ts:L78 | neighbors=[actions.ts]
- "intel_answer_links_answersegment": "AnswerSegment" | kind=code-symbol | source=src/features/intel/answer-links.ts:L22 | neighbors=[answer-links.ts]
- "intel_answer_links_detail_label": "DETAIL_LABEL" | kind=code-symbol | source=src/features/intel/answer-links.ts:L136 | neighbors=[answer-links.ts]
- "intel_answer_links_section_label": "SECTION_LABEL" | kind=code-symbol | source=src/features/intel/answer-links.ts:L143 | neighbors=[answer-links.ts]
- "intel_answer_links_test_cites": "CITES" | kind=code-symbol | source=src/features/intel/answer-links.test.ts:L4 | neighbors=[answer-links.test.ts]
- "intel_briefing_fallback_entitykey": "entityKey()" | kind=code-symbol | source=src/features/intel/briefing-fallback.ts:L39 | neighbors=[briefing-fallback.ts]
- "intel_bubble_bus_openbubblerequest": "OpenBubbleRequest" | kind=code-symbol | source=src/features/intel/bubble-bus.ts:L25 | neighbors=[bubble-bus.ts]
- "intel_chat_history_chatcitation": "ChatCitation" | kind=code-symbol | source=src/features/intel/chat-history.ts:L21 | neighbors=[chat-history.ts]
- "intel_chat_history_isturn": "isTurn()" | kind=code-symbol | source=src/features/intel/chat-history.ts:L92 | neighbors=[chat-history.ts]
- "intel_chat_history_test_turn": "turn()" | kind=code-symbol | source=src/features/intel/chat-history.test.ts:L12 | neighbors=[chat-history.test.ts]
- "intel_context_pack_groundingentry": "GroundingEntry" | kind=code-symbol | source=src/features/intel/context-pack.ts:L317 | neighbors=[context-pack.ts]
- "intel_context_pack_groundingsection": "GroundingSection" | kind=code-symbol | source=src/features/intel/context-pack.ts:L319 | neighbors=[context-pack.ts]
- "intel_context_pack_groundingsource": "GroundingSource" | kind=code-symbol | source=src/features/intel/context-pack.ts:L79 | neighbors=[context-pack.ts]
- "intel_context_pack_rendersection": "renderSection()" | kind=code-symbol | source=src/features/intel/context-pack.ts:L330 | neighbors=[context-pack.ts]
- "intel_prompt_askpromptinput": "AskPromptInput" | kind=code-symbol | source=src/features/intel/prompt.ts:L63 | neighbors=[prompt.ts]
- "intel_prompt_briefingpromptinput": "BriefingPromptInput" | kind=code-symbol | source=src/features/intel/prompt.ts:L97 | neighbors=[prompt.ts]
- "intel_prompt_fences": "FENCES" | kind=code-symbol | source=src/features/intel/prompt.ts:L30 | neighbors=[prompt.ts]
- "intel_prompt_shared_rules": "SHARED_RULES" | kind=code-symbol | source=src/features/intel/prompt.ts:L48 | neighbors=[prompt.ts]
- "intel_prompt_test_base": "BASE" | kind=code-symbol | source=src/features/intel/prompt.test.ts:L20 | neighbors=[prompt.test.ts]
- "intel_prompt_test_grounding": "GROUNDING" | kind=code-symbol | source=src/features/intel/prompt.test.ts:L12 | neighbors=[prompt.test.ts]
- "intel_signals_comparesignals": "compareSignals()" | kind=code-symbol | source=src/features/intel/signals.ts:L442 | neighbors=[signals.ts]
- "intel_signals_severity_rank": "SEVERITY_RANK" | kind=code-symbol | source=src/features/intel/signals.ts:L434 | neighbors=[signals.ts]
- "intel_signals_test_input": "input()" | kind=code-symbol | source=src/features/intel/signals.test.ts:L40 | neighbors=[signals.test.ts]
- "intel_signals_test_sprint": "sprint()" | kind=code-symbol | source=src/features/intel/signals.test.ts:L57 | neighbors=[signals.test.ts]
- "lib_access_gate_userstatus": "UserStatus" | kind=code-symbol | source=src/lib/access-gate.ts:L10 | neighbors=[access-gate.ts]
- "lib_agenda_topics_agendatopicmatch": "AgendaTopicMatch" | kind=code-symbol | source=src/lib/agenda-topics.ts:L36 | neighbors=[agenda-topics.ts]
- "lib_agenda_topics_normalizeroletoken": "normalizeRoleToken()" | kind=code-symbol | source=src/lib/agenda-topics.ts:L616 | neighbors=[agenda-topics.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-140.json

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
