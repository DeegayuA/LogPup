import 'server-only'

import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, lt, max, ne, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { attachments, channelMembers, channels, messageReactions, messages, userPresence, users } from '@/db/schema'
import { liveApps, liveBugReports, liveDocs, liveMessages, liveTasks } from '@/db/live'
import { can, effectiveGrant, type Actor } from '@/features/auth/capabilities'
import { appViewers } from '@/features/sprints/app-viewers'
import { effectiveStatus, type PresenceStatus } from './chat'
import { groupTitle } from './rules'
import type { ChannelAccess } from './access'

/**
 * Reads behind Chat (PRD Module D).
 *
 * PERMISSION-FREE BY CONTRACT for one channel: the caller has already run
 * loadChannelAccess (access.ts) and checked perms.read. The conversation
 * LIST is the exception — it decides visibility itself, row by row, because
 * it is the one read that is not about a channel somebody already opened.
 *
 * READS RAW `messages` ON PURPOSE (db/live.test.ts allowlists this file): a
 * deleted message stays in place as "This message was deleted" so a thread
 * keeps its shape and a reply never loses what it answered. The body of a
 * deleted message never leaves this module — it is blanked here, not in the
 * UI. Counts (unread, replies) read liveMessages, so a deleted message is
 * never "new".
 */

export const MESSAGE_PAGE = 50
const THREAD_LIMIT = 500
const SUMMARY_LIMIT = 150

export type Presence = { status: PresenceStatus; note: string | null; expiresAt: Date | null }

export type ReactionGroup = { emoji: string; count: number; me: boolean; names: string[] }

export type ChatMessage = {
  id: string
  channelId: string
  parentId: string | null
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  /** '' when deleted. */
  body: string
  createdAt: Date
  editedAt: Date | null
  deleted: boolean
  replyCount: number
  lastReplyAt: Date | null
  reactions: ReactionGroup[]
}

export type MessageSummary = Pick<ChatMessage, 'id' | 'replyCount' | 'lastReplyAt' | 'reactions'>

// --- messages --------------------------------------------------------------

const messageFields = {
  id: messages.id,
  channelId: messages.channelId,
  parentId: messages.parentId,
  authorId: messages.authorId,
  authorName: users.name,
  authorAvatarUrl: users.avatarUrl,
  body: messages.body,
  createdAt: messages.createdAt,
  editedAt: messages.editedAt,
  deletedAt: messages.deletedAt,
}

type RawMessage = {
  id: string
  channelId: string
  parentId: string | null
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  body: string
  createdAt: Date
  editedAt: Date | null
  deletedAt: Date | null
}

/**
 * Reply counts and grouped reactions for a set of messages, in two reads.
 * `channelId` pins client-supplied ids (the poll's knownIds) to the channel the
 * caller was checked against — without it, ids from a private channel or DM
 * would leak who reacted and how many replied.
 */
export async function summarize(
  ids: readonly string[],
  viewerId: string,
  channelId?: string,
): Promise<Map<string, MessageSummary>> {
  const out = new Map<string, MessageSummary>()
  if (ids.length === 0) return out
  let list = [...new Set(ids)].slice(0, SUMMARY_LIMIT)
  if (channelId) {
    const own = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.channelId, channelId), inArray(messages.id, list)))
    const keep = new Set(own.map((r) => r.id))
    list = list.filter((id) => keep.has(id))
    if (list.length === 0) return out
  }
  const [replies, reactions] = await Promise.all([
    db
      .select({ parentId: liveMessages.parentId, n: count(), last: max(liveMessages.createdAt) })
      .from(liveMessages)
      .where(inArray(liveMessages.parentId, list))
      .groupBy(liveMessages.parentId),
    db
      .select({ messageId: messageReactions.messageId, emoji: messageReactions.emoji, userId: messageReactions.userId, name: users.name })
      .from(messageReactions)
      .innerJoin(users, eq(users.id, messageReactions.userId))
      // A deleted message keeps its reply count (the thread survives) but not its reactions.
      .innerJoin(liveMessages, eq(liveMessages.id, messageReactions.messageId))
      .where(inArray(messageReactions.messageId, list))
      .orderBy(asc(messageReactions.createdAt)),
  ])
  for (const id of list) out.set(id, { id, replyCount: 0, lastReplyAt: null, reactions: [] })
  for (const r of replies) {
    if (!r.parentId) continue
    const s = out.get(r.parentId)
    if (s) {
      s.replyCount = Number(r.n)
      s.lastReplyAt = r.last ? new Date(r.last) : null
    }
  }
  for (const r of reactions) {
    const s = out.get(r.messageId)
    if (!s) continue
    let group = s.reactions.find((g) => g.emoji === r.emoji)
    if (!group) {
      group = { emoji: r.emoji, count: 0, me: false, names: [] }
      s.reactions.push(group)
    }
    group.count += 1
    group.names.push(r.name)
    if (r.userId === viewerId) group.me = true
  }
  return out
}

