# Node Description Batch 105 of 166

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

- "meetings_text_replace_actions_meetingreplaceresult": "MeetingReplaceResult" | kind=code-symbol | source=src/features/meetings/text-replace-actions.ts:L88 | neighbors=[replace-review-dialog.tsx, text-replace-actions.ts]
- "meetings_text_replace_iswordchar": "isWordChar()" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L92 | neighbors=[text-replace.ts, tokenize()]
- "meetings_text_replace_iswordstart": "isWordStart()" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L77 | neighbors=[text-replace.ts, tokenize()]
- "mini_calendar_index_formatdate": "formatDate()" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L62 | neighbors=[index.tsx, MiniCalendarDay()]
- "mini_calendar_index_getdays": "getDays()" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L50 | neighbors=[index.tsx, MiniCalendarDays()]
- "mini_calendar_index_minicalendar": "MiniCalendar()" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L83 | neighbors=[upcoming-filter.tsx, index.tsx]
- "motion_hydrated_markhydrated": "markHydrated()" | kind=code-symbol | source=src/components/motion/hydrated.ts:L36 | neighbors=[hydrated.ts, motion-provider.tsx]
- "motion_motion_provider_motionprovider": "MotionProvider()" | kind=code-symbol | source=src/components/motion/motion-provider.tsx:L38 | neighbors=[layout.tsx, motion-provider.tsx]
- "motion_presence_list_presencelist": "PresenceList()" | kind=code-symbol | source=src/components/motion/presence-list.tsx:L27 | neighbors=[pending-absence-list.tsx, presence-list.tsx]
- "motion_route_transition_routetransition": "RouteTransition()" | kind=code-symbol | source=src/components/motion/route-transition.tsx:L30 | neighbors=[layout.tsx, route-transition.tsx]
- "motion_stagger_motion_tags": "MOTION_TAGS" | kind=code-symbol | source=src/components/motion/stagger.tsx:L16 | neighbors=[reveal.tsx, stagger.tsx]
- "motion_stagger_motiontag": "MotionTag" | kind=code-symbol | source=src/components/motion/stagger.tsx:L24 | neighbors=[reveal.tsx, stagger.tsx]
- "notifications_actions_fetchnotificationsnapshot": "fetchNotificationSnapshot()" | kind=code-symbol | source=src/features/notifications/actions.ts:L31 | neighbors=[notification-bell-client.tsx, actions.ts]
- "notifications_actions_markallnotificationsread": "markAllNotificationsRead()" | kind=code-symbol | source=src/features/notifications/actions.ts:L43 | neighbors=[notification-bell-client.tsx, actions.ts]
- "notifications_actions_notificationsnapshot": "NotificationSnapshot" | kind=code-symbol | source=src/features/notifications/actions.ts:L15 | neighbors=[notification-bell-client.tsx, actions.ts]
- "notifications_commands_commands": "commands" | kind=code-symbol | source=src/features/notifications/commands.ts:L9 | neighbors=[commands.ts, commands.ts]
- "notifications_entity_kinds_entity_kinds": "ENTITY_KINDS" | kind=code-symbol | source=src/features/notifications/entity-kinds.ts:L34 | neighbors=[entity-kinds.ts, entity-kinds.test.ts]
- "notifications_entity_kinds_ismentionsource": "isMentionSource()" | kind=code-symbol | source=src/features/notifications/entity-kinds.ts:L91 | neighbors=[entity-kinds.ts, entity-kinds.test.ts]
- "notifications_entity_kinds_mention_sources": "MENTION_SOURCES" | kind=code-symbol | source=src/features/notifications/entity-kinds.ts:L56 | neighbors=[entity-kinds.ts, entity-kinds.test.ts]
- "notifications_entity_kinds_mentionsource": "MentionSource" | kind=code-symbol | source=src/features/notifications/entity-kinds.ts:L65 | neighbors=[entity-kinds.ts, notify.ts]
- "notifications_mention_rules_mentionfacts": "MentionFacts" | kind=code-symbol | source=src/features/notifications/mention-rules.ts:L34 | neighbors=[mention-rules.ts, mention-rules.test.ts]
- "notifications_mention_rules_namelist": "nameList()" | kind=code-symbol | source=src/features/notifications/mention-rules.ts:L119 | neighbors=[mention-rules.ts, mentionAdvisory()]
- "notifications_mention_rules_suppressedmention": "SuppressedMention" | kind=code-symbol | source=src/features/notifications/mention-rules.ts:L78 | neighbors=[mention-rules.ts, notify.ts]
- "notifications_mention_rules_suppressedreason": "SuppressedReason" | kind=code-symbol | source=src/features/notifications/mention-rules.ts:L31 | neighbors=[mention-rules.ts, notify.ts]
- "notifications_mention_rules_worthreporting": "worthReporting()" | kind=code-symbol | source=src/features/notifications/mention-rules.ts:L72 | neighbors=[mention-rules.ts, mention-rules.test.ts]
- "notifications_notify_collapsingarbiter": "collapsingArbiter()" | kind=code-symbol | source=src/features/notifications/notify.ts:L548 | neighbors=[notify.ts, insertAll()]
- "notifications_notify_counttoday": "countToday()" | kind=code-symbol | source=src/features/notifications/notify.ts:L420 | neighbors=[notify.ts, applyCap()]
- "notifications_notify_escaperegexp": "escapeRegExp()" | kind=code-symbol | source=src/features/notifications/notify.ts:L603 | neighbors=[notify.ts, extractMentionedUserIds()]
- "notifications_notify_findbindingdeduperows": "findBindingDedupeRows()" | kind=code-symbol | source=src/features/notifications/notify.ts:L386 | neighbors=[notify.ts, applyCap()]
- "notifications_notify_gatekey": "gateKey()" | kind=code-symbol | source=src/features/notifications/notify.ts:L306 | neighbors=[notify.ts, dropIneligibleRecipients()]
- "notifications_notify_liveentityids": "liveEntityIds()" | kind=code-symbol | source=src/features/notifications/notify.ts:L189 | neighbors=[notify.ts, dropDeadEntities()]
- "notifications_notify_mergeinbatch": "mergeInBatch()" | kind=code-symbol | source=src/features/notifications/notify.ts:L170 | neighbors=[notify.ts, createNotifications()]
- "notifications_notify_overflowrow": "overflowRow()" | kind=code-symbol | source=src/features/notifications/notify.ts:L465 | neighbors=[notify.ts, applyCap()]
- "notifications_notify_overflowsofar": "overflowSoFar()" | kind=code-symbol | source=src/features/notifications/notify.ts:L447 | neighbors=[notify.ts, applyCap()]
- "notifications_notify_permanentarbiter": "permanentArbiter()" | kind=code-symbol | source=src/features/notifications/notify.ts:L547 | neighbors=[notify.ts, insertAll()]
- "notifications_notify_rules_dedupetarget": "DedupeTarget" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L34 | neighbors=[notify.ts, notify-rules.ts]
- "notifications_notify_rules_segment": "segment()" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L62 | neighbors=[notify-rules.ts, dedupeKeyFor()]
- "notifications_notify_rules_visibilitygate": "VisibilityGate" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L190 | neighbors=[notify.ts, notify-rules.ts]
- "notifications_retention_assertusable": "assertUsable()" | kind=code-symbol | source=src/features/notifications/retention.ts:L78 | neighbors=[retention.ts, RetentionCutoffs]
- "notifications_retention_default_retention_policy": "DEFAULT_RETENTION_POLICY" | kind=code-symbol | source=src/features/notifications/retention.ts:L42 | neighbors=[retention.ts, retention.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-104.json

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
