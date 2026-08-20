'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteBug } from '@/features/bugs/actions'

/**
 * Moves one bug to the trash, behind a confirm-in-place step.
 *
 * TWO CLICKS, NO DIALOG. The confirmation is here rather than in an
 * AlertDialog because the sentence that matters — what deleting a report
 * actually costs — is one line, and a layer that covers the bug you are
 * deleting is the wrong place to read about deleting it. DeleteAppCard makes
 * the same call for the same reason, one weight up.
 *
 * FOCUS FOLLOWS THE ARM. Arming replaces the button subtree, which used to
 * drop keyboard focus to <body> — the destructive Delete never received it
 * and the question was never announced. Now arming moves focus onto the
 * confirm control, Esc (or Cancel) disarms and hands focus back to the
 * original button, and a persistent live region says what happened. The
 * region is rendered unconditionally and never remounted, for the reason
 * capacity-heat-editable gives: a live region has to already be in the
 * accessibility tree before the change it should announce.
 *
 * A separate control from BugTriageControls on purpose: deleting is
 * `bug.delete` (manager and up, scoped), triaging is `bug.triage` (editor and
 * up, scoped). Folding them into one component would make one capability
 * decide the visibility of two.
 */
export function DeleteBugButton({ bugId, title }: { bugId: string; title: string }) {
  const [armed, setArmed] = useState(false)
  const [status, setStatus] = useState('')
  const [pending, startDeleting] = useTransition()
  const armButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  // Only hand focus back when the person is coming FROM the confirm step —
  // without the flag, the mount effect would steal focus on first render.
  const returnFocus = useRef(false)

  useEffect(() => {
    if (armed) {
      confirmButtonRef.current?.focus()
    } else if (returnFocus.current) {
      returnFocus.current = false
      armButtonRef.current?.focus()
    }
  }, [armed])

  function arm() {
    setArmed(true)
    setStatus(`Confirm moving “${title}” to trash — Delete to confirm, Escape to cancel.`)
  }

  function disarm() {
    returnFocus.current = true
    setArmed(false)
    setStatus('Delete cancelled.')
  }

  function handleDelete() {
    startDeleting(async () => {
      try {
        const res = await deleteBug(bugId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Bug moved to trash')
        setStatus('Bug moved to trash.')
        setArmed(false)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <span
      className="flex flex-wrap items-center gap-2"
      onKeyDown={(event) => {
        if (armed && event.key === 'Escape' && !pending) {
          // Handled here, so it never doubles as "close the surrounding
          // layer" while the question is still open.
          event.stopPropagation()
          disarm()
        }
      }}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
      {armed ? (
        <>
          <span className="text-2xs text-muted-foreground">Move to trash?</span>
          <Button
            ref={confirmButtonRef}
            type="button"
            variant="destructive"
            size="sm"
            className="pointer-coarse:min-h-11"
            disabled={pending}
            onClick={handleDelete}
            aria-label={`Confirm: move bug “${title}” to trash`}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Delete
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="pointer-coarse:min-h-11"
            disabled={pending}
            onClick={disarm}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          ref={armButtonRef}
          type="button"
          variant="ghost"
          size="sm"
          className="pointer-coarse:min-h-11"
          onClick={arm}
          aria-label={`Delete bug: ${title}`}
        >
          <Trash2 aria-hidden />
          Delete
        </Button>
      )}
    </span>
  )
}