async function decorate(rows: RawMessage[], viewerId: string): Promise<ChatMessage[]> {
  const summaries = await summarize(rows.filter((r) => !r.deletedAt).map((r) => r.id), viewerId)
  return rows.map((r) => {
    const s = summaries.get(r.id)
    const deleted = r.deletedAt !== null
    return {
      id: r.id,
      channelId: r.channelId,
      parentId: r.parentId,
      authorId: r.authorId,
      authorName: r.authorName,
      authorAvatarUrl: r.authorAvatarUrl,
      body: deleted ? '' : r.body,
      createdAt: r.createdAt,
      editedAt: deleted ? null : r.editedAt,
      deleted,
      // A deleted root keeps its reply count so its thread stays reachable.
      replyCount: s?.replyCount ?? 0,
      lastReplyAt: s?.lastReplyAt ?? null,
      reactions: deleted ? [] : (s?.reactions ?? []),
    }
  })
}

/** Replies of deleted roots still count, so the deleted-root summary is fetched too. */
async function decorateWithDeletedRoots(rows: RawMessage[], viewerId: string): Promise<ChatMessage[]> {
  const decorated = await decorate(rows, viewerId)
  const deletedRoots = decorated.filter((m) => m.deleted && m.parentId === null).map((m) => m.id)
  if (deletedRoots.length === 0) return decorated
  const s = await summarize(deletedRoots, viewerId)
  return decorated.map((m) => (m.deleted && s.has(m.id) ? { ...m, replyCount: s.get(m.id)!.replyCount, lastReplyAt: s.get(m.id)!.lastReplyAt } : m))
}

/**
 * The newest page of ROOT messages, oldest first, plus whether older ones
 * exist. A deleted root with no replies is dropped — "This message was
 * deleted" only earns its line when something hangs off it.
 */
export async function listRootMessages(
  channelId: string,
  viewerId: string,
  before?: Date,
): Promise<{ messages: ChatMessage[]; hasOlder: boolean }> {
  const filters: SQL[] = [eq(messages.channelId, channelId), isNull(messages.parentId)]
  if (before) filters.push(lt(messages.createdAt, before))
  const rows = await db
    .select(messageFields)
    .from(messages)
    .innerJoin(users, eq(users.id, messages.authorId))
    .where(and(...filters))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(MESSAGE_PAGE + 1)
  const hasOlder = rows.length > MESSAGE_PAGE
  const page = rows.slice(0, MESSAGE_PAGE).reverse()
  const decorated = await decorateWithDeletedRoots(page, viewerId)
  return { messages: decorated.filter((m) => !m.deleted || m.replyCount > 0), hasOlder }
}

/** One message, raw (so edit/delete/react can see a deleted one and refuse it). */
export async function getMessageRow(messageId: string) {
  const [row] = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      parentId: messages.parentId,
      authorId: messages.authorId,
      body: messages.body,
      deletedAt: messages.deletedAt,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1)
  return row ?? null
}

export async function getThread(
  channelId: string,
  rootId: string,
  viewerId: string,
): Promise<{ root: ChatMessage; replies: ChatMessage[] } | null> {
  const [rootRows, replyRows] = await Promise.all([
    db
      .select(messageFields)
      .from(messages)
      .innerJoin(users, eq(users.id, messages.authorId))
      .where(and(eq(messages.id, rootId), eq(messages.channelId, channelId), isNull(messages.parentId)))
      .limit(1),
    db
      .select(messageFields)
      .from(messages)
      .innerJoin(users, eq(users.id, messages.authorId))
      .where(and(eq(messages.parentId, rootId), eq(messages.channelId, channelId)))
      .orderBy(asc(messages.createdAt), asc(messages.id))
      .limit(THREAD_LIMIT),
  ])
  if (rootRows.length === 0) return null
  const [root] = await decorateWithDeletedRoots(rootRows, viewerId)
  const replies = await decorate(replyRows, viewerId)
  return { root, replies }
}

