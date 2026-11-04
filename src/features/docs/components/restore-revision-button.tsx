'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { docsHref } from '@/features/docs/docs'
import { restoreRevision } from '@/features/docs/actions'

/** "Restore this version": saves version N's text as a NEW version, so no history is lost. */
export function RestoreRevisionButton({ slug, docId, version }: { slug: string; docId: string; version: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function restore() {
    startTransition(async () => {
      try {
        const result = await restoreRevision({ docId, version })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`Version ${version} restored as version ${result.data.version}`)
        router.push(docsHref(slug, { doc: docId }))
      } catch {
        toast.error('Could not reach the server — try again')
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="outline" disabled={pending} />}>
        <RotateCcw aria-hidden />
        Restore version {version}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore version {version}?</AlertDialogTitle>
          <AlertDialogDescription>
            The page goes back to how it looked in version {version}. This is saved as a new version, so nothing in the
            history is lost and you can undo it the same way.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={restore}>Restore</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
