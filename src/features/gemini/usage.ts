import { db } from '@/db'
import { aiUsageEvents } from '@/db/schema'
import type { AiCallSlug } from '@/features/gemini/ai-features'

export type AiUsageEventInput = {
  userId: string
  keyId?: string | null
  keyOwnerId?: string | null
  keyLast4?: string | null
  feature: AiCallSlug
  model: string
  inputTokens?: number
  outputTokens?: number
  /** 'ok' or the GeminiErrorCode that ended the call. */
  status: string
}

/**
 * Fire-and-forget ledger write. This sits inside the response path of
 * every AI call, so it must be free: not awaited, and a failure (missing
 * table, connection blip) is logged and swallowed — the ledger exists to
 * inform, never to cost someone a transcription.
 */
export function recordAiUsage(event: AiUsageEventInput): void {
  void db
    .insert(aiUsageEvents)
    .values({
      userId: event.userId,
      keyId: event.keyId ?? null,
      keyOwnerId: event.keyOwnerId ?? null,
      keyLast4: event.keyLast4 ?? null,
      feature: event.feature,
      model: event.model,
      inputTokens: event.inputTokens ?? 0,
      outputTokens: event.outputTokens ?? 0,
      status: event.status,
    })
    .catch((error) => {
      console.error('[ai-usage] ledger write failed (ignored):', error)
    })
}