/**
 * What changed in one view since `since`: messages created, edited or
 * deleted, and — for the channel view — roots whose thread got a new reply
 * (so the reply count moves without a reload).
 */
export async function changedSince(
  channelId: string,
  since: Date,
  viewerId: string,
  parentId: string | null,
): Promise<ChatMessage[]> {
  const scope = parentId === null ? isNull(messages.parentId) : eq(messages.parentId, parentId)
  const touched = or(gt(messages.createdAt, since), gt(messages.editedAt, since), gt(messages.deletedAt, since))
  const rows = await db
    .select(messageFields)
    .from(messages)
    .innerJoin(users, eq(users.id, messages.authorId))
    .where(and(eq(messages.channelId, channelId), scope, touched))
    .orderBy(asc(messages.createdAt))
    .limit(MESSAGE_PAGE * 2)

  let extra: RawMessage[] = []
  if (parentId === null) {
    const bumped = await db
      .selectDistinct({ parentId: liveMessages.parentId })
      .from(liveMessages)
      .where(and(eq(liveMessages.channelId, channelId), isNotNull(liveMessages.parentId), gt(liveMessages.createdAt, since)))
    const have = new Set(rows.map((r) => r.id))
    const ids = bumped.map((b) => b.parentId).filter((id): id is string => id !== null && !have.has(id))
    if (ids.length > 0) {
      extra = await db
        .select(messageFields)
        .from(messages)
        .innerJoin(users, eq(users.id, messages.authorId))
        .where(and(eq(messages.channelId, channelId), inArray(messages.id, ids)))
    }
  }
  return decorateWithDeletedRoots([...rows, ...extra], viewerId)
}

/**
 * Files this person shared into this conversation since `since` — the upload
 * rate limit's count. RAW attachments and messages on purpose: a file whose
 * message (or the file itself) was deleted was still uploaded, and a cap that
 * deleting frees is a cap you can loop around.
 */
export async function recentUploadCount(channelId: string, userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(attachments)
    .innerJoin(messages, eq(messages.id, attachments.ownerId))
    .where(
      and(
        eq(attachments.ownerType, 'message'),
        eq(attachments.uploadedBy, userId),
        gt(attachments.createdAt, since),
        eq(messages.channelId, channelId),
      ),
    )
  return Number(row?.n ?? 0)
}

// --- people ----------------------------------------------------------------

export async function getPresence(userIds: readonly string[], now = new Date()): Promise<Record<string, Presence>> {
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return {}
  const rows = await db
    .select({ userId: userPresence.userId, status: userPresence.status, note: userPresence.note, expiresAt: userPresence.expiresAt })
    .from(userPresence)
    .where(inArray(userPresence.userId, ids))
  const out: Record<string, Presence> = {}
  for (const row of rows) {
    const live = effectiveStatus(row, now)
    if (live) out[row.userId] = live
  }
  return out
}

export type ChannelMemberRow = { id: string; name: string; avatarUrl: string | null; role: 'owner' | 'member' }

export async function listMembers(channelId: string): Promise<ChannelMemberRow[]> {
  return db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, role: channelMembers.role })
    .from(channelMembers)
    .innerJoin(users, eq(users.id, channelMembers.userId))
    .where(eq(channelMembers.channelId, channelId))
    .orderBy(asc(users.name))
}

/**
 * Who can READ this conversation — the mention pool, and the only people a
 * mention may notify. A private channel is its members who can still see the
 * project; a DM or group is its active, approved members.
 */
