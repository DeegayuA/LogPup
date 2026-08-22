import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { priceForModel } from './pricing'
import { FALLBACK_MODEL_CHOICES } from './ai-features'
import {
  ANALYSIS_MODELS,
  ASSISTANT_MODELS,
  LIVE_MODEL_FALLBACK_ORDER,
  QUICK_MODELS,
  SYNTHESIS_MODELS,
  TTS_MODEL_FALLBACK_ORDER,
} from './models'

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

// ---------------------------------------------------------------------------
// TWO BACKSTOPS, and what they are NOT.
//
// Neither of these is what makes the page correct. hero-showcase.tsx derives
// its rate fields from priceForModel, so it CANNOT currently disagree with
// pricing.ts — the fix removed the class. These exist to stop it coming back:
// the next person to paste a rate as a literal, and the next person to add a
// promotional row without its successor.
//
// WHAT THEY CANNOT DO, in the same register as the guard above:
//   - Prose is invisible to both. "$0.75 per million" written inside a
//     sentence is the identical lie in a form nothing here sees; only numeric
//     struct fields sitting beside a model id are checked. A green suite means
//     "no hardcoded rate FIELD disagrees", never "every price on the site is
//     right".
//   - Neither knows whether Google changed a rate underneath pricing.ts. They
//     enforce internal agreement, not external truth.
// ---------------------------------------------------------------------------

type RateHit = { model: string; field: string; value: number; relPath: string }

/**
 * Pure so it can be shown to WORK. After the derivation there are no hardcoded
 * rates left in the public pages, so the suite below has nothing to find and
 * would pass identically if this function always returned []. That is the
 * vacuous pass this file's own header warns about, and the only cure is a
 * positive control: feed it a fixture containing a wrong rate and prove it
 * comes back.
 */
export function ratesInText(text: string, relPath: string): RateHit[] {
  const found: RateHit[] = []
  const ids = [...text.matchAll(/id:\s*'(gemini-\d[a-z0-9.-]*)'/g)]
  ids.forEach((idMatch, i) => {
    const from = idMatch.index ?? 0
    const to = i + 1 < ids.length ? (ids[i + 1].index ?? text.length) : text.length
    const block = text.slice(from, to)
    for (const field of ['inputCostPer1M', 'outputCostPer1M'] as const) {
      const m = block.match(new RegExp(`${field}:\\s*([\\d.]+)`))
      if (m) found.push({ model: idMatch[1], field, value: Number(m[1]), relPath })
    }
  })
  return found
}

/** Numeric rate fields written beside a model id in a public page. */
function hardcodedRates(): RateHit[] {
  const found: RateHit[] = []

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

      // Each `id: 'gemini-…'` owns the text up to the next one — near enough
      // to "the same object literal" for a static scan, and it errs toward
      // reading MORE text rather than less, so a rate cannot hide by sitting
      // a few lines further down than expected.
      found.push(
        ...ratesInText(
          readFileSync(full, 'utf8'),
          path.relative(REPO_ROOT, full).split(path.sep).join('/'),
        ),
      )
    }
  }

  walk(PUBLIC_DIR)
  return found
}

describe('a rate hardcoded on a public page equals the rate the app bills', () => {
  const now = new Date()
  const wrong = hardcodedRates().filter(({ model, field, value }) => {
    const price = priceForModel(model, now)
    if (!price) return false // already reported by the guard above; not double-counted
    const expected = field === 'inputCostPer1M' ? price.inputPer1M : price.outputPer1M
    return value !== expected
  })

  if (wrong.length === 0) {
    it('no hardcoded rate disagrees with pricing.ts', () => {
      expect(wrong).toEqual([])
    })
  } else {
    it.each(wrong)('$relPath states $model $field as $value', ({ model, field, value, relPath }) => {
      throw new Error(
        `${relPath} hardcodes ${field}: ${value} for "${model}", which is not what `
        + 'src/features/gemini/pricing.ts charges for it today. A rate written by hand is a '
        + 'second copy of a number that already exists, and it goes stale silently — promotional '
        + 'rows expire. Derive it from priceForModel instead of correcting the literal.',
      )
    })
  }
})

