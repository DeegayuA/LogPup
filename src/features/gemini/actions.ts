'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { geminiKeys, userAiPrefs } from '@/db/schema'
import { encryptSecret } from '@/lib/crypto'
import { validateGeminiKey } from '@/features/gemini/client'
import { assessRecordingReadiness, type RecordingReadiness } from '@/features/gemini/readiness'
import { AI_FEATURES, type AiFeatureId } from '@/features/gemini/ai-features'
import { ok, err, type ActionResult } from '@/lib/action-result'

const MAX_KEYS_PER_USER = 5

const idInput = z.uuid()

const addKeyInput = z.object({
  label: z.string().min(1).max(60),
  key: z.string().min(20, 'That does not look like a Gemini API key').max(200),
})

const toggleInput = z.object({
  id: z.uuid(),
  active: z.boolean(),
})

const tierInput = z.enum(['free', 'paid'])

export async function addGeminiKey(
  label: string,
  key: string,
  opts?: { tier?: 'free' | 'paid' },
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  // Preserve the pre-existing "blank label defaults to Gemini key" UX —
  // the fallback is applied before validation so addKeyInput's min(1) is
  // about rejecting truly malformed input, not blank form fields.
  const parsed = addKeyInput.safeParse({ label: label.trim() || 'Gemini key', key: key.trim() })
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { label: trimmedLabel, key: trimmedKey } = parsed.data

  const tier = tierInput.safeParse(opts?.tier ?? 'free')
  if (!tier.success) return err('Invalid key tier')

  const existing = await db
    .select({ id: geminiKeys.id })
    .from(geminiKeys)
    .where(eq(geminiKeys.userId, session.user.id))
  if (existing.length >= MAX_KEYS_PER_USER) {
    return err(`Limit of ${MAX_KEYS_PER_USER} keys reached — remove one first`)
  }

  const valid = await validateGeminiKey(trimmedKey)
  if (!valid) return err("Google rejected this key — check it in AI Studio and try again")

  await db.insert(geminiKeys).values({
    userId: session.user.id,
    label: trimmedLabel,
    encryptedKey: encryptSecret(trimmedKey),
    last4: trimmedKey.slice(-4),
    tier: tier.data,
  })
  revalidatePath('/profile')
  return ok(undefined)
}

export async function deleteGeminiKey(id: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  const parsed = idInput.safeParse(id)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  await db
    .delete(geminiKeys)
    .where(and(eq(geminiKeys.id, parsed.data), eq(geminiKeys.userId, session.user.id)))
  revalidatePath('/profile')
  return ok(undefined)
}

/**
 * "Do I have enough left to record this?" — the state of the caller's OWN
 * keys, as the recorder needs it before a long meeting.
 *
 * Reads only health columns (active, failCount); no key material, encrypted
 * or otherwise, is involved. Scoped to the session user, because a key's
 * health is exactly as private as the key.
 *
 * Deliberately does NOT probe each key with a live call: this runs whenever
 * a recording panel opens, and spending a request per key to ask "are you
 * alive" would burn the very quota it is reporting on. failCount is evidence
 * already collected by every real call the key has served.
 */
export async function getRecordingReadiness(): Promise<ActionResult<RecordingReadiness>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const rows = await db
    .select({
      id: geminiKeys.id,
      label: geminiKeys.label,
      active: geminiKeys.active,
      failCount: geminiKeys.failCount,
      lastUsedAt: geminiKeys.lastUsedAt,
    })
    .from(geminiKeys)
    .where(eq(geminiKeys.userId, session.user.id))

  return ok(assessRecordingReadiness(rows))
}

export async function toggleGeminiKey(id: string, active: boolean): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  const parsed = toggleInput.safeParse({ id, active })
  if (!parsed.success) return err(parsed.error.issues[0].message)
  await db
    .update(geminiKeys)
    .set({ active: parsed.data.active })
    .where(and(eq(geminiKeys.id, parsed.data.id), eq(geminiKeys.userId, session.user.id)))
  revalidatePath('/profile')
  return ok(undefined)
}

export async function setGeminiKeySharing(id: string, shared: boolean): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  const parsed = toggleInput.safeParse({ id, active: shared })
  if (!parsed.success) return err(parsed.error.issues[0].message)
  await db
    .update(geminiKeys)
    .set({ shared: parsed.data.active })
    .where(and(eq(geminiKeys.id, parsed.data.id), eq(geminiKeys.userId, session.user.id)))
  revalidatePath('/profile')
  return ok(undefined)
}

export async function setGeminiKeyTier(id: string, tier: 'free' | 'paid'): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  const parsedId = idInput.safeParse(id)
  const parsedTier = tierInput.safeParse(tier)
  if (!parsedId.success) return err(parsedId.error.issues[0].message)
  if (!parsedTier.success) return err('Invalid key tier')
  await db
    .update(geminiKeys)
    .set({ tier: parsedTier.data })
    .where(and(eq(geminiKeys.id, parsedId.data), eq(geminiKeys.userId, session.user.id)))
  revalidatePath('/profile')
  return ok(undefined)
}

export async function setAiFeaturePref(
  feature: AiFeatureId,
  enabled: boolean,
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  if (!AI_FEATURES.some((f) => f.id === feature)) return err('Unknown AI feature')
  await db
    .insert(userAiPrefs)
    .values({ userId: session.user.id, feature, enabled, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [userAiPrefs.userId, userAiPrefs.feature],
      set: { enabled, updatedAt: new Date() },
    })
  revalidatePath('/settings')
  return ok(undefined)
}
