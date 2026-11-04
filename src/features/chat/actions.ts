'use server'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { channelMembers, channels, messageReactions, messages, notifications, userPresence, users } from '@/db/schema'
import { liveApps } from '@/db/live'
import { loadActor } from '@/features/auth/actor'
import { can, type Actor } from '@/features/auth/capabilities'
import { createNotifications, extractMentionedUserIds } from '@/features/notifications/notify'
import { appViewers } from '@/features/sprints/app-viewers'
import { ok, err, type ActionResult } from '@/lib/action-result'
import {
  CHANNEL_NAME_MAX,
  GROUP_MAX_MEMBERS,
  MESSAGE_MAX,
  STATUS_DURATIONS,
  dmKey,
  isReaction,
  normalizeChannelName,
  parseStatus,
  statusExpiry,
  type StatusDurationKey,
} from './chat'
import { loadChannelAccess, projectFacts, resolveContextItem, type ChannelAccess, type ContextType } from './access'
import { mentionTargets, pollSince } from './rules'
import {
  changedSince,
  channelReaders,
  countUnread,
  getMessageRow,
  getPresence,
  getThread,
  listRootMessages,
  messageablePeople,
  summarize,
  type ChatMessage,
  type MessageSummary,
  type Presence,
} from './queries'

/**
 * Writes (and the polling read) behind Chat, PRD Module D.
 *
 * EVERY ACTION RE-DERIVES ACCESS FROM THE DATABASE through
 * loadChannelAccess: the client sends a channel or message id, never a
 * project id it wants checked (openProjectChat/createChannel take an appId
 * because the project IS the question, and verify it is live and viewable).
 *
 * neon-http has no interactive transaction, so multi-row creates (a channel
 * plus its first members) mint the id here and go in ONE db.batch. The
 * unique indexes (one DM per pair, one context channel per item, unique
 * channel names per project) are the race guard: a 23505 re-reads the row
 * the other request made.
 *
 * Never throws: every path ends in ok()/err().
 */

const idSchema = z.uuid()
const TOPIC_MAX = 250
const NOTE_MAX = 100

function unexpected(where: string, error: unknown): ActionResult<never> {
  console.error(`[chat] ${where} failed:`, error)
  return err('Something went wrong — try again')
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const e = current as { code?: unknown; message?: unknown; cause?: unknown }
    if (e.code === '23505') return true
    if (typeof e.message === 'string' && e.message.includes('duplicate key')) return true
    current = e.cause
  }
  return false
}

const bodySchema = z
  .string()
  .trim()
  .min(1, 'Write something first')
  .max(MESSAGE_MAX, `A message can be up to ${MESSAGE_MAX} characters`)

async function access(channelId: unknown): Promise<{ actor: Actor; ch: ChannelAccess } | null> {
  if (!idSchema.safeParse(channelId).success) return null
  const actor = await loadActor()
  if (!actor) return null
  const ch = await loadChannelAccess(actor, channelId as string)
  return ch ? { actor, ch } : null
}

/** A member row, idempotently — public and context channels join on first write. */
function joinQuery(channelId: string, userId: string, role: 'owner' | 'member' = 'member') {
  return db.insert(channelMembers).values({ channelId, userId, role }).onConflictDoNothing()
}

function channelLink(channelId: string, rootId?: string | null) {
  return rootId ? `/chat?c=${channelId}&t=${rootId}` : `/chat?c=${channelId}`
}

function placeLabel(ch: ChannelAccess): string {
  if (ch.kind === 'dm') return 'a direct message'
  if (ch.kind === 'group') return 'a group chat'
  if (ch.kind === 'context' && ch.context) return `the discussion on “${ch.context.title}”`
  return `#${ch.name ?? 'channel'}${ch.app ? ` in ${ch.app.name}` : ''}`
}

/**
 * Notify the people a body names — only people who can READ this
 * conversation (channelReaders), and on an edit only names the edit ADDED,
 * so fixing a typo never re-pings anyone. Best effort: the message is saved.
 *
 * On an edit (previousBody given) it also skips anyone who already has a
 * mention notification from this author at this message's link: without that,
 * removing and re-adding @X across edits pinged X every time. The link is the
 * only message trace a notification stores (channelLink); for a REPLY it names
 * the thread, so the skip there is "already pinged by this author in this
 * thread" — slightly broader, never noisier. A new message checks nothing.
 */
