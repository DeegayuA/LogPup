'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Sparkles, TriangleAlert, Zap } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setAiFeatureModel } from '@/features/gemini/actions'
import { MODEL_CHOICES, type AiFeatureId, type FeatureKind } from '@/features/gemini/ai-features'
import { priceForModel } from '@/features/gemini/pricing'

const DEFAULT_VALUE = '__default__'

/** priceForModel's own contract, restated for a dropdown row: a real rate or
 *  "price unknown" — never a zero, never a guess derived from a sibling. */
function priceLabel(id: string): string {
  const price = priceForModel(id, new Date())
  if (!price) return 'price unknown'
  return `$${price.inputPer1M.toFixed(2)}/1M in / $${price.outputPer1M.toFixed(2)}/1M out`
}

/** A cheaper-than-current model the server computed from this user's own
 *  last-30d usage — see suggestModelFor in ai-features-card.tsx. `hint` is
 *  preformatted there (via formatUsd, keeping the ≈ contract) so this
 *  component never derives a dollar figure of its own. */
export type ModelSuggestion = {
  id: string
  label: string
  hint: string
}

/**
 * Per-row model picker beside the feature's on/off Switch. Options come from
 * MODEL_CHOICES[kind] — the curated list valid for this feature's endpoint —
 * plus a "Default (recommended)" entry mapping to `null`, which leaves the
 * feature on its own fallback chain (see resolveChain).
 */
export function AiModelSelect({
  feature,
  label,
  kind,
  model,
  enabled,
  hasPaidKey,
  suggestion = null,
}: {
  feature: AiFeatureId
  label: string
  kind: FeatureKind
  model: string | null
  enabled: boolean
  hasPaidKey: boolean
  suggestion?: ModelSuggestion | null
}) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(model ?? DEFAULT_VALUE)

  const choices = MODEL_CHOICES[kind]
  const labels: Record<string, string> = { [DEFAULT_VALUE]: 'Default (recommended)' }
  for (const c of choices) labels[c.id] = c.label

  const selected = choices.find((c) => c.id === value)
  const needsPaidWarning = !!selected && !selected.freeTier && !hasPaidKey
  const showSuggestion = !!suggestion && enabled && suggestion.id !== value

  function handleChange(next: string | null) {
    if (!next) return
    const prev = value
    setValue(next)
    startTransition(async () => {
      try {
        const res = await setAiFeatureModel(feature, next === DEFAULT_VALUE ? null : next)
        if (!res.ok) {
          toast.error(res.error)
          setValue(prev)
          return
        }
        toast.success(`${label} model: ${labels[next] ?? next}`)
      } catch {
        toast.error('Something went wrong — try again')
        setValue(prev)
      }
    })
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <Select value={value} onValueChange={handleChange} disabled={!enabled || isPending}>
        <SelectTrigger size="sm" aria-label={`${label} model`} className="w-full sm:w-64 border-border/70 bg-card/60">
          {/* The function child is NOT decoration. Base UI's Select.Value
              renders String(value) unless given a function child or an items
              map, so a raw id like "gemini-2.5-flash-lite" would show
              verbatim here instead of "Gemini 2.5 Flash-Lite" — and only in
              the CLOSED state, which is why it survives a glance at the open
              menu. This repo has already hit it twice (the job-role and
              employment selects carry the same fix). Simplifying this to
              <SelectValue /> compiles, renders, and is wrong. */}
          <SelectValue>{(v: string) => labels[v] ?? v}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-80 border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
          <SelectItem value={DEFAULT_VALUE}>
            <div className="flex flex-col gap-0.5 py-0.5">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Zap className="size-3 text-primary" /> Default (recommended)
              </span>
              <span className="font-mono text-2xs text-muted-foreground">
                Managed studio fallback chain
              </span>
            </div>
          </SelectItem>
          {choices.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <div className="flex flex-col gap-1 py-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-foreground">{c.label}</span>
                  {c.stability === 'preview' && (
                    <span className="rounded bg-chart-1/10 px-1.5 py-0.5 font-mono text-2xs font-semibold text-chart-1">
                      preview
                    </span>
                  )}
                  {c.stability === 'alias' && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-2xs font-semibold text-primary">
                      alias
                    </span>
                  )}
                  {!c.freeTier && (
                    <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-2xs font-semibold text-destructive">
                      paid keys only
                    </span>
                  )}
                  {suggestion?.id === c.id && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-2xs font-bold text-primary flex items-center gap-0.5">
                      <Sparkles className="size-2.5" /> suggested
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between font-mono text-2xs text-muted-foreground">
                  <span className="text-foreground/80">{priceLabel(c.id)}</span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showSuggestion ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleChange(suggestion.id)}
          className="inline-flex items-center gap-1 self-start rounded-sm text-left text-xs text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <Sparkles className="size-3 shrink-0" aria-hidden />
          <span>
            Suggested for you: {suggestion.label} — {suggestion.hint} on your recent usage
          </span>
        </button>
      ) : null}
      {needsPaidWarning ? (
        <p
          role="alert"
          className="flex w-full items-start gap-1.5 rounded-lg border border-warning/35 bg-warning/5 px-2 py-1.5 text-xs sm:max-w-96"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <span>
            {selected.label} is paid-tier only, and none of your active keys is marked paid.{' '}
            {label} keeps working: each call is refused here, then falls through to the default
            model — so until you add a paid key this choice only costs you one wasted request per
            call.
          </span>
        </p>
      ) : null}
    </div>
  )
}
