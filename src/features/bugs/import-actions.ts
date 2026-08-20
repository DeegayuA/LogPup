'use server'

import { z } from 'zod'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { bugReports, users } from '@/db/schema'
import { canHoldWork } from '@/features/people/removal-queries'
import { liveApps } from '@/db/live'
import { requireCapability } from '@/features/auth/actor'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { revalidateAdmin } from '@/lib/revalidate-admin'
import { logActivity } from '@/features/activity/log'
import {
  BUG_CSV_MAX_CHARS,
  describeBugImport,
  parseBugCsv,
  type InvalidBugCsvRow,
  type ValidBugCsvRow,
} from '@/features/bugs/bug-csv'

/**
 * Bulk bug import: look, then leap.
 *
 * TWO ACTIONS, NOT ONE. `previewBugCsvImport` writes nothing — it parses the
 * file, resolves the assignee emails against real people, and hands back
 * exactly what would happen. `importBugCsvRows` then does it. The user asked
 * for this shape directly ("preview first; import only the valid rows") and it
 * is the right one: a bulk write is the one kind of mistake a person cannot
 * undo row by row afterwards.
 *
 * BOTH RE-PARSE THE SAME TEXT. The confirm step does NOT accept a list of rows
 * the browser prepared, because a client that can post rows is a client that
 * can post rows the preview never showed — different titles, a different
 * assignee, a severity nobody saw. Sending the file twice costs a few hundred
 * kilobytes and buys the guarantee that what is inserted is what was
 * previewed, re-validated from scratch, by the server, against the same pure
 * module the preview used.
 *
 * WHAT THE FILE IS NOT ALLOWED TO SAY, enforced here rather than trusted:
 *
 *  - The PROJECT. `appId` is an argument, from the page the import was started
 *    on. A file that could name any project id would let one project's import
 *    write bugs into another, and the person uploading it would have no reason
 *    to look. bug-csv.ts keeps `app_id` out of the template for the same
 *    reason; this file would ignore it even if a column appeared.
 *  - The REPORTER. `reportedBy` is the uploading actor, always. A CSV that
 *    could attribute a report to somebody else is a way to put words in a
 *    colleague's mouth.
 *
 * The capability is `bug.triage`, scoped to the project — the same gate the
 * Bugs tab already uses to decide whether to render the triage controls at all
 * (see the `canTriageBugs` computation on the app page). It is the right one
 * rather than `bug.report`: an import sets severity, status and assignee,
 * which are triage decisions, and `bug.report` is granted from member up
 * precisely so that anyone who trips over a break can file ONE bug — not so
 * that anyone can write five hundred.
 */

const bugCsvImportInput = z.object({
  appId: z.uuid(),
  csv: z
    .string()
    .min(1, 'That file is empty')
    .max(BUG_CSV_MAX_CHARS, 'That file is too large to import in one go'),
})

/** A row that will be created, with the assignee resolved to a real person. */
export type BugImportPreviewRow = ValidBugCsvRow & {
  assigneeId: string | null
  /** For the preview table — the email resolves to a name the user recognises. */
  assigneeName: string | null
}

export type BugImportPreview = {
  valid: BugImportPreviewRow[]
  invalid: InvalidBugCsvRow[]
  /** Headers that were not recognised and were ignored. Never fatal. */
  ignoredColumns: string[]
}

export type BugImportResult = {
  created: number
  skipped: number
  /** One sentence naming both numbers, for the toast. */
  summary: string
}

/** Every route a new batch of bugs changes. Mirrors actions.ts's revalidateBug. */
function revalidateBugs(appSlug: string): void {
  revalidatePath(`/apps/${appSlug}`)
  revalidatePath('/admin/bugs')
  revalidateAdmin()
}

function unexpected(context: string, error: unknown): ActionResult<never> {
  // A server action never throws — it returns err(). A rejected promise is the
  // one outcome the dialog cannot render, and the person is told nothing.
  console.error(`[bugs] ${context}`, error)
  return err('Something went wrong — try again')
}

/**
 * Parse, then resolve the assignee emails — the half of validation that needs
 * a database, done once so preview and import cannot disagree about it.
 *
 * AN EMAIL THAT DOES NOT RESOLVE INVALIDATES ITS ROW. It is not quietly
 * dropped to unassigned: the whole point of flag-and-skip is that nothing
 * changes meaning behind the user's back, and a bug that was meant to land on
 * somebody's plate and silently landed on nobody's is exactly that failure —
 * the row imports, looks fine, and is never picked up.
 *
 * "Resolves" means the same set of people the assignee dropdown on this tab
 * offers: active and approved (see listActiveUsers in people/queries.ts). Any
 * other definition here would mean a name the PM can pick from the dropdown is
 * a name their CSV rejects, or the reverse.
 */
async function resolveImport(
  appId: string,
  csv: string,
): Promise<
  | { ok: false; error: string }
  | { ok: true; app: { id: string; name: string; slug: string }; preview: BugImportPreview }
