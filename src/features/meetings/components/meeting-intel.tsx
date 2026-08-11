'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  AlertCircle,
  Check,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  Languages,
  Loader2,
  MessageCircleQuestion,
  MessageSquareQuote,
  Mic,
  MonitorSpeaker,
  NotebookPen,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/lib/action-result'
import type { MentionUser } from '@/components/mention-textarea'
import { NoteTimeline } from '@/features/meetings/components/note-timeline'
import {
  addFollowup,
  copyFollowupResponseToNotes,
  deferFollowupReason,
  finalizeMeetingRecording,
  getMeetingIntel,
  noteFollowup,
  reopenFollowup,
  resolveFollowup,
  transcribeSegment,
  type CarriedForwardItem,
  type FollowupPersonOption,
  type FollowupTargetOption,
  type MeetingIntel,
} from '@/features/meetings/ai-actions'
import {
  containsSinhala,
  isRestartStorm,
  isSilentSinhalaFallback,
  pickInterimLeader,
  pickUtterance,
  shouldFlush,
  DUAL_PROBE_WINDOW_MS,
  RESTART_RETRY_LIMIT,
  RESTART_RETRY_MS,
  UTTERANCE_PAIR_WINDOW_MS,
  type ActiveLanguage,
  type UtteranceCandidate,
} from '@/features/meetings/language-switch'
import { shouldCutSegment } from '@/features/meetings/recording-segments'
import { SpeakerAssignmentPanel } from '@/features/meetings/components/speaker-assignment'

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
  // `audiostart` is the only trustworthy proof that an engine actually owns
  // the microphone: `start()` resolving means nothing (it never throws for a
  // session that is about to be aborted by another one) and `onstart` fires
  // before the browser has arbitrated who gets the mic. Measured on Chrome
  // 151: ~500–740ms between start() and audiostart.
  onaudiostart: (() => void) | null
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

// The user-facing preference: "Bilingual" (the default) runs BOTH
// recognizers at once and picks the better result per utterance — see
// pickUtterance in language-switch.ts. The other two pin it down to a
// single engine, for meetings that really are one language throughout.
// `ActiveLanguage` (imported above) is the narrower set a single
// SpeechRecognition instance actually runs — "bilingual" is never sent to
// one directly, it means "start both".
type LanguagePreference = 'bilingual' | ActiveLanguage
const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'bilingual', label: 'Bilingual (auto)' },
  { value: 'en-US', label: 'English' },
  { value: 'si-LK', label: 'Sinhala' },
]
const LANGUAGE_STORAGE_KEY = 'logpup:transcribe-language'
// Reads a stored language preference, migrating the old single-recognizer
// feature's 'auto' value to today's 'bilingual' — same meaning ("don't pin
// me to one language"), new name now that it runs two engines instead of
// switching one.
function parseLanguagePreference(value: string | null): LanguagePreference | null {
  if (value === 'auto') return 'bilingual'
  if (value === 'bilingual' || value === 'en-US' || value === 'si-LK') return value
  return null
}
// Which language last "won" an utterance, so the next recording seeds its
// conversation-inertia tie-break (see pickUtterance) from somewhere sane
// instead of an arbitrary default on the very first ambiguous utterance.
const LAST_ACTIVE_LANGUAGE_STORAGE_KEY = 'logpup:transcribe-last-active-language'
const ACTIVE_LANGUAGE_LABEL: Record<ActiveLanguage, string> = {
  'en-US': 'English',
  'si-LK': 'Sinhala',
}
function otherLanguage(lang: ActiveLanguage): ActiveLanguage {
  return lang === 'en-US' ? 'si-LK' : 'en-US'
}
// Whether this browser has already been PROVEN unable to run two
// SpeechRecognition sessions at once. Persisted because the proof costs a
// engine restart and the answer never changes for a given browser — see
// the probe in startLiveRecognition, and the measured event traces in
// docs/superpowers/specs/2026-08-11-live-transcription-design.md.
const DUAL_UNSUPPORTED_STORAGE_KEY = 'logpup:transcribe-dual-unsupported'
// Said once, plainly, whenever live text is one language while the user
// asked for bilingual. The recording is unaffected — Gemini transcribes the
// audio itself and handles both languages — so this is a note, not an error.
function singleEngineNotice(lang: ActiveLanguage): string {
  return `This browser runs one speech engine at a time — live text is ${ACTIVE_LANGUAGE_LABEL[lang]} only. The recording still captures both languages for the AI notes.`
}
const SINHALA_UNAVAILABLE_NOTICE =
  'Sinhala live text isn’t available in this browser — the recording still captures it for the AI notes.'
const SINHALA_NOT_LISTENING_NOTICE =
  'This browser accepted Sinhala but isn’t writing any — live text may be wrong. The recording still captures it for the AI notes.'

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

// One ~5-minute slice of the recording (see SEGMENT_TARGET_MS in
// recording-segments.ts), tracked from the moment it's cut until it's
// successfully transcribed. `blob` is what makes this the safety net a
// single PendingAudio blob used to be for the WHOLE meeting: if a segment's
// upload/transcription fails, its (couple-MB) audio stays right here with a
// retry affordance — "nothing recorded is lost" now applies per segment
// instead of to a two-hour blob that would otherwise vanish the instant a
// transient Gemini failure happened at minute 119.
type SegmentStatus = 'uploading' | 'done' | 'failed'
type RecordingSegment = { index: number; status: SegmentStatus; blob: Blob; error?: string }

// The three separate things that can be written about one follow-up. They
// are never the same sentence: 'outcome' is what came of it (resolved
// items), 'said' is what the person told us, 'why' is why it isn't done.
// Only one composer is open per row at a time — writing is a small aside,
// not a form to fill in.
type ComposerField = 'outcome' | 'said' | 'why'
type OpenComposer = { id: string; field: ComposerField } | null

const COMPOSER_COPY: Record<
  ComposerField,
  { label: (person: string) => string; placeholder: string; hint: string; save: string }
> = {
  outcome: {
    label: () => 'What’s the answer / what changed?',
    placeholder: 'e.g. room booked, lighting fixed on Tuesday',
    hint: 'Optional — the item is already resolved either way.',
    save: 'Save outcome',
  },
  said: {
    label: (person) => `What did ${person} say?`,
    placeholder: 'e.g. still waiting on the client to confirm the date',
    hint: 'It stays open and still carries forward.',
    save: 'Save what they said',
  },
  why: {
    label: () => 'Why isn’t this done yet?',
    placeholder: 'e.g. blocked on the client’s approval',
    hint: 'Optional — the item stays open either way.',
    save: 'Save reason',
  },
}

// "Their next meeting" — the default, and the behaviour every AI-derived
// follow-up has: no pin, so it surfaces wherever that person turns up next.
const NEXT_MEETING = 'next'

function draftKey(field: ComposerField, followupId: string): string {
  return `${field}:${followupId}`
}

function storedValue(item: CarriedForwardItem, field: ComposerField): string {
  if (field === 'outcome') return item.resolutionNote ?? ''
  if (field === 'said') return item.responseNote ?? ''
  return item.deferReason ?? ''
}

