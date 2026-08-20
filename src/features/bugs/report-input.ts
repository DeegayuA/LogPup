import { z } from 'zod'
import {
  BUG_SEVERITIES,
  BUG_STATUSES,
  type BugSeverity,
  type BugStatus,
} from '@/features/bugs/bug-display'

/**
 * The payloads actions.ts accepts. Split out of that file — a `'use server'`
 * module, where every export must be an async function — so the rules
 * themselves can be unit tested without a database, the same split
 * apps/create-input.ts makes.
 */

/**
 * Where the reporter was standing.
 *
 * An IN-APP PATH ONLY, and that is a validation rule rather than a formality:
 * this string is written by the browser, stored, and later rendered as a link
 * in the triage queue. `//evil.example` is a protocol-relative URL that every
 * browser treats as another origin, so an unchecked value turns a bug report
 * into an off-site link somebody else clicks. Rejecting anything that is not
 * a single leading slash keeps it what it claims to be: a route in this app.
 */
export const bugPagePath = z
  .string()
  .trim()
  .max(512)
  .refine((value) => value.startsWith('/') && !value.startsWith('//'), {
    message: 'Page must be a path inside LogPup',
  })

/**
 * Filing a bug.
 *
 * NO SEVERITY FIELD, deliberately. `bug_severity` in schema.ts says severity
 * is judged by whoever triages, not by the reporter — a field asking a person
 * in the middle of being blocked to rate their own blockage produces either
 * "critical" every time or a number nobody acts on. The reporter describes
 * what happened; triageBug decides how bad it is, and the column default
 * ('medium') covers the gap in between.
 *
 * `pagePath` is optional at the schema level because the ONE caller that can
 * legitimately omit it is a client that failed to read its own route — losing
 * the whole report over a missing breadcrumb would be the wrong trade. The
 * dialog always sends it.
 */
export const bugReportInput = z.object({
  appId: z.uuid(),
  // A title short enough to scan in a queue; a description long enough to be
  // worth reading. The minimums exist so "it's broken" cannot be the entire
  // report — the one thing triage cannot recover from later.
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(10).max(4000),
  pagePath: bugPagePath.optional(),
})

export type BugReportInput = z.infer<typeof bugReportInput>

/**
 * Correcting what a report SAYS, after it was filed.
 *
 * The bounds are lifted from `bugReportInput.shape` rather than restated,
 * because two copies of "a title is 4 to 140 characters" is how an edit form
 * starts accepting a title the original form would have refused.
 *
 * Both fields optional, neither defaulted — the same rule as bugTriageInput:
 * fixing a title must not blank a description that was not sent.
 *
 * Deliberately NOT here: status, severity and assignee (bugTriageInput owns
 * those), and `pagePath`, which is a fact about where the bug was hit rather
 * than a sentence somebody wrote — editing it would rewrite evidence.
 */
export const bugContentInput = z
  .object({
    bugId: z.uuid(),
    title: bugReportInput.shape.title.optional(),
    description: bugReportInput.shape.description.optional(),
  })
  .refine((value) => value.title !== undefined || value.description !== undefined, {
    message: 'Nothing to change',
  })

export type BugContentInput = z.infer<typeof bugContentInput>

/**
 * Triaging one.
 *
 * Every field optional and NONE defaulted, mirroring apps/update-input.ts: a
 * missing key must stay missing after parsing so a status change does not
 * quietly reset the severity somebody set five minutes ago. `assignedTo`
 * distinguishes absent (leave it alone) from null (unassign), which is why it
 * is `.nullable().optional()` rather than either one.
 */
export const bugTriageInput = z
  .object({
    bugId: z.uuid(),
    status: z.enum(BUG_STATUSES).optional(),
    severity: z.enum(BUG_SEVERITIES).optional(),
    assignedTo: z.uuid().nullable().optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined || value.severity !== undefined || value.assignedTo !== undefined,
    { message: 'Nothing to change' },
  )

export type BugTriageInput = z.infer<typeof bugTriageInput>

/**
 * What the Bugs tab is narrowed to. Parsed from the URL, which is why every
 * field tolerates absence and nothing throws: a stale or hand-edited
 * `?bugStatus=wontfix` should show the unfiltered list, not an error page.
 */
export const bugFilterInput = z.object({
  status: z.enum(BUG_STATUSES).optional(),
  severity: z.enum(BUG_SEVERITIES).optional(),
})

export type BugFilters = z.infer<typeof bugFilterInput>

/**
 * One "load more" request from the triage queue.
 *
 * The cursor is a bare string here and decoded downstream — validating its
 * SHAPE is keyset-cursor.ts's job, and repeating the format in a regex would
 * be a second definition of the cursor, free to drift from the one that
 * parses it. What this schema is for is the FILTERS: they must travel with the
 * cursor, and arrive as the same closed enums the URL parser produces, so a
 * hand-made request cannot ask page two for a status the queue does not serve.
 */
export const bugQueuePageInput = z.object({
  before: z.string().min(1).max(200),
  filters: bugFilterInput.optional(),
})

/**
 * Reads the two filter values out of a Next `searchParams` bag.
 *
 * Repeated params arrive as an array; an unknown value is dropped rather than
 * rejected, per the note above. Each field is parsed SEPARATELY so a junk
 * `?bugSeverity=urgent` costs you the severity filter and not the perfectly
 * good status filter beside it. Pure, so the URL contract is testable without
 * rendering the page.
 */
export function parseBugFilters(search: {
  bugStatus?: string | string[]
  bugSeverity?: string | string[]
}): BugFilters {
  const first = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw)
  const status = z.enum(BUG_STATUSES).safeParse(first(search.bugStatus))
  const severity = z.enum(BUG_SEVERITIES).safeParse(first(search.bugSeverity))
  return {
    ...(status.success ? { status: status.data } : {}),
    ...(severity.success ? { severity: severity.data } : {}),
  }
}

/**
 * The Bugs tab's URL, with one filter changed.
 *
 * A link, not a client-side filter, for the reason tabs.ts gives about the
 * sections themselves: the server then renders exactly one narrowed list,
 * the state is shareable and back-button-able, and there is no second copy of
 * "which filter is on" to get out of sync. `undefined` in `patch` removes a
 * filter, which is how "All" keeps the canonical URL clean.
 */
export function bugFilterHref(
  slug: string,
  current: BugFilters,
  patch: { status?: BugStatus | undefined; severity?: BugSeverity | undefined },
): string {
  const params = new URLSearchParams({ tab: 'bugs' })
  const next = { ...current, ...patch }
  if (next.status) params.set('bugStatus', next.status)
  if (next.severity) params.set('bugSeverity', next.severity)
  return `/apps/${slug}?${params.toString()}`
}
