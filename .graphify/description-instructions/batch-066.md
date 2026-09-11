# Node Description Batch 67 of 166

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

- "gemini_readiness_keyhealth": "KeyHealth" | kind=code-symbol | source=src/features/gemini/readiness.ts:L24 | neighbors=[queries.ts, readiness.ts, readiness.test.ts]
- "gemini_readiness_readinesslevel": "ReadinessLevel" | kind=code-symbol | source=src/features/gemini/readiness.ts:L58 | neighbors=[readiness.ts, overview.ts, overview.test.ts]
- "gemini_retry_shouldretry": "shouldRetry()" | kind=code-symbol | source=src/features/gemini/retry.ts:L37 | neighbors=[client.ts, retry.ts, retry.test.ts]
- "gemini_retry_test": "retry.test.ts" | kind=code-symbol | source=src/features/gemini/retry.test.ts:L1 | neighbors=[retry.ts, backoffDelayMs(), shouldRetry()]
- "gemini_rotation_test": "rotation.test.ts" | kind=code-symbol | source=src/features/gemini/rotation.test.ts:L1 | neighbors=[rotation.ts, orderKeysForRotation(), key()]
- "gemini_usage_summary_adoptionaggrow": "AdoptionAggRow" | kind=code-symbol | source=src/features/gemini/usage-summary.ts:L115 | neighbors=[queries.ts, usage-summary.ts, usage-summary.test.ts]
- "gemini_usage_summary_summarizeadoption": "summarizeAdoption()" | kind=code-symbol | source=src/features/gemini/usage-summary.ts:L148 | neighbors=[ai-adoption-card.tsx, usage-summary.ts, usage-summary.test.ts]
- "gemini_usage_summary_usageaggrow": "UsageAggRow" | kind=code-symbol | source=src/features/gemini/usage-summary.ts:L15 | neighbors=[queries.ts, usage-summary.ts, usage-summary.test.ts]
- "github_app_client_appjwt": "appJwt()" | kind=code-symbol | source=src/features/github/app-client.ts:L28 | neighbors=[app-client.ts, b64url(), installationToken()]
- "github_app_client_installationtoken": "installationToken()" | kind=code-symbol | source=src/features/github/app-client.ts:L44 | neighbors=[app-client.ts, commitsByAuthor(), appJwt()]
- "github_commits_commitpromptlines": "commitPromptLines()" | kind=code-symbol | source=src/features/github/commits.ts:L54 | neighbors=[commits.ts, commits.test.ts, entry-ai-actions.ts]
- "github_commits_githubcommitrow": "GithubCommitRow" | kind=code-symbol | source=src/features/github/commits.ts:L19 | neighbors=[app-client.ts, commits.ts, commits.test.ts]
- "github_commits_tocommitevidence": "toCommitEvidence()" | kind=code-symbol | source=src/features/github/commits.ts:L29 | neighbors=[app-client.ts, commits.ts, commits.test.ts]
- "github_config_githubconfigured": "githubConfigured()" | kind=code-symbol | source=src/features/github/config.ts:L31 | neighbors=[config.ts, evidence.ts, queries.ts]
- "github_evidence_commitevidencefor": "commitEvidenceFor()" | kind=code-symbol | source=src/features/github/evidence.ts:L22 | neighbors=[evidence.ts, queries.ts, entry-evidence.ts]
- "history_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/people/history/error.tsx:L1 | neighbors=[CapacityHistoryError(), button.tsx, Button()]
- "home_ledger_sheet": "ledger-sheet.tsx" | kind=code-symbol | source=src/app/(public)/home/ledger-sheet.tsx:L1 | neighbors=[ENTRIES, LedgerSheet(), RULES]
- "home_mouse_follower": "mouse-follower.tsx" | kind=code-symbol | source=src/app/(public)/home/mouse-follower.tsx:L1 | neighbors=[d0da911 test(gemini): a public page may…, MouseFollower(), page.tsx]
- "hooks_use_smart_poll_usesmartpoll": "useSmartPoll()" | kind=code-symbol | source=src/hooks/use-smart-poll.ts:L46 | neighbors=[maintenance-gate.tsx, notification-bell-client.tsx, use-smart-poll.ts]
- "id_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/people/[id]/error.tsx:L1 | neighbors=[PersonDetailError(), button.tsx, Button()]
- "id_not_found": "not-found.tsx" | kind=code-symbol | source=src/app/(app)/people/[id]/not-found.tsx:L1 | neighbors=[PersonNotFound(), button.tsx, Button()]
- "id_page_meetingprintpage": "MeetingPrintPage()" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L308 | neighbors=[page.tsx, durationLabel(), readParam()]
- "id_print_masthead_edit_editableagenda": "EditableAgenda()" | kind=code-symbol | source=src/app/print/meetings/[id]/print-masthead-edit.tsx:L175 | neighbors=[page.tsx, print-masthead-edit.tsx, useMeetingWrite()]
- "id_print_masthead_edit_editableattendees": "EditableAttendees()" | kind=code-symbol | source=src/app/print/meetings/[id]/print-masthead-edit.tsx:L221 | neighbors=[page.tsx, print-masthead-edit.tsx, useMeetingWrite()]
- "id_print_masthead_edit_editabletitle": "EditableTitle()" | kind=code-symbol | source=src/app/print/meetings/[id]/print-masthead-edit.tsx:L136 | neighbors=[page.tsx, print-masthead-edit.tsx, useMeetingWrite()]
- "insights_page_shift": "shift()" | kind=code-symbol | source=src/app/(app)/admin/insights/page.tsx:L38 | neighbors=[page.tsx, AdminInsightsPage(), ProjectsZone()]
- "intel_actions_askavailable": "askAvailable()" | kind=code-symbol | source=src/features/intel/actions.ts:L192 | neighbors=[layout.tsx, command-center.tsx, actions.ts]
- "intel_actions_askworkspace": "askWorkspace()" | kind=code-symbol | source=src/features/intel/actions.ts:L98 | neighbors=[ask-panel.tsx, actions.ts, splitAnswer()]
- "intel_answer_links_readablelabel": "readableLabel()" | kind=code-symbol | source=src/features/intel/answer-links.ts:L154 | neighbors=[answer-links.ts, titleCase(), splitAnswerLinks()]
- "intel_briefing_fallback_ownclauses": "ownClauses()" | kind=code-symbol | source=src/features/intel/briefing-fallback.ts:L92 | neighbors=[briefing-fallback.ts, deriveBriefing(), plural()]
- "intel_briefing_fallback_teamclauses": "teamClauses()" | kind=code-symbol | source=src/features/intel/briefing-fallback.ts:L121 | neighbors=[briefing-fallback.ts, deriveBriefing(), plural()]
- "intel_bubble_bus_openintelbubble": "openIntelBubble()" | kind=code-symbol | source=src/features/intel/bubble-bus.ts:L46 | neighbors=[command-center.tsx, bubble-bus.ts, commands.ts]
- "intel_chat_history_chatturn": "ChatTurn" | kind=code-symbol | source=src/features/intel/chat-history.ts:L23 | neighbors=[ask-panel.tsx, chat-history.ts, chat-history.test.ts]
- "intel_chat_history_parsechat": "parseChat()" | kind=code-symbol | source=src/features/intel/chat-history.ts:L80 | neighbors=[ask-panel.tsx, chat-history.ts, chat-history.test.ts]
- "intel_chat_history_serializedbytes": "serializedBytes()" | kind=code-symbol | source=src/features/intel/chat-history.ts:L68 | neighbors=[chat-history.ts, capBytes(), chat-history.test.ts]
- "intel_context_pack_fit": "fit()" | kind=code-symbol | source=src/features/intel/context-pack.ts:L384 | neighbors=[context-pack.ts, buildGrounding(), render()]
- "intel_prompt_defence": "defence()" | kind=code-symbol | source=src/features/intel/prompt.ts:L39 | neighbors=[prompt.ts, buildAskPrompt(), buildBriefingPrompt()]
- "intel_prompt_parsepriority": "parsePriority()" | kind=code-symbol | source=src/features/intel/prompt.ts:L154 | neighbors=[briefing-card.tsx, prompt.ts, isInAppRoute()]
- "intel_signals_dayof": "dayOf()" | kind=code-symbol | source=src/features/intel/signals.ts:L133 | neighbors=[signals.ts, quietAppSignals(), unwrittenMeetingSignal()]
- "intel_signals_remainingworkingdays": "remainingWorkingDays()" | kind=code-symbol | source=src/features/intel/signals.ts:L147 | neighbors=[signals.ts, sprintRiskSignals(), signals.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-066.json

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
