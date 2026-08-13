# Attribution Truth & Membership — Design Spec

Date: 2026-08-11 · Branch: main (worktree `agent-afceaa63933ac4edd`) · Status: approved-by-directive

Design system: `docs/superpowers/specs/2026-08-11-ui-redesign-design.md` ("watchdog calm").
Every colour/type decision below is a token reference; no raw hex/oklch enters a component.

## The bug this fixes

`resolveSpeakerUserId` (`src/features/meetings/notes.ts`) fell through to
`matchPersonToAttendee(label, attendees)` whenever no `meeting_speakers` row existed for a
label. A speaker label is a *model guess* — the Gemini prompt asks it to "map speakers to
attendee names where possible". So the moment the model wrote `"speaker": "Irushi Anupama"`
for a voice turn where Irushi was being **talked about**, the name matched an attendee row
and the segment rendered as established fact: her name, no hedge, no way to tell it apart
from a human-confirmed attribution.

It propagated. `ai-actions.ts` used the same function for
`meetingTaskSuggestions.suggestedUserId`, so one wrong guess pre-filled a real task's
assignee with the wrong person, one click from being created.

The root defect is not the matcher — `matchPersonToAttendee` is careful and refuses on
ambiguity. The defect is that a *guess* and a *confirmation* were stored in the same column
with nothing to tell them apart. This spec makes the distinction structural.

## Section 1 — Never guess

**Rule: an explicit `meeting_speakers` row is the ONLY thing that resolves a label to a
person. No row ⇒ `null`.**

- `resolveSpeakerUserId(label, mappings)` loses its `attendees` parameter entirely. Dropping
  the parameter (rather than leaving it unused) makes the compiler find every call site.
- `speakerLabel` is still stored and still rendered — it is the honest record of what the
  transcript said. It renders as a **label**, not as a person.

### Rendering: label chip vs. person name

| state | render |
| --- | --- |
| resolved (`speakerName`) | plain text, `font-medium` — a person |
| unresolved (`speakerLabel`) | mono chip: `font-mono text-xs`, `border border-dashed`, `bg-muted/40`, `text-muted-foreground` |
| typed/ai segment | author name, plain text |

`Speaker 1` and `Irushi Anupama` both get the chip until someone confirms. That is the whole
point: the chip means "the recording called this voice X", never "X said this". Geist Mono is
already the spec's carrier for machine-generated identifiers (slugs, counts, dates); a raw
diarization label belongs in the same family. Dashed border marks it provisional, matching
every other "not settled yet" surface in the app.

### Data repair — migration `0018`

Numbering moved twice while this was in flight. `main` now carries `0015_assignment_history`,
`0016_assignment_history_one_open` and `0017_meeting_recording_segments`, so this migration is
`0018` and follows `0017` with no gap. It was regenerated with `drizzle-kit generate` against
the merged schema — not renamed — so `meta/0018_snapshot.json` diffs correctly from
`0017_snapshot.json` and the next `generate` starts from the right base.

Two statements, both replay-safe by construction (they are idempotent `UPDATE`s whose
`WHERE` clause stops matching once applied):

```sql
UPDATE meeting_note_segments s SET speaker_id = NULL
WHERE s.speaker_id IS NOT NULL
  AND s.speaker_label IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM meeting_speakers m
                  WHERE m.meeting_id = s.meeting_id AND m.label = s.speaker_label);
```

`s.speaker_label IS NOT NULL` is an addition to the brief's SQL, and it matters: `label = NULL`
is never true, so a segment with a speaker_id and no label would have matched `NOT EXISTS` and
been wiped. Such a row was never label-resolved and therefore is not in the target set
("auto-matched, never human-confirmed"). Today no writer produces that shape; the guard costs
nothing and removes the trap.

```sql
UPDATE meeting_task_suggestions t SET suggested_user_id = NULL
WHERE t.suggested_user_id IS NOT NULL
  AND t.status = 'open'
  AND NOT EXISTS (SELECT 1 FROM meeting_speakers m
                  WHERE m.meeting_id = t.meeting_id AND m.user_id = t.suggested_user_id);
```

Two deviations, both deliberate:

1. **`meeting_task_suggestions` has no label column.** The assignee label the model produced
   was consumed at insert time and never stored, so "the label has no mapping" is not
   expressible here. The closest honest predicate is "no human has confirmed this person is
   even a speaker in this meeting" — `m.user_id = t.suggested_user_id`. It is conservative in
   the correct direction: a suggestion reverts to Unassigned unless a human vouched for that
   person being in the room.
2. **`status = 'open'` only.** An `accepted` suggestion already became a real task; rewriting
   its `suggested_user_id` would falsify the record of what was accepted. A `dismissed` one is
   inert. Only an open card is live UI that can still mislead someone into a wrong assignment.

