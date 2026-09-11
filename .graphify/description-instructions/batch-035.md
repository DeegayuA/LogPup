# Node Description Batch 36 of 166

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
LANGUAGE: each entry has a `lang=` marker giving the language of its source.
Write that entry's description in EXACTLY that language. Do not translate to
a single common language — match each node's source language individually.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "calendar_google_calendar_createcalendarevent": "createCalendarEvent()" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L44 | neighbors=[google-calendar.ts, buildConferenceDataRequest(), client(), extractMeetLink(), actions.ts] | lang=en
- "calendar_google_calendar_describecalendarerror": "describeCalendarError()" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L298 | neighbors=[google-calendar.ts, classifyCalendarError(), sentenceFor(), google-calendar.test.ts, actions.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@001694ae5947f8133eea802f0c57d97fe2b43787": "001694a refactor(tasks): express the completed_at rule against the terminal set" | kind=Commit | source=git | neighbors=[main, eb38ea0 fix(tasks): stamp completed_at …, task-status.ts, task-status.test.ts, 4ba83e6 test(people): guard the open/do…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@00d662149260a5912eab2dbdb1cdc4ca39371049": "00d6621 fix(intel): one hung Gemini call froze both panels, forever" | kind=Commit | source=git | neighbors=[main, c5251d4 fix(gemini): six holes an adver…, intel-view.tsx, client.ts, 5e32b09 fix(worklog): Fill my day ignor…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@03e2c3f3e0290ec210acd6de5d028e0837ce9a74": "03e2c3f feat(deadlines): grade and order an app's promises, with a test that di…" | kind=Commit | source=git | neighbors=[main, 8382eb6 fix(worklog): project tags beco…, promises.ts, promises.test.ts, b6bde77 feat(gemini): key census — who …] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@04583d8441dce8ff9c887c7b60eff7d75e894ee1": "04583d8 feat(sprints): the words a task hand-off says, as a tested rule" | kind=Commit | source=git | neighbors=[main, 53ae2f3 feat(worklog): attribute hours …, assignment-notice.ts, assignment-notice.test.ts, e432241 feat(deadlines): the escalation…] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@050a921f54f227edfefc3e092be45cab954848a5": "050a921 feat(calendar): classify a two-way sync field by field, and refuse to g…" | kind=Commit | source=git | neighbors=[main, 10e7430 fix(ui): a clipped seat descrip…, field-reconcile.ts, field-reconcile.test.ts, 1c2fee5 fix(worklog): a trashed task mu…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@09468aae7bc7daf110737470f2036ff612bb906d": "09468aa feat(worklog): the team view can finally show the people who are behind" | kind=Commit | source=git | neighbors=[main, d33e084 feat(finance): give the cost mo…, page.tsx, queries.ts, ce0fabf feat(worklog): a refused day of…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@10e74307c4ae7b40a8b8c86960620e4d47abd630": "10e7430 fix(ui): a clipped seat description and an error toast that looked like…" | kind=Commit | source=git | neighbors=[050a921 feat(calendar): classify a two-…, main, dda9cf6 feat(worklog): the AI draft kno…, seat-select.tsx, sonner.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@1b4f4eed760d33c7c85c85a41e17f4681997d15f": "1b4f4ee feat(worklog): log an hour by writing one sentence" | kind=Commit | source=git | neighbors=[main, c4994ff feat(worklog): your own row on …, day-hours-card.tsx, entry-draft-prompt.ts, 8e5308d feat(worklog): one grammar for …] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@1eedff1f8cac6b8f1aec08174bcef49a8ae364cc": "1eedff1 feat(people): a project's team as a file, without the private half" | kind=Commit | source=git | neighbors=[main, de4812e feat(github): commits become wo…, team-csv.ts, team-csv.test.ts, de769e3 refactor(csv): one RFC 4180 par…] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@24fb8224480dfa2f41418b185997a94053eb07c7": "24fb822 fix(worklog): two absence writes that quietly discarded somebody's deci…" | kind=Commit | source=git | neighbors=[main, 7d54694 feat(db): the work substrate, a…, absence-actions.ts, absence-actions.test.ts, 49350d6 feat(meetings): "Copy here" — t…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@286523199a5bd044aff99ffd14814d2272cf2f3d": "2865231 feat(deadlines): route all three due_date writers through applyDueDate" | kind=Commit | source=git | neighbors=[main, 6909ea3 feat(worklog): AI drafts the da…, actions.ts, task-actions.ts, 325eb16 fix(search): one finance entry …] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@2b1ac4ad7dc3308af2a62890b11e4b84603ff17c": "2b1ac4a feat(calendar): the organiser is its own fact, and a failed cancel is r…" | kind=Commit | source=git | neighbors=[main, b6bde77 feat(gemini): key census — who …, 0051_calendar_hardening.sql, actions.ts, 53ae2f3 feat(worklog): attribute hours …] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@2b9e5c5a6dd8d0f83ec30b736deaed23c0c33a55": "2b9e5c5 feat(meetings): rebuild the recording pop-out around what you cannot see" | kind=Commit | source=git | neighbors=[main, 644d391 feat(meetings): ask before clos…, meeting-intel.tsx, meeting-pip.tsx, 456f0e2 docs(meeting-load): record what…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@2e02b269a5bd40f5220cbbc2a22ea93e7dfb0916": "2e02b26 feat(worklog): suggest a person's day by what their role on it makes it…" | kind=Commit | source=git | neighbors=[main, 40c5d41 feat(calendar): decide whether …, entry-suggestions.ts, entry-suggestions.test.ts, 8382eb6 fix(worklog): project tags beco…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@353c6e9f33eec7bd5d650aead329a880da8156b4": "353c6e9 docs(deadlines): pre-0049 tasks never gain an original, and that is the…" | kind=Commit | source=git | neighbors=[main, 35d16f8 feat(finance): server layer for…, due-date.ts, due-date.test.ts, c2dbc08 fix(admin): stop approved chang…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@3d461b5ff0fa490f434240d8c42cdd3d80738753": "3d461b5 fix(home): derive advertised Gemini rates instead of hand-writing them" | kind=Commit | source=git | neighbors=[227e958 build: npm run verify:head — ty…, main, 0ef5105 fix(intel): a briefing priority…, advertised-models.test.ts, hero-showcase.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@40c5d41502fab61e756463310c697d25a2a32a00": "40c5d41 feat(calendar): decide whether a Google event and a LogPup meeting are …" | kind=Commit | source=git | neighbors=[2e02b26 feat(worklog): suggest a person…, main, 924eca4 feat(calendar): expand a daily …, event-identity.ts, event-identity.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@58b4984b362b4be5add6f6657ad5dbe15d4c2184": "58b4984 fix(worklog): the team grid stops leaving screen-high holes, and the le…" | kind=Commit | source=git | neighbors=[main, 695a047 fix(worklog): one fill button, …, worklog-calendar.tsx, page.tsx, d33e084 feat(finance): give the cost mo…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@6e7c05f8cb9ac55005d2c64eee65c5dbb5dbac2f": "6e7c05f fix(intel): stop printing a person's name twice in a row" | kind=Commit | source=git | neighbors=[3893a7b style(theme): holiday moves fro…, main, b1ef1b9 feat(worklog): log where the da…, answer-links.ts, answer-links.test.ts] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@717069eada2d9bcac6226871b6e99f83585cf868": "717069e feat(admin): the page that says where the studio's time and money went" | kind=Commit | source=git | neighbors=[sections.ts, main, 0caca2e feat(worklog): who may review s…, page.tsx, f8a9b00 feat(gemini): the meter learns …] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@7228d54bb4beafe9c10eaa317d86f7b2119406ba": "7228d54 refactor(meetings): one derivation behind both surfaces that ask the sa…" | kind=Commit | source=git | neighbors=[main, 44b1c48 feat(auth): Continue with GitHu…, ask-derivation.ts, planner.ts, a628b27 feat(worklog): the progress gri…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@72473a0b84e73591f84666b61663b2a85188c579": "72473a0 feat(meetings): alt-drag a block to copy it, decided at the drop" | kind=Commit | source=git | neighbors=[main, e8b2ac2 feat(worklog): hours you logged…, meetings-time-grid.tsx, actions.ts, 9ac3705 feat(worklog): run the cross-ch…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@72b853c07b81e90848f2435306eef1f50a8fb899": "72b853c feat(meetings): segment upload order and honest progress, as a pure mod…" | kind=Commit | source=git | neighbors=[644d391 feat(meetings): ask before clos…, main, f3c4d35 feat(meetings): one segment on …, segment-queue.ts, segment-queue.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@77dfc150ac901763298f688bc36cb20fa669a808": "77dfc15 fix(worklog): no task entry could be saved, at all" | kind=Commit | source=git | neighbors=[11575db fix(worklog): project chips can…, main, 8e5308d feat(worklog): one grammar for …, entry-actions.ts, entry-actions.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@8a3fe202f9e7a795dee758e8602b033845421fe5": "8a3fe20 feat(intel): Ask LogPup on every page, as a second surface not a second…" | kind=Commit | source=git | neighbors=[layout.tsx, main, ae2feea feat(people): filtering and ord…, ask-bubble.tsx, ce0f1f5 feat(people): a person card beh…] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@8e2986ac6fbf12d508f546cae6c8c0daac687180": "8e2986a feat(calendar): push the whole event to guests, and classify why a push…" | kind=Commit | source=git | neighbors=[5d6c459 fix(home): resolve model rates …, main, google-calendar.ts, google-calendar.test.ts, 85c3961 feat(finance): cost and worth d…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@8e831ec74ddf7fb11d2a1f7899b956ec8a1b7489": "8e831ec feat(worklog): the catch-up ledger says which gaps already have hours i…" | kind=Commit | source=git | neighbors=[main, 104afee feat(dashboard): the dashboard …, catch-up-panel.tsx, page.tsx, c032099 fix(worklog): the Save button s…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@924eca4b8c552fb3e531eed55dcdccd923fbf63a": "924eca4 feat(calendar): expand a daily or weekly rule into the days it means" | kind=Commit | source=git | neighbors=[40c5d41 feat(calendar): decide whether …, main, 1c2fee5 fix(worklog): a trashed task mu…, recurrence.ts, recurrence.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@929997a5791285a766a21bb75dbad9e6d6684113": "929997a feat(meetings): /meetings opens on the week grid" | kind=Commit | source=git | neighbors=[3dcd417 feat(shell): collapse the sideb…, main, e2090c6 feat(meetings): "Not tracked" r…, calendar-view.ts, calendar-view.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@966d695267496d30aa1ea45eb25fcde9d39c0cf2": "966d695 feat(intel): the briefing uses its width instead of being stretched by …" | kind=Commit | source=git | neighbors=[4d94451 feat(meetings): a recurrence ru…, main, 9ac3705 feat(worklog): run the cross-ch…, briefing-card.tsx, intel-skeletons.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@a628b272b775409e996dd306abdf621469f64b6b": "a628b27 feat(worklog): the progress grid shows which project each day went to" | kind=Commit | source=git | neighbors=[51008f1 feat(worklog): one click fills …, main, 7228d54 refactor(meetings): one derivat…, progress-matrix.tsx, progress-queries.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@a8c510046fff0465867385744204d2ee9f51b781": "a8c5100 ." | kind=Commit | source=git | neighbors=[a3168f0 Ask LogPup spec: meeting-family…, actions.ts, main, live.test.ts, loading.tsx] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@ae2feea5a824a1e277367b92681f5feea3c9336a": "ae2feea feat(people): filtering and ordering for the By project view" | kind=Commit | source=git | neighbors=[8a3fe20 feat(intel): Ask LogPup on ever…, main, ea1622e fix(intel): Ask LogPup reads as…, cohort-filter.ts, cohort-filter.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@b35d96b0c18d3a8872ef9c604ed4f65c7dc3e43c": "b35d96b fix(worklog): two hours reads counted soft-deleted rows" | kind=Commit | source=git | neighbors=[44b1c48 feat(auth): Continue with GitHu…, main, 272f9a7 feat(meetings): store the decis…, entry-queries.ts, progress-queries.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@b6bde770181d0fec34e469c82ba68295e1fc0fe3": "b6bde77 feat(gemini): key census — who shares, who keeps, and who to thank" | kind=Commit | source=git | neighbors=[2b1ac4a feat(calendar): the organiser i…, main, 03e2c3f feat(deadlines): grade and orde…, key-census.ts, key-census.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@bd5f5247eace08a11363044960ff39b46924371e": "bd5f524 feat(gemini): the honest half of the live AI meter" | kind=Commit | source=git | neighbors=[main, d269096 feat(intel): keep the Ask LogPu…, ai-meter.ts, ai-meter.test.ts, d8e49ed fix(apps): ownership is a word,…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@c2f2819f0f3758efb0657c8f07d6e969be21c59c": "c2f2819 feat(meetings): work out which meetings could have been one meeting" | kind=Commit | source=git | neighbors=[main, 624466e feat(gemini): the ownership que…, coverage.ts, coverage.test.ts, e38a385 feat(worklog): what a logged da…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@ce0fabfcb16cada5cac5c4b21ac66d046a57e2ba": "ce0fabf feat(worklog): a refused day off now reaches the person who filed it" | kind=Commit | source=git | neighbors=[7d54694 feat(db): the work substrate, a…, main, 09468aa feat(worklog): the team view ca…, page.tsx, queries.ts] | lang=en

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-035.json

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
