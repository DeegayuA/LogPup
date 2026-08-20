'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { setAiFeaturePref } from '@/features/gemini/actions'
import type { AiFeatureId } from '@/features/gemini/ai-features'

/**
 * Optimistic with rollback, the same shape as AiModelSelect's handleChange:
 * the switch flips the moment it is pressed, and flips back (with the error
 * as a toast) if the server says no. A settings switch that sits frozen for
 * a round trip reads as broken; one that lies about a failed write is worse —
 * this does neither. `disabled` while pending serializes double-taps.
 */
export function AiFeatureToggle({
  feature,
  label,
  enabled,
}: {
  feature: AiFeatureId
  label: string
  enabled: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [checked, setChecked] = useState(enabled)

  function handleChange(next: boolean) {
    const prev = checked
    setChecked(next)
    startTransition(async () => {
      try {
        const res = await setAiFeaturePref(feature, next)
        if (!res.ok) {
          toast.error(res.error)
          setChecked(prev)
          return
        }
        toast.success(next ? `${label} on` : `${label} off`)
      } catch {
        toast.error('Something went wrong — try again')
        setChecked(prev)
      }
    })
  }

  return (
    <Switch
      checked={checked}
      disabled={isPending}
      onCheckedChange={handleChange}
      aria-label={`${label} AI feature`}
    />
  )
}