export function MeetingIntelPanel({
  meetingId,
  meetingTitle,
  canRecord,
  currentUserId,
  attendees = [],
  appId = null,
  mentionUsers,
}: {
  meetingId: string
  meetingTitle: string
  canRecord: boolean
  currentUserId: string
  /** For speaker assignment and task-suggestion assignee pickers. */
  attendees?: { id: string; name: string }[]
  /** The meeting's app — task suggestions need one to file into. */
  appId?: string | null
  /** Wider mention pool for the note composer; falls back to attendees. */
  mentionUsers?: MentionUser[]
}) {
  // Notes are shown by default — no need to click a button to reveal them.
  const [open, setOpen] = useState(true)
  const [intel, setIntel] = useState<MeetingIntel | null>(null)
  const [loading, setLoading] = useState(false)
  // The final, text-only synthesis pass over every transcribed segment — see
  // finalizeMeetingRecording. Runs automatically once recording stops (once
  // every in-flight segment upload has settled), and stays available to
  // re-run by hand (e.g. after retrying a segment that failed the first
  // time) without touching the recorder again.
  const [finalizing, startFinalizing] = useTransition()
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [language, setLanguageState] = useState<LanguagePreference>('bilingual')
  // Which language most recently WON an utterance (dual mode) or the fixed
  // language in use (manual mode) — surfaced subtly in the UI so which
  // engine is currently leading is visible, not silent.
  const [lastWinnerLang, setLastWinnerLang] = useState<ActiveLanguage | null>(null)
  // Which engine's INTERIM (provisional) text is currently leading, updated
  // on every partial result — see refreshInterimDisplay. Separate from
  // lastWinnerLang because the leader can flip word-by-word while a final
  // hasn't landed yet.
  const [interimLeaderLang, setInterimLeaderLang] = useState<ActiveLanguage | null>(null)
  // Everything the user is owed an honest word about: dual mode not being
  // possible here, a language this browser can't hear, an engine that
  // stopped. Quiet one-line notices, never toasts — the meeting keeps
  // recording regardless, so none of these are worth interrupting for.
  const [notices, setNotices] = useState<string[]>([])
  const [liveUnavailable, setLiveUnavailable] = useState(false)
  // Which engines are alive right now, mirrored from recognitionRefs so the
  // status chip can name what is ACTUALLY running. Two entries is the only
  // thing that may ever be called "Bilingual".
  const [activeEngines, setActiveEngines] = useState<ActiveLanguage[]>([])
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  // See RecordingSegment above. One entry per cut segment, from the moment
  // it's cut until finalize has consumed it; mirrors segmentsRef so a retry
  // (which needs the actual Blob back) never reads stale render state.
  // (Replaces the single whole-meeting PendingAudio blob described above.)
  const [segments, setSegments] = useState<RecordingSegment[]>([])
  // A finalized utterance that is buffered waiting for the other engine's
  // read of the same speech. It is rendered IMMEDIATELY, styled like interim
  // text: the pairing window is allowed to replace these words, never to
  // withhold them. Before this existed the phrase was in neither finalText
  // nor interimText and simply vanished from screen for up to 1.2s.
  const [provisional, setProvisional] = useState<{ text: string; lang: ActiveLanguage } | null>(null)
  // Follow-up state. Every action (resolve, not yet, reopen) is one click and
  // writes immediately; `composer` is the single open text field, since the
  // writing is always optional enrichment layered on afterwards. `drafts` is
  // keyed by field+id so a half-typed reason survives closing the composer,
  // `keptOpenIds` are rows the user explicitly said "not yet" on so the
  // carry-forward promise can be stated back to them, and `busyFollowupId`
  // marks the row whose write is in flight.
  const [followupPending, startFollowupWrite] = useTransition()
  const [busyFollowupId, setBusyFollowupId] = useState<string | null>(null)
  const [composer, setComposer] = useState<OpenComposer>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [keptOpenIds, setKeptOpenIds] = useState<Set<string>>(new Set())
  // The "add a follow-up by hand" form. Collapsed until asked for — the
  // section's job is still mostly to show what came back from last time.
  const [addingFollowup, setAddingFollowup] = useState(false)
  const [addPending, startAddFollowup] = useTransition()

  const router = useRouter()

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamsRef = useRef<MediaStream[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  // Chunks for the CURRENT segment only — not the whole meeting. Cutting a
  // segment (see cutSegment) hands these off to an upload and resets this to
  // [], which is what releases a finished segment's memory instead of
  // accumulating ~115MB in here across a 2-hour meeting the way a single
  // whole-meeting Blob used to.
  const chunksRef = useRef<Blob[]>([])
  // The very first ondataavailable Blob of the whole recording — contains
  // the WebM/Opus container header (EBML + Segment + Tracks). MediaRecorder
  // is never stopped/restarted mid-recording (that would cost a real audio
  // gap at every cut), so every chunk after the first is a bare
  // Cluster/SimpleBlock with no header of its own. Segment 0's Blob already
  // starts with this chunk; every later segment is built as [header,
  // ...thatSegment'sChunks] so it's still an independently decodable WebM
  // file on its own — the same header-reuse trick ffmpeg and most WebM
  // muxers rely on for chunked/fragmented output. The very first ~few ms of
  // audio in segments after the first can have a small Opus lookahead
  // transient at the join (Opus is a lapped/overlap codec) — inaudible for
  // speech transcription purposes, and the only cost paid for a zero-gap,
  // zero-stop/restart segmentation scheme.
  const headerChunkRef = useRef<Blob | null>(null)
  // Byte total and start time of the segment currently accumulating in
  // chunksRef — shouldCutSegment (recording-segments.ts) is checked against
  // both on every ondataavailable event.
  const segmentBytesRef = useRef(0)
  const segmentStartRef = useRef(0)
  // Next segment index to assign — 0-based, matches meetingRecordingSegments.index.
  const segmentIndexRef = useRef(0)
  // Base mimeType (codec suffix stripped, e.g. "audio/webm") used to build
  // every segment's Blob — captured once at recording start.
  const mimeBaseRef = useRef('')
  // Every in-flight segment upload's promise, so Stop can wait for all of
  // them to settle (success or failure) before running the final synthesis
  // pass — see runFinalize.
  const segmentUploadPromisesRef = useRef<Promise<void>[]>([])
  // Mirrors `segments` state; see that state's comment for why a ref is the
  // source of truth here (retrySegment needs the live Blob, not whatever the
  // render closure captured).
  const segmentsRef = useRef<RecordingSegment[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // One recognizer per language, keyed by ActiveLanguage. Dual (bilingual)
  // mode populates both keys; manual mode populates exactly one. A missing
  // key means that engine either was never started or has permanently
  // failed (see handleEngineUnavailable) — never a live instance.
  const recognitionRefs = useRef<Partial<Record<ActiveLanguage, SpeechRecognitionLike>>>({})
  // Whether we're currently supervising one engine or two. Starts as
  // whatever the language preference implies and can drop from 'dual' to
  // 'single' mid-recording if the second engine fails (resource guard, see
  // startBilingualRecognition / handleEngineUnavailable) — never the other
  // direction.
  const engineModeRef = useRef<'dual' | 'single'>('single')
  const recordingRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const transcriptPanelRef = useRef<HTMLDivElement | null>(null)
  const nearBottomRef = useRef(true)
  // Mirrors `language` state for use inside the recognition event handlers
  // below — those close over refs, not state, since a handler set on
  // `recognition.onresult` at start time would otherwise see whatever
  // `language` was at that moment forever, not its later value after a
  // re-render.
  const languagePreferenceRef = useRef<LanguagePreference>('bilingual')
  // The language of the last ACCEPTED utterance (from either engine) — the
  // `previousLang` pickUtterance uses for its conversation-inertia
  // fallback. Seeded from LAST_ACTIVE_LANGUAGE_STORAGE_KEY at the start of
  // each recording rather than reset to null, so the very first ambiguous
  // utterance of a new recording still has something to lean on.
  const previousLangRef = useRef<ActiveLanguage | null>(null)
  // Each engine's current (uncommitted) interim text, keyed by language —
  // used to decide which engine's partial result is "leading" right now
  // (see refreshInterimDisplay). Cleared for a language the moment that
  // engine finalizes a result.
  const engineInterimRef = useRef<Partial<Record<ActiveLanguage, string>>>({})
  // At most one finalized-but-unpaired utterance, waiting to see if the
  // OTHER engine finalizes its own result for roughly the same stretch of
  // speech (see pickUtterance / UTTERANCE_PAIR_WINDOW_MS). Only used in
  // dual mode — manual (single-engine) mode accepts every final
  // immediately, since there is nothing to pair it against.
  const pendingUtteranceRef = useRef<{ candidate: UtteranceCandidate; receivedAt: number } | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirrors interimLeaderLang for the handlers (state isn't readable
  // synchronously here) — pickInterimLeader takes it as the incumbent that
  // keeps the display until a challenger is clearly ahead.
  const interimLeaderRef = useRef<ActiveLanguage | null>(null)
  // Per-engine liveness bookkeeping. `reachedAudio` is the only proof an
  // engine owns the mic; the counters below turn "restarted again and never
  // got there" into the storm signal isRestartStorm decides on.
  const reachedAudioRef = useRef<Partial<Record<ActiveLanguage, boolean>>>({})
  const restartsWithoutAudioRef = useRef<Partial<Record<ActiveLanguage, number>>>({})
  const restartRetriesRef = useRef<Partial<Record<ActiveLanguage, number>>>({})
  const restartTimersRef = useRef<Partial<Record<ActiveLanguage, ReturnType<typeof setTimeout>>>>({})
  // The concurrency probe (see startLiveRecognition). While it is set,
  // NEITHER engine auto-restarts — that is what makes probing safe, since
  // the measured 30,000-restarts-in-7s storm requires both engines to
  // blindly restart into each other.
  const dualProbeRef = useRef<{
    incumbent: ActiveLanguage
    challenger: ActiveLanguage
    timer: ReturnType<typeof setTimeout> | null
  } | null>(null)
  // Proven-once-per-browser answer to "can two sessions coexist?", hydrated
  // from localStorage so only the first recording ever pays for the proof.
  const dualUnsupportedRef = useRef(false)
  // Evidence for isSilentSinhalaFallback: a browser that accepted si-LK and
  // then never writes a Sinhala codepoint is not transcribing Sinhala.
  const sinhalaEvidenceRef = useRef({ finalsSeen: 0, finalsWithSinhala: 0, settled: false })
  // Persisted across sessions (LAST_ACTIVE_LANGUAGE_STORAGE_KEY) — seeds
  // previousLangRef at the start of each new recording, and manual mode's
  // initial engine when the preference itself doesn't say which language.
  const lastActiveLangRef = useRef<ActiveLanguage>('en-US')

  const liveSupported =
    typeof window !== 'undefined' && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)

  useEffect(() => {
    try {
      const saved = parseLanguagePreference(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
      if (saved) {
        languagePreferenceRef.current = saved
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from localStorage on mount
        setLanguageState(saved)
      }
      const lastActive = window.localStorage.getItem(LAST_ACTIVE_LANGUAGE_STORAGE_KEY)
      if (lastActive === 'en-US' || lastActive === 'si-LK') {
        lastActiveLangRef.current = lastActive
      }
      if (window.localStorage.getItem(DUAL_UNSUPPORTED_STORAGE_KEY) === 'true') {
        dualUnsupportedRef.current = true
      }
    } catch {
      /* private mode / unavailable — defaults stay Bilingual / English */
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

  // Remembers which language just won an utterance — both the ref
  // pickUtterance's conversation-inertia fallback reads, and the UI state
  // the "currently winning" badge shows — and persists it as next
  // recording's starting point.
  function rememberWinner(next: ActiveLanguage) {
    previousLangRef.current = next
    setLastWinnerLang(next)
    if (lastActiveLangRef.current !== next) {
      lastActiveLangRef.current = next
      try {
        window.localStorage.setItem(LAST_ACTIVE_LANGUAGE_STORAGE_KEY, next)
      } catch {
        /* private mode / unavailable — next session just starts from English */
      }
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

  function clearFlushTimer() {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }

  function clearRestartTimer(lang: ActiveLanguage) {
    const timer = restartTimersRef.current[lang]
    if (timer) clearTimeout(timer)
    delete restartTimersRef.current[lang]
  }

  function clearDualProbe() {
    if (dualProbeRef.current?.timer) clearTimeout(dualProbeRef.current.timer)
    dualProbeRef.current = null
  }

  // Keeps the rendered engine list honest: it is read from the live
  // recognizers, never from what we intended to start. The status chip is
  // only allowed to say "Bilingual" when this has two entries.
  function syncActiveEngines() {
    const live = Object.keys(recognitionRefs.current) as ActiveLanguage[]
    engineModeRef.current = live.length > 1 ? 'dual' : 'single'
    setActiveEngines(live)
  }

  function addNotice(text: string) {
    setNotices((prev) => (prev.includes(text) ? prev : [...prev, text]))
  }

  // Detaches one engine for good: handlers nulled first so onend's restart
  // can never fire for a deliberate stop.
  function teardownEngine(lang: ActiveLanguage) {
    clearRestartTimer(lang)
    const recognition = recognitionRefs.current[lang]
    delete recognitionRefs.current[lang]
    engineInterimRef.current[lang] = ''
    if (!recognition) return
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    recognition.onaudiostart = null
    try {
      recognition.stop()
    } catch {
      /* already stopped */
    }
  }

  // Stops every currently-running engine (one in manual mode, up to two in
  // dual mode). Same deliberate-stop guarantee the single-recognizer
  // version had.
  function stopAllRecognition() {
    for (const lang of Object.keys(recognitionRefs.current) as ActiveLanguage[]) teardownEngine(lang)
    recognitionRefs.current = {}
  }

  function cleanupCapture() {
    recordingRef.current = false
    stopAllRecognition()
    clearFlushTimer()
    clearDualProbe()
    pendingUtteranceRef.current = null
    setProvisional(null)
    engineInterimRef.current = {}
    reachedAudioRef.current = {}
    restartsWithoutAudioRef.current = {}
    restartRetriesRef.current = {}
    interimLeaderRef.current = null
    setActiveEngines([])
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
    setInterimLeaderLang(null)
    setNotices([])
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
  }, [finalText, interimText, provisional])

  function handleTranscriptScroll() {
    const el = transcriptPanelRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  // Recomputes which engine's INTERIM text is shown. The leader is decided
  // by pickInterimLeader, which compares ESTIMATED SPOKEN UNITS rather than
  // string length: Sinhala packs a syllable into ~1.9 UTF-16 units against
  // English's ~3.0, so the old length comparison handed the display to
  // English by construction, even mid-Sinhala-sentence.
  //
  // While a provisional (buffered final) is on screen, only that engine's
  // interim is shown: the other engine's partial right then is a competing
  // read of the SAME audio, and rendering both prints the phrase twice in
  // two scripts. The provisional engine's own new partial is genuinely the
  // next thing being said, so it still shows.
  function refreshInterimDisplay() {
    const en = engineInterimRef.current['en-US'] ?? ''
    const si = engineInterimRef.current['si-LK'] ?? ''
    const pendingLang = pendingUtteranceRef.current?.candidate.lang ?? null
    const leader = pendingLang
      ? pendingLang
      : pickInterimLeader({
          en,
          si,
          previousLang: previousLangRef.current,
          currentLeader: interimLeaderRef.current,
        })
    if (!leader) {
      interimLeaderRef.current = null
      setInterimText('')
      setInterimLeaderLang(null)
      return
    }
    const text = leader === 'en-US' ? en : si
    interimLeaderRef.current = text ? leader : interimLeaderRef.current
    setInterimText(text)
    setInterimLeaderLang(leader)
  }

  // Buffers the finalized-but-unpaired utterance. Ref and state move
  // together on purpose: the ref is what the handlers read synchronously
  // (and carries the timestamp shouldFlush needs), the state is what puts
  // the words on screen the instant they exist. The timestamp deliberately
  // stays out of state — rendered state must not be derived from a clock.
  function bufferUtterance(candidate: UtteranceCandidate) {
    pendingUtteranceRef.current = { candidate, receivedAt: Date.now() }
    setProvisional({ text: candidate.text, lang: candidate.lang })
  }

  function clearPendingUtterance() {
    pendingUtteranceRef.current = null
    setProvisional(null)
  }

  // Commits one utterance to the live transcript and remembers its
  // language for the next pickUtterance call and the "currently winning"
  // badge. The single place both single- and dual-engine paths funnel
  // through, so the transcript is built identically either way.
  function acceptUtterance(candidate: UtteranceCandidate) {
    rememberWinner(candidate.lang)
    const trimmed = candidate.text.trim()
    if (!trimmed) return
    finalTranscriptRef.current = finalTranscriptRef.current
      ? `${finalTranscriptRef.current} ${trimmed}`
      : trimmed
    setFinalText(finalTranscriptRef.current)
  }

  function flushPendingUtterance() {
    clearFlushTimer()
    const pending = pendingUtteranceRef.current
    clearPendingUtterance()
    if (pending) acceptUtterance(pending.candidate)
    refreshInterimDisplay()
  }

  // Schedules the pairing-window timeout. The pure `shouldFlush` decision —
  // not just "the timer fired" — is the actual authority on whether to
  // flush now: setTimeout's delay is a lower bound, not a guarantee
  // (background-tab throttling can fire it late, never early), so this
  // re-checks the real elapsed age before flushing. Guards against a stale
  // timer flushing something it shouldn't (e.g. a new buffer started after
  // clearFlushTimer() raced with an in-flight callback).
  function scheduleFlush() {
    clearFlushTimer()
    flushTimerRef.current = setTimeout(() => {
      const pending = pendingUtteranceRef.current
      if (pending && shouldFlush(Date.now() - pending.receivedAt)) flushPendingUtterance()
    }, UTTERANCE_PAIR_WINDOW_MS)
  }

  // One engine finalized a result. In single-engine mode there is only ever
  // one source, so it's accepted immediately. In dual mode it goes through
  // the pairing buffer: the first engine to finalize waits up to
  // UTTERANCE_PAIR_WINDOW_MS for the other's read of (roughly) the same
  // speech, then pickUtterance decides between them. If the SAME engine
  // finalizes again before a pair arrives, the buffered one clearly isn't
  // getting a partner — flush it now rather than silently dropping it, then
  // start a fresh buffer.
  //
  // The buffer is VISIBLE the whole time (see bufferUtterance). Waiting
  // for a pair may change which words end up committed; it must never be
  // the reason there are no words on screen.
  function handleEngineFinal(lang: ActiveLanguage, text: string, confidence: number | undefined) {
    engineInterimRef.current[lang] = ''
    if (lang === 'si-LK' && noteSinhalaEvidence(text)) {
      // The engine that produced this was just dropped for not actually
      // being a Sinhala recognizer — its text is exactly what we don't want
      // in the transcript.
      refreshInterimDisplay()
      return
    }

    if (engineModeRef.current === 'single') {
      acceptUtterance({ lang, text, confidence })
      refreshInterimDisplay()
      return
    }

    const candidate: UtteranceCandidate = { lang, text, confidence }
    const pending = pendingUtteranceRef.current
    if (!pending) {
      bufferUtterance(candidate)
      scheduleFlush()
      refreshInterimDisplay()
      return
    }
    if (pending.candidate.lang === lang) {
      flushPendingUtterance()
      bufferUtterance(candidate)
      scheduleFlush()
      refreshInterimDisplay()
      return
    }
    clearFlushTimer()
    clearPendingUtterance()
    const winner = pickUtterance({
      candidates: [pending.candidate, candidate],
      previousLang: previousLangRef.current,
    })
    if (winner) acceptUtterance(winner)
    refreshInterimDisplay()
  }

  // Some browsers accept `lang = 'si-LK'` and then quietly transcribe the
  // system language instead — confident, fluent, and completely wrong.
  // That's worse than an error because nothing looks broken, so it gets
  // caught on the evidence: a Sinhala recognizer writes Sinhala script.
  /** Returns true if the si-LK engine was dropped as a result — meaning the
   *  final that triggered this must not be committed. */
  function noteSinhalaEvidence(text: string): boolean {
    const evidence = sinhalaEvidenceRef.current
    if (evidence.settled) return false
    evidence.finalsSeen += 1
    if (containsSinhala(text)) evidence.finalsWithSinhala += 1
    if (!isSilentSinhalaFallback(evidence)) return false
    evidence.settled = true // decided once; don't keep re-litigating it
    if (Object.keys(recognitionRefs.current).length > 1) {
      // There is a real engine left — drop the one that's making things up.
      handleEngineUnavailable('si-LK', SINHALA_UNAVAILABLE_NOTICE)
      return true
    }
    // The user pinned Sinhala and it's all we have. Say so; don't stop it,
    // because a hedged live preview is still better than none while the
    // recording (which Gemini transcribes properly) keeps running.
    addNotice(SINHALA_NOT_LISTENING_NOTICE)
    return false
  }

  function handleEngineInterim(lang: ActiveLanguage, text: string) {
    engineInterimRef.current[lang] = text
    refreshInterimDisplay()
  }

  // An engine hit a permanent failure (denied mic permission, no capture
  // device, a language this browser can't hear). If one engine is still
  // running, keep going in single-engine mode rather than losing live text
  // entirely; only give up if NOTHING is left. Any utterance still buffered
  // has lost its only possible pairing partner — flush it immediately
  // instead of waiting out a window that can no longer produce a pair.
  function handleEngineUnavailable(lang: ActiveLanguage, reason?: string) {
    clearDualProbe()
    teardownEngine(lang)
    syncActiveEngines()
    // Whatever was buffered is real speech that has now lost its only
    // possible pairing partner — commit it before anything else, including
    // in the give-up path, so it still reaches the transcript.
    flushPendingUtterance()
    const remaining = Object.keys(recognitionRefs.current) as ActiveLanguage[]
    if (remaining.length === 0) {
      setLiveUnavailable(true)
      return
    }
    addNotice(
      reason ??
        `Live text for ${ACTIVE_LANGUAGE_LABEL[lang]} stopped — continuing in ${ACTIVE_LANGUAGE_LABEL[remaining[0]]} only.`,
    )
  }

  // Records, once and for this browser, that two SpeechRecognition sessions
  // cannot coexist here, and collapses to a single honestly-labelled engine.
  //
  // This is the measured reality on every browser the team uses (Chrome,
  // Edge and Android Chrome are Chromium; Safari arbitrates one recognizer
  // too): starting the second session aborts the first, `start()` doesn't
  // throw, and the old auto-restart turned that into ~30,000 restarts in 7
  // seconds with zero results. Collapsing here is what stops both the storm
  // and the quieter bug it caused — sitting in 'dual' mode with one engine,
  // where every utterance waited out the full pairing window for a partner
  // that could never arrive.
  function concludeDualUnsupported(keep: ActiveLanguage) {
    clearDualProbe()
    dualUnsupportedRef.current = true
    try {
      window.localStorage.setItem(DUAL_UNSUPPORTED_STORAGE_KEY, 'true')
    } catch {
      /* private mode — we'll just re-prove it next time */
    }
    for (const lang of Object.keys(recognitionRefs.current) as ActiveLanguage[]) {
      if (lang !== keep) teardownEngine(lang)
    }
    syncActiveEngines()
    // Fresh start for the survivor: the restarts it racked up while the two
    // engines were killing each other must not count against it now that it
    // is alone, or the storm guard would immediately declare it dead too.
    restartsWithoutAudioRef.current[keep] = 0
    restartRetriesRef.current[keep] = 0
    // The kept engine may itself be the one that was aborted; restarting an
    // already-running session is harmless (it throws InvalidStateError,
    // which the retry path treats as "already going").
    if (recognitionRefs.current[keep]) restartEngine(keep)
    else if (!startEngine(keep)) setLiveUnavailable(true)
    flushPendingUtterance()
    addNotice(singleEngineNotice(keep))
  }

  // Restarts one engine after the browser ended its session. The old code
  // swallowed a throw here with "the next onend will retry" — which is
  // unsound: a start() that throws leaves NO session, so no further onend
  // ever fires and the engine is dead forever, silently. Retry on a timer
  // instead, and give up out loud.
  function restartEngine(lang: ActiveLanguage) {
    if (!recordingRef.current) return
    const recognition = recognitionRefs.current[lang]
    if (!recognition) return
    clearRestartTimer(lang)
    reachedAudioRef.current[lang] = false
    const restarts = (restartsWithoutAudioRef.current[lang] ?? 0) + 1
    restartsWithoutAudioRef.current[lang] = restarts
    if (isRestartStorm({ restartsWithoutAudio: restarts })) {
      handleRestartStorm(lang)
      return
    }
    try {
      recognition.start()
      restartRetriesRef.current[lang] = 0
    } catch {
      const retries = (restartRetriesRef.current[lang] ?? 0) + 1
      restartRetriesRef.current[lang] = retries
      if (retries > RESTART_RETRY_LIMIT) {
        handleEngineUnavailable(lang)
        return
      }
      restartTimersRef.current[lang] = setTimeout(() => {
        delete restartTimersRef.current[lang]
        restartEngine(lang)
      }, RESTART_RETRY_MS)
    }
  }

  // An engine keeps restarting and never reaches audio — the signature of
  // two sessions aborting each other. Belt to the probe's braces: whatever
  // the probe concluded, this collapses to one engine rather than letting a
  // spin loop burn the CPU and produce nothing.
  function handleRestartStorm(lang: ActiveLanguage) {
    const live = Object.keys(recognitionRefs.current) as ActiveLanguage[]
    if (live.length > 1) {
      concludeDualUnsupported(otherLanguage(lang))
      return
    }
    handleEngineUnavailable(lang)
  }

  // The engine owns the microphone — the only trustworthy proof it is
  // actually running. Two things hang off it: the storm counter resets, and
  // (first time only) the concurrency probe starts the second engine, since
  // there is no point testing coexistence before the first one exists.
  function handleEngineAudioStart(lang: ActiveLanguage) {
    reachedAudioRef.current[lang] = true
    restartsWithoutAudioRef.current[lang] = 0
    restartRetriesRef.current[lang] = 0
    if (!recordingRef.current) return
    if (dualProbeRef.current) return
    if (dualUnsupportedRef.current) return
    if (languagePreferenceRef.current !== 'bilingual') return
    if (Object.keys(recognitionRefs.current).length !== 1) return
    startDualProbe(lang)
  }

  // Starts the second engine and watches whether it kills the first.
  // Crucially, while `dualProbeRef` is set NEITHER engine auto-restarts —
  // that is what makes probing safe, because the storm needs both engines
  // restarting into each other.
  function startDualProbe(incumbent: ActiveLanguage) {
    const challenger = otherLanguage(incumbent)
    dualProbeRef.current = { incumbent, challenger, timer: null }
    if (!startEngine(challenger)) {
      // Couldn't even construct/start it — nothing was disturbed, so just
      // carry on with the one engine that works.
      clearDualProbe()
      addNotice(singleEngineNotice(incumbent))
      return
    }
    dualProbeRef.current.timer = setTimeout(() => {
      // Survived the window with both alive: this browser really can run two.
      clearDualProbe()
      syncActiveEngines()
    }, DUAL_PROBE_WINDOW_MS)
  }

  // Creates one recognizer for `lang` with the continuous + interimResults
  // + auto-restart lifecycle every engine needs, wired to the shared
  // handlers above. Framework for exactly one engine — dual mode calls this
  // twice, manual mode once. Returns null only when the browser has no
  // SpeechRecognition constructor at all.
  function createRecognizer(lang: ActiveLanguage): SpeechRecognitionLike | null {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) return null
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
          if (trimmed) handleEngineFinal(lang, trimmed, alternative?.confidence)
        } else {
          interim += transcript
        }
      }
      handleEngineInterim(lang, interim)
    }
    recognition.onaudiostart = () => handleEngineAudioStart(lang)
    recognition.onerror = (event) => {
      // Permanent failures — stop retrying this engine. `language-not-supported`
      // belongs here and previously did not: it fell through to onend, which
      // restarted a doomed engine forever. It is also the honest signal for
      // "this browser has no Sinhala", which the user is told in as many words.
      if (event.error === 'language-not-supported') {
        recognition.onend = null
        handleEngineUnavailable(
          lang,
          lang === 'si-LK'
            ? SINHALA_UNAVAILABLE_NOTICE
            : `Live text for ${ACTIVE_LANGUAGE_LABEL[lang]} isn’t available in this browser.`,
        )
        return
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        recognition.onend = null
        handleEngineUnavailable(lang)
      }
      // Everything else (no-speech, network, aborted) is transient and left
      // to onend below — note that a session aborted by another engine
      // starting sometimes reports 'aborted' here and sometimes reports
      // nothing at all, which is why the probe keys on `end`, not on this.
    }
    recognition.onend = () => {
      // Some browsers silently end recognition after a pause in speech.
      // Restart it for as long as we're still recording; teardownEngine()
      // nulls this handler before calling stop() so a deliberate stop never
      // loops back here.
      if (!recordingRef.current) return
      const probe = dualProbeRef.current
      if (probe) {
        // An end DURING the probe means the two sessions can't coexist:
        // whichever one died, the other one killed it. Do not restart —
        // restarting is precisely what turns this into the storm.
        concludeDualUnsupported(probe.incumbent)
        return
      }
      restartEngine(lang)
    }
    return recognition
  }

  // Creates and starts one engine, registering it in recognitionRefs on
  // success. Returns false only when the browser has no SpeechRecognition
  // constructor or the constructor itself refuses.
  //
  // NOTE what this can NOT detect: `start()` does not throw when a second
  // concurrent session is about to be aborted by the browser. The old code
  // treated a non-throwing start as proof the engine was running, which is
  // how it ended up believing it had two. Proof lives in `audiostart`.
  function startEngine(lang: ActiveLanguage): boolean {
    const recognition = createRecognizer(lang)
    if (!recognition) return false
    reachedAudioRef.current[lang] = false
    restartsWithoutAudioRef.current[lang] = 0
    restartRetriesRef.current[lang] = 0
    try {
      recognition.start()
    } catch {
      return false
    }
    recognitionRefs.current[lang] = recognition
    syncActiveEngines()
    return true
  }

  // Starts live recognition for this recording.
  //
  // Dual mode is never assumed any more — it is proved, once per browser,
  // and remembered. One engine starts; when it reports `audiostart` (so we
  // know it holds the mic) the probe starts the second and watches whether
  // the first survives. Everywhere we ship, it does not — so in practice
  // this runs exactly one engine and says which one, out loud.
  //
  // The engine we start FIRST is the one that last won an utterance, so
  // when the probe fails the surviving engine is the useful one rather than
  // an arbitrary default.
  function startLiveRecognition(preference: LanguagePreference) {
    if (preference !== 'bilingual') {
      if (!startEngine(preference)) setLiveUnavailable(true)
      return
    }
    const first = lastActiveLangRef.current
    if (!startEngine(first)) {
      // Fall back to the other engine before giving up on live text.
      if (!startEngine(otherLanguage(first))) setLiveUnavailable(true)
      return
    }
    if (dualUnsupportedRef.current) addNotice(singleEngineNotice(first))
    // Otherwise the probe fires from handleEngineAudioStart.
  }

  // Publishes segmentsRef (the source of truth) to render state. Every
  // mutation below goes through upsertSegment so a retry can always read the
  // live Blob back out of segmentsRef instead of a stale render closure.
  function publishSegments() {
    setSegments([...segmentsRef.current])
  }
  function upsertSegment(patch: RecordingSegment) {
    const index = segmentsRef.current.findIndex((s) => s.index === patch.index)
    segmentsRef.current =
      index === -1
        ? [...segmentsRef.current, patch].sort((a, b) => a.index - b.index)
        : segmentsRef.current.map((s, i) => (i === index ? patch : s))
    publishSegments()
  }

  // Uploads and transcribes ONE segment in the background — never awaited by
  // the recorder itself, so recording keeps running while this happens (see
  // cutSegment). Tracked in segmentUploadPromisesRef so Stop can wait for
  // every in-flight upload to settle before running the final synthesis
  // pass. A failure here leaves the segment's Blob sitting in `segments`
  // with a retry affordance (the failed-segments list further down in the
  // render) — the whole meeting is never aborted over one bad segment.
  async function uploadSegment(index: number, blob: Blob) {
    upsertSegment({ index, status: 'uploading', blob })
    try {
      const formData = new FormData()
      formData.append('audio', new File([blob], `segment-${index}`, { type: blob.type }))
      const hint = finalTranscriptRef.current
      if (hint.trim()) formData.append('liveTranscriptHint', hint)
      const res = await transcribeSegment(meetingId, index, formData)
      upsertSegment(
        res.ok
          ? { index, status: 'done', blob }
          : { index, status: 'failed', blob, error: res.error },
      )
    } catch {
      upsertSegment({ index, status: 'failed', blob, error: 'Upload failed — try again' })
    }
  }

  // Cuts whatever's accumulated in chunksRef into its own segment: builds an
  // independently-decodable Blob (header-prepended for every segment after
  // the first — see headerChunkRef's comment), releases the chunk array for
  // GC, and kicks off that segment's upload/transcription in the
  // background. Called both mid-recording (from ondataavailable, once
  // shouldCutSegment says so) and once more at Stop to flush the tail — a
  // no-op if nothing has accumulated since the last cut.
  function cutSegment() {
    if (chunksRef.current.length === 0) return
    const index = segmentIndexRef.current
    segmentIndexRef.current += 1
    const parts = index === 0 || !headerChunkRef.current
      ? chunksRef.current
      : [headerChunkRef.current, ...chunksRef.current]
    const blob = new Blob(parts, { type: mimeBaseRef.current })
    chunksRef.current = []
    segmentBytesRef.current = 0
    segmentStartRef.current = Date.now()
    segmentUploadPromisesRef.current.push(uploadSegment(index, blob))
  }

  function retrySegment(index: number) {
    const segment = segmentsRef.current.find((s) => s.index === index)
    if (!segment || segment.status === 'uploading') return
    segmentUploadPromisesRef.current.push(uploadSegment(index, segment.blob))
  }

  // Runs once recording stops (and again if the user retries): waits for
  // every segment upload/transcription currently in flight to settle, then
  // runs the one text-only final synthesis pass over whatever's been
  // transcribed so far. Proceeds even if a segment is still 'failed' —
  // finalizeMeetingRecording reports the gap rather than blocking on it
  // (concatenateSegments) — so a person can see minutes with a noted gap
  // instead of nothing at all, retry the failed segment, and run this again
  // to fill it in.
  function runFinalize() {
    setFinalizeError(null)
    startFinalizing(async () => {
      try {
        await Promise.allSettled(segmentUploadPromisesRef.current)
        const res = await finalizeMeetingRecording(meetingId, finalTranscriptRef.current)
        if (!res.ok) {
          setFinalizeError(res.error)
          toast.error(res.error)
          return
        }
        // Drop only the segments finalize actually consumed. A 'failed'
        // segment survives this — finalize proceeds even with a gap
        // (concatenateSegments reports it rather than blocking), so its
        // audio has to stay retryable, or that stretch of the meeting is
        // gone for good the moment this succeeds.
        segmentsRef.current = segmentsRef.current.filter((s) => s.status !== 'done')
        publishSegments()
        toast.success(
          segmentsRef.current.length > 0
            ? 'Meeting analyzed — one or more segments still need a retry (see below)'
            : 'Meeting analyzed — notes are ready',
        )
        await loadIntel()
      } catch {
        setFinalizeError('Something went wrong — try again')
        toast.error('Something went wrong — your segments are saved, try again')
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
      // Mono (channelCount: 1) — speech transcription gets nothing from a
      // second channel, and halves what the encoder has to push through
      // before audioBitsPerSecond even applies below.
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
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
      headerChunkRef.current = null
      segmentBytesRef.current = 0
      segmentStartRef.current = Date.now()
      segmentIndexRef.current = 0
      segmentUploadPromisesRef.current = []
      mimeBaseRef.current = mimeType.split(';')[0]
      // A fresh recording starting is the one deliberate point where it's
      // safe to drop whatever unfinalized segments came before — the user
      // is choosing to record again rather than retry the old ones.
      segmentsRef.current = []
      setSegments([])
      setFinalizeError(null)

      // 32 kbps mono Opus: ~4 KB/s -> ~14.4 MB/hour, vs Chrome's ~128 kbps
      // default (~58 MB/hour). Opus at 32 kbps is well within its
      // "comfortably intelligible speech" range (its voice-optimized mode
      // stays usable down to ~6-16 kbps) — this is a file-size choice, not a
      // quality tradeoff for a meeting recording. Combined with mono capture
      // above and 5-minute segmenting below (recording-segments.ts), this is
      // what makes an hours-long meeting a series of ~1.2MB uploads instead
      // of one ever-growing in-memory Blob.
      const recorder = new MediaRecorder(captureStream, { mimeType, audioBitsPerSecond: 32_000 })
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return
        if (!headerChunkRef.current) headerChunkRef.current = event.data
        chunksRef.current.push(event.data)
        segmentBytesRef.current += event.data.size
        if (shouldCutSegment(Date.now() - segmentStartRef.current, segmentBytesRef.current)) {
          cutSegment()
        }
      }
      recorder.onstop = () => {
        // Flush whatever's accumulated since the last cut as its own
        // (possibly short) final segment — the recorder is never
        // stopped/restarted mid-meeting, only here at the very end, so this
        // is the one and only place a segment can be shorter than the
        // ~5-minute target.
        cutSegment()
        const capturedSegments = segmentIndexRef.current
        // Commit whatever is still sitting in the pairing buffer BEFORE
        // cleanupCapture() runs — it nulls pendingUtteranceRef, and the
        // transcript runFinalize hands to Gemini is finalTranscriptRef,
        // which only gains a buffered utterance once it is accepted. Without
        // this the last utterance of every dual-mode recording — the one
        // still waiting for a partner when Stop was pressed — was dropped.
        flushPendingUtterance()
        cleanupCapture()
        if (capturedSegments === 0) {
          toast.error('Nothing was recorded')
          return
        }
        runFinalize()
      }
      recorder.start(1000)
      setRecording(true)
      recordingRef.current = true
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)

      if (liveSupported) {
        finalTranscriptRef.current = ''
        setFinalText('')
        setInterimText('')
        setInterimLeaderLang(null)
        setLastWinnerLang(null)
        setNotices([])
        setLiveUnavailable(false)
        engineInterimRef.current = {}
        interimLeaderRef.current = null
        sinhalaEvidenceRef.current = { finalsSeen: 0, finalsWithSinhala: 0, settled: false }
        clearPendingUtterance()
        clearFlushTimer()
        clearDualProbe()
        // Seed the conversation-inertia fallback from whichever language
        // last won an utterance (persisted across sessions) rather than
        // starting with nothing to lean on for the very first ambiguous
        // utterance of this recording.
        previousLangRef.current = lastActiveLangRef.current
        engineModeRef.current = 'single'
        startLiveRecognition(language)
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

  // One click closes it. No note, no second step, no dialog — the outcome
  // can be written afterwards (or never) via the composer on the settled row.
  function handleResolve(followupId: string) {
    setComposer((prev) => (prev?.id === followupId ? null : prev))
    setKeptOpenIds((prev) => {
      if (!prev.has(followupId)) return prev
      const next = new Set(prev)
      next.delete(followupId)
      return next
    })
    patchFollowup(followupId, { status: 'resolved', resolvedAt: new Date() })
    runFollowupWrite(
      followupId,
      () => resolveFollowup(followupId, undefined, meetingId),
      'Resolved — add the outcome if it needs one',
    )
  }

  function handleReopen(item: CarriedForwardItem) {
    // Keep the note that was there as a draft — reopening usually means the
    // answer was wrong or incomplete, not that it should be retyped.
    if (item.resolutionNote) {
      setDrafts((prev) => ({ ...prev, [draftKey('outcome', item.id)]: item.resolutionNote ?? '' }))
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
  // loud, and offer (never force) the "why" alongside it.
  function handleNotYet(followupId: string) {
    setComposer((prev) => (prev?.id === followupId ? null : prev))
    setKeptOpenIds((prev) => new Set(prev).add(followupId))
  }

  // Opens one text field on one row, seeded from whatever is already stored
  // there the first time — editing, not retyping.
  function openComposer(item: CarriedForwardItem, field: ComposerField) {
    const key = draftKey(field, item.id)
    setDrafts((prev) => (key in prev ? prev : { ...prev, [key]: storedValue(item, field) }))
    setComposer({ id: item.id, field })
  }

  function handleSaveNote(item: CarriedForwardItem, field: ComposerField) {
    const value = (drafts[draftKey(field, item.id)] ?? '').trim()
    setComposer(null)
    if (field === 'outcome') {
      patchFollowup(item.id, { resolutionNote: value || null })
      runFollowupWrite(
        item.id,
        () => resolveFollowup(item.id, value, meetingId),
        value ? 'Outcome saved' : 'Outcome cleared',
      )
      return
    }
    if (field === 'said') {
      patchFollowup(item.id, { responseNote: value || null })
      runFollowupWrite(
        item.id,
        () => noteFollowup(item.id, value),
        value ? 'Saved — still open and carrying forward' : 'Cleared',
      )
      return
    }
    patchFollowup(item.id, { deferReason: value || null })
    runFollowupWrite(
      item.id,
      () => deferFollowupReason(item.id, value),
      value ? 'Reason saved — still open' : 'Cleared',
    )
  }

  // Explicit, never automatic: what someone said only becomes part of the
  // meeting record when a person asks for it. router.refresh() is what makes
  // the meeting's own notes above this panel show the new line.
  function handleCopyResponse(item: CarriedForwardItem) {
    runFollowupWrite(
      item.id,
      async () => {
        const res = await copyFollowupResponseToNotes(item.id, meetingId)
        if (res.ok) router.refresh()
        return res
      },
      'Added to this meeting’s notes',
    )
  }

  function handleAddFollowup(input: {
    personUserId: string
    text: string
    kind: 'question' | 'action'
    targetMeetingId: string | null
  }) {
    startAddFollowup(async () => {
      try {
        const res = await addFollowup({ meetingId, ...input })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setAddingFollowup(false)
        toast.success('Follow-up added — it comes up at that meeting, not this one')
        // The new item deliberately doesn't belong to THIS meeting, so
        // there's nothing to show here; refetch anyway so anything else that
        // changed server-side (or a pin onto a meeting shown elsewhere) is
        // reflected without a full reload.
        await loadIntel({ silent: true })
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  const doneSegmentCount = segments.filter((s) => s.status === 'done').length
  const failedSegments = segments.filter((s) => s.status === 'failed')
  const uploadingSegmentCount = segments.filter((s) => s.status === 'uploading').length

  const notes = intel?.notes ?? null
  const prep = intel?.prep ?? []
  const people = intel?.people ?? []
  const upcomingMeetings = intel?.upcomingMeetings ?? []
  // Resolved rows stay on screen as a record, so "is anything still owed?"
  // has to count open ones rather than trust the list being empty.
  const openCount = prep.reduce(
    (total, group) => total + group.items.filter((item) => item.status === 'open').length,
    0,
  )
  const showLiveText = recording && liveSupported && !liveUnavailable
  // Whichever engine is "currently winning": an in-flight interim result
  // takes priority (it's the freshest signal of which language is being
  // heard right now), falling back to whichever language last won an
  // accepted utterance once things go quiet between sentences.
  const currentLeadLang = interimLeaderLang ?? lastWinnerLang
  // What the status chip is allowed to claim. "Bilingual" requires two
  // engines to actually be alive — the preference asking for it is not
  // evidence that the browser delivered it.
  const liveEngineLabel =
    activeEngines.length > 1
      ? `Bilingual${currentLeadLang ? ` · ${ACTIVE_LANGUAGE_LABEL[currentLeadLang]}` : ''}`
      : activeEngines.length === 1
        ? ACTIVE_LANGUAGE_LABEL[activeEngines[0]]
        : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={toggleOpen} aria-expanded={open}>
          <Sparkles />
          Notes
          <ChevronDown
            className={cn('transition-transform duration-150', open && 'rotate-180')}
            aria-hidden
          />
        </Button>
        {open && canRecord && !recording && !finalizing ? (
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
            {/* Segment progress — "12 min captured · 2 segments transcribed".
                Mono/tabular-nums on the numbers since they update every
                second and shouldn't visually jitter as digits change. */}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{Math.floor(seconds / 60)}</span> min captured
              {segments.length > 0 ? (
                <>
                  {' · '}
                  <span className="font-mono tabular-nums">{doneSegmentCount}</span> segment
                  {doneSegmentCount === 1 ? '' : 's'} transcribed
                  {uploadingSegmentCount > 0 ? (
                    <>
                      {' · '}
                      <span className="font-mono tabular-nums">{uploadingSegmentCount}</span> in progress
                    </>
                  ) : null}
                  {failedSegments.length > 0 ? (
                    <span className="text-destructive">
                      {' · '}
                      <span className="font-mono tabular-nums">{failedSegments.length}</span> failed
                    </span>
                  ) : null}
                </>
              ) : null}
            </span>
            {showLiveText && liveEngineLabel ? (
              // Subtle, not a status announcement — which engine is currently
              // winning is a nicety, not worth interrupting a screen reader
              // for on every utterance. It names the engines actually
              // running, never the preference that asked for them.
              <span className="text-xs text-muted-foreground">{liveEngineLabel}</span>
            ) : null}
          </>
        ) : null}
        {finalizing ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Writing up the minutes…
          </span>
        ) : null}
      </div>

      {open && canRecord && !recording && !finalizing ? (
        <p className="text-xs text-muted-foreground">
          Audio is processed by Google Gemini using your API key. Make sure attendees consent to
          recording.
        </p>
      ) : null}

      {/* A specific reason always beats the generic one: "Sinhala live text
          isn't available in this browser" is the thing a Safari user needs
          to read, not "live text stopped". The generic line only covers the
          case where nothing more specific is known. */}
      {recording && liveSupported && liveUnavailable && notices.length === 0 ? (
        <p className="text-xs text-muted-foreground">Live text stopped — recording continues normally.</p>
      ) : null}
      {recording && liveSupported
        ? notices.map((notice) => (
            <p key={notice} className="text-xs text-muted-foreground">
              {notice}
            </p>
          ))
        : null}
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
          {/* Three tiers, one paragraph: committed text, then the buffered
              utterance still waiting on the other engine, then the partial
              being spoken right now. The last two are both provisional and
              share the muted/italic treatment — a reader can tell what is
              settled from what may still change, and nothing that was heard
              is ever missing from the screen while it's decided. */}
          {finalText || provisional || interimText ? (
            <p className="whitespace-pre-wrap leading-relaxed">
              {finalText}
              {finalText && (provisional || interimText) ? ' ' : ''}
              {provisional ? (
                <span className="text-muted-foreground italic">{provisional.text}</span>
              ) : null}
              {provisional && interimText ? ' ' : ''}
              {interimText ? <span className="text-muted-foreground italic">{interimText}</span> : null}
            </p>
          ) : (
            <p className="text-muted-foreground italic">Listening…</p>
          )}
        </div>
      ) : null}

      {/* Post-recording safety net, adapted for segments: what has to
          survive a failure is no longer a whole recording (one Blob for a
          2-hour meeting) but just the not-yet-transcribed TAIL — each
          failed segment's couple-MB Blob, kept right here with its own
          retry. Shown regardless of the panel's open/closed state so it's
          never silently missed. Empties out once finalize has consumed
          every successfully-transcribed segment (see runFinalize). */}
      {!recording && (segments.length > 0 || finalizeError) ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 p-3"
          role="status"
        >
          {finalizeError ? (
            <p className="flex items-start gap-1.5 text-sm">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <span>
                {finalizeError} Your transcribed segments are saved — nothing was lost. Try again when
                you&rsquo;re ready.
              </span>
            </p>
          ) : null}

          {failedSegments.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {failedSegments.map((segment) => (
                <li
                  key={segment.index}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-start gap-1.5">
                    <AlertCircle
                      className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                      aria-hidden
                    />
                    <span>
                      Segment {segment.index + 1} didn&rsquo;t transcribe
                      {segment.error ? ` — ${segment.error}` : ''}. Its audio (
                      {formatBytes(segment.blob.size)}) is still here.
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={finalizing}
                    onClick={() => retrySegment(segment.index)}
                  >
                    <RotateCcw aria-hidden /> Retry segment
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {!finalizing ? (
            <span className="flex shrink-0 items-center gap-1.5">
              <Button variant="outline" size="sm" type="button" onClick={runFinalize}>
                <Sparkles aria-hidden /> {finalizeError ? 'Retry analysis' : 'Analyze again'}
              </Button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Writing up the minutes…
            </span>
          )}
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
              <NoteTimeline
                meetingId={meetingId}
                meetingTitle={meetingTitle}
                canManage={canRecord}
                attendees={attendees}
                appId={appId}
                mentionUsers={mentionUsers}
              />

              <section className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="flex items-center gap-1.5 font-heading text-sm font-semibold">
                    <MessageCircleQuestion className="size-3.5 text-primary" aria-hidden />
                    Carried forward
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    aria-expanded={addingFollowup}
                    onClick={() => setAddingFollowup((value) => !value)}
                  >
                    <Plus aria-hidden />
                    Add follow-up
                  </Button>
                </div>
                {openCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Anything you don&rsquo;t resolve stays open and carries forward to the next
                    meeting these people attend.
                  </p>
                ) : null}
                {addingFollowup ? (
                  <AddFollowupForm
                    idPrefix={`add-followup-${meetingId}`}
                    people={people}
                    upcomingMeetings={upcomingMeetings}
                    pending={addPending}
                    onCancel={() => setAddingFollowup(false)}
                    onSubmit={handleAddFollowup}
                  />
                ) : null}
                {prep.length > 0 ? (
                  <ul className="flex flex-col gap-2.5">
                    {prep.map((group) => (
                      <li key={group.userId} className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{group.person}</span>
                        <ul className="flex flex-col gap-1">
                          {group.items.map((item) => {
                            const openField =
                              composer?.id === item.id ? composer.field : null
                            return (
                              <FollowupRow
                                key={item.id}
                                item={item}
                                person={group.person}
                                canWrite={canRecord || group.userId === currentUserId}
                                canEditNotes={canRecord}
                                busy={busyFollowupId === item.id && followupPending}
                                keptOpen={keptOpenIds.has(item.id)}
                                openField={openField}
                                draft={
                                  openField ? (drafts[draftKey(openField, item.id)] ?? '') : ''
                                }
                                onDraftChange={(value) =>
                                  openField
                                    ? setDrafts((prev) => ({
                                        ...prev,
                                        [draftKey(openField, item.id)]: value,
                                      }))
                                    : undefined
                                }
                                onOpenComposer={(field) => openComposer(item, field)}
                                onCloseComposer={() => setComposer(null)}
                                onSaveNote={(field) => handleSaveNote(item, field)}
                                onResolve={() => handleResolve(item.id)}
                                onReopen={() => handleReopen(item)}
                                onNotYet={() => handleNotYet(item.id)}
                                onCopyResponse={() => handleCopyResponse(item)}
                              />
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
                  {/* The summary itself now auto-lands in the unified note
                      timeline above as an 'ai' segment (see
                      insertAutoNotesAndSuggestions) — no separate block here. */}

                  {/* Maps the model's raw speaker labels ("Speaker 1") onto
                      real people. Self-fetching, and renders nothing when the
                      meeting has no labels to assign, so it costs nothing on
                      meetings that were never recorded. */}
                  <SpeakerAssignmentPanel meetingId={meetingId} canManage={canRecord} />

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

/**
 * One carried-forward item. Every control here acts on a single click —
 * Resolve closes it, Not yet keeps it, Reopen undoes a resolve — and the
 * three text fields (why / what they said / outcome) are optional writing
 * layered on afterwards, each shown back in its own distinct line so an
 * outcome is never mistaken for an excuse or a quote.
 */
function FollowupRow({
  item,
  person,
  canWrite,
  canEditNotes,
  busy,
  keptOpen,
  openField,
  draft,
  onDraftChange,
  onOpenComposer,
  onCloseComposer,
  onSaveNote,
  onResolve,
  onReopen,
  onNotYet,
  onCopyResponse,
}: {
  item: CarriedForwardItem
  person: string
  canWrite: boolean
  canEditNotes: boolean
  busy: boolean
  keptOpen: boolean
  openField: ComposerField | null
  draft: string
  onDraftChange: (value: string) => void
  onOpenComposer: (field: ComposerField) => void
  onCloseComposer: () => void
  onSaveNote: (field: ComposerField) => void
  onResolve: () => void
  onReopen: () => void
  onNotYet: () => void
  onCopyResponse: () => void
}) {
  const isResolved = item.status === 'resolved'
  const stillOpenAndKept = keptOpen && !isResolved
  const fieldId = openField ? `followup-${openField}-${item.id}` : undefined
  const composerCopy = openField ? COMPOSER_COPY[openField] : null

  return (
    <li
      className={cn(
        'flex flex-col gap-1.5 rounded-md px-2 py-1.5',
        isResolved ? 'bg-muted/20' : 'bg-muted/40',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex min-w-0 flex-1 items-start gap-1.5 text-sm text-muted-foreground">
          {isResolved ? (
            <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          ) : null}
          <span>
            <span className={isResolved ? undefined : 'text-foreground'}>{item.text}</span> — from
            “{item.fromTitle}” ({format(item.fromDate, 'MMM d')})
            {/* Provenance worth knowing: a hand-added item is someone's
                deliberate ask, not something the model heard. */}
            {item.createdBy ? ' · added by hand' : null}
          </span>
        </span>
        {canWrite ? (
          <span className="flex shrink-0 flex-wrap items-center gap-1">
            {isResolved ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={busy}
                  onClick={onReopen}
                >
                  {busy ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <RotateCcw aria-hidden />
                  )}
                  Reopen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={busy}
                  aria-expanded={openField === 'outcome'}
                  onClick={() => onOpenComposer('outcome')}
                >
                  <Pencil aria-hidden />
                  {item.resolutionNote ? 'Edit outcome' : 'Add outcome'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={busy}
                  onClick={onResolve}
                >
                  {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                  Resolve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={busy}
                  aria-pressed={keptOpen}
                  onClick={onNotYet}
                >
                  Not yet
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={busy}
                  aria-expanded={openField === 'why'}
                  onClick={() => onOpenComposer('why')}
                >
                  <CircleHelp aria-hidden />
                  {item.deferReason ? 'Edit why' : 'Why'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={busy}
                  aria-expanded={openField === 'said'}
                  onClick={() => onOpenComposer('said')}
                >
                  <MessageSquareQuote aria-hidden />
                  {item.responseNote ? 'Edit what they said' : 'What they said'}
                </Button>
              </>
            )}
          </span>
        ) : null}
      </div>

      {/* What the person said — quoted, and still owed. Kept visually
          separate from an outcome (solid primary rule, below) because it is
          an update, not a conclusion. */}
      {item.responseNote ? (
        <div className="flex flex-wrap items-start justify-between gap-2 border-l-2 border-border pl-2">
          <p className="min-w-0 flex-1 text-sm">
            <span className="text-muted-foreground">
              <MessageSquareQuote className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
              {person} said:{' '}
            </span>
            {item.responseNote}
          </p>
          {canEditNotes ? (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={busy}
              onClick={onCopyResponse}
            >
              {busy ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <NotebookPen aria-hidden />
              )}
              Add to meeting notes
            </Button>
          ) : null}
        </div>
      ) : null}

      {!isResolved && item.deferReason ? (
        <p className="border-l-2 border-dashed border-border pl-2 text-sm">
          <span className="text-muted-foreground">Why not yet: </span>
          {item.deferReason}
        </p>
      ) : null}

      {isResolved && item.resolutionNote ? (
        <p className="border-l-2 border-primary/40 pl-2 text-sm">
          <span className="text-muted-foreground">Outcome: </span>
          {item.resolutionNote}
        </p>
      ) : null}

      {stillOpenAndKept ? (
        <p className="text-xs text-muted-foreground">
          Staying open — it carries forward to the next meeting {person} attends.
        </p>
      ) : null}

      {openField && composerCopy ? (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            onSaveNote(openField)
          }}
        >
          <label htmlFor={fieldId} className="text-xs font-medium text-foreground">
            {composerCopy.label(person)}
          </label>
          <Textarea
            id={fieldId}
            autoFocus
            rows={2}
            maxLength={500}
            className="min-h-14 text-sm"
            placeholder={composerCopy.placeholder}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              {composerCopy.save}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={busy}
              onClick={onCloseComposer}
            >
              Cancel
            </Button>
            <span className="text-xs text-muted-foreground">{composerCopy.hint}</span>
          </div>
        </form>
      ) : null}
    </li>
  )
}

/**
 * Adds a follow-up by hand, for when the model didn't hear it (or nobody
 * recorded the meeting at all). The item deliberately does not appear on
 * THIS meeting — it is a thing to raise later — so the form says where it
 * will actually turn up before you commit to it.
 */
function AddFollowupForm({
  idPrefix,
  people,
  upcomingMeetings,
  pending,
  onCancel,
  onSubmit,
}: {
  /** Meeting-scoped so two open panels never share a label's `for` target. */
  idPrefix: string
  people: FollowupPersonOption[]
  upcomingMeetings: FollowupTargetOption[]
  pending: boolean
  onCancel: () => void
  onSubmit: (input: {
    personUserId: string
    text: string
    kind: 'question' | 'action'
    targetMeetingId: string | null
  }) => void
}) {
  // One attendee means there is nothing to decide — preselect them.
  const [personUserId, setPersonUserId] = useState(people.length === 1 ? people[0].id : '')
  const [text, setText] = useState('')
  const [kind, setKind] = useState<'question' | 'action'>('question')
  const [target, setTarget] = useState<string>(NEXT_MEETING)

  const person = people.find((option) => option.id === personUserId) ?? null
  // Only meetings the chosen person is actually attending can be pinned to —
  // anywhere else, the item would be filed where it can never surface.
  const targetOptions = personUserId
    ? upcomingMeetings.filter((meeting) => meeting.attendeeIds.includes(personUserId))
    : []
  // Derived rather than synced in an effect: changing the person can
  // invalidate an already-picked meeting, and silently falling back to
  // "their next meeting" is the honest default.
  const effectiveTarget = targetOptions.some((meeting) => meeting.id === target)
    ? target
    : NEXT_MEETING
  const pinned = targetOptions.find((meeting) => meeting.id === effectiveTarget) ?? null

  if (people.length === 0) {
    return (
      <p className="flex items-start gap-1.5 rounded-md border border-dashed p-2.5 text-sm text-muted-foreground">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>Add attendees to this meeting first — a follow-up has to belong to someone.</span>
      </p>
    )
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-dashed p-2.5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!personUserId || !text.trim()) return
        onSubmit({
          personUserId,
          text: text.trim(),
          kind,
          targetMeetingId: effectiveTarget === NEXT_MEETING ? null : effectiveTarget,
        })
        setText('')
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-person`} className="text-xs font-medium text-foreground">
            Who it&rsquo;s for
          </label>
          <Select
            value={personUserId}
            onValueChange={(value) => setPersonUserId((value as string | null) ?? '')}
          >
            <SelectTrigger id={`${idPrefix}-person`} className="w-44">
              <SelectValue>
                {(value: string) =>
                  people.find((option) => option.id === value)?.name ?? 'Pick a person'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {people.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
        <span className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-kind`} className="text-xs font-medium text-foreground">
            Type
          </label>
          <Select
            value={kind}
            onValueChange={(value) => setKind(value === 'action' ? 'action' : 'question')}
          >
            <SelectTrigger id={`${idPrefix}-kind`} className="w-32">
              <SelectValue>
                {(value: string) => (value === 'action' ? 'Action' : 'Question')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="question">Question</SelectItem>
              <SelectItem value="action">Action</SelectItem>
            </SelectContent>
          </Select>
        </span>
        <span className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-target`} className="text-xs font-medium text-foreground">
            Comes up at
          </label>
          <Select
            value={effectiveTarget}
            onValueChange={(value) => setTarget((value as string | null) ?? NEXT_MEETING)}
          >
            <SelectTrigger id={`${idPrefix}-target`} className="w-56">
              <SelectValue>
                {(value: string) => {
                  if (value === NEXT_MEETING) return 'Their next meeting'
                  const meeting = targetOptions.find((option) => option.id === value)
                  return meeting
                    ? `${meeting.title} · ${format(meeting.startsAt, 'MMM d')}`
                    : 'Their next meeting'
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEXT_MEETING}>Their next meeting</SelectItem>
              {targetOptions.map((meeting) => (
                <SelectItem key={meeting.id} value={meeting.id}>
                  {meeting.title} · {format(meeting.startsAt, 'MMM d')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      </div>

      <span className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-text`} className="text-xs font-medium text-foreground">
          What should they answer or do?
        </label>
        <Textarea
          id={`${idPrefix}-text`}
          rows={2}
          maxLength={300}
          className="min-h-14 text-sm"
          placeholder="e.g. Send the revised quote to the client"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" type="submit" disabled={pending || !personUserId || !text.trim()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          Add follow-up
        </Button>
        <Button variant="ghost" size="sm" type="button" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">
          {!person
            ? 'Pick who it’s for first.'
            : pinned
              ? `It won’t show here — it comes up on “${pinned.title}” (${format(pinned.startsAt, 'MMM d')}), and stays open until someone resolves it.`
              : `It won’t show here — ${person.name} sees it at the next meeting they attend, and it stays open until someone resolves it.`}
        </span>
      </div>
    </form>
  )
}
