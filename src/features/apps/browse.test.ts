import { describe, expect, it } from 'vitest'
import type { AppHealth, AppTaskCounts } from '@/features/apps/app-health'
import {
  browseHref,
  filterApps,
  isDefaultBrowse,
  parseBrowseParams,
  queryMatches,
  riskMatches,
  sortApps,
  statusCounts,
  statusMatches,
  tagFacets,
  DEFAULT_BROWSE_PARAMS,
  type BrowsableApp,
} from '@/features/apps/browse'

function tasks(partial: Partial<AppTaskCounts> = {}): AppTaskCounts {
  const base = { todo: 0, in_progress: 0, done: 0, overdue: 0, ...partial }
  return { ...base, total: base.todo + base.in_progress + base.done }
}

function health(score = 0): AppHealth {
  return { level: score >= 30 ? 'at-risk' : 'on-track', score, reasons: [] }
}

function app(partial: Partial<BrowsableApp> = {}): BrowsableApp {
  return {
    name: 'Ledger',
    slug: 'ledger',
    description: null,
    status: 'active',
    techTags: [],
    members: [],
    leadName: null,
    health: health(),
    stats: { tasks: tasks(), lastActivityAt: null },
    ...partial,
  }
}

describe('parseBrowseParams', () => {
  it('falls back to defaults for an empty URL', () => {
    expect(parseBrowseParams({})).toEqual(DEFAULT_BROWSE_PARAMS)
  })

  it('degrades garbage to defaults instead of throwing', () => {
    expect(parseBrowseParams({ sort: 'banana', status: 'purple' })).toEqual(
      DEFAULT_BROWSE_PARAMS,
    )
  })

  it('reads valid values through', () => {
    expect(
      parseBrowseParams({
        q: '  ledger ',
        status: 'archived',
        sort: 'name',
        tag: 'React',
        risk: 'at-risk',
      }),
    ).toEqual({
      q: 'ledger',
      status: 'archived',
      sort: 'name',
      tag: 'React',
      risk: 'at-risk',
    })
  })

  it('takes the first value when a param repeats', () => {
    expect(parseBrowseParams({ sort: ['name', 'risk'] }).sort).toBe('name')
  })

  it('treats a whitespace-only tag as absent', () => {
    expect(parseBrowseParams({ tag: '   ' }).tag).toBeNull()
  })

  it('drops an unrecognised risk level rather than erroring', () => {
    expect(parseBrowseParams({ risk: 'on-track' }).risk).toBeNull()
    expect(parseBrowseParams({ risk: 'dormant' }).risk).toBeNull()
    expect(parseBrowseParams({ risk: '' }).risk).toBeNull()
  })
})

describe('browseHref', () => {
  it('omits every default so the everyday URL is bare', () => {
    expect(browseHref('/apps', DEFAULT_BROWSE_PARAMS)).toBe('/apps')
  })

  it('applies a patch on top of the current params', () => {
    const params = parseBrowseParams({ q: 'ledger', status: 'archived' })
    expect(browseHref('/apps', params, { sort: 'name' })).toBe(
      '/apps?q=ledger&status=archived&sort=name',
    )
  })

  it('can clear the tag facet', () => {
    const params = parseBrowseParams({ tag: 'React' })
    expect(browseHref('/apps', params, { tag: null })).toBe('/apps')
  })

  it('agrees with isDefaultBrowse', () => {
    expect(isDefaultBrowse(DEFAULT_BROWSE_PARAMS)).toBe(true)
    expect(isDefaultBrowse(parseBrowseParams({ q: 'x' }))).toBe(false)
  })
})

describe('statusMatches', () => {
  it('treats "live" as everything that is not archived', () => {
    expect(statusMatches('active', 'live')).toBe(true)
    expect(statusMatches('paused', 'live')).toBe(true)
    expect(statusMatches('archived', 'live')).toBe(false)
  })

  it('matches an exact status otherwise', () => {
    expect(statusMatches('paused', 'paused')).toBe(true)
    expect(statusMatches('active', 'paused')).toBe(false)
  })
})

