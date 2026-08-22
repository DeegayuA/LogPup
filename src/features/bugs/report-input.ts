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
 * The floor a description has to clear, named once because
 * `stripIssueTemplate` below has to know it: a cleaner that strips a report
 * down past the length the schema will accept must hand back the original
 * rather than produce something the very next line rejects.
 */
export const MIN_DESCRIPTION = 10

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g
/** ATX headings only — up to three leading spaces, then `#`…`######`, then space. */
const HEADING_RE = /^ {0,3}#{1,6}\s/
const FENCE_RE = /^ {0,3}(?:```|~~~)/

/**
 * Take the scaffolding out of a description pasted from an issue template.
 *
 * People arrive with a GitHub-style template in the clipboard and paste the
 * whole thing: instruction comments they were meant to replace, and section
 * headings they never filled in. Stored verbatim, a triage queue fills up
 * with reports whose visible content is `<!-- describe the steps -->`.
 *
 * TWO RULES, both conservative:
 *
 *   1. `<!-- … -->` comes out, including across lines. It is addressed to the
 *      person filling the form in, never to the person reading the bug.
 *   2. A heading with NOTHING under it comes out. A heading with anything at
 *      all under it STAYS, along with its content — the structure is the
 *      reporter's and this is not a formatter.
 *
 * Fenced code blocks are found first, because `# make clean` inside a fence is
 * a shell comment and bug reports are full of pasted code. A heading inside a
 * fence is not a heading, and lines inside one always count as body.
 *
 * If what is left would not clear MIN_DESCRIPTION, the ORIGINAL comes back
 * untouched. A helpful cleaner that deletes somebody's whole bug report is
 * worse than no cleaner, and a report that really is nothing but scaffolding
 * should be answered by validation saying so — not by a silent rewrite.
 */
export function stripIssueTemplate(description: string): string {
  // The overwhelmingly common report is prose with neither marker in it.
  // Leaving that byte-identical is worth one scan.
  if (!description.includes('<!--') && !description.includes('#')) return description

  const lines = description.replace(HTML_COMMENT_RE, '').split('\n')

  const fenced: boolean[] = []
  let inFence = false
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      // The fence line belongs to the block at either end.
      fenced.push(true)
      inFence = !inFence
      continue
    }
    fenced.push(inFence)
  }

  const isHeading = (index: number) => !fenced[index] && HEADING_RE.test(lines[index] ?? '')

  const keep = lines.map(() => true)
  for (let i = 0; i < lines.length; i += 1) {
    if (!isHeading(i)) continue
    let hasBody = false
    // Everything up to the NEXT heading is this section's body. One non-blank
    // line anywhere in it is enough to keep the heading.
    for (let j = i + 1; j < lines.length && !isHeading(j); j += 1) {
      if ((lines[j] ?? '').trim() !== '') {
        hasBody = true
        break
      }
    }
    if (!hasBody) keep[i] = false
  }

  const stripped = lines
    .filter((_, index) => keep[index])
    .join('\n')
    // Dropping a heading leaves the blank lines that surrounded it.
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return stripped.length < MIN_DESCRIPTION ? description : stripped
}

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
  // Validated on what was typed, then cleaned — so a description that is
  // nothing but an unfilled template is judged on its real length rather than
  // on what survives stripping. See stripIssueTemplate.
  description: z.string().trim().min(MIN_DESCRIPTION).max(4000).transform(stripIssueTemplate),
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
