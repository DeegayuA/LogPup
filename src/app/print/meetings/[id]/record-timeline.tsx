'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { editNoteSegment } from '@/features/meetings/ai-actions'

/**
 * The Record timeline with editing in place — fix a note right where you are
 * about to print it, without a round trip through the meeting page.
 *
 * Two ways in, per the two ways people clean a record up:
 *  - INLINE: an Edit button on the one entry that is wrong;
 *  - EDIT ALL: a mode that opens every editable entry at once, for the
 *    pass-over-everything read before handing the document out.
 *
 * Saves go through editNoteSegment — the same action the meeting's own
 * timeline uses — so an edit here IS an edit there; nothing is copied.
 * The edit is applied optimistically (the row shows the new text the moment
 * Save is pressed) and rolled back with a toast if the server declines.
 *
 * Voice entries stay read-only: the server refuses to rewrite the recorded
 * transcript (see editNoteSegment), because it is the record of what was
 * actually said. Controls are `print:hidden` — paper gets the result.
 */
export type RecordRow = {
  id: string
  /** Who this entry belongs to, already resolved server-side. */
  who: string
  /** The grey meta line: source · time offset or timestamp. */
  meta: string
  content: string
  /** False for voice/legacy entries the server will not rewrite. */
  editable: boolean
}

export function RecordTimeline({ rows, canEdit }: { rows: RecordRow[]; canEdit: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // Optimistic content overrides, by segment id — shown immediately on save,
  // dropped on rollback, superseded by the refreshed server render on success.
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [editAll, setEditAll] = useState(false)

  const anyEditable = canEdit && rows.some((row) => row.editable)
  const isOpen = (row: RecordRow) => row.editable && canEdit && drafts[row.id] !== undefined

  function open(row: RecordRow) {
    setDrafts((d) => ({ ...d, [row.id]: saved[row.id] ?? row.content }))
  }

  function close(id: string) {
    setDrafts(({ [id]: _dropped, ...rest }) => rest)
  }

  function openAll() {
    setEditAll(true)
    setDrafts((d) => {
      const next = { ...d }
      for (const row of rows) {
        if (row.editable) next[row.id] ??= saved[row.id] ?? row.content
      }
      return next
    })
  }

  function closeAll() {
    setEditAll(false)
    setDrafts({})
  }

  function save(row: RecordRow) {
    const next = (drafts[row.id] ?? '').trim()
    if (!next) {
      toast.error('A note can’t be saved empty')
      return
    }
    const previous = saved[row.id]
    // Optimistic: the document shows the correction immediately.
    setSaved((s) => ({ ...s, [row.id]: next }))
    close(row.id)
    startTransition(async () => {
      try {
        const res = await editNoteSegment(row.id, next)
        if (!res.ok) {
          toast.error(res.error)
          rollback(row.id, previous)
          return
        }
        // The meeting's own timeline now says the same — re-render the
        // server component so every derived line agrees.
        router.refresh()
      } catch {
        toast.error('Could not reach the server — the note was not changed')
        rollback(row.id, previous)
      }
    })
  }

  function rollback(id: string, previous: string | undefined) {
    setSaved((s) => {
      if (previous === undefined) {
        const { [id]: _dropped, ...rest } = s
        return rest
      }
      return { ...s, [id]: previous }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {anyEditable ? (
        <div className="flex justify-end print:hidden">
          <button
            type="button"
            onClick={editAll ? closeAll : openAll}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            {editAll ? 'Done editing' : 'Edit all'}
          </button>
        </div>
      ) : null}

      {rows.map((row) => {
        const content = saved[row.id] ?? row.content
        const editing = isOpen(row)
        return (
          <div key={row.id} className="doc-block group border-l-2 border-zinc-200 pl-3">
            <p className="text-[8.5pt] text-zinc-500">
              <span className="font-medium text-zinc-700">{row.who}</span>
              {' · '}
              {row.meta}
              {canEdit && row.editable && !editing ? (
                <button
                  type="button"
                  onClick={() => open(row)}
                  className="ml-2 rounded px-1 text-[8.5pt] font-medium text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 focus-visible:opacity-100 group-hover:opacity-100 print:hidden"
                >
                  Edit
                </button>
              ) : null}
              {canEdit && !row.editable && editAll ? (
                <span className="ml-2 text-[8pt] italic text-zinc-400 print:hidden">
                  recorded — locked
                </span>
              ) : null}
            </p>
            {editing ? (
              <div className="mt-1 flex flex-col gap-1.5 print:hidden">
                {/* Native textarea, same reasoning as the speaker selects:
                    this route carries none of the app's UI kit. */}
                <textarea
                  value={drafts[row.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') close(row.id)
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(row)
                  }}
                  rows={Math.min(10, Math.max(2, (drafts[row.id] ?? '').split('\n').length + 1))}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-[9.5pt] leading-[1.6] text-zinc-900"
                  aria-label={`Edit the note by ${row.who}`}
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save(row)}
                    className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => close(row.id)}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <span className="text-[8pt] text-zinc-400">⌘⏎ save · Esc cancel</span>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-[9.5pt] leading-[1.6]">{content}</p>
            )}
            {/* What prints while an editor happens to be open: the current
                text, not a form control. */}
            {editing ? (
              <p className="hidden whitespace-pre-wrap text-[9.5pt] leading-[1.6] print:block">
                {content}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
