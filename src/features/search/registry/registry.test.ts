import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_FEATURE_COMMANDS, paletteCommands } from './commands'
import { ALL_PROVIDERS } from './providers'
import type { PaletteContext } from './types'

// ---------------------------------------------------------------------------
// The command center's drift guard.
//
// The palette used to hardcode every row it could show, and universal search
// used to inline every query it could run. Both went stale the moment a
// feature shipped without someone remembering to edit two files in another
// directory — the sidebar advertised a "G W" jump for Work log that the
// palette had never heard of, and no entity had been added to search since it
// was written.
//
// So: a feature directory must either contribute to the registry or say, in
// writing, that it has nothing to contribute. This file is what makes
// "forgot" fail instead of pass quietly.
//
// Modelled on src/db/live.test.ts, down to the awkward parts — the explicit
// empty-case test (an it.each over an empty list registers ZERO tests and
// vitest fails the whole FILE with "No test found in suite", i.e. exactly
// when the code is correct) and the allowlist hygiene (an exemption for a
// thing that no longer exists is a standing exemption waiting to be
// inherited).
// ---------------------------------------------------------------------------

const FEATURES_DIR = path.resolve(__dirname, '../..')
const REPO_ROOT = path.resolve(FEATURES_DIR, '../..')

/** Every directory under src/features. */
const FEATURES = readdirSync(FEATURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

/**
 * Features with nothing to put in the palette. Each entry states WHY, because
 * the reason is the whole value of it — a bare list of names decays into "the
 * features nobody got round to".
 */
const NO_COMMANDS: Readonly<Record<string, string>> = {
  activity: 'no palette-invocable action; its page is already a nav row',
  admin: 'every action needs a target row, and the purges need a typed confirmation',
  calendar: 'an internal Google Calendar wrapper, no user-facing action',
  dashboard: 'no actions; its page is a nav row',
  gemini: 'key management is per-key and lives on /profile',
  notion: 'its one action needs a sprintId',
  onboarding: 'renders only on /pending, where the palette does not exist',
  pwa: 'its affordances are components wired to browser events, not callables',
  search: 'owns the palette itself; quick-assign is the input, not a row',
  speech: 'needs a microphone or a selection; not fire-and-forget',
  sprints: 'every action needs an app, sprint or task id',
  transcription: 'needs a meetingId and an env feature flag',
  worklog: 'logging happens on its page, which is a nav row',
}

/** Features with nothing searchable. Same rule: say why. */
const NO_SEARCH: Readonly<Record<string, string>> = {
  activity: 'activity is a feed to scroll, not a set of things to jump to',
  admin: 'it administers users, which the people provider already indexes',
  auth: 'own-account data only',
  calendar: 'no tables of its own',
  dashboard: 'no tables of its own',
  gemini: "a user's own API keys are private, not workspace-searchable",
  notifications: 'a personal inbox, not a workspace index',
  notion: 'no tables of its own',
  onboarding: 'no tables of its own',
  pwa: 'no tables of its own',
  search: 'owns the registry itself',
  settings: 'no tables of its own',
  speech: 'no tables of its own',
  transcription: 'transcripts hang off a meeting, which is already searchable',
  worklog: "a person's own log, read on their own page",
}

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, relPath), 'utf8')
}

const commandsRegistrySource = read('src/features/search/registry/commands.ts')
const providersRegistrySource = read('src/features/search/registry/providers.ts')

/** A context to resolve rows against. Role and shell state vary per test. */
function ctx(role: PaletteContext['user']['role'] = 'member'): PaletteContext {
  return {
    user: {
      id: 'u1',
      role,
      status: 'approved',
      // A deactivated account never reaches the palette at all — the proxy
      // pins it to /deactivated — so every row here is resolved for an
      // active one.
      active: true,
      mustChangePassword: false,
      email: 'someone@example.com',
      name: 'Someone',
    },
    theme: 'system',
    goShortcutsOn: true,
  }
}

// --- Check 1: a feature either contributes commands or says why not --------

describe('check 1: every feature declares its palette commands', () => {
  const offenders = FEATURES.filter(
    (feature) =>
      !existsSync(path.join(FEATURES_DIR, feature, 'commands.ts')) && !(feature in NO_COMMANDS),
  )

  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders).toEqual([])
    })
  } else {
    it.each(offenders)('src/features/%s', (feature) => {
      throw new Error(
        `src/features/${feature} has no commands.ts and is not listed in NO_COMMANDS. `
        + 'If the feature can do anything from a bare query — create a thing, flip a switch, '
        + 'reach a page the sidebar does not list — add a commands.ts exporting '
        + '`commands: CommandDescriptor[]` plus one import line in '
        + 'src/features/search/registry/commands.ts. If it genuinely cannot, add it to '
        + 'NO_COMMANDS in this file with the reason.',
      )
    })
  }
})

