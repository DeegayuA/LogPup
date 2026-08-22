import type { CsvValue } from '@/features/admin/bulk-logic'

/**
 * A project's team, as a file somebody can open in Excel.
 *
 * PURE — no `db`, no React, no `new Date()`. The rows arrive already read and
 * already filtered by whoever is allowed to see them, which is the whole
 * security property this export leans on: `downloadCsv` builds a Blob from
 * rows that are ALREADY ON THE PAGE, so the file can never contain somebody
 * the reader was not shown. There is no endpoint here to ask for more.
 *
 * WHAT IS DELIBERATELY NOT A COLUMN
 *
 *  - `users.personal_email`. The schema is explicit that sign-in resolves
 *    `email` and only `email`, and that the personal address is contact-only —
 *    typically somebody's private gmail. A roster is exactly the kind of file
 *    that gets forwarded, and a private address must not ride along in one.
 *    The input type below has no field for it, so this is enforced by the
 *    compiler rather than by remembering.
 *  - `users.phone`. Same reasoning. The panel offers a call button to the
 *    person looking at it; that is not the same as handing the numbers out in
 *    bulk.
 *  - Anything derived. A roster answers "who is on this project and how much
 *    of them". A productivity figure in the same file would be read as part of
 *    the roster, which is the one place it must never appear.
 */

/**
 * One row's worth, named so the caller cannot hand this module a field it has
 * no business writing out. Structurally a subset of people/queries.ts's
 * `TeamMember` — assignable from one with no conversion.
 */
export type TeamCsvMember = {
  userId: string
  name: string
  email: string
  /** The free-text role on `assignments`, e.g. "Frontend". May be ''. */
  role: string
  allocationPct: number
  /** `users.employment_type`. Null where nobody has set one. */
  employmentType: string | null
}

/**
 * Who holds the project's two tracked positions, as user ids.
 *
 * Passed in rather than read off the member rows because a project's PM or
 * lead need not be ASSIGNED to it — the two are separate facts in the schema
 * (`app_role_history` versus `assignments`), and somebody can hold the
 * position while carrying no allocation. A position holder who is not on the
 * team simply does not appear in this file: the roster is the assignment list,
 * and inventing a row for them would claim an allocation that does not exist.
 */
export type TeamPositions = {
  pmUserId: string | null
  leadUserId: string | null
}

export const TEAM_CSV_HEADERS = [
  'name',
  'email',
  'project_role',
  'allocation_pct',
  'project_position',
  'employment',
] as const

/**
 * "PM", "Tech lead", "PM & tech lead", or empty.
 *
 * Both, on purpose: on a small project one person routinely holds the plan and
 * the code, and a roster that silently picked one of the two would be wrong
 * about who to go to for the other.
 */
export function projectPosition(userId: string, positions: TeamPositions): string {
  const isPm = positions.pmUserId === userId
  const isLead = positions.leadUserId === userId
  if (isPm && isLead) return 'PM & tech lead'
  if (isPm) return 'PM'
  if (isLead) return 'Tech lead'
  return ''
}

/**
 * `permanent` → `Permanent`. The enum is a database value; a roster is read by
 * people, and one lowercase column among five sentence-case ones reads as a
 * mistake rather than as a category.
 */
export function employmentLabel(employmentType: string | null): string {
  if (employmentType === null || employmentType === '') return ''
  return employmentType.charAt(0).toUpperCase() + employmentType.slice(1)
}

/**
 * The rows, in the order they are on screen.
 *
 * Deliberately NOT re-sorted here. The panel lists the team by allocation, and
 * a file whose order disagrees with the page it was downloaded from is a file
 * somebody checks line by line against the screen.
 */
export function teamCsvRows(
  members: readonly TeamCsvMember[],
  positions: TeamPositions,
): CsvValue[][] {
  return members.map((member) => [
    member.name,
    member.email,
    member.role,
    // A number, not a string: csvCell leaves numbers alone, and "40" arriving
    // as a text cell is a column nobody can total.
    member.allocationPct,
    projectPosition(member.userId, positions),
    employmentLabel(member.employmentType),
  ])
}

/** `logpup-team`, which csvFilename then stamps as `logpup-team-2026-08-22.csv`. */
export function teamCsvPrefix(appSlug: string): string {
  return `${appSlug}-team`
}
