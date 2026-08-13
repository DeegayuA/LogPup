# Daily Work-Done Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every engineer records, once a day, what they did and how much of what they planned they actually got through — with the note drafted by AI from their own activity so writing it costs seconds, not minutes.

**Architecture:** A new `daily_worklogs` table keyed `(user_id, day)`, deliberately separate from `sprint_checkins` (which answers "how far through this sprint am I", one row per sprint, overwritten). The percentage is self-scored — "of what I planned today" — so it works on meeting days, review days and support days, and for people not on a sprint at all. The note is pre-drafted server-side by Gemini from the person's own `activity_log` rows for that day, then edited; dictation is available via the existing `DictateButton`.

**Tech Stack:** Next.js 16 App Router (server components + server actions), Drizzle/Neon Postgres, Zod validation, Gemini via `src/features/gemini/client.ts` (BYOK per user), Vitest.

## Global Constraints

- **Migration number is 0031** — 0028 is taken by attendee-recommender, 0029/0030 by integration/2026-08-11. Journal `idx` 31, `when` strictly greater than 1786559502693.
- Migration SQL must be **replay-safe**: `IF NOT EXISTS` on every statement, `--> statement-breakpoint` between statements, and that marker must **never** appear inside a comment (the splitter is a plain string split).
- Mirror the migration exactly in `src/db/schema.ts`, indexes included.
- **`daily_worklogs` is NOT soft-deletable and has no delete path.** It must not be added to `SOFT_TABLES` in `src/db/live.ts`. Correcting a day means editing that day's row.
- All day boundaries are **Asia/Colombo**, via `toIsoDateInTimeZone(date, LK_TIMEZONE)` from `src/lib/lk-holidays.ts`. Never `new Date().toISOString().slice(0,10)`.
- `percent` is an **integer 0–100**, validated at the action boundary (mirrors `sprint_checkins.percent`).
- Bilingual: the note is free text and may be Sinhala, English or both. Never force-translate. Render with `bilingualText` from `src/features/meetings/components/meeting-chips.tsx`.
- Verify with `npx tsc --noEmit` and `npm test` before each commit.

---

### Task 1: Schema and migration

**Files:**
- Create: `drizzle/0031_daily_worklogs.sql`
- Modify: `drizzle/meta/_journal.json` (append entry)
- Modify: `src/db/schema.ts` (append `dailyWorklogs` near `sprintCheckins`)

