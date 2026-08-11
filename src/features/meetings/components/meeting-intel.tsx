'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  AlertCircle,
  Check,
  ChevronDown,
  CircleCheck,
  Languages,
  Loader2,
  MessageCircleQuestion,
  Mic,
  MonitorSpeaker,
  RotateCcw,
  Sparkles,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownLite } from '@/components/markdown-lite'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/lib/action-result'
import {
  analyzeMeetingAudio,
  getMeetingIntel,
  reopenFollowup,
  resolveFollowup,
  type CarriedForwardItem,
  type MeetingIntel,
} from '@/features/meetings/ai-actions'
import {
  CONFIDENCE_WINDOW_SIZE,
  otherLanguage,
  shouldSwitchLanguage,
  type ActiveLanguage,
} from '@/features/meetings/language-switch'

// --- Minimal Web Speech API typings ------------------------------------
// Not part of TypeScript's DOM lib (non-standard, webkit-prefixed). Declared
// narrowly here rather than pulling in `any` — only the surface this
// component actually uses.
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string
  // Omitted by some browsers entirely — never assume a number here, and
  // never treat a missing value as evidence of low confidence (see
  // language-switch.ts).
  readonly confidence?: number
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeLike
}
interface SpeechRecognitionResultListLike {
  readonly length: number
  [index: number]: SpeechRecognitionResultLike
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListLike
}
interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike
}
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructorLike
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike
  }
}

