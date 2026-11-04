'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Hash, Lock, MessagesSquare, SquareKanban, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { selectTriggerClassName } from '@/components/ui/select'
import { openProjectChat } from '@/features/chat/actions'
import type { ConversationItem, ConversationList as List, Presence } from '@/features/chat/queries'
import { withParams } from '@/features/chat/rules'
import { PresenceDot } from './presence'

/**
 * The left pane. Server-rendered counts; refreshed every 30 s while the tab
 * is visible (router.refresh — the open conversation keeps its own state,
 * it only re-reads props it ignores after mount), so a new DM elsewhere
 * shows its badge without a reload. The open conversation never shows a
 * badge: reading it is what clears it.
 */

const LIST_REFRESH_MS = 30_000

function Row({
  item,
  href,
  active,
  presence,
}: {
  item: ConversationItem
  href: string
  active: boolean
  presence?: Presence
}) {
  const unread = active ? 0 : item.unread
  const Icon =
    item.kind === 'private' ? Lock : item.kind === 'public' ? Hash : item.kind === 'group' ? Users : item.kind === 'context' ? SquareKanban : null
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
          active ? 'bg-primary/15 font-semibold text-primary' : 'text-foreground/85 hover:bg-muted',
          unread > 0 && !active && 'font-semibold text-foreground',
        )}
      >
        {Icon ? <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" /> : <PresenceDot presence={presence} className="shrink-0" />}
        {item.kind === 'dm' && !presence ? <span aria-hidden className="size-4 shrink-0" /> : null}
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
        {item.kind === 'private' ? <span className="sr-only">(private)</span> : null}
        {unread > 0 ? (
          <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 font-mono text-2xs font-semibold tabular-nums text-primary-foreground">
            <span aria-hidden>{unread > 99 ? '99+' : unread}</span>
            <span className="sr-only">{unread} unread</span>
          </span>
        ) : null}
      </Link>
    </li>
  )
}

function Section({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string | null }) {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="px-2 pt-3 pb-1 font-mono text-2xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
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
}: {
  list: List
  activeId: string | null
  baseHref: string
  presence: Record<string, Presence>
  /** Projects whose chat this viewer may open — for "Open a project chat". */
  openableProjects: { id: string; name: string }[]
  /** False on a project's Chat tab: DMs and groups belong to /chat. */
  showPersonal: boolean
  actions?: React.ReactNode
}) {
  const router = useRouter()
  const [opening, setOpening] = useState(false)
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

  const listed = new Set(list.projects.map((p) => p.app.id))
  const unlisted = openableProjects.filter((p) => !listed.has(p.id))

  return (
    <nav aria-label="Conversations" className="flex min-h-0 flex-col">
      {actions ? <div className="flex flex-wrap gap-2 px-2 pb-2">{actions}</div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <Section title="Projects" empty={list.projects.length === 0 ? 'No project channels yet.' : null}>
          {list.projects.map((group) => (
            <li key={group.app.id}>
              <p className="truncate px-2 pt-1.5 text-xs font-medium text-muted-foreground">{group.app.name}</p>
              <ul className="flex flex-col gap-0.5">
                {group.channels.map((c) => (
                  <Row key={c.id} item={c} href={href(c.id)} active={c.id === activeId} />
                ))}
              </ul>
            </li>
          ))}
        </Section>
        {unlisted.length > 0 ? (
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
            <Section title="Direct messages" empty={list.direct.length === 0 ? 'None yet — use New message.' : null}>
              {list.direct.map((c) => (
                <Row key={c.id} item={c} href={href(c.id)} active={c.id === activeId} presence={c.otherUserId ? presence[c.otherUserId] : undefined} />
              ))}
            </Section>
            <Section title="Groups" empty={list.groups.length === 0 ? 'None yet.' : null}>
              {list.groups.map((c) => (
                <Row key={c.id} item={c} href={href(c.id)} active={c.id === activeId} />
              ))}
            </Section>
          </>
        ) : null}
        <Section title="Threads on work items" empty={list.threads.length === 0 ? 'Use Discuss on a task, doc or bug to start one.' : null}>
          {list.threads.map((c) => (
            <Row key={c.id} item={c} href={href(c.id)} active={c.id === activeId} />
          ))}
        </Section>
      </div>
    </nav>
  )
}

export function NoConversation() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <MessagesSquare aria-hidden className="size-6 text-muted-foreground/70" />
      <p className="text-sm font-medium">Pick a conversation</p>
      <p className="max-w-sm text-sm text-muted-foreground">Choose a channel or a person on the left, or start a new message.</p>
    </div>
  )
}
