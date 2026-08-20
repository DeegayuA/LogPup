import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatUsd } from '@/features/gemini/pricing'
import type { RecordingReadiness } from '@/features/gemini/readiness'
import {
  formatRate,
  formatTokenCount,
  type AiEngineRow,
  type AiEngineTotals,
  type ModelStability,
} from '@/features/dashboard/ai-engine'

/**
 * WHAT THIS CARD IS FOR, and what it deliberately is not.
 *
 * Settings → AI features is where you CHANGE any of this; every switch and
 * picker lives there and none of them are repeated here. This card answers a
 * different question, the one you have while looking at a dashboard: what is
 * my AI actually wired to right now, and what did it cost me?
 *
 * So every column is a fact with a source — the model comes from the chain the
 * next call would really walk, the rate is Google's published list price, the
 * counts are this person's own ledger. Nothing is a placeholder and nothing is
 * a projection. The one number that is neither measured nor published (a rate
 * for a model Google never listed) is printed as "price unknown", because the
 * failure mode this card must never have is a made-up figure sitting in a
 * mono, tabular column that reads like a receipt.
 */

const STABILITY_NOTE: Record<ModelStability, string | null> = {
  stable: null,
  preview: 'Preview',
  alias: 'Alias',
  unlisted: 'Unlisted',
}

const STABILITY_HINT: Record<ModelStability, string | undefined> = {
  stable: undefined,
  preview: 'A preview model. Google can retire it on about two weeks’ notice; calls then fall through to the next model in the chain.',
  alias: 'A moving alias. It hot-swaps to whatever Google currently calls the latest flash checkpoint.',
  unlisted: 'Not offered in the per-feature picker — this is the chain’s own default.',
}

const READINESS_TONE: Record<RecordingReadiness['level'], string> = {
  ready: 'border-primary/40 bg-primary/5 text-foreground',
  degraded: 'border-chart-1/50 bg-chart-1/5 text-foreground',
  blocked: 'border-destructive/50 bg-destructive/5 text-foreground',
}

/** The 30-day clause for one feature. Never collapses three states into one. */
function usageLine(row: AiEngineRow): { text: string; muted: boolean } {
  if (row.calls === 0 && row.failedCalls === 0) return { text: 'Not used in 30 days', muted: true }
  if (row.calls === 0) {
    return {
      text: `${row.failedCalls} blocked, none ran`,
      muted: true,
    }
  }
  const parts = [
    `${row.calls} call${row.calls === 1 ? '' : 's'}`,
    `${formatTokenCount(row.tokens)} tokens`,
  ]
  // Unknown price must not print as $0.00 — say which calls the figure covers.
  parts.push(row.unpricedCalls > 0 ? `${formatUsd(row.valueUsd)} priced` : formatUsd(row.valueUsd))
  if (row.failedCalls > 0) parts.push(`${row.failedCalls} blocked`)
  return { text: parts.join(' · '), muted: false }
}

