'use client'

// Per-row Restore + "Delete forever" controls for the Trash card. Same idiom
// as the rest of this admin surface's row actions (pending-approvals-card.tsx,
// apps-table.tsx) and the meetingTaskSuggestions cards in note-timeline.tsx:
// a busyId-shaped useTransition per action, toast for the outcome, and
// router.refresh() on success so the server-rendered list (trash-card.tsx is
// a server component fed by getTrash()) picks up the change without a full
// reload — on top of the revalidatePath('/admin') every trash-actions.ts
// write already calls server-side.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2Icon, RotateCcwIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { ActionResult } from '@/lib/action-result'
import type { TrashKind } from '@/features/admin/trash-grouping'
import {
  purgeApp,
  purgeBug,
  purgeKeyframe,
  purgeMeeting,
  purgeSegment,
  purgeSprint,
  purgeTask,
  restoreApp,
  restoreAssignment,
  restoreBug,
  restoreKeyframe,
  restoreMeeting,
  restorePerson,
  restoreSegment,
  restoreSprint,
  restoreTask,
} from '@/features/admin/trash-actions'
import { matchesPurgeConfirm, PURGE_CONFIRM_PHRASE, restoreDisabledReason } from './trash-card-logic'

/**
 * Every kind restores through a same-shaped call; only restoreMeeting's data
 * payload differs (a `{ warning }` about the cancelled calendar invite — see
 * its own docblock in trash-actions.ts), which is why this returns
 * `ActionResult<unknown>` rather than one shared literal data type.
 */
async function callRestore(kind: TrashKind, id: string): Promise<ActionResult<unknown>> {
  switch (kind) {
    case 'app':
      return restoreApp(id)
    case 'bug':
      return restoreBug(id)
    case 'meeting':
      return restoreMeeting(id)
    case 'task':
      return restoreTask(id)
    case 'sprint':
      return restoreSprint(id)
    case 'segment':
      return restoreSegment(id)
    case 'keyframe':
      return restoreKeyframe(id)
    case 'assignment':
      return restoreAssignment(id)
    case 'person':
      // `id` here is the user_deletions row, not the user — a person can be
      // removed and restored more than once, and it is the interval that
      // closes. See restorePerson in trash-actions.ts.
      return restorePerson(id)
  }
}

/**
 * Assignments have no purge action. The still-open changeKind='removed'
 * tombstone in assignment_history IS the trash record (trash-queries.ts) —
 * assignments are hard-deleted by design already, so there is no separate
 * row left to purge; the only lifecycle move available is restoring it.
 * Deliberately absent from this map, not an oversight.
 *
 * Neither do people, and for a harder reason. There IS a row a purge could
 * delete — the users row — and deleting it is precisely what must never
 * happen: user_deletions cascades from users, and so does everything else a
 * person ever wrote. "Delete forever" on a person would not tidy a bin, it
 * would take their comments, work logs and meeting attendance with them and
 * leave the rest of the trail pointing at nothing. Removal is a tombstone
 * exactly so that never becomes a button.
 */
const PURGE_BY_KIND: Partial<Record<TrashKind, (id: string, confirm: string) => Promise<ActionResult>>> = {
  app: purgeApp,
  bug: purgeBug,
  meeting: purgeMeeting,
  task: purgeTask,
  sprint: purgeSprint,
  segment: purgeSegment,
  keyframe: purgeKeyframe,
}

function warningFromResult(data: unknown): string | null {
  if (data && typeof data === 'object' && 'warning' in data) {
    const warning = (data as { warning: unknown }).warning
    return typeof warning === 'string' ? warning : null
  }
  return null
}

export function TrashRowActions({
  kind,
  id,
  parentTrashed,
}: {
  kind: TrashKind
  id: string
  parentTrashed: boolean
}) {
  const router = useRouter()
  const [restorePending, startRestore] = useTransition()
  const [purgePending, startPurge] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const disabledReason = restoreDisabledReason({ parentTrashed })
  const purgeAction = PURGE_BY_KIND[kind]

  function handleRestore() {
    startRestore(async () => {
      try {
        const res = await callRestore(kind, id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const warning = warningFromResult(res.data)
        if (warning) toast.success('Restored', { description: warning })
        else toast.success('Restored')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handlePurge() {
    if (!purgeAction) return
    startPurge(async () => {
      try {
        const res = await purgeAction(id, confirmText)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Deleted forever')
        setConfirmOpen(false)
        setConfirmText('')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={Boolean(disabledReason) || restorePending}
        title={disabledReason ?? undefined}
        onClick={handleRestore}
      >
        {restorePending ? (
          <Loader2Icon className="animate-spin" aria-hidden />
        ) : (
          <RotateCcwIcon aria-hidden />
        )}
        Restore
      </Button>

      {purgeAction ? (
        <Dialog
          open={confirmOpen}
          onOpenChange={(open) => {
            setConfirmOpen(open)
            if (!open) setConfirmText('')
          }}
        >
          <DialogTrigger render={<Button variant="ghost" size="sm" type="button" />}>
            <Trash2Icon aria-hidden />
            Delete forever
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete forever?</DialogTitle>
              <DialogDescription>
                This permanently removes the data and its stored files. There is no undo.
                Type{' '}
                <span className="font-mono font-medium text-foreground">
                  {PURGE_CONFIRM_PHRASE}
                </span>{' '}
                to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={PURGE_CONFIRM_PHRASE}
              aria-label={`Type "${PURGE_CONFIRM_PHRASE}" to confirm`}
              autoComplete="off"
              // The confirm is an exact, case-sensitive string match. iOS
              // Safari capitalises the first letter of a text field by
              // default and both mobile keyboards autocorrect — either one
              // turns "delete forever" into something that never matches, and
              // the button below just stays disabled with no explanation.
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono"
            />
            <DialogFooter>
              <Button
                variant="destructive"
                type="button"
                disabled={!matchesPurgeConfirm(confirmText) || purgePending}
                // Same reason Restore carries one: a disabled button with no
                // stated reason reads as broken.
                title={
                  matchesPurgeConfirm(confirmText)
                    ? undefined
                    : `Type "${PURGE_CONFIRM_PHRASE}" above to enable this`
                }
                onClick={handlePurge}
              >
                {purgePending ? 'Deleting…' : 'Delete forever'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
