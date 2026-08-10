'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, assignments, sprints, tasks, meetings, meetingAttendees, users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { canEditUser } from '@/features/admin/permissions'

// Temporary testing tool. Enabled only when ENABLE_DB_CLEAR=1 so it can be turned off
// (remove the flag) the moment testing is done. Wipes business data but KEEPS users,
// so the acting admin is not locked out.
const dbClearEnabled = () => process.env.ENABLE_DB_CLEAR === '1'

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin') return null
  return session
}

export async function clearTestData(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  if (!dbClearEnabled()) return err('DB clear is disabled (set ENABLE_DB_CLEAR=1)')
  if (String(formData.get('confirm') ?? '') !== 'CLEAR') {
    return err('Type CLEAR to confirm')
  }

  // Delete children before parents to respect foreign keys; users are preserved.
  await db.delete(meetingAttendees)
  await db.delete(meetings)
  await db.delete(tasks)
  await db.delete(sprints)
  await db.delete(assignments)
  await db.delete(apps)

  revalidatePath('/', 'layout')
  return ok(undefined)
}

const roleInput = z.enum(['admin', 'member'])

function revalidateAdminPaths() {
  revalidatePath('/admin')
  revalidatePath('/people')
  revalidatePath('/')
}

export async function setUserRole(userId: string, role: 'admin' | 'member'): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  if (!canEditUser(session.user.id, userId)) return err('Cannot change your own account')

  const parsed = roleInput.safeParse(role)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  await db.update(users).set({ role: parsed.data }).where(eq(users.id, userId))
  revalidateAdminPaths()
  return ok(undefined)
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  if (!canEditUser(session.user.id, userId)) return err('Cannot change your own account')

  const parsed = z.boolean().safeParse(active)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  await db.update(users).set({ active: parsed.data }).where(eq(users.id, userId))
  revalidateAdminPaths()
  return ok(undefined)
}
