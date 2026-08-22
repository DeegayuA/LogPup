import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { users } from '@/db/schema'
import { commitsByAuthor } from '@/features/github/app-client'
import { githubConfigured } from '@/features/github/config'
import type { CommitEvidence } from '@/features/github/commits'

/**
 * One person's commits inside a time window, as worklog evidence.
 *
 * Empty — never an error — when the GitHub App isn't configured, the person
 * hasn't set their GitHub username on /profile, or GitHub is down. The
 * worklog draft has to keep working from meetings and activity alone; commits
 * are extra witnesses, not a dependency.
 *
 * Reads users.github_login at call time rather than taking a login parameter:
 * the caller knows userIds, and letting callers pass arbitrary logins would
 * quietly turn this into "commits of anyone" instead of "commits of this
 * person as they identified themself".
 */
export async function commitEvidenceFor(
  userId: string,
  start: Date,
  end: Date,
): Promise<CommitEvidence[]> {
  if (!githubConfigured()) return []
  try {
    const [row] = await db
      .select({ githubLogin: users.githubLogin })
      .from(users)
      .where(eq(users.id, userId))
    const login = row?.githubLogin?.trim()
    if (!login) return []
    return await commitsByAuthor(login, start.toISOString(), end.toISOString())
  } catch (error) {
    console.error('[github] commit evidence failed:', error)
    return []
  }
}
