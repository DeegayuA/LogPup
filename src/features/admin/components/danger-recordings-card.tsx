'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { wipeMeetingRecordings } from '@/features/admin/danger-actions'
import {
  purgeProgressMessage,
  wipeRecordingsPhrase,
  wipeRecordingsSummary,
} from '@/features/admin/danger-logic'
import { DangerConfirmControl } from '@/features/admin/components/danger-confirm-control'

/**
 * Destroys the screen keyframes behind every AI meeting write-up.
 *
 * There is no target to name, so the phrase carries the CURRENT keyframe count
 * instead. That cannot be typed from memory of a previous run, and it doubles
 * as an interlock: if somebody records a meeting between this page rendering
 * and the button being pressed, the number the server computes no longer
 * matches what was typed and the run stops rather than destroying more than
 * was read about.
 */
export function DangerRecordingsCard({ keyframeCount }: { keyframeCount: number }) {
  const router = useRouter()

  return (
    <DangerConfirmControl
      title="Delete all meeting recordings"
      lead={
        <>
          Permanently deletes every screen keyframe captured during a recording, and the
          image behind each one in Blob storage. The meetings, their AI write-ups and
          every note segment produced from them are untouched — the notes stay, the
          evidence behind them does not.
        </>
      }
      radius={wipeRecordingsSummary(keyframeCount)}
      phrase={wipeRecordingsPhrase(keyframeCount)}
      phraseLabel=""
      openLabel="Delete all recordings…"
      confirmLabel="Delete keyframes"
      pendingLabel="Deleting…"
      emptyMessage={keyframeCount === 0 ? 'There are no keyframes stored right now.' : null}
      onConfirm={async (confirm) => {
        try {
          const res = await wipeMeetingRecordings(confirm)
          if (!res.ok) {
            toast.error(res.error)
            return
          }
          toast.success(
            purgeProgressMessage(res.data, { one: 'keyframe', many: 'keyframes' }),
          )
          router.refresh()
        } catch {
          toast.error('Something went wrong — try again')
        }
      }}
    />
  )
}
