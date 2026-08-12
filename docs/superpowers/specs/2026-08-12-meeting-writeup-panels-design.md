# Meeting Write-up Panels — Design Spec

Date: 2026-08-12 · Status: implemented on main (this pass)
Extends: `2026-08-11-ui-redesign-design.md` ("watchdog calm") — tokens only, see new-token
section below for the one deliberate addition.
Surface: `MeetingAiNotes` (`meeting-notes.tsx`) and the surrounding sections of
`MeetingIntelPanel` (`meeting-intel.tsx`) — the AI write-up a recorded meeting produces.

## Relationship to `2026-08-12-meeting-intel-redesign-design.md`

That spec (status "approved", blocked on `integration/2026-08-11` landing) proposes a tiered
card rail for the same render region and explicitly says "no language toggle that hides SI or
EN" and "no new hues." This spec was commissioned directly against a pasted user complaint
("too long... panels... better grouping... colors, tags... more control") that asks for exactly
the two things that spec rules out: a language control and a small kind-colour system. The two
documents now disagree on the same surface and someone needs to reconcile or supersede one —
flagged here rather than silently overridden. Two decisions in this spec were shaped specifically
to keep as much of the older spec's intent alive as the new requirement allows:

- **"Both" stays the default one click away, and Sinhala is never deleted** — the toggle changes
  which language is *visible*, not what exists. This directly answers the older spec's core
  worry ("hiding one language hides half the meeting") without giving up the length reduction
  the actual user asked for.
- **No new *state* hues.** The five existing `ChipTone` colours (`meeting-chips.tsx`) keep
  meaning exactly what they mean today. The one new token family this spec adds is for *content
  kind*, a different axis (see below), and is applied as a thin, icon-led accent, never a fill —
  the least disruptive form a "yes, but" to "no new hues" could take.

## The job

One job: **let a reader get everything a meeting produced without reading everything a meeting
produced.** Today `MeetingAiNotes` renders five sections at identical weight in one column, the
bilingual summary literally repeats itself, and there is no way to see just your own items or
just one kind of content. Nothing is missing — the problem is that finding anything costs
reading all of it.

## Panel model

Nine independently-collapsible panels, replacing one flat scroll. Each has a persisted open/closed
state (`localStorage`, per browser, shared across meetings — this is a viewing preference, not
meeting data) and a count badge in its header. A sticky rail (desktop: vertical aside pinned
beside the content; mobile: horizontal scrollable tab strip, `overflow-x-auto` contained so the
page body itself never scrolls sideways) jumps to and opens any panel.

| Order | Panel | Icon | Kind tag | Default state |
|---|---|---|---|---|
| 1 | Summary | Sparkles | — | open |
| 2 | Action items | ListChecks | `action` | open |
| 3 | Discussion | Users | `discussion` | open |
| 4 | For next meeting | MessageCircleQuestion | `question` | open |
| 5 | Glossary | BookOpen | `term` | **collapsed** — reference material, not the headline |
| 6 | Around the table | Users | — (operational) | open, unchanged from today |
| 7 | Needs attribution | UserPlus | — (operational) | open, conditional on data |
| 8 | Carried forward | Repeat2 | `carried-forward` | open |
| 9 | Record | NotebookPen | — (operational) | **collapsed** — this is the appendix the existing code comment already calls it ("read as the appendix rather than the headline"); collapsing it by default is the single biggest length win available since it's usually the longest section |

Desktop: content area + rail sit side by side (`lg:grid-cols-[1fr_auto]`-style two-column), so the
nav costs no vertical space. Mobile: rail becomes a horizontal `overflow-x-auto` strip above the
stacked panels — same collapse behaviour, same persisted state.

