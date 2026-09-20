'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { liveApps, liveSprints } from '@/db/live'
import { sprints } from '@/db/schema'
import { auth } from '@/lib/auth'
import { requireCapability } from '@/features/auth/actor'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { getBoard, type Board, type TaskWithAssignee } from '@/features/sprints/queries'
import { NotionParentError, upsertSprintPage, type SprintExportData } from '@/features/notion/export'

// Was a verbatim copy of the same six-line `requireAdmin()` that lived in six
// other files. Every guard now names the capability it needs and the matrix
// answers; the contract is unchanged (Actor on success, null on refusal).

// Same local helper task-actions.ts's updateTask uses: a friendlier
// "sign in" message ahead of the resource read below, distinct from the
// capability refusal that follows it.
async function requireSession() {
  const session = await auth()
  if (!session?.user) return null
  return session
}

function columnItems(tasks: TaskWithAssignee[]) {
  return tasks.map((task) => ({ title: task.title, assignee: task.assignee?.name ?? null }))
}

function buildExportData(
  app: { name: string },
  sprint: { name: string; goal: string | null; startDate: string; endDate: string },
  board: Board,
): SprintExportData {
  return {
    appName: app.name,
    sprintName: sprint.name,
    goal: sprint.goal,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    columns: [
      { heading: 'To do', items: columnItems(board.todo) },
      { heading: 'In progress', items: columnItems(board.in_progress) },
      { heading: 'Done', items: columnItems(board.done) },
    ],
  }
}

export async function exportSprintToNotion(sprintId: string): Promise<ActionResult<{ pageUrl: string }>> {
  const session = await requireSession()
  if (!session) return err('Sign in required')

  const [sprint] = await db.select().from(liveSprints).where(eq(liveSprints.id, sprintId))
  if (!sprint) return err('Sprint not found')

  // READ THEN AUTHORISE, against the sprint's real appId — not the bare
  // `requireCapability('app.edit')` this used to be. `app.edit` is SCOPED for
  // manager, and asking with no appId at all fails closed for every one of
  // them, which is why the Export button on apps/[slug] — now offered to
  // canManageSprints, i.e. every PM — always said "Admins only" for a PM.
  if (!(await requireCapability('app.edit', { appId: sprint.appId }))) return err('Not allowed')

  const [app] = await db.select({ name: liveApps.name, slug: liveApps.slug }).from(liveApps).where(eq(liveApps.id, sprint.appId))
  if (!app) return err('App not found')

  // No parent-page precheck here any more: export.ts resolves the
  // destination itself (env var, else the one page shared with the
  // integration — see parent-page.ts) and throws NotionParentError with a
  // fix-it message when it genuinely can't. Gating on the env var here made
  // the feature look broken even when discovery would have succeeded.

  const board = await getBoard(sprint.appId, sprintId)
  const data = buildExportData(app, sprint, board)

  try {
    const { pageId, pageUrl } = await upsertSprintPage(data, sprint.notionPageId)
    if (!sprint.notionPageId) {
      await db.update(sprints).set({ notionPageId: pageId }).where(eq(sprints.id, sprintId))
    }
    revalidatePath('/apps/' + app.slug)
    return ok({ pageUrl })
  } catch (error) {
    // A missing/ambiguous destination carries its own fix-it instructions —
    // pass those through untouched. Everything else gets the short generic
    // line, with the real error logged server-side; flattening BOTH cases
    // into one string is what made this feature undiagnosable before.
    if (error instanceof NotionParentError) return err(error.message)
    console.error('[notion-export] sprint export failed:', error)
    return err('Notion export failed — check the token in .env.local (NOTION_TOKEN) and that the page is still shared')
  }
}
