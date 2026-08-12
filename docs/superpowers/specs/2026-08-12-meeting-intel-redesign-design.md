# Meeting Intel Panel Redesign — Design Spec

**Date:** 2026-08-12 · **Status:** approved (structure: tiered card rail)
**Extends:** `2026-08-11-ui-redesign-design.md` ("watchdog calm") — no new hues, no new type families.
**Implements on:** top of `integration/2026-08-11` after it lands on main. This spec rewrites
`meeting-intel.tsx` render structure; building it on main before the integration lands would
recreate the file-collision churn of 2026-08-11.

## Subject & job

The intel panel is where a recorded meeting becomes usable knowledge: AI summary, per-person
discussion, follow-ups, glossary, carried-forward questions. Its single job: **let a team member
find "what do I need to do / know from this meeting" in under ten seconds.** Today it fails that:
nine headings share one visual weight, so nothing outranks anything.

## Diagnosis of current UI (screenshot 2026-08-12)

1. Zero hierarchy — every section heading identical small gray; no scan path.
2. Speakers as ALL-CAPS tiny gray — people read as form labels.
3. Sinhala second-class — muted tone + tight leading (clips diacritics on abugida script).
4. Counts as bare numerals floating after headings.
5. Provenance ("Written up by AI · model") is the faintest line on the page — inverted trust signal.
6. Carried-forward ember box is the only designed element; its four actions have no primary.

## Structure: tiered card rail

Each section = bounded card on stone surface (`bg-card ring-1 ring-foreground/10 rounded-xl`),
icon + Cabinet Grotesk heading + mono count chip (`tabular-nums`). Rail order is priority, not
transcript order:

| Tier | Sections | Treatment |
|---|---|---|
| 1 — Act | Decisions · Next steps · Carried forward | Decisions: `border-l-2 border-primary` accent. Next steps: checklist rows. Carried forward: keeps ember (`chart-1`) — the only amber on the panel. |
| 2 — Read | Summary (EN + SI) · Discussion (by person) · For next meeting | Standard cards. |
| 3 — Reference | Glossary | Collapsed disclosure card, count visible when closed. |

## Attribution language (consistent with 0021_attribution_membership)

- Resolved person → person chip: avatar dot + name, body weight. Same component as note timeline.
- Unconfirmed label ("Speaker 1", unmapped name) → mono label chip, visually distinct from a
  person. Never render a guess as a person.
- `SpeakerAssignmentPanel` sits at the head of the Discussion card — assign once, every section
  updates.

## Bilingual treatment

- Sinhala blocks get `lang="si"`, full `text-foreground` (not muted), `leading-relaxed`
  (diacritic clearance). EN and SI summaries are sibling blocks with their own sub-headers —
  no toggle; the team code-switches, hiding one language hides half the meeting.
- Glossary terms: term in body weight, SI + EN definitions stacked, SI first when the term is
  English (it exists to explain the English term).

## Provenance footer (trust signal, per ai-trust-builders Caveat/Disclosure)

Designed footer chip row on the Summary card: sparkles badge "AI write-up" · mono timestamp ·
mono model name · caveat text ("AI wrote this — check before acting on it") at `text-2xs`
≥/70 alpha. Never below 4.5:1.

## Carried forward actions

`Resolve` = default button (primary). `Not yet` · `Why` · `What they said` = ghost. One
decision per row. Ember ring stays; actions no longer compete.

## States (every async surface)

- **Loading:** skeleton matching the card rail (3 tier-1 card ghosts), not a spinner.
- **Empty:** "No notes yet. Record or upload audio and LogPup writes them up." + record action.
- **Error:** names the failure from `GeminiError` codes — NO_KEYS → "Add a Gemini key in
  Profile"; TRANSIENT_BUSY → "Gemini is busy — your recording is safe, retry in a minute";
  quota → honest quota message. Never a generic "something went wrong" when the code is known.

## Type roles

Headings: Cabinet Grotesk (`font-heading`) — card titles `text-sm font-semibold`, panel title
steps up. Body: Satoshi. Data (counts, times, model names, speaker labels): Geist Mono
`tabular-nums`. Hierarchy from weight+color before size, per system.

## Avoided defaults

- No new hues; ember stays reserved for attention (carried forward only).
- No gradients/glow; borders for structure, soft shadow only on floating layers.
- No `transition: all`; named properties 120–250ms.
- No hover-only affordances (all actions reachable and visible via keyboard focus).
- No language toggle that hides SI or EN.

## Accessibility

- Heading order continues from the page h1 (panel h2, cards h3).
- Counts spoken: `aria-label="Discussion, 2 entries"` on the card heading, chip `aria-hidden`.
- `lang="si"` on all Sinhala text (screen reader pronunciation + font selection).
- Collapsed glossary: real disclosure semantics (`aria-expanded`), not display toggling.
- Ember ring never the only signal — carried-forward rows keep the clock icon + "Raised" text.

## Out of scope

Note timeline internals (already redesigned with attribution work) · transcription pipeline ·
RSVP/detail dialog · any schema change. Pure render-layer restructure of `meeting-intel.tsx`
sections plus small shared chips.
