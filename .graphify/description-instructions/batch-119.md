# Node Description Batch 120 of 166

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

- "bugs_queue_page_test_render": "render()" | kind=code-symbol | source=src/features/bugs/queue-page.test.ts:L10 | neighbors=[queue-page.test.ts]
- "bugs_report_input_bugfilterinput": "bugFilterInput" | kind=code-symbol | source=src/features/bugs/report-input.ts:L203 | neighbors=[report-input.ts]
- "bugs_report_input_test_validreport": "validReport" | kind=code-symbol | source=src/features/bugs/report-input.test.ts:L15 | neighbors=[report-input.test.ts]
- "calendar_google_calendar_calendar_error_sentences": "CALENDAR_ERROR_SENTENCES" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L276 | neighbors=[google-calendar.ts]
- "calendar_google_calendar_test_gaxioserror": "gaxiosError()" | kind=code-symbol | source=src/features/calendar/google-calendar.test.ts:L95 | neighbors=[google-calendar.test.ts]
- "calendar_google_calendar_test_google": "google" | kind=code-symbol | source=src/features/calendar/google-calendar.test.ts:L6 | neighbors=[google-calendar.test.ts]
- "calendar_google_calendar_test_setcredentials": "setCredentials()" | kind=code-symbol | source=src/features/calendar/google-calendar.test.ts:L10 | neighbors=[google-calendar.test.ts]
- "components_action_item_board_actionitemactions": "ActionItemActions" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L661 | neighbors=[action-item-board.tsx]
- "components_action_item_board_applyoptimisticactionitempatch": "applyOptimisticActionItemPatch()" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L122 | neighbors=[action-item-board.tsx]
- "components_action_item_board_autoassignedactioncard": "AutoAssignedActionCard()" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L663 | neighbors=[action-item-board.tsx]
- "components_action_item_board_editform": "EditForm" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L85 | neighbors=[action-item-board.tsx]
- "components_action_item_board_priority_options": "PRIORITY_OPTIONS" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L78 | neighbors=[action-item-board.tsx]
- "components_action_item_board_suggestedactioncard": "SuggestedActionCard()" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L789 | neighbors=[action-item-board.tsx]
- "components_action_item_board_toeditform": "toEditForm()" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L87 | neighbors=[action-item-board.tsx]
- "components_active_sprints_daysremaininglabel": "daysRemainingLabel()" | kind=code-symbol | source=src/features/dashboard/components/active-sprints.tsx:L22 | neighbors=[active-sprints.tsx]
- "components_active_sprints_formatsprintdate": "formatSprintDate()" | kind=code-symbol | source=src/features/dashboard/components/active-sprints.tsx:L18 | neighbors=[active-sprints.tsx]
- "components_activity_feed_appchip": "AppChip()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L189 | neighbors=[activity-feed.tsx]
- "components_activity_feed_daymarker": "DayMarker()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L424 | neighbors=[activity-feed.tsx]
- "components_activity_feed_filterlink": "FilterLink()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L131 | neighbors=[activity-feed.tsx]
- "components_activity_feed_graphemes": "graphemes" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L22 | neighbors=[activity-feed.tsx]
- "components_activity_feed_railnode": "RailNode()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L169 | neighbors=[activity-feed.tsx]
- "components_activity_feed_sentence": "Sentence()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L242 | neighbors=[activity-feed.tsx]
- "components_activity_feed_subject": "Subject()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L222 | neighbors=[activity-feed.tsx]
- "components_activity_feed_trailburst": "TrailBurst()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L345 | neighbors=[activity-feed.tsx]
- "components_activity_feed_trailevent": "TrailEvent()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L296 | neighbors=[activity-feed.tsx]
- "components_activity_feed_trailtime": "TrailTime()" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L285 | neighbors=[activity-feed.tsx]
- "components_activity_filter_bar_activityfilterstate": "ActivityFilterState" | kind=code-symbol | source=src/features/activity/components/activity-filter-bar.tsx:L170 | neighbors=[activity-filter-bar.tsx]
- "components_activity_filter_bar_datefilter": "DateFilter()" | kind=code-symbol | source=src/features/activity/components/activity-filter-bar.tsx:L37 | neighbors=[activity-filter-bar.tsx]
- "components_activity_filter_bar_searchfilter": "SearchFilter()" | kind=code-symbol | source=src/features/activity/components/activity-filter-bar.tsx:L85 | neighbors=[activity-filter-bar.tsx]
- "components_activity_graph_tooltip": "tooltip()" | kind=code-symbol | source=src/features/people/components/activity-graph.tsx:L13 | neighbors=[activity-graph.tsx]
- "components_activity_skeleton_dayskeleton": "DaySkeleton()" | kind=code-symbol | source=src/features/activity/components/activity-skeleton.tsx:L52 | neighbors=[activity-skeleton.tsx]
- "components_activity_skeleton_row_widths": "ROW_WIDTHS" | kind=code-symbol | source=src/features/activity/components/activity-skeleton.tsx:L50 | neighbors=[activity-skeleton.tsx]
- "components_add_user_dialog_emptystate": "emptyState" | kind=code-symbol | source=src/features/admin/components/add-user-dialog.tsx:L43 | neighbors=[add-user-dialog.tsx]
- "components_add_user_dialog_formstate": "FormState" | kind=code-symbol | source=src/features/admin/components/add-user-dialog.tsx:L33 | neighbors=[add-user-dialog.tsx]
- "components_admin_nav_navitem": "NavItem()" | kind=code-symbol | source=src/features/admin/components/admin-nav.tsx:L58 | neighbors=[admin-nav.tsx]
- "components_ai_adoption_card_aiadoptioncardprops": "AiAdoptionCardProps" | kind=code-symbol | source=src/features/admin/components/ai-adoption-card.tsx:L29 | neighbors=[ai-adoption-card.tsx]
- "components_ai_adoption_card_verdict_badge": "VERDICT_BADGE" | kind=code-symbol | source=src/features/admin/components/ai-adoption-card.tsx:L23 | neighbors=[ai-adoption-card.tsx]
- "components_ai_engine_card_readiness_tone": "READINESS_TONE" | kind=code-symbol | source=src/features/dashboard/components/ai-engine-card.tsx:L47 | neighbors=[ai-engine-card.tsx]
- "components_ai_engine_card_stability_hint": "STABILITY_HINT" | kind=code-symbol | source=src/features/dashboard/components/ai-engine-card.tsx:L40 | neighbors=[ai-engine-card.tsx]
- "components_ai_engine_card_stability_note": "STABILITY_NOTE" | kind=code-symbol | source=src/features/dashboard/components/ai-engine-card.tsx:L33 | neighbors=[ai-engine-card.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-119.json

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
