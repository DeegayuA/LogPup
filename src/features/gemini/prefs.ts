import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { userAiPrefs } from '@/db/schema'
import { AI_FEATURES, type AiFeatureId } from '@/features/gemini/ai-features'

/**
 * Pure resolution: absent row = enabled (the product default is fully
 * AI-enabled), stored rows win, ids no feature claims anymore are ignored
 * (a retired feature's row must not break the map).
 */
export function resolvePrefs(
  rows: { feature: string; enabled: boolean }[],
): Record<AiFeatureId, boolean> {
  const prefs = Object.fromEntries(AI_FEATURES.map((f) => [f.id, true])) as Record<
    AiFeatureId,
    boolean
  >
  const known = new Set<string>(AI_FEATURES.map((f) => f.id))
  for (const row of rows) {
    if (known.has(row.feature)) prefs[row.feature as AiFeatureId] = row.enabled
  }
  return prefs
}

export async function getAiPrefs(userId: string): Promise<Record<AiFeatureId, boolean>> {
  const rows = await db
    .select({ feature: userAiPrefs.feature, enabled: userAiPrefs.enabled })
    .from(userAiPrefs)
    .where(eq(userAiPrefs.userId, userId))
  return resolvePrefs(rows)
}

export async function isAiFeatureEnabled(userId: string, id: AiFeatureId): Promise<boolean> {
  // `?? true` is the runtime half of the compile-time guarantee: AiFeatureId is
  // derived from AI_FEATURES, so a missing key cannot happen through the type
  // system — but a caller reaching this with a stale id (a JS caller, a value
  // off the wire) must fail toward the documented "absent = enabled" contract.
  // Falling back to undefined would report an ENABLED feature as switched off.
  return (await getAiPrefs(userId))[id] ?? true
}

/**
 * Server-action gate: the user-facing refusal message when the caller has
 * switched this feature off, null when the call may proceed. This is the
 * "off" analog of the NO_KEYS error, and exactly as visible.
 */
export async function aiFeatureDisabledMessage(
  userId: string,
  id: AiFeatureId,
): Promise<string | null> {
  return (await isAiFeatureEnabled(userId, id)) ? null : 'This AI feature is off in your Settings.'
}
