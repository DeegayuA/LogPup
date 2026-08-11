'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertCircleIcon, Loader2Icon, UserPlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  assignSpeaker,
  getSpeakerAssignmentData,
  type SpeakerAssignmentData,
} from '@/features/meetings/ai-actions'

// Sentinel values for the two picker rows that aren't a user id. Both are
// shapes no uuid can take, so they can never collide with a real option.
const NOT_ATTENDEE = '__not_attendee__'
const ADD_NEW = '__add_new__'

/**
 * A raw, as-transcribed speaker label rendered as what it is: a LABEL, not a
 * person.
 *
 * Mono + dashed border is the same visual grammar the app uses everywhere for
 * "machine-generated identifier" and "not settled yet". This is the whole
 * point of the attribution fix — "Speaker 1" and "Irushi Anupama" must read
 * identically until a human confirms one of them, because at that stage they
 * are equally just something the transcript said.
 */
export function SpeakerLabelChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md border border-dashed border-border bg-muted/40 px-1.5 font-mono text-xs text-muted-foreground"
      title="Unconfirmed speaker label from the recording"
    >
      {label}
    </span>
  )
}

/**
 * The picker for ONE speaker label. Three tiers, in increasing order of what
 * they claim:
 *   1. this meeting's attendees — no new membership;
 *   2. anyone else in the org — adds them to the meeting;
 *   3. a brand-new person (admin only) — creates the account too.
 * Tiers 1 and 2 are separate groups so the boundary is visible before the
 * click rather than discovered after it.
 */