async function notifyMentions(
  ch: ChannelAccess,
  actorId: string,
  body: string,
  rootId: string | null,
  previousBody: string | null = null,
): Promise<number> {
  try {
    if (!body.includes('@')) return 0
    const pool = await channelReaders(ch)
    const link = channelLink(ch.id, rootId)
    let ids = mentionTargets({
      mentioned: extractMentionedUserIds(body, pool),
      actorId,
      previouslyMentioned: previousBody === null ? [] : extractMentionedUserIds(previousBody, pool),
    })
    if (ids.length === 0) return 0
    if (previousBody !== null) {
      const already = await db
        .select({ userId: notifications.userId })
        .from(notifications)
        .where(
          and(
            eq(notifications.type, 'mention'),
            eq(notifications.link, link),
            eq(notifications.actorId, actorId),
            inArray(notifications.userId, ids),
          ),
        )
      ids = mentionTargets({ mentioned: ids, actorId, alreadyNotified: already.map((r) => r.userId) })
      if (ids.length === 0) return 0
    }
    const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, actorId))
    const delivered = await createNotifications(
      ids.map((userId) => ({
        userId,
        actorId,
        type: 'mention' as const,
        title: `${me?.name ?? 'Someone'} mentioned you in ${placeLabel(ch)}`,
        // No body preview: a deleted or edited message, or a private channel the
        // reader later leaves, must not live on in their notification bell.
        body: null,
        link,
        ...(ch.app
          ? {
              entity: { type: 'app', id: ch.app.id },
              visibility: { action: 'app.view' as const, resource: { appId: ch.app.id } },
            }
          : {}),
      })),
    )
    return delivered.length
  } catch (error) {
    console.error('[chat] mention notify failed:', error)
    return 0
  }
}

// --- project channels -------------------------------------------------------

async function liveApp(appId: string) {
  const [app] = await db
    .select({ id: liveApps.id, slug: liveApps.slug, name: liveApps.name })
    .from(liveApps)
    .where(eq(liveApps.id, appId))
    .limit(1)
  return app ?? null
}

async function findProjectChannel(appId: string, name: string) {
  const [row] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(
      and(
        eq(channels.appId, appId),
        inArray(channels.kind, ['public', 'private']),
        sql`lower(${channels.name}) = ${name.toLowerCase()}`,
      ),
    )
    .limit(1)
  return row ?? null
}

/** Opens a project's chat: makes its #general the first time anyone looks. */
export async function openProjectChat(appId: string): Promise<ActionResult<{ channelId: string }>> {
  if (!idSchema.safeParse(appId).success) return err('Project not found')
  try {
    const actor = await loadActor()
    if (!actor) return err('Not signed in')
    const app = await liveApp(appId)
    if (!app || !can(actor, 'app.view', { appId })) return err('Project not found')
    const existing = await findProjectChannel(appId, 'general')
    if (existing) return ok({ channelId: existing.id })
    await db
      .insert(channels)
      .values({ kind: 'public', appId, name: 'general', topic: `Everything about ${app.name}`, createdBy: actor.id })
      .onConflictDoNothing()
    const made = await findProjectChannel(appId, 'general')
    return made ? ok({ channelId: made.id }) : err('Could not open the project chat — try again')
  } catch (error) {
    return unexpected('openProjectChat', error)
  }
}

export async function createChannel(input: {
  appId: string
  name: string
  kind: 'public' | 'private'
  topic?: string
}): Promise<ActionResult<{ channelId: string }>> {
  if (!idSchema.safeParse(input?.appId).success) return err('Project not found')
  if (input.kind !== 'public' && input.kind !== 'private') return err('Choose public or private')
  const name = normalizeChannelName(String(input.name ?? ''))
  if (!name) return err(`Use 2–${CHANNEL_NAME_MAX} letters, numbers or dashes for the name`)
  const topic = String(input.topic ?? '').trim().slice(0, TOPIC_MAX) || null
  try {
    const actor = await loadActor()
    if (!actor) return err('Not signed in')
    const app = await liveApp(input.appId)
    if (!app) return err('Project not found')
    const facts = projectFacts(actor, app.id)
    if (!facts.canView) return err('Project not found')
    if (!facts.canComment) return err('You can read this project but not start channels in it')
    const channelId = randomUUID()
    await db.batch([
      db.insert(channels).values({ id: channelId, kind: input.kind, appId: app.id, name, topic, createdBy: actor.id }),
      joinQuery(channelId, actor.id, 'owner'),
    ])
    return ok({ channelId })
  } catch (error) {
    if (isUniqueViolation(error)) return err(`#${name} already exists in this project`)
    return unexpected('createChannel', error)
  }
}

