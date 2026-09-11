# Node Description Batch 24 of 166

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
For an entity node (any other kind — e.g. a person, place, event, object),
describe what the entity is and its role, grounded in its type, its
relations (neighbors) and the provided citations/evidence — e.g.
"Lady Carfax, a wealthy heiress who disappears en route to Lausanne.".
Ground entity descriptions in the citations/evidence when present; do not
speculate beyond the context, so a node with no supporting context may be
left out of the reply.
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "commit:repo:github.com/DeegayuA/LogPup@272f9a7df3cea9262204754d184b901d67acd67c": "272f9a7 feat(meetings): store the decision, never the suggestion" | kind=Commit | source=git | neighbors=[main, 8dd587b feat(people): filter and sort t…, live.test.ts, schema.ts, 0054_meeting_load_decisions.sql, load-actions.ts]
- "commit:repo:github.com/DeegayuA/LogPup@4d94451612e4e5c87ae03a41aefcbe1ee9e44f4d": "4d94451 feat(meetings): a recurrence rule, and the dates it actually means" | kind=Commit | source=git | neighbors=[main, 966d695 feat(intel): the briefing uses …, schema.ts, 0056_recurring_meetings.sql, calendar-grid.ts, recurrence.ts]
- "commit:repo:github.com/DeegayuA/LogPup@53262eb00e02807a9b93dc4c7e551d9338f916b8": "53262eb feat(tasks): several people can own one task" | kind=Commit | source=git | neighbors=[main, 3dcd417 feat(shell): collapse the sideb…, live.test.ts, ai-actions.ts, task-actions.ts, task-assignees.ts]
- "commit:repo:github.com/DeegayuA/LogPup@5e32b09f80a3b3f9f15e87bb60039fe1ff9d1b01": "5e32b09 fix(worklog): Fill my day ignored the day a developer actually had" | kind=Commit | source=git | neighbors=[main, 00d6621 fix(intel): one hung Gemini cal…, entry-ai-actions.ts, entry-draft-prompt.ts, entry-draft-prompt.test.ts, entry-evidence.ts]
- "commit:repo:github.com/DeegayuA/LogPup@7d546943ab3e77ffe2bb2d753697a722e5427ef2": "7d54694 feat(db): the work substrate, and the index the bell never had" | kind=Commit | source=git | neighbors=[24fb822 fix(worklog): two absence write…, main, ce0fabf feat(worklog): a refused day of…, live.ts, live.test.ts, schema.ts]
- "commit:repo:github.com/DeegayuA/LogPup@85c3961fdf8323033854a8750d0441f0e983362d": "85c3961 feat(finance): cost and worth data substrate — tables and pure maths" | kind=Commit | source=git | neighbors=[main, 82d20fd docs(home): the KNOWN LIMIT par…, schema.ts, 0048_project_finance.sql, cost.ts, cost.test.ts]
- "commit:repo:github.com/DeegayuA/LogPup@c5251d499369467f69ce0d4fa9ad4afaa252d37b": "c5251d4 fix(gemini): six holes an adversarial review shot in the meter, closed" | kind=Commit | source=git | neighbors=[00d6621 fix(intel): one hung Gemini cal…, main, 3ed16a6 feat(worklog): fix an entry's k…, ai-meter-dock.tsx, ai-meter-provider.tsx, meeting-intel.tsx]
- "commit:repo:github.com/DeegayuA/LogPup@c9a2906ececcd919c15d7f6f2486e474fae73c3b": "c9a2906 Centralize absence kinds and add missing kinds" | kind=Commit | source=git | neighbors=[a4b271b Improve leave types and worklog…, main, 419d875 Unify worklog logging with AI c…, schema.ts, 0068_absence_kinds.sql, absence-actions.ts]
- "commit:repo:github.com/DeegayuA/LogPup@d2690965f275ac2307843f2458ad96bbc1975cde": "d269096 feat(intel): keep the Ask LogPup conversation, and stop printing UUIDs …" | kind=Commit | source=git | neighbors=[bd5f524 feat(gemini): the honest half o…, main, 8bacbca ., ask-panel.tsx, answer-links.ts, answer-links.test.ts]
- "commit:repo:github.com/DeegayuA/LogPup@e73a38e0c560ea5bfae786b0df73062767d451a9": "e73a38e fix(live): mint tokens with the REST field name, and pin the resumption…" | kind=Commit | source=git | neighbors=[8c996d9 feat(notifications): a mention …, main, 59873cc feat(gemini): a monthly AI budg…, use-live-transcription.ts, actions.ts, live-client.ts]
- "commit:repo:github.com/DeegayuA/LogPup@e8b2ac22fb30c5f15f334541057eb11649ab48c1": "e8b2ac2 feat(worklog): hours you logged stop counting as nothing logged" | kind=Commit | source=git | neighbors=[72473a0 feat(meetings): alt-drag a bloc…, main, 49350d6 feat(meetings): "Copy here" — t…, worklog-calendar.tsx, day-state.ts, day-state.test.ts]
- "components_activity_skeleton": "activity-skeleton.tsx" | kind=code-symbol | source=src/features/activity/components/activity-skeleton.tsx:L1 | neighbors=[loading.tsx, page.tsx, ActivityControlsSkeleton(), ActivityTrailSkeleton(), DaySkeleton(), ROW_WIDTHS]
- "components_admin_nav": "admin-nav.tsx" | kind=code-symbol | source=src/features/admin/components/admin-nav.tsx:L1 | neighbors=[layout.tsx, 3ba31df feat(shell): every admin sectio…, sections.ts, AdminSection, AdminNav(), NavItem()]
- "components_ai_feature_toggle": "ai-feature-toggle.tsx" | kind=code-symbol | source=src/features/gemini/components/ai-feature-toggle.tsx:L1 | neighbors=[AiFeatureToggle(), actions.ts, setAiFeaturePref(), ai-features.ts, AiFeatureId, switch.tsx]
- "components_app_tab_nav": "app-tab-nav.tsx" | kind=code-symbol | source=src/features/apps/components/app-tab-nav.tsx:L1 | neighbors=[tabs.ts, APP_TAB_LABEL, appTabHref(), AppTabId, AppTabNav(), utils.ts]
- "components_capacity_bar_capacityband": "CapacityBand" | kind=code-symbol | source=src/features/people/components/capacity-bar.tsx:L6 | neighbors=[assignments-card.tsx, capacity-bar.tsx, capacity-bar.test.ts, capacity-card.tsx, history-views.tsx, plates.tsx]
- "components_capacity_bar_capacitybar": "CapacityBar()" | kind=code-symbol | source=src/features/people/components/capacity-bar.tsx:L45 | neighbors=[assignments-card.tsx, capacity-bar.tsx, capacity-heat.tsx, capacity-heat-editable.tsx, directory.tsx, history-views.tsx]
- "components_delete_app_card": "delete-app-card.tsx" | kind=code-symbol | source=src/features/apps/components/delete-app-card.tsx:L1 | neighbors=[actions.ts, deleteApp(), DeleteAppCard(), button.tsx, Button(), input.tsx]
- "components_maintenance_chrome": "maintenance-chrome.ts" | kind=code-symbol | source=src/features/maintenance/components/maintenance-chrome.ts:L1 | neighbors=[8bacbca ., maintenance-banner.tsx, KIND_ICONS, window.ts, MaintenanceKind, maintenance-controls.tsx]
- "components_markdown_lite": "markdown-lite.tsx" | kind=code-symbol | source=src/components/markdown-lite.tsx:L1 | neighbors=[MarkdownLite(), renderInline(), utils.ts, cn(), meeting-notes.tsx, meeting-notes-dialog.tsx]
- "components_meeting_load_link": "meeting-load-link.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-load-link.tsx:L1 | neighbors=[a1e0845 ., MeetingLoadLink(), MeetingLoadLinkFallback(), load-actions.ts, getMeetingLoadSuggestions(), button.tsx]
- "components_meeting_panels_usepanels": "usePanels()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L258 | neighbors=[meeting-intel.tsx, meeting-notes.tsx, meeting-panels.tsx, FilterBar(), Panel(), PanelNav()]
- "components_passkey_nudge": "passkey-nudge.tsx" | kind=code-symbol | source=src/features/auth/components/passkey-nudge.tsx:L1 | neighbors=[page.tsx, passkey-nudge-banner.tsx, PasskeyNudgeBanner(), PasskeyNudge(), index.ts, Db]
- "components_plan_read_strip": "plan-read-strip.tsx" | kind=code-symbol | source=src/features/sprints/components/plan-read-strip.tsx:L1 | neighbors=[PlanReadStrip(), utils.ts, cn(), checkins.ts, plan-read.ts, PlanGaps]
- "components_portfolio_summary": "portfolio-summary.tsx" | kind=code-symbol | source=src/features/apps/components/portfolio-summary.tsx:L1 | neighbors=[page.tsx, dashboard-zones.tsx, app-health.ts, PortfolioSummary, PortfolioSummaryStrip(), Tile]
- "db_schema_bugreports": "bugReports" | kind=code-symbol | source=src/db/schema.ts:L1956 | neighbors=[backup.ts, trash-actions.ts, trash-queries.ts, actions.ts, actions.test.ts, import-actions.ts]
- "e2e_env": "env.ts" | kind=code-symbol | source=e2e/env.ts:L1 | neighbors=[auth.setup.ts, loadEnvFile(), repoRoot, meeting-load.spec.ts, seed.ts, seed-user.ts]
- "gemini_actions_test": "actions.test.ts" | kind=code-symbol | source=src/features/gemini/actions.test.ts:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, schema.ts, userAiPrefs, actions.ts, { authMock, upsertSpy }, { dbMock, fetchMock }]
- "gemini_pricing_test": "pricing.test.ts" | kind=code-symbol | source=src/features/gemini/pricing.test.ts:L1 | neighbors=[models.ts, QUICK_MODELS, SYNTHESIS_MODELS, TTS_MODEL_FALLBACK_ORDER, pricing.ts, estimateCostUsd()]
- "gemini_readiness_test": "readiness.test.ts" | kind=code-symbol | source=src/features/gemini/readiness.test.ts:L1 | neighbors=[readiness.ts, assessRecordingReadiness(), estimateSessionShare(), indicativeHoursPerKey(), KeyHealth, key()]
- "gemini_retry": "retry.ts" | kind=code-symbol | source=src/features/gemini/retry.ts:L1 | neighbors=[client.ts, backoffDelayMs(), parseRetryAfterMs(), RETRIABLE_STATUSES, shouldRetry(), sleep()]
- "home_spotlight_card": "spotlight-card.tsx" | kind=code-symbol | source=src/app/(public)/home/spotlight-card.tsx:L1 | neighbors=[d0da911 test(gemini): a public page may…, bento-features.tsx, capabilities-grid.tsx, scope-notice.tsx, SpotlightCard(), SpotlightCardProps]
- "hooks_use_smart_poll": "use-smart-poll.ts" | kind=code-symbol | source=src/hooks/use-smart-poll.ts:L1 | neighbors=[maintenance-gate.tsx, notification-bell-client.tsx, SmartPollOptions, useSmartPoll(), poll-schedule.ts, nextPollDelay()]
- "id_loading": "loading.tsx" | kind=code-symbol | source=src/app/print/meetings/[id]/loading.tsx:L1 | neighbors=[a4b271b Improve leave types and worklog…, CardSkeleton(), MeetingPrintLoading(), PersonDetailLoading(), utils.ts, cn()]
- "intel_briefing_fallback_test": "briefing-fallback.test.ts" | kind=code-symbol | source=src/features/intel/briefing-fallback.test.ts:L1 | neighbors=[a1e0845 ., briefing-fallback.ts, deriveBriefing(), derive(), input(), signals.ts]
- "intel_bubble_bus": "bubble-bus.ts" | kind=code-symbol | source=src/features/intel/bubble-bus.ts:L1 | neighbors=[bee388b feat(intel): fold the page into…, ask-bubble.tsx, command-center.tsx, BubbleView, OpenBubbleRequest, openIntelBubble()]
- "intel_chat_history_test": "chat-history.test.ts" | kind=code-symbol | source=src/features/intel/chat-history.test.ts:L1 | neighbors=[d269096 feat(intel): keep the Ask LogPu…, chat-history.ts, appendTurn(), capBytes(), ChatTurn, parseChat()]
- "intel_commands": "commands.ts" | kind=code-symbol | source=src/features/intel/commands.ts:L1 | neighbors=[232b7ef ., bee388b feat(intel): fold the page into…, bubble-bus.ts, openIntelBubble(), commands, types.ts]
- "intel_signals_plural": "plural()" | kind=code-symbol | source=src/features/intel/signals.ts:L113 | neighbors=[signals.ts, mergeableMeetingSignal(), overdueTaskSignal(), quietAppSignals(), sprintRiskSignals(), staleFollowupSignal()]
- "lib_access_gate": "access-gate.ts" | kind=code-symbol | source=src/lib/access-gate.ts:L1 | neighbors=[route.ts, canAccessApp(), mayHoldSession(), UserStatus, access-gate.test.ts, auth.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-023.json

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
