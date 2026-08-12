'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { appComments, apps, users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { createNotifications, extractMentionedUserIds } from '@/features/notifications/notify'

const MAX_COMMENT_LENGTH = 2000

/**
 * Both arguments are validated with zod BEFORE either one reaches the driver.
 *
 * The id matters more than it looks: `appId` arrives from a client component's
 * props, and Postgres rejects `uuid = 'not-a-uuid'` at the type level rather
 * than returning no rows — so an id that got mangled anywhere between the
 * server render and the click used to REJECT the action instead of resolving
 * with `{ ok: false }`. The caller awaits inside `startTransition`, so that
 * rejection surfaced as an unhandled promise: no toast, no error, the comment
 * silently gone. Parsing the shape here turns it into an ordinary err().
 *
 * The body is trimmed before the length check so 2000 spaces is "write
 * something first", not "too long".
 */
const commentInput = z.object({
  appId: z.uuid(),
  body: z.string().trim().min(1, 'Write something first').max(MAX_COMMENT_LENGTH, 'Comment is too long'),
})

export async function postAppComment(appId: string, body: string): Promise<ActionResult> {
  // Permission first: everyone signed in may comment on any app (there is no
  // per-app membership gate in this product), but an anonymous request must
  // never reach the parse, let alone the insert.
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  const authorId = session.user.id

  const parsed = commentInput.safeParse({ appId, body })
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { appId: validAppId, body: trimmed } = parsed.data

  try {
    const [app] = await db
      .select({ slug: apps.slug, name: apps.name })
      .from(apps)
      .where(eq(apps.id, validAppId))
    if (!app) return err('App not found')

    await db.insert(appComments).values({ appId: validAppId, authorId, body: trimmed })

    // Notify anyone @mentioned (except the author). Best-effort and separately
    // caught — the comment is already saved at this point, and losing a
    // notification must not report the comment itself as failed.
    try {
      const allUsers = await db.select({ id: users.id, name: users.name }).from(users)
      const mentionedIds = extractMentionedUserIds(trimmed, allUsers).filter(
        (id) => id !== authorId,
      )
      await createNotifications(
        mentionedIds.map((userId) => ({
          userId,
          actorId: authorId,
          type: 'mention' as const,
          title: `${session.user.name ?? 'Someone'} mentioned you`,
          body: `In ${app.name}`,
          // Must point at the tab the thread actually lives on. Comments moved
          // off Overview onto their own Discussion section; a notification that
          // opens Overview drops the reader on a page with no comment on it.
          link: `/apps/${app.slug}?tab=discussion`,
        })),
      )
    } catch (error) {
      console.error('[notifications] app comment mention failed:', error)
    }

    revalidatePath(`/apps/${app.slug}`)
    return ok(undefined)
  } catch (error) {
    console.error('[apps] postAppComment failed:', error)
    return err('Could not post the comment — try again')
  }
}