export async function joinChannel(channelId: string): Promise<ActionResult> {
  try {
    const a = await access(channelId)
    if (!a || !a.ch.perms.read) return err('Conversation not found')
    if (a.ch.kind !== 'public' && a.ch.kind !== 'context') return err('Ask a member to add you')
    await joinQuery(a.ch.id, a.actor.id)
    return ok(undefined)
  } catch (error) {
    return unexpected('joinChannel', error)
  }
}

// --- DMs and groups -----------------------------------------------------------

async function findDm(key: string) {
  const [row] = await db.select({ id: channels.id }).from(channels).where(eq(channels.dmKey, key)).limit(1)
  return row ?? null
}

/**
 * Off by the user's rule: project talk stays inside the project, so no DMs or
 * groups outside one. Refused here, not only hidden in the UI, because a
 * server action is callable from any browser. The rest of the DM/group code
 * stays so the rule can be reversed in one line.
 */
const PERSONAL_CHAT_OFF = 'Chat happens inside a project — open the project and use its Chat tab'

export async function openDm(userId: string): Promise<ActionResult<{ channelId: string }>> {
  if (PERSONAL_CHAT_OFF) return err(PERSONAL_CHAT_OFF)
  if (!idSchema.safeParse(userId).success) return err('Person not found')
  try {
    const actor = await loadActor()
    if (!actor) return err('Not signed in')
    if (userId === actor.id) return err('Choose someone other than yourself')
    const people = await messageablePeople(actor)
    if (!people.some((p) => p.id === userId)) return err('Person not found')
    const key = dmKey(actor.id, userId)
    const existing = await findDm(key)
    if (existing) return ok({ channelId: existing.id })
    const channelId = randomUUID()
    try {
      await db.batch([
        db.insert(channels).values({ id: channelId, kind: 'dm', dmKey: key, createdBy: actor.id }),
        joinQuery(channelId, actor.id),
        joinQuery(channelId, userId),
      ])
      return ok({ channelId })
    } catch (error) {
      // Both people opened it at once: the other request's channel wins.
      if (!isUniqueViolation(error)) throw error
      const made = await findDm(key)
      return made ? ok({ channelId: made.id }) : err('Could not open the conversation — try again')
    }
  } catch (error) {
    return unexpected('openDm', error)
  }
}

export async function createGroup(userIds: string[], name?: string): Promise<ActionResult<{ channelId: string }>> {
  if (PERSONAL_CHAT_OFF) return err(PERSONAL_CHAT_OFF)
  try {
    const actor = await loadActor()
    if (!actor) return err('Not signed in')
    const others = [...new Set(Array.isArray(userIds) ? userIds : [])].filter((id) => id !== actor.id)
    if (others.length < 2) return err('Choose at least two people — for one person, send a direct message')
    if (others.length + 1 > GROUP_MAX_MEMBERS) return err(`A group can have up to ${GROUP_MAX_MEMBERS} people`)
    if (!others.every((id) => idSchema.safeParse(id).success)) return err('Person not found')
    const allowed = new Set((await messageablePeople(actor)).map((p) => p.id))
    if (!others.every((id) => allowed.has(id))) return err('Someone you chose cannot be messaged')
    const title = String(name ?? '').trim().slice(0, CHANNEL_NAME_MAX * 2) || null
    const channelId = randomUUID()
    await db.batch([
      db.insert(channels).values({ id: channelId, kind: 'group', name: title, createdBy: actor.id }),
      joinQuery(channelId, actor.id, 'owner'),
      db.insert(channelMembers).values(others.map((id) => ({ channelId, userId: id, role: 'member' as const }))).onConflictDoNothing(),
    ])
    return ok({ channelId })
  } catch (error) {
    return unexpected('createGroup', error)
  }
}

