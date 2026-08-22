'use client'

import { useState, useTransition } from 'react'
import { Loader2Icon, SendIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { bilingualText } from '@/features/meetings/components/meeting-chips'
import { askMeeting } from '@/features/meetings/assistant-actions'
import {
  meterOrigin,
  useAiMeter,
} from '@/features/gemini/components/ai-meter-provider'
import type { MeterOriginPoint } from '@/features/gemini/meter-tasks'
import { DictateButton } from '@/features/speech/components/dictate-button'
import { SpeakButton } from '@/features/speech/components/speak-button'
import { useSpeech } from '@/features/speech/components/use-speech'

/**
 * Ask this meeting a question — by typing or by talking — and get a short
 * answer back, spoken aloud as well as written.
 *
 * The spoken half is automatic ONLY for questions asked by voice: someone
 * who dictated a question has their hands (or eyes) elsewhere, which is why
 * they spoke it. A typed question gets a written answer and a play button,
 * because unexpected audio out of a laptop in an open office is a genuinely
 * bad surprise.
 */
export function MeetingAssistant({ meetingId }: { meetingId: string }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [asking, startAsking] = useTransition()
  const meter = useAiMeter()
  const speech = useSpeech()

  /* `origin` is a POINT, not the event: the call happens inside a
     transition, by which time React has nulled the event's currentTarget. It
     is frozen at click time by meterOrigin and passed down. */
  function ask(text: string, viaVoice: boolean, origin: MeterOriginPoint | null) {
    const asked = text.trim()
    if (!asked) return
    setAnswer(null)
    startAsking(async () => {
      try {
        const res = await meter.track('meeting-assistant', origin, () =>
          askMeeting(meetingId, asked),
        )
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setAnswer(res.data.answer)
        // `viaVoice` is read from THIS call's closure, not shared state: a
        // shared ref was clobbered when a second question overlapped the
        // first, making a typed question's answer speak itself.
        if (viaVoice) void speech.speak(res.data.answer)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5">
      <h5 className="flex items-center gap-1.5 text-sm font-semibold">
        <SparklesIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        Ask this meeting
      </h5>
      <p className="text-2xs text-muted-foreground">
        Answers come only from this meeting&rsquo;s own record — transcript, notes, action items and
        open follow-ups. Ask in Sinhala or English.
      </p>

      <form
        className="flex flex-wrap items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault()
          ask(question, false, meterOrigin(event.currentTarget))
        }}
      >
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What did we decide about the login flow?"
          aria-label="Ask a question about this meeting"
          maxLength={500}
          disabled={asking}
          className="min-w-0 flex-1 basis-56"
        />
        {/* A dictated question is asked immediately — stopping to press
            Send after speaking defeats the point of asking out loud. */}
        <DictateButton
          onText={(text) => {
            setQuestion(text)
            /* No event to read: the dictate button reports text after its own
               async transcription finished. The meter's designed answer to a
               missing origin is to appear in place. */
            ask(text, true, null)
          }}
          disabled={asking}
          label="Ask by voice"
          size="icon-sm"
        />
        <Button type="submit" size="icon-sm" disabled={asking || question.trim().length === 0}>
          {asking ? <Loader2Icon className="animate-spin" aria-hidden /> : <SendIcon aria-hidden />}
          <span className="sr-only">Ask</span>
        </Button>
      </form>

      {asking ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          <Loader2Icon className="size-3 animate-spin" aria-hidden />
          Reading the meeting…
        </p>
      ) : null}

      {answer ? (
        // The "Reading the meeting…" line above disappears the moment the
        // answer lands, so without a live region here a screen-reader user
        // is told the request started and never told it finished.
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-muted/30 p-2.5"
        >
          <p className={cn(bilingualText, 'text-foreground')}>{answer}</p>
          <div className="flex justify-end">
            {/* Shares the component's own handle: while the auto-speak is
                loading or talking this button shows Stop for THAT audio,
                instead of paying a second TTS call for the same text and
                playing both voices at once. */}
            <SpeakButton speech={speech} getText={() => answer} label="Play answer" />
          </div>
        </div>
      ) : null}
    </section>
  )
}