**Interfaces:**
- Produces: `dailyWorklogs` table export used by every later task.

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE IF NOT EXISTS "daily_worklogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"percent" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "daily_worklogs" ADD CONSTRAINT "daily_worklogs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_worklogs_user_day_idx" ON "daily_worklogs" ("user_id","day");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_worklogs_day_idx" ON "daily_worklogs" ("day");
```

The `ADD CONSTRAINT` is wrapped in a `DO $$` block because Postgres has no `ADD CONSTRAINT IF NOT EXISTS`; without it a re-run dies on `duplicate_object` and takes the whole migration with it.

- [ ] **Step 2: Append the journal entry**

In `drizzle/meta/_journal.json`, append to `entries`:

```json
{ "idx": 31, "version": "7", "when": 1786600000000, "tag": "0031_daily_worklogs", "breakpoints": true }
```

- [ ] **Step 3: Mirror in schema.ts**

```ts
// One row per person per DAY — what they did and how much of what they set
// out to do they got through. Deliberately NOT sprintCheckins: that table
// holds one overwritten row per person per SPRINT answering "how far
// through this sprint am I", so it carries no day-by-day history and is
// unreachable for anyone not on a sprint.
//
// Not soft-deletable and there is no delete action: a day is corrected by
// editing it, so this table stays out of SOFT_TABLES in src/db/live.ts.
export const dailyWorklogs = pgTable('daily_worklogs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // A calendar day in Asia/Colombo, not an instant — see resolveWorkDay.
  day: date('day').notNull(),
  // 0..100, validated at the action boundary. "Of what I planned today",
  // self-scored: it has to mean something on a day of meetings and review.
  percent: integer('percent').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  // THE invariant: one answer per person per day. Also the upsert's
  // ON CONFLICT target and the access path for the personal history read.
  uniqueIndex('daily_worklogs_user_day_idx').on(t.userId, t.day),
  // The team view reads a date range across all people.
  index('daily_worklogs_day_idx').on(t.day),
])
```

Ensure `date` and `index` are in the `drizzle-orm/pg-core` import list at the top of `schema.ts`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Apply and verify against the real schema**

Run: `npm run db:migrate`, then verify — do NOT trust the runner's exit code, it has exited reporting success while applying nothing:

```bash
psql "$DATABASE_URL" -c "\d daily_worklogs"
```
Expected: table exists with the unique index on (user_id, day).

- [ ] **Step 6: Commit**

```bash
git add drizzle/0031_daily_worklogs.sql drizzle/meta/_journal.json src/db/schema.ts
git commit -m "feat: daily worklog table"
```

---

### Task 2: Pure day/percent logic

**Files:**
- Create: `src/features/worklog/worklog-day.ts`
- Test: `src/features/worklog/worklog-day.test.ts`

**Interfaces:**
- Produces: `resolveWorkDay(now: Date): string` (ISO `yyyy-mm-dd` in Asia/Colombo), `summarizeWorklogs(rows: { percent: number }[]): { logged: number; averagePercent: number | null }`, `PERCENT_MIN`, `PERCENT_MAX`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { resolveWorkDay, summarizeWorklogs } from './worklog-day'

describe('resolveWorkDay', () => {
  it('uses the Colombo calendar day, not UTC', () => {
    // 2026-08-13T19:30:00Z is 2026-08-14 01:00 in Asia/Colombo (+05:30).
    expect(resolveWorkDay(new Date('2026-08-13T19:30:00Z'))).toBe('2026-08-14')
  })

  it('keeps a mid-morning Colombo time on the same day', () => {
    expect(resolveWorkDay(new Date('2026-08-13T04:30:00Z'))).toBe('2026-08-13')
  })
})

describe('summarizeWorklogs', () => {
  it('averages only the days that were logged', () => {
    const out = summarizeWorklogs([{ percent: 80 }, { percent: 60 }])
    expect(out.logged).toBe(2)
    expect(out.averagePercent).toBe(70)
  })

  it('reports no average when nothing is logged', () => {
    expect(summarizeWorklogs([]).averagePercent).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/worklog/worklog-day.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'

export const PERCENT_MIN = 0
export const PERCENT_MAX = 100

/**
 * The calendar day a moment belongs to for this team — Asia/Colombo, not the
 * server's zone and not UTC. Someone logging at 01:00 Colombo is logging the
 * day that just started, and a UTC-derived day would file it under yesterday
 * for half the working week.
 */
export function resolveWorkDay(now: Date): string {
  return toIsoDateInTimeZone(now, LK_TIMEZONE)
}

export function summarizeWorklogs(
  rows: { percent: number }[],
): { logged: number; averagePercent: number | null } {
  if (rows.length === 0) return { logged: 0, averagePercent: null }
  const total = rows.reduce((sum, row) => sum + row.percent, 0)
  return { logged: rows.length, averagePercent: Math.round(total / rows.length) }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/worklog/worklog-day.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/worklog/worklog-day.ts src/features/worklog/worklog-day.test.ts
git commit -m "feat: worklog day resolution and summary math"
```

---

### Task 3: Write and read actions

**Files:**
- Create: `src/features/worklog/actions.ts`
- Create: `src/features/worklog/queries.ts`

**Interfaces:**
- Consumes: `dailyWorklogs` (Task 1), `resolveWorkDay`, `PERCENT_MIN`, `PERCENT_MAX` (Task 2).
- Produces: `upsertDailyWorklog(day: string, percent: number, note: string | null): Promise<ActionResult<{ day: string }>>`; `getMyWorklogs(userId: string, days: number): Promise<WorklogRow[]>`; `getTeamWorklogs(fromIso: string, toIso: string): Promise<TeamWorklogRow[]>`, where `WorklogRow = { day: string; percent: number; note: string | null; updatedAt: Date }` and `TeamWorklogRow = WorklogRow & { userId: string; userName: string; avatarUrl: string | null }`.

- [ ] **Step 1: Write the action**

