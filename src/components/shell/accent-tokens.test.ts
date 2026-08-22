import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ACCENTS, DEFAULT_ACCENT, themeInitScript } from './theme-provider'

/**
 * The colourway contract, enforced.
 *
 * ACCENTS decides what the picker offers and what the pre-paint script will
 * accept out of localStorage. globals.css decides what those names actually
 * paint. Nothing in the type system connects the two: add a way to the list
 * and forget the CSS and you ship a picker option that changes nothing, which
 * looks like a broken control rather than a missing stylesheet. Add the CSS
 * and forget the list and the way is unreachable and unpersistable.
 *
 * These tests are the connection.
 */

const css = readFileSync(
  fileURLToPath(new URL('../../app/globals.css', import.meta.url)),
  'utf8',
)

/** Every way that has CSS behind it, in either mode. */
function declaredWays(): Set<string> {
  const found = new Set<string>()
  for (const match of css.matchAll(/\[data-accent='([a-z]+)'\]/g)) found.add(match[1])
  return found
}

/** The custom properties one selector block sets. */
function propsOf(selector: string): string[] {
  const start = css.indexOf(selector)
  if (start === -1) return []
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return [...css.slice(open, close).matchAll(/(--[\w-]+):/g)].map((m) => m[1]).sort()
}

const lightSelector = (way: string) => `[data-accent='${way}']:not(:is(.dark, .dark *))`
const darkSelector = (way: string) => `:is(.dark, .dark *)[data-accent='${way}']`

const NON_DEFAULT = ACCENTS.filter((way) => way !== DEFAULT_ACCENT)

describe('colourways', () => {
  it.each(NON_DEFAULT)('%s has a light block and a dark block', (way) => {
    expect(propsOf(lightSelector(way)).length).toBeGreaterThan(0)
    expect(propsOf(darkSelector(way)).length).toBeGreaterThan(0)
  })

  it('the default way has no block of its own', () => {
    // Pine is what :root and .dark already declare. A block for it would be a
    // second copy of those values, free to drift from them.
    expect(declaredWays().has(DEFAULT_ACCENT)).toBe(false)
  })

  it('every way declared in CSS is offered by the picker', () => {
    const orphans = [...declaredWays()].filter(
      (way) => !(ACCENTS as readonly string[]).includes(way),
    )
    expect(orphans).toEqual([])
  })

  it('every way overrides the same tokens as its siblings', () => {
    // A way that sets nine of the ten is not a subtler way, it is a way with a
    // hole in it — one surface still wearing pine.
    const lightShapes = new Set(NON_DEFAULT.map((w) => propsOf(lightSelector(w)).join(',')))
    const darkShapes = new Set(NON_DEFAULT.map((w) => propsOf(darkSelector(w)).join(',')))
    expect(lightShapes.size).toBe(1)
    expect(darkShapes.size).toBe(1)
  })

  it('no way touches a surface or a semantic token', () => {
    /* The whole promise of the feature: a colourway moves the working colour
       and nothing else. If --destructive or --background ever appears in one
       of these blocks, "at risk" has started meaning something different
       depending on which colour somebody likes. */
    const forbidden = [
      '--background',
      '--foreground',
      '--card',
      '--popover',
      '--border',
      '--input',
      '--muted',
      '--secondary',
      '--destructive',
      '--success',
      '--warning',
      '--weekend',
      '--holiday',
      '--mercantile',
      '--chart-1',
      '--overlay',
    ]
    for (const way of NON_DEFAULT) {
      const touched = [...propsOf(lightSelector(way)), ...propsOf(darkSelector(way))]
      expect(touched.filter((prop) => forbidden.includes(prop))).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// The pre-paint script, executed.
//
// This string runs before anything else on the page, so it is the one piece of
// code in the app with no framework catching its mistakes: a throw here is a
// blank document, and a wrong branch is a colour that flashes on every load.
// It is also the piece least likely to be exercised by anything else — nothing
// imports it, it is interpolated into a <script> tag and forgotten.
//
// The parameters shadow the globals the script reaches for, so it runs against
// stubs without a DOM.
// ---------------------------------------------------------------------------

type Root = {
  classList: { add: (name: string) => void; remove?: (name: string) => void }
  style: { colorScheme?: string }
  setAttribute: (name: string, value: string) => void
}

function runInitScript(stored: Record<string, string> | 'throws', prefersDark = false) {
  const classes: string[] = []
  const attrs: Record<string, string> = {}
  const root: Root = {
    classList: { add: (name) => void classes.push(name) },
    style: {},
    setAttribute: (name, value) => void (attrs[name] = value),
  }
  const localStorage = {
    getItem(key: string) {
      if (stored === 'throws') throw new Error('storage disabled')
      return key in stored ? stored[key] : null
    },
  }
  const win = { matchMedia: () => ({ matches: prefersDark }) }
  new Function('window', 'document', 'localStorage', themeInitScript)(
    win,
    { documentElement: root },
    localStorage,
  )
  return { classes, attrs }
}

describe('the pre-paint script', () => {
  it('applies a stored way as an attribute, before anything renders', () => {
    const { attrs } = runInitScript({ 'logpup.accent': 'ocean' })
    expect(attrs['data-accent']).toBe('ocean')
  })

  it('falls back to the default when nothing is stored', () => {
    expect(runInitScript({}).attrs['data-accent']).toBe(DEFAULT_ACCENT)
  })

  it('refuses a way it does not recognise', () => {
    // A hand-edited or stale storage value must not become an attribute that
    // no CSS block matches — that renders as pine anyway, but silently, and
    // the picker would then disagree with the page.
    const { attrs } = runInitScript({ 'logpup.accent': 'chartreuse' })
    expect(attrs['data-accent']).toBe(DEFAULT_ACCENT)
  })

  it('accepts every way the picker offers', () => {
    for (const way of ACCENTS) {
      expect(runInitScript({ 'logpup.accent': way }).attrs['data-accent']).toBe(way)
    }
  })

  it('still applies the theme alongside the way', () => {
    const { classes } = runInitScript({ 'logpup.theme': 'dark', 'logpup.accent': 'rose' })
    expect(classes).toContain('dark')
  })

  it('survives storage that throws, without applying anything', () => {
    // Private mode. The page then renders as :root declares it — light, pine —
    // which is a correct page, not a broken one.
    expect(() => runInitScript('throws')).not.toThrow()
    expect(runInitScript('throws').attrs['data-accent']).toBeUndefined()
  })
})
