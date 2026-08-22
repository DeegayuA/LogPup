# Recurring meetings

Date: 2026-08-22
Status: design agreed, not yet implemented

## The problem

LogPup has no recurrence concept. A weekly sync is N unrelated `meetings`
rows that someone retyped N times. Miss a week and nothing notices; rename
one past the normaliser's tolerance and the series silently splits in two.

What exists today is *inference*, not recurrence. `seriesKey()`
(`src/features/meetings/series-key.ts`) normalises a title — stripping the
date, weekday, cadence word and sprint number — and whatever survives is
treated as the series identity. `sameSeries()` compares two rows on that key
plus `appId`. Eight non-test modules depend on it, including the whole of
`features/meeting-load`.

That inference is retrospective analytics. It answers "these six rows look
like one weekly sync". It cannot schedule anything, and the New meeting
dialog has no Repeat control because there is nothing for one to write to.

## Constraints discovered

Three facts about this codebase shaped every decision below.

**Fourteen child tables reference `meetings.id`** — notes, AI notes,
attendees, recordings, screen keyframes, tasks, followups, share links.
An occurrence must therefore be a *real row*. There is nowhere to attach a
recording to a computed one.

**No RRULE support exists.** `features/calendar/google-calendar.ts` never
sends recurrence and `features/meetings/ics.ts` never emits it.

**Timezone handling is already correct and reusable.**
`calendar-grid.ts` exposes `zonedDayStartMs(iso, timeZone)`, built on
`Intl.DateTimeFormat` rather than a hardcoded offset, with a comment
recording why: "a helper that only happens to be correct for one timezone is
a trap". The expander builds on it and inherits DST correctness free.

## Decision: materialised occurrences

Occurrences are real `meetings` rows, created ahead of time and linked by a
series id.

Rejected alternatives:

- *Virtual occurrences computed at read time.* Infinite horizon and no job,
  but every read path that shows a meeting would have to expand the rule,
  subtract materialised overrides, then merge and dedupe. Fourteen child
  tables would see nothing until a row existed.
- *Google owns recurrence.* Send an RRULE, let Google expand, import back.
  Requires an import path that does not exist, and makes recurrence
  impossible for any meeting whose calendar is not connected.

Materialising means the expensive cases are already solved by code that
exists: moving one occurrence is `updateMeeting`, cancelling one is the
existing soft delete.

## Data model

### `meeting_series`

The rule plus the standing template for occurrences it creates.

    id, title, app_id, agenda, meeting_url
    freq 'daily' | 'weekly' | 'monthly'
    interval integer notnull default 1
    by_weekday integer[]                      -- weekly only, 0 = Sunday
    monthly_mode 'day-of-month' | 'nth-weekday'
    time_zone text notnull default 'Asia/Colombo'
    start_minutes integer notnull             -- minutes past local midnight
    duration_minutes integer notnull
    anchor_date date notnull                  -- first candidate day, local
    until_date date                           -- null = open-ended
    calendar_organiser_id, google_calendar_id
    auto_assign_tasks boolean notnull default true
    created_by, created_at
    deleted_at, deleted_by                    -- soft delete, per project rule

Wall-clock time (`start_minutes` + `time_zone`) rather than a stored instant
is deliberate. A 9am weekly stored as a UTC instant drifts an hour across any
DST boundary. Colombo has no DST, which is precisely why that bug would ship
silently and surface only when someone travels.

### `meeting_series_attendees`

The standing invite list: `series_id`, `user_id`, `optional`.

Not YAGNI. Without it, materialised occurrences have no attendees, so no RSVP
and no calendar invites, and the feature is decorative.

### Two columns on `meetings`

    series_id      uuid references meeting_series(id) on delete set null
    occurrence_key date

`occurrence_key` is load-bearing. It is the *slot identity* — the local date
the rule generated — held separately from `starts_at`, which someone may have
moved. A unique index on `(series_id, occurrence_key)` that **counts
soft-deleted rows** is what stops a cancelled occurrence being resurrected
the next time the horizon extends.

