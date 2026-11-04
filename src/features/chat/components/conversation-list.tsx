'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MessagesSquare, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { selectTriggerClassName } from '@/components/ui/select'
import { openProjectChat } from '@/features/chat/actions'
import type { ConversationItem, ConversationList as List, Presence } from '@/features/chat/queries'
import { previewLine, relativeTime, withParams } from '@/features/chat/rules'
import { PresenceDot } from './presence'
import { ChannelIcon } from './info-panel'

/**
 * The left pane, messenger-style: a search box, then rows with an icon, the
 * name, a one-line preview of the newest message, a short relative time and
 * an unread badge. Server-rendered counts and previews; refreshed every 30 s
 * while the tab is visible (router.refresh — the open conversation keeps its
 * own state), so a new message elsewhere shows its badge without a reload.
 * The open conversation never shows a badge: reading it is what clears it.
 *
 * Relative times are computed against the SERVER's `now` (a prop that moves
 * with each refresh), not the browser clock, so the server render and the
 * hydrating client print the same "4m".
 *
 * Search filters the rows already here by name, in the browser: the list is
 * one project's channels and threads, small enough that a server round trip
 * would only add latency.
 */

const LIST_REFRESH_MS = 30_000

function Row({
  item,
  href,
  active,
  presence,
  now,
}: {
  item: ConversationItem
  href: string
  active: boolean
  presence?: Presence
  now: Date
}) {
  const unread = active ? 0 : item.unread
  const at = item.preview?.at ?? item.lastMessageAt
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'bg-primary/10' : 'hover:bg-muted',
        )}
      >
        <span
          className={cn(
            'relative flex size-9 shrink-0 items-center justify-center rounded-lg',
            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          <ChannelIcon kind={item.kind} className="size-4" />
          {item.kind === 'dm' ? <PresenceDot presence={presence} className="absolute -right-1 -bottom-1 size-3.5 text-[8px]" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm',
                active || unread > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/90',
              )}
            >
              {item.title}
            </span>
            {item.kind === 'private' ? <span className="sr-only">(private)</span> : null}
            {at ? (
              <time dateTime={new Date(at).toISOString()} className="shrink-0 text-2xs text-muted-foreground tabular-nums">
                {relativeTime(at, now)}
              </time>
            ) : null}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-xs',
                unread > 0 ? 'text-foreground/80' : 'text-muted-foreground',
                item.preview?.deleted && 'italic',
              )}
            >
              {item.preview ? previewLine(item.preview) : 'No messages yet'}
            </span>
            {unread > 0 ? (
              <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 font-mono text-2xs leading-none font-semibold text-primary-foreground tabular-nums">
                <span aria-hidden>{unread > 99 ? '99+' : unread}</span>
                <span className="sr-only">{unread} unread</span>
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  )
}

function Section({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string | null }) {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="px-2 pt-3 pb-1 font-mono text-2xs font-bold tracking-widest text-muted-foreground uppercase">{title}</h3>
      {empty ? <p className="px-2 text-xs text-muted-foreground">{empty}</p> : <ul className="flex flex-col gap-0.5">{children}</ul>}
    </section>
  )
}