```ts
'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { dailyWorklogs } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { PERCENT_MAX, PERCENT_MIN, resolveWorkDay } from './worklog-day'

const worklogInput = z.object({
  // Accepted from the client so someone can fill in yesterday, but never
  // trusted as a free-form string.
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'That is not a day'),
  percent: z
    .number()
    .int()
    .min(PERCENT_MIN, 'Percent must be 0–100')
    .max(PERCENT_MAX, 'Percent must be 0–100'),
  note: z.string().trim().max(4000, 'That note is too long').nullable(),
})

/**
 * Records (or corrects) one person's own day. Self only — there is
 * deliberately no `targetUserId` here, unlike upsertSprintCheckin: a work log
 * is a first-person statement about your own day, and an admin writing one
 * "on behalf of" somebody would put words in their mouth in a record their
 * manager then reads back.
 */
export async function upsertDailyWorklog(
  day: string,
  percent: number,
  note: string | null,
): Promise<ActionResult<{ day: string }>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const parsed = worklogInput.safeParse({ day, percent, note })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  // Not the future: a log is a record of what happened, and today's own
  // entry stays editable all day anyway.
  if (parsed.data.day > resolveWorkDay(new Date())) return err('That day has not happened yet')

  const noteValue = parsed.data.note?.trim() ? parsed.data.note.trim() : null

  await db
    .insert(dailyWorklogs)
    .values({
      userId: session.user.id,
      day: parsed.data.day,
      percent: parsed.data.percent,
      note: noteValue,
    })
    .onConflictDoUpdate({
      target: [dailyWorklogs.userId, dailyWorklogs.day],
      set: { percent: parsed.data.percent, note: noteValue, updatedAt: new Date() },
    })

  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'worklog',
    entityId: session.user.id,
    entityLabel: `Work log for ${parsed.data.day}`,
    pagePath: '/worklog',
    metadata: { day: parsed.data.day, percent: parsed.data.percent },
  })

  return ok({ day: parsed.data.day })
}
```

- [ ] **Step 2: Write the queries**

```ts
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db'
import { dailyWorklogs, users } from '@/db/schema'

export type WorklogRow = { day: string; percent: number; note: string | null; updatedAt: Date }
export type TeamWorklogRow = WorklogRow & {
  userId: string
  userName: string
  avatarUrl: string | null
}

export async function getMyWorklogs(userId: string, days: number): Promise<WorklogRow[]> {
  return db
    .select({
      day: dailyWorklogs.day,
      percent: dailyWorklogs.percent,
      note: dailyWorklogs.note,
      updatedAt: dailyWorklogs.updatedAt,
    })
    .from(dailyWorklogs)
    .where(eq(dailyWorklogs.userId, userId))
    .orderBy(desc(dailyWorklogs.day))
    .limit(days)
}

/** Every person's logs across a day range — the team view's single read. */
export async function getTeamWorklogs(fromIso: string, toIso: string): Promise<TeamWorklogRow[]> {
  return db
    .select({
      userId: dailyWorklogs.userId,
      userName: users.name,
      avatarUrl: users.avatarUrl,
      day: dailyWorklogs.day,
      percent: dailyWorklogs.percent,
      note: dailyWorklogs.note,
      updatedAt: dailyWorklogs.updatedAt,
    })
    .from(dailyWorklogs)
    .innerJoin(users, eq(dailyWorklogs.userId, users.id))
    .where(and(gte(dailyWorklogs.day, fromIso), lte(dailyWorklogs.day, toIso)))
    .orderBy(desc(dailyWorklogs.day))
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If `entityType: 'worklog'` is rejected by the activity log's union, widen it in `src/features/activity/log.ts` and extend that field's comment to list it.

- [ ] **Step 4: Commit**

```bash
git add src/features/worklog/actions.ts src/features/worklog/queries.ts
git commit -m "feat: daily worklog read and write"
```

---

### Task 4: AI draft from the person's own activity

**Files:**
- Create: `src/features/worklog/draft-prompt.ts`
- Test: `src/features/worklog/draft-prompt.test.ts`
- Create: `src/features/worklog/draft-actions.ts`

**Interfaces:**
- Consumes: `activityLog` table, `callGemini` from `src/features/gemini/client.ts`.
- Produces: `buildWorklogDraftPrompt(input: { name: string; day: string; activity: DraftActivity[] }): string`; `draftWorklogNote(day: string): Promise<ActionResult<{ note: string; activityCount: number }>>`, where `DraftActivity = { verb: string; entityType: string; entityLabel: string; appName: string | null }`.

- [ ] **Step 1: Write the failing prompt test**

```ts
import { describe, expect, it } from 'vitest'
import { buildWorklogDraftPrompt } from './draft-prompt'

