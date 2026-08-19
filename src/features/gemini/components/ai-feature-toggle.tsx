'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { setAiFeaturePref } from '@/features/gemini/actions'
import type { AiFeatureId } from '@/features/gemini/ai-features'

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

  function handleChange(next: boolean) {
    startTransition(async () => {
      try {
        const res = await setAiFeaturePref(feature, next)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(next ? `${label} on` : `${label} off`)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <Switch
      checked={enabled}
      disabled={isPending}
      onCheckedChange={handleChange}
      aria-label={`${label} AI feature`}
    />
  )
}
