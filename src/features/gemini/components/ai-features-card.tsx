import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AI_FEATURES } from '@/features/gemini/ai-features'
import { getAiPrefs } from '@/features/gemini/prefs'
import { estimateCostUsd, formatUsd } from '@/features/gemini/pricing'
import { aggregateAiUsage, listGeminiKeys } from '@/features/gemini/queries'
import { summarizeUsage, totalsFor } from '@/features/gemini/usage-summary'
import { AiFeatureToggle } from '@/features/gemini/components/ai-feature-toggle'

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000

// The Live socket runs browser-side, so the server never sees real token
// counts for it — every figure logged for this feature is the same fixed
// estimate the ledger writes at session end (session-budget.ts), not a
// measurement. Anywhere this feature's usage appears it must say so.
const ESTIMATED_USAGE_FEATURE_ID = 'live-captions'

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
          what the tokens would cost on Google&rsquo;s paid tier. Free keys are charged $0.
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
            <dt className="text-xs text-muted-foreground">Charged</dt>
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
            const perUse = estimateCostUsd({ ...f.estimate.tokens, at: now })
            const isEstimatedFeature = f.id === ESTIMATED_USAGE_FEATURE_ID
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground">{f.description}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {f.chain} · {f.estimate.tokens.model} ·{' '}
                    {f.estimate.tokens.inputTokens.toLocaleString('en-US')} in /{' '}
                    {f.estimate.tokens.outputTokens.toLocaleString('en-US')} out ·{' '}
                    {perUse !== null
                      ? `${formatUsd(perUse)} ${f.estimate.label}`
                      : 'price unknown'}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {used
                      ? `30d: ${used.calls} call${used.calls === 1 ? '' : 's'} · ${used.tokens.toLocaleString('en-US')} tokens · ${formatUsd(used.valueUsd)} value${isEstimatedFeature ? ' (estimated, not measured)' : ''}`
                      : '30d: not used'}
                  </span>
                </div>
                <AiFeatureToggle feature={f.id} label={f.label} enabled={prefs[f.id]} />
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
