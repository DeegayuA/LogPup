# Merge report: `main` → `feat/soft-deletes`

**Status: DONE**
**Commit (HEAD, both `feat/soft-deletes` and `main`): `70da3e19e7326abde4250364ab483ef7aa5849e0`**

## TL;DR

`git merge main` in this worktree did **not** stop with ~30 conflicts as
expected — it completed as a **fast-forward**, with zero conflict markers to
resolve. That is not a shortcut I took; it's what `git merge main` reported
back immediately:

```
70da3e1 HEAD@{0}: merge main: Fast-forward
0988e34 HEAD@{1}: reset: moving to HEAD
```

Reason: `main` in this repository's shared `.git` (visible from every
worktree, including this one) had **already** absorbed
`feat/soft-deletes`@`0988e34` — the exact commit this worktree started at —
as an ancestor. `git merge-base --is-ancestor 0988e34 main` returns true;
`git merge-base 0988e34 main` returns `0988e34` itself. Someone (another
session, working directly on the `main` branch — shared across worktrees
since branches aren't worktree-local) had already done this identical merge:

```
5baa0ef merge: soft deletes with admin trash and restore     (parents: ed1bb0d [main], 0988e34 [feat/soft-deletes tip])
cffb050 fix: repair three call sites the soft-deletes merge broke
6bcbbbc fix: restore main's side of four files the soft-deletes merge took wholesale
5423315 fix: renumber migrations to 0027/0028 to clear collisions with main
359538f merge: attendee recommender                          (a second, later main-side merge, unrelated to this task)
```

and `main` moved on from there (attendee-recommender work, daily work-log
feature, calendar-grid fixes, etc.) up to `70da3e1`.

Given that, I did **not** blindly trust the fast-forward. I treated this as
"someone else's resolution, now verify it against the same principles I was
given" — read the fix commits, independently re-checked every invariant
called out in the task, and ran all four gates myself before concluding this
is correct. Details below.

## What I verified, and why I believe it's right

The two follow-up fix commits are exactly the class of bug this task warned
about, which is reassuring rather than alarming — they show the first pass
of this merge *did* make the classic mistakes, and they were caught and
fixed before I ever touched this worktree:

- **`6bcbbbc`** — the original merge commit (`5baa0ef`) landed four files
  (`app/(app)/page.tsx`, `e2e/smoke.spec.ts`, `sprints/actions.ts`,
  `sprints/task-actions.ts`) byte-identical to one side because they were
  "still unresolved" when the merge was concluded — i.e. exactly the
  "take one side wholesale" failure mode principle 1 warns against. Redone
  as a proper three-way merge combining both sides' intent (main's
  Suspense-zone dashboard restored in `page.tsx`; `sprints/task-actions.ts`
  ended up with *both* main's `liveTasks`/`liveSprints` reads and ours'
  follow-up-sync / activity-label logic).
- **`cffb050`** — `getMeetingById` (`src/features/meetings/queries.ts`) and
  `getSprintTaskCounts` (`src/features/sprints/queries.ts`) were left reading
  raw `meetings`/`tasks` instead of `liveMeetings`/`liveTasks` in the
  function bodies main had added after the branch point — a live-table
  omission that would have counted/returned soft-deleted rows. Fixed to use
  the live views everywhere in both files.

I then independently re-checked, on the current tree, every invariant the
task called out as high-risk:

