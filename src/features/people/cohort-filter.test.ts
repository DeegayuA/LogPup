import { describe, expect, it } from 'vitest'
import {
  filterSortProjects,
  hasActiveProjectFilters,
  projectLoad,
  type FilterableProject,
  type ProjectFilters,
} from './cohort-filter'

const DEFAULTS: ProjectFilters = { q: '', staff: 'all', role: 'all', sort: 'name' }
const f = (patch: Partial<ProjectFilters> = {}): ProjectFilters => ({ ...DEFAULTS, ...patch })

function project(
  name: string,
  members: { name: string; role: string; allocationPct: number }[],
): FilterableProject {
  return {
    appId: `id-${name}`,
    name,
    slug: name.toLowerCase(),
    members: members.map((m, i) => ({ ...m, userId: `${name}-${i}` })),
  }
}

const KESTREL = project('Kestrel', [
  { name: 'Nuwan Perera', role: 'Tech Lead', allocationPct: 70 },
  { name: 'Ishara Fernando', role: 'Engineer', allocationPct: 46 },
])
const APOLLO = project('Apollo', [
  { name: 'Dilini Jayasuriya', role: 'Project Manager', allocationPct: 40 },
])
const TESSERA = project('Tessera', [])
const ALL = [KESTREL, APOLLO, TESSERA]

describe('filterSortProjects', () => {
  it('lists everything A–Z by default, unstaffed projects included', () => {
    // The unstaffed one is the whole reason this view lists from the portfolio
    // rather than from the cohorts — it must not vanish under the default.
    expect(filterSortProjects(ALL, f()).map((p) => p.name)).toEqual([
      'Apollo',
      'Kestrel',
      'Tessera',
    ])
  })

  it('finds the projects nobody is on', () => {
    expect(filterSortProjects(ALL, f({ staff: 'unstaffed' })).map((p) => p.name)).toEqual([
      'Tessera',
    ])
  })

  it('finds the projects with no lead and no manager', () => {
    // The one filter about an ABSENCE, and the one an A–Z list of names cannot
    // show you at all.
    const unowned = project('Orphan', [{ name: 'Kasun', role: 'Engineer', allocationPct: 20 }])
    const out = filterSortProjects([...ALL, unowned], f({ role: 'no-lead' }))
    expect(out.map((p) => p.name)).toEqual(['Orphan'])
  })

  it('does not count an EMPTY project as one with no lead', () => {
    // Tessera has nobody on it. It has no lead in the trivial sense, but that
    // is a different problem with a different fix — staff it — and it has its
    // own filter. Folding it in here would bury the actionable case (people are
    // working on this and nobody owns it) under the one you already knew about.
    expect(filterSortProjects([TESSERA], f({ role: 'no-lead' }))).toEqual([])
    expect(filterSortProjects([TESSERA], f({ staff: 'unstaffed' })).map((p) => p.name)).toEqual([
      'Tessera',
    ])
  })

  it('treats a Tech Lead as a lead and a Project Manager as a manager', () => {
    // Roles are free text; project-roles.ts is the single interpreter and this
    // view must not grow a second opinion.
    expect(filterSortProjects(ALL, f({ role: 'reviewer' })).map((p) => p.name)).toEqual(['Kestrel'])
    expect(filterSortProjects(ALL, f({ role: 'manager' })).map((p) => p.name)).toEqual(['Apollo'])
  })

  it('searches people and their roles, not only project names', () => {
    expect(filterSortProjects(ALL, f({ q: 'ishara' })).map((p) => p.name)).toEqual(['Kestrel'])
    expect(filterSortProjects(ALL, f({ q: 'manager' })).map((p) => p.name)).toEqual(['Apollo'])
    expect(filterSortProjects(ALL, f({ q: 'KESTREL' })).map((p) => p.name)).toEqual(['Kestrel'])
  })

  // THE DISCRIMINATING CASE. On a natural portfolio, headcount and load agree —
  // more people usually means more allocation — so every other assertion here
  // would pass under either comparator. This is the shape where they MUST
  // disagree: one person at 100% against three people at 10% each.
  const HEAVY_ONE = project('Heavy', [{ name: 'Solo', role: 'Engineer', allocationPct: 100 }])
  const CROWDED = project('Crowded', [
    { name: 'A', role: 'Engineer', allocationPct: 10 },
    { name: 'B', role: 'Engineer', allocationPct: 10 },
    { name: 'C', role: 'Engineer', allocationPct: 10 },
  ])

  it('sorts by headcount when asked for most people', () => {
    expect(
      filterSortProjects([HEAVY_ONE, CROWDED], f({ sort: 'people' })).map((p) => p.name),
    ).toEqual(['Crowded', 'Heavy'])
  })

  it('sorts by allocation when asked for heaviest load, which is a different answer', () => {
    expect(filterSortProjects([HEAVY_ONE, CROWDED], f({ sort: 'load' })).map((p) => p.name)).toEqual(
      ['Heavy', 'Crowded'],
    )
  })

  it('reverses cleanly for lightest first', () => {
    expect(
      filterSortProjects([HEAVY_ONE, CROWDED], f({ sort: 'lightest' })).map((p) => p.name),
    ).toEqual(['Crowded', 'Heavy'])
  })

  it('breaks every tie on name, so the order never reshuffles between renders', () => {
    const a = project('Zeta', [{ name: 'X', role: 'Engineer', allocationPct: 50 }])
    const b = project('Alpha', [{ name: 'Y', role: 'Engineer', allocationPct: 50 }])
    for (const sort of ['people', 'load', 'lightest'] as const) {
      expect(filterSortProjects([a, b], f({ sort })).map((p) => p.name)).toEqual(['Alpha', 'Zeta'])
    }
  })

  it('combines filters rather than letting the last one win', () => {
    const out = filterSortProjects(ALL, f({ staff: 'staffed', role: 'reviewer', q: 'nuwan' }))
    expect(out.map((p) => p.name)).toEqual(['Kestrel'])
  })

  it('returns nothing when nothing matches, rather than falling back to everything', () => {
    expect(filterSortProjects(ALL, f({ q: 'nobody-by-this-name' }))).toEqual([])
  })

  it('does not mutate the array it was given', () => {
    const input = [KESTREL, APOLLO]
    filterSortProjects(input, f({ sort: 'load' }))
    expect(input.map((p) => p.name)).toEqual(['Kestrel', 'Apollo'])
  })
})

describe('projectLoad', () => {
  it('sums what everyone is giving the project', () => {
    expect(projectLoad(KESTREL)).toBe(116)
    expect(projectLoad(TESSERA)).toBe(0)
  })
})

describe('hasActiveProjectFilters', () => {
  it('is false only for the untouched default', () => {
    expect(hasActiveProjectFilters(f())).toBe(false)
    expect(hasActiveProjectFilters(f({ q: 'a' }))).toBe(true)
    expect(hasActiveProjectFilters(f({ staff: 'unstaffed' }))).toBe(true)
    expect(hasActiveProjectFilters(f({ role: 'no-lead' }))).toBe(true)
    expect(hasActiveProjectFilters(f({ sort: 'load' }))).toBe(true)
  })
})
