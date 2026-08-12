import { Client } from '@notionhq/client'
import { pickParentPage, type NotionPageCandidate } from '@/features/notion/parent-page'

const notion = () => new Client({ auth: process.env.NOTION_TOKEN })

/** Thrown when no export destination can be determined — the message is
 *  written for the person who has to fix it, and actions.ts passes it
 *  through verbatim rather than flattening it into a generic failure. */
export class NotionParentError extends Error {}

/**
 * Where new sprint pages get created. NOTION_PARENT_PAGE_ID wins when set;
 * otherwise the integration's own visibility decides (see parent-page.ts).
 * The discovered id is cached for the life of the server process — the
 * shared-pages set changes when a human reshapes the workspace, not between
 * two exports — and a restart (or setting the env var) picks up changes.
 */
let discoveredParentId: string | null = null

async function resolveParentPageId(client: Client): Promise<string> {
  if (process.env.NOTION_PARENT_PAGE_ID) return process.env.NOTION_PARENT_PAGE_ID
  if (discoveredParentId) return discoveredParentId

  const search = await client.search({
    filter: { property: 'object', value: 'page' },
    page_size: 50,
  })
  const candidates: NotionPageCandidate[] = search.results
    .filter((result): result is typeof result & { parent: { type: string } } => 'parent' in result)
    .map((page) => ({
      id: page.id,
      parentType: page.parent.type,
      title:
        'properties' in page
          ? Object.values(page.properties)
              .flatMap((prop) => ('title' in prop ? prop.title : []))
              .map((t) => t.plain_text)
              .join('')
          : '',
    }))

  const decision = pickParentPage(candidates)
  if (decision.kind === 'use') {
    discoveredParentId = decision.id
    return decision.id
  }
  if (decision.kind === 'none') {
    throw new NotionParentError(
      'The Notion integration cannot see any page yet. In Notion, open the page exports should live under → ••• → Connections → add "logpup", then export again.',
    )
  }
  throw new NotionParentError(
    `Several Notion pages are shared with the integration (${decision.titles.join(', ')}) — set NOTION_PARENT_PAGE_ID to the one exports should live under.`,
  )
}

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
    const blockIds: string[] = []
    let cursor: string | undefined
    do {
      const children = await client.blocks.children.list({
        block_id: existingPageId,
        page_size: 100,
        start_cursor: cursor,
      })
      blockIds.push(...children.results.map((block) => block.id))
      cursor = children.has_more ? (children.next_cursor ?? undefined) : undefined
    } while (cursor)
    for (const blockId of blockIds) {
      await client.blocks.delete({ block_id: blockId })
    }
    await client.blocks.children.append({ block_id: existingPageId, children: buildBlocks(data) as never })
    const page = await client.pages.retrieve({ page_id: existingPageId })
    return { pageId: existingPageId, pageUrl: (page as { url?: string }).url ?? '' }
  }
  const page = await client.pages.create({
    parent: { page_id: await resolveParentPageId(client) },
    properties: { title: { title: [{ text: { content: title } }] } },
    children: buildBlocks(data) as never,
  })
  return { pageId: page.id, pageUrl: (page as { url?: string }).url ?? '' }
}