"Around the table" and "Record" keep their pre-existing internal rendering completely untouched
(`meeting-prep.tsx`, `note-timeline.tsx`) — only their open/closed *state* is lifted into the
shared persisted mechanism (a small controlled-prop addition to `MeetingPrepSection`; `Record`'s
existing bare `<section>` wrapper in `meeting-intel.tsx` becomes a `Panel`). This is deliberate:
requirement 6 says nothing may regress, and the surest way to guarantee that is to not touch the
inside of either component.

## Colour + tag system

**Two separate axes, never conflated:**

1. **State** (existing, untouched): the five `ChipTone`s — success/warning/danger/active/neutral —
   still mean exactly what `meeting-chips.tsx`'s doc comment says they mean. A carried-forward
   item's fresh/aging/stale colouring (`followupAge`) is state and keeps using this system as-is.
2. **Content kind** (new): which of the five taxonomies a piece of write-up content belongs to.
   This is not a state — a "term" doesn't become less of a term over time — so it does not belong
   in `ChipTone`, and reusing one of those five tones for it would make a chip lie about what kind
   of fact it's reporting.

**Four new kind hues, not five.** Carried-forward already has a real, useful colour system (the
age-based fresh/aging/stale treatment) — stacking a second, orthogonal colour on top of it would
mean two colour systems on one row. Carried-forward's kind identity is carried by icon (`Repeat2`)
and label alone; its colour stays entirely state-driven, exactly as built.

**Why not reuse `--chart-1..5`:** they were the first candidate (already themed, already wired
into Tailwind via `@theme inline`, zero new tokens). Measured contrast killed it:

```
light vs background   chart-1 3.50:1   chart-2 4.34:1   chart-3 6.93:1   chart-4 2.74:1 (FAILS 3:1)   chart-5 10.27:1
```

`chart-4` fails the WCAG 1.4.11 non-text 3:1 floor outright in light mode. Worse, `chart-2/3/5`
are the *same hue* (165°) at different lightness — three "kinds" that would render as
indistinguishable shades of the same green, which is precisely the "reads as generic" failure
mode this system exists to avoid (three sections all wearing the same colour is not a tag system,
it's decoration). `chart-1/4` are likewise one hue (70°) split two ways.

**New tokens: `--tag-action`, `--tag-discussion`, `--tag-question`, `--tag-term`.** Four genuinely
distinct hues, chosen to sit in gaps the existing palette doesn't already claim (avoiding the
149–165° pine zone used by primary/success, the 42–82° amber zone used by warning/holiday/chart-1/4,
the 15–45° red zone used by destructive/weekend, and the 245–285° blue zone used by mercantile):

| Token | Hue | Kind | Rationale |
|---|---|---|---|
| `--tag-action` | 110° (moss) | Action items | Green-adjacent "do this" without sitting on primary's own pine |
| `--tag-discussion` | 220° (slate-teal) | Discussion points | Cool, conversational; distinct enough from mercantile's 265° at this chroma |
| `--tag-question` | 300° (plum) | For-next-meeting questions | Unclaimed hue, reads as "open question" rather than a status |
| `--tag-term` | 350° (berry) | Glossary terms | Unclaimed hue, ~37° from destructive/weekend — distinct at this chroma |

Values (chroma matched to the existing token family's restraint, ~0.09–0.10; computed via a
manual OKLCH→linear-sRGB→WCAG-relative-luminance script, not eyeballed):

```
Light (L 0.48, C 0.09): all four clear ≥5.8:1 against --background/--card/--muted
Dark  (L 0.74, C 0.10): all four clear ≥7.8:1 against --background/--card/--muted
```

Both comfortably clear the 3:1 non-text floor with margin to spare, and in fact clear 4.5:1 (the
*text* floor) too, even though usage here stays icon/border-only by design (see next paragraph) —
the margin is insurance, not a plan to use them as body text.

