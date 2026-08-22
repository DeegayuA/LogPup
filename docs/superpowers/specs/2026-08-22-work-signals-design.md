# Work Signals — measuring what people did, without inventing it

**Date:** 2026-08-22
**Status:** spec #1 of 2 (this one: observations, corroboration, role scorecards.
Spec #2: the review pack.)

## The question this answers

"Somebody logged four hours and produced nothing — how would I know?"

The naive answer counts closed tickets, and this repo has already written down
why that answer is wrong. From `worklog_entries` in `src/db/schema.ts`:

> A tech lead whose Tuesday was four meetings, two reviews and a production
> incident closed no ticket and moved no card. If only task-linked time
> counted, their honest full day would compute as zero — the app calling
> somebody lazy for doing their job.

So the system below never computes productivity. It computes **corroboration**:
what somebody claimed, what the workspace independently observed, and the gap.
A gap is a question. It is never a verdict.

## The rule everything obeys

Three-valued, extending `finance/cost.ts`:

- `null` — cannot say
- `0` — can say, and it is nothing

They are different facts and stay different all the way to the screen. A person
with no GitHub login has `null` commits, never `0`. Collapsing the two is how a
report becomes a confident lie about somebody's week.

Every figure carries its `basis` (`measured` | `inferred`) and its `sources`.
The UI renders both. A number whose provenance cannot be named does not ship.

## Architecture

```
src/features/signals/
  figure.ts        Figure<T>: value | null, basis, sources, counter-metric pairing
  observe.ts       raw rows -> Observation[]   (pure)
  corroborate.ts   claimed vs observed, quiet + unclaimed detection (pure)
  roles/pm.ts      per-role scorecards (pure)
  roles/lead.ts
  roles/architect.ts
  roles/member.ts
  queries.ts       the only file that reads the database
  actions.ts       the only file that is a server action
  commands.ts      palette registration
```

Everything above `queries.ts` is pure and synchronous — no database, no clock,
no model — the same split `finance/cost.ts` and `worklog/coverage.ts` already
established. The clock arrives as a parameter so every window is testable.

## Layer 1 — Observations

One shape for every trace a person leaves:

```ts
type Observation = {
  userId: string
  day: string          // YYYY-MM-DD, Asia/Colombo
  kind: ObservationKind
  appId: string | null
  at: Date
}
```

`ObservationKind` is a closed set, split into two classes that the corroboration
layer treats differently:

- **outcome** — `task.completed`, `commit`, `followup.resolved`,
  `review.approved`, `review.rejected`, `bug.triaged`
- **presence** — `task.moved`, `task.created`, `meeting.attended`,
  `meeting.spoke`, `comment`, `checkin.updated`, `worklog.scored`

`activity_log` is the primary source: it already carries `actor_id`, `verb`,
`entity_type` and `created_at`, indexed on `(actor_id, created_at)`. Only two
observations come from outside it — commits (`github/evidence.ts`) and voice
turns (`meeting_speakers` / `meeting_note_segments`), because neither writes an
activity row.

## Layer 2 — Corroboration

Per person per day: `claimedMinutes` from `worklog_entries` against that day's
observations.

**There is deliberately no ratio of hours to events.** No honest conversion
exists between "three hours" and "two commits", and a ratio would invent one.
The output is a four-valued verdict:

| Verdict | Meaning |
|---|---|
| `strong` | at least one **outcome** observation |
| `partial` | presence observations only — attended, moved, spoke, self-scored |
| `none` | claimed minutes, zero observations of any kind |
| `not-applicable` | nothing claimed and nothing expected (leave, non-working day) |

A self-score **with a note** counts as `partial`. A first-person account of a
day is a weaker trace than a commit, but it is a trace, and treating it as
silence would punish the one person who wrote down what they did.

### The only thing that escalates

```
quiet := >= QUIET_RUN_DAYS consecutive WORKING days
         with verdict 'none' and claimedMinutes > 0,
         and the person is not on approved leave,
         and their allocation is above zero
```

Working days come from `src/lib/working-days.ts` (Saturday is a half day, and
a mercantile holiday beats Saturday). Leave comes from `absences` with
`status = 'approved'` — flagging somebody who filed leave correctly is the
single worst failure this feature could have.

