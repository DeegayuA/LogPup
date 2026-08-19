import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { geminiKeys } from '@/db/schema'

export type GeminiKeyRow = {
  id: string
  label: string
  last4: string
  active: boolean
  shared: boolean
  tier: string
  failCount: number
  lastUsedAt: Date | null
  createdAt: Date
}

/**
 * Masked key rows for the settings UI — the key itself never leaves the server.
 *
 * OWN KEYS ONLY, deliberately: this backs the /profile card, which lets the
 * caller toggle, share, and DELETE each row — so it must never widen to
 * include a teammate's key, however tempting that looks once shared/active
 * keys exist. The pool a caller can actually transact on (their own keys plus
 * other people's active-and-shared ones) is a separate, read-only view — see
 * getRecordingReadiness in actions.ts — and has no business in a UI with a
 * delete button on every row.
 */
export async function listGeminiKeys(userId: string): Promise<GeminiKeyRow[]> {
  return db
    .select({
      id: geminiKeys.id,
      label: geminiKeys.label,
      last4: geminiKeys.last4,
      active: geminiKeys.active,
      shared: geminiKeys.shared,
      tier: geminiKeys.tier,
      failCount: geminiKeys.failCount,
      lastUsedAt: geminiKeys.lastUsedAt,
      createdAt: geminiKeys.createdAt,
    })
    .from(geminiKeys)
    .where(eq(geminiKeys.userId, userId))
    .orderBy(asc(geminiKeys.createdAt))
}
