// Official Gemini API paid-tier prices, USD per 1M tokens, verified
// 2026-08-19 against ai.google.dev/gemini-api/docs/pricing. These convert
// LOGGED tokens into an INDICATIVE dollar value ("what this would cost on
// the paid tier") at read time — fixing a price here re-prices history.
// Free-tier keys are charged $0 regardless; every figure derived from this
// table is shown with a ≈ prefix. Unknown model → null, never a guess.

export type ModelPrice = { inputPer1M: number; outputPer1M: number }

type PriceRow = ModelPrice & {
  // Promo window: this row applies strictly before `until`; the row that
  // follows (same model, no `until`) applies after. Ordered first-match.
  until?: string // ISO date, exclusive
}

const PRICE_TABLE: Record<string, PriceRow[]> = {
  'gemini-3.7-flash': [
    { inputPer1M: 0.75, outputPer1M: 3.75, until: '2027-01-01' },
    { inputPer1M: 1.5, outputPer1M: 7.5 },
  ],
  'gemini-3.6-flash': [
    { inputPer1M: 0.75, outputPer1M: 3.75, until: '2027-01-01' },
    { inputPer1M: 1.5, outputPer1M: 7.5 },
  ],
  // The moving alias resolves to a current flash model — priced like the
  // pinned default so alias-served calls don't show "price unknown".
  'gemini-flash-latest': [
    { inputPer1M: 0.75, outputPer1M: 3.75, until: '2027-01-01' },
    { inputPer1M: 1.5, outputPer1M: 7.5 },
  ],
  'gemini-3.5-flash': [{ inputPer1M: 1.5, outputPer1M: 9.0 }],
  'gemini-3.5-flash-lite': [{ inputPer1M: 0.3, outputPer1M: 2.5 }],
  'gemini-3.1-pro-preview': [{ inputPer1M: 1.25, outputPer1M: 10.0 }],
  'gemini-2.5-flash': [{ inputPer1M: 0.3, outputPer1M: 2.5 }],
  'gemini-2.5-flash-lite': [{ inputPer1M: 0.1, outputPer1M: 0.4 }],
  'gemini-2.5-pro': [{ inputPer1M: 1.25, outputPer1M: 10.0 }],
  // TTS: text in, audio out.
  'gemini-3.1-flash-tts-preview': [{ inputPer1M: 1.0, outputPer1M: 20.0 }],
  'gemini-2.5-flash-preview-tts': [{ inputPer1M: 1.0, outputPer1M: 20.0 }],
  // Live API audio (browser-direct; tokens are ESTIMATED, see live-token.ts).
  'gemini-3.1-flash-live-preview': [{ inputPer1M: 3.0, outputPer1M: 12.0 }],
  'gemini-2.5-flash-native-audio-preview-12-2025': [{ inputPer1M: 3.0, outputPer1M: 12.0 }],
}

/**
 * Deliberately absent from PRICE_TABLE, even though MODEL_CHOICES
 * (ai-features.ts) offers them as selectable models: no published figure
 * covers BOTH input and output for these ids, so priceForModel legitimately
 * returns null and the UI shows "price unknown" rather than a guess.
 *   - gemini-3.1-flash-lite — no published rate found for either direction.
 *   - gemini-2.5-pro-preview-tts — paid-tier only; no published rate found.
 *   - gemini-3.5-live-translate-preview — only audio-input is published
 *     ($3.50/1M, per docs/superpowers/specs/2026-08-11-gemini-live-streaming
 *     -design.md §1.3); no published output rate, so adding a row would mean
 *     inventing half of it.
 * Add a row here the moment a real published figure exists — don't infer one
 * from a sibling model's ratio.
 *
 * gemini-omni-flash and gemini-3-flash-preview used to be here too, but were
 * removed from MODEL_CHOICES entirely (see the comment there): "price
 * unknown" is an honest state for a model whose failure modes are known,
 * but these two also lacked the 404-fallback safety net resolveChain relies
 * on, so unpriced was not the real problem with offering them.
 */

export function priceForModel(model: string, at: Date): ModelPrice | null {
  const rows = PRICE_TABLE[model]
  if (!rows) return null
  for (const row of rows) {
    if (!row.until || at < new Date(row.until)) {
      return { inputPer1M: row.inputPer1M, outputPer1M: row.outputPer1M }
    }
  }
  return null
}

export function estimateCostUsd(args: {
  model: string
  inputTokens: number
  outputTokens: number
  at: Date
}): number | null {
  const price = priceForModel(args.model, args.at)
  if (!price) return null
  return (
    (args.inputTokens / 1_000_000) * price.inputPer1M +
    (args.outputTokens / 1_000_000) * price.outputPer1M
  )
}

/**
 * Every dollar figure LogPup shows is derived (tokens × list price), never
 * a bill — the ≈ prefix is part of the format, not optional decoration.
 * Sub-cent amounts keep four decimals so "≈$0.0023" doesn't collapse to a
 * misleading "≈$0.00" for a real, nonzero cost.
 */
export function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return `≈$${value.toFixed(4)}`
  return `≈$${value.toFixed(2)}`
}
