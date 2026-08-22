import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DURATION, EASE, TRAVEL_PX } from './transitions'

/**
 * The guard that makes transitions.ts a mirror rather than a second opinion.
 *
 * globals.css is the source of truth for every duration and curve in the app;
 * this file only exists because JS cannot read a custom property at render
 * time. If someone retunes --dur-base in the stylesheet and the JS layer
 * keeps animating at the old number, nothing breaks and nothing warns — the
 * app just develops two speeds. These assertions are the warning.
 */

const css = readFileSync(
  fileURLToPath(new URL('../../app/globals.css', import.meta.url)),
  'utf8',
)

/** `--dur-base: 200ms;` -> 200 */
function cssMs(name: string): number {
  const match = new RegExp(`--${name}:\\s*(\\d+(?:\\.\\d+)?)ms`).exec(css)
  if (!match) throw new Error(`--${name} is not declared in globals.css`)
  return Number(match[1])
}

/** `--ease-enter: cubic-bezier(0.16, 1, 0.3, 1);` -> [0.16, 1, 0.3, 1] */
function cssCubic(name: string): number[] {
  const match = new RegExp(`--${name}:\\s*cubic-bezier\\(([^)]+)\\)`).exec(css)
  if (!match) throw new Error(`--${name} is not declared in globals.css`)
  return match[1].split(',').map((part) => Number(part.trim()))
}

describe('motion tokens mirror globals.css', () => {
  it.each([
    ['dur-quick', 'quick'],
    ['dur-base', 'base'],
    ['dur-slow', 'slow'],
  ] as const)('%s matches DURATION.%s', (cssName, jsName) => {
    // CSS states milliseconds, motion wants seconds.
    expect(DURATION[jsName]).toBeCloseTo(cssMs(cssName) / 1000, 5)
  })

  it.each([
    ['ease-enter', 'enter'],
    ['ease-exit', 'exit'],
    ['ease-editorial', 'editorial'],
  ] as const)('%s matches EASE.%s', (cssName, jsName) => {
    expect(EASE[jsName]).toEqual(cssCubic(cssName))
  })

  it('travel distance matches the 0.5rem the reveal rules use', () => {
    // The public page states the distance in rem inside its [data-pending]
    // rule; 1rem is 16px at the app's root size, which nothing overrides.
    expect(css).toContain('translateY(0.5rem)')
    expect(TRAVEL_PX).toBe(8)
  })
})

// ---------------------------------------------------------------------------
// The client-boundary guard.
//
// `motion/react` is a browser library: it reads layout, subscribes to
// matchMedia and animates real DOM. Imported into a module that a Server
// Component ends up in, the build fails — but late, in a message about
// createContext, several files from the actual mistake. This finds it here
// instead, and doubles as the check that nobody has quietly reintroduced
// `framer-motion` (the deprecated predecessor of the package we ship; it
// arrives as a transitive dependency, so importing it works and would split
// the app across two copies of the same animation runtime).
// ---------------------------------------------------------------------------

const SRC = fileURLToPath(new URL('../..', import.meta.url))

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

const SOURCES = walk(SRC).map((file) => ({ file, text: readFileSync(file, 'utf8') }))

describe('motion stays on the client', () => {
  it('every file importing motion/react declares "use client"', () => {
    const offenders = SOURCES.filter(
      ({ text }) =>
        /from ['"]motion\/react['"]/.test(text) && !/^\s*['"]use client['"]/m.test(text),
    ).map(({ file }) => path.relative(SRC, file))
    expect(offenders).toEqual([])
  })

  it('at least one file actually uses it', () => {
    // Guards the guard: a regex that matches nothing passes forever.
    const users = SOURCES.filter(({ text }) => /from ['"]motion\/react['"]/.test(text))
    expect(users.length).toBeGreaterThan(0)
  })

  it('nothing imports framer-motion directly', () => {
    const offenders = SOURCES.filter(({ text }) =>
      /from ['"]framer-motion/.test(text),
    ).map(({ file }) => path.relative(SRC, file))
    expect(offenders).toEqual([])
  })
})