describe('buildWorklogDraftPrompt', () => {
  const activity = [
    { verb: 'completed', entityType: 'task', entityLabel: 'Fix login redirect', appName: 'SCADA' },
    { verb: 'commented', entityType: 'meeting', entityLabel: 'Sprint planning', appName: null },
  ]

  it('lists every activity row it was given', () => {
    const prompt = buildWorklogDraftPrompt({ name: 'Nadeesha', day: '2026-08-13', activity })
    expect(prompt).toContain('Fix login redirect')
    expect(prompt).toContain('Sprint planning')
  })

  it('asks for first person and forbids inventing work', () => {
    const prompt = buildWorklogDraftPrompt({ name: 'Nadeesha', day: '2026-08-13', activity })
    expect(prompt.toLowerCase()).toContain('first person')
    expect(prompt.toLowerCase()).toContain('never invent')
  })

  it('says so plainly when there is no recorded activity', () => {
    const prompt = buildWorklogDraftPrompt({ name: 'Nadeesha', day: '2026-08-13', activity: [] })
    expect(prompt).toContain('no recorded activity')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/worklog/draft-prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the prompt builder**

```ts
export type DraftActivity = {
  verb: string
  entityType: string
  entityLabel: string
  appName: string | null
}

/**
 * Pure so the wording is pinned by a test rather than drifting inside a
 * server action nobody can run offline.
 */
export function buildWorklogDraftPrompt(input: {
  name: string
  day: string
  activity: DraftActivity[]
}): string {
  const lines = input.activity
    .map(
      (row) =>
        `- ${row.verb} ${row.entityType}: ${row.entityLabel}${row.appName ? ` (${row.appName})` : ''}`,
    )
    .join('\n')

  return `You are drafting ${input.name}'s own work log entry for ${input.day}, which they will edit before saving.

${input.activity.length > 0 ? `What LogPup recorded them doing that day:\n${lines}` : 'LogPup has no recorded activity for them that day.'}

Rules:
- Write in the FIRST PERSON, as ${input.name} ("Finished the login redirect fix…"). This is their entry, not a report about them.
- 2-4 short sentences. No bullet characters, no markdown, no headings.
- Use ONLY the activity above. NEVER invent work, hours, blockers or outcomes that are not listed.
- If there is no recorded activity, write one short line saying the day is not reflected in LogPup and they should describe it themselves — do not guess.
- This is a Sri Lankan team that code-switches between Sinhala and English. Write in English, but keep product, app and technical names exactly as they appear above.`
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/worklog/draft-prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the draft action**

```ts
'use server'

import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { activityLog } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { GeminiError, callGemini } from '@/features/gemini/client'
import { buildWorklogDraftPrompt, type DraftActivity } from './draft-prompt'

/** Enough to characterise a day; more just costs tokens. */
const MAX_ACTIVITY_ROWS = 60

/**
 * Drafts the note from what LogPup already saw this person do, so filling in
 * a work log is editing a paragraph rather than writing one. Reads ONLY the
 * caller's own activity — never anyone else's.
 */
export async function draftWorklogNote(
  day: string,
): Promise<ActionResult<{ note: string; activityCount: number }>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return err('That is not a day')

  // The activity table stores instants; the day is Asia/Colombo (+05:30), so
  // the window runs from 00:00 to 23:59:59.999 at that offset.
  const start = new Date(`${day}T00:00:00+05:30`)
  const end = new Date(`${day}T23:59:59.999+05:30`)

  const activity: DraftActivity[] = await db
    .select({
      verb: activityLog.verb,
      entityType: activityLog.entityType,
      entityLabel: activityLog.entityLabel,
      appName: activityLog.appName,
    })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.actorId, session.user.id),
        gte(activityLog.createdAt, start),
        lte(activityLog.createdAt, end),
      ),
    )
    .orderBy(asc(activityLog.createdAt))
    .limit(MAX_ACTIVITY_ROWS)

  const prompt = buildWorklogDraftPrompt({
    name: session.user.name ?? 'this engineer',
    day,
    activity,
  })

  try {
    const { text } = await callGemini(session.user.id, [{ text: prompt }])
    const note = text.trim()
    if (!note) return err('No draft came back — try again')
    return ok({ note, activityCount: activity.length })
  } catch (error) {
    if (error instanceof GeminiError) return err(error.message)
    return err('Could not draft that right now — write it yourself or try again')
  }
}
```

- [ ] **Step 6: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: clean, all pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/worklog/draft-prompt.ts src/features/worklog/draft-prompt.test.ts src/features/worklog/draft-actions.ts
git commit -m "feat: draft a work log note from the day's own activity"
```

---

### Task 5: Personal entry form

**Files:**
- Create: `src/features/worklog/components/worklog-form.tsx`

