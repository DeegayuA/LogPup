'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, sprints } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { getBoard, type Board, type TaskWithAssignee } from '@/features/sprints/queries'
import { upsertSprintPage, type SprintExportData } from '@/features/notion/export'

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin') return null
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
  if (!(await requireAdmin())) return err('Admins only')

  const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId))
  if (!sprint) return err('Sprint not found')

  const [app] = await db.select({ name: apps.name, slug: apps.slug }).from(apps).where(eq(apps.id, sprint.appId))
  if (!app) return err('App not found')

  if (!process.env.NOTION_PARENT_PAGE_ID && !sprint.notionPageId) {
    return err('Notion parent page not configured — set NOTION_PARENT_PAGE_ID')
  }

  const board = await getBoard(sprint.appId, sprintId)
  const data = buildExportData(app, sprint, board)

  try {
    const { pageId, pageUrl } = await upsertSprintPage(data, sprint.notionPageId)
    if (!sprint.notionPageId) {
      await db.update(sprints).set({ notionPageId: pageId }).where(eq(sprints.id, sprintId))
    }
    revalidatePath('/apps/' + app.slug)
    return ok({ pageUrl })
  } catch {
    return err('Notion export failed — check token and parent page sharing')
  }
}
