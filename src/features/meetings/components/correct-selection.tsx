'use client'

import { useCallback, useEffect, useRef, useState, useTransition, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Loader2Icon, SpellCheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { bilingualText } from '@/features/meetings/components/meeting-chips'
import { normalizeSelectedTerm, MAX_TERM_CHARS } from '@/features/meetings/text-replace'
import {
  findMeetingReplacements,
  type MeetingReplaceMatches,
} from '@/features/meetings/text-replace-actions'

/**
 * "This word is wrong — it is wrong everywhere."
 *
 * The other half of the correction feature. Editing a note and fixing a word
 * already offers to propagate the fix (note-timeline.tsx, offerReplaceAll), but
 * that path can only start somewhere editable — and the place a mis-heard name
 * actually lives is the transcript, which nobody may free-form edit, and the AI
 * summary, which is prose people read rather than a field they type in. Reading
 * "Altavision" in the Sinhala half of a write-up whose English half says
 * "Ultravision", there was no way to say so.
 *
 * So: highlight the word, anywhere in the write-up, and say what it should be.
 * Same engine, same per-occurrence review, same server-side authorization — the
 * only new thing is where the term comes from.
 */

/** Gap between the highlighted text and the button offering to fix it. */
const OFFSET_PX = 8
/** Below this much room above the selection, the button goes underneath it. */
const FLIP_THRESHOLD_PX = 56

type Offer = { term: string; rect: DOMRect }

/**
 * The live selection, if it is one this feature can act on.
 *
 * Everything here is a reason to stay quiet rather than an error: a person
 * selecting text is usually just reading, or copying, and this runs on every
 * selection they make.
 */
function readOffer(container: HTMLElement | null): Offer | null {
  if (!container) return null

  // A selection inside a textarea or input is the person editing — they already
  // have the edit-and-propagate path, and a floating button over their own
  // typing is in the way. Browsers do not surface a field's internal selection
  // through window.getSelection(), but the focus check makes that a decision
  // rather than a browser detail this depends on.
  const active = document.activeElement
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return null

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  // Both ends inside the write-up. commonAncestorContainer alone would accept a
  // selection that starts in the notes and runs off into the page around them.
  if (!container.contains(range.commonAncestorContainer)) return null

  const term = normalizeSelectedTerm(selection.toString())
  if (!term) return null

  const rect = range.getBoundingClientRect()
  // A collapsed or off-screen rect has nowhere to anchor a button.
  if (rect.width === 0 && rect.height === 0) return null

  return { term, rect }
}

export function SelectionCorrector({
  meetingId,
  containerRef,
  enabled,
  onFound,
}: {
  meetingId: string
  /** The region whose text is correctable — the write-up, not the whole page. */
  containerRef: RefObject<HTMLElement | null>
  /** Off for anyone who could not apply the change anyway. */
  enabled: boolean
  /** Hands the caller a reviewed-and-ready replace, to render its own dialog. */
  onFound: (found: { term: string; replacement: string; matches: MeetingReplaceMatches }) => void
}) {
  const [offer, setOffer] = useState<Offer | null>(null)
  // The term is frozen the moment the prompt opens: focusing the input drops
  // the selection, and reading it again at submit time would find nothing.
  const [prompt, setPrompt] = useState<string | null>(null)

  // Adjust-during-render rather than an effect (the pattern used in
  // replace-review-dialog.tsx and meeting-notes.tsx): when the gate closes —
  // the prompt opens, or the write-up's raw editor does — the offer must be
  // gone in the SAME paint. Clearing it from an effect would show one frame of
  // a button anchored to a rect that is no longer where the text is.
  const gate = `${enabled}:${prompt ?? ''}`
  const [prevGate, setPrevGate] = useState(gate)
  if (prevGate !== gate) {
    setPrevGate(gate)
    setOffer(null)
  }

  const refresh = useCallback(() => {
    setOffer(readOffer(containerRef.current))
  }, [containerRef])

  useEffect(() => {
    // Stops entirely while the prompt is open. The browser keeps the range
    // alive behind the dialog, so without this a mouseup inside the dialog
    // would re-raise the floating button on top of it.
    if (!enabled || prompt !== null) return

    let frame = 0
    // One frame late on purpose. On the second click of a double-click the
    // browser sets the word selection around mouseup, and getBoundingClientRect
    // is only meaningful once layout has settled.
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(refresh)
    }

    // Clearing is immediate — a click that collapses the selection must take
    // the button with it, not leave it hanging over text nobody has selected.
    const onSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) setOffer(null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOffer(null)
    }

    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('mouseup', schedule)
    document.addEventListener('touchend', schedule)
    // Shift+arrow selects without a pointer ever being involved.
    document.addEventListener('keyup', schedule)
    document.addEventListener('keydown', onKeyDown)
    // Capture, because the write-up scrolls inside its own panel as often as
    // the window does, and a fixed button over a moved selection is a lie.
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('selectionchange', onSelectionChange)
      document.removeEventListener('mouseup', schedule)
      document.removeEventListener('touchend', schedule)
      document.removeEventListener('keyup', schedule)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [enabled, prompt, refresh])

  function openPrompt(term: string) {
    setPrompt(term)
    setOffer(null)
  }

  const flip = offer !== null && offer.rect.top < FLIP_THRESHOLD_PX

  return (
    <>
      {/* No mounted guard: `offer` can only be set by a selection event, which
          never happens on the server, so the server and the first client render
          both produce nothing here and `document` is only touched after that. */}
      {offer
        ? createPortal(
            // Portalled to the body: the button is positioned against the
            // viewport, and any transformed ancestor between here and the root
            // would silently become its containing block instead.
            // The layer spans the viewport so the button can be placed
            // anywhere in it against viewport coordinates; only the button
            // itself takes pointer events, so nothing underneath is blocked.
            <div className="pointer-events-none fixed inset-0 z-50">
              <div
                className="pointer-events-auto absolute"
                style={{
                  top: flip ? offer.rect.bottom + OFFSET_PX : offer.rect.top - OFFSET_PX,
                  left: offer.rect.left + offer.rect.width / 2,
                  transform: `translate(-50%, ${flip ? '0' : '-100%'})`,
                }}
              >
                <Button
                  type="button"
                  size="sm"
                  className="shadow-md"
                  // mousedown, not click: by the time click fires the browser has
                  // already collapsed the selection under the press, and the rect
                  // this button is standing on is gone.
                  onMouseDown={(event) => {
                    event.preventDefault()
                    openPrompt(offer.term)
                  }}
                  onTouchStart={(event) => {
                    event.preventDefault()
                    openPrompt(offer.term)
                  }}
                  // Keyboard activation never fires mousedown. Selecting with
                  // shift+arrow and tabbing here has to work, and by the time
                  // this runs after a real press the button is already gone.
                  onClick={() => openPrompt(offer.term)}
                >
                  <SpellCheckIcon aria-hidden />
                  Fix everywhere
                  <span className="sr-only">— correct “{offer.term}” across this meeting</span>
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {prompt !== null ? (
        <CorrectionPrompt
          meetingId={meetingId}
          term={prompt}
          onClose={() => setPrompt(null)}
          onFound={(found) => {
            setPrompt(null)
            onFound(found)
          }}
        />
      ) : null}
    </>
  )
}

/**
 * "What should it say instead?"
 *
 * A deliberate second step rather than an inline edit-in-place. What follows is
 * a bulk rewrite across notes, the summary, the action items and the record of
 * what was said; typing the intended spelling on purpose, once, is the smallest
 * possible confirmation that this is meant.
 */
function CorrectionPrompt({
  meetingId,
  term,
  onClose,
  onFound,
}: {
  meetingId: string
  term: string
  onClose: () => void
  onFound: (found: { term: string; replacement: string; matches: MeetingReplaceMatches }) => void
}) {
  const [replacement, setReplacement] = useState(term)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Pre-filled with the wrong spelling and selected, so a correction is an
  // overtype rather than a retype — and for a Sinhala name, not having to
  // switch keyboards to reach the first character.
  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const next = replacement.trim()
  const unchanged = next === term
  const canSubmit = next.length > 0 && next.length <= MAX_TERM_CHARS && !unchanged

  function submit() {
    if (!canSubmit) return
    startTransition(async () => {
      try {
        const res = await findMeetingReplacements({ meetingId, term, fuzzy: true })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        if (res.data.occurrences.length === 0) {
          // Effectively unreachable — the selected text is itself a match — but
          // an empty review dialog would be a worse way to find that out.
          toast.info(`Could not find “${term}” to correct`)
          onClose()
          return
        }
        onFound({ term, replacement: next, matches: res.data })
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Correct this everywhere</DialogTitle>
          <DialogDescription>
            Every place this meeting says{' '}
            <span className={bilingualText}>“{term}”</span> — notes, the summary, action items and
            the transcript — is found first. Nothing changes until you tick it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correction-replacement">Should say</Label>
          <Input
            id="correction-replacement"
            ref={inputRef}
            autoFocus
            value={replacement}
            maxLength={MAX_TERM_CHARS}
            className={bilingualText}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
          />
          <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
            {unchanged ? 'Type the spelling it should have.' : null}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending || !canSubmit} onClick={submit}>
            {isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
            {isPending ? 'Searching…' : 'Find every mention'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