/**
 * Add people to a group without ever passing GROUP_MAX_MEMBERS, with no
 * interactive transaction. Count-then-insert from two requests at once could
 * both see room for their batch and together overfill the group.
 *
 * ONE db.batch (one transaction on neon-http): the first statement row-locks
 * the channel, so a concurrent add waits there until this batch commits; the
 * second is an INSERT … SELECT whose WHERE counts the members as they are once
 * the lock is held (READ COMMITTED takes a fresh snapshot per statement) and
 * inserts all of the newcomers or none of them. Returns who went in.
 */
async function addToGroupGuarded(channelId: string, userIds: string[]): Promise<string[]> {
  const wanted = sql.join(
    userIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  )
  const [, result] = await db.batch([
    db.select({ id: channels.id }).from(channels).where(eq(channels.id, channelId)).for('update'),
    db.execute<{ user_id: string }>(sql`
      with fresh as (
        select w.id from unnest(array[${wanted}]) as w(id)
        where not exists (
          select 1 from channel_members m where m.channel_id = ${channelId}::uuid and m.user_id = w.id
        )
      )
      insert into channel_members (channel_id, user_id, role)
      select ${channelId}::uuid, f.id, 'member' from fresh f
      where (select count(*) from channel_members m where m.channel_id = ${channelId}::uuid)
          + (select count(*) from fresh) <= ${GROUP_MAX_MEMBERS}
      on conflict do nothing
      returning user_id
    `),
  ])
  return result.rows.map((r) => r.user_id)
}

export async function addMembers(channelId: string, userIds: string[]): Promise<ActionResult<{ added: number }>> {
  try {
    const a = await access(channelId)
    if (!a) return err('Conversation not found')
    const { actor, ch } = a
    if (!ch.perms.addMembers) return err('You cannot add people here')
    const ids = [...new Set(Array.isArray(userIds) ? userIds : [])].filter((id) => idSchema.safeParse(id).success)
    if (ids.length === 0) return err('Choose someone to add')
    // A manager may add others to a private channel, never themselves: that would
    // hand them its whole history without any member letting them in.
    if (!ch.member && ids.includes(actor.id)) return err('Ask a member of this channel to add you')

    let allowed: Set<string>
    if (ch.kind === 'private' && ch.app) {
      // Only people who can see the project — a private channel is project work.
      allowed = new Set((await appViewers(ch.app.id, ids)).map((p) => p.id))
    } else if (ch.kind === 'group') {
      allowed = new Set((await messageablePeople(actor)).map((p) => p.id))
    } else {
      return err('You cannot add people here')
    }
    if (!ids.every((id) => allowed.has(id))) return err('Someone you chose cannot join this conversation')
    if (ch.kind === 'group') {
      const inserted = await addToGroupGuarded(ch.id, ids)
      if (inserted.length === 0) {
        // Nothing went in: either everyone was already here, or the group is full.
        const present = await db
          .select({ userId: channelMembers.userId })
          .from(channelMembers)
          .where(and(eq(channelMembers.channelId, ch.id), inArray(channelMembers.userId, ids)))
        if (present.length < ids.length) return err(`A group can have up to ${GROUP_MAX_MEMBERS} people`)
      }
      return ok({ added: inserted.length })
    }
    const inserted = await db
      .insert(channelMembers)
      .values(ids.map((id) => ({ channelId: ch.id, userId: id, role: 'member' as const })))
      .onConflictDoNothing()
      .returning({ userId: channelMembers.userId })
    return ok({ added: inserted.length })
  } catch (error) {
    return unexpected('addMembers', error)
  }
}

export async function leaveChannel(channelId: string): Promise<ActionResult> {
  try {
    const a = await access(channelId)
    if (!a || !a.ch.member) return err('You are not in this conversation')
    if (a.ch.kind === 'dm') return err('You cannot leave a direct message')
    // A private channel is reachable only through its member rows: the last
    // one out would strand it (and its history) where nobody can open it or
    // add anyone back.
    if (a.ch.kind === 'private' || a.ch.kind === 'group') {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(channelMembers)
        .where(eq(channelMembers.channelId, a.ch.id))
      if (n <= 1) return err('You are the last member — add someone else before you leave')
    }
    // A hard delete: channel_members has no deletedAt — leaving IS the row's
    // absence (db/live.test.ts DELETE_ALLOWED_FUNCTIONS).
    await db
      .delete(channelMembers)
      .where(and(eq(channelMembers.channelId, a.ch.id), eq(channelMembers.userId, a.actor.id)))
    return ok(undefined)
  } catch (error) {
    return unexpected('leaveChannel', error)
  }
}

