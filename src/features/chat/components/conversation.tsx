'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import Link from 'next/link'
import { format, isToday, isYesterday } from 'date-fns'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Hash,
  Lock,
  MessageSquareReply,
  Paperclip,
  Pencil,
  Plus,
  SendHorizontal,
  SmilePlus,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { MentionTextarea, type MentionUser } from '@/components/mention-textarea'
import { MarkdownView } from '@/features/docs/components/markdown-view'
import { ATTACHMENT_ACCEPT, checkAttachmentMeta } from '@/features/sprints/attachments'
import { CHAT_POLL_MS, MESSAGE_MAX, REACTIONS } from '@/features/chat/chat'
import {
  deleteMessage,
  editMessage,
  joinChannel,
  leaveChannel,
  loadOlder,
  loadThread,
  markRead,
  pollChannel,
  postMessage,
  toggleReaction,
} from '@/features/chat/actions'
import type { ChatMessage, MessageSummary, Presence } from '@/features/chat/queries'
import { nextRejectCount, pollGaveUp, withParams } from '@/features/chat/rules'
import { remarkMentions, type MentionPerson } from '@/features/chat/mentions'
import { PresenceDot, PresenceLabel } from './presence'
import { AddMembersDialog } from './chat-dialogs'

/**
 * One open conversation: the message list, the composer, and the thread side
 * panel. Data arrives server-rendered for the first paint; after that the
 * view keeps itself current by POLLING (pollChannel every CHAT_POLL_MS) —
 * this host has no socket — and only while the tab is visible, so a
 * background tab costs nothing.
 *
 * API-skill choices: optimistic send / react / edit / delete with rollback;
 * smart polling (visibility-gated, immediate on return, merged by id so the
 * poll overlap never duplicates a row); request dedup (one poll in flight per
 * feed, a generation counter drops answers for a conversation you left).
 * Streaming and preloading do not fit: messages are small rows.
 *
 * A poll the server REFUSES POLL_REJECT_LIMIT times in a row (rules.ts) means
 * the conversation is gone for this viewer: polling stops and the view says
 * so, with a way back to /chat. A thrown poll (offline) is not a refusal.
 *
 * @mentions of people this conversation knows render highlighted through a
 * remark plugin (chat/mentions.ts), built once per conversation and handed to
 * every message by context — MarkdownView still renders no raw HTML.
 */

type MarkdownPlugins = NonNullable<Parameters<typeof MarkdownView>[0]['remarkPlugins']>
const MentionPlugins = createContext<MarkdownPlugins>([])

export type ConversationChannel = {
  id: string
  kind: 'public' | 'private' | 'group' | 'dm' | 'context'
  title: string
  topic: string | null
  projectName: string | null
  contextHref: string | null
  isMember: boolean
  archived: boolean
  canWrite: boolean
  canAddMembers: boolean
  canModerate: boolean
  /** Files need a project (attachments are filed under one). */
  canAttach: boolean
  otherUserId: string | null
}

type Viewer = { id: string; name: string; avatarUrl: string | null }

type Props = {
  channel: ConversationChannel
  initial: { messages: ChatMessage[]; hasOlder: boolean }
  initialThread: { root: ChatMessage; replies: ChatMessage[] } | null
  presence: Record<string, Presence>
  mentionUsers: MentionUser[]
  members: {
    id: string
    name: string
    avatarUrl: string | null
    role: 'owner' | 'member'
  }[]
  addablePeople: { id: string; name: string }[]
  viewer: Viewer
  serverNow: string
  /** "/chat" or "/apps/<slug>?tab=chat" — links add c/t to it. */
  baseHref: string
}

let tmpSeq = 0

function sortByTime(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id),
  )
}

function applySummaries(list: ChatMessage[], summaries: MessageSummary[]): ChatMessage[] {
  if (summaries.length === 0) return list
  const byId = new Map(summaries.map((s) => [s.id, s]))
  return list.map((m) => {
    const s = byId.get(m.id)
    return s && !m.deleted
      ? {
          ...m,
          replyCount: s.replyCount,
          lastReplyAt: s.lastReplyAt,
          reactions: s.reactions,
        }
      : m
  })
}

