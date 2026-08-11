'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { appComments, apps, users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { createNotifications, extractMentionedUserIds } from '@/features/notifications/notify'

const MAX_COMMENT_LENGTH = 2000

export async function postAppComment(appId: string, body: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')

  const trimmed = body.trim()
  if (!trimmed) return err('Write something first')
  if (trimmed.length > MAX_COMMENT_LENGTH) return err('Comment is too long')

  const [app] = await db.select({ slug: apps.slug, name: apps.name }).from(apps).where(eq(apps.id, appId))
  if (!app) return err('App not found')

  await db.insert(appComments).values({ appId, authorId: session.user.id, body: trimmed })

  // Notify anyone @mentioned (except the author). Best-effort — a notification
  // failure must not lose the comment, which is already saved.
  try {
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users)
    const mentionedIds = extractMentionedUserIds(trimmed, allUsers).filter(
      (id) => id !== session.user.id,
    )
    await createNotifications(
      mentionedIds.map((userId) => ({
        userId,
        actorId: session.user.id,
        type: 'mention' as const,
        title: `${session.user.name ?? 'Someone'} mentioned you`,
        body: `In ${app.name}`,
        link: `/apps/${app.slug}?tab=overview`,
      })),
    )
  } catch (error) {
    console.error('[notifications] app comment mention failed:', error)
  }

  revalidatePath(`/apps/${app.slug}`)
  return ok(undefined)
}