// --- Check 2: no orphaned commands.ts -------------------------------------

describe('check 2: every commands.ts is wired into the registry', () => {
  const offenders = FEATURES.filter(
    (feature) =>
      existsSync(path.join(FEATURES_DIR, feature, 'commands.ts'))
      && !commandsRegistrySource.includes(`@/features/${feature}/commands`),
  )

  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders).toEqual([])
    })
  } else {
    it.each(offenders)('src/features/%s/commands.ts', (feature) => {
      throw new Error(
        `src/features/${feature}/commands.ts exists but nothing imports it, so none of its rows `
        + 'reach the palette. Import it in src/features/search/registry/commands.ts and spread it '
        + 'into FEATURE_COMMANDS.',
      )
    })
  }
})

// --- Check 3: same, for search providers ----------------------------------

describe('check 3: every search-providers.ts is wired into the registry', () => {
  const offenders = FEATURES.filter(
    (feature) =>
      existsSync(path.join(FEATURES_DIR, feature, 'search-providers.ts'))
      && !providersRegistrySource.includes(`@/features/${feature}/search-providers`),
  )

  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders).toEqual([])
    })
  } else {
    it.each(offenders)('src/features/%s/search-providers.ts', (feature) => {
      throw new Error(
        `src/features/${feature}/search-providers.ts exists but nothing imports it, so it never `
        + 'runs. Add it to ALL_PROVIDERS in src/features/search/registry/providers.ts.',
      )
    })
  }
})

// --- Check 4: a feature either has a provider or says why not -------------

describe('check 4: every feature declares whether it is searchable', () => {
  const offenders = FEATURES.filter(
    (feature) =>
      !existsSync(path.join(FEATURES_DIR, feature, 'search-providers.ts'))
      && !(feature in NO_SEARCH),
  )

  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders).toEqual([])
    })
  } else {
    it.each(offenders)('src/features/%s', (feature) => {
      throw new Error(
        `src/features/${feature} owns something nobody can find from ⌘K, and has not said that is `
        + 'deliberate. Add a search-providers.ts exporting `searchProviders: SearchProvider[]` '
        + '(reading the live_* subqueries from @/db/live for anything soft-deleted), or add the '
        + 'feature to NO_SEARCH in this file with the reason.',
      )
    })
  }
})

// --- Check 5: commands.ts must stay on the client side of the boundary ----

/**
 * A commands.ts is imported by the palette, which wraps the whole (app)
 * layout. Reaching the database from there does not fail the build — it
 * compiles clean and quietly ships drizzle, the Neon driver and the entire
 * schema into the first-load JS of every authed page. Anything touching
 * node:crypto (lib/auth, lib/crypto, lib/password) or next/headers fails
 * harder but no more clearly. Importing a 'use server' actions module is fine
 * and expected: Next resolves those in a server-only layer and hands the
 * client a reference, which is how the palette already calls quickAssignTask.
 */
const CLIENT_FORBIDDEN = [
  { pattern: /from '@\/db/, what: '@/db' },
  { pattern: /from '[^']*\/queries'/, what: 'a queries module' },
  { pattern: /from '@\/lib\/(auth|crypto|password|session)'/, what: 'a server-only lib' },
  { pattern: /from 'next\/(headers|cache)'/, what: 'a server-only Next module' },
] as const

describe('check 5: no commands.ts pulls server code into the client bundle', () => {
  const offenders = FEATURES.flatMap((feature) => {
    const file = path.join(FEATURES_DIR, feature, 'commands.ts')
    if (!existsSync(file)) return []
    const text = readFileSync(file, 'utf8')
    return CLIENT_FORBIDDEN.filter((rule) => rule.pattern.test(text)).map((rule) => ({
      relPath: `src/features/${feature}/commands.ts`,
      what: rule.what,
    }))
  })

  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders).toEqual([])
    })
  } else {
    it.each(offenders)('$relPath imports $what', ({ relPath, what }) => {
      throw new Error(
        `${relPath} imports ${what}. commands.ts is reached from the client palette, which wraps `
        + 'every authed page — importing the database there ships drizzle and the whole schema to '
        + 'the browser WITHOUT failing the build. Call a server action instead.',
      )
    })
  }
})

// --- Check 5b: nothing on the client may import the server plane ---------

