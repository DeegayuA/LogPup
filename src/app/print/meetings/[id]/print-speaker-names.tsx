'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setSpeakerMapping } from '@/features/meetings/ai-actions'

/**
 * Name the voices before exporting: "Speaker 1" → a person, from the export
 * page itself.
 *
 * This syncs by construction rather than by copying anything anywhere.
 * setSpeakerMapping upserts the (meeting, label) row AND backfills
 * `speakerId` on every note segment carrying that label, so a name given here
 * is the same name the meeting's own timeline shows a moment later — there is
 * no second store to drift out of step. The printed document renders
 * `speakerName ?? speakerLabel` (see segmentWho), so the export picks the
 * name up on the very next render.
 *
 * Screen-only (`print:hidden`): this is a control, and controls do not belong
 * in a document. Paper gets the result, not the mechanism.
 */
const NOT_ATTENDEE = '__not_attendee__'

export function PrintSpeakerNames({
  meetingId,
  labels,
  speakers,
  people,
}: {
  meetingId: string
  /** Distinct speakerLabels found in this meeting's voice segments. */
  labels: string[]
  /** Mappings already made — label → a user, or explicitly nobody. */
  speakers: { label: string; userId: string | null; userName: string | null }[]
  /** Everyone who can be named: this meeting's attendees first, then the rest. */
  people: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (labels.length === 0) return null

  function assign(label: string, value: string) {
    setBusyLabel(label)
    startTransition(async () => {
      try {
        const res = await setSpeakerMapping(meetingId, label, value === NOT_ATTENDEE ? null : value)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        // Re-render the server component so the document below — and the
        // meeting's own timeline — show the new name straight away.
        router.refresh()
        toast.success('Named — the meeting notes now say the same')
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setBusyLabel(null)
      }
    })
  }

  return (
    <section
      className="mx-auto mb-4 w-[210mm] max-w-full rounded-lg border border-zinc-200 bg-white p-4 shadow-sm print:hidden"
      aria-label="Name the speakers"
    >
      <h2 className="text-sm font-semibold text-zinc-900">Who was speaking?</h2>
      <p className="mt-0.5 text-xs text-zinc-500">
        Naming a voice here rewrites it everywhere — this export and the meeting&rsquo;s own notes.
      </p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {labels.map((label) => {
          const mapping = speakers.find((s) => s.label === label)
          const value = mapping ? (mapping.userId ?? NOT_ATTENDEE) : ''
          const busy = busyLabel === label && pending
          return (
            <li key={label} className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500">{label}</span>
              {/* A native select: this route loads none of the app's UI kit,
                  and the platform control is already keyboard- and
                  screen-reader complete. */}
              <select
                value={value}
                disabled={busy}
                aria-label={`Who is ${label}?`}
                onChange={(event) => assign(label, event.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 disabled:opacity-60"
              >
                <option value="" disabled>
                  Name this voice…
                </option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
                <option value={NOT_ATTENDEE}>Not a listed attendee</option>
              </select>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
