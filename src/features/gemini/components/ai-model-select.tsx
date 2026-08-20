'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { TriangleAlert } from 'lucide-react'
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

/**
 * Per-row model picker beside the feature's on/off Switch. Options come from
 * MODEL_CHOICES[kind] — the curated list valid for this feature's endpoint —
 * plus a "Default (recommended)" entry mapping to `null`, which leaves the
 * feature on its own fallback chain (see resolveChain).
 *
 * The closed trigger needs an explicit label lookup: Base UI's Select.Value
 * renders `String(value)` unless given a function child or an `items` map,
 * so a raw id like "gemini-2.5-flash-lite" would otherwise show verbatim
 * instead of "Gemini 2.5 Flash-Lite" — this has bitten the app before (see
 * the job-role and employment selects for the same fix).
 */
export function AiModelSelect({
  feature,
  label,
  kind,
  model,
  enabled,
  hasPaidKey,
}: {
  feature: AiFeatureId
  label: string
  kind: FeatureKind
  model: string | null
  enabled: boolean
  hasPaidKey: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(model ?? DEFAULT_VALUE)

  const choices = MODEL_CHOICES[kind]
  const labels: Record<string, string> = { [DEFAULT_VALUE]: 'Default (recommended)' }
  for (const c of choices) labels[c.id] = c.label

  const selected = choices.find((c) => c.id === value)
  // A key with no paid tier answers 401/403 to a paid-only model on every
  // call, forever. That does NOT refuse the call: client.ts treats an auth
  // failure as "advance to the next model on this key", so the request falls
  // through to the default model and the feature works normally. What the
  // user loses is the choice itself — silently — plus one wasted request per
  // call. Nothing downstream can report that (they see an ordinary result),
  // so it has to be said here, at the point of choice, and said accurately:
  // promising refusal would send someone to add billing they don't need.
  const needsPaidWarning = !!selected && !selected.freeTier && !hasPaidKey

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
    <div className="flex flex-col gap-1">
      <Select value={value} onValueChange={handleChange} disabled={!enabled || isPending}>
        <SelectTrigger size="sm" aria-label={`${label} model`} className="w-56">
          <SelectValue>{(v: string) => labels[v] ?? v}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_VALUE}>Default (recommended)</SelectItem>
          {choices.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="flex flex-col gap-0.5">
                <span>
                  {c.label}
                  {c.stability !== 'stable' ? ` · ${c.stability}` : ''}
                  {!c.freeTier ? ' · paid keys only' : ''}
                </span>
                <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                  {priceLabel(c.id)}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsPaidWarning ? (
        <p
          role="alert"
          className="flex max-w-56 items-start gap-1.5 rounded-lg border border-warning/35 bg-warning/5 px-2 py-1.5 text-2xs text-warning"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
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