// --- messages ------------------------------------------------------------------

export async function postMessage(input: {
  channelId: string
  body: string
  parentId?: string | null
}): Promise<ActionResult<{ message: ChatMessage; mentioned: number }>> {
  const parsed = bodySchema.safeParse(input?.body)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const text = parsed.data
  const parentId = input.parentId ?? null
  if (parentId !== null && !idSchema.safeParse(parentId).success) return err('That message no longer exists')
  try {
    const a = await access(input.channelId)
    if (!a || !a.ch.perms.read) return err('Conversation not found')
    const { actor, ch } = a
    if (!ch.perms.write) return err(ch.archived ? 'This conversation is archived' : 'You can read this conversation but not post in it')

    if (parentId) {
      const parent = await getMessageRow(parentId)
      // Threads are one level deep: a reply hangs off a ROOT in this channel.
      if (!parent || parent.channelId !== ch.id || parent.parentId !== null || parent.deletedAt) {
        return err('That message no longer exists')
      }
    }

    const id = randomUUID()
    const now = new Date()
    const [inserted] = await db.batch([
      db
        .insert(messages)
        .values({ id, channelId: ch.id, authorId: actor.id, parentId, body: text })
        .returning({ createdAt: messages.createdAt }),
      joinQuery(ch.id, actor.id),
      db
        .update(channelMembers)
        .set({ lastReadAt: now })
        .where(and(eq(channelMembers.channelId, ch.id), eq(channelMembers.userId, actor.id))),
    ])
    const [me] = await db.select({ name: users.name, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, actor.id))
    const mentioned = await notifyMentions(ch, actor.id, text, parentId ?? id)

    return ok({
      message: {
        id,
        channelId: ch.id,
        parentId,
        authorId: actor.id,
        authorName: me?.name ?? 'You',
        authorAvatarUrl: me?.avatarUrl ?? null,
        body: text,
        createdAt: inserted[0]?.createdAt ?? now,
        editedAt: null,
        deleted: false,
        replyCount: 0,
        lastReplyAt: null,
        reactions: [],
      },
      mentioned,
    })
  } catch (error) {
    return unexpected('postMessage', error)
  }
}

export async function editMessage(messageId: string, body: string): Promise<ActionResult<{ editedAt: Date }>> {
  if (!idSchema.safeParse(messageId).success) return err('Message not found')
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  try {
    const row = await getMessageRow(messageId)
    if (!row || row.deletedAt) return err('Message not found')
    const a = await access(row.channelId)
    if (!a || !a.ch.perms.read) return err('Message not found')
    // Author only, no moderator override: putting words in somebody's mouth is not moderation.
    if (row.authorId !== a.actor.id) return err('Only the author can edit a message')
    if (!a.ch.perms.write) return err('You can no longer post in this conversation')
    const editedAt = new Date()
    const updated = await db
      .update(messages)
      .set({ body: parsed.data, editedAt })
      .where(and(eq(messages.id, row.id), isNull(messages.deletedAt)))
      .returning({ id: messages.id })
    if (updated.length === 0) return err('Message not found')
    await notifyMentions(a.ch, a.actor.id, parsed.data, row.parentId ?? row.id, row.body)
    return ok({ editedAt })
  } catch (error) {
    return unexpected('editMessage', error)
  }
}

export async function deleteMessage(messageId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(messageId).success) return err('Message not found')
  try {
    const row = await getMessageRow(messageId)
    if (!row || row.deletedAt) return err('Message not found')
    const a = await access(row.channelId)
    if (!a || !a.ch.perms.read) return err('Message not found')
    const isAuthor = row.authorId === a.actor.id
    if (!isAuthor && !a.ch.perms.moderate) return err('Only the author can delete this message')
    // SOFT: "This message was deleted" stays in place (messages is in SOFT_TABLES).
    const marked = await db
      .update(messages)
      .set({ deletedAt: new Date(), deletedBy: a.actor.id })
      .where(and(eq(messages.id, row.id), isNull(messages.deletedAt)))
      .returning({ id: messages.id })
    if (marked.length === 0) return err('Message not found')
    return ok(undefined)
  } catch (error) {
    return unexpected('deleteMessage', error)
  }
}

