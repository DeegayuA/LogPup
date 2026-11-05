'use client'

import { useId } from 'react'
import Link from 'next/link'
import { FileText, Hash, Lock, SquareKanban, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { Presence, SharedFile } from '@/features/chat/queries'
import { relativeTime } from '@/features/chat/rules'
import { PresenceDot, presenceText } from './presence'
import { AddMembersDialog } from './chat-dialogs'
import type { ConversationChannel } from './conversation'

/**
 * The conversation's right-hand details: About, Members, Shared files.
 *
 * A side column at xl and up, a sheet below that (the caller decides which
 * and when — see Conversation's info state). Reads only props, never state
 * of its own, so the list's 30 s router.refresh brings new members and files
 * in without a reload.
 *
 * Status is the emoji AND its words (presenceText), never a colour alone.
 * "Add people" lives here rather than in the header: on a 360px phone the
 * header has room for the title, Join/Leave and this panel's toggle, no more.
 */

export type InfoMember = { id: string; name: string; avatarUrl: string | null; role: 'owner' | 'member' }

export function channelKindLabel(kind: ConversationChannel['kind']): string {
  return kind === 'public'
    ? 'Public channel'
    : kind === 'private'
      ? 'Private channel'
      : kind === 'group'
        ? 'Group chat'
        : kind === 'dm'
          ? 'Direct message'
          : 'Work item thread'
}

export function ChannelIcon({ kind, className }: { kind: ConversationChannel['kind']; className?: string }) {
  const Icon = kind === 'private' ? Lock : kind === 'context' ? SquareKanban : kind === 'public' ? Hash : Users
  return <Icon aria-hidden className={className} />
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return `${first}${last}`.toUpperCase()
}

function InfoBody({
  channel,
  members,
  presence,
  files,
  addablePeople,
  now,
}: {
  channel: ConversationChannel
  members: InfoMember[]
  presence: Record<string, Presence>
  files: SharedFile[]
  addablePeople: { id: string; name: string }[]
  now: Date
}) {
  const id = useId()
  const images = files.filter((f) => f.mime.startsWith('image/'))
  const others = files.filter((f) => !f.mime.startsWith('image/'))
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`${id}-about`} className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ChannelIcon kind={channel.kind} className="size-6" />
        </span>
        <h3 id={`${id}-about`} className="max-w-full text-base font-semibold break-words">
          {channel.title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {channelKindLabel(channel.kind)}
          {channel.projectName ? ` · ${channel.projectName}` : ''}
        </p>
        <p className={cn('text-sm break-words', !channel.topic && 'text-muted-foreground')}>
          {channel.topic ?? (channel.kind === 'context' ? 'A conversation about one work item.' : 'No topic set.')}
        </p>
        {channel.contextHref ? (
          <Link href={channel.contextHref} className="text-xs font-medium text-primary hover:underline">
            Open the work item
          </Link>
        ) : null}
      </section>

      <section aria-labelledby={`${id}-members`} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 id={`${id}-members`} className="flex-1 font-mono text-2xs font-bold tracking-widest text-muted-foreground uppercase">
            Members · {members.length}
          </h3>
          {channel.canAddMembers ? <AddMembersDialog channelId={channel.id} people={addablePeople} /> : null}
        </div>
        {channel.kind === 'public' || channel.kind === 'context' ? (
          <p className="text-xs text-muted-foreground">Everyone on the project can read this; these people joined.</p>
        ) : null}
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has joined yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {members.map((m) => {
              const p = presence[m.id]
              return (
                <li key={m.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
                  <span className="relative shrink-0">
                    <Avatar size="sm">
                      {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                      <AvatarFallback>{initials(m.name)}</AvatarFallback>
                    </Avatar>
                    <PresenceDot presence={p} className="absolute -right-1.5 -bottom-1 size-3.5 text-[8px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {m.name}
                      {m.role === 'owner' ? <span className="ml-1.5 text-2xs text-muted-foreground">Owner</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{p ? presenceText(p) : 'No status'}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby={`${id}-files`} className="flex flex-col gap-2">
        <h3 id={`${id}-files`} className="font-mono text-2xs font-bold tracking-widest text-muted-foreground uppercase">
          Shared files
        </h3>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files shared yet. Use Attach under the message box.</p>
        ) : (
          <>
            {images.length > 0 ? (
              <ul className="grid grid-cols-3 gap-1.5" aria-label="Images">
                {images.map((f) => (
                  <li key={f.id}>
                    <a
                      href={f.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={f.name}
                      className="block aspect-square overflow-hidden rounded-lg border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- access-checked /api/attachments, not a static asset */}
                      <img src={f.href} alt={f.name} loading="lazy" className="size-full object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {others.length > 0 ? (
              <ul className="flex flex-col gap-1" aria-label="Files">
                {others.map((f) => (
                  <li key={f.id}>
                    <a
                      href={f.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <FileText aria-hidden className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{f.name}</span>
                        <time dateTime={new Date(f.createdAt).toISOString()} className="block text-xs text-muted-foreground">
                          {relativeTime(f.createdAt, now)}
                        </time>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}

type PanelProps = {
  channel: ConversationChannel
  members: InfoMember[]
  presence: Record<string, Presence>
  files: SharedFile[]
  addablePeople: { id: string; name: string }[]
  now: Date
  onClose: () => void
}

/** The xl+ side column. `className` carries the show/hide breakpoints. */
export function InfoColumn({ className, onClose, ...body }: PanelProps & { className?: string }) {
  return (
    <aside aria-labelledby="chat-info-title" className={cn('min-h-0 w-80 shrink-0 flex-col border-l bg-card', className)}>
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <h2 id="chat-info-title" className="flex-1 text-sm font-semibold">
          Details
        </h2>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close details">
          <X aria-hidden />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <InfoBody {...body} />
      </div>
    </aside>
  )
}

/** Below xl: the same body as a right-hand sheet (a modal dialog — focus trapped, Esc closes). */
export function InfoSheet({ open, onClose, ...body }: PanelProps & { open: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent
        className="top-0 right-0 left-auto flex h-svh max-h-svh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-sm data-open:zoom-in-100 data-closed:zoom-out-100"
        showCloseButton={false}
      >
        <header className="flex items-center gap-2 border-b px-4 py-2.5">
          <DialogTitle className="flex-1 text-sm font-semibold">Details</DialogTitle>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close details">
            <X aria-hidden />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <InfoBody {...body} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