**Interfaces:**
- Consumes: `upsertDailyWorklog` (Task 3), `draftWorklogNote` (Task 4), `DictateButton` from `@/features/speech/components/dictate-button`.
- Produces: `<WorklogForm day={string} initial={{ percent: number; note: string | null } | null} />`.

- [ ] **Step 1: Implement**

Requirements this component must meet. Each has precedent in the codebase — follow those files rather than inventing:

- `'use client'`, with `useTransition` for the save and a second one for the draft, mirroring the `suggesting`/`isPending` pair in `src/features/sprints/components/sprint-form-dialog.tsx`.
- Percent: a native `<input type="range" min={0} max={100} step={5}>` plus a live `tabular-nums` readout. A range, not a number box — the whole point is that it costs one gesture.
- **Draft with AI** button: calls `draftWorklogNote(day)`, then **overwrites** the note. Same reasoning as `handleSuggest` in `sprint-form-dialog.tsx` — the button is the statement "draft this for me", and a merge that kept half-typed text produces a sentence that is neither the person's nor the model's. Show `Loader2` + "Drafting…" while pending.
- When `activityCount === 0`, `toast.info` that LogPup recorded no activity for that day, so the draft is a prompt to write rather than a summary.
- `<DictateButton onText={...} />` appending to the note exactly as `note-timeline.tsx` does: `current.trim() ? \`${current.trim()} ${text}\` : text`.
- **Optimistic save**: reflect the saved state immediately and roll back with `toast.error` on failure — the project's standing frontend rule (see the `frontend-api-skills-rule` memory).
- Save disabled while both percent and note are unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/worklog/components/worklog-form.tsx
git commit -m "feat: daily worklog entry form with AI draft and dictation"
```

---

### Task 6: The page — my day, my history, and the team view

**Files:**
- Create: `src/app/(app)/worklog/page.tsx`
- Create: `src/features/worklog/components/team-worklog-table.tsx`
- Modify: `src/components/shell/sidebar.tsx` — add a "Work log" entry

**Interfaces:**
- Consumes: `getMyWorklogs`, `getTeamWorklogs` (Task 3), `WorklogForm` (Task 5), `resolveWorkDay` (Task 2).

- [ ] **Step 1: Build the page**

- Server component. `const today = resolveWorkDay(new Date())`.
- Top: today's `WorklogForm`, seeded with today's row when one exists.
- Below: the caller's last 14 days as a row-per-day list — day, percent, note — with unlogged days rendered as a muted "not logged" row, because the gaps are the point.
- **Team view, admins only** (`session.user.role === 'admin'`): one row per person per day for the last 7 days via `getTeamWorklogs`, newest first, grouped by day. Non-admins never see it, and the query must not run for them.
- Follow the `people/history` page's split: render header and controls synchronously, put the data behind `<Suspense>` with a skeleton, so the page is interactive before the queries land.

- [ ] **Step 2: Typecheck, test, lint**

Run: `npx tsc --noEmit && npm test && npx eslint src/features/worklog "src/app/(app)/worklog"`
Expected: all clean.

- [ ] **Step 3: Verify in the running app**

Log a day and confirm it appears; reload and confirm it persists; press **Draft with AI** on a day with real activity and confirm the note is first-person and mentions only work that actually happened; sign in as a non-admin and confirm the team view is absent.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/worklog" src/features/worklog/components/team-worklog-table.tsx src/components/shell/sidebar.tsx
git commit -m "feat: daily work log page with team view"
```

---

## Self-review

**Spec coverage.** "See each user's daily work done" → Tasks 1, 3, 6 (team view). "They put what they did" → the note, Tasks 3 and 5. "Work done percentage" → `percent`, Tasks 1–3 and 5. "Type with AI help because engineers' time is valuable" → Task 4 (draft from their own activity) plus dictation in Task 5.

**Placeholders.** None. Every code step carries real code; Task 5 lists concrete requirements against named precedent files rather than "add appropriate handling".

**Type consistency.** `upsertDailyWorklog`, `draftWorklogNote`, `WorklogRow`, `TeamWorklogRow`, `DraftActivity`, `resolveWorkDay`, `summarizeWorklogs` and `buildWorklogDraftPrompt` appear with identical names and signatures in every task that references them.

**Known gap, deliberate.** `summarizeWorklogs` is built and tested in Task 2 but only consumed if the team view surfaces a per-person average. Keep it for that, or drop it from Task 2 if the final view does not show one.
