'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2Icon, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteApp } from '@/features/apps/actions'

/**
 * The delete half of the Settings tab's danger area, sitting under Archiving
 * so the reversible option is read first.
 *
 * THE CONFIRMATION IS THE SLUG, NOT A CONSTANT. A fixed word ("DELETE") is
 * muscle memory after the second use, and the mistake this guards against is
 * not "meant to keep it" — it is "deleted the wrong project", which typing a
 * generic word does nothing to catch. Typing the address of the app in front
 * of you cannot be done from memory of a previous delete.
 *
 * Deliberately not an AlertDialog: the dialog pattern in this codebase is for
 * one-line confirmations, and everything below — what survives, what does
 * not, and where to get it back — has to be readable WHILE typing the
 * confirmation, not on a layer that replaced it.
 *
 * FOCUS FOLLOWS THE ARM, the same grammar as DeleteBugButton: opening the
 * confirm step replaces the trigger, so focus moves to the confirmation
 * field, Esc (or Cancel) disarms and hands focus back to the trigger, and a
 * persistent live region — rendered unconditionally, never remounted, per
 * capacity-heat-editable — announces the step.
 */
export function DeleteAppCard({
  appId,
  appName,
  slug,
}: {
  appId: string
  appName: string
  slug: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('')
  const [pending, startDeleting] = useTransition()
  const armButtonRef = useRef<HTMLButtonElement>(null)
  const confirmInputRef = useRef<HTMLInputElement>(null)
  // Only hand focus back when coming FROM the confirm step — without the
  // flag, the mount effect would steal focus on first render.
  const returnFocus = useRef(false)

  const matches = confirm.trim() === slug

  useEffect(() => {
    if (open) {
      confirmInputRef.current?.focus()
    } else if (returnFocus.current) {
      returnFocus.current = false
      armButtonRef.current?.focus()
    }
  }, [open])

  function arm() {
    setOpen(true)
    setStatus(`Confirm deleting ${appName} — type the app's address to enable Delete, Escape cancels.`)
  }

  function disarm() {
    returnFocus.current = true
    setOpen(false)
    setConfirm('')
    setStatus('Delete cancelled.')
  }

  function handleDelete() {
    if (!matches) return
    startDeleting(async () => {
      try {
        const res = await deleteApp(appId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`${appName} moved to trash`)
        // This page 404s the moment the delete lands, so leaving is part of
        // the action rather than something the person has to work out.
        router.push('/apps')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
        <TriangleAlert aria-hidden className="size-4 text-destructive" />
        Delete this app
      </h2>
      <p className="text-sm text-muted-foreground">
        Removes <span className="font-medium text-foreground">{appName}</span> from the
        Apps list, search, dashboards and the meetings calendar, along with its board and
        every sprint on it. Its meetings stay on the record. Nothing is erased — an admin
        can restore it from <span className="font-medium text-foreground">Trash</span>,
        and it comes back exactly as it left, archived or not.
      </p>

      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>

      {open ? (
        <div
          className="flex flex-col gap-2 pt-1"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !pending) {
              event.stopPropagation()
              disarm()
            }
          }}
        >
          <label className="text-2xs text-muted-foreground" htmlFor="delete-app-confirm">
            Type <span className="font-mono text-foreground">{slug}</span> to confirm.
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="delete-app-confirm"
              ref={confirmInputRef}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder={slug}
              autoComplete="off"
              className="h-9 max-w-[220px] font-mono text-sm"
            />
            <Button
              type="button"
              variant="destructive"
              disabled={!matches || pending}
              onClick={handleDelete}
            >
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              Delete app
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={disarm}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="pt-1">
          <Button ref={armButtonRef} variant="destructive" onClick={arm}>
            Delete app…
          </Button>
        </div>
      )}
    </div>
  )
}