describe('queryMatches', () => {
  const target = app({
    name: 'Ledger',
    slug: 'ledger',
    description: 'Invoicing for the finance team',
    techTags: ['Next.js'],
    members: [{ name: 'Priya Fernando' }],
    leadName: 'Nuwan Silva',
    pmName: 'Kavindu Perera',
  })

  it('matches an empty query', () => {
    expect(queryMatches(target, '   ')).toBe(true)
  })

  it('matches name, slug and tag case-insensitively', () => {
    expect(queryMatches(target, 'LEDG')).toBe(true)
    expect(queryMatches(target, 'next.js')).toBe(true)
  })

  it('matches description, lead, PM and team member names', () => {
    expect(queryMatches(target, 'invoicing')).toBe(true)
    expect(queryMatches(target, 'priya')).toBe(true)
    expect(queryMatches(target, 'nuwan')).toBe(true)
    expect(queryMatches(target, 'kavindu')).toBe(true)
  })

  it('rejects a miss', () => {
    expect(queryMatches(target, 'kubernetes')).toBe(false)
  })
})

describe('filterApps', () => {
  const apps = [
    app({ name: 'Ledger', slug: 'ledger', techTags: ['React'] }),
    app({ name: 'Atlas', slug: 'atlas', status: 'paused', techTags: ['Go'] }),
    app({ name: 'Relic', slug: 'relic', status: 'archived', techTags: ['React'] }),
  ]

  it('hides archived apps by default', () => {
    const visible = filterApps(apps, DEFAULT_BROWSE_PARAMS)
    expect(visible.map((a) => a.slug)).toEqual(['ledger', 'atlas'])
  })

  it('combines status, query and tag', () => {
    const visible = filterApps(apps, {
      ...DEFAULT_BROWSE_PARAMS,
      status: 'archived',
      tag: 'react',
    })
    expect(visible.map((a) => a.slug)).toEqual(['relic'])
  })

  it('matches the tag facet case-insensitively but exactly', () => {
    expect(filterApps(apps, { ...DEFAULT_BROWSE_PARAMS, tag: 'reac' })).toHaveLength(0)
    expect(filterApps(apps, { ...DEFAULT_BROWSE_PARAMS, tag: 'REACT' })).toHaveLength(1)
  })
})

describe('riskMatches / the risk facet', () => {
  const atRisk = app({
    slug: 'burning',
    health: { level: 'at-risk', score: 45, reasons: ['Sprint overran'] },
  })
  const watch = app({
    slug: 'wobbly',
    health: { level: 'watch', score: 12, reasons: ['No lead'] },
  })
  const fine = app({ slug: 'calm', health: { level: 'on-track', score: 0, reasons: [] } })

  it('passes everything through when no level is requested', () => {
    expect(riskMatches(atRisk, null)).toBe(true)
    expect(riskMatches(fine, null)).toBe(true)
  })

  it('matches at-risk exactly', () => {
    expect(riskMatches(atRisk, 'at-risk')).toBe(true)
    expect(riskMatches(watch, 'at-risk')).toBe(false)
    expect(riskMatches(fine, 'at-risk')).toBe(false)
  })

  it('includes at-risk inside watch — "needs a look" must not hide the worst', () => {
    expect(riskMatches(watch, 'watch')).toBe(true)
    expect(riskMatches(atRisk, 'watch')).toBe(true)
    expect(riskMatches(fine, 'watch')).toBe(false)
  })

  it('narrows the grid through filterApps, which is what the header tile clicks', () => {
    const visible = filterApps([atRisk, watch, fine], {
      ...DEFAULT_BROWSE_PARAMS,
      risk: 'at-risk',
    })
    expect(visible.map((a) => a.slug)).toEqual(['burning'])
  })

  it('round-trips through the URL so the tile link is not a no-op', () => {
    // The regression this guards: the old href patched `sort` and `status` to
    // values that were already the defaults, so browseHref returned the bare
    // '/apps' the user was standing on.
    const href = browseHref('/apps', DEFAULT_BROWSE_PARAMS, { risk: 'at-risk' })
    expect(href).toBe('/apps?risk=at-risk')
    expect(href).not.toBe('/apps')
    expect(parseBrowseParams({ risk: 'at-risk' }).risk).toBe('at-risk')
  })

  it('is clearable, and clearing it returns to the bare URL', () => {
    const params = parseBrowseParams({ risk: 'at-risk' })
    expect(isDefaultBrowse(params)).toBe(false)
    expect(browseHref('/apps', params, { risk: null })).toBe('/apps')
  })
})

