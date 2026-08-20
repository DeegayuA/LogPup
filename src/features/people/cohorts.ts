/**
 * Who works with whom — the pure derivations behind the three cohort views on
 * /people ("By project", "Shared", "Overlap").
 *
 * NOT A QUERY LAYER, AND DELIBERATELY SO. Every function here is a fold over
 * `getUserCapacities()`, which /people already reads and which is batched
 * precisely because it grows with the workspace. Grouping people by project is
 * the same rows read the other way round, so a second read would buy nothing
 * except the chance for the two to disagree about who is on what — and a
 * per-project read is the N+1 this module exists to avoid.
 *
 * The roster is therefore whatever `getUserCapacities` returns: active,
 * approved users. Somebody deactivated is absent from every view here, the
 * same as on the directory, which is the honest answer for a page about who
 * would be in a room next week.
 */

import type { CapacityBreakdownEntry, UserCapacity } from '@/features/people/queries'

// ---------------------------------------------------------------------------
// Project-major grouping
// ---------------------------------------------------------------------------

export type CohortMember = {
  userId: string
  name: string
  title: string | null
  avatarUrl: string | null
  /** Their per-project role. Free text — see lib/project-roles.ts. */
  role: string
  /** Their allocation ON THIS PROJECT, not their total. */
  allocationPct: number
}

/**
 * One project and everyone on it.
 *
 * This is the shape the overlap report is built from, and the shape a later
 * multi-project meeting planner consumes: `members` is the full invite list for
 * one project, so the union of two cohorts is the room, and the intersection is
 * who was already going to be there.
 */
export type ProjectCohort = {
  appId: string
  name: string
  slug: string
  members: CohortMember[]
}

/**
 * Every project that has at least one person on it, A–Z, each with its members
 * heaviest-allocation first.
 *
 * A project with NOBODY on it cannot appear — there is no assignment row to
 * carry it. "By project" therefore lists it separately from `listApps()` rather
 * than from here (see cohort-views.tsx), because an unstaffed project is
 * exactly the one worth showing; the overlap view does not, because a project
 * with no people shares no people with anything.
 */