A `date` suffices because no supported rule produces two occurrences on one
local date. If multiple-times-per-day is ever added, this becomes a
timestamp and the index moves with it.

## Expansion

`src/features/meetings/recurrence.ts`, pure — no I/O, no `Date.now()`:

    expand(rule, fromIso, toIso): string[]           -- local dates
    occurrenceInstant(rule, dateIso): { startsAt, endsAt }
    rruleFor(rule): string                           -- RFC 5545, outward only

No RRULE *parsing*. We generate the small set of patterns a studio uses and
emit RRULE outward; we never accept an arbitrary one. That is the difference
between a tested module and vendoring a calendar library.

## Horizon

Filled lazily. No cron to own.

`ensureHorizon(seriesId, now)` materialises to `HORIZON_DAYS` (90) ahead,
inserting with `ON CONFLICT DO NOTHING` against the unique index so
concurrent reads cannot double-insert. It is a write on a read path, so it is
guarded by one indexed check — `max(occurrence_key) < horizon` — and does
nothing in the common case.

## Edit semantics

| Action | Implementation |
|---|---|
| Move one occurrence | `updateMeeting`. Nothing new. |
| Rename one occurrence | `updateMeeting`. Nothing new. |
| Cancel one occurrence | Existing soft delete. The unique index keeps it dead. |
| This and following | New. See below. |

**This and following**, the only new path:

1. Old series `until_date` = the day before the edited occurrence.
2. Soft-delete future *empty* occurrences of the old series.
3. Create the new series from the edit, `anchor_date` = that occurrence.
4. `ensureHorizon(new series)`.

"Empty" is a precise, tested predicate: no notes, no AI notes, no recording,
no screen keyframes, no tasks, no RSVP past `pending`. A future occurrence
that fails it is a meeting someone already invested in — it gets
`series_id = null` and survives as a standalone meeting rather than being
deleted to keep the rule tidy.

**Past occurrences are never touched by anything.** This is why "all events"
was rejected outright: rewriting a meeting that already has a recording,
notes and marked attendance is a lie about what happened. Migration
`0034_app_role_history` exists in this repo because overwriting a historical
holder in place destroys the answer to "who held this on 12 June". The same
mistake one table over is not cheaper.

## Google and ICS

`.ics` gets a real `RRULE`. It is a one-shot artifact with no sync state, so
this is pure win: one repeating event in Gmail or Outlook instead of
fifty-two strangers.

**Google recurrence is deferred, deliberately.** Sending an RRULE means one
Google event per series, which means editing a single occurrence must patch a
Google *instance* via `recurringEventId`. That API path does not exist here,
and its failure mode is a 403 that `schema.ts` already warns is
indistinguishable from the insufficient-scope 403 — mislabelling which is how
a fixable permission problem becomes "Google is broken".

Phase 1 therefore syncs each occurrence exactly as today: one Google event
per meeting. Consistent with current behaviour, not a regression.

## Compatibility

`seriesKey()` stays. It becomes the fallback for the existing rows that have
no `series_id`, exactly as `legacy-notes.ts` does for notes. The eight
consumers read "stored series id, else inferred key", so none of them
change behaviour on the day this ships.

## Testing

- `recurrence.test.ts` — expansion across month ends, leap days, `interval > 1`
  anchoring, and a DST boundary in a non-Colombo zone.
- `series-split.test.ts` — the empty predicate, and the "this and following"
  reconciliation.
- A resurrection test: cancel an occurrence, extend the horizon, assert it
  stays gone.
- `live.test.ts` already enforces soft-delete reads by scanning source text;
  both new tables must be named literally there.

## Scope

One migration (0055), two new pure modules with tests, two new tables,
`meetings` plus two columns, series CRUD actions, and a Repeat control in the
New meeting dialog plus an edit-scope prompt.