export async function channelReaders(access: ChannelAccess): Promise<{ id: string; name: string }[]> {
  if ((access.kind === 'public' || access.kind === 'context') && access.app) return appViewers(access.app.id)
  const members = await db
    .select({ id: users.id, name: users.name })
    .from(channelMembers)
    .innerJoin(users, eq(users.id, channelMembers.userId))
    .where(and(eq(channelMembers.channelId, access.id), eq(users.active, true), eq(users.status, 'approved')))
  if (access.kind === 'private') {
    if (!access.app) return []
    return appViewers(access.app.id, members.map((m) => m.id))
  }
  return members.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * People this viewer may start a DM or group with. The whole approved
 * directory for a seat that may read it; a seat that may not (stakeholder)
 * gets only the people on its own projects, so a client cannot read the
 * studio's directory out of a "New message" box.
 */
export async function messageablePeople(actor: Actor): Promise<{ id: string; name: string; avatarUrl: string | null }[]> {
  if (can(actor, 'user.view.directory')) {
    return db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(and(eq(users.active, true), eq(users.status, 'approved'), ne(users.id, actor.id)))
      .orderBy(asc(users.name))
  }
  const pools = await Promise.all([...actor.scopeAppIds].map((appId) => appViewers(appId)))
  const ids = [...new Set(pools.flat().map((p) => p.id))].filter((id) => id !== actor.id)
  if (ids.length === 0) return []
  return db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, ids))
    .orderBy(asc(users.name))
}

// --- the conversation list ------------------------------------------------

export type ConversationItem = {
  id: string
  kind: 'public' | 'private' | 'group' | 'dm' | 'context'
  title: string
  /** For a DM: the other person, for the presence dot. */
  otherUserId: string | null
  unread: number
  lastMessageAt: Date | null
  isMember: boolean
}

export type ConversationList = {
  projects: { app: { id: string; slug: string; name: string }; channels: ConversationItem[] }[]
  direct: ConversationItem[]
  groups: ConversationItem[]
  threads: ConversationItem[]
  totalUnread: number
}

/**
 * A context channel's project, read from its LIVE work item — null when the
 * task, page or bug is gone. Only meaningful in a query that left-joins
 * liveTasks/liveDocs/liveBugReports on the channel's context columns.
 */
const contextAppId = sql<string | null>`coalesce(${liveTasks.appId}, ${liveDocs.appId}, ${liveBugReports.appId})`

/**
 * Everything in the left pane, with unread counts. `onlyAppId` narrows it to
 * one project (the project page's Chat tab).
 */