export function buildProjectCohorts(people: readonly UserCapacity[]): ProjectCohort[] {
  const byApp = new Map<string, ProjectCohort>()
  for (const person of people) {
    for (const entry of person.breakdown) {
      let cohort = byApp.get(entry.appId)
      if (!cohort) {
        cohort = { appId: entry.appId, name: entry.appName, slug: entry.slug, members: [] }
        byApp.set(entry.appId, cohort)
      }
      cohort.members.push({
        userId: person.user.id,
        name: person.user.name,
        title: person.user.title,
        avatarUrl: person.user.avatarUrl,
        role: entry.role,
        allocationPct: entry.allocationPct,
      })
    }
  }

  const cohorts = [...byApp.values()]
  for (const cohort of cohorts) {
    cohort.members.sort(
      (a, b) => b.allocationPct - a.allocationPct || a.name.localeCompare(b.name),
    )
  }
  return cohorts.sort((a, b) => a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// People split across projects
// ---------------------------------------------------------------------------

export type SharedPerson = {
  person: UserCapacity
  /** Their projects, heaviest allocation first. Always two or more. */
  projects: CapacityBreakdownEntry[]
  projectCount: number
  /**
   * The biggest single allocation as a share of this person's total, 0–100.
   * 100 means one project has all of them; 34 across three means the split is
   * as even as three can be.
   */
  topSharePct: number
  /**
   * Three or more projects and not one of them gets half their time.
   *
   * This is the whole "pulled in five directions" claim, and it is stated as
   * exactly what it checks rather than as a score: every number behind it is on
   * the row next to it, so a reader can disagree with it from the same screen.
   * It is NOT about being overallocated — someone at 60% total across four
   * projects has spare capacity and still has no day they can give to any one
   * of them.
   */
  noAnchor: boolean
}

/** Below this, one project still has the person's centre of gravity. */
const ANCHOR_SHARE_PCT = 50
/** Fewer than this and "which project am I on today" is not yet a question. */
const NO_ANCHOR_MIN_PROJECTS = 3

/**
 * Everyone on two or more projects.
 *
 * `rankBySplit` decides the order, and it exists because the order has to be
 * describable to whoever is reading it: with the allocation numbers on screen
 * the list is ranked by how evenly someone is split (most even = most pulled
 * about), and the heading says exactly that. Ranking by a number the reader
 * cannot see would be a sort order nobody could check — which is why the one
 * caller passes `true` and the card no longer offers a second description for
 * a state it cannot be in.
 */
export function buildSharedPeople(
  people: readonly UserCapacity[],
  { rankBySplit }: { rankBySplit: boolean },
): SharedPerson[] {
  const rows: SharedPerson[] = []
  for (const person of people) {
    // A 'removed' history tombstone never reaches here — getUserCapacities
    // reads live `assignments`, which has no such row — so every breakdown
    // entry is a real, current project.
    if (person.breakdown.length < 2) continue
    const projects = [...person.breakdown].sort(
      (a, b) => b.allocationPct - a.allocationPct || a.appName.localeCompare(b.appName),
    )
    const total = projects.reduce((sum, entry) => sum + entry.allocationPct, 0)
    // Guarded: allocations are integers and can all be 0, which would make the
    // share NaN and sort unpredictably. Zero everywhere means no project holds
    // them more than any other, which is the most-split end of the scale.
    const topSharePct = total > 0 ? Math.round((projects[0].allocationPct / total) * 100) : 0
    rows.push({
      person,
      projects,
      projectCount: projects.length,
      topSharePct,
      noAnchor: projects.length >= NO_ANCHOR_MIN_PROJECTS && topSharePct < ANCHOR_SHARE_PCT,
    })
  }

  return rows.sort((a, b) => {
    if (rankBySplit && a.topSharePct !== b.topSharePct) return a.topSharePct - b.topSharePct
    if (a.projectCount !== b.projectCount) return b.projectCount - a.projectCount
    return a.person.user.name.localeCompare(b.person.user.name)
  })
}

// ---------------------------------------------------------------------------
// Overlap between projects
// ---------------------------------------------------------------------------

export type ProjectOverlap = {
  /** The other project, with its own full roster. */
  project: ProjectCohort
  /**
   * Everyone on BOTH projects, carrying their allocation on `project` (the
   * other one) — the anchor's own figure is already on the anchor's roster.
   */
  shared: CohortMember[]
  /**
   * How many distinct people the anchor and this project have between them:
   * |anchor ∪ project|. This is the answer to "who would need to be in a room
   * if we discussed both" reduced to a number; the room itself is
   * `anchor.members` together with `project.members`, deduplicated by userId.
   */
  roomSize: number
}

/**
 * One project's overlap with every other, most-shared first.
 *
 * SHAPED FOR REUSE. A later multi-project meeting planner needs three things
 * from this: the anchor's roster, each candidate project's roster, and the
 * people already common to both. All three are here, keyed by userId, with no
 * rendering decisions baked in — the /people view formats them, it does not
 * define them.
 *
 * Returns null when the anchor is not a project anyone is on: the caller has to
 * say "that project has nobody" rather than render an empty report that looks
 * like "that project overlaps with nothing".
 */
export type OverlapReport = {
  anchor: ProjectCohort
  overlaps: ProjectOverlap[]
}

export function buildOverlapReport(
  cohorts: readonly ProjectCohort[],
  anchorAppId: string,
): OverlapReport | null {
  const anchor = cohorts.find((cohort) => cohort.appId === anchorAppId)
  if (!anchor) return null

  const anchorIds = new Set(anchor.members.map((member) => member.userId))
  const overlaps: ProjectOverlap[] = []

  for (const cohort of cohorts) {
    if (cohort.appId === anchor.appId) continue
    const shared = cohort.members.filter((member) => anchorIds.has(member.userId))
    // A project sharing nobody is not an overlap. Listing it would bury the
    // handful that do share people under every project in the workspace.
    if (shared.length === 0) continue
    overlaps.push({
      project: cohort,
      shared,
      // Inclusion–exclusion: both rosters minus the people counted twice.
      roomSize: anchor.members.length + cohort.members.length - shared.length,
    })
  }

  overlaps.sort(
    (a, b) => b.shared.length - a.shared.length || a.project.name.localeCompare(b.project.name),
  )
  return { anchor, overlaps }
}

// ---------------------------------------------------------------------------
// Who may see the numbers
// ---------------------------------------------------------------------------

/*
 * NO VISIBILITY LAYER HERE, deliberately.
 *
 * An earlier draft gated allocation percentages per project and printed a
 * "scoped view" notice. Both were false: /people/[id] renders AssignmentsCard
 * with no capability check at all, and this page's own People tab prints the
 * same percentages per project chip — so the notice told a reader they lacked
 * an access the next click handed them. Worse, its per-project arm read the
 * free-text assignments.role string, which granted a stakeholder — the one
 * role user.view.detail sets to 'none' — every percentage on any project where
 * somebody had typed "Director" or "Product Owner" next to their name.
 *
 * If allocation numbers should be restricted, that is one decision enforced in
 * one place (the person page and the directory first), not a fourth opinion
 * invented here. Until then these views show what the rest of /people shows.
 */