function mergeChanged(list: ChatMessage[], changed: ChatMessage[], roots: boolean): ChatMessage[] {
  if (changed.length === 0) return list
  const byId = new Map(list.map((m) => [m.id, m]))
  for (const m of changed) byId.set(m.id, m)
  let merged = sortByTime([...byId.values()])
  if (roots) merged = merged.filter((m) => !m.deleted || m.replyCount > 0)
  return merged
}

/**
 * The polling feed for one view (the channel's roots, or one thread).
 * Owns the list and keeps it current; callers mutate it optimistically
 * through setMessages.
 */
function useFeed(
  channelId: string,
  parentId: string | null,
  initialMessages: ChatMessage[],
  serverNow: string,
  onPresence: (p: Record<string, Presence>) => void,
  onOthersPosted: () => void,
  viewerId: string,
) {
  const [messages, setMessages] = useState(initialMessages)
  const [lost, setLost] = useState(false)
  const cursor = useRef(serverNow)
  const inFlight = useRef(false)
  const generation = useRef(0)
  const rejects = useRef(0)
  const listRef = useRef(messages)
  useEffect(() => {
    listRef.current = messages
  }, [messages])

  const poll = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    const mine = generation.current
    try {
      const knownIds = listRef.current
        .filter((m) => !m.id.startsWith('tmp-'))
        .slice(-100)
        .map((m) => m.id)
      const result = await pollChannel({
        channelId,
        afterIso: cursor.current,
        parentId,
        knownIds,
      })
      if (mine !== generation.current) return
      rejects.current = nextRejectCount(rejects.current, result.ok)
      if (!result.ok) {
        if (pollGaveUp(rejects.current)) setLost(true)
        return
      }
      cursor.current = result.data.serverNow
      const { changed, summaries, presence } = result.data
      setMessages((list) => mergeChanged(applySummaries(list, summaries), changed, parentId === null))
      if (Object.keys(presence).length > 0) onPresence(presence)
      if (changed.some((m) => m.authorId !== viewerId && !m.deleted)) onOthersPosted()
    } catch {
      // Offline or mid-deploy: the next tick tries again.
    } finally {
      inFlight.current = false
    }
  }, [channelId, parentId, onPresence, onOthersPosted, viewerId])

  useEffect(() => {
    // Gave up: re-running on `lost` tears the timer down and starts nothing.
    if (lost) return
    const gen = ++generation.current
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (timer || document.visibilityState !== 'visible') return
      timer = setInterval(() => void poll(), CHAT_POLL_MS)
    }
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void poll()
        start()
      } else stop()
    }
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      // Drops any poll still in flight for the feed being torn down.
      generation.current = gen + 1
    }
  }, [poll, lost])

  return { messages, setMessages, poll, lost }
}

function initials(name: string) {
  return (name.trim()[0] ?? '?').toUpperCase()
}

function stamp(d: Date | string) {
  const date = new Date(d)
  if (isToday(date)) return format(date, 'h:mm a')
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, h:mm a')
}