// The user-facing preference: "Auto" lets the recognizer switch languages
// mid-meeting on its own; the other two pin it, same as before this
// feature existed. `ActiveLanguage` (imported above) is the narrower set
// SpeechRecognition itself can actually run — "auto" is never sent to it.
type LanguagePreference = 'auto' | ActiveLanguage
const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'en-US', label: 'English' },
  { value: 'si-LK', label: 'Sinhala' },
]
const LANGUAGE_STORAGE_KEY = 'logpup:transcribe-language'
// Which language Auto mode last settled on, so the next recording starts
// there instead of always assuming English — "start with the last
// successful language (or English)".
const LAST_ACTIVE_LANGUAGE_STORAGE_KEY = 'logpup:transcribe-last-active-language'
const ACTIVE_LANGUAGE_LABEL: Record<ActiveLanguage, string> = {
  'en-US': 'English',
  'si-LK': 'Sinhala',
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

// A recording that finished but hasn't been successfully analyzed yet —
// kept in memory (not just a closure inside the onstop handler) so a
// transient Gemini failure never loses the recording: the Analyze action
// stays available to retry the exact same audio/transcript, no re-recording
// needed. Cleared only on a successful analysis or an explicit discard.
type PendingAudio = { blob: Blob; liveTranscript: string }

export function MeetingIntelPanel({
  meetingId,
  canRecord,
  currentUserId,
}: {
  meetingId: string
  canRecord: boolean
  currentUserId: string
}) {
  const [open, setOpen] = useState(false)
  const [intel, setIntel] = useState<MeetingIntel | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, startAnalyzing] = useTransition()
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [language, setLanguageState] = useState<LanguagePreference>('auto')
  // The language actually in use right now — equals `language` in manual
  // mode, but drifts from it in Auto mode as the recognizer switches.
  // Surfaced in the UI so a mid-recording switch is visible, not silent.
  const [activeLang, setActiveLangState] = useState<ActiveLanguage>('en-US')
  const [liveUnavailable, setLiveUnavailable] = useState(false)
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  // See PendingAudio above — set the moment a recording finishes, cleared
  // only once analysis actually succeeds (or the user discards it).
  const [pendingAudio, setPendingAudio] = useState<PendingAudio | null>(null)
  // Follow-up resolution state. `composingId` is the one row with its note
  // field open (only ever one at a time — this is a decision, not a form),
  // `keptOpenIds` are rows the user explicitly said "not yet" on so the
  // carry-forward promise can be stated back to them, and `busyFollowupId`
  // marks the row whose write is in flight.
  const [followupPending, startFollowupWrite] = useTransition()
  const [busyFollowupId, setBusyFollowupId] = useState<string | null>(null)
  const [composingId, setComposingId] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [keptOpenIds, setKeptOpenIds] = useState<Set<string>>(new Set())

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamsRef = useRef<MediaStream[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recordingRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const transcriptPanelRef = useRef<HTMLDivElement | null>(null)
  const nearBottomRef = useRef(true)
  // Mirrors `activeLang`/`language` state for use inside the recognition
  // event handlers below — those close over refs, not state, since a
  // handler set on `recognition.onresult` at start time would otherwise
  // see whatever `language` was at that moment forever, not its later
  // value after a switch or a re-render.
  const activeLangRef = useRef<ActiveLanguage>('en-US')
  const languagePreferenceRef = useRef<LanguagePreference>('auto')
  // Rolling window of confidence scores from the most recent FINAL
  // results, oldest first — capped at CONFIDENCE_WINDOW_SIZE. Reset to
  // empty after every switch (hysteresis: a fresh recognizer in the new
  // language deserves a clean read, not one dragged down by the low
  // scores that just triggered the switch).
  const confidenceWindowRef = useRef<number[]>([])
  // Timestamp of the last automatic switch (or of recording start, before
  // the first one) — how shouldSwitchLanguage enforces the ~10s cooldown.
  const lastSwitchAtRef = useRef(0)

  const liveSupported =
    typeof window !== 'undefined' && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (saved === 'auto' || saved === 'en-US' || saved === 'si-LK') {
        languagePreferenceRef.current = saved
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from localStorage on mount
        setLanguageState(saved)
      }
      const lastActive = window.localStorage.getItem(LAST_ACTIVE_LANGUAGE_STORAGE_KEY)
      if (lastActive === 'en-US' || lastActive === 'si-LK') {
        activeLangRef.current = lastActive
        setActiveLangState(lastActive)
      }
    } catch {
      /* private mode / unavailable — defaults stay Auto / English */
    }
  }, [])

  function setLanguage(value: LanguagePreference) {
    setLanguageState(value)
    languagePreferenceRef.current = value
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value)
    } catch {
      /* private mode / unavailable — selection just won't persist */
    }
  }

  // Updates the language actually in use — both the ref the recognition
  // handlers read and the state the UI badge renders — and remembers it as
  // Auto mode's "last successful language" for next time.
  function setActiveLang(next: ActiveLanguage) {
    activeLangRef.current = next
    setActiveLangState(next)
    try {
      window.localStorage.setItem(LAST_ACTIVE_LANGUAGE_STORAGE_KEY, next)
    } catch {
      /* private mode / unavailable — next Auto session just starts from English */
    }
  }

  // `silent` refetches without swapping the whole panel for a spinner —
  // used after a follow-up write, where the row already updated optimistically
  // and blanking the panel would be a bigger disruption than the change.
  async function loadIntel({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setLoading(true)
    try {
      const res = await getMeetingIntel(meetingId)
      if (res.ok) setIntel(res.data)
      else if (!silent) toast.error(res.error)
    } catch {
      if (!silent) toast.error('Could not load meeting intelligence')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next && !intel) void loadIntel()
  }

  function stopRecognition() {
    const recognition = recognitionRef.current
    if (recognition) {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.stop()
      } catch {
        /* already stopped */
      }
    }
    recognitionRef.current = null
  }

  function cleanupCapture() {
    recordingRef.current = false
    stopRecognition()
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
    setInterimText('')
    confidenceWindowRef.current = []
  }

  useEffect(() => cleanupCapture, [])

  // Notes that already exist should just be there — reading them shouldn't
  // cost a click. Fetch once on mount and open the panel only when there is
  // something to show, so meetings without analysis stay collapsed.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getMeetingIntel(meetingId)
        if (cancelled || !res.ok) return
        setIntel(res.data)
        if (res.data.notes || res.data.prep.length > 0) setOpen(true)
      } catch {
        /* Silent: this is an unprompted prefetch, not a user action. The
           Intelligence button still loads on demand and reports failures. */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [meetingId])

  // Auto-scroll the live panel to the newest line, but only when the user
  // was already near the bottom — don't fight someone scrolling up to
  // reread something.
  useEffect(() => {
    const el = transcriptPanelRef.current
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight
  }, [finalText, interimText])

  function handleTranscriptScroll() {
    const el = transcriptPanelRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  // Restarts recognition cleanly in the other language: Auto mode's only
  // lever, since the Web Speech API can't detect a language on its own
  // (see language-switch.ts). `finalTranscriptRef` is untouched here, so
  // everything transcribed so far survives the restart.
  function switchActiveLanguage() {
    const next = otherLanguage(activeLangRef.current)
    confidenceWindowRef.current = []
    lastSwitchAtRef.current = Date.now()
    setActiveLang(next)
    stopRecognition()
    startRecognition(next)
  }

  function startRecognition(lang: ActiveLanguage) {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const alternative = result[0]
        const transcript = alternative?.transcript ?? ''
        if (result.isFinal) {
          const trimmed = transcript.trim()
          if (trimmed) {
            finalTranscriptRef.current = finalTranscriptRef.current
              ? `${finalTranscriptRef.current} ${trimmed}`
              : trimmed
            setFinalText(finalTranscriptRef.current)
          }

          // Auto mode only: track confidence on FINAL results (interim
          // ones are provisional and far noisier) and hand the rolling
          // window to the pure decision function. Some browsers never
          // report `confidence` at all — skip those samples rather than
          // letting an absent score masquerade as a bad one.
          if (languagePreferenceRef.current === 'auto') {
            const confidence = alternative?.confidence
            if (typeof confidence === 'number') {
              confidenceWindowRef.current = [...confidenceWindowRef.current, confidence].slice(
                -CONFIDENCE_WINDOW_SIZE,
              )
            }
            const shouldSwitch = shouldSwitchLanguage({
              confidences: confidenceWindowRef.current,
              currentLang: activeLangRef.current,
              msSinceLastSwitch: Date.now() - lastSwitchAtRef.current,
            })
            if (shouldSwitch) switchActiveLanguage()
          }
        } else {
          interim += transcript
        }
      }
      setInterimText(interim)
    }
    recognition.onerror = (event) => {
      // Permanent failures (denied mic permission for recognition, no
      // capture device) — stop retrying and fall back to audio-only, same
      // as an unsupported browser. Transient errors (no-speech, network,
      // aborted) are left to onend's restart-on-drop below.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        recognition.onend = null
        setLiveUnavailable(true)
      }
    }
    recognition.onend = () => {
      // Some browsers silently end recognition after a pause in speech.
      // Restart it for as long as we're still recording; stopRecognition()
      // nulls this handler before calling stop() so a deliberate stop never
      // loops back here.
      if (!recordingRef.current) return
      try {
        recognition.start()
      } catch {
        /* already starting — the next onend will retry */
      }
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setLiveUnavailable(true)
    }
  }

  // Runs (or re-runs) analysis on already-captured audio. `pendingAudio`
  // is set by the caller *before* this fires and is only cleared on
  // success — so a 503/network failure, or any other error, leaves the
  // recording sitting there with the Analyze action still available
  // instead of vanishing. See PendingAudio's comment for why this exists.
  function runAnalysis(blob: Blob, liveTranscript: string) {
    startAnalyzing(async () => {
      try {
        const formData = new FormData()
        formData.append('audio', new File([blob], 'meeting-audio', { type: blob.type }))
        if (liveTranscript.trim()) formData.append('liveTranscript', liveTranscript)
        const res = await analyzeMeetingAudio(meetingId, formData)
        if (!res.ok) {
          // Server-side message is already specific and actionable (busy /
          // key rejected / generic — see GeminiError in client.ts) and
          // never includes the key itself.
          toast.error(res.error)
          return
        }
        setPendingAudio(null)
        toast.success('Meeting analyzed — notes are ready')
        await loadIntel()
      } catch {
        toast.error('Something went wrong — your recording is saved, try Analyze again')
      }
    })
  }

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
        const liveTranscript = finalTranscriptRef.current
        cleanupCapture()
        if (blob.size === 0) {
          toast.error('Nothing was recorded')
          return
        }
        if (blob.size > 15 * 1024 * 1024) {
          toast.error('Recording is over 15MB — keep segments under ~20 minutes')
          return
        }
        // Stash the recording BEFORE attempting analysis — if the request
        // fails (or throws) it stays here for the retry affordance below,
        // instead of only living in this closure and disappearing.
        setPendingAudio({ blob, liveTranscript })
        runAnalysis(blob, liveTranscript)
      }
      // A fresh recording starting is the one deliberate point where it's
      // safe to drop whatever unanalyzed recording came before — the user
      // is choosing to record again rather than retry the old one.
      setPendingAudio(null)
      recorder.start(1000)
      setRecording(true)
      recordingRef.current = true
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)

      if (liveSupported) {
        finalTranscriptRef.current = ''
        setFinalText('')
        setInterimText('')
        setLiveUnavailable(false)
        confidenceWindowRef.current = []
        lastSwitchAtRef.current = Date.now()
        // Auto mode starts from whichever language it last settled on
        // (persisted across sessions) rather than always assuming
        // English; manual mode always starts on the language chosen.
        const initialLang: ActiveLanguage = language === 'auto' ? activeLangRef.current : language
        setActiveLang(initialLang)
        startRecognition(initialLang)
      }
    } catch {
      cleanupCapture()
      toast.error('Could not start capture — check mic/screen permissions')
    }
  }

  // Patches one carried-forward row in place so a resolve/reopen lands
  // instantly; the silent refetch that follows replaces it with whatever the
  // server actually stored (and puts it back if the write failed).
  function patchFollowup(followupId: string, patch: Partial<CarriedForwardItem>) {
    setIntel((prev) =>
      prev
        ? {
            ...prev,
            prep: prev.prep.map((group) => ({
              ...group,
              items: group.items.map((item) =>
                item.id === followupId ? { ...item, ...patch } : item,
              ),
            })),
          }
        : prev,
    )
  }

  function runFollowupWrite(
    followupId: string,
    write: () => Promise<ActionResult>,
    success: string,
  ) {
    setBusyFollowupId(followupId)
    startFollowupWrite(async () => {
      try {
        const res = await write()
        if (res.ok) toast.success(success)
        else toast.error(res.error)
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        await loadIntel({ silent: true })
        setBusyFollowupId(null)
      }
    })
  }

  function handleResolve(followupId: string) {
    const note = (noteDrafts[followupId] ?? '').trim()
    setComposingId(null)
    setKeptOpenIds((prev) => {
      if (!prev.has(followupId)) return prev
      const next = new Set(prev)
      next.delete(followupId)
      return next
    })
    patchFollowup(followupId, {
      status: 'resolved',
      resolutionNote: note || null,
      resolvedAt: new Date(),
    })
    runFollowupWrite(
      followupId,
      () => resolveFollowup(followupId, note || undefined, meetingId),
      note ? 'Resolved — answer saved' : 'Marked resolved',
    )
  }

  function handleReopen(item: CarriedForwardItem) {
    // Keep the note that was there as a draft — reopening usually means the
    // answer was wrong or incomplete, not that it should be retyped.
    if (item.resolutionNote) {
      setNoteDrafts((prev) => ({ ...prev, [item.id]: item.resolutionNote ?? '' }))
    }
    patchFollowup(item.id, { status: 'open', resolutionNote: null, resolvedAt: null })
    runFollowupWrite(
      item.id,
      () => reopenFollowup(item.id),
      'Back open — it carries to the next meeting',
    )
  }

  // "Not yet" changes nothing in the database — an unresolved item is
  // already the thing that carries forward. What it does is say so out
  // loud, and get the note field out of the way.
  function handleNotYet(followupId: string) {
    setComposingId((prev) => (prev === followupId ? null : prev))
    setKeptOpenIds((prev) => new Set(prev).add(followupId))
  }

  const notes = intel?.notes ?? null
  const prep = intel?.prep ?? []
  // Resolved rows stay on screen as a record, so "is anything still owed?"
  // has to count open ones rather than trust the list being empty.
  const openCount = prep.reduce(
    (total, group) => total + group.items.filter((item) => item.status === 'open').length,
    0,
  )
  const showLiveText = recording && liveSupported && !liveUnavailable

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
            {liveSupported ? (
              <Select value={language} onValueChange={(v) => v && setLanguage(v as LanguagePreference)}>
                <SelectTrigger className="h-8 w-32" aria-label="Live transcript language">
                  <Languages className="size-3.5 text-muted-foreground" aria-hidden />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
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
              <span className="font-mono tabular-nums">
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
            {showLiveText ? (
              // Subtle, not a status announcement — the language is a nicety to
              // confirm what Auto settled on, not something worth interrupting a
              // screen reader for on every switch.
              <span className="text-xs text-muted-foreground">
                {language === 'auto'
                  ? `Auto · ${ACTIVE_LANGUAGE_LABEL[activeLang]}`
                  : ACTIVE_LANGUAGE_LABEL[activeLang]}
              </span>
            ) : null}
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

      {recording && liveSupported && liveUnavailable ? (
        <p className="text-xs text-muted-foreground">Live text stopped — recording continues normally.</p>
      ) : null}
      {recording && !liveSupported ? (
        <p className="text-xs text-muted-foreground">Live transcript needs Chrome — recording still works.</p>
      ) : null}

      {showLiveText ? (
        <div
          ref={transcriptPanelRef}
          onScroll={handleTranscriptScroll}
          className="max-h-48 overflow-y-auto rounded-lg border border-dashed bg-muted/30 p-3 text-sm"
          role="log"
          aria-label="Live transcript"
        >
          {finalText || interimText ? (
            <p className="whitespace-pre-wrap leading-relaxed">
              {finalText}
              {finalText && interimText ? ' ' : ''}
              {interimText ? <span className="text-muted-foreground italic">{interimText}</span> : null}
            </p>
          ) : (
            <p className="text-muted-foreground italic">Listening…</p>
          )}
        </div>
      ) : null}

      {/* Analysis failed (or hasn't been retried yet) — the recording itself
          was never discarded, so offer to try again on the exact same
          audio/transcript instead of forcing a re-record. Shown regardless
          of the panel's open/closed state so it's never silently missed. */}
      {pendingAudio && !recording && !analyzing ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 p-3"
          role="status"
        >
          <p className="flex items-start gap-1.5 text-sm">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              Analysis didn&rsquo;t finish, but your recording ({formatBytes(pendingAudio.blob.size)}) is
              still here — nothing was lost. Try again when you&rsquo;re ready.
            </span>
          </p>
          <span className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => runAnalysis(pendingAudio.blob, pendingAudio.liveTranscript)}
            >
              <Sparkles /> Retry analysis
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => setPendingAudio(null)}>
              Discard
            </Button>
          </span>
        </div>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
          {loading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Fetching notes…
            </span>
          ) : (
            <>
              <section className="flex flex-col gap-1.5">
                <h4 className="flex items-center gap-1.5 font-heading text-sm font-semibold">
                  <MessageCircleQuestion className="size-3.5 text-primary" aria-hidden />
                  Carried forward
                </h4>
                {openCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Anything you don&rsquo;t resolve stays open and carries forward to the next
                    meeting these people attend.
                  </p>
                ) : null}
                {prep.length > 0 ? (
                  <ul className="flex flex-col gap-2.5">
                    {prep.map((group) => (
                      <li key={group.userId} className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{group.person}</span>
                        <ul className="flex flex-col gap-1">
                          {group.items.map((item) => {
                            const canResolve = canRecord || group.userId === currentUserId
                            const isBusy = busyFollowupId === item.id && followupPending
                            const isResolved = item.status === 'resolved'
                            const isComposing = composingId === item.id
                            const keptOpen = !isResolved && keptOpenIds.has(item.id)
                            const noteFieldId = `followup-note-${item.id}`
                            return (
                              <li
                                key={item.id}
                                className={cn(
                                  'flex flex-col gap-1.5 rounded-md px-2 py-1.5',
                                  isResolved ? 'bg-muted/20' : 'bg-muted/40',
                                )}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <span className="flex min-w-0 flex-1 items-start gap-1.5 text-sm text-muted-foreground">
                                    {isResolved ? (
                                      <CircleCheck
                                        className="mt-0.5 size-3.5 shrink-0 text-primary"
                                        aria-hidden
                                      />
                                    ) : null}
                                    <span>
                                      <span className={isResolved ? undefined : 'text-foreground'}>
                                        {item.text}
                                      </span>{' '}
                                      — from “{item.fromTitle}” ({format(item.fromDate, 'MMM d')})
                                    </span>
                                  </span>
                                  {canResolve && !isComposing ? (
                                    <span className="flex shrink-0 items-center gap-1">
                                      {isResolved ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          type="button"
                                          disabled={isBusy}
                                          onClick={() => handleReopen(item)}
                                        >
                                          {isBusy ? (
                                            <Loader2 className="animate-spin" aria-hidden />
                                          ) : (
                                            <RotateCcw aria-hidden />
                                          )}
                                          Reopen
                                        </Button>
                                      ) : (
                                        <>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => setComposingId(item.id)}
                                          >
                                            {isBusy ? (
                                              <Loader2 className="animate-spin" aria-hidden />
                                            ) : (
                                              <Check aria-hidden />
                                            )}
                                            Resolve
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            type="button"
                                            disabled={isBusy}
                                            aria-pressed={keptOpen}
                                            onClick={() => handleNotYet(item.id)}
                                          >
                                            Not yet
                                          </Button>
                                        </>
                                      )}
                                    </span>
                                  ) : null}
                                </div>

                                {isResolved && item.resolutionNote ? (
                                  <p className="border-l-2 border-primary/40 pl-2 text-sm">
                                    <span className="text-muted-foreground">Outcome: </span>
                                    {item.resolutionNote}
                                  </p>
                                ) : null}

                                {keptOpen ? (
                                  <p className="text-xs text-muted-foreground">
                                    Staying open — it carries forward to the next meeting{' '}
                                    {group.person} attends.
                                  </p>
                                ) : null}

                                {isComposing ? (
                                  <form
                                    className="flex flex-col gap-1.5"
                                    onSubmit={(event) => {
                                      event.preventDefault()
                                      handleResolve(item.id)
                                    }}
                                  >
                                    <label
                                      htmlFor={noteFieldId}
                                      className="text-xs font-medium text-foreground"
                                    >
                                      What&rsquo;s the answer / what changed?
                                    </label>
                                    <Textarea
                                      id={noteFieldId}
                                      autoFocus
                                      rows={2}
                                      maxLength={500}
                                      className="min-h-14 text-sm"
                                      placeholder="Optional — e.g. room booked, lighting fixed on Tuesday"
                                      value={noteDrafts[item.id] ?? ''}
                                      onChange={(event) =>
                                        setNoteDrafts((prev) => ({
                                          ...prev,
                                          [item.id]: event.target.value,
                                        }))
                                      }
                                    />
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <Button size="sm" type="submit" disabled={isBusy}>
                                        {isBusy ? (
                                          <Loader2 className="animate-spin" aria-hidden />
                                        ) : (
                                          <Check aria-hidden />
                                        )}
                                        Save and resolve
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => handleNotYet(item.id)}
                                      >
                                        Not yet
                                      </Button>
                                      <span className="text-xs text-muted-foreground">
                                        The note is optional — resolving without one still closes
                                        it.
                                      </span>
                                    </div>
                                  </form>
                                ) : null}
                              </li>
                            )
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {openCount === 0 ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CircleCheck className="size-3.5 shrink-0" aria-hidden />
                    Nothing open is carried in for this meeting&rsquo;s attendees.
                  </p>
                ) : null}
              </section>

              {notes ? (
                <>
                  {notes.summary ? (
                    <section className="flex flex-col gap-1">
                      <h4 className="font-heading text-sm font-semibold">Summary</h4>
                      {/* Gemini returns Markdown (###, **bold**, ---); rendered
                          verbatim it showed the syntax as literal characters. */}
                      <MarkdownLite className="text-muted-foreground" content={notes.summary} />
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
              ) : prep.length === 0 ? (
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