| Invariant | Check performed | Result |
|---|---|---|
| Legacy-notes probe stays raw, stays called at both sites | Read `src/features/meetings/legacy-notes.ts` (still reads raw `meetingNoteSegments`, with the "must not resurrect" comment intact); `grep haveNoteSegmentsEverExisted src/features/meetings/ai-actions.ts` | Both call sites present: line 2856 (`getMeetingNoteTimeline`) and line 2907 (`addTypedNoteSegment`) |
| `getMeetingNoteTimeline` has theirs' batching AND ours' live* targets | Read the function body | `Promise.all([fetchAttendees, liveNoteSegments select, meetingSpeakers select, fetchTaskSuggestions, fetchApprovedUsers])` — five-way batch, keyed off a `liveMeetings`-validated `id`; segment query targets `liveNoteSegments` |
| `_journal.json` keeps both sides' migrations, distinct idx, increasing `when` | Parsed the journal | 0025 `meeting_suggestion_app`, 0026 `meeting_speaker_display_name`, 0027 `soft_delete`, 0028 `attendee_recommendations`, 0031 `daily_worklogs` — all present, idx strictly increasing, `when` strictly increasing. (Renumbered by `5423315` from an earlier 0025/0027 collision to 0027/0028.) |
| `schema.ts` keeps both sides' columns | Grepped `deletedAt`/`deletedBy` and `displayName` | `deletedAt`/`deletedBy` present on `meetings`, `tasks`, `sprints`, `meeting_note_segments`, `meeting_screenshots` (5/5); `meetingSpeakers.displayName` present |
| New reads of soft tables converted to live* | Grepped `text-replace-actions.ts`, `checkin-actions.ts`, `assistant-actions.ts` | All three use `liveMeetings`/`liveNoteSegments`/`liveSprints`, with meeting-child-table reads (`meetingAiNotes`, `meetingTaskSuggestions`, `meetingFollowups`, `meetingSpeakers`) inner-joined to `liveMeetings` as required |
| Print page doesn't bypass live* | Read `src/app/print/meetings/[id]/page.tsx` | Goes through `getMeetingById`/`getMeetingNoteTimeline` (already live*-backed), no raw reads of its own |
| Activity search doesn't need live* | Read `src/features/activity/search.ts` and `filters.ts` | Pure in-memory fuzzy matching over already-fetched rows; the SQL layer (`filters.ts`) only touches `activityLog`, which is not one of the five soft-deleted tables — correctly out of scope |

## Per-file table (key files from the original merge, `5baa0ef`)

