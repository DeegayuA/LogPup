'use client'

import { useEffect } from 'react'
import { Loader2Icon, MicIcon, SquareIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useDictation } from './use-dictation'

/**
 * "Type this by talking" — one button that records a short clip and hands the
 * transcript to whatever field it sits next to.
 *
 * Click to start, click to stop; the transcript arrives a moment later. The
 * button reports its own three states (idle / recording / transcribing)
 * rather than going quiet, because a dictation that produced nothing and a
 * dictation still in flight look identical otherwise.
 *
 * Renders nothing where dictation cannot work (no MediaRecorder) instead of
 * showing a button that would fail on click.
 */
export function DictateButton({
  onText,
  disabled,
  className,
  label = 'Dictate',
  size = 'sm',
}: {
  /** Called once per completed dictation with the transcribed text. */
  onText: (text: string) => void
  disabled?: boolean
  className?: string
  /** Visible label; also the accessible name when the button is icon-only. */
  label?: string
  size?: 'sm' | 'icon-sm'
}) {
  const dictation = useDictation(onText)

  // Failures surface as a toast rather than inline text: the button is often
  // one control in a dense toolbar with nowhere to put a sentence, and a
  // silent no-op after speaking for ten seconds is the worst outcome.
  useEffect(() => {
    if (dictation.error) toast.error(dictation.error)
  }, [dictation.error])

  if (!dictation.supported) return null

  const busy = dictation.transcribing
  const iconOnly = size === 'icon-sm'

  let icon = <MicIcon aria-hidden />
  if (busy) icon = <Loader2Icon className="animate-spin" aria-hidden />
  else if (dictation.recording) icon = <SquareIcon aria-hidden />

  let text: string | null = label
  if (iconOnly) text = null
  else if (busy) text = 'Transcribing…'
  else if (dictation.recording) text = 'Stop'

  return (
    <>
      <Button
        type="button"
        variant={dictation.recording ? 'secondary' : 'outline'}
        size={size}
        disabled={disabled}
        // aria-disabled + an ignored click, rather than `disabled`, while a
        // clip is transcribing: a disabled button loses focus, so someone
        // driving this from the keyboard would be dumped back to the body at
        // the exact moment their words come back.
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        aria-pressed={dictation.recording}
        aria-label={iconOnly ? label : undefined}
        className={cn(className)}
        onClick={(event) => {
          if (busy) return
          if (dictation.recording) dictation.stop()
          else void dictation.start(event.currentTarget)
        }}
      >
        {icon}
        {text}
      </Button>
      {/* An icon-only mic button changing colour says nothing to a screen
          reader. This does — and it is polite, so it never interrupts
          whatever is being read when recording starts. */}
      <span role="status" aria-live="polite" className="sr-only">
        {dictation.recording ? 'Recording — click again to stop.' : null}
        {busy ? 'Transcribing what you said.' : null}
      </span>
    </>
  )
}