> {
  // Through liveApps: importing into a trashed project would create rows
  // nothing can ever show, because every read joins the live project back.
  const [app] = await db
    .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug })
    .from(liveApps)
    .where(eq(liveApps.id, appId))
    .limit(1)
  if (!app) return { ok: false, error: 'App not found' }

  const parsed = parseBugCsv(csv)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  const emails = [
    ...new Set(
      parsed.valid
        .map((row) => row.assigneeEmail)
        .filter((email): email is string => email !== null),
    ),
  ]

  // One query for every assignee in the file, not one per row. `lower()` on
  // both sides because bug-csv.ts already lower-cases what it read and the
  // stored address may be capitalised however the person typed it at signup.
  const people =
    emails.length === 0
      ? []
      : await db
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(
            and(
              inArray(sql<string>`lower(${users.email})`, emails),
              // An assignee resolved out of a CSV is an assignment target, so
              // the same roster rule the pickers use applies here — including
              // removal, which no `active` check would catch.
              canHoldWork(),
            ),
          )

  const byEmail = new Map(people.map((person) => [person.email.toLowerCase(), person]))

  const valid: BugImportPreviewRow[] = []
  const invalid: InvalidBugCsvRow[] = [...parsed.invalid]

  for (const row of parsed.valid) {
    if (row.assigneeEmail === null) {
      valid.push({ ...row, assigneeId: null, assigneeName: null })
      continue
    }
    const person = byEmail.get(row.assigneeEmail)
    if (!person) {
      invalid.push({
        rowNumber: row.rowNumber,
        title: row.title,
        reasons: [`No active LogPup user has the email "${row.assigneeEmail}"`],
      })
      continue
    }
    valid.push({ ...row, assigneeId: person.id, assigneeName: person.name })
  }

  // Back into file order. The two lists were built by walking the file, but
  // the assignee failures above moved rows between them — and a preview table
  // whose row numbers jump around is a table nobody can check against their
  // spreadsheet.
  invalid.sort((a, b) => a.rowNumber - b.rowNumber)

  return {
    ok: true,
    app,
    preview: { valid, invalid, ignoredColumns: parsed.ignoredColumns },
  }
}

/**
 * What WOULD happen. Reads only — nothing is written by this call, which is
 * the contract the dialog's "Import N bugs" button depends on.
 */
export async function previewBugCsvImport(input: {
  appId: string
  csv: string
}): Promise<ActionResult<BugImportPreview>> {
  const parsed = bugCsvImportInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Could not read that file')

  const actor = await requireCapability('bug.triage', { appId: parsed.data.appId })
  if (!actor) return err('Admins only')

  try {
    const resolved = await resolveImport(parsed.data.appId, parsed.data.csv)
    if (!resolved.ok) return err(resolved.error)
    return ok(resolved.preview)
  } catch (error) {
    return unexpected('previewBugCsvImport failed:', error)
  }
}

/**
 * Do it — the valid rows only.
 *
 * ONE INSERT for the whole batch rather than the delegate-per-row shape
 * admin/bulk-actions.ts uses. That file's own comment explains why it accepts
 * N round trips: "admin batches of tens, not millions". This is a batch of up
 * to five hundred, and five hundred sequential round trips against a
 * serverless database is a request that times out halfway through, leaving a
 * partial import nobody asked for. The guards a per-row action would have
 * carried are all here instead: the capability is checked once for the one
 * project every row lands in, and every row was validated by the same pure
 * module a single-row report goes through.
 */
export async function importBugCsvRows(input: {
  appId: string
  csv: string
}): Promise<ActionResult<BugImportResult>> {
  const parsed = bugCsvImportInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Could not read that file')

  const actor = await requireCapability('bug.triage', { appId: parsed.data.appId })
  if (!actor) return err('Admins only')

  try {
    // Re-parsed and re-resolved from the file, deliberately — see the header.
    const resolved = await resolveImport(parsed.data.appId, parsed.data.csv)
    if (!resolved.ok) return err(resolved.error)
    const { app, preview } = resolved

    const skipped = preview.invalid.length
    if (preview.valid.length === 0) {
      return err(
        skipped === 1
          ? 'The only row in that file has a problem — nothing to import'
          : `Every row in that file has a problem — nothing to import`,
      )
    }

    const created = await db
      .insert(bugReports)
      .values(
        preview.valid.map((row) => ({
          // Both of these come from OUTSIDE the file, always. See the header.
          appId: app.id,
          reportedBy: actor.id,
          title: row.title,
          description: row.description,
          // Omitted when the cell was empty, so the column default stands and
          // an imported bug is indistinguishable from one filed through the
          // dialog — which also sends no severity (report-input.ts says why).
          ...(row.severity ? { severity: row.severity } : {}),
          ...(row.status ? { status: row.status } : {}),
          pagePath: row.pagePath,
          assignedTo: row.assigneeId,
        })),
      )
      .returning({ id: bugReports.id })

    const summary = describeBugImport(created.length, skipped)

    // ONE trail row for the import, not one per bug.
    //
    // entityType is 'app' and entityId the project, following the precedent
    // activity/types.ts sets for 'worklog': the entityId is what a reader of
    // the trail wants to click through to, and after a bulk import that is the
    // project's bug list, not an arbitrary one of the twelve rows. Five
    // hundred near-identical "created bug" entries would also bury every other
    // thing that happened today, which is the trail's actual job. Who filed
    // each bug and when is not lost — it is on the row itself, in
    // `reported_by` and `created_at`.
    await logActivity({
      actorId: actor.id,
      verb: 'created',
      entityType: 'app',
      entityId: app.id,
      entityLabel: app.name,
      appId: app.id,
      appName: app.name,
      pagePath: `/apps/${app.slug}?tab=bugs`,
      detail: `imported ${summary} from a CSV`,
      metadata: { imported: created.length, skipped },
    })

    revalidateBugs(app.slug)
    return ok({ created: created.length, skipped, summary })
  } catch (error) {
    return unexpected('importBugCsvRows failed:', error)
  }
}