describe('a promotional rate has a successor, so no model expires into "price unknown"', () => {
  // Tested through priceForModel rather than by reaching into PRICE_TABLE: the
  // consequence is what matters. A promo row with no successor makes the model
  // unpriceable the day it expires, and an unpriceable model silently becomes
  // "price unknown" in Settings, on the dashboard, and in the usage ledger's
  // value column — everywhere at once, for a model still being called.
  //
  // Date-independent by construction: it asks whether a model priceable NOW is
  // still priceable far past any plausible promo window, so it is green today
  // and green forever unless someone introduces the gap.
  const FAR_FUTURE = new Date('2099-01-01')

  const known = [
    ...new Set([
      ...Object.values(FALLBACK_MODEL_CHOICES).flatMap((choices) => choices.map((c) => c.id)),
      ...ANALYSIS_MODELS,
      ...ASSISTANT_MODELS,
      ...QUICK_MODELS,
      ...SYNTHESIS_MODELS,
      ...TTS_MODEL_FALLBACK_ORDER,
      ...LIVE_MODEL_FALLBACK_ORDER,
    ]),
  ]

  const expiring = known.filter(
    (model) =>
      priceForModel(model, new Date()) !== null && priceForModel(model, FAR_FUTURE) === null,
  )

  if (expiring.length === 0) {
    it('no priced model becomes unpriceable later', () => {
      expect(expiring).toEqual([])
    })
  } else {
    it.each(expiring)('%s is priced today but not in the future', (model) => {
      throw new Error(
        `"${model}" has a price today but none at ${FAR_FUTURE.toISOString().slice(0, 10)}. That `
        + 'means a PRICE_TABLE row carries an `until` with no successor row after it, so on the '
        + 'expiry date the model silently becomes "price unknown" in Settings, on the dashboard, '
        + 'and in the usage ledger — while still being called. Add the post-promo row.',
      )
    })
  }

  it('the model list is non-empty, so this cannot pass by checking nothing', () => {
    expect(known.length).toBeGreaterThan(0)
  })
})

describe('the two backstops can actually detect what they claim to', () => {
  // Positive control for the scanner. Without this, both suites above pass on
  // an empty result set and nobody would learn that the regex had rotted —
  // a green suite reporting safety it never checked.
  it('finds a rate field written beside a model id', () => {
    const fixture = `
      { id: 'gemini-3.7-flash', label: 'x', inputCostPer1M: 9.99, outputCostPer1M: 1.23 },
      { id: 'gemini-2.5-pro', label: 'y' },
    `
    expect(ratesInText(fixture, 'fixture.tsx')).toEqual([
      { model: 'gemini-3.7-flash', field: 'inputCostPer1M', value: 9.99, relPath: 'fixture.tsx' },
      { model: 'gemini-3.7-flash', field: 'outputCostPer1M', value: 1.23, relPath: 'fixture.tsx' },
    ])
  })

  it('does not attribute one model\'s rate to the next model in the list', () => {
    const fixture = `{ id: 'gemini-2.5-pro' }, { id: 'gemini-3.6-flash', inputCostPer1M: 5 }`
    expect(ratesInText(fixture, 'f.tsx').map((h) => h.model)).toEqual(['gemini-3.6-flash'])
  })

  // Positive control for the successor check: it must be reading the row AFTER
  // the promo, not merely finding any row. gemini-3.7-flash is promotional
  // today and its successor is the doubled rate, so the two lookups must differ
  // AND the later one must exist.
  it('reads the post-promo row rather than the promo row', () => {
    const today = priceForModel('gemini-3.7-flash', new Date('2026-08-20'))
    const later = priceForModel('gemini-3.7-flash', new Date('2099-01-01'))
    expect(today).not.toBeNull()
    expect(later).not.toBeNull()
    expect(later).not.toEqual(today)
  })
})
