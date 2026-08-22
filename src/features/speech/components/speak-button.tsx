'use client'

import { useEffect, useRef } from 'react'
import { Loader2Icon, SquareIcon, Volume2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSpeech, type SpeechHandle } from './use-speech'

/**
 * "Read it to me" — plays a piece of text aloud in LogPup's voice, falling
 * back to the device's own voice when Gemini TTS is unavailable (see
 * useSpeech for the ladder). Click again to stop.
 *
 * Text is resolved lazily via a getter so a caller can hand over something
 * assembled at click time (a whole summary, a filtered list) without
 * rebuilding that string on every render.
 */
export function SpeakButton({
  getText,
  speech: external,
  disabled,
  className,
  label = 'Read aloud',
  size = 'sm',
}: {
  getText: () => string
  /**
   * Share a caller's SpeechHandle instead of owning one. Two independent
   * instances know nothing of each other: in MeetingAssistant the auto-spoken
   * answer and this button each held their own — clicking Play during the
   * auto-speak paid a SECOND Gemini TTS call for identical text, both voices
   * overlapped, and each Stop silenced only its own half.
   */
  speech?: SpeechHandle
  disabled?: boolean
  className?: string
  label?: string
  size?: 'sm' | 'icon-sm'
}) {
  const internal = useSpeech()
  const speech = external ?? internal
  // Which message has already been shown. Without it the effect re-fires when
  // `speaking` flips false at the end of a fallback reading, and a notice the
  // user already saw as info comes back as an error toast after the audio
  // finished playing perfectly well.
  const notifiedRef = useRef<string | null>(null)

  // A fallback to the device voice is worth saying out loud (it sounds
  // different, and the reason — no key, quota — is actionable), but it is
  // not a failure: the toast is informational when audio is playing.
  useEffect(() => {
    if (!speech.error) {
      notifiedRef.current = null
      return
    }
    if (notifiedRef.current === speech.error) return
    notifiedRef.current = speech.error
    if (speech.speaking) toast.info(speech.error)
    else toast.error(speech.error)
  }, [speech.error, speech.speaking])

  const iconOnly = size === 'icon-sm'
  const active = speech.speaking || speech.loading

  let icon = <Volume2Icon aria-hidden />
  if (speech.loading) icon = <Loader2Icon className="animate-spin" aria-hidden />
  else if (speech.speaking) icon = <SquareIcon aria-hidden />

  let text: string | null = label
  if (iconOnly) text = null
  else if (speech.loading) text = 'Preparing…'
  else if (speech.speaking) text = 'Stop'

  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size={size}
      disabled={disabled}
      aria-pressed={active}
      aria-label={iconOnly ? label : undefined}
      className={cn(className)}
      onClick={(event) => {
        if (active) speech.stop()
        else void speech.speak(getText(), event.currentTarget)
      }}
    >
      {icon}
      {text}
    </Button>
  )
}