The result carries `checkedChannels: string[]`. A reader must be able to see
what "nothing" actually covered, because "nothing" is a claim about the
observer as much as the observed.

### The inverse, which exists to protect people

`unclaimed` — observations exist on a day with no worklog entry. Somebody did
the work and did not log it. It ships in the same object as `quiet`, from the
same pass, so no surface can show one without the other being available.

## Layer 3 — Role scorecards

Each role gets at most six figures. Each headline is **paired with a
counter-metric**, so improving the headline by gaming it degrades its pair.

### PM — attributed through `app_role_history(role='pm')`

| Figure | Counter-metric |
|---|---|
| Committed-due tasks hitting `original_due_date` | `due_changed_count` — moving the goalposts |
| Follow-up closure latency (median days) | share closed with no `resolutionNote` |
| Meeting hygiene (density, churn, collisions) | participation medians — cutting meetings people used |
| Team check-in freshness | median `checkinGap` — chasing the number, not the work |
| Oldest assigned task still in `todo` | — |
| Project effort mix | — |

### Tech Lead — `app_role_history(role='lead')`

| Figure | Counter-metric |
|---|---|
| Review throughput per working day | defect escape — bugs opened within 14 days of a completion |
| Unblocking latency | — |
| Cycle time p50 **and p90** | — |
| **Personal WIP** (headline, not footnote) | — a lead holding nine in-flight tasks is the bottleneck |
| Reopen rate | — |
| Own review/support effort share | — |

### Architect / reviewer — `isReviewerRole()` over `assignments.role`

This role leaves the least machine-readable trace, and its scorecard says so in
its own words rather than rendering zeros.

- Decision trace: `change_requests` reviewed, comments on committed work
- **Voice participation is the primary output**, not a supplement
  (`meeting-load/participation.ts` — output count is a proxy for value, and
  discussion is allowed to overrule the proxy)
- Review coverage over committed-due work in their apps
- Follow-ups they authored (`created_by` is the "a human asked for this" flag)
- Counter: **breadth** — an architect spread over eleven apps is a warning

### IC / member

Cycle time p50/p90, completions per working day, commits, effort mix, accounted
coverage (unchanged, and still never re-labelled as a percent), allocation
against capacity.

## Fairness rules, enforced by tests rather than comments

1. **As-of attribution.** A PM is measured only over the window they held the
   role, from `app_role_history`'s half-open intervals. No retro-blame for a
   project somebody inherited last week.
2. **Absence-aware denominators.** Every per-day rate divides by working days
   minus approved leave. Never by calendar days.
3. **k-anonymity.** Any rollup over fewer than `MIN_COHORT` people is
   suppressed, reusing the `MIN_COST_CONTRIBUTORS` pattern from
   `finance/cost.ts`. A team KPI for a team of one is that person's appraisal
   wearing a project's name.
4. **No cross-role comparison.** `PmScorecard` and `LeadScorecard` are distinct
   types sharing no common sortable numeric field, so ranking a PM against a
   lead does not typecheck.
5. **Symmetry.** Every figure a manager can see about a person is on that
   person's own page, in the same words, on the same day.

### The golden test

*The tech lead's Tuesday*: four meetings, two reviews, one incident, zero
tickets closed. It must read as a full, corroborated day. This case fails the
obvious design, and is the reason for this one.

## Deliberately not built

- **No single composite score.** Every other figure stays honest only while
  nothing collapses them into one rankable number. This is the one decision
  that cannot be bolted on later, which is why it is stated here rather than
  omitted.
- No leaderboards or ranking.
- No lines-of-code, and no commit count presented as productivity.
- No "utilisation %" tile.
- No real-time surveillance view.

## Schema

**No new tables in spec #1.** Everything derives from rows that already exist.
The review pack (spec #2) needs `review_packs` and `review_pack_notes`, and
those get hand-written SQL plus a journal entry — `drizzle-kit generate` stays
banned until the snapshot chain is repaired.

## Palette

`signals` joins `NO_SEARCH` for the same two reasons `finance` did: these are
figures you read *on* a person or project, not rows you jump *to*, and
per-person output data is sensitive. It contributes navigation commands only.