| File | Ours (feat/soft-deletes) | Theirs (main) | Resolution |
|---|---|---|---|
| `src/db/live.ts`, `src/db/live.test.ts` | New file: `SOFT_TABLES`, `liveMeetings`/`liveTasks`/`liveSprints`/`liveNoteSegments`/`liveScreenshots` subqueries, 7-check static scan | Did not exist | Taken as ours, unmodified — theirs had no competing change |
| `src/db/schema.ts` | Added `deletedAt`/`deletedBy` + partial indexes on 5 tables | Added `meeting_speakers.display_name` and other main-side columns | Both sides' columns kept |
| `drizzle/meta/_journal.json`, `drizzle/*.sql` | idx 27 `soft_delete` | idx 25 `meeting_suggestion_app`, idx 26 `meeting_speaker_display_name` | All three kept; later renumbered (25/26 unchanged, ours renumbered 27→27, attendee-recommender work added as 28) by `5423315` to clear a second collision introduced by yet another parallel branch |
| `src/features/meetings/ai-actions.ts` (`getMeetingNoteTimeline`) | `.from(liveMeetings)` / `.from(liveNoteSegments)` reads | Serial reads batched into `Promise.all` | Theirs' batching structure kept, ours' live* targets applied on top — confirmed present in final code |
| `src/features/meetings/legacy-notes.ts` | New file: raw, deliberate `meetingNoteSegments` read (`haveNoteSegmentsEverExisted`) | Did not exist | Kept raw as ours; both call sites in `ai-actions.ts` preserved |
| `src/features/meetings/queries.ts` (`getMeetingById`) | `.from(liveMeetings)` | New function body added after branch point, using raw `meetings` | Initially landed still reading raw `meetings` in the new code (compile-safe but wrong); fixed in `cffb050` to `liveMeetings` |
| `src/features/sprints/queries.ts` (`getSprintTaskCounts`) | `.from(liveTasks)` | New function using raw `tasks` | Same class of bug as above; fixed in `cffb050` to `liveTasks` |
| `src/features/sprints/actions.ts` | `backlogTasks` soft-delete guard | `liveSprints` reads, other main-side logic | Initially landed byte-identical to ours (theirs' half silently dropped, still compiled); redone as a real three-way merge in `6bcbbbc` — theirs' `liveSprints` reads kept, `backlogTasks` naming kept (matches ours' own test/dialog code) |
| `src/features/sprints/task-actions.ts` | Follow-up task sync, real-task-title activity label | `liveTasks`/`liveSprints` reads, `revalidateAdmin` | Same "landed wholesale" bug; redone in `6bcbbbc` — both sides' logic combined |
| `src/app/(app)/page.tsx` | Touched incidentally (soft-delete plumbing), contributed nothing dashboard-specific | Suspense-zone dashboard redesign | Landed as ours wholesale (main's dashboard silently dropped, `dashboard-zones.tsx` orphaned); restored to main's version in `6bcbbbc` |
| `e2e/smoke.spec.ts` | Old board assertions | New board region landmarks / reorder handle | Landed as ours wholesale; restored to main's assertions in `6bcbbbc` |
| `src/app/(app)/people/history/page.tsx` | n/a (unrelated to soft-deletes) | `asOfAt` prop threading | A genuine main-side regression introduced during the merge (`asOf.at` referenced instead of the `asOfAt` prop) — not a soft-delete issue at all, just a merge slip; fixed in `cffb050` |
| `src/features/meetings/text-replace-actions.ts`, `src/features/sprints/checkin-actions.ts`, `src/features/meetings/assistant-actions.ts` | Did not exist | New files, reading meetings/sprints tables raw | Converted to `liveMeetings`/`liveSprints`/`liveNoteSegments`, with meeting-child tables inner-joined to `liveMeetings` |
| `src/lib/changelog.data.json` | n/a | n/a | Generated file — not hand-merged, regenerates on next `prebuild` |

I did not personally re-derive every one of the ~30 originally-conflicting
files from `:1:`/`:2:`/`:3:` (there was no live conflict for me to resolve —
by the time I ran `git merge main`, the merge was already history). Instead
I verified the *outcome* against every principle in the task brief, focusing
extra scrutiny on the two files classes the fix commits show were actually
mishandled the first time around (files landed wholesale from one side;
functions added post-branch-point that missed the live* swap).

## Gates

| Gate | Result |
|---|---|
| `npx vitest run src/db/live.test.ts` | **17 tests passed**, all 7 named checks green (SOFT_TABLES coverage, raw read, alias, meeting-child-table-without-join, `db.delete` confinement, schema-reflection coverage, legacy-notes probe still called) |
| `npx vitest run` (full suite) | **1814 tests passed, 110 files passed**, 0 failed |
| `npx tsc --noEmit` | **0 errors** |
| `npm run lint` | **3 errors, 18 warnings** — all pre-existing on `main` (this merge introduced zero diff of my own; fast-forward = identical tree before and after my `git merge main`). Errors are unrelated `react-hooks/set-state-in-effect` findings in `meeting-form.tsx` and `meeting-panels.tsx`, none touching soft-delete code. Gate is "add no new problems" — I added none. |

## Commit

No new commit was created or needed: the merge completed as a fast-forward
(`feat/soft-deletes` now points at the same commit as `main`,
`70da3e19e7326abde4250364ab483ef7aa5849e0`), and the working tree was clean
both before and after. `git status` confirms `nothing to commit, working
tree clean` and `HEAD` is on `feat/soft-deletes`.

## Things I was unsure about / flagging for visibility

- This fast-forward outcome means the ~30-conflict resolution work the task
  anticipated was done by someone else, before I started, apparently in
  parallel with this task being dispatched. I did not do the line-by-line
  `:1:`/`:2:`/`:3:` resolution myself — I audited the result. I'm confident
  in the audit (every principle in the brief checks out against the current
  tree, all four gates are green), but flagging this since "the merge was
  already done by someone else" is a different outcome than "I resolved 30
  conflicts," and you should know which one actually happened.
- `_journal.json` idx values have small pre-existing gaps (11, 29, 30 never
  existed in either the ledger or `drizzle/*.sql`). This predates both sides
  of this merge (already present in the pre-merge history) and is unrelated
  to soft-deletes; I did not touch it and it isn't a resolution artifact.
- I have not looked at commits after `359538f` (attendee-recommender merge)
  in detail — `main` kept moving (daily work-log feature, etc.) after the
  soft-deletes merge was fixed up, and none of that is in scope for this
  task, but it's all included in the fast-forward since it's downstream of
  the fixed merge.