**Colour is never the only signal, by construction, not by discipline.** Each kind tag is: a
distinct **icon** (`ListChecks` / `Users` / `MessageCircleQuestion` / `BookOpen`), the section's
own **text label**, and only *then* a `text-tag-*` icon tint plus a `border-l-2 border-l-tag-*`
rule on the panel — mirroring the exact precedent already in this codebase for exactly this
problem: `note-timeline.tsx`'s AI-source segments use `border-l-2 border-l-muted-foreground/40`
with neutral text rather than a coloured fill, specifically because "a tint here would have to
borrow one of the four state colours to say something that is not a state." Tag text itself is
always `text-foreground`/`text-muted-foreground` — the verified-contrast neutral tokens — so no
tag chip's legibility depends on the new hues at all; they are a border + icon accent layered on
top of text that would be perfectly readable with the accent removed.

**Per-person attribution gets no colour**, on purpose. `meeting-chips.tsx`'s `ChipTone` doc
comment already states the house rule: "no per-app, per-person or per-category tone: hue that
encodes identity collides the moment two apps hash to the same colour." A hash-based per-person
palette is exactly the thing that comment warns against, so person identity stays what it already
is — a neutral, bordered name label, distinguished by text only.

## Bilingual summary control

The model's `summary` field is one Markdown string that, per the prompt in `ai-actions.ts`,
contains "professional meeting minutes in English (if mainly Sinhala, append a Sinhala section)."
There is no structured `summaryEn`/`summarySi` split in the data model, and the prompt gives the
model no fixed marker (heading text, delimiter) to split on reliably.

