'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { selectTriggerClassName } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { RETRO_KINDS, RETRO_KIND_LABEL, type RetroKind } from '@/features/sprints/scrum'
import {
  addRetroItem,
  deleteRetroItem,
  retroActionToTask,
  setRetroItemDone,
  setRetroItemOwner,
} from '@/features/sprints/scrum-actions'
import type { RetroItem } from '@/features/sprints/scrum-queries'

/**
 * The retrospective: three columns, each with its own quick-add. Action items
 * carry an owner, a done tick and a "Make task" that files them in the
 * backlog, so a retro's promises end up somewhere the board can see.
 *
 * Every write goes through a server action that revalidates the page, and the
 * list re-renders from the server's answer; nothing here is optimistic.
 */

const KIND_HINT: Record<RetroKind, string> = {
  went_well: 'Something that went well',
  improve: 'Something to do better',
  action: 'Something we will do next sprint',
}

type Person = { id: string; name: string }

async function run(action: () => Promise<{ ok: boolean; error?: string }>): Promise<boolean> {
  try {
    const result = await action()
    if (!result.ok) toast.error(result.error ?? 'Something went wrong, try again')
    return result.ok
  } catch {
    toast.error('Could not reach the server, try again')
    return false
  }
}

export function RetroBoard({
  slug,
  sprintId,
  items,
  people,
  currentUserId,
  canManage,
}: {
  slug: string
  sprintId: string
  items: RetroItem[]
  people: Person[]
  currentUserId: string
  canManage: boolean
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {RETRO_KINDS.map((kind) => (
        <RetroColumn
          key={kind}
          kind={kind}
          slug={slug}
          sprintId={sprintId}
          items={items.filter((i) => i.kind === kind)}
          people={people}
          currentUserId={currentUserId}
          canManage={canManage}
        />
      ))}
    </div>
  )
}

function RetroColumn({
  kind,
  slug,
  sprintId,
  items,
  people,
  currentUserId,
  canManage,
}: {
  kind: RetroKind
  slug: string
  sprintId: string
  items: RetroItem[]
  people: Person[]
  currentUserId: string
  canManage: boolean
}) {
  const [body, setBody] = useState('')
  const [pending, startTransition] = useTransition()
  const headingId = `retro-${kind}`

  function add() {
    if (!body.trim()) return
    startTransition(async () => {
      if (await run(() => addRetroItem({ sprintId, kind, body }))) setBody('')
    })
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h3 id={headingId} className="flex items-baseline justify-between font-heading text-sm font-semibold">
        {RETRO_KIND_LABEL[kind]}
        <span className="font-mono text-2xs font-normal text-muted-foreground tabular-nums">{items.length}</span>
      </h3>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          add()
        }}
      >
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={KIND_HINT[kind]}
          aria-label={`Add to ${RETRO_KIND_LABEL[kind]}`}
          maxLength={2000}
        />
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? 'Adding…' : 'Add'}
        </Button>
      </form>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <RetroCard
              key={item.id}
              item={item}
              slug={slug}
              people={people}
              canDelete={item.authorId === currentUserId || canManage}
              canEdit={item.authorId === currentUserId || item.ownerId === currentUserId || canManage}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function RetroCard({
  item,
  slug,
  people,
  canDelete,
  canEdit,
}: {
  item: RetroItem
  slug: string
  people: Person[]
  canDelete: boolean
  canEdit: boolean
}) {
  const [pending, startTransition] = useTransition()
  const isAction = item.kind === 'action'
  const doneId = `retro-done-${item.id}`
  const ownerId = `retro-owner-${item.id}`
  // The owner may have lost access since; keep them selectable so the
  // select shows the truth rather than silently reading "Nobody".
  const ownerChoices =
    item.ownerId && !people.some((p) => p.id === item.ownerId)
      ? [...people, { id: item.ownerId, name: item.ownerName ?? 'Former member' }]
      : people

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3" aria-busy={pending || undefined}>
      <p className={cn('whitespace-pre-wrap text-sm', isAction && item.done && 'text-muted-foreground line-through')}>
        {item.body}
      </p>
      <p className="text-2xs text-muted-foreground">Added by {item.authorName}</p>

      {isAction ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label htmlFor={doneId} className="flex items-center gap-1.5 text-xs">
              <input
                id={doneId}
                type="checkbox"
                checked={item.done}
                disabled={!canEdit || pending}
                onChange={(event) => {
                  const done = event.target.checked
                  startTransition(async () => {
                    await run(() => setRetroItemDone(item.id, done))
                  })
                }}
                className="size-4 accent-primary"
              />
              Done
            </label>
            <div className="flex items-center gap-1.5">
              <label htmlFor={ownerId} className="text-xs text-muted-foreground">
                Owner
              </label>
              <select
                id={ownerId}
                value={item.ownerId ?? ''}
                disabled={!canEdit || pending}
                onChange={(event) => {
                  const next = event.target.value || null
                  startTransition(async () => {
                    await run(() => setRetroItemOwner(item.id, next))
                  })
                }}
                className={cn(selectTriggerClassName, 'h-7 max-w-44 text-xs')}
              >
                <option value="">Nobody yet</option>
                {ownerChoices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {item.taskId ? (
              <Link
                href={`/apps/${slug}?tab=roadmap&sprint=backlog`}
                className="text-xs text-primary underline-offset-4 hover:underline"
              >
                Task {item.taskKey ?? 'created'}, in the backlog
              </Link>
            ) : (
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const result = await retroActionToTask(item.id)
                      if (result.ok) toast.success(`Added ${result.data.taskKey ?? 'a task'} to the backlog`)
                      else toast.error(result.error)
                    } catch {
                      toast.error('Could not reach the server, try again')
                    }
                  })
                }
              >
                {pending ? 'Working…' : 'Make task'}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {canDelete ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await run(() => deleteRetroItem(item.id))
              })
            }
            aria-label={`Delete "${item.body.slice(0, 40)}"`}
          >
            Delete
          </Button>
        </div>
      ) : null}
    </li>
  )
}
