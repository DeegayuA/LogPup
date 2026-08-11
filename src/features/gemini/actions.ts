'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { geminiKeys } from '@/db/schema'
import { encryptSecret } from '@/lib/crypto'
import { validateGeminiKey } from '@/features/gemini/client'
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

export async function addGeminiKey(label: string, key: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  // Preserve the pre-existing "blank label defaults to Gemini key" UX —
  // the fallback is applied before validation so addKeyInput's min(1) is
  // about rejecting truly malformed input, not blank form fields.
  const parsed = addKeyInput.safeParse({ label: label.trim() || 'Gemini key', key: key.trim() })
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { label: trimmedLabel, key: trimmedKey } = parsed.data

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
  const parsed = idInput.safeParse(id)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  await db
    .delete(geminiKeys)
    .where(and(eq(geminiKeys.id, parsed.data), eq(geminiKeys.userId, session.user.id)))
  revalidatePath('/profile')
  return ok(undefined)
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