**Splitting strategy: per-block script dominance**, not marker-matching. `splitBilingualSummary`
(`meeting-panels-model.ts`) splits the Markdown on blank-line block boundaries and classifies each
block by counting Sinhala-script characters (`඀–෿`) against Latin characters — a block
with more Sinhala than Latin letters is Sinhala, otherwise English. This is robust to whatever
heading text the model happens to use (or doesn't) and degrades safely: if the model never wrote a
distinct Sinhala section, the Sinhala bucket is simply empty and the toggle for it is hidden
outright rather than presenting a dead option.

**Control:** a three-way segmented control — English / සිංහල / Both — above the Summary panel's
body. Default (nothing stored yet) is **English**: this is the one decision that actually halves
the length on first load, which is the literal ask ("this alone halves the length"). The choice
persists in `localStorage` (`logpup:summary-language`) independent of the unrelated
`logpup:transcribe-language` key already used by this file for live dual-engine speech
recognition — same word, different concern, deliberately different key so the two can never be
confused or collide.

**"Both" always available, Sinhala never deleted:** the raw summary is untouched in the database
and in the "Both" view — the toggle only changes what's *rendered*, matching the reconciliation
with the older spec above.

**`lang` attributes, always, regardless of mode.** Even in "Both," the English and Sinhala blocks
each render inside their own `lang="en"` / `lang="si"` wrapper, so a screen reader switches
pronunciation correctly at the boundary rather than only at the top of the whole passage.

**Font stack: deliberately unchanged.** `meeting-chips.tsx`'s `bilingualText`/`bilingualLead`
already carry the reasoning for why this codebase does *not* append an explicit Sinhala
font-family: `--font-sans` (Satoshi, Latin-only) already falls through to `system-ui, sans-serif`
for any glyph it lacks, and every shipping platform (Windows/macOS/iOS/Android) carries a
Sinhala-capable face in its own default font's per-character fallback. Adding an explicit Sinhala
`@font-face` here would be redundant weight for no correctness gain, and risks picking a face the
platform doesn't actually have loaded. "Appropriate font stack" is satisfied by *not* overriding
it and by getting `lang` right — the actual lever a browser uses for both font-fallback selection
and screen-reader pronunciation.

## Filter / control model

**Person filter** — chips built from the meeting's attendees, single-select (`personId | null`),
plus a distinguished "Mine" chip pinned first when the viewer is an attendee (the highest-value
view named directly in the brief). Matching a free-text name the model wrote ("Nadeesha") against
a full attendee name ("Nadeesha Perera") reuses the same word-boundary prefix rule
`meeting-notes-model.ts`'s `sameOwner` already established, reimplemented locally as
`personNamesMatch` to keep this module dependency-free of a `'use server'`-adjacent file.

**Kind filter** — multi-select chips over the five `ContentKind`s, additive (deselecting one kind
narrows; nothing selected is nonsensical and is treated as "all," never "none" — `toggleKind`'s
all-selected state canonicalizes back to `null`/"no filter" so the UI never shows a filter chip
row that is silently hiding everything). Excluding a kind **hides that panel entirely** — this is
ordinary filtering, not an empty result — while the person filter narrows *within* a panel that
kind filtering still allows, and only *there* triggers the designed empty state
("No action items for Shakya — clear filter"). The two filters therefore never fight over the same
kind of "nothing here": kind exclusion means "you didn't ask for this," person narrowing means
"you asked, and there's nothing," and only the second gets an empty-state message.

**Density** — Comfortable/Compact, persisted (`logpup:writeup-density`), affecting row padding and
gap on the three plain list sections (Action items, Discussion, For next meeting). Left out of
Glossary (a `<dl>`, different rhythm), Carried forward and Record (existing, denser layouts this
spec does not touch), and Around the table (untouched component).

**Expand all / Collapse all** act on the fixed set of panel ids regardless of which are currently
rendered (a conditional panel like "Needs attribution" simply ignores the call when absent).

**Clearing** — one "Clear filters" action, shown only while a filter is active
(`hasActiveFilters`), resets both person and kind to `null` in one step.

**Screen-reader counts** — each filterable panel reports its own `{visible, total}` to a shared
context on every recompute; the filter bar sums these into one `aria-live="polite"` region
("Showing 6 of 14 items") that only speaks while a filter is active — silent at rest, so it never
narrates the unfiltered, unremarkable case.

## Avoided defaults

- Not five new hues — four, because carried-forward's existing state colour already carries its
  identity and doesn't need a second one stacked on top.
- Not `--chart-1..5` reuse — measured, not assumed, to fail contrast (`chart-4`) and to collapse
  into two visually-indistinguishable hue families across five slots.
- Not colour as the primary signal anywhere — icon + label lead every tag; the new hues are a
  tertiary border/icon accent, removable without losing meaning.
- Not a per-person colour palette — the codebase already has and states this rule; extending
  identity-hashing to "kind" tags would have been the same mistake one axis over.
- Not deleting or hiding Sinhala by default forever — "Both" is one click away and the raw content
  is never altered, only the initial view.
- Not a new Sinhala font stack — the existing system-fallback reasoning already covers it; `lang`
  attributes do the real work.
- Not touching `note-timeline.tsx` or `meeting-prep.tsx` internals — both keep 100% of existing
  behaviour; only their outer open/closed state joins the shared panel mechanism.
- Not a single global "N of M" replacing each panel's own count badge — the badge is the primary,
  always-visible count; the `aria-live` region is a supplementary announcement for filter changes,
  not a replacement UI element.
- Not `transition: all` anywhere new; chevron rotation and panel-body reveal name their own
  properties, 150–200ms, `motion-reduce` respected throughout (matching the existing chevron
  pattern already used by `MeetingPrepSection`).

## Test plan (pure logic only, per house convention)

`meeting-panels-model.test.ts` — `matchesFilters` (person alone, kind alone, combined, cleared →
matches everything, a filter that matches nothing), `groupByKind`/`countByKind` (grouping and
counting across mixed kinds, empty input), `resolveSummaryLanguage` (a stored valid value, no
stored value → default, an invalid/garbage stored value → default), plus `splitBilingualSummary`
(clean English-only, English-then-Sinhala block split, Sinhala-only, empty/null input) and
`resolveDensity`/`resolvePanelOpen`/`toggleKind` as directly-adjacent pure logic the same UI relies
on. No DOM, no React, no storage access inside the tested module — every persisted value is a
plain string handed in by the caller.
