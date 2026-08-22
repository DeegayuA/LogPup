import { can, type Actor } from '@/features/auth/capabilities'
import { splitNoteAppTags, type AppRef } from '@/features/worklog/note-app-tags'

/**
 * Who may leave a review on somebody else's day.
 *
 * A REVIEW IS NOT A WRITE. The log itself stays a first-person statement —
 * there is still no `worklog.write.any` for any seat, and capabilities.test.ts
 * asserts the key does not exist. A review is a SECOND statement, attributed
 * to whoever made it, sitting beside the day rather than inside it. That
 * distinction is the whole reason this can exist at all without reopening the
 * rule that stops a manager rewriting what somebody said they did.
 *
 * WHO, AND WHY IT NEEDED NO NEW MACHINERY. `worklog.review` is 'scoped' for
 * manager, editor and member, and the scope SOURCE is already decided by role
 * (capabilities.ts, scopeSourceFor): a manager's scope comes from
 * app_role_history — the pm and lead roles — and an editor's and member's from
 * assignments. So "a lead or PM of that project, or somebody working on it"
 * falls straight out of the existing grant, and admins hold 'all'.
 */

/**
 * Which projects a day is ABOUT.
 *
 * Two sources, deliberately unioned rather than one preferred: the hour
 * entries name their project directly (worklog_entries.app_id, migration
 * 0050), and the note names projects in brackets — a convention already in the
 * data. Somebody who wrote "[Falcon] fixed the importer" and logged no hours
 * has still told you the day was about Falcon, and Falcon's lead should be
 * able to answer it.
 */
export function worklogDayAppIds(
  entries: readonly { appId: string | null }[],
  note: string | null,
  apps: readonly AppRef[],
): string[] {
  const ids = new Set<string>()
  for (const entry of entries) if (entry.appId) ids.add(entry.appId)

  // Tags resolve by NAME, so only tags naming a real project count. An
  // unmatched tag is kept on screen elsewhere (note-app-tags.ts) because the
  // person meant something by it — but it cannot grant anybody reach here.
  const byName = new Map(apps.map((app) => [app.name.toLowerCase(), app]))
  for (const tag of splitNoteAppTags(note, apps).tags) {
    const app = byName.get(tag.label.toLowerCase())
    if (app?.slug) ids.add(app.id)
  }
  return [...ids]
}

export type ReviewSubject = {
  /** Whose day it is. */
  userId: string
  /** The projects that day is about — see worklogDayAppIds. */
  appIds: readonly string[]
}

export function canReviewWorklogDay(actor: Actor, subject: ReviewSubject): boolean {
  // REVIEWING YOUR OWN DAY IS NOT A REVIEW. Same separation of duties the
  // absence flow follows, and the same single exception: a superadmin holds
  // request.review.self so a sole-superadmin workspace is not a place where
  // nothing can ever be signed off.
  if (subject.userId === actor.id) {
    return can(actor, 'request.review.self', { ownerId: actor.id })
  }

  // `appIds` is passed even when empty, and that matters: a scoped seat asked
  // about a day that names no project gets `[]`, `can` finds no overlap and
  // returns false. A day about nothing in particular is nobody's to review
  // except an admin's — failing closed is the correct answer, not an oversight.
  return can(actor, 'worklog.review', { ownerId: subject.userId, appIds: subject.appIds })
}
