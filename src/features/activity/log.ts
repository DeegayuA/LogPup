import { db } from '@/db'
import { activityLog } from '@/db/schema'
import type { ActivityInput } from '@/features/activity/types'

/**
 * Append one row to the activity trail. Called from inside mutating server
 * actions, AFTER the write it describes has succeeded.
 *
 * NEVER THROWS — this is the whole contract. The trail is bookkeeping; the
 * user's action is the work. A full disk, a dropped connection, or a bad
 * value here must not turn a successful task-move into an error toast. The
 * failure is logged to the server console (visible in Vercel logs) and
 * swallowed. Deliberately awaited by callers even so: on serverless, work
 * left dangling after the response is returned may never run.
 */
export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    await db.insert(activityLog).values({
      actorId: input.actorId,
      verb: input.verb,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      appId: input.appId ?? null,
      appName: input.appName ?? null,
      pagePath: input.pagePath ?? null,
      detail: input.detail ?? null,
      metadata: input.metadata ?? null,
    })
  } catch (error) {
    console.error('[activity] failed to record', input.verb, input.entityType, error)
  }
}
