'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps } from '@/db/schema'
import { auth } from '@/lib/auth'
import { slugify } from '@/lib/slug'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { buildAppUpdate } from '@/features/apps/update-input'

const appInput = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  repoUrl: z.union([z.url(), z.literal('')]).optional(),
  techTags: z.array(z.string().min(1)).max(10).default([]),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
  leadId: z.uuid().optional(),
})

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin') return null
  return session
}

export async function createApp(input: unknown): Promise<ActionResult<{ slug: string }>> {
  if (!(await requireAdmin())) return err('Admins only')
  const parsed = appInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const slug = slugify(parsed.data.name)
  try {
    await db.insert(apps).values({ ...parsed.data, repoUrl: parsed.data.repoUrl || null, slug })
  } catch {
    return err('An app with a similar name already exists')
  }
  revalidatePath('/apps')
  return ok({ slug })
}

export async function updateApp(appId: string, input: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')
  const result = buildAppUpdate(input)
  if (!result.ok) return err(result.error)
  await db.update(apps).set(result.set).where(eq(apps.id, appId))
  revalidatePath('/apps')
  return ok(undefined)
}

export async function archiveApp(appId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')
  const parsedId = z.uuid().safeParse(appId)
  if (!parsedId.success) return err('Invalid app')
  await db.update(apps).set({ status: 'archived' }).where(eq(apps.id, parsedId.data))
  revalidatePath('/apps')
  return ok(undefined)
}
