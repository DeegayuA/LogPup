import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AI_FEATURES } from '@/features/gemini/ai-features'
import { getAiPrefs } from '@/features/gemini/prefs'
import { estimateCostUsd, formatUsd } from '@/features/gemini/pricing'
import { aggregateAiUsage, listGeminiKeys } from '@/features/gemini/queries'
import {
  summarizeUsage,
  totalsFor,
  type FeatureUsageSummary,
} from '@/features/gemini/usage-summary'
import { AiFeatureToggle } from '@/features/gemini/components/ai-feature-toggle'
import { AiModelSelect } from '@/features/gemini/components/ai-model-select'

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
  // than let the choice fail as an undiagnosable 401/403 later.
  const hasPaidKey = keys.some((k) => k.tier === 'paid')
  const liveUsage = bySummary.get(ESTIMATED_USAGE_FEATURE_ID)
  const totalsIncludeEstimate = !!liveUsage && liveUsage.calls > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
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
        <ul className="flex flex-col divide-y">
          {AI_FEATURES.map((f) => {
            const used = bySummary.get(f.id)
            const chosenModel = prefs[f.id].model
            // The token SHAPE (a representative call for this feature) stays
            // fixed from the registry; only the MODEL priced against it
            // swaps to whatever the user chose, so the card never quotes one
            // model's rate beside another model's token counts.
            const perUseModel = chosenModel ?? f.estimate.tokens.model
            const perUse = estimateCostUsd({ ...f.estimate.tokens, model: perUseModel, at: now })
            const isEstimatedFeature = f.id === ESTIMATED_USAGE_FEATURE_ID
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground">{f.description}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {f.chain} · {perUseModel} ·{' '}
                    {f.estimate.tokens.inputTokens.toLocaleString('en-US')} in /{' '}
                    {f.estimate.tokens.outputTokens.toLocaleString('en-US')} out ·{' '}
                    {perUse !== null
                      ? `${formatUsd(perUse)} ${f.estimate.label}`
                      : 'price unknown'}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {describeUsage(used, isEstimatedFeature)}
                  </span>
                  {f.id === 'meeting-intel' ? (
                    <span className="text-xs text-muted-foreground">
                      Model choice applies to the whole-meeting write-up only — per-segment
                      transcription and follow-up resolution always run on the default flash
                      chain, so an hour of segment calls isn&rsquo;t repriced along with it.
                    </span>
                  ) : null}
                </div>
                <AiModelSelect
                  feature={f.id}
                  label={f.label}
                  kind={f.kind}
                  model={chosenModel}
                  enabled={prefs[f.id].enabled}
                  hasPaidKey={hasPaidKey}
                />
                <AiFeatureToggle feature={f.id} label={f.label} enabled={prefs[f.id].enabled} />
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
