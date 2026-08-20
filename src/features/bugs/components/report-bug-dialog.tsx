'use client'

import { useState, useTransition, type FormEvent, type ReactElement } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Bug, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { reportBug } from '@/features/bugs/actions'

/**
 * "Report a bug", wherever a person is standing when something breaks.
 *
 * IT CAPTURES THE ROUTE ITSELF. `page_path` is the most useful field in a bug
 * report and the one nobody types (schema.ts says as much on the column), so
 * this dialog reads the live route out of the router rather than asking. A
 * text field for it would be filled in wrong, left blank, or — worst —
 * answered with "the bugs page", because by the time somebody opens a form
 * they have already navigated away from the thing that broke.
 *
 * The search string is kept: half the reproducible bugs in a filtered board
 * or a selected sprint ARE the query params. It is truncated rather than
 * dropped if it runs long, because a 512-character path is worth having in
 * part and worth nothing rejected.
 *
 * NO SEVERITY FIELD. See report-input.ts — the reporter says what happened,
 * triage decides how bad it is.
 */

/** Matches bugPagePath's ceiling in report-input.ts. */
const PAGE_PATH_LIMIT = 512

export function ReportBugDialog({
  appId,
  appName,
  trigger,
}: {
  appId: string
  appName: string
  /** Lets a caller restyle the button without this file knowing the surface. */
  trigger?: ReactElement
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pending, startSubmitting] = useTransition()

  const query = searchParams.toString()
  const pagePath = `${pathname}${query ? `?${query}` : ''}`.slice(0, PAGE_PATH_LIMIT)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Reset on every transition, not only on close: a dialog reopened after a
    // successful report must not still hold the last one's text, which reads
    // as "it didn't save".
    setTitle('')
    setDescription('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startSubmitting(async () => {
      try {
        const res = await reportBug({ appId, title, description, pagePath })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Bug reported', { description: `${appName} · someone will triage it` })
        handleOpenChange(false)
      } catch {
        // A server action can REJECT as well as resolve with `{ ok: false }`.
        // Unhandled, the dialog sits open with the button un-stuck and says
        // nothing, and the person retypes the whole report.
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? <Button variant="outline" size="sm" />}>
        <Bug aria-hidden />
        Report a bug
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a bug</DialogTitle>
          <DialogDescription>
            Something broken in <span className="font-medium text-foreground">{appName}</span>.
            Say what happened — how bad it is gets decided in triage.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bug-title">What went wrong</Label>
            <Input
              id="bug-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Sprint switcher forgets the backlog"
              minLength={4}
              maxLength={140}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bug-description">What you were doing</Label>
            <Textarea
              id="bug-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Picked Backlog, then chose a sprint from the dropdown — it jumped back to Overview."
              minLength={10}
              maxLength={4000}
              rows={5}
              required
              aria-describedby="bug-page-path"
            />
            <p id="bug-page-path" className="text-2xs text-muted-foreground">
              We&apos;ll attach the page you were on:{' '}
              <span className="font-mono break-all text-foreground">{pagePath}</span>
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {pending ? 'Filing…' : 'File bug'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
