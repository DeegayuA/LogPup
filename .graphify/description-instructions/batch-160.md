# Node Description Batch 161 of 166

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

- "terms_page_terms_sections": "TERMS_SECTIONS" | kind=code-symbol | source=src/app/(public)/terms/page.tsx:L27 | neighbors=[page.tsx]
- "terms_page_termsofservicepage": "TermsOfServicePage()" | kind=code-symbol | source=src/app/(public)/terms/page.tsx:L43 | neighbors=[page.tsx]
- "texts_counting_number_countingnumberprops": "CountingNumberProps" | kind=code-symbol | source=src/components/animate-ui/primitives/texts/counting-number.tsx:L11 | neighbors=[counting-number.tsx]
- "transcription_actions_livetokenresult": "LiveTokenResult" | kind=code-symbol | source=src/features/transcription/actions.ts:L20 | neighbors=[actions.ts]
- "transcription_actions_requesttokeninput": "requestTokenInput" | kind=code-symbol | source=src/features/transcription/actions.ts:L12 | neighbors=[actions.ts]
- "transcription_live_client_livecallbacks": "LiveCallbacks" | kind=code-symbol | source=src/features/transcription/live-client.ts:L42 | neighbors=[live-client.ts]
- "transcription_live_client_livesessionoptions": "LiveSessionOptions" | kind=code-symbol | source=src/features/transcription/live-client.ts:L50 | neighbors=[live-client.ts]
- "transcription_live_client_livetranscriptionsession_constructor": ".constructor()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L102 | neighbors=[LiveTranscriptionSession]
- "transcription_live_client_livetranscriptionsession_hastranscribed": ".hasTranscribed()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L116 | neighbors=[LiveTranscriptionSession]
- "transcription_live_client_livetranscriptionsession_status": ".status()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L107 | neighbors=[LiveTranscriptionSession]
- "transcription_live_client_livetranscriptionsession_transcriptstate": ".transcriptState()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L111 | neighbors=[LiveTranscriptionSession]
- "transcription_live_client_test_fakesocket_close": ".close()" | kind=code-symbol | source=src/features/transcription/live-client.test.ts:L36 | neighbors=[FakeSocket]
- "transcription_live_client_test_fakesocket_constructor": ".constructor()" | kind=code-symbol | source=src/features/transcription/live-client.test.ts:L27 | neighbors=[FakeSocket]
- "transcription_live_client_test_fakesocket_deliver": ".deliver()" | kind=code-symbol | source=src/features/transcription/live-client.test.ts:L41 | neighbors=[FakeSocket]
- "transcription_live_client_test_fakesocket_send": ".send()" | kind=code-symbol | source=src/features/transcription/live-client.test.ts:L32 | neighbors=[FakeSocket]
- "transcription_live_client_test_newsession": "newSession()" | kind=code-symbol | source=src/features/transcription/live-client.test.ts:L72 | neighbors=[live-client.test.ts]
- "transcription_live_client_test_tokenfn": "TokenFn" | kind=code-symbol | source=src/features/transcription/live-client.test.ts:L68 | neighbors=[live-client.test.ts]
- "transcription_live_protocol_authtokenrequestoptions": "AuthTokenRequestOptions" | kind=code-symbol | source=src/features/transcription/live-protocol.ts:L145 | neighbors=[live-protocol.ts]
- "transcription_live_protocol_setupoptions": "SetupOptions" | kind=code-symbol | source=src/features/transcription/live-protocol.ts:L95 | neighbors=[live-protocol.ts]
- "transcription_session_budget_autostopinput": "AutoStopInput" | kind=code-symbol | source=src/features/transcription/session-budget.ts:L39 | neighbors=[session-budget.ts]
- "trash_page_admintrashpage": "AdminTrashPage()" | kind=code-symbol | source=src/app/(app)/admin/trash/page.tsx:L7 | neighbors=[page.tsx]
- "types_next_auth_d_jwt": "JWT" | kind=code-symbol | source=src/types/next-auth.d.ts:L32 | neighbors=[next-auth.d.ts]
- "types_next_auth_d_session": "Session" | kind=code-symbol | source=src/types/next-auth.d.ts:L9 | neighbors=[next-auth.d.ts]
- "ui_alert_dialog_alertdialogmedia": "AlertDialogMedia()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L96 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogoverlay": "AlertDialogOverlay()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L25 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogportal": "AlertDialogPortal()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L19 | neighbors=[alert-dialog.tsx]
- "ui_ambient_backdrop_ambientbackdrop": "AmbientBackdrop()" | kind=code-symbol | source=src/components/ui/ambient-backdrop.tsx:L34 | neighbors=[ambient-backdrop.tsx]
- "ui_ambient_backdrop_ambientvariant": "AmbientVariant" | kind=code-symbol | source=src/components/ui/ambient-backdrop.tsx:L16 | neighbors=[ambient-backdrop.tsx]
- "ui_ambient_backdrop_orbs": "ORBS" | kind=code-symbol | source=src/components/ui/ambient-backdrop.tsx:L24 | neighbors=[ambient-backdrop.tsx]
- "ui_calendar_calendardaybutton": "CalendarDayButton()" | kind=code-symbol | source=src/components/ui/calendar.tsx:L183 | neighbors=[calendar.tsx]
- "ui_card_cardfooter": "CardFooter()" | kind=code-symbol | source=src/components/ui/card.tsx:L94 | neighbors=[card.tsx]
- "ui_datetime_wheel_hour_options": "HOUR_OPTIONS" | kind=code-symbol | source=src/components/ui/datetime-wheel.tsx:L37 | neighbors=[datetime-wheel.tsx]
- "ui_datetime_wheel_minute_options": "MINUTE_OPTIONS" | kind=code-symbol | source=src/components/ui/datetime-wheel.tsx:L42 | neighbors=[datetime-wheel.tsx]
- "ui_datetime_wheel_prefersreducedmotion": "prefersReducedMotion()" | kind=code-symbol | source=src/components/ui/datetime-wheel.tsx:L59 | neighbors=[datetime-wheel.tsx]
- "ui_datetime_wheel_timecolumn": "TimeColumn()" | kind=code-symbol | source=src/components/ui/datetime-wheel.tsx:L77 | neighbors=[datetime-wheel.tsx]
- "ui_datetime_wheel_wheeloption": "WheelOption" | kind=code-symbol | source=src/components/ui/datetime-wheel.tsx:L35 | neighbors=[datetime-wheel.tsx]
- "ui_dropdown_menu_dropdownmenuportal": "DropdownMenuPortal()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L13 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenuradiogroup": "DropdownMenuRadioGroup()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L182 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenuradioitem": "DropdownMenuRadioItem()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L191 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenushortcut": "DropdownMenuShortcut()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L236 | neighbors=[dropdown-menu.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-160.json

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