export function AiEngineCard({
  rows,
  totals,
  readiness,
  windowDays,
}: {
  rows: AiEngineRow[]
  totals: AiEngineTotals
  readiness: RecordingReadiness
  windowDays: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3" className="flex items-center gap-2 font-heading">
          <Sparkles className="size-4 text-primary" aria-hidden /> AI engine
        </CardTitle>
        <CardDescription>
          Which Gemini model each feature would call next, Google&rsquo;s list price for it, and what
          your own last {windowDays} days came to. Dollar figures are indicative — tokens × list
          price, never a bill. Change any of it in{' '}
          <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
            Settings → AI features
          </Link>
          .
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Readiness first: a routing table is academic if no key can serve it. */}
        <div
          className={cn(
            'flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-xs',
            READINESS_TONE[readiness.level],
          )}
        >
          <p className="font-medium">{readiness.headline}</p>
          {readiness.advice ? (
            <p className="text-muted-foreground">{readiness.advice}</p>
          ) : null}
        </div>

        <ul className="flex flex-col divide-y divide-border">
          {rows.map((row) => {
            const rate = formatRate(row.price)
            const usage = usageLine(row)
            const stability = STABILITY_NOTE[row.stability]

            return (
              <li
                key={row.featureId}
                className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:gap-4"
              >
                {/* Feature */}
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        row.enabled ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {row.label}
                    </span>
                    <Badge variant="secondary" className="text-2xs font-mono">
                      {row.chain}
                    </Badge>
                    {row.enabled ? null : (
                      <Badge variant="outline" className="text-2xs">
                        Off
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xs text-muted-foreground">{row.description}</p>
                </div>

                {/* Model, rate, and what it did */}
                <div className="flex min-w-0 flex-col gap-1 sm:items-end sm:text-right">
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {row.modelLabel}
                    </span>
                    {stability ? (
                      <span
                        className="rounded border border-border px-1 py-px font-mono text-2xs text-muted-foreground"
                        title={STABILITY_HINT[row.stability]}
                      >
                        {stability}
                      </span>
                    ) : null}
                    {row.pinned ? (
                      <span
                        className="rounded border border-primary/40 bg-primary/10 px-1 py-px font-mono text-2xs text-primary"
                        title="You pinned this model in Settings. It is tried first, then the feature’s normal chain."
                      >
                        Pinned
                      </span>
                    ) : null}
                    {/* Suppressed when unrouted: "+0 fallbacks" beside "Not
                        routed" describes the depth of a chain that does not
                        exist, which reads as a chain of length one. */}
                    {row.model !== null ? (
                      <span
                        className="font-mono text-2xs text-muted-foreground"
                        title="Models tried after this one if it is retired, rejected, or out of quota."
                      >
                        +{row.fallbacks} fallback{row.fallbacks === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>

                  <p className="font-mono text-2xs text-muted-foreground">
                    {/* Three distinct states, never collapsed: a rate, a model
                        Google never priced, and a feature with no chain wired
                        to it at all. The last one is a bug report, not a price. */}
                    {row.model === null
                      ? 'No model chain is registered for this feature yet'
                      : (rate ?? 'Price unknown — Google publishes no rate for this model')}
                    {row.perUseUsd !== null ? (
                      <>
                        {' · '}
                        <span className="text-foreground/80">
                          {formatUsd(row.perUseUsd)} {row.perUseLabel}
                        </span>
                      </>
                    ) : null}
                  </p>

                  <p
                    className={cn(
                      'font-mono text-2xs tabular-nums',
                      usage.muted ? 'text-muted-foreground' : 'text-foreground/80',
                    )}
                  >
                    {usage.text}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            {totals.featuresUsed} of {totals.featuresTotal} AI features used in the last{' '}
            {windowDays} days · routed across {totals.modelsInUse} model
            {totals.modelsInUse === 1 ? '' : 's'}
            {totals.featuresOff > 0 ? ` · ${totals.featuresOff} switched off` : ''}.
          </p>
          {totals.previewFeatures > 0 ? (
            <p className="text-xs text-muted-foreground">
              {totals.previewFeatures} feature{totals.previewFeatures === 1 ? '' : 's'} lead on a
              preview model. Google can retire those on short notice; the call falls through to the
              next model in the chain rather than failing.
            </p>
          ) : null}
          {totals.unroutedFeatures > 0 ? (
            <p className="text-xs text-destructive">
              {totals.unroutedFeatures} feature{totals.unroutedFeatures === 1 ? ' is' : 's are'}{' '}
              registered with no model chain, so {totals.unroutedFeatures === 1 ? 'it' : 'they'}{' '}
              cannot run. That is a wiring gap, not a setting — nothing you change here fixes it.
            </p>
          ) : null}
          {totals.unpricedFeatures > 0 ? (
            <p className="text-xs text-muted-foreground">
              {totals.unpricedFeatures} serving model
              {totals.unpricedFeatures === 1 ? ' has' : 's have'} no published rate, so their cost is
              unknown rather than zero.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
