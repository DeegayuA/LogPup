'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { emptyTrashPhrase, emptyTrashSummary, purgeProgressMessage } from '@/features/admin/danger-logic'
import { emptyTrash } from '@/features/admin/danger-actions'
import { DangerConfirmControl } from '@/features/admin/components/danger-confirm-control'

/**
 * Last on the page: the widest blast radius of the four, and the only one that
 * ends every restore path the workspace has.
 *
 * The link out to Trash is part of the control, not decoration — this is the
 * one danger-zone action whose targets are all individually listed somewhere
 * else, and reading the list before ending it is the review step.
 */
export function DangerTrashEmptyCard({ trashCount }: { trashCount: number }) {
  const router = useRouter()

  return (
    <DangerConfirmControl
      title="Empty the trash"
      lead={
        <>
          Permanently deletes everything currently in{' '}
          <Link href="/admin/trash" className="font-medium text-foreground underline underline-offset-2">
            Trash
          </Link>{' '}
          — projects, meetings, tasks, sprints, note segments and keyframes, plus the
          Blob objects behind those keyframes. Nothing restores afterwards.
        </>
      }
      radius={emptyTrashSummary(trashCount)}
      phrase={emptyTrashPhrase(trashCount)}
      phraseLabel=""
      openLabel="Empty the trash…"
      confirmLabel="Delete forever"
      pendingLabel="Emptying…"
      emptyMessage={trashCount === 0 ? 'The trash is already empty.' : null}
      onConfirm={async (confirm) => {
        try {
          const res = await emptyTrash(confirm)
          if (!res.ok) {
            toast.error(res.error)
            return
          }
          toast.success(purgeProgressMessage(res.data, { one: 'item', many: 'items' }))
          router.refresh()
        } catch {
          toast.error('Something went wrong — try again')
        }
      }}
    />
  )
}
