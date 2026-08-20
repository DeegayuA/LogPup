'use client'

import { useState, useTransition } from 'react'
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
 * A separate control from BugTriageControls on purpose: deleting is
 * `bug.delete` (manager and up, scoped), triaging is `bug.triage` (editor and
 * up, scoped). Folding them into one component would make one capability
 * decide the visibility of two.
 */
export function DeleteBugButton({ bugId, title }: { bugId: string; title: string }) {
  const [armed, setArmed] = useState(false)
  const [pending, startDeleting] = useTransition()

  function handleDelete() {
    startDeleting(async () => {
      try {
        const res = await deleteBug(bugId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Bug moved to trash')
        setArmed(false)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  if (!armed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setArmed(true)}
        aria-label={`Delete bug: ${title}`}
      >
        <Trash2 aria-hidden />
        Delete
      </Button>
    )
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-2xs text-muted-foreground">Move to trash?</span>
      <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={handleDelete}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Delete
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  )
}
