# Speaker identification from the meeting record

Date: 2026-08-13
Status: approved, ready for an implementation plan

Supersedes the naming half of `2026-08-11-attribution-membership-design.md`.
That design's `SpeakerAssignmentPanel` is deleted by this one — see
"What this replaces".

## The problem

A recorded meeting produces diarized turns labelled `Speaker 1`, `Speaker 2`.
Somebody then has to say who each one was, by hand, in a picker — for every
meeting, every time. Until they do, the transcript, the minutes, the action
items, the assistant and the PDF export all say "Speaker 2" about a person
whose name is sitting in the recording.

The name is usually IN the record. People introduce themselves, and they
address each other by name. Nothing reads it.

## What exists today

- The synthesis pass (`SYNTHESIS_MODELS`, one call per meeting) already emits
  diarized turns AND, per its own docstring, already reconciles labels across
  segments. **Label stability is solved.** Only naming is missing.
- `meeting_speakers` holds one row per `(meeting_id, label)` with `user_id`
  (a real account) and `display_name` (a hand-typed name for someone with no
  account).
- `resolveSpeakerUserId` resolves a label ONLY through a human-made mapping.
  Its comment states the rule: *"the model's guess that a label IS an
  attendee's name is not evidence."*
- Migration `0029_attribution_membership.sql` exists partly to NULL guessed
  attributions that earlier code wrote. This design must not re-create them.
- Two working pickers render from those mappings: the note timeline
  (`note-timeline.tsx`) and the PDF export (`print-speaker-names.tsx`).

## Decisions

| Question | Decision |
|---|---|
| Scope | **This meeting only.** No cross-meeting voice recognition, no stored voiceprints, no biometric data. |
| Trust | **Propose, never auto-apply.** Every name is a suggestion until a human accepts it. |
| Surface | **Inline in the existing pickers.** No new screen. |

## Architecture

### Where proposals come from

One new field on the synthesis call's existing structured output. No second
Gemini request, no extra key quota, no new model in the routing table:

```ts
speakerHints: {
  label: string          // "Speaker 2"
  proposedName: string   // "Nimal"
  evidence: string       // verbatim quote from the transcript
  turnIndex: number      // ordinal position in the diarized turn list
  kind: 'self-id' | 'addressed' | 'recorder'
}[]
```

`kind` records WHY the model thinks so, and the UI shows it, because the three
are not equally reliable and a reader deserves to know which one they are
accepting.

### The hallucination guard

**A proposal is dropped unless its `evidence` appears verbatim in the stored
transcript.** The server re-reads the segments it just wrote and does a string
search. No match, no proposal, no error surfaced.

This is what makes "propose, never auto-apply" safe rather than merely
deferred. A model can invent a name; it cannot invent a quote that survives a
literal search against the record. Matching is done on the same normalised
text the transcript stores — no fuzzy matching, because a fuzzy match on
evidence would re-admit exactly the guessing this guards against.

### Refusal rules

Each of these produces NO proposal rather than a low-confidence one:

1. **Ambiguous name** — the proposed name matches two or more attendees. Offer
   both as alternatives; choose neither.
2. **Unknown name** — matches nobody on the invite. Still proposed, but as a
   typed outsider name (the existing `display_name` path), never as a
   `user_id`.
3. **Ambiguous address** — `kind: 'addressed'` attributes the name to the
   ADJACENT turn, not the speaking one ("thanks, Nimal" is said BY someone
   else ABOUT Nimal). If the adjacent turn is itself ambiguous — more than one
   candidate turn, or the addressed name is also the speaker's own proposal —
   the proposal is dropped. This failure mode is why auto-apply was rejected.

## Data model

No new table. Three nullable columns on `meeting_speakers`:

| Column | Type | Meaning |
|---|---|---|
| `proposed_name` | `text` | The suggested name. |
| `proposed_evidence` | `text` | The verbatim quote, already validated. |
| `proposed_kind` | `text` | `self-id` \| `addressed` \| `recorder`. |

State reads directly off the row, with no flag to keep in sync:

- `user_id` OR `display_name` set → **confirmed by a human**. Unchanged.
- both null, `proposed_name` set → **an unconfirmed suggestion**.
- all null → nothing known.

**Why this keeps the invariant structurally, not by convention:**
`resolveSpeakerUserId` and `resolveSpeakerNameForLabel` read only
`user_id`/`display_name`. Those columns are untouched by this design, so the
timeline, the minutes, the assistant, the follow-ups and the PDF export keep
rendering "Speaker 2" until a human clicks. A proposal is invisible to every
consumer except the picker that offers it. There is no call-site audit to do
and no leak to miss.