export async function toggleReaction(messageId: string, emoji: string): Promise<ActionResult<MessageSummary>> {
  if (!idSchema.safeParse(messageId).success) return err('Message not found')
  if (!isReaction(emoji)) return err('Choose one of the offered reactions')
  try {
    const row = await getMessageRow(messageId)
    if (!row || row.deletedAt) return err('Message not found')
    const a = await access(row.channelId)
    if (!a || !a.ch.perms.read) return err('Message not found')
    if (!a.ch.perms.write) return err('You can read this conversation but not react in it')
    const mine = and(
      eq(messageReactions.messageId, row.id),
      eq(messageReactions.userId, a.actor.id),
      eq(messageReactions.emoji, emoji),
    )
    // A reaction is a row's presence; taking it back is its absence (no
    // deletedAt on message_reactions — DELETE_ALLOWED_FUNCTIONS).
    const removed = await db.delete(messageReactions).where(mine).returning({ emoji: messageReactions.emoji })
    if (removed.length === 0) {
      await db.batch([
        db.insert(messageReactions).values({ messageId: row.id, userId: a.actor.id, emoji }).onConflictDoNothing(),
        joinQuery(a.ch.id, a.actor.id),
      ])
    }
    const summary = (await summarize([row.id], a.actor.id)).get(row.id)
    return ok(summary ?? { id: row.id, replyCount: 0, lastReplyAt: null, reactions: [] })
  } catch (error) {
    return unexpected('toggleReaction', error)
  }
}

/**
 * The sidebar Chat badge's number. Takes nothing from the client: the viewer
 * is the session, and countUnread applies the same visibility as the list.
 */
export async function chatUnreadTotal(): Promise<ActionResult<{ unread: number }>> {
  try {
    const actor = await loadActor()
    if (!actor) return err('Not signed in')
    return ok({ unread: await countUnread(actor) })
  } catch (error) {
    return unexpected('chatUnreadTotal', error)
  }
}

export async function markRead(channelId: string): Promise<ActionResult> {
  try {
    const a = await access(channelId)
    if (!a || !a.ch.perms.read) return err('Conversation not found')
    if (!a.ch.member) return ok(undefined) // nothing to track until they join
    const now = new Date()
    await db
      .update(channelMembers)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(channelMembers.channelId, a.ch.id),
          eq(channelMembers.userId, a.actor.id),
          // Never backwards — two tabs, one slow.
          sql`${channelMembers.lastReadAt} < ${now}`,
        ),
      )
    return ok(undefined)
  } catch (error) {
    return unexpected('markRead', error)
  }
}

export type PollResult = {
  serverNow: string
  changed: ChatMessage[]
  summaries: MessageSummary[]
  presence: Record<string, Presence>
}

/**
 * New, edited and deleted messages since the last poll, plus fresh reply
 * counts and reactions for the messages already on screen (`knownIds`) —
 * a removed reaction leaves no timestamp to poll for, so the summaries are
 * re-read rather than diffed.
 */
export async function pollChannel(input: {
  channelId: string
  afterIso: string
  parentId?: string | null
  knownIds?: string[]
}): Promise<ActionResult<PollResult>> {
  const parentId = input?.parentId ?? null
  if (parentId !== null && !idSchema.safeParse(parentId).success) return err('Thread not found')
  try {
    const a = await access(input.channelId)
    if (!a || !a.ch.perms.read) return err('Conversation not found')
    const now = new Date()
    const since = pollSince(String(input.afterIso ?? ''), now)
    if (!since) return err('Bad poll cursor')
    const known = (Array.isArray(input.knownIds) ? input.knownIds : [])
      .filter((id) => idSchema.safeParse(id).success)
      .slice(-100)
    const [changed, summaryMap] = await Promise.all([
      changedSince(a.ch.id, since, a.actor.id, parentId),
      summarize(known, a.actor.id, a.ch.id),
    ])
    const presence = await getPresence(changed.map((m) => m.authorId), now)
    return ok({ serverNow: now.toISOString(), changed, summaries: [...summaryMap.values()], presence })
  } catch (error) {
    return unexpected('pollChannel', error)
  }
}