export async function listConversations(actor: Actor, onlyAppId?: string): Promise<ConversationList> {
  const me = actor.id
  const level = effectiveGrant(actor.role, actor.employmentType, 'app.view')
  const scoped = [...actor.scopeAppIds]
  const viewable = (appId: string) => can(actor, 'app.view', { appId })

  const myMembership = and(eq(channelMembers.channelId, channels.id), eq(channelMembers.userId, me))

  // Project channels: public ones in projects the viewer can see, private
  // ones they belong to. Narrowed in SQL, then re-checked with can().
  const appFilter: SQL | undefined =
    onlyAppId
      ? eq(channels.appId, onlyAppId)
      : level === 'all'
        ? undefined
        : scoped.length > 0
          ? inArray(channels.appId, scoped)
          : undefined // unreachable: noProjects skips the read
  const noProjects = level === 'none' || level === 'own' || (level === 'scoped' && scoped.length === 0 && !onlyAppId)

  const [projectRows, personalRows, contextRows] = await Promise.all([
    noProjects
      ? Promise.resolve([])
      : db
          .select({
            id: channels.id,
            kind: channels.kind,
            name: channels.name,
            appId: liveApps.id,
            appSlug: liveApps.slug,
            appName: liveApps.name,
            memberId: channelMembers.userId,
          })
          .from(channels)
          .innerJoin(liveApps, eq(liveApps.id, channels.appId))
          .leftJoin(channelMembers, myMembership)
          .where(
            and(
              inArray(channels.kind, ['public', 'private']),
              isNull(channels.archivedAt),
              appFilter,
              or(eq(channels.kind, 'public'), isNotNull(channelMembers.userId)),
            ),
          )
          .orderBy(asc(liveApps.name), asc(channels.name)),
    onlyAppId
      ? Promise.resolve([])
      : db
          .select({ id: channels.id, kind: channels.kind, name: channels.name })
          .from(channels)
          .innerJoin(channelMembers, myMembership)
          .where(and(inArray(channels.kind, ['dm', 'group']), isNull(channels.archivedAt))),
    // Context threads the viewer has joined (posted in, or opened Discuss).
    // The project is the LIVE item's, never channels.app_id — that column is
    // stamped once at Discuss time and goes stale when the task, page or bug
    // moves project. Same rule as access.ts resolveContextItem; a gone item
    // (or its gone project) drops the row.
    db
      .select({
        id: channels.id,
        appId: liveApps.id,
        taskTitle: liveTasks.title,
        docTitle: liveDocs.title,
        bugTitle: liveBugReports.title,
      })
      .from(channels)
      .innerJoin(channelMembers, myMembership)
      .leftJoin(liveTasks, and(eq(channels.contextType, 'task'), eq(liveTasks.id, channels.contextId)))
      .leftJoin(liveDocs, and(eq(channels.contextType, 'doc'), eq(liveDocs.id, channels.contextId)))
      .leftJoin(liveBugReports, and(eq(channels.contextType, 'bug'), eq(liveBugReports.id, channels.contextId)))
      .innerJoin(liveApps, eq(liveApps.id, contextAppId))
      .where(and(eq(channels.kind, 'context'), onlyAppId ? eq(contextAppId, onlyAppId) : undefined)),
  ])

  const projectChannels = projectRows.filter((r) => viewable(r.appId))
  const threadsLive = contextRows
    .map((r) => {
      const item = r.taskTitle ?? r.docTitle ?? r.bugTitle
      const prefix = r.taskTitle ? 'Task' : r.docTitle ? 'Doc' : 'Bug'
      return item && viewable(r.appId) ? { id: r.id, title: `${prefix}: ${item}` } : null
    })
    .filter((r): r is { id: string; title: string } => r !== null)

  const allIds = [...projectChannels.map((r) => r.id), ...personalRows.map((r) => r.id), ...threadsLive.map((r) => r.id)]

  const personalIds = personalRows.map((r) => r.id)
  const [unreadRows, lastRows, memberRows] = await Promise.all([
    allIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ channelId: liveMessages.channelId, n: count() })
          .from(liveMessages)
          .innerJoin(channelMembers, and(eq(channelMembers.channelId, liveMessages.channelId), eq(channelMembers.userId, me)))
          .where(
            and(
              inArray(liveMessages.channelId, allIds),
              gt(liveMessages.createdAt, channelMembers.lastReadAt),
              ne(liveMessages.authorId, me),
            ),
          )
          .groupBy(liveMessages.channelId),
    allIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ channelId: liveMessages.channelId, last: max(liveMessages.createdAt) })
          .from(liveMessages)
          .where(inArray(liveMessages.channelId, allIds))
          .groupBy(liveMessages.channelId),
    personalIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ channelId: channelMembers.channelId, userId: users.id, name: users.name })
          .from(channelMembers)
          .innerJoin(users, eq(users.id, channelMembers.userId))
          .where(inArray(channelMembers.channelId, personalIds))
          .orderBy(asc(users.name)),
  ])

  const unread = new Map(unreadRows.map((r) => [r.channelId, Number(r.n)]))
  const last = new Map(lastRows.map((r) => [r.channelId, r.last ? new Date(r.last) : null]))
  const byRecent = (a: ConversationItem, b: ConversationItem) =>
    (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)

  const projects = new Map<string, ConversationList['projects'][number]>()
  for (const r of projectChannels) {
    const group = projects.get(r.appId) ?? { app: { id: r.appId, slug: r.appSlug, name: r.appName }, channels: [] }
    group.channels.push({
      id: r.id,
      kind: r.kind,
      title: r.name ?? 'channel',
      otherUserId: null,
      unread: unread.get(r.id) ?? 0,
      lastMessageAt: last.get(r.id) ?? null,
      isMember: r.memberId !== null,
    })
    projects.set(r.appId, group)
  }

  const direct: ConversationItem[] = []
  const groups: ConversationItem[] = []
  for (const r of personalRows) {
    const others = memberRows.filter((m) => m.channelId === r.id && m.userId !== me)
    const item: ConversationItem = {
      id: r.id,
      kind: r.kind,
      title: r.kind === 'dm' ? (others[0]?.name ?? 'Just you') : (r.name ?? groupTitle(others.map((o) => o.name))),
      otherUserId: r.kind === 'dm' ? (others[0]?.userId ?? null) : null,
      unread: unread.get(r.id) ?? 0,
      lastMessageAt: last.get(r.id) ?? null,
      isMember: true,
    }
    ;(r.kind === 'dm' ? direct : groups).push(item)
  }

  const threads: ConversationItem[] = threadsLive.map((t) => ({
    id: t.id,
    kind: 'context',
    title: t.title,
    otherUserId: null,
    unread: unread.get(t.id) ?? 0,
    lastMessageAt: last.get(t.id) ?? null,
    isMember: true,
  }))

  direct.sort(byRecent)
  groups.sort(byRecent)
  threads.sort(byRecent)
  const totalUnread = [...unread.values()].reduce((a, b) => a + b, 0)
  return { projects: [...projects.values()], direct, groups, threads, totalUnread }
}

