// Filtering and ordering for the "By project" view.
//
// The view listed every project A–Z with everyone on it, which answers "what
// exists" and nothing else. The questions people actually bring to this page
// are narrower, and none of them were askable: which projects have nobody on
// them, which have no lead, who is carrying the most, where is this person.
//
// Pure and separate from rendering so the answers can be pinned by tests. The
// ordering especially: a sort by headcount and a sort by load agree on most
// real portfolios, because a project with more people usually carries more
// allocation — so the tests include the case where the two must disagree.

import { roleBadgeTone, type ProjectRoleTone } from '@/lib/project-roles'

/** Only what filtering and ordering need — not the whole portfolio entry. */
export type FilterableProject = {
  appId: string
  name: string
  slug: string
  members: readonly {
    userId: string
    name: string
    role: string
    allocationPct: number
  }[]
}

export const PROJECT_SORTS = ['name', 'people', 'load', 'lightest'] as const
export type ProjectSort = (typeof PROJECT_SORTS)[number]

export const PROJECT_SORT_LABEL: Record<ProjectSort, string> = {
  name: 'A–Z',
  people: 'Most people',
  load: 'Heaviest load',
  lightest: 'Lightest load',
}

export const STAFF_FILTERS = ['all', 'staffed', 'unstaffed'] as const
export type StaffFilter = (typeof STAFF_FILTERS)[number]

export const STAFF_FILTER_LABEL: Record<StaffFilter, string> = {
  all: 'All projects',
  staffed: 'Has people',
  unstaffed: 'Nobody on it',
}

export const ROLE_FILTERS = ['all', 'manager', 'reviewer', 'member', 'no-lead'] as const
export type RoleFilter = (typeof ROLE_FILTERS)[number]

export const ROLE_FILTER_LABEL: Record<RoleFilter, string> = {
  all: 'Any role',
  manager: 'Has a manager',
  reviewer: 'Has a lead',
  member: 'Has hands-on people',
  'no-lead': 'No lead or manager',
}

export type ProjectFilters = {
  q: string
  staff: StaffFilter
  role: RoleFilter
  sort: ProjectSort
}

/** Total allocation a project is carrying, across everyone on it. */
export function projectLoad(project: FilterableProject): number {
  return project.members.reduce((sum, m) => sum + m.allocationPct, 0)
}

function tones(project: FilterableProject): Set<ProjectRoleTone> {
  return new Set(project.members.map((m) => roleBadgeTone(m.role)))
}

function matchesRole(project: FilterableProject, filter: RoleFilter): boolean {
  if (filter === 'all') return true
  const present = tones(project)
  // "No lead or manager" is the one filter about an ABSENCE, and it is the most
  // useful of them: an unowned project is exactly what this page should
  // surface, and it is invisible in an A–Z list of names.
  //
  // It requires members. A project with NOBODY on it has no lead in the trivial
  // sense, but that is a different problem with a different fix — staff it —
  // and it already has its own filter. Letting empty projects fall in here
  // would bury the actionable case (people are working on this and nobody owns
  // it) under the one you already knew about, and make "Nobody on it"
  // redundant.
  if (filter === 'no-lead') {
    return project.members.length > 0 && !present.has('manager') && !present.has('reviewer')
  }
  return present.has(filter)
}

function matchesQuery(project: FilterableProject, q: string): boolean {
  if (q === '') return true
  const needle = q.toLowerCase()
  // Searches the project, its people AND their roles, so "who is Ishara on" and
  // "which projects have an architect" are the same box.
  return (
    project.name.toLowerCase().includes(needle) ||
    project.slug.toLowerCase().includes(needle) ||
    project.members.some(
      (m) => m.name.toLowerCase().includes(needle) || m.role.toLowerCase().includes(needle),
    )
  )
}

export function filterSortProjects(
  projects: readonly FilterableProject[],
  filters: ProjectFilters,
): FilterableProject[] {
  const kept = projects.filter((project) => {
    if (filters.staff === 'staffed' && project.members.length === 0) return false
    if (filters.staff === 'unstaffed' && project.members.length > 0) return false
    return matchesRole(project, filters.role) && matchesQuery(project, filters.q)
  })

  // Every comparator falls through to name, so the order is total and stable —
  // a list that reshuffles between renders on equal values reads as live data
  // changing when nothing changed.
  const byName = (a: FilterableProject, b: FilterableProject) => a.name.localeCompare(b.name)

  return [...kept].sort((a, b) => {
    switch (filters.sort) {
      case 'people': {
        const diff = b.members.length - a.members.length
        return diff !== 0 ? diff : byName(a, b)
      }
      case 'load': {
        const diff = projectLoad(b) - projectLoad(a)
        return diff !== 0 ? diff : byName(a, b)
      }
      case 'lightest': {
        const diff = projectLoad(a) - projectLoad(b)
        return diff !== 0 ? diff : byName(a, b)
      }
      default:
        return byName(a, b)
    }
  })
}

/** True when anything is narrowing the list — drives whether "Clear" shows. */
export function hasActiveProjectFilters(filters: ProjectFilters): boolean {
  return (
    filters.q !== '' || filters.staff !== 'all' || filters.role !== 'all' || filters.sort !== 'name'
  )
}