export function ConversationList({
  list,
  activeId,
  baseHref,
  presence,
  openableProjects,
  showPersonal,
  actions,
  serverNow,
}: {
  list: List
  activeId: string | null
  baseHref: string
  presence: Record<string, Presence>
  /** Projects whose chat this viewer may open — for "Open a project chat". */
  openableProjects: { id: string; name: string }[]
  /** False on a project's Chat tab (the only place chat renders today). */
  showPersonal: boolean
  actions?: React.ReactNode
  /** The server's clock at render, ISO — the reference for relative times. */
  serverNow: string
}) {
  const router = useRouter()
  const [opening, setOpening] = useState(false)
  const [query, setQuery] = useState('')
  const now = useMemo(() => new Date(serverNow), [serverNow])
  const href = (id: string) => withParams(baseHref, { c: id, t: null, new: null, status: null })

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, LIST_REFRESH_MS)
    return () => clearInterval(timer)
  }, [router])

  async function openProject(appId: string) {
    if (!appId) return
    setOpening(true)
    try {
      const result = await openProjectChat(appId)
      if (result.ok) router.push(href(result.data.channelId))
      else toast.error(result.error)
    } catch {
      toast.error('Something went wrong — try again')
    } finally {
      setOpening(false)
    }
  }

  const q = query.trim().toLowerCase()
  const matches = (c: ConversationItem) => !q || c.title.toLowerCase().includes(q)
  const projects = list.projects
    .map((g) => ({ ...g, channels: g.channels.filter(matches) }))
    .filter((g) => !q || g.channels.length > 0)
  const direct = list.direct.filter(matches)
  const groups = list.groups.filter(matches)
  const threads = list.threads.filter(matches)
  const shown = projects.reduce((n, g) => n + g.channels.length, 0) + threads.length + (showPersonal ? direct.length + groups.length : 0)
  const singleProject = list.projects.length <= 1

  const listed = new Set(list.projects.map((p) => p.app.id))
  const unlisted = openableProjects.filter((p) => !listed.has(p.id))
  const row = (c: ConversationItem) => (
    <Row
      key={c.id}
      item={c}
      href={href(c.id)}
      active={c.id === activeId}
      now={now}
      presence={c.otherUserId ? presence[c.otherUserId] : undefined}
    />
  )

  return (
    <nav aria-label="Conversations" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 px-2 pt-2 pb-1">
        <label className="relative block">
          <span className="sr-only">Search conversations</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="h-9 w-full rounded-lg border bg-background pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </label>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4">
        {q && shown === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground" role="status">
            No conversations match “{query.trim()}”.
          </p>
        ) : (
          <>
            {q && projects.length === 0 ? null : singleProject ? (
              <Section title="Channels" empty={(projects[0]?.channels.length ?? 0) === 0 ? 'No channels yet.' : null}>
                {projects[0]?.channels.map(row)}
              </Section>
            ) : (
              <Section title="Projects" empty={projects.length === 0 ? 'No project channels yet.' : null}>
                {projects.map((group) => (
                  <li key={group.app.id}>
                    <p className="truncate px-2 pt-1.5 text-xs font-medium text-muted-foreground">{group.app.name}</p>
                    <ul className="flex flex-col gap-0.5">{group.channels.map(row)}</ul>
                  </li>
                ))}
              </Section>
            )}
            {unlisted.length > 0 && !q ? (
              <div className="px-2 pt-2">
                <label htmlFor="open-project-chat" className="mb-1 block text-xs text-muted-foreground">
                  Open a project&apos;s chat
                </label>
                <select
                  id="open-project-chat"
                  disabled={opening}
                  value=""
                  onChange={(e) => void openProject(e.target.value)}
                  className={cn(selectTriggerClassName, 'h-8 w-full')}
                >
                  <option value="">Choose a project…</option>
                  {unlisted.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {showPersonal ? (
              <>
                <Section title="Direct messages" empty={direct.length === 0 ? 'None.' : null}>
                  {direct.map(row)}
                </Section>
                <Section title="Groups" empty={groups.length === 0 ? 'None.' : null}>
                  {groups.map(row)}
                </Section>
              </>
            ) : null}
            {!q || threads.length > 0 ? (
              <Section
                title="Threads on work items"
                empty={threads.length === 0 ? 'Use Discuss on a task, doc or bug to start one.' : null}
              >
                {threads.map(row)}
              </Section>
            ) : null}
          </>
        )}
      </div>
    </nav>
  )
}

export function NoConversation() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <MessagesSquare aria-hidden className="size-6" />
      </span>
      <p className="text-sm font-medium">Pick a conversation</p>
      <p className="max-w-sm text-sm text-muted-foreground">Choose a channel or a work-item thread on the left.</p>
    </div>
  )
}
