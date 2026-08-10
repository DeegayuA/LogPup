import { Client } from '@notionhq/client'

const notion = () => new Client({ auth: process.env.NOTION_TOKEN })

export type SprintExportData = {
  appName: string
  sprintName: string
  goal: string | null
  startDate: string
  endDate: string
  columns: { heading: string; items: { title: string; assignee: string | null }[] }[]
}

export function buildBlocks(data: SprintExportData) {
  return [
    { heading_2: { rich_text: [{ text: { content: 'Goal' } }] } },
    { paragraph: { rich_text: [{ text: { content: data.goal ?? '—' } }] } },
    ...data.columns.flatMap((col) => [
      { heading_2: { rich_text: [{ text: { content: `${col.heading} (${col.items.length})` } }] } },
      ...col.items.map((t) => ({
        bulleted_list_item: {
          rich_text: [{ text: { content: t.assignee ? `${t.title} — ${t.assignee}` : t.title } }],
        },
      })),
    ]),
  ]
}

export async function upsertSprintPage(
  data: SprintExportData,
  existingPageId: string | null,
): Promise<{ pageId: string; pageUrl: string }> {
  const title = `${data.appName} — ${data.sprintName} (${data.startDate} → ${data.endDate})`
  const client = notion()
  if (existingPageId) {
    await client.pages.update({
      page_id: existingPageId,
      properties: { title: { title: [{ text: { content: title } }] } },
    })
    const children = await client.blocks.children.list({ block_id: existingPageId, page_size: 100 })
    for (const block of children.results) {
      await client.blocks.delete({ block_id: block.id })
    }
    await client.blocks.children.append({ block_id: existingPageId, children: buildBlocks(data) as never })
    const page = await client.pages.retrieve({ page_id: existingPageId })
    return { pageId: existingPageId, pageUrl: (page as { url?: string }).url ?? '' }
  }
  const page = await client.pages.create({
    parent: { page_id: process.env.NOTION_PARENT_PAGE_ID! },
    properties: { title: { title: [{ text: { content: title } }] } },
    children: buildBlocks(data) as never,
  })
  return { pageId: page.id, pageUrl: (page as { url?: string }).url ?? '' }
}
