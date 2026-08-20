import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { priceForModel } from './pricing'

// ---------------------------------------------------------------------------
// The public pages advertise model names. This makes them keep their word.
//
// /home names specific Gemini models — in the sandbox's model picker, in the
// briefing's "compiled by" line, in the per-meeting rows. Every one of those
// is a CLAIM about what the product runs, hand-written into marketing copy
// that nothing connects to the model layer. Ship a new model, retire an old
// one, and the page goes on naming the retired one to the one visitor whose
// job is to check whether this app is what it says it is.
//
// That is the defect this codebase has shipped three times in different
// costumes: copy that outran its mechanism. A form that said "Saved" while
// nothing revalidated. A panel that claimed it re-read on every open while it
// fetched once per mount. A sample whose chip said "Due 14 Aug" under a
// sentence saying "before Thursday standup". Each passed review as "just
// copy" until somebody traced it.
//
// So: a model named on a public page must be one the app can actually price,
// and therefore actually call. When the lineup moves — and it moves every few
// months — this names the stale string and the file holding it, instead of
// the page quietly lying until someone notices.
//
// WHAT IT CANNOT DO: tell you a model is a good default, or that Google has
// not changed a rate underneath you. It enforces only that the public claim
// and the internal capability describe the same set. That is the half a test
// can hold; the rest is reading the release notes.
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '../../..')
const PUBLIC_DIR = path.join(REPO_ROOT, 'src/app/(public)')

/** Every model id spelled out in a public page, with the file that says it. */
function advertisedModels(): { model: string; relPath: string }[] {
  const found: { model: string; relPath: string }[] = []

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.name.endsWith('.tsx') && !entry.name.endsWith('.ts')) continue
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue

      const text = readFileSync(full, 'utf8')
      const relPath = path.relative(REPO_ROOT, full).split(path.sep).join('/')
      // Model IDS only — `gemini-3.6-flash`, never prose like "Gemini 3.6
      // Flash". A human-readable label is a brand name and may legitimately be
      // written loosely; an id is a claim about a specific callable model.
      //
      // The `\d` is load-bearing: a version digit always follows the prefix in
      // a real id, and without it this matched `gemini-api` in the privacy
      // policy — a link to Google's documentation, not a claim about what runs
      // here. Caught on this test's own first run, which is the argument for
      // running a new guard before trusting it.
      for (const match of text.matchAll(/gemini-\d[a-z0-9.-]*/g)) {
        found.push({ model: match[0], relPath })
      }
    }
  }

  walk(PUBLIC_DIR)
  return found
}

describe('models named on public pages are models the app can actually call', () => {
  const advertised = advertisedModels()

  // `priceForModel` is the narrowest honest test of "can we call this": the
  // pricing table is keyed by model id and is what the usage ledger charges
  // against, so a model missing from it cannot be billed and in practice is
  // not run. Asking the fallback lists instead would pass a model that is
  // listed but unpriced — the state that produces a zero-cost row in someone's
  // usage report.
  const offenders = advertised.filter(({ model }) => priceForModel(model, new Date()) === null)

  // An it.each over an empty list registers ZERO tests and vitest fails the
  // whole file with "No test found in suite" — exactly when the code is
  // correct. Same workaround as src/db/live.test.ts.
  if (offenders.length === 0) {
    it('no offenders', () => {
      expect(offenders).toEqual([])
    })
  } else {
    it.each(offenders)('$relPath advertises $model', ({ model, relPath }) => {
      throw new Error(
        `${relPath} names "${model}" on a public page, but src/features/gemini/pricing.ts has no `
        + 'rate for it — so the app cannot price it, cannot bill it, and in practice does not run '
        + 'it. Either add the model to pricing.ts (and to the relevant list in models.ts) because '
        + 'it is genuinely in use, or change the copy to name one that is. Do NOT add it to an '
        + 'ignore list: the entire point is that the page and the model layer agree.',
      )
    })
  }

  it('at least one model is advertised, so this cannot pass by finding nothing', () => {
    // Without this, deleting every model name from /home — or renaming the
    // public directory — turns the suite green while the check silently stops
    // checking. A guard that passes vacuously is worse than no guard, because
    // it reports safety.
    expect(advertised.length).toBeGreaterThan(0)
  })
})
