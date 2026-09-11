# Node Description Batch 140 of 166

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

- "home_hero_showcase_worklog_week": "WORKLOG_WEEK" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L396 | neighbors=[hero-showcase.tsx]
- "home_ledger_sheet_entries": "ENTRIES" | kind=code-symbol | source=src/app/(public)/home/ledger-sheet.tsx:L37 | neighbors=[ledger-sheet.tsx]
- "home_ledger_sheet_ledgersheet": "LedgerSheet()" | kind=code-symbol | source=src/app/(public)/home/ledger-sheet.tsx:L52 | neighbors=[ledger-sheet.tsx]
- "home_ledger_sheet_rules": "RULES" | kind=code-symbol | source=src/app/(public)/home/ledger-sheet.tsx:L29 | neighbors=[ledger-sheet.tsx]
- "home_ops_metrics_strip_studio_gemini_models": "STUDIO_GEMINI_MODELS" | kind=code-symbol | source=src/app/(public)/home/ops-metrics-strip.tsx:L14 | neighbors=[ops-metrics-strip.tsx]
- "home_page_metadata": "metadata" | kind=code-symbol | source=src/app/(public)/home/page.tsx:L19 | neighbors=[page.tsx]
- "home_page_publichomepage": "PublicHomePage()" | kind=code-symbol | source=src/app/(public)/home/page.tsx:L31 | neighbors=[page.tsx]
- "home_plates_app_ink": "APP_INK" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L30 | neighbors=[plates.tsx]
- "home_plates_app_label": "APP_LABEL" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L38 | neighbors=[plates.tsx]
- "home_plates_app_rule": "APP_RULE" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L24 | neighbors=[plates.tsx]
- "home_plates_appkey": "AppKey" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L36 | neighbors=[plates.tsx]
- "home_plates_bandbadge": "BandBadge()" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L91 | neighbors=[plates.tsx]
- "home_plates_body_placement": "BODY_PLACEMENT" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L46 | neighbors=[plates.tsx]
- "home_plates_briefingstatitem": "BriefingStatItem" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L117 | neighbors=[plates.tsx]
- "home_plates_caption_placement": "CAPTION_PLACEMENT" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L52 | neighbors=[plates.tsx]
- "home_plates_captionside": "CaptionSide" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L44 | neighbors=[plates.tsx]
- "home_plates_engineerallocation": "EngineerAllocation" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L326 | neighbors=[plates.tsx]
- "home_plates_initial_allocations": "INITIAL_ALLOCATIONS" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L332 | neighbors=[plates.tsx]
- "home_plates_initial_briefing_stats": "INITIAL_BRIEFING_STATS" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L126 | neighbors=[plates.tsx]
- "home_plates_initials": "initials()" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L104 | neighbors=[plates.tsx]
- "home_plates_plate": "Plate()" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L58 | neighbors=[plates.tsx]
- "home_reveal_scope": "reveal-scope.tsx" | kind=code-symbol | source=src/app/(public)/home/reveal-scope.tsx:L1 | neighbors=[RevealScope()]
- "home_reveal_scope_revealscope": "RevealScope()" | kind=code-symbol | source=src/app/(public)/home/reveal-scope.tsx:L29 | neighbors=[reveal-scope.tsx]
- "home_spotlight_card_spotlightcardprops": "SpotlightCardProps" | kind=code-symbol | source=src/app/(public)/home/spotlight-card.tsx:L6 | neighbors=[spotlight-card.tsx]
- "hooks_use_smart_poll_smartpolloptions": "SmartPollOptions" | kind=code-symbol | source=src/hooks/use-smart-poll.ts:L6 | neighbors=[use-smart-poll.ts]
- "ics_route_paramsschema": "paramsSchema" | kind=code-symbol | source=src/app/api/meetings/[id]/ics/route.ts:L29 | neighbors=[route.ts]
- "id_error_persondetailerror": "PersonDetailError()" | kind=code-symbol | source=src/app/(app)/people/[id]/error.tsx:L23 | neighbors=[error.tsx]
- "id_loading_cardskeleton": "CardSkeleton()" | kind=code-symbol | source=src/app/(app)/people/[id]/loading.tsx:L19 | neighbors=[loading.tsx]
- "id_loading_meetingprintloading": "MeetingPrintLoading()" | kind=code-symbol | source=src/app/print/meetings/[id]/loading.tsx:L17 | neighbors=[loading.tsx]
- "id_loading_persondetailloading": "PersonDetailLoading()" | kind=code-symbol | source=src/app/(app)/people/[id]/loading.tsx:L35 | neighbors=[loading.tsx]
- "id_not_found_personnotfound": "PersonNotFound()" | kind=code-symbol | source=src/app/(app)/people/[id]/not-found.tsx:L20 | neighbors=[not-found.tsx]
- "id_page_datefmt": "dateFmt" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L86 | neighbors=[page.tsx]
- "id_page_docsection": "DocSection()" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L223 | neighbors=[page.tsx]
- "id_page_filedatefmt": "fileDateFmt" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L100 | neighbors=[page.tsx]
- "id_page_mstoclock": "msToClock()" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L125 | neighbors=[page.tsx]
- "id_page_persondetailpage": "PersonDetailPage()" | kind=code-symbol | source=src/app/(app)/people/[id]/page.tsx:L65 | neighbors=[page.tsx]
- "id_page_personid": "personId" | kind=code-symbol | source=src/app/(app)/people/[id]/page.tsx:L43 | neighbors=[page.tsx]
- "id_page_pilltone": "PillTone" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L300 | neighbors=[page.tsx]
- "id_page_section_label": "SECTION_LABEL" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L202 | neighbors=[page.tsx]
- "id_page_sectionheading": "SectionHeading()" | kind=code-symbol | source=src/app/print/meetings/[id]/page.tsx:L172 | neighbors=[page.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-139.json

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