export function SpeakerAssignment({
  meetingId,
  label,
  data,
  canManage,
  onChanged,
}: {
  meetingId: string
  label: string
  data: SpeakerAssignmentData
  /** Same admin-or-creator tier the rest of the meeting's manage actions use. */
  canManage: boolean
  onChanged?: () => void | Promise<void>
}) {
  const [pending, startPending] = useTransition()
  const [addingNew, setAddingNew] = useState(false)
  const [newPerson, setNewPerson] = useState({ name: '', email: '' })

  const mapping = data.speakers.find((s) => s.label === label)
  const value = mapping ? (mapping.userId ?? NOT_ATTENDEE) : undefined
  const nameFor = (id: string) =>
    data.attendees.find((a) => a.id === id)?.name ??
    data.orgPeople.find((p) => p.id === id)?.name ??
    mapping?.userName ??
    'Assign…'

  function submit(input: Parameters<typeof assignSpeaker>[0]) {
    startPending(async () => {
      try {
        const res = await assignSpeaker(input)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setAddingNew(false)
        setNewPerson({ name: '', email: '' })
        await onChanged?.()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  if (!canManage) {
    return (
      <div className="flex items-center gap-1.5">
        <SpeakerLabelChip label={label} />
        <span className="text-xs font-medium">
          {mapping ? (mapping.userName ?? 'Not a listed attendee') : 'Unassigned'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <SpeakerLabelChip label={label} />
      <Select
        value={value}
        onValueChange={(v: string | null) => {
          if (!v) return
          if (v === ADD_NEW) {
            setAddingNew(true)
            return
          }
          submit({ meetingId, label, userId: v === NOT_ATTENDEE ? null : v })
        }}
        disabled={pending}
      >
        <SelectTrigger size="sm" className="pointer-coarse:min-h-11 w-44" aria-label={`Who is ${label}?`}>
          <SelectValue placeholder="Assign…">
            {(v: string) => (v === NOT_ATTENDEE ? 'Not an attendee' : nameFor(v))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {data.attendees.length > 0 ? (
            <SelectGroup>
              <SelectLabel>On this meeting</SelectLabel>
              {data.attendees.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
          {data.orgPeople.length > 0 ? (
            <SelectGroup>
              {/* Picking from here is a bigger claim than picking an
                  attendee — it adds them to the meeting. Say so first. */}
              <SelectLabel>Elsewhere in the org — adds them here</SelectLabel>
              {data.orgPeople.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
          <SelectSeparator />
          <SelectGroup>
            <SelectItem value={NOT_ATTENDEE}>Not a listed attendee</SelectItem>
            {data.canAddPeople ? (
              <SelectItem value={ADD_NEW}>Add someone new…</SelectItem>
            ) : null}
          </SelectGroup>
        </SelectContent>
      </Select>
      {pending ? <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}

      <Dialog open={addingNew} onOpenChange={(open) => !open && setAddingNew(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add someone new</DialogTitle>
            <DialogDescription>
              Creates their account, puts them on this meeting, and attributes “{label}” to them.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              submit({
                meetingId,
                label,
                newPerson: { name: newPerson.name.trim(), email: newPerson.email.trim() },
              })
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`new-person-name-${label}`}>Name</Label>
              <Input
                id={`new-person-name-${label}`}
                value={newPerson.name}
                onChange={(e) => setNewPerson((f) => ({ ...f, name: e.target.value }))}
                minLength={2}
                maxLength={80}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`new-person-email-${label}`}>Work email</Label>
              <Input
                id={`new-person-email-${label}`}
                type="email"
                value={newPerson.email}
                onChange={(e) => setNewPerson((f) => ({ ...f, email: e.target.value }))}
                maxLength={160}
                required
              />
              <p className="text-xs text-muted-foreground">
                They sign in with Google — it has to be an allowed sign-in domain.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <UserPlusIcon aria-hidden />}
                Add and attribute
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * The whole "Who's who" block — every unresolved speaker label in the meeting
 * with its picker.
 *
 * `data` is optional so this can be mounted somewhere that has no note
 * timeline: pass it when the host already fetched the timeline payload (which
 * carries all of it), omit it and the panel fetches its own. The second mode
 * costs a round trip and exists so a host needs only two props.
 */
export function SpeakerAssignmentPanel({
  meetingId,
  canManage,
  data: provided,
  onChanged,
}: {
  meetingId: string
  canManage: boolean
  data?: SpeakerAssignmentData
  onChanged?: () => void | Promise<void>
}) {
  const [fetched, setFetched] = useState<SpeakerAssignmentData | null>(null)
  const [loading, setLoading] = useState(provided === undefined)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getSpeakerAssignmentData(meetingId)
      if (res.ok) setFetched(res.data)
      else setLoadError(res.error)
    } catch {
      setLoadError('Could not load speakers')
    } finally {
      setLoading(false)
    }
  }

  // Only self-fetches in the standalone mode. When `data` is supplied the
  // host owns refreshing it, so this effect must stay inert.
  useEffect(() => {
    if (provided !== undefined) return
    let cancelled = false
    void (async () => {
      if (!cancelled) await load()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` intentionally excluded: it only reads meetingId from props, and including it would refetch on every render
  }, [meetingId, provided !== undefined])

  const data = provided ?? fetched

  async function handleChanged() {
    if (provided === undefined) await load()
    await onChanged?.()
  }

  if (provided === undefined && loading) {
    return (
      <div className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
        <Loader2Icon className="size-3 animate-spin" aria-hidden /> Loading speakers…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-3">
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircleIcon className="size-3.5 shrink-0" aria-hidden /> {loadError}
        </p>
        <Button variant="outline" size="sm" type="button" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  // No labels means nothing was diarized — there is nothing to be wrong
  // about, so the block stays out of the way entirely.
  if (!data || data.labels.length === 0) return null

  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-dashed p-2.5">
      <h4 className="text-xs font-semibold text-muted-foreground">Who&rsquo;s who</h4>
      <p className="text-xs text-muted-foreground">
        These are labels from the recording, not confirmed people — pick who each one was.
      </p>
      <div className="flex flex-wrap gap-2">
        {data.labels.map((label) => (
          <SpeakerAssignment
            key={label}
            meetingId={meetingId}
            label={label}
            data={data}
            canManage={canManage}
            onChanged={handleChanged}
          />
        ))}
      </div>
    </section>
  )
}
