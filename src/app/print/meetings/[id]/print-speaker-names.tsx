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
  /** Mappings already made — label → a user, a typed name, or explicitly nobody. */
  speakers: { label: string; userId: string | null; userName: string | null; displayName?: string | null }[]
  /** Everyone who can be named: this meeting's attendees first, then the rest. */
  people: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (labels.length === 0) return null

  function assign(label: string, value: string, displayName?: string | null) {
    setBusyLabel(label)
    startTransition(async () => {
      try {
        const res = await setSpeakerMapping(
          meetingId,
          label,
          value === NOT_ATTENDEE ? null : value,
          displayName,
        )
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
      className="mx-auto mb-4 w-[210mm] max-w-full rounded-lg border border-[color:var(--doc-rule)] bg-[var(--doc-paper)] p-4 shadow-sm print:hidden"
      aria-label="Name the speakers"
    >
      <h2 className="text-sm font-semibold text-[var(--doc-ink)]">Who was speaking?</h2>
      <p className="mt-0.5 text-xs text-[var(--doc-ink-soft)]">
        Naming a voice here rewrites it everywhere — this export and the meeting&rsquo;s own notes.
      </p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {labels.map((label) => {
          const mapping = speakers.find((s) => s.label === label)
          const value = mapping ? (mapping.userId ?? NOT_ATTENDEE) : ''
          const busy = busyLabel === label && pending
          // "Not a listed attendee" on its own only records that the voice is
          // nobody on the invite — it throws away WHO it was, so the document
          // keeps saying "Speaker 1". The name field is what finishes that
          // thought, and it appears exactly when that option is chosen.
          const isOutsider = value === NOT_ATTENDEE
          return (
            <li key={label} className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--doc-ink-soft)]">{label}</span>
              {/* A native select: this route loads none of the app's UI kit,
                  and the platform control is already keyboard- and
                  screen-reader complete. */}
              <select
                value={value}
                disabled={busy}
                aria-label={`Who is ${label}?`}
                onChange={(event) => assign(label, event.target.value)}
                className="rounded-md border border-[color:var(--doc-rule-strong)] bg-[var(--doc-paper)] px-2 py-1 text-sm text-[var(--doc-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--doc-brand)] disabled:opacity-60"
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

              {isOutsider ? (
                // Commits on blur or Enter, not per keystroke: each write is a
                // server round trip that renames the voice through the whole
                // document, and doing that on every letter would rewrite the
                // transcript a dozen times for one name.
                <input
                  type="text"
                  defaultValue={mapping?.displayName ?? ''}
                  disabled={busy}
                  maxLength={80}
                  placeholder="Their name"
                  aria-label={`Name for ${label}`}
                  onBlur={(event) => {
                    const typed = event.target.value.trim()
                    if (typed === (mapping?.displayName ?? '')) return
                    assign(label, NOT_ATTENDEE, typed || null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      event.currentTarget.blur()
                    }
                  }}
                  className="w-36 rounded-md border border-[color:var(--doc-rule-strong)] bg-[var(--doc-paper)] px-2 py-1 text-sm text-[var(--doc-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--doc-brand)] disabled:opacity-60"
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
