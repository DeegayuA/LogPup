'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { geminiKeys } from '@/db/schema'
import { encryptSecret } from '@/lib/crypto'
import { validateGeminiKey } from '@/features/gemini/client'
import { ok, err, type ActionResult } from '@/lib/action-result'

const MAX_KEYS_PER_USER = 5

export async function addGeminiKey(label: string, key: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const trimmedKey = key.trim()
  const trimmedLabel = label.trim().slice(0, 60) || 'Gemini key'
  if (trimmedKey.length < 20) return err('That does not look like a Gemini API key')

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
  })
  revalidatePath('/profile')
  return ok(undefined)
}

export async function deleteGeminiKey(id: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  await db
    .delete(geminiKeys)
    .where(and(eq(geminiKeys.id, id), eq(geminiKeys.userId, session.user.id)))
  revalidatePath('/profile')
  return ok(undefined)
}

export async function toggleGeminiKey(id: string, active: boolean): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  await db
    .update(geminiKeys)
    .set({ active })
    .where(and(eq(geminiKeys.id, id), eq(geminiKeys.userId, session.user.id)))
  revalidatePath('/profile')
  return ok(undefined)
}