/**
 * The mirror of check 5, from the other direction.
 *
 * registry/providers.ts and every search-providers.ts import the database on
 * purpose — they are the server plane. Nothing that ships to the browser may
 * import them. This is not hypothetical tidiness: CommandCenterProvider wraps
 * the whole (app) layout, so one value-import here puts drizzle, the Neon
 * driver and the 928-line schema in the first-load JS of every authed page,
 * and it does so WITHOUT failing the build. `import type` is fine — types are
 * erased under isolatedModules — so the check ignores type-only imports.
 */
describe('check 5b: no client file imports the server search plane', () => {
  const SRC_DIR = path.resolve(REPO_ROOT, 'src')

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full, out)
      else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
        && !entry.name.endsWith('.test.ts')
        && !entry.name.endsWith('.test.tsx')
        && !entry.name.endsWith('.d.ts')
      ) {
        out.push(full)
      }
    }
    return out
  }

  // A value import (not `import type`) of the provider plane.
  const SERVER_PLANE_RE =
    /import\s+(?!type\b)[^;]*from\s+'(?:@\/features\/[a-z-]+\/search-providers|(?:\.{1,2}\/)*registry\/providers|@\/features\/search\/registry\/providers)'/

  const offenders = walk(SRC_DIR)
    .map((absPath) => ({
      relPath: path.relative(REPO_ROOT, absPath).split(path.sep).join('/'),
      text: readFileSync(absPath, 'utf8'),
    }))
    .filter((file) => file.text.startsWith("'use client'") && SERVER_PLANE_RE.test(file.text))
    .map((file) => file.relPath)

  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders).toEqual([])
    })
  } else {
    it.each(offenders)('%s', (relPath) => {
      throw new Error(
        `${relPath} is a 'use client' module that imports the search provider plane. Those modules `
        + 'import @/db — importing one from the client ships drizzle, the Neon driver and the whole '
        + 'schema to the browser without failing the build. Call the universalSearch server action '
        + 'instead, or make the import `import type`.',
      )
    })
  }
})

// --- Check 6: identity --------------------------------------------------

describe('check 6: registry identity', () => {
  it('command ids are unique', () => {
    const ids = ALL_FEATURE_COMMANDS.map((command) => command.id)
    expect(ids).toEqual([...new Set(ids)])
  })

  it('every command id is namespaced by its feature', () => {
    // Not cosmetic: the id is the cmdk value, and cmdk treats the value as the
    // row's identity — two features both calling a row "profile" would
    // collapse into one selectable item.
    const unnamespaced = ALL_FEATURE_COMMANDS.map((c) => c.id).filter((id) => !id.includes('.'))
    expect(unnamespaced).toEqual([])
  })

  it('provider ids are unique and no two ranks tie', () => {
    const ids = ALL_PROVIDERS.map((provider) => provider.id)
    expect(ids).toEqual([...new Set(ids)])
    const ranks = ALL_PROVIDERS.map((provider) => provider.rank)
    expect(ranks).toEqual([...new Set(ranks)])
  })
})

// --- Check 7: allowlist hygiene ------------------------------------------

describe('check 7: allowlist hygiene', () => {
  it.each(Object.keys(NO_COMMANDS))('NO_COMMANDS entry %s still exists', (feature) => {
    expect(FEATURES).toContain(feature)
  })

  it.each(Object.keys(NO_SEARCH))('NO_SEARCH entry %s still exists', (feature) => {
    expect(FEATURES).toContain(feature)
  })

  it('a feature that gained a commands.ts is no longer exempt', () => {
    const stale = Object.keys(NO_COMMANDS).filter((feature) =>
      existsSync(path.join(FEATURES_DIR, feature, 'commands.ts')),
    )
    expect(stale).toEqual([])
  })

  it('a feature that gained a provider is no longer exempt', () => {
    const stale = Object.keys(NO_SEARCH).filter((feature) =>
      existsSync(path.join(FEATURES_DIR, feature, 'search-providers.ts')),
    )
    expect(stale).toEqual([])
  })
})

// --- A tripwire for the RBAC expansion -----------------------------------

/**
 * Both admin-gated palette rows — the /admin destination (navCommands in
 * ./commands.ts) and "New app" (features/apps/commands.ts) — go through
 * isAdminRole(), never a `role === 'admin'` comparison. That comparison
 * keeps COMPILING and keeps passing tests when the enum widens; it just goes
 * false for every new role, so a superadmin silently loses both rows from ⌘K
 * while holding both permissions on the server.
 *
 * This tripwire has already fired once, on the commit that widened user_role
 * from admin/member to seven roles — which is what caught those two gates.
 * It stays because the same thing happens on the next widening, and because
 * the behavioural assertions below cannot catch it: they pass a role literal,
 * so they stay green precisely while the highest-privilege seat is hidden.
 *
 * WHEN IT FAILS AGAIN: check every `visible` predicate and every nav gate in
 * the registry against the new role, then update this list. Never widen the
 * list alone to make it pass.
 */