## Section 2 — "Who's who" that can add people

The control at `note-timeline.tsx:313-359` moves to
`src/features/meetings/components/speaker-assignment.tsx`, exporting:

- `SpeakerAssignment` — one label's row (chip + picker).
- `SpeakerAssignmentPanel` — the whole "Who's who" section. Takes `data` when the host already
  has the timeline payload (the note timeline does), and **self-fetches** when it doesn't, so a
  second host can mount it with two props.

### Three tiers, one picker

```
┌ Attendees ─────────────────  meeting_attendees ∩ users
├ Elsewhere in the org ──────  active approved users not on this meeting
├ Not a listed attendee ─────  explicit null mapping (unchanged)
└ Add someone new… ──────────  admin only → dialog (name + email)
```

Tiers 1 and 2 are `SelectGroup`s so the boundary is visible: picking someone from tier 2 is a
bigger claim than picking an attendee, and the UI should say so before the click, not after.

### One action, no half-applied state

`assignSpeaker` is a single server action that owns the whole cascade. neon-http has no
interactive transactions, but `db.batch` is one transaction — so every statement commits
together or none does. There is no reachable state where a label is mapped to someone who
isn't an attendee, or an attendee exists with no membership history.

Batch contents, in FK-safe order:

1. *(tier 3 only)* `INSERT users` — id generated client-side with `crypto.randomUUID()` so
   later statements can reference it, exactly as `createMeeting` does.
2. `INSERT … ON CONFLICT DO UPDATE meeting_speakers` — the mapping.
3. `UPDATE meeting_note_segments SET speaker_id` for every segment carrying that label.
4. *(if not already an attendee)* `INSERT meeting_attendees` with `response: 'pending'` —
   they were in the room but never RSVP'd, and 'pending' is the honest value.
5. *(same condition)* `INSERT meeting_attendee_history` — open `'added'` row.
6. *(if the meeting has an appId and they have no `assignments` row for it)*
   `INSERT assignments` + the standard close/open `assignment_history` pair.

Steps 4–6 use **one** `at = new Date()` shared by every interval boundary in the batch.

Tier-3 creation reuses the org's existing rules rather than inventing softer ones:
`emailAllowed()` (a user outside the sign-in domain allowlist would be a locked door),
`orgForEmail()` for org tags, `status: 'approved'` (an admin adding them *is* the vetting
step — 'pending' exists for open Google self-signup). No starter password is minted: the
person signs in with Google when they first need to, and the row exists now purely so
attribution has something true to point at.

Auto-created assignments use role `Contributor` at **5%** — the minimum the admin allocation
UI permits — with a history `note` saying it was created by speaker attribution and the
allocation is a placeholder. Claiming a real percentage nobody decided would corrupt every
capacity total; claiming the floor, labelled, does not.

## Section 3 — Membership history

`meeting_attendees` is a bare composite-PK table: delete a row and the attendance never
happened. `meeting_attendee_history` is its append-only sibling, copying
`assignment_history` semantics (`src/db/schema.ts:74-100`) **exactly**:

| assignment_history | meeting_attendee_history |
| --- | --- |
| `(userId, appId)` | `(meetingId, userId)` |
| `role` (carried on removal) | `response` (carried on removal) |
| `allocationPct` (forced to 0 on removal) | — no numeric payload to zero |
| `allocation_change` = assigned/updated/removed | `attendance_change` = added/updated/removed |
| half-open `[effectiveFrom, effectiveTo)` | identical |
| at most one open row per key | identical |
| removal = close + tombstone with `changedBy` | identical |
| tombstone dropped from `breakdown` | tombstone dropped from the roster |

The enum is new only because "assigned" reads wrong for meeting attendance. The three states,
the interval algebra, and the tombstone rule are the same pattern, not a second one — the
read side literally reuses `selectRowsAsOf` from `allocation-history.ts` rather than
reimplementing the comparison.

**Why tombstone rather than close-only** (verbatim from the original decision): a close-only
write records *when* but not *who*, and it forces "no open row" into a special case in every
"as of" query. An explicit `'removed'` row carries `changedBy` and keeps the read rule uniform
— "the row open at the date wins".

Both writes come from one JS `Date` in a single `db.batch`, so `[previous.effectiveFrom, at)`
and `[at, …)` abut exactly. Deriving them separately (two `new Date()`s, or SQL `now()` on one
side) leaves a gap or an overlap at the boundary and quietly corrupts every "as of" answer
that lands in it.

### Removal never touches the past

`removeMeetingAttendee` deletes the live row and writes the tombstone. It does **not**:

- clear `meeting_note_segments.speakerId` — they did say those words;
- reassign `tasks.assigneeId` on tasks already accepted from a suggestion;
- touch `meeting_speakers` — the mapping stays as the record of who that voice was.