/**
 * The viewer's unread total across every conversation they can still read —
 * the sidebar Chat badge. ONE query, grouped by kind and project so the can()
 * re-check runs once per project, not per channel; the same visibility rules
 * as listConversations (whose totalUnread this equals), without building the
 * list. A project channel needs its live project to be viewable; a context
 * thread needs its LIVE item's project (contextAppId); DMs and groups need
 * only the membership the join already demands.
 */
export async function countUnread(actor: Actor): Promise<number> {
  const me = actor.id
  const level = effectiveGrant(actor.role, actor.employmentType, 'app.view')
  const projectsVisible = level !== 'none' && level !== 'own'
  const rowAppId = sql<string | null>`case when ${channels.kind} = 'context' then ${contextAppId} else ${channels.appId} end`
  const rows = await db
    .select({ kind: channels.kind, appId: liveApps.id, n: count() })
    .from(liveMessages)
    .innerJoin(channelMembers, and(eq(channelMembers.channelId, liveMessages.channelId), eq(channelMembers.userId, me)))
    .innerJoin(channels, eq(channels.id, liveMessages.channelId))
    .leftJoin(liveTasks, and(eq(channels.contextType, 'task'), eq(liveTasks.id, channels.contextId)))
    .leftJoin(liveDocs, and(eq(channels.contextType, 'doc'), eq(liveDocs.id, channels.contextId)))
    .leftJoin(liveBugReports, and(eq(channels.contextType, 'bug'), eq(liveBugReports.id, channels.contextId)))
    .leftJoin(liveApps, eq(liveApps.id, rowAppId))
    .where(
      and(
        gt(liveMessages.createdAt, channelMembers.lastReadAt),
        ne(liveMessages.authorId, me),
        // The list hides archived project and personal conversations, not threads.
        or(eq(channels.kind, 'context'), isNull(channels.archivedAt)),
      ),
    )
    .groupBy(channels.kind, liveApps.id)
  let total = 0
  for (const r of rows) {
    const n = Number(r.n)
    if (r.kind === 'dm' || r.kind === 'group') total += n
    else if (r.kind === 'context') total += r.appId && can(actor, 'app.view', { appId: r.appId }) ? n : 0
    else total += projectsVisible && r.appId && can(actor, 'app.view', { appId: r.appId }) ? n : 0
  }
  return total
}

/**
 * Live projects this viewer can see, with whether they may start channels
 * there (task.comment) — for "Open a project's chat" and "New channel".
 */
export async function chatProjects(actor: Actor): Promise<{ id: string; name: string; canCreate: boolean }[]> {
  const level = effectiveGrant(actor.role, actor.employmentType, 'app.view')
  if (level === 'none' || level === 'own') return []
  const scoped = [...actor.scopeAppIds]
  if (level === 'scoped' && scoped.length === 0) return []
  const rows = await db
    .select({ id: liveApps.id, name: liveApps.name })
    .from(liveApps)
    .where(level === 'all' ? undefined : inArray(liveApps.id, scoped))
    .orderBy(asc(liveApps.name))
  return rows
    .filter((r) => can(actor, 'app.view', { appId: r.id }))
    .map((r) => ({ ...r, canCreate: can(actor, 'task.comment', { appId: r.id }) }))
}
