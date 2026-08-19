'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateMeeting } from '@/features/meetings/actions'

/**
 * Inline correction of the masthead's CONTENT fields, from the page somebody
 * is about to hand the document out from.
 *
 * This is the moment errors get noticed — a typo in the title, an agenda that
 * describes last week, an attendee who never came — and until now the only fix
 * was to abandon the export, walk back to the meeting page, edit it there and
 * start again.
 *
 * Every write goes through `updateMeeting`, the same server action the meeting
 * form uses: gated by canManageMeeting (admin or the organiser), zod-validated
 * against the same field schema create and edit share, and reconciling
 * attendees row by row so an untouched attendee keeps the RSVP they gave.
 * Nothing is copied and there is no second store; a fix here IS a fix on the
 * meeting, and router.refresh() re-renders this server component so the
 * document says the same thing a moment later.
 *
 * WHAT IS DELIBERATELY NOT EDITABLE — and must stay that way:
 * the "Written up by <model> · <time>" line, the "Exported <time>" stamp and
 * the "Ref LP-…" reference. Those are provenance, not content. That line is
 * the document's disclosure that a machine drafted these minutes and when; the
 * moment it can be retyped, a recipient can no longer tell a generated record
 * from a human one, and an export stamp somebody can set by hand is a forged
 * reference. This is a refusal, not a gap — if the need is to show a human
 * checked the write-up, the answer is an ADDITIONAL "Reviewed by" line beside
 * the machine attribution, never an edit to it.
 *
 * All controls carry `print:hidden`: paper gets the result, never the
 * mechanism that produced it.
 */
export type MeetingEditBase = {
  meetingId: string
  /* updateMeeting validates and rewrites the whole meeting, so every field it
     requires has to travel back with the one being changed — otherwise saving
     a title would blank the agenda and unfile the meeting from its apps.

     The SET, not one id: a meeting can be on several projects and none of them
     is primary, so sending back a single one would silently drop the rest the
     first time somebody fixed a typo in the title from this page. `[]` is the
     app-less meeting and is a legal value. */
  appIds: string[]
  title: string
  /** ISO strings: a Date cannot cross the server/client boundary here. */
  startsAt: string
  endsAt: string
  agenda: string
  /* Undefined rather than null: meetingUrlSchema is a string schema and
     rejects null outright, so a meeting with no link must omit the field. */
  meetingUrl?: string
  attendeeIds: string[]
}

