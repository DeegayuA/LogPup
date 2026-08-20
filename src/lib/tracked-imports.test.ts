import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * THE ONE CHECK THAT READS THE COMMIT RATHER THAN THE DISK.
 *
 * Everything else in this repo's verification — tsc, vitest, eslint, even
 * `next build` — resolves imports against the WORKING TREE. So a file that
 * imports a module its author has on disk but never staged passes every one
 * of them, and then fails on a fresh clone with "module not found". That is
 * not hypothetical: it happened five times in one evening across three
 * parallel sessions, all in the dashboard route, and no local check could
 * see any of it. The deploy builds from the pushed commit, so this is the
 * shape that goes green locally and red in production.
 *
 * The rule: if a tracked file imports it, it must be tracked too. A feature's
 * module and its consumer land in the same commit or neither does.
 *
 * Deliberately repo-level rather than per-feature: the failure is
 * cross-feature by nature — one session's consumer, another session's
 * module — so a check scoped to any single feature would have missed every
 * real instance.
 */

const git = (args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

/** Extensions a bare `@/foo/bar` specifier can resolve to, in resolution order. */
const RESOLUTIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'] as const

function resolveAlias(spec: string): string | null {
  const base = `src/${spec.slice('@/'.length)}`
  for (const ext of RESOLUTIONS) {
    if (existsSync(`${base}${ext}`)) return `${base}${ext}`
  }
  // Unresolvable on disk either — that is tsc's failure to report, not this
  // test's. Reporting it here as well would give two failures for one cause.
  return null
}

describe('every module a tracked file imports is itself tracked', () => {
  it('has no tracked file importing a module that is missing from the index', () => {
    const trackedList = git(['ls-files', 'src/'])
      .split('\n')
      .filter((p) => /\.(ts|tsx)$/.test(p))
    const tracked = new Set(trackedList)

    const offenders: string[] = []
    for (const file of trackedList) {
      const source = readFileSync(file, 'utf8')
      // `from '@/…'` covers static imports and re-exports. The lazy
      // `await import('@/…')` form that the command registry requires is
      // matched by the second pattern and matters at least as much: a
      // dynamic import of an untracked module fails at runtime rather than
      // at build, so it reaches a user instead of a deploy log.
      const specs = [
        ...source.matchAll(/from\s+['"](@\/[^'"]+)['"]/g),
        ...source.matchAll(/import\(\s*['"](@\/[^'"]+)['"]\s*\)/g),
      ].map((m) => m[1])

      for (const spec of new Set(specs)) {
        const target = resolveAlias(spec)
        if (target && !tracked.has(target)) {
          offenders.push(`${file}\n      imports ${spec}  ->  ${target} (UNTRACKED)`)
        }
      }
    }

    expect(
      offenders,
      offenders.length
        ? 'These files cannot build from a clean checkout. Stage the imported ' +
            'module in the same commit as its consumer, or drop the import:\n\n  ' +
            offenders.join('\n  ')
        : undefined,
    ).toEqual([])
  })
})
