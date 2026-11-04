import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import type { Actor } from '@/features/auth/capabilities'
import { isUuid } from '@/features/sprints/attachments'
import { appViewers } from '@/features/sprints/app-viewers'
import { cn } from '@/lib/utils'
import { openProjectChat } from '@/features/chat/actions'
import { loadChannelAccess } from '@/features/chat/access'
import {
  channelReaders,
  chatProjects,
  getPresence,
  getThread,
  listConversations,
  listMembers,
  listRootMessages,
  listSharedFiles,
  messageablePeople,
} from '@/features/chat/queries'
import { groupTitle } from '@/features/chat/rules'
import { ConversationList, NoConversation } from './conversation-list'
import { Conversation, type ConversationChannel } from './conversation'
import { NewChannelDialog, NewMessageDialog, StatusDialog } from './chat-dialogs'

/**
 * Chat's two panes, shared by /chat and a project's Chat tab (`app` set:
 * only that project's channels and threads, and #general opens by default).
 * A server component that reads its own URL state — ?c=<channel> opens a
 * conversation, &t=<message> its thread — and loads only what is open.
 *
 * Access is decided per conversation by loadChannelAccess; an id the viewer
 * cannot read renders the same "pick a conversation" as no id at all. On a
 * project tab a channel from ANOTHER project is refused the same way, so a
 * pasted link cannot render someone else's channel under this project.
 *
 * Three panes on a wide screen — list, conversation, details (the details
 * column is the Conversation's own, see conversation.tsx). Shared files for
 * the details load here, after loadChannelAccess, like every one-channel read.
 *
 * Mobile shows one pane at a time: the list without ?c, the conversation
 * with it (its header has a Back link), details as a sheet over it.
 */

type Search = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export async function ChatWorkspace({
  actor,
  search,
  app,
  baseHref,
}: {
  actor: Actor
  search: Search
  app?: { id: string; slug: string; name: string }
  baseHref: string
}) {
  let c = one(search.c)
  if (app && !c) {
    const general = await openProjectChat(app.id)
    if (general.ok) c = general.data.channelId
  }
  const t = one(search.t)

  const [list, projects, people, mine, viewerRows] = await Promise.all([
    listConversations(actor, app?.id),
    chatProjects(actor),
    app ? Promise.resolve([]) : messageablePeople(actor),
    getPresence([actor.id]),
    db.select({ name: users.name, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, actor.id)),
  ])
  const viewer = { id: actor.id, name: viewerRows[0]?.name ?? 'You', avatarUrl: viewerRows[0]?.avatarUrl ?? null }
  const serverNow = new Date().toISOString()

  const ch = c && isUuid(c) ? await loadChannelAccess(actor, c) : null
  const canOpen = ch !== null && ch.perms.read && (!app || ch.app?.id === app.id)

  let conversation: React.ReactNode = <NoConversation />
  if (ch && canOpen) {
    const [page, members, readers, thread, sharedFiles] = await Promise.all([
      listRootMessages(ch.id, actor.id),
      listMembers(ch.id),
      channelReaders(ch),
      t && isUuid(t) ? getThread(ch.id, t, actor.id) : Promise.resolve(null),
      listSharedFiles(ch.id),
    ])
    const memberIds = new Set(members.map((m) => m.id))
    let addable: { id: string; name: string }[] = []
    if (ch.perms.addMembers) {
      const pool = ch.kind === 'private' && ch.app ? await appViewers(ch.app.id) : ch.kind === 'group' ? await messageablePeople(actor) : []
      addable = pool.filter((p) => !memberIds.has(p.id)).map((p) => ({ id: p.id, name: p.name }))
    }
    const others = members.filter((m) => m.id !== actor.id)
    const title =
      ch.kind === 'dm'
        ? (others[0]?.name ?? 'Just you')
        : ch.kind === 'group'
          ? (ch.name ?? groupTitle(others.map((o) => o.name)))
          : ch.kind === 'context' && ch.context
            ? `${ch.context.type === 'task' ? 'Task' : ch.context.type === 'doc' ? 'Doc' : 'Bug'}: ${ch.context.title}`
            : (ch.name ?? 'channel')
    const authorIds = [
      ...page.messages.map((m) => m.authorId),
      ...(thread ? [thread.root.authorId, ...thread.replies.map((r) => r.authorId)] : []),
      ...members.map((m) => m.id),
    ]
    const presence = await getPresence(authorIds)
    const channel: ConversationChannel = {
      id: ch.id,
      kind: ch.kind,
      title,
      topic: ch.topic,
      projectName: ch.app?.name ?? null,
      contextHref: ch.context?.href ?? null,
      isMember: ch.member !== null,
      archived: ch.archived,
      canWrite: ch.perms.write,
      canAddMembers: ch.perms.addMembers,
      canModerate: ch.perms.moderate,
      canAttach: true, // every conversation takes files since 0084
      otherUserId: ch.kind === 'dm' ? (others[0]?.id ?? null) : null,
    }
    conversation = (
      <Conversation
        key={ch.id}
        channel={channel}
        initial={page}
        initialThread={thread}
        presence={presence}
        mentionUsers={readers.filter((r) => r.id !== actor.id)}
        members={members}
        addablePeople={addable}
        sharedFiles={sharedFiles}
        viewer={viewer}
        serverNow={serverNow}
        baseHref={baseHref}
      />
    )
  }

  const dmOthers = list.direct.map((d) => d.otherUserId).filter((id): id is string => id !== null)
  const listPresence = dmOthers.length > 0 ? await getPresence(dmOthers) : {}
  const creatable = projects.filter((p) => p.canCreate)
  const open = ch !== null && canOpen

  return (
    <div className="flex h-[calc(100svh-9rem)] min-h-[26rem] overflow-hidden rounded-xl border bg-card">
      <aside
        className={cn(
          'min-h-0 w-full flex-col border-r md:flex md:w-72 md:shrink-0 lg:w-80',
          open ? 'hidden' : 'flex',
        )}
      >
        <div className="border-b px-2 py-2">
          <StatusDialog current={mine[actor.id] ?? null} defaultOpen={one(search.status) === '1'} />
        </div>
        <ConversationList
          list={list}
          activeId={open && ch ? ch.id : null}
          baseHref={baseHref}
          presence={listPresence}
          serverNow={serverNow}
          openableProjects={app ? [] : projects}
          showPersonal={!app}
          actions={
            <>
              {creatable.length > 0 && (!app || creatable.some((p) => p.id === app.id)) ? (
                <NewChannelDialog projects={app ? [{ id: app.id, name: app.name }] : creatable} defaultAppId={app?.id} baseHref={baseHref} />
              ) : null}
              {app ? null : <NewMessageDialog people={people} baseHref={baseHref} defaultOpen={one(search.new) === '1'} />}
            </>
          }
        />
      </aside>
      <div className={cn('min-w-0 flex-1 flex-col', open ? 'flex' : 'hidden md:flex')}>{conversation}</div>
    </div>
  )
}
