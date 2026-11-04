'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleDot, MessageSquarePlus, Plus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { selectTriggerClassName } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  CHANNEL_NAME_MAX,
  GROUP_MAX_MEMBERS,
  STATUSES,
  STATUS_DURATIONS,
  STATUS_EMOJI,
  STATUS_LABEL,
  normalizeChannelName,
  type PresenceStatus,
  type StatusDurationKey,
} from '@/features/chat/chat'
import { addMembers, clearPresence, createChannel, createGroup, openDm, setPresence } from '@/features/chat/actions'
import type { Presence } from '@/features/chat/queries'
import { presenceText } from './presence'
import { withParams } from '@/features/chat/rules'

/**
 * The four small forms around Chat: new channel, new DM/group, add people,
 * and the status picker. Each re-checks nothing itself — the server action
 * is the gate — but each only offers what the server already said is allowed
 * (the people lists arrive pre-filtered).
 */

type Person = { id: string; name: string }

/** A filterable checkbox list of people. */
function PeoplePicker({
  people,
  selected,
  onChange,
  max,
  idPrefix,
}: {
  people: Person[]
  selected: string[]
  onChange: (ids: string[]) => void
  max?: number
  idPrefix: string
}) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people).slice(0, 200)
  }, [people, query])
  const full = max !== undefined && selected.length >= max
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${idPrefix}-filter`}>People</Label>
      <Input id={`${idPrefix}-filter`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a name" autoComplete="off" />
      <ul className="max-h-56 overflow-y-auto rounded-lg border p-1" aria-label="People to choose from">
        {shown.length === 0 ? <li className="px-2 py-1.5 text-sm text-muted-foreground">Nobody matches.</li> : null}
        {shown.map((p) => {
          const checked = selected.includes(p.id)
          return (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && full}
                  onChange={() => onChange(checked ? selected.filter((id) => id !== p.id) : [...selected, p.id])}
                />
                {p.name}
              </label>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {selected.length === 0 ? 'Nobody chosen yet.' : `${selected.length} chosen`}
      </p>
    </div>
  )
}

export function NewMessageDialog({
  people,
  baseHref,
  defaultOpen = false,
}: {
  people: Person[]
  baseHref: string
  defaultOpen?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen)
  const [selected, setSelected] = useState<string[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (selected.length === 0 || busy) return
    setBusy(true)
    try {
      const result = selected.length === 1 ? await openDm(selected[0]) : await createGroup(selected, name)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setOpen(false)
      setSelected([])
      setName('')
      router.push(withParams(baseHref, { c: result.data.channelId, t: null, new: null }))
      router.refresh()
    } catch {
      toast.error('Something went wrong — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <MessageSquarePlus aria-hidden />
        New message
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            Choose one person for a direct message, or several (up to {GROUP_MAX_MEMBERS - 1}) for a group chat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <PeoplePicker people={people} selected={selected} onChange={setSelected} max={GROUP_MAX_MEMBERS - 1} idPrefix="new-msg" />
          {selected.length > 1 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-group-name">Group name (optional)</Label>
              <Input id="new-group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={selected.length === 0 || busy}>
              {selected.length > 1 ? 'Start group chat' : 'Open conversation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function NewChannelDialog({
  projects,
  defaultAppId,
  baseHref,
}: {
  projects: { id: string; name: string }[]
  defaultAppId?: string
  baseHref: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [appId, setAppId] = useState(defaultAppId ?? projects[0]?.id ?? '')
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [kind, setKind] = useState<'public' | 'private'>('public')
  const [busy, setBusy] = useState(false)
  const normalized = normalizeChannelName(name)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!normalized || !appId || busy) return
    setBusy(true)
    try {
      const result = await createChannel({ appId, name, kind, topic })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setOpen(false)
      setName('')
      setTopic('')
      router.push(withParams(baseHref, { c: result.data.channelId, t: null }))
      router.refresh()
    } catch {
      toast.error('Something went wrong — try again')
    } finally {
      setBusy(false)
    }
  }

  if (projects.length === 0) return null
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus aria-hidden />
        New channel
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
          <DialogDescription>A channel belongs to one project. Public: anyone on the project can read it. Private: only the people you add.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {defaultAppId ? null : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-channel-app">Project</Label>
              <select id="new-channel-app" value={appId} onChange={(e) => setAppId(e.target.value)} className={cn(selectTriggerClassName, 'h-8 w-full')}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-channel-name">Name</Label>
            <Input
              id="new-channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={CHANNEL_NAME_MAX + 10}
              placeholder="release-planning"
              aria-describedby="new-channel-name-hint"
              required
            />
            <p id="new-channel-name-hint" className="text-xs text-muted-foreground">
              {name.trim() ? (normalized ? `Will be #${normalized}` : 'Use at least 2 letters or numbers') : 'Lowercase letters, numbers and dashes.'}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-channel-topic">Topic (optional)</Label>
            <Input id="new-channel-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={250} />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Who can see it</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="channel-kind" checked={kind === 'public'} onChange={() => setKind('public')} />
              Public — everyone on the project
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="channel-kind" checked={kind === 'private'} onChange={() => setKind('private')} />
              Private — only people you add
            </label>
          </fieldset>
          <DialogFooter>
            <Button type="submit" disabled={!normalized || busy}>
              Create channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AddMembersDialog({ channelId, people }: { channelId: string; people: Person[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (selected.length === 0 || busy) return
    setBusy(true)
    try {
      const result = await addMembers(channelId, selected)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Added ${result.data.added} ${result.data.added === 1 ? 'person' : 'people'}`)
      setOpen(false)
      setSelected([])
      router.refresh()
    } catch {
      toast.error('Something went wrong — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" />}>
        <UserPlus aria-hidden />
        Add people
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add people</DialogTitle>
          <DialogDescription>They will see the whole conversation, including earlier messages.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone who can join is already here.</p>
          ) : (
            <PeoplePicker people={people} selected={selected} onChange={setSelected} idPrefix="add-members" />
          )}
          <DialogFooter>
            <Button type="submit" disabled={selected.length === 0 || busy}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function StatusDialog({ current, defaultOpen = false }: { current: Presence | null; defaultOpen?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen)
  const [status, setStatus] = useState<PresenceStatus>(current?.status ?? 'available')
  const [note, setNote] = useState(current?.note ?? '')
  const [duration, setDuration] = useState<StatusDurationKey>('never')
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState(current)

  // Opened from /chat?status=1: drop the param so a refresh doesn't reopen it.
  useEffect(() => {
    if (!defaultOpen) return
    const url = withParams(window.location.pathname + window.location.search, { status: null })
    window.history.replaceState(null, '', url)
  }, [defaultOpen])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const result = await setPresence({ status, note, duration })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setShown(result.data)
      toast.success(`Status set: ${presenceText(result.data)}`)
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Something went wrong — try again')
    } finally {
      setBusy(false)
    }
  }

  async function onClear() {
    setBusy(true)
    try {
      const result = await clearPresence()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setShown(null)
      setNote('')
      toast.success('Status cleared')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Something went wrong — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" className="max-w-full justify-start" />}>
        {shown ? <span aria-hidden>{STATUS_EMOJI[shown.status]}</span> : <CircleDot aria-hidden />}
        <span className="truncate">{shown ? presenceText(shown) : 'Set a status'}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your status</DialogTitle>
          <DialogDescription>Shown beside your name in Chat so people know when to expect a reply.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <fieldset className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-medium">Status</legend>
            {STATUSES.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <input type="radio" name="presence-status" checked={status === s} onChange={() => setStatus(s)} />
                <span aria-hidden>{STATUS_EMOJI[s]}</span>
                {STATUS_LABEL[s]}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-2">
            <Label htmlFor="presence-note">Note (optional)</Label>
            <Input id="presence-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} placeholder="Back at 2pm" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="presence-duration">Clear after</Label>
            <select
              id="presence-duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value as StatusDurationKey)}
              className={cn(selectTriggerClassName, 'h-8 w-full')}
            >
              {STATUS_DURATIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="gap-2">
            {shown ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void onClear()}>
                Clear status
              </Button>
            ) : null}
            <Button type="submit" disabled={busy}>
              Save status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
