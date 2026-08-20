import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AI_FEATURES,
  MODEL_CHOICES,
  estimatePerUseCostUsd,
  type AiFeatureEstimate,
  type FeatureKind,
} from '@/features/gemini/ai-features'
import { isFeatureRouted } from '@/features/gemini/model-choice'
import { getAiPrefs } from '@/features/gemini/prefs'
import { formatUsd } from '@/features/gemini/pricing'
import { aggregateAiUsage, listGeminiKeys } from '@/features/gemini/queries'
import {
  summarizeUsage,
  totalsFor,
  type FeatureUsageSummary,
} from '@/features/gemini/usage-summary'
import { AiFeatureToggle } from '@/features/gemini/components/ai-feature-toggle'
import {
  AiModelSelect,
  type ModelSuggestion,
} from '@/features/gemini/components/ai-model-select'

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000

// The Live socket runs browser-side, so the server never sees real token
// counts for it — every figure logged for this feature is the same fixed
// estimate the ledger writes at session end (session-budget.ts), not a
// measurement. Anywhere this feature's usage appears it must say so.
const ESTIMATED_USAGE_FEATURE_ID = 'live-captions'

/**
 * The per-feature 30-day line. Successful calls lead; blocked attempts and
 * calls on a model with no published price are appended as their own clauses
 * rather than folded in — a feature that only ever failed must read as "not
 * used", never as usage, and an unknown price must never read as $0.00.
 */
function describeUsage(
  used: FeatureUsageSummary | undefined,
  isEstimatedFeature: boolean,
): string {
  if (!used || (used.calls === 0 && used.failedCalls === 0)) return '30d: not used'
  const parts: string[] = []
  if (used.calls === 0) {
    parts.push('30d: not used')
  } else {
    const estimated = isEstimatedFeature ? ' (estimated, not measured)' : ''
    parts.push(
      `30d: ${used.calls} call${used.calls === 1 ? '' : 's'} · ${used.tokens.toLocaleString('en-US')} tokens · ${formatUsd(used.valueUsd)} value${estimated}`,
    )
  }
  if (used.unpricedCalls > 0) parts.push(`${used.unpricedCalls} unpriced`)
  if (used.failedCalls > 0) parts.push(`${used.failedCalls} failed`)
  return parts.join(' · ')
}

/**
 * "Cheapest model for how you actually use this feature" — no LLM involved,
 * just priceForModel (via estimatePerUseCostUsd) over the same registry token
 * shape the row already prices. Suggested only when:
 *
 *   - the user really used the feature in the window (calls > 0) — a
 *     suggestion for a feature they never touch is noise;
 *   - the candidate is `stable` (suggesting a preview model Google can
 *     retire on two weeks' notice is not a favor) and reachable on their
 *     keys (freeTier, unless a paid key is active);
 *   - it is STRICTLY cheaper than what their current choice costs per use.
 *
 * Unpriced models are skipped, never guessed at — priceForModel's contract.
 * The dollar hint is formatted HERE with formatUsd so the ≈ prefix survives.
 */
function suggestModelFor(
  kind: FeatureKind,
  estimate: AiFeatureEstimate,
  chosenModel: string | null,
  used: FeatureUsageSummary | undefined,
  hasPaidKey: boolean,
  now: Date,
): ModelSuggestion | null {
  if (!used || used.calls === 0) return null
  const currentCost = estimatePerUseCostUsd(estimate, chosenModel, now)
  if (currentCost === null) return null
  let best: { id: string; label: string; cost: number } | null = null
  for (const c of MODEL_CHOICES[kind]) {
    if (c.stability !== 'stable') continue
    if (!c.freeTier && !hasPaidKey) continue
    if (c.id === chosenModel) continue
    const cost = estimatePerUseCostUsd(estimate, c.id, now)
    if (cost === null) continue
    if (cost < currentCost && (best === null || cost < best.cost)) {
      best = { id: c.id, label: c.label, cost }
    }
  }
  if (!best) return null
  return { id: best.id, label: best.label, hint: `${formatUsd(best.cost)} ${estimate.label}` }
}