export function Conversation(props: Props) {
  const { channel, viewer, baseHref } = props
  const [presence, setPresence] = useState(props.presence)
  const [threadId, setThreadId] = useState<string | null>(props.initialThread?.root.id ?? null)
  const [isMember, setIsMember] = useState(channel.isMember)
  const [hasOlder, setHasOlder] = useState(props.initial.hasOlder)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const keepOffset = useRef<number | null>(null)

  const mergePresence = useCallback((p: Record<string, Presence>) => setPresence((cur) => ({ ...cur, ...p })), [])
  const readSoon = useCallback(() => {
    if (document.visibilityState === 'visible') void markRead(channel.id).catch(() => undefined)
  }, [channel.id])

  const feed = useFeed(channel.id, null, props.initial.messages, props.serverNow, mergePresence, readSoon, viewer.id)

  // Everyone a mention could name here: the members, plus the readers the
  // composer offers (a public channel's readers need not have joined).
  const { members, mentionUsers } = props
  const mentionPlugins = useMemo<MarkdownPlugins>(() => {
    const people = new Map<string, MentionPerson>()
    for (const p of [...members, ...mentionUsers, viewer]) people.set(p.id, { id: p.id, name: p.name })
    return [remarkMentions([...people.values()])]
  }, [members, mentionUsers, viewer])

  useEffect(() => {
    readSoon()
  }, [readSoon])

  // Newest at the bottom; stay pinned there unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current
      keepOffset.current = null
      return
    }
    if (stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [feed.messages])

  const onScroll = () => {
    const el = scroller.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  async function onLoadOlder() {
    const oldest = feed.messages.find((m) => !m.id.startsWith('tmp-'))
    if (!oldest || loadingOlder) return
    setLoadingOlder(true)
    try {
      const result = await loadOlder(channel.id, new Date(oldest.createdAt).toISOString())
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const el = scroller.current
      if (el) keepOffset.current = el.scrollHeight - el.scrollTop
      feed.setMessages((list) => mergeChanged(list, result.data.messages, true))
      mergePresence(result.data.presence)
      setHasOlder(result.data.hasOlder)
    } catch {
      toast.error('Could not load older messages — try again')
    } finally {
      setLoadingOlder(false)
    }
  }

  function openThread(id: string | null) {
    setThreadId(id)
    // URL kept shareable without a server round trip.
    const url = withParams(window.location.pathname + window.location.search, {
      t: id,
    })
    window.history.replaceState(null, '', url)
  }

  async function onJoin() {
    const result = await joinChannel(channel.id)
    if (result.ok) {
      setIsMember(true)
      toast.success('Joined')
    } else toast.error(result.error)
  }

  async function onLeave() {
    const result = await leaveChannel(channel.id)
    if (result.ok) {
      setIsMember(false)
      toast.success('You left the conversation')
      window.location.assign(withParams(baseHref, { c: null, t: null }))
    } else toast.error(result.error)
  }

  const headerIcon =
    channel.kind === 'private' ? (
      <Lock aria-hidden className="size-4" />
    ) : channel.kind === 'public' ? (
      <Hash aria-hidden className="size-4" />
    ) : channel.kind === 'group' ? (
      <Users aria-hidden className="size-4" />
    ) : null
  const kindLabel =
    channel.kind === 'public'
      ? 'Public channel'
      : channel.kind === 'private'
        ? 'Private channel'
        : channel.kind === 'group'
          ? 'Group chat'
          : channel.kind === 'dm'
            ? 'Direct message'
            : 'Work item thread'

  return (
    <MentionPlugins.Provider value={mentionPlugins}>
      <div className="flex min-h-0 flex-1">
        <section
          aria-labelledby="chat-title"
          className={cn('flex min-h-0 min-w-0 flex-1 flex-col', threadId && 'hidden lg:flex')}
        >
          <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4">
            <Link
              href={withParams(baseHref, { c: null, t: null })}
              className="inline-flex items-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
              aria-label="Back to conversations"
            >
              <ArrowLeft aria-hidden className="size-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <h2 id="chat-title" className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {headerIcon}
                <span className="truncate">{channel.title}</span>
                {channel.otherUserId ? <PresenceDot presence={presence[channel.otherUserId]} /> : null}
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {kindLabel}
                {channel.projectName ? ` · ${channel.projectName}` : ''}
                {channel.topic ? ` · ${channel.topic}` : ''}
                {channel.otherUserId && presence[channel.otherUserId] ? (
                  <>
                    {' · '}
                    <PresenceLabel presence={presence[channel.otherUserId]} />
                  </>
                ) : null}
              </p>
            </div>
            {channel.contextHref ? (
              <Link href={channel.contextHref} className="text-xs font-medium text-primary hover:underline">
                Open the work item
              </Link>
            ) : null}
            {channel.kind !== 'dm' ? (
              <span className="text-xs text-muted-foreground" title={props.members.map((m) => m.name).join(', ')}>
                {props.members.length} {props.members.length === 1 ? 'member' : 'members'}
              </span>
            ) : null}
            {channel.canAddMembers ? <AddMembersDialog channelId={channel.id} people={props.addablePeople} /> : null}
            {!isMember && (channel.kind === 'public' || channel.kind === 'context') && channel.canWrite ? (
              <Button size="sm" variant="outline" onClick={() => void onJoin()}>
                Join
              </Button>
            ) : null}
            {isMember && channel.kind !== 'dm' ? (
              <Button size="sm" variant="ghost" onClick={() => void onLeave()}>
                Leave
              </Button>
            ) : null}
          </header>

          <div
            ref={scroller}
            onScroll={onScroll}
            className="min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-4"
            role="log"
            aria-label={`Messages in ${channel.title}`}
            aria-live="polite"
            aria-relevant="additions"
          >
            {hasOlder ? (
              <div className="mb-3 flex justify-center">
                <Button size="sm" variant="outline" disabled={loadingOlder} onClick={() => void onLoadOlder()}>
                  {loadingOlder ? 'Loading…' : 'Load older messages'}
                </Button>
              </div>
            ) : null}
            {feed.messages.length === 0 ? (
              <p className="px-2 py-10 text-center text-sm text-muted-foreground">
                No messages yet.
                {channel.canWrite ? ' Say hello — or type @ to bring someone in.' : ''}
              </p>
            ) : (
              <ol className="flex flex-col gap-0.5">
                {feed.messages.map((m) => (
                  <li key={m.id}>
                    <MessageItem
                      message={m}
                      viewer={viewer}
                      presence={presence[m.authorId]}
                      canWrite={channel.canWrite}
                      canModerate={channel.canModerate}
                      onReply={() => openThread(m.id)}
                      setList={feed.setMessages}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>

          {feed.lost ? (
            <div role="alert" className="border-t bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium">This conversation is no longer available to you</p>
              <Link
                href={withParams(baseHref, { c: null, t: null })}
                className="text-xs font-medium text-primary hover:underline"
              >
                Back to all conversations
              </Link>
            </div>
          ) : channel.canWrite ? (
            <Composer
              channelId={channel.id}
              parentId={null}
              placeholder={
                channel.kind === 'dm'
                  ? `Message ${channel.title}`
                  : `Message ${channel.kind === 'public' || channel.kind === 'private' ? '#' : ''}${channel.title}`
              }
              mentionUsers={props.mentionUsers}
              viewer={viewer}
              canAttach={channel.canAttach}
              setList={feed.setMessages}
              onSent={() => {
                stickToBottom.current = true
                setIsMember(true)
              }}
              onFilePosted={() => void feed.poll()}
            />
          ) : (
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              {channel.archived
                ? 'This conversation is archived.'
                : 'You can read this conversation but not post in it.'}
            </p>
          )}
        </section>

        {threadId ? (
          <ThreadPanel
            key={threadId}
            channel={channel}
            rootId={threadId}
            initial={props.initialThread && props.initialThread.root.id === threadId ? props.initialThread : null}
            presence={presence}
            mergePresence={mergePresence}
            mentionUsers={props.mentionUsers}
            viewer={viewer}
            serverNow={props.serverNow}
            onClose={() => openThread(null)}
            onReplied={() => void feed.poll()}
          />
        ) : null}
      </div>
    </MentionPlugins.Provider>
  )
}

// --- one message -------------------------------------------------------------

function MessageItem({
  message: m,
  viewer,
  presence,
  canWrite,
  canModerate,
  onReply,
  setList,
  inThread = false,
}: {
  message: ChatMessage
  viewer: Viewer
  presence: Presence | undefined
  canWrite: boolean
  canModerate: boolean
  onReply?: () => void
  setList: (fn: (list: ChatMessage[]) => ChatMessage[]) => void
  inThread?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(m.body)
  const [saving, setSaving] = useState(false)
  const mentionPlugins = useContext(MentionPlugins)
  const mine = m.authorId === viewer.id
  const pending = m.id.startsWith('tmp-')

  const patch = (fn: (msg: ChatMessage) => ChatMessage) =>
    setList((list) => list.map((x) => (x.id === m.id ? fn(x) : x)))

  async function onReact(emoji: string) {
    const before = m.reactions
    // Optimistic: flip "me" on this emoji.
    patch((x) => {
      const has = x.reactions.find((r) => r.emoji === emoji)
      let reactions = x.reactions
      if (has?.me)
        reactions = x.reactions
          .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, me: false } : r))
          .filter((r) => r.count > 0)
      else if (has) reactions = x.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, me: true } : r))
      else reactions = [...x.reactions, { emoji, count: 1, me: true, names: [viewer.name] }]
      return { ...x, reactions }
    })
    try {
      const result = await toggleReaction(m.id, emoji)
      if (result.ok) patch((x) => ({ ...x, reactions: result.data.reactions }))
      else {
        patch((x) => ({ ...x, reactions: before }))
        toast.error(result.error)
      }
    } catch {
      patch((x) => ({ ...x, reactions: before }))
      toast.error('Could not react — try again')
    }
  }

  async function onSaveEdit() {
    const text = draft.trim()
    if (!text || text === m.body) {
      setEditing(false)
      return
    }
    setSaving(true)
    const before = { body: m.body, editedAt: m.editedAt }
    patch((x) => ({ ...x, body: text, editedAt: new Date() }))
    try {
      const result = await editMessage(m.id, text)
      if (result.ok) {
        patch((x) => ({ ...x, editedAt: result.data.editedAt }))
        setEditing(false)
      } else {
        patch((x) => ({ ...x, ...before }))
        toast.error(result.error)
      }
    } catch {
      patch((x) => ({ ...x, ...before }))
      toast.error('Could not save — try again')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    const before = m
    patch((x) => ({ ...x, deleted: true, body: '', reactions: [] }))
    try {
      const result = await deleteMessage(m.id)
      if (!result.ok) {
        patch(() => before)
        toast.error(result.error)
      }
    } catch {
      patch(() => before)
      toast.error('Could not delete — try again')
    }
  }

  function onEditKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void onSaveEdit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setEditing(false)
      setDraft(m.body)
    }
  }

  return (
    <article
      aria-label={`${m.authorName}, ${stamp(m.createdAt)}`}
      className={cn(
        'group relative flex gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50 focus-within:bg-muted/50',
        pending && 'opacity-60',
      )}
    >
      <div className="relative shrink-0 pt-0.5">
        <Avatar size="sm">
          {m.authorAvatarUrl ? <AvatarImage src={m.authorAvatarUrl} alt="" /> : null}
          <AvatarFallback>{initials(m.authorName)}</AvatarFallback>
        </Avatar>
        <PresenceDot presence={presence} className="absolute -right-1.5 -bottom-1 size-3.5 text-[8px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-semibold text-foreground">{m.authorName}</span>
          <time dateTime={new Date(m.createdAt).toISOString()} className="text-muted-foreground">
            {stamp(m.createdAt)}
          </time>
          {m.editedAt && !m.deleted ? <span className="text-muted-foreground">(edited)</span> : null}
          {pending ? <span className="text-muted-foreground">Sending…</span> : null}
        </p>

        {m.deleted ? (
          <p className="text-sm italic text-muted-foreground">This message was deleted</p>
        ) : editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onEditKey}
              maxLength={MESSAGE_MAX}
              aria-label="Edit message"
              autoFocus
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="xs" disabled={saving} onClick={() => void onSaveEdit()}>
                Save
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setEditing(false)
                  setDraft(m.body)
                }}
              >
                Cancel
              </Button>
              <span className="self-center text-xs text-muted-foreground">Enter to save · Esc to cancel</span>
            </div>
          </div>
        ) : (
          <MarkdownView
            markdown={m.body}
            remarkPlugins={mentionPlugins}
            className="text-sm [&_p]:my-0.5 [&_pre]:my-1"
          />
        )}

        {/* Always visible, not hover-only: the user asked for reacting and
            replying to be obvious, and a phone has no hover anyway. */}
        {!m.deleted && !pending && !editing && (m.reactions.length > 0 || canWrite || (!inThread && onReply)) ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <ul className="contents" aria-label="Reactions">
              {m.reactions.map((r) => (
                <li key={r.emoji}>
                  <button
                    type="button"
                    disabled={!canWrite || pending}
                    aria-pressed={r.me}
                    aria-label={`${r.emoji} ${r.count}, ${r.me ? 'remove your reaction' : 'add your reaction'}`}
                    title={r.names.join(', ')}
                    onClick={() => void onReact(r.emoji)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums',
                      r.me
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : 'bg-card text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <span aria-hidden>{r.emoji}</span>
                    {r.count}
                  </button>
                </li>
              ))}
            </ul>
            {canWrite ? <ReactionPicker onReact={onReact} /> : null}
            {!inThread && onReply && m.replyCount === 0 ? (
              <button
                type="button"
                onClick={onReply}
                className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MessageSquareReply className="size-3.5" aria-hidden />
                Reply
              </button>
            ) : null}
          </div>
        ) : null}

        {!inThread && m.replyCount > 0 ? (
          <button type="button" onClick={onReply} className="mt-1 text-xs font-medium text-primary hover:underline">
            {m.replyCount} {m.replyCount === 1 ? 'reply' : 'replies'}
            {m.lastReplyAt ? (
              <span className="font-normal text-muted-foreground"> · last {stamp(m.lastReplyAt)}</span>
            ) : null}
          </button>
        ) : null}
      </div>

      {!m.deleted && !pending && !editing && ((!inThread && onReply) || mine || canModerate) ? (
        <div
          className="absolute top-0 right-2 flex -translate-y-1/2 items-center gap-0.5 rounded-lg border bg-card p-0.5 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
          role="toolbar"
          aria-label={`Actions for the message from ${m.authorName}`}
        >
          {!inThread && onReply ? (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Reply in thread"
              title="Reply in thread"
              onClick={onReply}
            >
              <MessageSquareReply aria-hidden />
            </Button>
          ) : null}
          {mine && canWrite ? (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Edit message"
              title="Edit"
              onClick={() => {
                setDraft(m.body)
                setEditing(true)
              }}
            >
              <Pencil aria-hidden />
            </Button>
          ) : null}
          {mine || canModerate ? (
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button size="icon-xs" variant="ghost" aria-label="Delete message" title="Delete" />}
              >
                <Trash2 aria-hidden />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this message?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {mine
                      ? 'Everyone will see “This message was deleted” in its place.'
                      : `This removes ${m.authorName}’s message for everyone.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => void onDelete()}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

// --- composer ------------------------------------------------------------------

/** The visible "😊+" under a message: one tap opens the quick reactions. */
function ReactionPicker({ onReact }: { onReact: (emoji: string) => void | Promise<void> }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Add a reaction"
            title="Add a reaction"
            className="inline-flex items-center gap-0.5 rounded-full border bg-card px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        }
      >
        <SmilePlus className="size-3.5" aria-hidden />
        <Plus className="size-3" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1">
        <div className="flex gap-0.5" role="group" aria-label="Reactions">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              className="rounded-md p-2 text-lg hover:bg-muted"
              onClick={() => {
                setOpen(false)
                void onReact(emoji)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Touch keyboards have no Shift, so there Enter must make a new line and
 * the Send button sends (the user's ask). Read after mount — the server
 * cannot know the device, and guessing would mismatch hydration.
 */
function useTouchInput(): boolean {
  const [touch, setTouch] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const sync = () => setTouch(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return touch
}

/** "People" beside Attach: everyone who can read this conversation, one tap to @mention. */
function PeoplePicker({ people, onPick }: { people: MentionUser[]; onPick: (person: MentionUser) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people
  }, [people, query])
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger render={<Button size="sm" variant="ghost" aria-label="Mention someone" />}>
        <Users aria-hidden />
        People
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-64 p-1">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a person…"
          aria-label="Find a person"
          className="mb-1 h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <ul className="max-h-60 overflow-y-auto" aria-label="People in this conversation">
          {shown.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">No one found</li>
          ) : (
            shown.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onPick(p)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  {p.name}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function Composer({
  channelId,
  parentId,
  placeholder,
  mentionUsers,
  viewer,
  canAttach,
  setList,
  onSent,
  onFilePosted,
}: {
  channelId: string
  parentId: string | null
  placeholder: string
  mentionUsers: MentionUser[]
  viewer: Viewer
  canAttach: boolean
  setList: (fn: (list: ChatMessage[]) => ChatMessage[]) => void
  onSent?: () => void
  onFilePosted?: () => void
}) {
  const [draft, setDraft] = useState('')
  const touch = useTouchInput()
  const [uploading, setUploading] = useState(false)
  const sending = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const hintId = `composer-hint-${parentId ?? channelId}`

  async function send() {
    const text = draft.trim()
    if (!text || sending.current) return
    if (text.length > MESSAGE_MAX) {
      toast.error(`A message can be up to ${MESSAGE_MAX} characters`)
      return
    }
    sending.current = true
    const tmp: ChatMessage = {
      id: `tmp-${++tmpSeq}`,
      channelId,
      parentId,
      authorId: viewer.id,
      authorName: viewer.name,
      authorAvatarUrl: viewer.avatarUrl,
      body: text,
      createdAt: new Date(),
      editedAt: null,
      deleted: false,
      replyCount: 0,
      lastReplyAt: null,
      reactions: [],
    }
    setList((list) => [...list, tmp])
    setDraft('')
    onSent?.()
    try {
      const result = await postMessage({ channelId, body: text, parentId })
      if (result.ok) {
        setList((list) => {
          // The poll may have delivered the real row already.
          const without = list.filter((m) => m.id !== tmp.id)
          return without.some((m) => m.id === result.data.message.id) ? without : [...without, result.data.message]
        })
      } else {
        setList((list) => list.filter((m) => m.id !== tmp.id))
        setDraft(text)
        toast.error(result.error)
      }
    } catch {
      setList((list) => list.filter((m) => m.id !== tmp.id))
      setDraft(text)
      toast.error('Could not send — check your connection')
    } finally {
      sending.current = false
    }
  }

  async function upload(file: File) {
    const check = checkAttachmentMeta({
      name: file.name,
      type: file.type,
      size: file.size,
    })
    if (!check.ok) {
      toast.error(check.error)
      return
    }
    setUploading(true)
    try {
      const body = new FormData()
      body.append('channelId', channelId)
      body.append('file', file)
      const response = await fetch('/api/attachments', {
        method: 'POST',
        body,
      })
      const isJson = response.headers.get('content-type')?.includes('application/json')
      if (response.redirected || !isJson) {
        toast.error('Your session has expired — sign in again')
        return
      }
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown
      } | null
      if (!response.ok) {
        toast.error(typeof payload?.error === 'string' ? payload.error : 'Upload failed — try again')
        return
      }
      onFilePosted?.()
    } catch {
      toast.error('Network error — check your connection')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="border-t px-2 py-2 sm:px-4">
      {/* Send sits beside the box, not in the footer row: the app's fixed
          bottom-right Signals bubble covers that corner of every page. */}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <MentionTextarea
            users={mentionUsers}
            placement="above"
            suggestionLimit={50}
            value={draft}
            onValueChange={setDraft}
            placeholder={placeholder}
            aria-label={parentId ? 'Reply in thread' : 'Write a message'}
            aria-describedby={hintId}
            rows={2}
            maxLength={MESSAGE_MAX}
            className="max-h-48 min-h-14 resize-none"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !touch && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void send()
              }
            }}
          />
        </div>
        <Button
          size="sm"
          className="mb-1 shrink-0"
          onClick={() => void send()}
          disabled={!draft.trim()}
          aria-label="Send message"
        >
          <SendHorizontal aria-hidden />
          Send
        </Button>
      </div>
      <div className="mt-1.5 flex items-center gap-2 pr-32 sm:pr-36">
        {canAttach && !parentId ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void upload(file)
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              aria-label="Attach a file"
            >
              <Paperclip aria-hidden />
              {uploading ? 'Uploading…' : 'Attach'}
            </Button>
          </>
        ) : null}
        {mentionUsers.length > 0 ? (
          <PeoplePicker
            people={mentionUsers}
            onPick={(p) => setDraft((d) => `${d}${d && !/\s$/.test(d) ? ' ' : ''}@${p.name} `)}
          />
        ) : null}
        <p id={hintId} className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
          {touch
            ? 'Enter for a new line · tap Send to send · @ to mention'
            : 'Enter to send · Shift+Enter for a new line · ``` for code · @ to mention'}
        </p>
      </div>
    </div>
  )
}

// --- thread panel --------------------------------------------------------------

function ThreadPanel({
  channel,
  rootId,
  initial,
  presence,
  mergePresence,
  mentionUsers,
  viewer,
  serverNow,
  onClose,
  onReplied,
}: {
  channel: ConversationChannel
  rootId: string
  initial: { root: ChatMessage; replies: ChatMessage[] } | null
  presence: Record<string, Presence>
  mergePresence: (p: Record<string, Presence>) => void
  mentionUsers: MentionUser[]
  viewer: Viewer
  serverNow: string
  onClose: () => void
  onReplied: () => void
}) {
  const [root, setRoot] = useState<ChatMessage | null>(initial?.root ?? null)
  const [status, setStatus] = useState<'ready' | 'loading' | 'error'>(initial ? 'ready' : 'loading')
  const noop = useCallback(() => undefined, [])
  const feed = useFeed(channel.id, rootId, initial?.replies ?? [], serverNow, mergePresence, noop, viewer.id)
  const { setMessages } = feed
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (initial) return
    let alive = true
    loadThread(channel.id, rootId).then(
      (result) => {
        if (!alive) return
        if (!result.ok) {
          setStatus('error')
          return
        }
        setRoot(result.data.root)
        setMessages(result.data.replies)
        setStatus('ready')
      },
      () => alive && setStatus('error'),
    )
    return () => {
      alive = false
    }
  }, [channel.id, rootId, initial, setMessages])

  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [feed.messages.length])

  return (
    <aside
      aria-labelledby="thread-title"
      className="flex min-h-0 w-full flex-col border-l bg-card/40 lg:w-[380px] lg:shrink-0"
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <h2 id="thread-title" className="flex-1 text-sm font-semibold">
          Thread
        </h2>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close thread">
          <X aria-hidden />
        </Button>
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-2 py-3"
        role="log"
        aria-label="Thread replies"
        aria-live="polite"
      >
        {status === 'loading' ? (
          <p className="px-2 text-sm text-muted-foreground">Loading the thread…</p>
        ) : status === 'error' || !root ? (
          <p className="px-2 text-sm text-destructive">This thread could not be opened.</p>
        ) : (
          <>
            <MessageItem
              message={root}
              viewer={viewer}
              presence={presence[root.authorId]}
              canWrite={channel.canWrite}
              canModerate={channel.canModerate}
              setList={(fn) => setRoot((r) => (r ? (fn([r])[0] ?? r) : r))}
              inThread
            />
            <p className="my-2 border-b pb-1 px-2 text-xs text-muted-foreground">
              {feed.messages.length} {feed.messages.length === 1 ? 'reply' : 'replies'}
            </p>
            <ol className="flex flex-col gap-0.5">
              {feed.messages.map((m) => (
                <li key={m.id}>
                  <MessageItem
                    message={m}
                    viewer={viewer}
                    presence={presence[m.authorId]}
                    canWrite={channel.canWrite}
                    canModerate={channel.canModerate}
                    setList={feed.setMessages}
                    inThread
                  />
                </li>
              ))}
            </ol>
            <div ref={endRef} />
          </>
        )}
      </div>
      {channel.canWrite && root && !root.deleted ? (
        <Composer
          channelId={channel.id}
          parentId={rootId}
          placeholder="Reply…"
          mentionUsers={mentionUsers}
          viewer={viewer}
          canAttach={false}
          setList={feed.setMessages}
          onSent={onReplied}
        />
      ) : null}
    </aside>
  )
}
