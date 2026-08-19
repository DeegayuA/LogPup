# Worklog: a calendar, per-task hours, and an AI cross-check

**Date:** 2026-08-20
**Status:** Design — the open question in "The percent problem" needs answering before planning.
**Owner decisions locked:** per-task hours with percent derived; AI both drafts on request AND reviews on save; the worklog page becomes a calendar you log into.

## Goal

A worklog day currently holds one self-scored `percent` and a free-text note, entered on a single-day form. Three changes:

1. **Where the hours actually went** — per-task and per-category time entries.
2. **AI that both proposes that breakdown and sanity-checks it** against evidence the app already holds.
3. **The page becomes a calendar** — you see the month, and you log into a day by clicking it.

## The percent problem — read this before anything else

`daily_worklogs.percent` is documented in the schema as *"of what I planned today, self-scored: it has to stay meaningful on a day of meetings, review and debugging that closed no ticket."* That sentence is why the field exists.

**Deriving percent from per-task hours breaks exactly that property** — unless non-task time is first-class. A tech lead who spends Tuesday in four meetings, two reviews and one production incident closes no ticket and moves no card. If percent derives only from task-linked hours, their honest full day computes as zero.

So the design's first commitment: **a time entry does not require a task.** Every entry carries either a task reference or a category, and both count toward the day.

That still leaves derived percent meaning something different from today's. Derived answers *"how much of my scheduled day is accounted for"* — a coverage question. Self-scored answers *"how much of what I set out to do did I get done"* — a judgment question. A good day can be 100% on one and 60% on the other.

**Recommendation: keep both, and stop calling them both "percent".**
- `hoursLogged / scheduledHours` becomes **Accounted** — computed, never typed, shown as a progress affordance rather than a score.
- `percent` stays **self-scored** and unchanged in meaning, and remains what history views, averages and the coverage rollup read — so nothing downstream silently changes meaning under other people's work.

If percent must instead be literally replaced by the derived value, that is a data-meaning migration touching every history view, every average, and the in-flight coverage work. It needs its own decision and its own migration, and must not ride in on this feature.

## Data model

New table `worklog_entries` — many per person per day:

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | FK users, cascade | |
| day | date | Asia/Colombo calendar day via the existing `resolveWorkDay` helper — never a UTC slice |
| minutes | integer | minutes, not hours: 90 beats 1.5, and integers avoid float drift when summing |
| task_id | FK tasks, nullable, ON DELETE SET NULL | set when the time went to a tracked task |
| category | enum | `task`, `meeting`, `review`, `support`, `admin`, `learning`, `other` |
| note | text nullable | one line: what it was |
| source | enum | `manual` \| `ai_suggested` — lets us measure how often an AI draft is accepted unedited |
| created_at / updated_at / deleted_at | timestamp | soft delete, per the repo rule |

Rules:
- `category = 'task'` requires `task_id`; every other category forbids it. Enforced in the action, not by a check constraint — a task deleted later must not make an old row unsavable.
- **Self-only writes**, inherited from `daily_worklogs`: there is deliberately no `worklog.write.any` for any role, and this table does not introduce one.
- Entries hang off `(user_id, day)`, not off a `daily_worklogs.id`, so logging time never requires the header row to exist first.

## The calendar

The page becomes a month calendar of the person's own worklog, with the single-day form appearing for whichever day is selected. **Reuse the meetings calendar components rather than writing a second calendar** — `meetings-month-calendar.tsx`, `meetings-day-rail.tsx` and `meetings-agenda.tsx` already solve month layout, day selection and the Colombo day boundary. Extract what is shared instead of forking it; a second calendar implementation will drift from the first within a month.

Each day cell shows, at a glance:
- **accounted hours against scheduled** (e.g. `6.5 / 8`), the primary number;
- a **state** whose word carries the meaning, never colour alone — `Logged`, `Partial`, `Missing`, `Absence`, `Holiday`, `Non-working`;
- self-scored percent as a secondary mark when present.

Selecting a day opens that day's entries editor inline. This is also how backfill works, which makes the calendar the natural home for what the catch-up panel does today — **but the catch-up panel belongs to another session and is being rewired to `computeCoverage`; its fate is theirs to decide, not something this design removes.**

Non-working days, approved absences and holidays must render as themselves, not as failures. A person on approved leave seeing "Missing" for five days is the exact failure this app's coverage work exists to prevent.

## AI: draft on request, review on save

**Evidence both use — and the limits on it:**
- **Meetings attended, with real start and end times.** The strongest signal, because it is recorded rather than remembered.
- **Activity log** rows for that person that day — tasks moved, comments, check-ins — each with a timestamp and an entity.
- **Tasks assigned and in progress** in their sprints.
- **Deliberately NOT used: meeting transcripts and screen keyframes.** Those exist to write up meetings. Mining them to audit how someone spent their hours turns a work tool into a surveillance tool, and this design refuses that even though the data is right there.

**Draft (on request, a button).** Feature slug `worklog.entries-draft`, ANALYSIS chain. Proposes entries with minutes, categories and task links. Every proposed row is marked `source: 'ai_suggested'` and is editable before saving. It never submits on the person's behalf.

**Review (automatic, at save).** Feature slug `worklog.entries-check`, QUICK chain. Returns observations only, never a block. What it should catch: total hours far above or below the scheduled day; a meeting attended with no time accounted for; hours against a task with no activity that day; a multi-hour gap; the same task logged twice.

**The check must not become a nag.** Saving always succeeds. Observations appear inline after save, never in a modal. A dismissal sticks for that day. When there are no observations, nothing renders at all — silence is the common case and must read as success, not as a check that failed to run.

**It says "check", never "wrong".** The person was there; the app was not. Copy is observational — *"3 hours here have no matching activity, which is normal for heads-down work"* — never accusatory.

**The pure-function commitment.** The discrepancies are found by a pure function over `(entries, evidence)`; the model is asked only to phrase what that function found, never to decide what is wrong. An AI that invents a discrepancy about someone's working day is worse than no check at all, and this is the structural guarantee that it cannot.

## Coordination — three sessions work in this area

- **logpup-36** owns the worklog page copy, the rules line, and the catch-up panel.
- **logpup-fa** owns `absences`, `work_schedules` and `computeCoverage`. This design **reads** scheduled hours through their helper and must not derive its own.
- **This session** owns the AI plumbing (registry, ledger, prefs) that the two new features register into.

Nothing here gets built without agreeing the entries editor and calendar ownership with logpup-36, and taking the scheduled-hours and absence predicates from fa rather than writing second copies.

## Testing

- Pure: minutes formatting; day totals; accounted-percentage against a schedule pattern; the category/task rule; day-state derivation including absence and holiday.
- The check function is pure over `(entries, evidence)`, so every observation type is unit-tested with no AI call in the loop.
- Actions: self-only writes; wrong category/task combination rejected; an approved-absence day produces no missing-hours observation.

## Out of scope

- Timers, clock-in/clock-out. This is end-of-day recall, not tracking.
- Billing, invoicing, client rates.
- Any admin-visible per-person hours audit. Deliberate: the moment these numbers grade people they stop being honest, and the check becomes something to game rather than a help.