export async function loadOlder(channelId: string, beforeIso: string): Promise<ActionResult<{ messages: ChatMessage[]; hasOlder: boolean; presence: Record<string, Presence> }>> {
  try {
    const a = await access(channelId)
    if (!a || !a.ch.perms.read) return err('Conversation not found')
    const before = new Date(beforeIso)
    if (Number.isNaN(before.getTime())) return err('Bad cursor')
    const page = await listRootMessages(a.ch.id, a.actor.id, before)
    const presence = await getPresence(page.messages.map((m) => m.authorId))
    return ok({ ...page, presence })
  } catch (error) {
    return unexpected('loadOlder', error)
  }
}

export async function loadThread(channelId: string, rootId: string): Promise<ActionResult<{ root: ChatMessage; replies: ChatMessage[] }>> {
  if (!idSchema.safeParse(rootId).success) return err('Thread not found')
  try {
    const a = await access(channelId)
    if (!a || !a.ch.perms.read) return err('Conversation not found')
    const thread = await getThread(a.ch.id, rootId, a.actor.id)
    return thread ? ok(thread) : err('Thread not found')
  } catch (error) {
    return unexpected('loadThread', error)
  }
}

// --- contextual communication ------------------------------------------------

async function findContextChannel(type: ContextType, id: string) {
  const [row] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.contextType, type), eq(channels.contextId, id)))
    .limit(1)
  return row ?? null
}

/** The conversation attached to one task, page or bug — made on first use. */
export async function discuss(input: { type: ContextType; id: string }): Promise<ActionResult<{ channelId: string }>> {
  const type = input?.type
  if (type !== 'task' && type !== 'doc' && type !== 'bug') return err('Nothing to discuss')
  if (!idSchema.safeParse(input.id).success) return err('Not found')
  try {
    const actor = await loadActor()
    if (!actor) return err('Not signed in')
    const item = await resolveContextItem(type, input.id)
    if (!item || !can(actor, 'app.view', { appId: item.appId })) return err('Not found')
    let channel = await findContextChannel(type, input.id)
    if (!channel) {
      await db
        .insert(channels)
        .values({ kind: 'context', appId: item.appId, contextType: type, contextId: input.id, createdBy: actor.id })
        .onConflictDoNothing()
      channel = await findContextChannel(type, input.id)
      if (!channel) return err('Could not open the discussion — try again')
    }
    // Joined so it lists under "Threads on work items" for them.
    await joinQuery(channel.id, actor.id)
    return ok({ channelId: channel.id })
  } catch (error) {
    return unexpected('discuss', error)
  }
}

// --- presence ----------------------------------------------------------------

export async function setPresence(input: {
  status: string
  note?: string
  duration: StatusDurationKey
}): Promise<ActionResult<Presence>> {
  const status = parseStatus(input?.status)
  if (!status) return err('Choose a status')
  if (!STATUS_DURATIONS.some((d) => d.key === input.duration)) return err('Choose when to clear it')
  const note = String(input.note ?? '').trim().slice(0, NOTE_MAX) || null
  try {
    const actor = await loadActor()
    if (!actor) return err('Not signed in')
    const now = new Date()
    const expiresAt = statusExpiry(input.duration, now)
    await db
      .insert(userPresence)
      .values({ userId: actor.id, status, note, expiresAt, updatedAt: now })
      .onConflictDoUpdate({ target: userPresence.userId, set: { status, note, expiresAt, updatedAt: now } })
    return ok({ status, note, expiresAt })
  } catch (error) {
    return unexpected('setPresence', error)
  }
}

/** Expired-now rather than deleted: an expired status reads as none. */
export async function clearPresence(): Promise<ActionResult> {
  try {
    const actor = await loadActor()
    if (!actor) return err('Not signed in')
    const now = new Date()
    await db.update(userPresence).set({ expiresAt: now, updatedAt: now }).where(eq(userPresence.userId, actor.id))
    return ok(undefined)
  } catch (error) {
    return unexpected('clearPresence', error)
  }
}
