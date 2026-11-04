import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { channelMembers, channels } from '@/db/schema'
import { liveApps, liveBugReports, liveDocs, liveTasks } from '@/db/live'
import { can, type Actor } from '@/features/auth/capabilities'
import { channelPermissions, type ChannelPermissions } from './rules'
import type { ChannelKind } from './chat'

/**
 * The one place a conversation's project is decided, and therefore the one
 * place its access is decided. Every chat read, write and the attachment
 * download go through loadChannelAccess.
 *
 * THE PROJECT COMES FROM THE DATABASE, never from the client: a project
 * channel's app_id is read from its row and must be a LIVE app; a context
 * channel's project is re-read from the LIVE work item every time, so
 * trashing the task, page or bug (or its project) closes its conversation
 * until an admin restores it — the same rule attachments follow.
 *
 * Not a server action module: exporting these from 'use server' would make
 * them callable from the browser with any id.
 */

export type ContextType = 'task' | 'doc' | 'bug'

export type ContextItem = {
  appId: string
  appSlug: string
  appName: string
  title: string
  href: string
}

export async function resolveContextItem(type: ContextType, id: string): Promise<ContextItem | null> {
  if (type === 'task') {
    const [row] = await db
      .select({ appId: liveTasks.appId, title: liveTasks.title, sprintId: liveTasks.sprintId, appSlug: liveApps.slug, appName: liveApps.name })
      .from(liveTasks)
      .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
      .where(eq(liveTasks.id, id))
      .limit(1)
    return row
      ? { ...row, href: `/apps/${row.appSlug}?tab=roadmap&sprint=${row.sprintId ?? 'backlog'}` }
      : null
  }
  if (type === 'doc') {
    const [row] = await db
      .select({ appId: liveDocs.appId, title: liveDocs.title, appSlug: liveApps.slug, appName: liveApps.name })
      .from(liveDocs)
      .innerJoin(liveApps, eq(liveApps.id, liveDocs.appId))
      .where(eq(liveDocs.id, id))
      .limit(1)
    return row ? { ...row, href: `/apps/${row.appSlug}?tab=docs&doc=${id}` } : null
  }
  const [row] = await db
    .select({ appId: liveBugReports.appId, title: liveBugReports.title, appSlug: liveApps.slug, appName: liveApps.name })
    .from(liveBugReports)
    .innerJoin(liveApps, eq(liveApps.id, liveBugReports.appId))
    .where(eq(liveBugReports.id, id))
    .limit(1)
  return row ? { ...row, href: `/apps/${row.appSlug}?tab=bugs` } : null
}

export type ChannelAccess = {
  id: string
  kind: ChannelKind
  name: string | null
  topic: string | null
  /** The project, for every kind that has one (public, private, context). */
  app: { id: string; slug: string; name: string } | null
  context: (ContextItem & { type: ContextType; id: string }) | null
  archived: boolean
  createdBy: string
  member: { role: 'owner' | 'member'; lastReadAt: Date } | null
  perms: ChannelPermissions
}

export function projectFacts(actor: Actor, appId: string | null) {
  if (!appId) return { canView: false, canComment: false, canManage: false }
  const resource = { appId }
  return {
    canView: can(actor, 'app.view', resource),
    canComment: can(actor, 'task.comment', resource),
    canManage: can(actor, 'sprint.manage', resource),
  }
}

/** Null for "no such conversation" and "not yours to see" alike — callers answer both the same. */
export async function loadChannelAccess(actor: Actor, channelId: string): Promise<ChannelAccess | null> {
  const [row] = await db
    .select({
      id: channels.id,
      kind: channels.kind,
      appId: channels.appId,
      name: channels.name,
      topic: channels.topic,
      contextType: channels.contextType,
      contextId: channels.contextId,
      createdBy: channels.createdBy,
      archivedAt: channels.archivedAt,
      appSlug: liveApps.slug,
      appName: liveApps.name,
      role: channelMembers.role,
      lastReadAt: channelMembers.lastReadAt,
    })
    .from(channels)
    .leftJoin(liveApps, eq(liveApps.id, channels.appId))
    .leftJoin(channelMembers, and(eq(channelMembers.channelId, channels.id), eq(channelMembers.userId, actor.id)))
    .where(eq(channels.id, channelId))
    .limit(1)
  if (!row) return null

  let app: ChannelAccess['app'] = null
  let context: ChannelAccess['context'] = null
  if (row.kind === 'context') {
    if (!row.contextType || !row.contextId) return null
    const item = await resolveContextItem(row.contextType, row.contextId)
    if (!item) return null
    context = { ...item, type: row.contextType, id: row.contextId }
    app = { id: item.appId, slug: item.appSlug, name: item.appName }
  } else if (row.kind === 'public' || row.kind === 'private') {
    // A trashed project takes its channels with it.
    if (!row.appId || !row.appSlug || !row.appName) return null
    app = { id: row.appId, slug: row.appSlug, name: row.appName }
  }

  const member = row.role && row.lastReadAt ? { role: row.role, lastReadAt: row.lastReadAt } : null
  const perms = channelPermissions({
    kind: row.kind,
    archived: row.archivedAt !== null,
    isMember: member !== null,
    isOwner: member?.role === 'owner',
    ...projectFacts(actor, app?.id ?? null),
  })
  if (!perms.read && !perms.addMembers) return null

  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    topic: row.topic,
    app,
    context,
    archived: row.archivedAt !== null,
    createdBy: row.createdBy,
    member,
    perms,
  }
}
