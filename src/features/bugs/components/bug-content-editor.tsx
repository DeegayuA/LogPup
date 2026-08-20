'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2Icon, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { updateBugContent } from '@/features/bugs/actions'

/**
 * Correcting a bug's title and description in place.
 *
 * INLINE, NOT A DIALOG. What you are fixing is almost always a title that
 * reads wrong NEXT TO the other titles — "login broken" among nine other
 * things called broken — so the row it belongs to has to stay on screen while
 * you rewrite it. A modal covers exactly the context that told you the title
 * was bad.
 *
 * NOTHING IS DISCARDED BY ACCIDENT. Escape does not close the editor and
 * clicking away does not either; leaving is an explicit Cancel. A half-written
 * description is worth more than the tidiness of dismiss-on-blur, and this is
 * a form somebody types paragraphs into.
 *
 * Only the changed fields are sent, so fixing a title cannot silently rewrite
 * a description somebody else reformatted underneath in the meantime.
 */
export function BugContentEditor({
  bugId,
  title,
  description,
}: {
  bugId: string
  title: string
  description: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftDescription, setDraftDescription] = useState(description)
  const [pending, startSaving] = useTransition()

  const nextTitle = draftTitle.trim()
  const nextDescription = draftDescription.trim()
  const changed = nextTitle !== title.trim() || nextDescription !== description.trim()

  function save() {
    if (!changed) {
      setOpen(false)
      return
    }
    startSaving(async () => {
      try {
        const res = await updateBugContent({
          bugId,
          // Only what actually moved — see the note above.
          ...(nextTitle !== title.trim() ? { title: nextTitle } : {}),
          ...(nextDescription !== description.trim() ? { description: nextDescription } : {}),
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Report updated')
        setOpen(false)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit the report for ${title}`}
        onClick={() => setOpen(true)}
      >
        <PencilLine aria-hidden className="size-3.5" />
      </Button>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Input
        value={draftTitle}
        onChange={(event) => setDraftTitle(event.target.value)}
        maxLength={140}
        aria-label="Bug title"
        className="h-9 text-sm font-medium"
      />
      <Textarea
        value={draftDescription}
        onChange={(event) => setDraftDescription(event.target.value)}
        maxLength={4000}
        rows={4}
        aria-label="What happened"
        className="min-h-24 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || !changed} onClick={save}>
          {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            setDraftTitle(title)
            setDraftDescription(description)
            setOpen(false)
          }}
        >
          Cancel
        </Button>
        {/* The bounds are the reporting form's, reused rather than restated
            (bugContentInput lifts them from bugReportInput). Saying them here
            beats a server refusal after the typing is done. */}
        <span className="text-2xs text-muted-foreground">
          Title 4–140 characters, description at least 10.
        </span>
      </div>
    </div>
  )
}