Removing someone from the invite list is a statement about the future. The transcript is a
statement about the past, and the past is not editable from here.

RSVP changes (`respondToMeeting`) write an `'updated'` row through the same close/open pair.
Without that, the open interval's `response` drifts out of sync with the live table and the
history stops being a history.

Project-side membership is untouched: `assignments` + `assignment_history` via the existing
`buildHistoryEntry` path.

### Backfill

One open `'added'` row per existing `meeting_attendees` row, guarded by `NOT EXISTS` so the
file replays cleanly.

`0018` also mirrors the partial-unique index `main`'s `0016` added to `assignment_history`:
`meeting_attendee_history_one_open_idx` on `(meeting_id, user_id) WHERE effective_to IS NULL`.
That makes "at most one open row" a rule the database enforces rather than a convention every
writer must remember — and it immediately caught a real bug: `assignSpeaker` re-adding a
previously-removed attendee inserted a second open row without closing the tombstone. It now
uses the same close-then-open pair as every other writer. It is declared in `schema.ts` with
`.where(sql\`${t.effectiveTo} is null\`)`, exactly as `0016` declares its own, so drizzle-kit
emits and tracks it rather than it living only in hand-written SQL.

`effectiveFrom = meetings.created_at`, `changedBy = meetings.created_by`. Unlike the
`assignment_history` backfill — whose actor had to be *inferred* from the app lead — this one
is close to observed: the attendee list is written in the same `db.batch` as the meeting row
by the meeting's creator. The row still carries a note saying so, because an attendee could in
principle have been added later by someone else and this backfill cannot tell.

## Section 4 — Tests

Beside `src/features/meetings/notes.test.ts` and
`src/features/meetings/attendance-history.test.ts`, following the
`allocation-history.test.ts` fixture shape (`row(over)` factory, named month constants).

The regression guard, stated as the thing that must never come back:

```ts
it('returns null for an unmapped label that EXACTLY matches an attendee name', () => {
  expect(resolveSpeakerUserId('Nadeesha Perera', [], )).toBeNull()
})
```

Plus: interval selection at the supersession instant, tombstone excluded from the roster but
in force for "as of", `buildAttendanceEntry` carrying the last response onto the tombstone,
and — the non-attendee cascade — a test that assigning someone who is neither an attendee nor
assigned lands rows in all three tables (`meeting_speakers`, `meeting_attendees`,
`assignments`) from one batch.

The cascade test targets a pure planner, `planSpeakerAssignment`, that decides *which* writes
a given (mapping, attendee set, assignment set) implies. The server action executes that plan.
This keeps the decision — the part with the branching that can be wrong — unit-testable
without a database, which is the same split `notes.ts`/`followups.ts` already use.

## Section 5 — the third surface: follow-up attribution

`deriveAndInsertFollowups` set `meeting_followups.userId` by name-matching the model's
`perPerson[].name` / `questions[].person` against the source meeting's attendees — the same
bug as Section 1 on a surface where it hurts more, because a follow-up is a claim that a named
person OWES something and it carries forward to every future meeting they attend. A wrong
match did not mislabel one row; it followed an innocent person around.

The derivation moves to a pure `buildFollowupRows` in `followups.ts`, which resolves through
`resolveSpeakerUserId` against confirmed `meeting_speakers` mappings. `followups.ts` now
imports `notes.ts` (one direction — `notes.ts` imports nothing) so the rule is literally one
function, not two that can drift.

`personName` already stored the raw guess, so no schema change was needed: it renders as the
same mono label chip the timeline uses, and `assignFollowupPerson` lets a human attribute it
afterwards. That affordance lives in the note timeline ("Who owes this?"), not the intel
panel, because `meeting-intel.tsx` is owned by another agent — and it has to live *somewhere*,
since an unattributed follow-up carries forward to nobody and would otherwise be invisible.

The data repair rides inside `0018` rather than adding a migration. `meeting_followups` has no
"unactioned" flag, so the target set is three conditions: `created_by IS NULL` (the precise
discriminator — hand-added follow-ups always carry an actor and an explicitly picked person,
so only AI-derived rows were ever name-matched), `status = 'open'`, and
`response_note IS NULL AND defer_reason IS NULL` (an open item can still have been worked, and
a human engaging with an attribution is as good as confirming it).

## Out of scope (named, not silently skipped)

- `matchPersonToAttendee` itself is kept (still exported and tested). Nothing in the
  attribution path calls it any more; it is left in place rather than deleted because it is a
  correct, careful matcher and a future *suggestion* surface — one that proposes a person for
  a human to confirm — is exactly what it is for. What was wrong was treating its output as a
  fact, not the function.
- `meeting-intel.tsx` is owned by another agent. `SpeakerAssignmentPanel` is built to mount
  there in two props; the mount itself is reported, not made.
