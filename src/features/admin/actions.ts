'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, assignments, sprints, tasks, meetings, meetingAttendees } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'

// Temporary testing tool. Enabled only when ENABLE_DB_CLEAR=1 so it can be turned off
// (remove the flag) the moment testing is done. Wipes business data but KEEPS users,
// so the acting admin is not locked out.
const dbClearEnabled = () => process.env.ENABLE_DB_CLEAR === '1'

export async function clearTestData(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth()
  if (session?.user?.role !== 'admin') return err('Admins only')
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