Accepting writes `user_id`/`display_name` and clears all three proposal
columns in one statement, so a stale suggestion cannot sit beside a confirmed
name.

### Migration 0033

`0032` is `0032_webauthn` — taken while this was being designed. The number
was checked against every worktree's `_journal.json`, not main's files,
because numbers have collided three ways across branches before.

Hand-written SQL plus a hand-added journal entry. **Never
`drizzle-kit generate`**: the snapshot chain is missing snapshots for 0027,
0028 and 0031 and 0029's `prevId` is wrong, so generate would try to re-create
existing tables without `IF NOT EXISTS`.

```sql
ALTER TABLE "meeting_speakers" ADD COLUMN IF NOT EXISTS "proposed_name" text;
--> statement-breakpoint
ALTER TABLE "meeting_speakers" ADD COLUMN IF NOT EXISTS "proposed_evidence" text;
--> statement-breakpoint
ALTER TABLE "meeting_speakers" ADD COLUMN IF NOT EXISTS "proposed_kind" text;
```

Additive, nullable, no backfill, no destructive statement; reversible by
dropping the three columns. The journal entry's `when` must be strictly
greater than 0032's. Verify with `information_schema`, never the migration
runner's exit code — it has reported success while applying nothing.

## UI

One line above the existing picker, only when an unconfirmed proposal exists:

> Suggested: **Nimal** — introduced themselves: "this is Nimal" · [Use] [Not them]

**No timestamps.** The pipeline has none to show: segments carry a monotonic
counter, not a clock offset ("the model gives no per-chunk timing"), so
`turnIndex` is an ordinal position in the turn list and nothing more. The
proposal line names the KIND of evidence instead — "introduced themselves",
"was addressed as", "recorded this meeting" — which is the fact the reader
actually needs to judge it. Inventing a plausible-looking `04:12` would be the
same class of error this whole design exists to prevent.

- Nothing is pre-selected. The picker still reads as empty until a human acts,
  because a pre-selected suggestion IS auto-apply wearing a different hat.
- **Use** confirms — writes the mapping, clears the proposal.
- **Not them** clears the proposal only, so it stops asking without asserting
  anything about who the speaker was.
- The evidence quote is always shown. A suggestion a reader cannot check is a
  guess they are being asked to rubber-stamp.
- One component, rendered by both the timeline picker and the export picker,
  since both already read the same mappings.

Bilingual: evidence quotes are shown verbatim and may be Sinhala, English or
code-switched. Never translated, and rendered with the existing
`bilingualText` treatment.

## What this replaces

`src/features/meetings/components/speaker-assignment.tsx`
(`SpeakerAssignmentPanel`, `SpeakerAssignment`, `SpeakerLabelChip`) is
deleted, along with its now-unreachable server action `assignSpeaker` and
reader `getSpeakerAssignmentData`, and the pure planner
`planSpeakerAssignment`.

It arrived with the `integration/2026-08-11` merge, is mounted nowhere, and
does the same job a different way — through a different action set, against a
schema that predates `display_name`. Leaving it means the next person wires it
up beside this one and the product has two ways to name the same voice writing
through two paths. Deleting it is part of this work, not a follow-up.

## Testing

Four tests carry this design. The first three are pure and DB-free.

1. **Hallucination guard** — evidence not present verbatim in the transcript
   drops the proposal.
2. **Ambiguous name** — a name matching two attendees offers both and chooses
   neither.
3. **Ambiguous address** — "thanks, Nimal" attributes to the adjacent turn,
   and drops when that turn is ambiguous.
4. **Re-analysis safety** — re-running analysis over a meeting whose speaker a
   human already named leaves the confirmation intact and the proposal columns
   clear. The upsert is conditional on the confirmed fields being null. This is
   the only path in the design that can corrupt real data, and it is the one
   test that needs the database.

## Out of scope

- **Cross-meeting voice recognition.** Deliberately excluded: it needs stored
  voice references or an in-browser embedding model, and voiceprints are
  biometric data requiring consent and a deletion path. The data model here
  does not preclude it — a future design would add its own table rather than
  change these columns.
- **Auto-applying any name**, at any confidence.
- **Model/device routing** — the second half of the original request, which is
  its own spec.

## Risks

- The synthesis prompt grows a field, and prompt changes can degrade the parts
  that already work. The write-up and action items must be re-checked against
  a real meeting, not just parsed.
- `speakerHints` is model output shaped by a schema; a model that returns the
  field empty is normal and must read as "no suggestions", never as an error.
- Evidence quotes are shown verbatim in the UI. They come from the transcript,
  which is already user content rendered elsewhere, so no new escaping
  surface — but the quote must render as text, never as markdown.