describe('sortApps', () => {
  const risky = app({ name: 'Risky', slug: 'risky', health: health(45) })
  const calm = app({ name: 'Calm', slug: 'calm', health: health(0) })
  const dead = app({ name: 'Aaa Dead', slug: 'dead', status: 'archived', health: health(90) })

  it('sinks archived apps to the bottom of every order', () => {
    for (const sort of ['risk', 'activity', 'progress', 'name'] as const) {
      const sorted = sortApps([dead, calm, risky], sort)
      expect(sorted.at(-1)?.slug).toBe('dead')
    }
  })

  it('puts the highest risk score first', () => {
    expect(sortApps([calm, risky], 'risk').map((a) => a.slug)).toEqual(['risky', 'calm'])
  })

  it('breaks equal risk scores by overdue count, then by name', () => {
    const a = app({ name: 'Bravo', slug: 'b', stats: { tasks: tasks({ overdue: 1 }), lastActivityAt: null } })
    const b = app({ name: 'Alpha', slug: 'a', stats: { tasks: tasks({ overdue: 3 }), lastActivityAt: null } })
    const c = app({ name: 'Charlie', slug: 'c', stats: { tasks: tasks({ overdue: 1 }), lastActivityAt: null } })
    expect(sortApps([a, b, c], 'risk').map((x) => x.slug)).toEqual(['a', 'b', 'c'])
  })

  it('orders by most recent activity, with never-touched apps last', () => {
    const old = app({ name: 'Old', slug: 'old', stats: { tasks: tasks(), lastActivityAt: new Date('2026-01-01') } })
    const fresh = app({ name: 'Fresh', slug: 'fresh', stats: { tasks: tasks(), lastActivityAt: new Date('2026-08-01') } })
    const never = app({ name: 'Never', slug: 'never' })
    expect(sortApps([old, never, fresh], 'activity').map((a) => a.slug)).toEqual([
      'fresh',
      'old',
      'never',
    ])
  })

  it('orders by completion, breaking ties on how many tasks there are', () => {
    const big = app({ name: 'Big', slug: 'big', stats: { tasks: tasks({ done: 5, todo: 5 }), lastActivityAt: null } })
    const small = app({ name: 'Small', slug: 'small', stats: { tasks: tasks({ done: 1, todo: 1 }), lastActivityAt: null } })
    const finished = app({ name: 'Finished', slug: 'done', stats: { tasks: tasks({ done: 2 }), lastActivityAt: null } })
    expect(sortApps([small, big, finished], 'progress').map((a) => a.slug)).toEqual([
      'done',
      'big',
      'small',
    ])
  })

  it('does not mutate its input', () => {
    const input = [risky, calm]
    sortApps(input, 'name')
    expect(input.map((a) => a.slug)).toEqual(['risky', 'calm'])
  })
})

describe('statusCounts', () => {
  it('counts live as active plus paused', () => {
    const counts = statusCounts([
      app({ status: 'active' }),
      app({ status: 'paused' }),
      app({ status: 'archived' }),
    ])
    expect(counts).toEqual({ live: 2, active: 1, paused: 1, archived: 1 })
  })
})

describe('tagFacets', () => {
  it('drops tags used by a single app and de-dupes casing', () => {
    const facets = tagFacets(
      [
        app({ techTags: ['React', 'Go'] }),
        app({ techTags: ['react', 'Postgres'] }),
        app({ techTags: ['Go'] }),
      ],
      10,
    )
    // Postgres is used once, so it is not a useful facet. React and Go tie on
    // count and fall back to alphabetical; "react" folds into "React", whose
    // first-seen casing wins.
    expect(facets).toEqual([
      { tag: 'Go', count: 2 },
      { tag: 'React', count: 2 },
    ])
  })

  it('orders a clear winner first regardless of the alphabet', () => {
    const facets = tagFacets(
      [
        app({ techTags: ['Zig', 'Ada'] }),
        app({ techTags: ['Zig', 'Ada'] }),
        app({ techTags: ['Zig'] }),
      ],
      10,
    )
    expect(facets).toEqual([
      { tag: 'Zig', count: 3 },
      { tag: 'Ada', count: 2 },
    ])
  })

  it('respects the limit', () => {
    const many = [
      app({ techTags: ['a', 'b', 'c'] }),
      app({ techTags: ['a', 'b', 'c'] }),
    ]
    expect(tagFacets(many, 2)).toHaveLength(2)
  })
})
