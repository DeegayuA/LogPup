# Node Description Batch 152 of 166

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

- "meetings_visibility_test_readers": "readers" | kind=code-symbol | source=src/features/meetings/visibility.test.ts:L81 | neighbors=[visibility.test.ts]
- "meetings_visibility_test_walk": "walk()" | kind=code-symbol | source=src/features/meetings/visibility.test.ts:L72 | neighbors=[visibility.test.ts]
- "mini_calendar_index_minicalendarcontext": "MiniCalendarContext" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L37 | neighbors=[index.tsx]
- "mini_calendar_index_minicalendarcontexttype": "MiniCalendarContextType" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L27 | neighbors=[index.tsx]
- "mini_calendar_index_minicalendardayprops": "MiniCalendarDayProps" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L284 | neighbors=[index.tsx]
- "mini_calendar_index_minicalendardaysprops": "MiniCalendarDaysProps" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L251 | neighbors=[index.tsx]
- "mini_calendar_index_minicalendarnavigationprops": "MiniCalendarNavigationProps" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L151 | neighbors=[index.tsx]
- "mini_calendar_index_minicalendarprops": "MiniCalendarProps" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L73 | neighbors=[index.tsx]
- "mini_calendar_index_minicalendartodaybuttonprops": "MiniCalendarTodayButtonProps" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L198 | neighbors=[index.tsx]
- "motion_reveal_revealprops": "RevealProps" | kind=code-symbol | source=src/components/motion/reveal.tsx:L13 | neighbors=[reveal.tsx]
- "motion_stagger_staggeritemprops": "StaggerItemProps" | kind=code-symbol | source=src/components/motion/stagger.tsx:L90 | neighbors=[stagger.tsx]
- "motion_stagger_staggerprops": "StaggerProps" | kind=code-symbol | source=src/components/motion/stagger.tsx:L26 | neighbors=[stagger.tsx]
- "motion_transitions_cubic": "Cubic" | kind=code-symbol | source=src/components/motion/transitions.ts:L22 | neighbors=[transitions.ts]
- "motion_transitions_entertransition": "enterTransition" | kind=code-symbol | source=src/components/motion/transitions.ts:L69 | neighbors=[transitions.ts]
- "motion_transitions_exittransition": "exitTransition" | kind=code-symbol | source=src/components/motion/transitions.ts:L83 | neighbors=[transitions.ts]
- "motion_transitions_test_css": "css" | kind=code-symbol | source=src/components/motion/transitions.test.ts:L17 | neighbors=[transitions.test.ts]
- "motion_transitions_test_csscubic": "cssCubic()" | kind=code-symbol | source=src/components/motion/transitions.test.ts:L30 | neighbors=[transitions.test.ts]
- "motion_transitions_test_cssms": "cssMs()" | kind=code-symbol | source=src/components/motion/transitions.test.ts:L23 | neighbors=[transitions.test.ts]
- "motion_transitions_test_sources": "SOURCES" | kind=code-symbol | source=src/components/motion/transitions.test.ts:L85 | neighbors=[transitions.test.ts]
- "motion_transitions_test_src": "SRC" | kind=code-symbol | source=src/components/motion/transitions.test.ts:L75 | neighbors=[transitions.test.ts]
- "motion_transitions_test_walk": "walk()" | kind=code-symbol | source=src/components/motion/transitions.test.ts:L77 | neighbors=[transitions.test.ts]
- "next_config": "next.config.ts" | kind=code-symbol | source=next.config.ts:L1 | neighbors=[nextConfig]
- "next_config_nextconfig": "nextConfig" | kind=code-symbol | source=next.config.ts:L3 | neighbors=[next.config.ts]
- "nextauth_route": "route.ts" | kind=code-symbol | source=src/app/api/auth/[...nextauth]/route.ts:L1 | neighbors=[auth.ts]
- "notifications_actions_marknotificationread": "markNotificationRead()" | kind=code-symbol | source=src/features/notifications/actions.ts:L54 | neighbors=[actions.ts]
- "notifications_entity_kinds_entitykind": "EntityKind" | kind=code-symbol | source=src/features/notifications/entity-kinds.ts:L46 | neighbors=[entity-kinds.ts]
- "notifications_mention_rules_suppressed_reasons": "SUPPRESSED_REASONS" | kind=code-symbol | source=src/features/notifications/mention-rules.ts:L24 | neighbors=[mention-rules.ts]
- "notifications_mention_rules_test_facts": "facts()" | kind=code-symbol | source=src/features/notifications/mention-rules.test.ts:L10 | neighbors=[mention-rules.test.ts]
- "notifications_notify_insertrow": "InsertRow" | kind=code-symbol | source=src/features/notifications/notify.ts:L115 | neighbors=[notify.ts]
- "notifications_notify_mentiontarget": "MentionTarget" | kind=code-symbol | source=src/features/notifications/notify.ts:L629 | neighbors=[notify.ts]
- "notifications_notify_newnotification": "NewNotification" | kind=code-symbol | source=src/features/notifications/notify.ts:L37 | neighbors=[notify.ts]
- "notifications_notify_no_mentions": "NO_MENTIONS" | kind=code-symbol | source=src/features/notifications/notify.ts:L654 | neighbors=[notify.ts]
- "notifications_notify_notificationentity": "NotificationEntity" | kind=code-symbol | source=src/features/notifications/notify.ts:L35 | neighbors=[notify.ts]
- "notifications_notify_person": "Person" | kind=code-symbol | source=src/features/notifications/notify.ts:L240 | neighbors=[notify.ts]
- "notifications_notify_recordmentionsinput": "RecordMentionsInput" | kind=code-symbol | source=src/features/notifications/notify.ts:L631 | neighbors=[notify.ts]
- "notifications_notify_recordmentionsresult": "RecordMentionsResult" | kind=code-symbol | source=src/features/notifications/notify.ts:L646 | neighbors=[notify.ts]
- "notifications_notify_rules_capoutcome": "CapOutcome" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L284 | neighbors=[notify-rules.ts]
- "notifications_notify_rules_dedupedrow": "DedupedRow" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L130 | neighbors=[notify-rules.ts]
- "notifications_notify_rules_dedupespec": "DedupeSpec" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L49 | neighbors=[notify-rules.ts]
- "notifications_notify_rules_existingdeduperow": "ExistingDedupeRow" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L102 | neighbors=[notify-rules.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-151.json

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