export async function AiFeaturesCard({ userId }: { userId: string }) {
  const now = new Date()
  const since = new Date(now.getTime() - WINDOW_MS)
  const [prefs, aggRows, keys] = await Promise.all([
    getAiPrefs(userId),
    aggregateAiUsage(userId, since),
    listGeminiKeys(userId),
  ])
  const summaries = summarizeUsage(aggRows, now)
  const totals = totalsFor(summaries)
  const bySummary = new Map(summaries.map((s) => [s.featureId, s]))
  const sharedByMe = keys.filter((k) => k.shared).length
  // Whether this user could actually serve a call to a paid-only model
  // (gemini-2.5-pro-preview-tts) right now — the picker warns inline rather
  // than let the choice be silently ignored on every call later.
  //
  // `active` is part of the question, not a detail: rotation only ever picks
  // up active keys (client.ts), so a PAUSED paid key cannot serve the choice
  // and must still raise the warning — that user's calls really do fall back,
  // which is exactly the case the warning exists for.
  //
  // OWN keys only, deliberately. The pool a call can reach also includes a
  // teammate's active+shared key, so someone leaning on a shared PAID key is
  // warned when they need not be. That is accepted rather than overlooked:
  // listGeminiKeys is own-keys-only by design (queries.ts), and
  // listPoolKeyHealth — the one sanctioned view of the pool — selects no
  // `tier` column, so there is no honest way to ask the pool this question
  // today. Over-warning is the safe direction now that the warning says the
  // choice may be ignored rather than that the feature breaks.
  const hasPaidKey = keys.some((k) => k.active && k.tier === 'paid')
  const liveUsage = bySummary.get(ESTIMATED_USAGE_FEATURE_ID)
  const totalsIncludeEstimate = !!liveUsage && liveUsage.calls > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 font-heading">
          <Sparkles className="size-4" aria-hidden /> AI features
        </CardTitle>
        <CardDescription>
          Everything AI does here runs on your Gemini keys. Each switch covers one feature only —
          turning off drafting leaves dictation and read-aloud on. Dollar figures are indicative —
          what the tokens would cost on Google&rsquo;s paid tier. Free keys are charged $0, and only
          your own paid keys can charge you: work that falls through to a teammate&rsquo;s shared key
          lands on their bill, not yours.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Last 30 days</dt>
            <dd className="font-mono tabular-nums">{totals.calls} calls</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tokens</dt>
            <dd className="font-mono tabular-nums">{totals.tokens.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Value used</dt>
            <dd className="font-mono tabular-nums">{formatUsd(totals.valueUsd)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Charged (your paid keys)</dt>
            <dd className="font-mono tabular-nums">
              {totals.paidChargeUsd > 0 ? formatUsd(totals.paidChargeUsd) : '$0.00'}
            </dd>
          </div>
        </dl>
        {/* One footnote block, not four floating paragraphs: the conditional
            caveats and the always-on disclosures share a bordered group so
            they read as the fine print of the numbers above, and each keeps
            its own line. Copy unchanged — every sentence here is load-bearing
            (estimated Live tokens, unknown ≠ zero, blocked ≠ spent, and the
            shared-key data-custody disclosure). */}
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          {totalsIncludeEstimate ? (
            <p className="text-xs text-muted-foreground">
              Includes {liveUsage.calls} live-caption call{liveUsage.calls === 1 ? '' : 's'} — Live
              runs in your browser, so those tokens are an estimate, not a measurement.
            </p>
          ) : null}
          {totals.unpricedCalls > 0 ? (
            <p className="text-xs text-muted-foreground">
              Value and charge cover priced calls only — {totals.unpricedCalls} call
              {totals.unpricedCalls === 1 ? '' : 's'} ran on a model with no published price, so
              their cost is unknown rather than zero.
            </p>
          ) : null}
          {totals.failedCalls > 0 ? (
            <p className="text-xs text-muted-foreground">
              {totals.failedCalls} request{totals.failedCalls === 1 ? '' : 's'} never ran — blocked
              before reaching Google, usually because no key was available. Nothing was spent on
              {totals.failedCalls === 1 ? ' it' : ' them'}, so {totals.failedCalls === 1 ? 'it is' : 'they are'} not counted above.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {keys.length} key{keys.length === 1 ? '' : 's'} saved
            {sharedByMe > 0 ? ` · ${sharedByMe} shared with the org` : ''}.
          </p>
          <p className="text-xs text-muted-foreground">
            When your own keys run out, your requests — including meeting audio and screen
            keyframes — run on a teammate&rsquo;s org-shared key and are processed under that
            teammate&rsquo;s Google Cloud project, which retains uploads via Gemini&rsquo;s Files
            API for about 48 hours.
          </p>
        </div>
        <ul className="flex flex-col divide-y">
          {AI_FEATURES.map((f) => {
            const used = bySummary.get(f.id)
            const chosenModel = prefs[f.id].model
            // The token SHAPE (a representative use of this feature) stays
            // fixed from the registry; only the MODEL priced against it
            // swaps to whatever the user chose, so the card never quotes one
            // model's rate beside another model's token counts.
            //
            // Where a choice governs only part of the feature the registry
            // says so (estimate.chosenModelApplies) and only that part
            // reprices — for meeting intelligence, the synthesis pass alone,
            // which is precisely what the footnote below promises. Pricing
            // the whole shape at the chosen rate would print a number that
            // footnote contradicts. The annotation is what lets this read the
            // optional field off a union of const entries.
            const estimate: AiFeatureEstimate = f.estimate
            const splitReprice = chosenModel !== null && estimate.chosenModelApplies !== undefined
            const perUseModel = chosenModel ?? estimate.tokens.model
            // A feature can be registered in AI_FEATURES without an entry in
            // DEFAULT_CHAIN — it has happened, and several sessions add
            // features here. Such a feature reaches no model and throws on
            // first use. The per-use estimate would NOT notice: it prices the
            // registry's static token shape, which is independent of the
            // chain, so an unroutable feature would otherwise render a
            // confident "≈$0.0028 per draft" beside a working-looking switch.
            // The price is knowable; the model is not; quoting the first while
            // the second is missing is the lie worth preventing.
            const routed = isFeatureRouted(f.id)
            const perUse = routed ? estimatePerUseCostUsd(estimate, chosenModel, now) : null
            const isEstimatedFeature = f.id === ESTIMATED_USAGE_FEATURE_ID
            // Gated on `routed` as well as usage: a feature that HAD calls and
            // then lost its chain entry would otherwise be offered a cheaper
            // model for something that cannot run at all. Narrow — a chain gap
            // is usually a brand-new feature with no history — but the ordering
            // is not guaranteed, and the suggestion points at the wrong lever.
            const suggestion = routed
              ? suggestModelFor(f.kind, estimate, chosenModel, used, hasPaidKey, now)
              : null
            return (
              <li key={f.id} className="flex flex-col gap-2 py-3">
                {/* The switch sits beside the feature's name — the one
                    actionable control no longer queues behind three mono
                    metadata lines. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.description}</span>
                  </div>
                  <AiFeatureToggle feature={f.id} label={f.label} enabled={prefs[f.id].enabled} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {/* The chain NAME stays when unrouted — it is the registry
                        declaring intent, so "Synthesis · not routed" reads as
                        "should be wired to the synthesis chain, isn't". The
                        model ID does not stay: it comes from the pref or the
                        registry estimate, both independent of the chain, so it
                        would name a model on the same line that says the
                        feature reaches none. */}
                    {f.chain} ·{' '}
                    {routed ? (
                      <>
                        {splitReprice
                          ? `${estimate.tokens.model} + ${perUseModel}`
                          : perUseModel}{' '}
                        ·{' '}
                      </>
                    ) : null}
                    {estimate.tokens.inputTokens.toLocaleString('en-US')} in /{' '}
                    {estimate.tokens.outputTokens.toLocaleString('en-US')} out ·{' '}
                    {!routed
                      ? 'not routed — reaches no model, so it cannot run'
                      : perUse !== null
                        ? `${formatUsd(perUse)} ${estimate.label}`
                        : 'price unknown'}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {describeUsage(used, isEstimatedFeature)}
                  </span>
                </div>
                {f.id === 'meeting-intel' ? (
                  <span className="text-xs text-muted-foreground">
                    Model choice applies to the whole-meeting write-up only — per-segment
                    transcription and follow-up resolution always run on the default flash
                    chain, so an hour of segment calls isn&rsquo;t repriced along with it, and
                    the figure above prices only the write-up on your chosen model.
                  </span>
                ) : null}
                <AiModelSelect
                  feature={f.id}
                  label={f.label}
                  kind={f.kind}
                  model={chosenModel}
                  // `&& routed`: a select SOLICITS action in a way a static
                  // badge does not. An unrouted row that says "cannot run" and
                  // then offers a live dropdown invites someone to try three
                  // models looking for the one that fixes it — none of them
                  // can, because the gap is wiring, not choice. Disabled is
                  // the honest affordance.
                  enabled={prefs[f.id].enabled && routed}
                  hasPaidKey={hasPaidKey}
                  suggestion={suggestion}
                />
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
