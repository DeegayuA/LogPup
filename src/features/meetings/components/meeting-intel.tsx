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
  analyzeMeetingAudio,
  copyFollowupResponseToNotes,
  deferFollowupReason,
  getMeetingIntel,
  noteFollowup,
  reopenFollowup,
  resolveFollowup,
  type CarriedForwardItem,
  type FollowupPersonOption,
  type FollowupTargetOption,
  type MeetingIntel,
} from '@/features/meetings/ai-actions'
import {
  pickUtterance,
  shouldFlush,
  UTTERANCE_PAIR_WINDOW_MS,
  type ActiveLanguage,
  type UtteranceCandidate,
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
// Recognizer engines dual mode runs, in the fixed order they are started
// and the order candidates are handed to pickUtterance — that order is
// also what its documented tie-break relies on being stable.
const DUAL_ENGINE_LANGUAGES: ActiveLanguage[] = ['en-US', 'si-LK']

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
  const [analyzing, startAnalyzing] = useTransition()
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
  // Set when dual mode couldn't start both engines (see startBilingualRecognition)
  // and fell back to a single engine — a quiet, one-line, non-blocking notice.
  // The meeting keeps recording regardless.
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null)
  const [liveUnavailable, setLiveUnavailable] = useState(false)
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  // See PendingAudio above — set the moment a recording finishes, cleared
  // only once analysis actually succeeds (or the user discards it).
  const [pendingAudio, setPendingAudio] = useState<PendingAudio | null>(null)
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
  const chunksRef = useRef<Blob[]>([])
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

  // Stops every currently-running engine (one in manual mode, up to two in
  // dual mode). Nulls the handlers before stop() so onend's auto-restart
  // never fires for a deliberate stop, same guarantee the single-recognizer
  // version had.
  function stopAllRecognition() {
    for (const lang of Object.keys(recognitionRefs.current) as ActiveLanguage[]) {
      const recognition = recognitionRefs.current[lang]
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
    }
    recognitionRefs.current = {}
  }

  function cleanupCapture() {
    recordingRef.current = false
    stopAllRecognition()
    clearFlushTimer()
    pendingUtteranceRef.current = null
    engineInterimRef.current = {}
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
    setFallbackNotice(null)
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

  // Recomputes which engine's INTERIM text is currently shown, and updates
  // the visible (provisional, muted/italic) interim string. Whichever
  // engine's partial result is currently longer is treated as "leading" —
  // in practice the engine actually matching what's being said tends to
  // keep extending its partial transcript, while the other one (hearing
  // the wrong grammar for what it's picking up) produces shorter or
  // choppier partials. A tie (including both empty) falls back to the last
  // ACCEPTED utterance's language for continuity, same inertia idea
  // pickUtterance uses, rather than flapping between the two on every
  // event. Works unmodified for manual (single-engine) mode too — the
  // other language's interim simply never has any text.
  function refreshInterimDisplay() {
    const en = engineInterimRef.current['en-US'] ?? ''
    const si = engineInterimRef.current['si-LK'] ?? ''
    if (!en && !si) {
      setInterimText('')
      setInterimLeaderLang(null)
      return
    }
    let leader: ActiveLanguage
    if (en.length === si.length) {
      leader = previousLangRef.current === 'si-LK' ? 'si-LK' : 'en-US'
    } else {
      leader = en.length > si.length ? 'en-US' : 'si-LK'
    }
    setInterimText(leader === 'en-US' ? en : si)
    setInterimLeaderLang(leader)
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
    pendingUtteranceRef.current = null
    if (pending) acceptUtterance(pending.candidate)
  }

  // Timer-driven check using the pure `shouldFlush` decision as the actual
  // authority on WHETHER to flush, rather than trusting the browser timer's
  // delay alone — setTimeout is a lower bound, not a guarantee (background
  // tabs get throttled), so this re-checks the real elapsed age against the
  // window and waits out whatever's left if it fired early.
  function checkPendingFlush() {
    const pending = pendingUtteranceRef.current
    if (!pending) return
    const age = Date.now() - pending.receivedAt
    if (shouldFlush(age)) {
      flushPendingUtterance()
    } else {
      flushTimerRef.current = setTimeout(checkPendingFlush, UTTERANCE_PAIR_WINDOW_MS - age)
    }
  }

  function scheduleFlush() {
    clearFlushTimer()
    flushTimerRef.current = setTimeout(checkPendingFlush, UTTERANCE_PAIR_WINDOW_MS)
  }

  // One engine finalized a result. In manual (single-engine) mode there is
  // only ever one source, so it's accepted immediately — same latency as
  // before this feature. In dual mode, it goes through the pairing buffer:
  // the first engine to finalize an utterance waits up to
  // UTTERANCE_PAIR_WINDOW_MS for the other to finalize its own read of
  // (roughly) the same stretch of speech, then pickUtterance decides
  // between them. If the SAME engine finalizes again before a pair
  // arrives, the buffered one clearly isn't getting a partner — flush it
  // now rather than silently dropping it, then start a fresh buffer.
  function handleEngineFinal(lang: ActiveLanguage, text: string, confidence: number | undefined) {
    engineInterimRef.current[lang] = ''
    refreshInterimDisplay()

    if (engineModeRef.current === 'single') {
      acceptUtterance({ lang, text, confidence })
      return
    }

    const candidate: UtteranceCandidate = { lang, text, confidence }
    const pending = pendingUtteranceRef.current
    if (!pending) {
      pendingUtteranceRef.current = { candidate, receivedAt: Date.now() }
      scheduleFlush()
      return
    }
    if (pending.candidate.lang === lang) {
      flushPendingUtterance()
      pendingUtteranceRef.current = { candidate, receivedAt: Date.now() }
      scheduleFlush()
      return
    }
    clearFlushTimer()
    pendingUtteranceRef.current = null
    const winner = pickUtterance({
      candidates: [pending.candidate, candidate],
      previousLang: previousLangRef.current,
    })
    if (winner) acceptUtterance(winner)
  }

  function handleEngineInterim(lang: ActiveLanguage, text: string) {
    engineInterimRef.current[lang] = text
    refreshInterimDisplay()
  }

  // An engine hit a permanent failure (denied mic permission, no capture
  // device). In dual mode this is the resource guard's other half — if one
  // engine is still running, keep going in single-engine mode rather than
  // losing live text entirely; only give up if NOTHING is left. Any
  // utterance still buffered has lost its only possible pairing partner —
  // flush it immediately instead of waiting out the window.
  function handleEngineUnavailable(lang: ActiveLanguage) {
    delete recognitionRefs.current[lang]
    engineInterimRef.current[lang] = ''
    refreshInterimDisplay()
    const remaining = Object.keys(recognitionRefs.current) as ActiveLanguage[]
    if (remaining.length === 0) {
      setLiveUnavailable(true)
      return
    }
    engineModeRef.current = 'single'
    flushPendingUtterance()
    setFallbackNotice(
      `Live text for ${ACTIVE_LANGUAGE_LABEL[lang]} stopped — continuing in ${ACTIVE_LANGUAGE_LABEL[remaining[0]]} only.`,
    )
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
    recognition.onerror = (event) => {
      // Permanent failures (denied mic permission for recognition, no
      // capture device) — stop retrying this engine. Transient errors
      // (no-speech, network, aborted) are left to onend's restart-on-drop
      // below.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        recognition.onend = null
        handleEngineUnavailable(lang)
      }
    }
    recognition.onend = () => {
      // Some browsers silently end recognition after a pause in speech.
      // Restart it for as long as we're still recording; stopAllRecognition()
      // nulls this handler before calling stop() so a deliberate stop never
      // loops back here.
      if (!recordingRef.current) return
      try {
        recognition.start()
      } catch {
        /* already starting — the next onend will retry */
      }
    }
    return recognition
  }

  // Creates and starts one engine, registering it in recognitionRefs on
  // success. Returns false without throwing if the browser refuses to
  // start it (some browsers only allow one active SpeechRecognition session
  // at a time) — the resource guard callers use to decide whether to fall
  // back to single-engine mode.
  function startEngine(lang: ActiveLanguage): boolean {
    const recognition = createRecognizer(lang)
    if (!recognition) return false
    try {
      recognition.start()
    } catch {
      return false
    }
    recognitionRefs.current[lang] = recognition
    return true
  }

  // Starts both engines for "Bilingual (auto)" mode. Resource guard: some
  // browsers refuse to run a second concurrent SpeechRecognition instance.
  // If only one of the two starts, fall back to single-engine mode
  // automatically (with a quiet notice) rather than losing live text —
  // the meeting keeps recording regardless either way. If neither starts,
  // that's the same as an unsupported browser.
  function startBilingualRecognition() {
    engineModeRef.current = 'dual'
    const started = DUAL_ENGINE_LANGUAGES.filter((lang) => startEngine(lang))
    if (started.length === 0) {
      setLiveUnavailable(true)
      return
    }
    if (started.length < DUAL_ENGINE_LANGUAGES.length) {
      engineModeRef.current = 'single'
      setFallbackNotice(
        `Only one language engine could start — using ${ACTIVE_LANGUAGE_LABEL[started[0]]} only for this recording.`,
      )
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
        setInterimLeaderLang(null)
        setLastWinnerLang(null)
        setFallbackNotice(null)
        setLiveUnavailable(false)
        engineInterimRef.current = {}
        pendingUtteranceRef.current = null
        clearFlushTimer()
        // Seed the conversation-inertia fallback from whichever language
        // last won an utterance (persisted across sessions) rather than
        // starting with nothing to lean on for the very first ambiguous
        // utterance of this recording.
        previousLangRef.current = lastActiveLangRef.current

        if (language === 'bilingual') {
          startBilingualRecognition()
        } else {
          // Manual override — exactly one engine, in the chosen language.
          engineModeRef.current = 'single'
          if (!startEngine(language)) setLiveUnavailable(true)
        }
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
              // Subtle, not a status announcement — which engine is currently
              // winning is a nicety to confirm bilingual mode is doing
              // something sensible, not worth interrupting a screen reader
              // for on every utterance.
              <span className="text-xs text-muted-foreground">
                {language === 'bilingual'
                  ? `Bilingual${currentLeadLang ? ` · ${ACTIVE_LANGUAGE_LABEL[currentLeadLang]}` : ''}`
                  : ACTIVE_LANGUAGE_LABEL[language]}
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
      {recording && liveSupported && !liveUnavailable && fallbackNotice ? (
        <p className="text-xs text-muted-foreground">{fallbackNotice}</p>
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
