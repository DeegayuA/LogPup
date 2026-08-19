import { after } from 'next/server'
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
 * Fire-and-forget ledger write, but not fire-and-forgotten. This sits inside
 * the response path of every AI call, so from the caller's side it must stay
 * free: never awaited, never throws — a failure (missing table, connection
 * blip) is logged and swallowed, because the ledger exists to inform, never
 * to cost someone a transcription. At the same time the write itself must
 * land: it's scheduled through `after()` so the platform keeps this
 * invocation alive until the insert settles, instead of suspending the
 * function once the response is sent and silently dropping the row — which
 * would corrupt the per-feature usage and adoption reporting this ledger
 * exists to provide.
 */
export function recordAiUsage(event: AiUsageEventInput): void {
  const write = () =>
    db
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

  try {
    after(write)
  } catch {
    // No request scope (a script, a test, a background job): fall back to
    // the original detached write rather than losing the row.
    void write()
  }
}