/** The shared write path: one field changes, the rest of the meeting rides along. */
function useMeetingWrite(base: MeetingEditBase) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const save = (patch: Partial<MeetingEditBase>, onDone: () => void) => {
    const next = { ...base, ...patch }
    // Checked here as well as on the server so the message is a sentence
    // rather than a schema violation: attendeeIds is `.min(1)`, and the two
    // ways to trip it (removing the last attendee, or editing a meeting that
    // somehow has none) both deserve to say what to do about it.
    if (next.attendeeIds.length === 0) {
      toast.error('A meeting needs at least one attendee — add someone before saving')
      return
    }
    startTransition(async () => {
      try {
        const res = await updateMeeting(next)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        onDone()
        router.refresh()
        toast.success('Saved — the meeting itself now says the same')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return { save, pending }
}

/** The Edit/Cancel/Save trio, identical everywhere so the pattern is learnable once. */
function EditorButtons({
  pending,
  onCancel,
  onSave,
}: {
  pending: boolean
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <button type="button" className="doc-chip" onClick={onCancel} disabled={pending}>
        Cancel
      </button>
      <button type="button" className="doc-chip doc-chip-go" onClick={onSave} disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </span>
  )
}

function OpenButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="doc-chip mt-1 ml-2 shrink-0 self-center align-middle print:hidden"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

/**
 * The title, which is also the saved PDF's filename and the running header on
 * every page — so it is the single field most worth fixing before printing.
 *
 * The heading itself stays rendered while the editor is open, rather than
 * being swapped for an input: somebody who hits Print mid-edit must still get
 * a document with a title on it.
 */
export function EditableTitle({ base, canEdit }: { base: MeetingEditBase; canEdit: boolean }) {
  const { save, pending } = useMeetingWrite(base)
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <>
      {/* The button is a SIBLING of the h1, not a child: anything interactive
          inside a heading joins its accessible name, and every screen reader
          would then announce the document's title as "… Edit title". */}
      <div className="mt-4 flex items-start gap-2">
        <h1 className="font-heading text-[20pt] font-bold leading-[1.15] tracking-tight">
          {base.title}
        </h1>
        {canEdit && draft === null ? (
          <OpenButton label="Edit title" onClick={() => setDraft(base.title)} />
        ) : null}
      </div>
      {draft !== null ? (
        <div className="mt-2 flex items-center gap-2 print:hidden">
          <input
            value={draft}
            autoFocus
            aria-label="Meeting title"
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
            className="doc-input flex-1"
          />
          <EditorButtons
            pending={pending}
            onCancel={() => setDraft(null)}
            onSave={() => save({ title: draft.trim() }, () => setDraft(null))}
          />
        </div>
      ) : null}
    </>
  )
}

/** The agenda line in the fact block — free text, so a plain textarea. */
export function EditableAgenda({ base, canEdit }: { base: MeetingEditBase; canEdit: boolean }) {
  const { save, pending } = useMeetingWrite(base)
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <>
      {base.agenda ? (
        base.agenda
      ) : (
        <span className="text-[var(--doc-ink-faint)]">Not set</span>
      )}
      {canEdit && draft === null ? (
        <OpenButton label={base.agenda ? 'Edit' : 'Add'} onClick={() => setDraft(base.agenda)} />
      ) : null}
      {draft !== null ? (
        <span className="mt-1.5 flex items-start gap-2 print:hidden">
          <textarea
            value={draft}
            autoFocus
            rows={2}
            aria-label="Agenda"
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
            className="doc-input flex-1"
          />
          <EditorButtons
            pending={pending}
            onCancel={() => setDraft(null)}
            onSave={() => save({ agenda: draft.trim() }, () => setDraft(null))}
          />
        </span>
      ) : null}
    </>
  )
}

/**
 * Attendees, which are rows in meeting_attendees rather than a string — so the
 * control adds and removes real people from the roster and there is no
 * free-text field to type a name that matches nobody.
 *
 * Each change saves on its own rather than accumulating behind a Save button:
 * updateMeeting reconciles the list against what is stored, so one write per
 * decision is both correct and undoable, and the printed list is never a step
 * behind what the screen shows.
 */
export function EditableAttendees({
  base,
  canEdit,
  attendees,
  people,
}: {
  base: MeetingEditBase
  canEdit: boolean
  /** The current attendees, in the order the document prints them. */
  attendees: { id: string; name: string }[]
  /** Everyone selectable — active, approved users. */
  people: { id: string; name: string }[]
}) {
  const { save, pending } = useMeetingWrite(base)
  const [open, setOpen] = useState(false)

  const present = new Set(base.attendeeIds)
  const addable = people.filter((person) => !present.has(person.id))

  return (
    <>
      {attendees.length > 0 ? (
        attendees.map((a) => a.name).join(', ')
      ) : (
        <span className="text-[var(--doc-ink-faint)]">Nobody listed</span>
      )}
      {canEdit && !open ? <OpenButton label="Edit" onClick={() => setOpen(true)} /> : null}
      {open ? (
        <span className="mt-1.5 flex flex-col gap-2 print:hidden">
          <span className="flex flex-wrap items-center gap-1.5">
            {attendees.map((attendee) => (
              <span key={attendee.id} className="doc-token">
                {attendee.name}
                <button
                  type="button"
                  className="doc-token-x"
                  disabled={pending}
                  aria-label={`Remove ${attendee.name} from this meeting`}
                  onClick={() =>
                    save(
                      { attendeeIds: base.attendeeIds.filter((id) => id !== attendee.id) },
                      () => {},
                    )
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </span>
          <span className="flex items-center gap-1.5">
            {/* A native select, for the same reason PrintSpeakerNames uses
                one: this route loads none of the app's UI kit, and the
                platform control is already keyboard- and screen-reader
                complete. Its value resets to the placeholder on every save
                because the chosen person leaves the list of addable people. */}
            <select
              value=""
              disabled={pending || addable.length === 0}
              aria-label="Add an attendee"
              onChange={(event) =>
                save({ attendeeIds: [...base.attendeeIds, event.target.value] }, () => {})
              }
              className="doc-input"
            >
              <option value="" disabled>
                {addable.length === 0 ? 'Everyone is already on it' : 'Add an attendee…'}
              </option>
              {addable.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            <button type="button" className="doc-chip" onClick={() => setOpen(false)}>
              Done
            </button>
          </span>
        </span>
      ) : null}
    </>
  )
}