type PaletteRole = PaletteContext['user']['role']
type RolesTheRegistryWasWrittenFor =
  | 'superadmin'
  | 'admin'
  | 'manager'
  | 'editor'
  | 'member'
  | 'stakeholder'
  | 'auditor'
type RoleUnionUnchanged = [PaletteRole] extends [RolesTheRegistryWasWrittenFor]
  ? [RolesTheRegistryWasWrittenFor] extends [PaletteRole]
    ? true
    : false
  : false
const ROLE_UNION_UNCHANGED: RoleUnionUnchanged = true

describe('rbac tripwire', () => {
  it('the role union is still the one the palette gates were written for', () => {
    expect(ROLE_UNION_UNCHANGED).toBe(true)
  })
})

// --- What the registry resolves to ---------------------------------------

describe('paletteCommands', () => {
  it('a member sees neither the admin destination nor admin-only rows', () => {
    const hrefs = paletteCommands(ctx('member')).map((command) => command.href)
    expect(hrefs).not.toContain('/admin')
    expect(hrefs).not.toContain('/apps?new=1')
  })

  it('an admin sees both', () => {
    const hrefs = paletteCommands(ctx('admin')).map((command) => command.href)
    expect(hrefs).toContain('/admin')
    expect(hrefs).toContain('/apps?new=1')
  })

  it('a superadmin sees both, not fewer than an admin', () => {
    // The regression the widened enum caused everywhere else in the app: a
    // `role === 'admin'` gate is false for superadmin, so the highest-
    // privilege seat quietly gets the smallest palette.
    const hrefs = paletteCommands(ctx('superadmin')).map((command) => command.href)
    expect(hrefs).toContain('/admin')
    expect(hrefs).toContain('/apps?new=1')
  })

  it('a role between the two extremes still sees neither', () => {
    // isAdminRole is staff-only, not a ladder — an editor may edit plenty and
    // still must not be offered the admin console.
    const hrefs = paletteCommands(ctx('editor')).map((command) => command.href)
    expect(hrefs).not.toContain('/admin')
    expect(hrefs).not.toContain('/apps?new=1')
  })

  it('prints a jump chip only while the jumps are switched on', () => {
    const on = paletteCommands({ ...ctx(), goShortcutsOn: true })
    const off = paletteCommands({ ...ctx(), goShortcutsOn: false })
    expect(on.find((command) => command.href === '/worklog')?.shortcut).toBe('G W')
    expect(off.find((command) => command.href === '/worklog')?.shortcut).toBeUndefined()
  })

  it('offers every destination the sidebar does, Work log included', () => {
    // The drift this registry exists to end: the sidebar advertised a Work log
    // jump the palette had never heard of, and never listed Settings at all.
    const hrefs = paletteCommands(ctx()).map((command) => command.href)
    expect(hrefs).toContain('/worklog')
    expect(hrefs).toContain('/settings')
  })

  it('hides the theme you are already using', () => {
    const labels = paletteCommands({ ...ctx(), theme: 'dark' }).map((command) => command.label)
    expect(labels).toContain('Theme: light')
    expect(labels).not.toContain('Theme: dark')
  })

  it('names the state the shortcuts row will leave you in', () => {
    const whenOn = paletteCommands({ ...ctx(), goShortcutsOn: true })
      .map((command) => command.label)
      .find((label) => label.includes('go-to shortcuts'))
    const whenOff = paletteCommands({ ...ctx(), goShortcutsOn: false })
      .map((command) => command.label)
      .find((label) => label.includes('go-to shortcuts'))
    expect(whenOn).toContain('Turn off')
    expect(whenOff).toContain('Turn on')
  })

  it('matches on keywords the label does not contain', () => {
    // "log out" is nobody's label. It used to work only because sign-out
    // matched against a fused 'sign out log out' haystack.
    const ids = paletteCommands(ctx(), 'log out').map((command) => command.id)
    expect(ids).toContain('auth.sign-out')
  })

  it('no longer matches a query that only spans a haystack seam', () => {
    // 'sign out log out'.includes('out l') was true, so typing "out l" used to
    // surface Sign out. One label-or-keyword rule ends that.
    expect(paletteCommands(ctx(), 'out l').map((command) => command.id)).toEqual([])
  })

  it('groups create above destinations above commands', () => {
    const groups = paletteCommands(ctx('admin')).map((command) => command.group)
    expect(groups.lastIndexOf('create')).toBeLessThan(groups.indexOf('navigate'))
    expect(groups.indexOf('navigate')).toBeLessThan(groups.indexOf('command'))
  })
})
