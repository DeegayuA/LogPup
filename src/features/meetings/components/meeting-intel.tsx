'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  MessageCircleQuestion,
  Mic,
  MonitorSpeaker,
  Sparkles,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  analyzeMeetingAudio,
  getMeetingIntel,
  type MeetingIntel,
} from '@/features/meetings/ai-actions'

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

export function MeetingIntelPanel({
  meetingId,
  canRecord,
}: {
  meetingId: string
  canRecord: boolean
}) {
  const [open, setOpen] = useState(false)
  const [intel, setIntel] = useState<MeetingIntel | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, startAnalyzing] = useTransition()
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamsRef = useRef<MediaStream[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadIntel() {
    setLoading(true)
    try {
      const res = await getMeetingIntel(meetingId)
      if (res.ok) setIntel(res.data)
      else toast.error(res.error)
    } catch {
      toast.error('Could not load meeting intelligence')
    } finally {
      setLoading(false)
    }
  }

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next && !intel) void loadIntel()
  }

  function cleanupCapture() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    for (const stream of streamsRef.current) {
      for (const track of stream.getTracks()) track.stop()
    }
    streamsRef.current = []
    void audioCtxRef.current?.close().catch(() => undefined)
    audioCtxRef.current = null
    recorderRef.current = null
    setRecording(false)
    setSeconds(0)
  }

  useEffect(() => cleanupCapture, [])

  async function startRecording(withScreen: boolean) {
    const mimeType = pickMimeType()
    if (!mimeType) {
      toast.error('This browser cannot record audio — try Chrome')
      return
    }
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamsRef.current.push(mic)
      let captureStream = mic

      if (withScreen) {
        // Sharing a tab/screen with audio; only the audio tracks are kept,
        // mixed with the mic so the recording hears both sides of the call.
        const screen = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        })
        streamsRef.current.push(screen)
        const audioCtx = new AudioContext()
        audioCtxRef.current = audioCtx
        const destination = audioCtx.createMediaStreamDestination()
        audioCtx.createMediaStreamSource(mic).connect(destination)
        if (screen.getAudioTracks().length > 0) {
          audioCtx
            .createMediaStreamSource(new MediaStream(screen.getAudioTracks()))
            .connect(destination)
        } else {
          toast.info(
            'No tab audio shared — recording mic only. Pick a tab and enable “Share audio” for both sides.',
          )
        }
        captureStream = destination.stream
      }

      chunksRef.current = []
      const recorder = new MediaRecorder(captureStream, { mimeType })
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType.split(';')[0] })
        cleanupCapture()
        if (blob.size === 0) {
          toast.error('Nothing was recorded')
          return
        }
        if (blob.size > 15 * 1024 * 1024) {
          toast.error('Recording is over 15MB — keep segments under ~20 minutes')
          return
        }
        startAnalyzing(async () => {
          try {
            const formData = new FormData()
            formData.append('audio', new File([blob], 'meeting-audio', { type: blob.type }))
            const res = await analyzeMeetingAudio(meetingId, formData)
            if (!res.ok) {
              toast.error(res.error)
              return
            }
            toast.success('Meeting analyzed — notes are ready')
            await loadIntel()
          } catch {
            toast.error('Something went wrong — try again')
          }
        })
      }
      recorder.start(1000)
      setRecording(true)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      cleanupCapture()
      toast.error('Could not start capture — check mic/screen permissions')
    }
  }

  const notes = intel?.notes ?? null
  const prep = intel?.prep ?? null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={toggleOpen} aria-expanded={open}>
          <Sparkles />
          Intelligence
          <ChevronDown
            className={cn('transition-transform duration-150', open && 'rotate-180')}
            aria-hidden
          />
        </Button>
        {open && canRecord && !recording && !analyzing ? (
          <>
            <Button variant="outline" size="sm" type="button" onClick={() => startRecording(false)}>
              <Mic /> Record mic
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={() => startRecording(true)}>
              <MonitorSpeaker /> Record screen + mic
            </Button>
          </>
        ) : null}
        {recording ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              type="button"
              onClick={() => recorderRef.current?.stop()}
            >
              <Square />
              Stop ·{' '}
              <span className="font-mono">
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
              </span>
            </Button>
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive"
              role="status"
            >
              <span
                className="size-2 shrink-0 animate-pulse rounded-full bg-destructive motion-reduce:animate-none"
                aria-hidden
              />
              Recording — audio is sent to Google Gemini for analysis
            </span>
          </>
        ) : null}
        {analyzing ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Transcribing and taking notes…
          </span>
        ) : null}
      </div>

      {open && canRecord && !recording && !analyzing ? (
        <p className="text-xs text-muted-foreground">
          Audio is processed by Google Gemini using your API key. Make sure attendees consent to
          recording.
        </p>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
          {loading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Fetching notes…
            </span>
          ) : (
            <>
              {prep && prep.questions.length > 0 ? (
                <section className="flex flex-col gap-1.5">
                  <h4 className="flex items-center gap-1.5 font-heading text-sm font-semibold">
                    <MessageCircleQuestion className="size-3.5 text-primary" aria-hidden />
                    Questions from “{prep.fromTitle}” ({format(prep.fromDate, 'MMM d')})
                  </h4>
                  <ul className="flex flex-col gap-1.5">
                    {prep.questions.map((entry) => (
                      <li key={entry.person} className="text-sm">
                        <span className="font-medium">{entry.person}:</span>
                        <ul className="ml-4 list-disc text-muted-foreground">
                          {entry.questions.map((question) => (
                            <li key={question}>{question}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {notes ? (
                <>
                  {notes.summary ? (
                    <section className="flex flex-col gap-1">
                      <h4 className="font-heading text-sm font-semibold">Summary</h4>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {notes.summary}
                      </p>
                    </section>
                  ) : null}

                  {notes.perPerson.length > 0 ? (
                    <section className="flex flex-col gap-1.5">
                      <h4 className="font-heading text-sm font-semibold">By person</h4>
                      <ul className="flex flex-col gap-2">
                        {notes.perPerson.map((person) => (
                          <li key={person.name} className="text-sm">
                            <span className="font-medium">{person.name}</span>
                            {person.points.length > 0 ? (
                              <ul className="ml-4 list-disc text-muted-foreground">
                                {person.points.map((point) => (
                                  <li key={point}>{point}</li>
                                ))}
                              </ul>
                            ) : null}
                            {person.actionItems.length > 0 ? (
                              <ul className="ml-4 list-disc">
                                {person.actionItems.map((item) => (
                                  <li key={item}>→ {item}</li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {notes.deadlines.length > 0 ? (
                    <section className="flex flex-col gap-1.5">
                      <h4 className="font-heading text-sm font-semibold">Deadlines</h4>
                      <ul className="flex flex-col gap-1">
                        {notes.deadlines.map((deadline) => (
                          <li key={`${deadline.item}-${deadline.owner}`} className="text-sm">
                            {deadline.item}
                            <span className="text-muted-foreground"> — {deadline.owner}, </span>
                            <span className="font-mono text-xs">{deadline.due}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {notes.terms.length > 0 ? (
                    <section className="flex flex-col gap-1.5">
                      <h4 className="font-heading text-sm font-semibold">Terms</h4>
                      <ul className="flex flex-col gap-1">
                        {notes.terms.map((term) => (
                          <li key={term.term} className="text-sm">
                            <span className="font-mono text-xs">{term.term}</span>
                            <span className="text-muted-foreground"> — {term.explanation}</span>
                            {term.sinhala ? (
                              <span className="text-muted-foreground"> · {term.sinhala}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {notes.questions.length > 0 ? (
                    <section className="flex flex-col gap-1.5">
                      <h4 className="font-heading text-sm font-semibold">For next meeting</h4>
                      <ul className="flex flex-col gap-1.5">
                        {notes.questions.map((entry) => (
                          <li key={entry.person} className="text-sm">
                            <span className="font-medium">{entry.person}:</span>
                            <ul className="ml-4 list-disc text-muted-foreground">
                              {entry.questions.map((question) => (
                                <li key={question}>{question}</li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <p className="text-xs text-muted-foreground">
                    Analyzed {format(notes.createdAt, 'MMM d, h:mm a')} ·{' '}
                    <span className="font-mono">{notes.model}</span>
                  </p>
                </>
              ) : !prep ? (
                <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    No AI notes yet.{' '}
                    {canRecord
                      ? 'Record the meeting (mic, or screen + mic for calls) and LogPup will transcribe it — English and Sinhala both work. You need a Gemini key in '
                      : 'The meeting host can record and analyze it. Keys live in '}
                    <Link href="/profile#gemini" className="underline hover:text-foreground">
                      Profile → Gemini API keys
                    </Link>
                    .
                  </span>
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
