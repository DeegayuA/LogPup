'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  AlertCircle,
  AudioLines,
  Check,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  Clock,
  Languages,
  ListTodo,
  Loader2,
  MessageSquareQuote,
  Mic,
  MonitorSpeaker,
  NotebookPen,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  MicOff,
  Square,
  Trash2,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/lib/action-result'
import type { MentionUser } from '@/components/mention-textarea'
import { NoteTimeline } from '@/features/meetings/components/note-timeline'
import { MeetingAssistant } from '@/features/meetings/components/meeting-assistant'
import {
  bilingualText,
  MetaChip,
  SkeletonBlock,
} from '@/features/meetings/components/meeting-chips'
import { MeetingAiNotes, MeetingNotesEmpty } from '@/features/meetings/components/meeting-notes'
import { MeetingPrepSection } from '@/features/meetings/components/meeting-prep'
import {
  followupAge,
  glanceFromIntel,
  type MeetingGlance,
} from '@/features/meetings/components/meeting-notes-model'
import {
  FilterBar,
  KIND_META,
  MeetingPanelsProvider,
  Panel,
  PanelNav,
  PANEL_DEFAULT_OPEN,
  PANEL_FRAME_CLASS,
  PanelsLayout,
  usePanels,
  type PanelId,
  type PanelNavItem,
} from '@/features/meetings/components/meeting-panels'
import type { ContentKind } from '@/features/meetings/components/meeting-panels-model'
import {
  addFollowup,
  attributeFollowup,
  closeFollowupAsStale,
  copyFollowupResponseToNotes,
  deferFollowupReason,
  clearMeetingAiNotes,
  finalizeMeetingRecording,
  getMeetingIntel,
  noteFollowup,
  reopenFollowup,
  resolveFollowup,
  setMeetingAutoAssignTasks,
  transcribeSegment,
  type CarriedForwardItem,
  type FollowupPersonOption,
  type FollowupTargetOption,
  type LinkedTaskView,
  type MeetingIntel,
  type UnattributedFollowupView,
} from '@/features/meetings/ai-actions'
import {
  pickUtterance,
  shouldFlush,
  UTTERANCE_PAIR_WINDOW_MS,
  type ActiveLanguage,
  type UtteranceCandidate,
} from '@/features/meetings/language-switch'
import {
  hintTail,
  isRetriableSegmentError,
  segmentRetryDelayMs,
  shouldCutSegment,
  SEGMENT_UPLOAD_ATTEMPTS,
} from '@/features/meetings/recording-segments'
import {
  loadParkedSegments,
  parkSegment,
  releaseSegment,
} from '@/features/meetings/segment-store'
import { isLiveTranscriptionEnabled } from '@/features/transcription/flag'
import { useLiveTranscription } from '@/features/transcription/components/use-live-transcription'
import {
  LiveTranscriptionCostNotice,
  LiveTranscriptionStatus,
} from '@/features/transcription/components/live-transcription-status'

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

/**
 * What a recording is capturing.
 *  - `mic`        — the microphone only, the original default.
 *  - `screen+mic` — shared tab/screen audio mixed with the microphone.
 *  - `screen`     — shared audio only, nothing from the room. For playing back
 *                   a recorded call, or capturing a remote participant without
 *                   putting the local room on the tape.
 * The mic can be turned on and off within any of these while recording; the
 * mode is what it STARTED as, which is what decides whether losing the mic
 * leaves anything behind.
 */
type CaptureMode = 'mic' | 'screen' | 'screen+mic'

/**
 * SpeechRecognition error codes that will never succeed on retry, mapped to
 * what to tell the user. Anything not listed is treated as transient and left
 * to the auto-restart, subject to the consecutive-failure ceiling below.
 *
 * `language-not-supported` is the one that matters in practice: Chrome ships
 * no Sinhala model in most builds, so the si-LK engine of Bilingual mode fails
 * immediately on those machines.
 */
const PERMANENT_RECOGNITION_ERRORS: Record<string, string> = {
  'not-allowed': 'microphone access was denied for live text',
  'service-not-allowed': 'the browser blocked the speech service',
  'audio-capture': 'no microphone was available',
  'language-not-supported': 'this browser has no speech model for that language',
}

/**
 * How many consecutive errors an engine may hit before we stop restarting it.
 * Three rather than one because a single `network` or `no-speech` is ordinary;
 * three in a row with no result in between is a broken engine pretending to be
 * a slow one.
 */
const MAX_CONSECUTIVE_RECOGNITION_ERRORS = 3

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

// One ~5-minute slice of the recording (see SEGMENT_TARGET_MS in
// recording-segments.ts), tracked from the moment it's cut until it's
// successfully transcribed. `blob` is what makes this the safety net a
// single PendingAudio blob used to be for the WHOLE meeting: if a segment's
// upload/transcription fails, its (couple-MB) audio stays right here with a
// retry affordance — "nothing recorded is lost" now applies per segment
// instead of to a two-hour blob that would otherwise vanish the instant a
// transient Gemini failure happened at minute 119.
type SegmentStatus = 'uploading' | 'done' | 'failed'
type RecordingSegment = {
  index: number
  status: SegmentStatus
  blob: Blob
  error?: string
  /** 1-based attempt currently in flight — shown while retrying so a slow
   *  self-healing upload reads as "still working on it", not as a hang. */
  attempt?: number
  /** True for a segment recovered from IndexedDB after a reload/crash rather
   *  than cut by the recorder in this page load (see segment-store.ts). Only
   *  affects wording — the retry path is identical. */
  recovered?: boolean
}

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

/**
 * "Around the table" keeps its own internal open/closed state everywhere
 * else it might ever be used — this wrapper is the one caller that lifts it
 * into the write-up's shared persisted panel mechanism (see
 * meeting-panels.tsx) so its collapse behaviour matches every other panel
 * here, without changing a single line of meeting-prep.tsx's own rendering.
 * Must render inside a MeetingPanelsProvider — see MeetingIntelPanel below.
 */
function AroundTheTablePanel({ meetingId, currentUserId }: { meetingId: string; currentUserId: string }) {
  const { openMap, setPanelOpen } = usePanels()
  const id: PanelId = 'around-the-table'
  return (
    <div id={id} className={PANEL_FRAME_CLASS}>
      <MeetingPrepSection
        meetingId={meetingId}
        currentUserId={currentUserId}
        open={openMap[id] ?? PANEL_DEFAULT_OPEN[id]}
        onOpenChange={(value) => setPanelOpen(id, value)}
      />
    </div>
  )
}

export function MeetingIntelPanel({
  meetingId,
  meetingTitle,
  canRecord,
  currentUserId,
  attendees = [],
  autoOpen = false,
  appId = null,
  mentionUsers,
  onGlanceChange,
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
  /**
   * Hands the row above the counts derived from this meeting's intel every
   * time it loads. The fetch happens either way; this is what stops the
   * result being invisible until somebody expands the panel. `null` means
   * "asked, and there is nothing to show" — a viewer who may not read this
   * meeting's intel, or a request that failed — which the row needs to tell
   * apart from "hasn't answered yet", or it shimmers a skeleton forever.
   */
  onGlanceChange?: (glance: MeetingGlance | null) => void
  /**
   * Open this panel on arrival, and scroll it into view.
   *
   * Set by the calendar's "Open the write-up, transcript and follow-ups"
   * button, which is the only route from a calendar chip to a meeting's
   * notes. That button used to switch to the list view and filter it to the
   * meeting's day and then stop — leaving the write-up it named still
   * collapsed, somewhere down a list, so the button read as doing nothing.
   */
  autoOpen?: boolean
}) {
  // Collapsed by default. Expanded-by-default meant a 30-meeting page mounted
  // 30 note timelines and fired two server actions per row before anyone had
  // asked to read anything — and, worse, presented every meeting as an
  // undifferentiated wall. The counts that used to justify auto-opening now
  // ride on the collapsed row itself (see onGlanceChange).
  const [open, setOpen] = useState(false)
  const [intel, setIntel] = useState<MeetingIntel | null>(null)
  const [loading, setLoading] = useState(false)
  // getMeetingIntel failing used to be a toast and nothing else: `intel`
  // stayed null and the panel fell through to "No AI notes yet", which is a
  // different and untrue statement. Now it is an inline error with a retry,
  // matching NoteTimeline's own load-failure block.
  const [loadError, setLoadError] = useState<string | null>(null)
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
  // Set when dual mode couldn't start both engines (see startBilingualRecognition)
  // and fell back to a single engine — a quiet, one-line, non-blocking notice.
  // The meeting keeps recording regardless.
  // Consecutive SpeechRecognition errors per engine, reset by any result. A
  // ref, not state: it changes inside recognizer callbacks that must not
  // re-render the panel mid-recording.
  const engineErrorCountRef = useRef<Partial<Record<ActiveLanguage, number>>>({})
  /** What this recording was started as. Drives the toolbar during capture —
   *  a mic-only recording has no shared audio to fall back on, so its mic
   *  toggle is a stop button in disguise and is not offered. */
  const [captureMode, setCaptureMode] = useState<CaptureMode>('mic')
  const [micOn, setMicOn] = useState(false)
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null)
  const [liveUnavailable, setLiveUnavailable] = useState(false)
  // Which engine currently feeds the live transcript — the degradation
  // ladder's current rung. 'gemini' is the Gemini Live socket (true
  // bilingual, hears the whole capture graph including shared tab audio);
  // 'webspeech' is the browser recognizer pair below it (mic only);
  // 'none' means the live pane is off and the segmented pipeline alone
  // carries transcription. State for render + a ref twin for the
  // non-React callbacks (recorder/recognizer handlers) that must not read
  // a stale closure.
  const [liveEngine, setLiveEngineState] = useState<'gemini' | 'webspeech' | 'none'>('none')
  const liveEngineRef = useRef<'gemini' | 'webspeech' | 'none'>('none')
  // Gemini Live session (flag-gated; started inside startRecording). The
  // hook owns socket/audio lifecycle; this component only routes its text
  // into the shared live-transcript state and walks the fallback ladder
  // when it degrades.
  const geminiLive = useLiveTranscription(meetingId)
  // How many chars of the Live session's committed text have already been
  // appended into finalTranscriptRef — the cursor that lets Live output
  // APPEND (like acceptUtterance does) instead of overwriting, so a user's
  // mid-meeting corrections in the textarea survive every new utterance.
  const geminiCommittedRef = useRef(0)
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  // See RecordingSegment above. One entry per cut segment, from the moment
  // it's cut until finalize has consumed it; mirrors segmentsRef so a retry
  // (which needs the actual Blob back) never reads stale render state.
  const [segments, setSegments] = useState<RecordingSegment[]>([])
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
  // "Needs attribution" — a separate write from the carried-forward ones
  // above (it targets a different row shape, meetingFollowups.userId rather
  // than status), so it gets its own pending/busy pair instead of sharing
  // busyFollowupId with rows that aren't even rendered from the same list.
  const [attributePending, startAttribute] = useTransition()
  const [busyAttributeId, setBusyAttributeId] = useState<string | null>(null)
  // The "add a follow-up by hand" form. Collapsed until asked for — the
  // section's job is still mostly to show what came back from last time.
  const [addingFollowup, setAddingFollowup] = useState(false)
  const [addPending, startAddFollowup] = useTransition()

  // The per-meeting "Auto-assign tasks" toggle — manual-override layer (a):
  // default ON (see meetings.autoAssignTasks), only creator/admin can flip
  // it (setMeetingAutoAssignTasks re-checks that server-side; `canRecord`
  // gates who even sees the switch, same tier as the record controls).
  // Written optimistically so the switch itself is the confirmation, with a
  // revert-on-failure like every other write in this panel.
  const [autoAssignPending, startAutoAssignPending] = useTransition()

  const router = useRouter()
  const panelId = useId()

  // The panel prefetches its meeting's intel so the collapsed row can show
  // what the meeting produced — but a page can list dozens of meetings, and
  // firing all of those requests on mount is how the list got slow. Gated on
  // the row actually coming near the viewport instead. The initial value is
  // "already in view" wherever IntersectionObserver does not exist (SSR, and
  // any browser without it), so the gate can only ever delay a fetch, never
  // lose one — and it is computed in the initializer rather than corrected in
  // an effect, which would be a cascading render.
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined')

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamsRef = useRef<MediaStream[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  /** The stream the MediaRecorder is bound to. Stable for a whole recording,
   *  whatever is connected into it — see the comment on toggleMic. */
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  /** Non-null exactly while the microphone is open. Doubles as the "is the mic
   *  on" source of truth for code paths that run outside React state. */
  const micStreamRef = useRef<MediaStream | null>(null)
  const micNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
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
  const transcriptPanelRef = useRef<HTMLTextAreaElement | null>(null)
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

  // Every path that receives intel goes through here, so the row's glance
  // chips and the panel's contents can never disagree about what this meeting
  // produced.
  function applyIntel(data: MeetingIntel) {
    setIntel(data)
    onGlanceChange?.(glanceFromIntel(data, new Date()))
  }

  /**
   * The request currently in flight, so the viewport prefetch and a click on
   * the toggle a few hundred milliseconds later share ONE getMeetingIntel
   * instead of firing two — which is the whole point of the prefetch gate, and
   * what the previous `!loading` guard could not catch (the prefetch runs
   * silently and never sets `loading`). It resolves to a result rather than
   * void so the click can report a failure it did not itself observe, instead
   * of falling through to "No AI write-up for this meeting yet" — a load
   * failure dressed up as an empty meeting.
   */
  const inFlightRef = useRef<Promise<{ ok: true } | { ok: false; error: string }> | null>(null)

  /**
   * - `visible`  a person asked for the panel: skeleton while it loads, and an
   *              inline error with Retry if it fails.
   * - `prefetch` the row came into view: silent, and only feeds the glance
   *              chips.
   * - `refresh`  a write just landed: silent (the row already updated
   *              optimistically, blanking the panel would be the bigger
   *              disruption) and deliberately NOT deduped, since the point is
   *              to see what the server actually stored.
   */
  async function loadIntel(mode: 'visible' | 'prefetch' | 'refresh') {
    const loud = mode === 'visible'
    const existing = mode === 'refresh' ? null : inFlightRef.current
    const request =
      existing ??
      getMeetingIntel(meetingId)
        .then((res) => {
          if (res.ok) {
            applyIntel(res.data)
            return { ok: true } as const
          }
          // Tell the row to stop waiting: a viewer who may not read this
          // meeting's intel gets 'Not available' here, and a skeleton that
          // never resolves is worse than no chips at all.
          onGlanceChange?.(null)
          return { ok: false, error: res.error } as const
        })
        .catch(() => {
          onGlanceChange?.(null)
          return { ok: false, error: 'Could not load these notes' } as const
        })
    if (mode !== 'refresh') inFlightRef.current = request

    const result = await request
    if (inFlightRef.current === request) inFlightRef.current = null
    if (loud) {
      setLoadError(result.ok ? null : result.error)
      setLoading(false)
    }
  }

  /**
   * The load a person asked for. The skeleton is switched on HERE rather than
   * inside loadIntel so that loadIntel writes no state until after its await —
   * which is what lets the viewport prefetch call it straight from an effect
   * without that being a cascading render.
   */
  async function handleClearNotes() {
    const res = await clearMeetingAiNotes(meetingId)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    // 'refresh' rather than optimistic local clearing: the action deletes across
    // three tables, and re-reading is the only way this panel's summary,
    // segments, follow-ups, and carried-forward items all agree with what is
    // actually left.
    await loadIntel('refresh')
    toast.success('Notes cleared — the transcript is still there to write up again')
  }

  function loadIntelVisibly() {
    setLoading(true)
    setLoadError(null)
    void loadIntel('visible')
  }

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next && !intel) loadIntelVisibly()
  }

  /**
   * Honour `autoOpen` once — the calendar sent somebody here specifically to
   * read this meeting's write-up, so open it and put it under their eyes.
   *
   * Guarded by a ref rather than by `open`, so that closing the panel again
   * afterwards is a decision that sticks: keying off `open` would re-open it
   * on the next render and make the collapse button useless for as long as
   * the row stayed selected.
   */
  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (!autoOpen || autoOpenedRef.current) return
    autoOpenedRef.current = true
    setOpen(true)
    loadIntelVisibly()
    // After paint, so the panel it scrolls to is the expanded one rather than
    // the collapsed row that is about to grow underneath the viewport.
    requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on the autoOpen edge; loadIntelVisibly is stable enough and re-running would fight the user's own collapse
  }, [autoOpen])

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
    // Stopping the Live socket here is what ends its metered streaming the
    // moment the recording ends — the hook's own unmount cleanup only covers
    // the component going away, not the recording stopping.
    //
    // The returned text is merged SYNCHRONOUSLY, before the engine gate is
    // closed below. The session commits its in-flight turn on the way down,
    // and those final words only reach React on a later render — by which
    // time liveEngineRef is 'none' and the delta effect would drop them. This
    // runs immediately before runFinalize, so whatever was said between the
    // last turn boundary and pressing Stop still makes it into the saved
    // transcript and the segment spelling hint.
    const liveTail = geminiLive.stop()
    if (liveEngineRef.current === 'gemini') {
      const delta = liveTail.slice(geminiCommittedRef.current).trim()
      if (delta) {
        finalTranscriptRef.current = finalTranscriptRef.current
          ? `${finalTranscriptRef.current} ${delta}`
          : delta
        setFinalText(finalTranscriptRef.current)
      }
    }
    setLiveEngine('none')
    geminiCommittedRef.current = 0
    clearFlushTimer()
    pendingUtteranceRef.current = null
    engineInterimRef.current = {}
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    for (const stream of streamsRef.current) {
      for (const track of stream.getTracks()) track.stop()
    }
    streamsRef.current = []
    micStreamRef.current = null
    micNodeRef.current = null
    destinationRef.current = null
    void audioCtxRef.current?.close().catch(() => undefined)
    audioCtxRef.current = null
    recorderRef.current = null
    setRecording(false)
    setMicOn(false)
    setSeconds(0)
    setInterimText('')
    setInterimLeaderLang(null)
    setFallbackNotice(null)
  }

  useEffect(() => cleanupCapture, [])

  // Arms the viewport gate. Disconnects itself the first time the row is
  // near the screen — this is a one-shot "has it been seen yet", not an
  // ongoing subscription, so there is nothing to keep watching afterwards.
  useEffect(() => {
    if (inView) return
    const element = rootRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setInView(true)
        observer.disconnect()
      },
      // Start fetching a little before the row is actually visible so the
      // chips are usually there by the time it scrolls in.
      { rootMargin: '300px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [inView])

  // What a meeting produced should be legible without opening it, so the
  // intel is fetched once the row comes into view and its counts are handed
  // straight up to the collapsed row. Failures here stay silent: this is an
  // unprompted prefetch, and expanding the panel re-runs the same load with a
  // visible error and a retry.
  useEffect(() => {
    if (!inView) return
    void loadIntel('prefetch')
    // loadIntel closes over the onGlanceChange prop; listing it here would
    // re-run the prefetch (and re-fire the request) on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, inView])

  // Auto-scroll the live panel to the newest line, but only when the user
  // was already near the bottom — don't fight someone scrolling up to
  // reread something. Also never while the textarea has focus: focus means
  // someone is mid-correction, and yanking the scroll position under their
  // caret on every appended utterance would make editing impossible.
  useEffect(() => {
    const el = transcriptPanelRef.current
    if (!el || document.activeElement === el) return
    if (nearBottomRef.current) el.scrollTop = el.scrollHeight
  }, [finalText, interimText])

  function handleTranscriptScroll() {
    const el = transcriptPanelRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  function setLiveEngine(next: 'gemini' | 'webspeech' | 'none') {
    liveEngineRef.current = next
    setLiveEngineState(next)
  }

  // Routes Gemini Live output into the SAME live-transcript state the Web
  // Speech path writes, as append-only deltas. finalTranscriptRef stays the
  // single source of truth (it feeds hintTail, the finalize fallback, and
  // the editable textarea), so Live text has to merge into it the way
  // acceptUtterance does — never replace it, or user corrections would be
  // silently undone by the next utterance.
  useEffect(() => {
    if (liveEngineRef.current !== 'gemini') return
    const committed = geminiLive.finalText
    // A shorter committed string means a fresh session started underneath
    // us (stop + start resets the hook's buffer) — restart the cursor.
    if (committed.length < geminiCommittedRef.current) geminiCommittedRef.current = 0
    const delta = committed.slice(geminiCommittedRef.current).trim()
    geminiCommittedRef.current = committed.length
    if (delta) {
      finalTranscriptRef.current = finalTranscriptRef.current
        ? `${finalTranscriptRef.current} ${delta}`
        : delta
      setFinalText(finalTranscriptRef.current)
    }
    setInterimText(geminiLive.interimText)
    // Everything else this reads is a ref or a stable setter — only the
    // hook's text should re-run it.
  }, [geminiLive.finalText, geminiLive.interimText])

  // The hook's documented contract: a non-null notice means the Live path
  // degraded terminally and the consumer MUST fall back and say why. Next
  // rung down is Web Speech — browser-local and free, but it listens to the
  // input DEVICE, so it needs a live microphone; without one the pane goes
  // quiet honestly instead of pretending ("liveUnavailable").
  useEffect(() => {
    if (!geminiLive.notice) return
    if (liveEngineRef.current !== 'gemini') return
    setFallbackNotice(geminiLive.notice)
    if (!recordingRef.current) return
    if (liveSupported && micStreamRef.current) {
      setLiveEngine('webspeech')
      startRecognitionForPreference()
    } else {
      setLiveEngine('none')
      setLiveUnavailable(true)
    }
    // Deliberately keyed on the notice alone — it is set exactly once per
    // terminal degradation (fail or auto-stop), which is exactly when the
    // ladder should step down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geminiLive.notice])

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
  function handleEngineUnavailable(lang: ActiveLanguage, reason?: string) {
    delete recognitionRefs.current[lang]
    engineInterimRef.current[lang] = ''
    refreshInterimDisplay()
    const remaining = Object.keys(recognitionRefs.current) as ActiveLanguage[]
    if (remaining.length === 0) {
      // The reason survives even when there is nothing left to fall back to.
      // "Live text stopped" alone says something broke but not whether it is
      // worth acting on — a network drop is worth retrying, a browser with no
      // Sinhala model never will be.
      setLiveUnavailable(true)
      setFallbackNotice(reason ?? null)
      return
    }
    engineModeRef.current = 'single'
    flushPendingUtterance()
    setFallbackNotice(
      `Live text for ${ACTIVE_LANGUAGE_LABEL[lang]} stopped${reason ? ` (${reason})` : ''} — continuing in ${ACTIVE_LANGUAGE_LABEL[remaining[0]]} only.`,
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
      // Any result at all proves the engine works, so the consecutive-failure
      // count starts over. Without this reset the counter is cumulative and a
      // long meeting would eventually trip the give-up threshold on a handful
      // of unrelated network blips spread across an hour.
      engineErrorCountRef.current[lang] = 0
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
      // Permanent failures — stop retrying this engine and say why.
      //
      // `language-not-supported` belongs here and did not used to: Chrome
      // ships no Sinhala Web Speech model in most builds, so the si-LK engine
      // errors the instant it starts. Falling through to onend restarted it,
      // which errored again, forever — an invisible loop whose only symptom
      // was a Live transcript stuck on "Listening…" with no notice at all,
      // because nothing ever reached handleEngineUnavailable to report it.
      const permanent = PERMANENT_RECOGNITION_ERRORS[event.error]
      if (permanent) {
        recognition.onend = null
        handleEngineUnavailable(lang, permanent)
        return
      }

      // Everything else (no-speech, aborted, a blip of network) is genuinely
      // transient and left to onend's restart. But "transient" repeated
      // without end is just a permanent failure wearing a disguise: count
      // consecutive errors and give up once an engine has failed this many
      // times without ever producing a result. Silence with an explanation
      // beats silence.
      const failures = (engineErrorCountRef.current[lang] ?? 0) + 1
      engineErrorCountRef.current[lang] = failures
      if (failures >= MAX_CONSECUTIVE_RECOGNITION_ERRORS) {
        recognition.onend = null
        handleEngineUnavailable(
          lang,
          event.error === 'network'
            ? 'no network connection to the speech service'
            : `speech recognition kept failing (${event.error})`,
        )
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
    // Fresh start, fresh count — otherwise a recording that ended with two
    // network blips leaves the next one one error away from giving up.
    engineErrorCountRef.current[lang] = 0
    return true
  }

  /**
   * Starts recognition according to the current language preference. Extracted
   * so the mic toggle can restart live text mid-recording using exactly the
   * same rules the initial start used — two call sites choosing engines by
   * different logic is how "bilingual" quietly becomes "English" on resume.
   */
  function startRecognitionForPreference() {
    if (language === 'bilingual') {
      startBilingualRecognition()
      return
    }
    // Manual override — exactly one engine, in the chosen language.
    engineModeRef.current = 'single'
    if (!startEngine(language)) setLiveUnavailable(true)
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
  async function uploadSegment(index: number, blob: Blob, recovered = false) {
    // Retries in place, with backoff, before ever showing a failure. Most of
    // what goes wrong here is transient — a dropped request, a server
    // restarting mid-deploy, Gemini briefly overloaded — and the person in
    // the meeting can do exactly nothing useful about any of it. Only a
    // failure that survives every attempt (or is permanent by construction,
    // see isRetriableSegmentError) is worth interrupting them for.
    for (let attempt = 1; attempt <= SEGMENT_UPLOAD_ATTEMPTS; attempt += 1) {
      upsertSegment({ index, status: 'uploading', blob, attempt, recovered })
      let error: string
      try {
        const formData = new FormData()
        formData.append('audio', new File([blob], `segment-${index}`, { type: blob.type }))
        // Only the TAIL of the live transcript rides along, not the whole
        // meeting so far — the hint helps spell names/terms heard in THIS
        // ~5-minute segment, and sending everything made hint cost grow
        // quadratically over an hours-long meeting (see hintTail's comment).
        const hint = hintTail(finalTranscriptRef.current)
        if (hint) formData.append('liveTranscriptHint', hint)
        const res = await transcribeSegment(meetingId, index, formData)
        if (res.ok) {
          upsertSegment({ index, status: 'done', blob, recovered })
          // The transcript is in the database now — that's the durable copy
          // from here on, so the parked audio has done its job. This is the
          // only place parked audio is ever dropped.
          await releaseSegment(meetingId, index)
          return
        }
        error = res.error
      } catch (thrown) {
        // A rejected server action: the network, or the action never
        // reaching the server at all. Keep the real message — the old bare
        // `catch {}` here is what turned every server-side fault into an
        // indistinguishable "Upload failed — try again" with no way to tell
        // a flaky connection from an unapplied database migration.
        error =
          thrown instanceof Error
            ? `Could not reach the server (${thrown.message})`
            : 'Could not reach the server'
        console.error(`[meeting-recording] segment ${index + 1} upload attempt ${attempt} threw:`, thrown)
      }

      const lastAttempt = attempt === SEGMENT_UPLOAD_ATTEMPTS
      if (lastAttempt || !isRetriableSegmentError(error)) {
        upsertSegment({ index, status: 'failed', blob, error, recovered })
        return
      }
      await new Promise((resolve) => setTimeout(resolve, segmentRetryDelayMs(attempt)))
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
    // Park BEFORE uploading, and don't wait for it: the audio is on disk
    // before the first byte goes out, so a crash mid-upload is recoverable,
    // and a slow/unavailable IndexedDB can never delay the recorder.
    void parkSegment(meetingId, index, blob)
    segmentUploadPromisesRef.current.push(uploadSegment(index, blob))
  }

  function retrySegment(index: number) {
    const segment = segmentsRef.current.find((s) => s.index === index)
    if (!segment || segment.status === 'uploading') return
    segmentUploadPromisesRef.current.push(uploadSegment(index, segment.blob, segment.recovered))
  }

  // Crash/reload recovery. Any segment still parked in IndexedDB (see
  // segment-store.ts) is audio that was recorded but never confirmed
  // transcribed — the tab was closed mid-upload, the browser reaped it, the
  // laptop slept. Pick it straight back up rather than waiting to be asked:
  // the person who recorded it has no way of knowing it's even there, and the
  // server-side upsert on (meetingId, index) makes re-sending one that did
  // actually land harmless. Declared here, after uploadSegment, because it
  // calls it.
  useEffect(() => {
    if (!canRecord) return
    let cancelled = false
    void (async () => {
      const parked = await loadParkedSegments(meetingId)
      if (cancelled || parked.length === 0) return
      // Never renumber over recovered work — same reasoning as startRecording.
      segmentIndexRef.current = parked.reduce(
        (next, segment) => Math.max(next, segment.index + 1),
        segmentIndexRef.current,
      )
      for (const segment of parked) {
        segmentUploadPromisesRef.current.push(uploadSegment(segment.index, segment.blob, true))
      }
      toast.info(
        parked.length === 1
          ? 'Recovered 1 unfinished recording segment — transcribing it now'
          : `Recovered ${parked.length} unfinished recording segments — transcribing them now`,
      )
    })()
    return () => {
      cancelled = true
    }
    // uploadSegment closes only over refs and meetingId; adding it as a
    // dependency would re-run this on every render and re-upload the same
    // recovered audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, canRecord])

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
        // Say which of the two outcomes this actually was. The limited
        // (no-Gemini) outcome is a success — the meeting has real notes —
        // but pretending it was the full write-up would hide that adding a
        // key and re-running would produce something better.
        if (res.data.mode === 'live-transcript') {
          toast.success(
            'Notes saved from the live transcript (no Gemini analysis). Add a Gemini key in Profile and retry the saved segments for full AI notes.',
          )
        } else {
          toast.success(
            segmentsRef.current.length > 0
              ? 'Meeting analyzed — one or more segments still need a retry (see below)'
              : 'Meeting analyzed — notes are ready',
          )
        }
        // 'refresh', not the deduping path: the notes that exist now are the
        // ones this analysis just wrote, so piggybacking on an older in-flight
        // request would show the panel the meeting as it was before it ran.
        await loadIntel('refresh')
      } catch {
        setFinalizeError('Something went wrong — try again')
        toast.error('Something went wrong — your segments are saved, try again')
      }
    })
  }

  /**
   * Attaches the microphone to the live capture graph, acquiring the device if
   * it is not already open. Safe to call while recording.
   *
   * Returns false when the browser refuses the device — the caller decides
   * whether that is fatal (mic-only recording) or survivable (screen capture
   * carrying on without it).
   */
  async function attachMic(): Promise<boolean> {
    const audioCtx = audioCtxRef.current
    const destination = destinationRef.current
    if (!audioCtx || !destination) return false
    if (micStreamRef.current) return true

    let mic: MediaStream
    try {
      // Mono (channelCount: 1) — speech transcription gets nothing from a
      // second channel, and halves what the encoder has to push through before
      // audioBitsPerSecond even applies.
      mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
    } catch {
      return false
    }

    micStreamRef.current = mic
    streamsRef.current.push(mic)
    const source = audioCtx.createMediaStreamSource(mic)
    source.connect(destination)
    micNodeRef.current = source
    return true
  }

  /**
   * Detaches the microphone and RELEASES the device — it does not merely mute.
   *
   * Muting via a gain node would be less code and would keep re-enabling
   * instant, but it leaves the OS and browser recording indicators lit while
   * the user believes the mic is off. For a tool that records meetings, the
   * indicator has to tell the truth: if the light is on, audio is reaching us.
   * Re-acquiring costs a getUserMedia call, which does not re-prompt once
   * permission has been granted for the origin.
   */
  function detachMic() {
    micNodeRef.current?.disconnect()
    micNodeRef.current = null
    const mic = micStreamRef.current
    if (mic) {
      for (const track of mic.getTracks()) track.stop()
      streamsRef.current = streamsRef.current.filter((stream) => stream !== mic)
    }
    micStreamRef.current = null
  }

  /**
   * Mic on/off mid-recording. The MediaRecorder is never touched: it is bound
   * to the AudioContext destination stream, which stays the same object for the
   * whole recording no matter what feeds into it. That is the entire reason the
   * graph exists even for mic-only capture — swapping sources under a running
   * recorder would otherwise mean stopping and restarting it, which would break
   * the segment numbering the upload pipeline depends on.
   */
  async function toggleMic() {
    if (micOn) {
      detachMic()
      // Web Speech listens to the device directly, so with the mic released
      // it would just spin producing nothing. Gemini Live listens to the
      // capture graph and keeps transcribing the shared tab audio — leave it
      // running; that is the whole point of feeding it the mixed stream.
      if (liveEngineRef.current === 'webspeech') stopAllRecognition()
      setMicOn(false)
      toast.info('Microphone off — still recording shared audio')
      return
    }

    const ok = await attachMic()
    if (!ok) {
      toast.error('Could not turn the microphone on')
      return
    }
    setMicOn(true)
    // Restarting the recognizers covers two cases: the mic being toggled back
    // on under Web Speech, AND the ladder having bottomed out earlier BECAUSE
    // there was no microphone (a screen-only capture whose Live session
    // failed). Without the second, attaching a mic mid-recording could never
    // bring live text back — the pane stayed dead for the rest of the meeting.
    if (liveSupported && (liveEngineRef.current === 'webspeech' || liveEngineRef.current === 'none')) {
      setLiveEngine('webspeech')
      setLiveUnavailable(false)
      startRecognitionForPreference()
    }
    toast.success('Microphone on')
  }

  async function startRecording(mode: CaptureMode) {
    const mimeType = pickMimeType()
    if (!mimeType) {
      toast.error('This browser cannot record audio — try Chrome')
      return
    }
    try {
      const wantsScreen = mode !== 'mic'
      const wantsMic = mode !== 'screen'

      // The graph is built for EVERY mode, including mic-only. It used to be
      // created only when mixing in screen audio, with mic-only handing its raw
      // stream straight to the recorder — but a raw device stream cannot have
      // sources added or removed later, so the mic could never be turned off
      // and back on mid-recording. One destination stream, stable for the whole
      // recording, is what makes that possible.
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const destination = audioCtx.createMediaStreamDestination()
      destinationRef.current = destination

      if (wantsScreen) {
        // Sharing a tab/screen with audio; only the audio tracks are kept.
        const screen = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        })
        streamsRef.current.push(screen)
        if (screen.getAudioTracks().length > 0) {
          audioCtx
            .createMediaStreamSource(new MediaStream(screen.getAudioTracks()))
            .connect(destination)
        } else if (mode === 'screen') {
          // Fatal here, unlike in screen+mic: there is no other source, so this
          // would record an hour of silence and only reveal it at the write-up.
          for (const track of screen.getTracks()) track.stop()
          streamsRef.current = streamsRef.current.filter((s) => s !== screen)
          void audioCtx.close().catch(() => undefined)
          audioCtxRef.current = null
          destinationRef.current = null
          toast.error(
            'That share has no audio. Pick a tab and tick “Share tab audio”, or record the mic too.',
          )
          return
        } else {
          toast.info(
            'No tab audio shared — recording mic only. Pick a tab and enable “Share audio” for both sides.',
          )
        }
      }

      if (wantsMic) {
        const gotMic = await attachMic()
        if (!gotMic) {
          // Mic-only cannot proceed; screen+mic can, minus the mic.
          if (mode === 'mic') throw new Error('microphone unavailable')
          toast.warning('Microphone unavailable — recording shared audio only')
        }
        setMicOn(gotMic)
      } else {
        setMicOn(false)
      }

      setCaptureMode(mode)
      const captureStream = destination.stream

      chunksRef.current = []
      headerChunkRef.current = null
      segmentBytesRef.current = 0
      segmentStartRef.current = Date.now()
      segmentUploadPromisesRef.current = []
      mimeBaseRef.current = mimeType.split(';')[0]
      // Continue numbering AFTER anything already recorded for this meeting
      // rather than restarting at 0. Segment index is the primary key on the
      // server (upsert on meetingId+index), so restarting the count would
      // silently overwrite the transcripts of an earlier take — and any
      // untranscribed segment still sitting here (failed, or recovered from a
      // previous page load) would lose its slot too. Recording a second time
      // now appends to the meeting instead of replacing it.
      segmentIndexRef.current = segmentsRef.current.reduce(
        (next, segment) => Math.max(next, segment.index + 1),
        0,
      )
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

      // Reset the live-transcript surface for the new recording, whichever
      // engine ends up feeding it.
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
      geminiCommittedRef.current = 0
      // Seed the conversation-inertia fallback from whichever language
      // last won an utterance (persisted across sessions) rather than
      // starting with nothing to lean on for the very first ambiguous
      // utterance of this recording.
      previousLangRef.current = lastActiveLangRef.current

      // The degradation ladder, top rung first:
      //  1. Gemini Live — true bilingual code-switched transcription, and it
      //     listens to the CAPTURE GRAPH's mixed stream, so it hears shared
      //     tab audio too (screen-only recordings get live text for the
      //     first time). Failure falls through to rung 2 via the notice
      //     effect above, never takes the recording with it.
      //  2. Web Speech — browser recognizers; need a real microphone.
      //  3. None — the pane stays off; the segmented pipeline still
      //     transcribes everything in ~5-minute batches.
      if (isLiveTranscriptionEnabled()) {
        setLiveEngine('gemini')
        void geminiLive.start(destination.stream)
      } else if (liveSupported && micStreamRef.current) {
        setLiveEngine('webspeech')
        startRecognitionForPreference()
      } else {
        setLiveEngine('none')
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
        await loadIntel('refresh')
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

  // Distinct from handleResolve: the outcome note it writes says HOW this
  // was closed (no answer ever came) rather than claiming the item was
  // actually addressed — see closeFollowupAsStale's own comment.
  function handleCloseStale(followupId: string) {
    setComposer((prev) => (prev?.id === followupId ? null : prev))
    patchFollowup(followupId, { status: 'resolved', resolvedAt: new Date() })
    runFollowupWrite(followupId, () => closeFollowupAsStale(followupId), 'Closed as stale')
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
        await loadIntel('refresh')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  // Gives an unattributed item (the model named someone it couldn't
  // resolve to a user) a real owner. No optimistic patch here — unlike the
  // carried-forward writes above, this row moves to a whole different list
  // (unattributed -> prep) once it succeeds, which the refetch handles more
  // honestly than a local patch guessing at the new shape would.
  function handleAttribute(followupId: string, userId: string) {
    setBusyAttributeId(followupId)
    startAttribute(async () => {
      try {
        const res = await attributeFollowup(followupId, userId)
        if (res.ok) toast.success('Attributed — it now carries forward normally')
        else toast.error(res.error)
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        await loadIntel('refresh')
        setBusyAttributeId(null)
      }
    })
  }

  // Optimistic flip + revert-on-failure, same shape as runFollowupWrite —
  // the switch's own position is the confirmation, so it has to move the
  // instant it's clicked, and move back if the server refuses it.
  function handleToggleAutoAssign(next: boolean) {
    setIntel((prev) => (prev ? { ...prev, autoAssignTasks: next } : prev))
    startAutoAssignPending(async () => {
      try {
        const res = await setMeetingAutoAssignTasks(meetingId, next)
        if (!res.ok) {
          setIntel((prev) => (prev ? { ...prev, autoAssignTasks: !next } : prev))
          toast.error(res.error)
          return
        }
        toast.success(next ? 'Auto-assign is on for this meeting' : 'Auto-assign is off — every item needs review')
      } catch {
        setIntel((prev) => (prev ? { ...prev, autoAssignTasks: !next } : prev))
        toast.error('Something went wrong — try again')
      }
    })
  }

  const doneSegmentCount = segments.filter((s) => s.status === 'done').length
  const failedSegments = segments.filter((s) => s.status === 'failed')
  const uploadingSegmentCount = segments.filter((s) => s.status === 'uploading').length

  const notes = intel?.notes ?? null
  // Default true before intel has loaded — matches meetings.autoAssignTasks'
  // own DB default, so the switch never has to render "unknown".
  const autoAssignTasks = intel?.autoAssignTasks ?? true
  const prep = intel?.prep ?? []
  const people = intel?.people ?? []
  const approvedUsers = intel?.approvedUsers ?? []
  const unattributed = intel?.unattributed ?? []
  const upcomingMeetings = intel?.upcomingMeetings ?? []
  // Resolved rows stay on screen as a record, so "is anything still owed?"
  // has to count open ones rather than trust the list being empty.
  const openCount = prep.reduce(
    (total, group) => total + group.items.filter((item) => item.status === 'open').length,
    0,
  )
  // Attendees first, then anyone else approved — the model may have named a
  // client contact or someone who wasn't even in this meeting's attendee
  // list, so the picker can't stop at `people`.
  const attendeeIds = new Set(people.map((option) => option.id))
  const attributionPeople = [...people, ...approvedUsers.filter((option) => !attendeeIds.has(option.id))]
  // The live pane exists whenever SOME engine is on the ladder's rungs —
  // no longer tied to Web Speech support, since Gemini Live works in any
  // browser with WebSocket + Web Audio.
  const showLiveText = recording && liveEngine !== 'none' && !liveUnavailable
  // Whichever engine is "currently winning": an in-flight interim result
  // takes priority (it's the freshest signal of which language is being
  // heard right now), falling back to whichever language last won an
  // accepted utterance once things go quiet between sentences.
  const currentLeadLang = interimLeaderLang ?? lastWinnerLang

  // One clock read per render, shared by the notes' due-date maths and the
  // follow-up ages below, so two sections of the same panel cannot disagree
  // about what "today" is.
  const now = new Date()

  // Unfiltered per-kind totals for the filter bar's kind chips (see
  // FilterBar's doc comment for why these must ignore the active filters)
  // and the sticky nav's count badges. Action items now count the SAME two
  // sources the panel itself renders — open/auto-accepted suggestions plus
  // untracked JSONB items (see MeetingAiNotes) — so this total, the panel's
  // own badge, and the sticky nav never disagree about how many there are.
  const totalActions = (intel?.suggestions.length ?? 0) + (intel?.untrackedActions.length ?? 0)
  const totalDiscussionPoints = notes
    ? notes.perPerson.reduce((total, person) => total + person.points.length, 0)
    : 0
  const totalQuestions = notes ? notes.questions.reduce((total, entry) => total + entry.questions.length, 0) : 0
  const totalTerms = notes?.terms.length ?? 0
  const totalCarried = prep.reduce((total, group) => total + group.items.length, 0)
  const kindTotals: Record<ContentKind, number> = {
    action: totalActions,
    discussion: totalDiscussionPoints,
    question: totalQuestions,
    term: totalTerms,
    'carried-forward': totalCarried,
  }
  const panelNavItems: PanelNavItem[] = [
    ...(notes?.summary ? [{ id: 'summary' as PanelId, label: 'Summary', icon: Sparkles }] : []),
    ...(totalActions > 0
      ? [{ id: 'action-items' as PanelId, label: KIND_META.action.label, icon: KIND_META.action.icon, count: totalActions }]
      : []),
    ...(totalDiscussionPoints > 0
      ? [
          {
            id: 'discussion' as PanelId,
            label: KIND_META.discussion.label,
            icon: KIND_META.discussion.icon,
            count: totalDiscussionPoints,
          },
        ]
      : []),
    ...(totalQuestions > 0
      ? [
          {
            id: 'for-next-meeting' as PanelId,
            label: KIND_META.question.label,
            icon: KIND_META.question.icon,
            count: totalQuestions,
          },
        ]
      : []),
    ...(totalTerms > 0
      ? [{ id: 'glossary' as PanelId, label: KIND_META.term.label, icon: KIND_META.term.icon, count: totalTerms }]
      : []),
    { id: 'around-the-table' as PanelId, label: 'Around the table', icon: Users },
    ...(unattributed.length > 0
      ? [{ id: 'needs-attribution' as PanelId, label: 'Needs attribution', icon: UserPlus, count: unattributed.length }]
      : []),
    {
      id: 'carried-forward' as PanelId,
      label: KIND_META['carried-forward'].label,
      icon: KIND_META['carried-forward'].icon,
      count: openCount > 0 ? openCount : undefined,
    },
    { id: 'record' as PanelId, label: 'Record', icon: NotebookPen },
  ]

  return (
    <div ref={rootRef} className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={open ? 'secondary' : 'outline'}
          size="sm"
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <NotebookPen aria-hidden />
          {/* The label names what is behind the toggle, including the
              recorder — the record controls only render once the panel is
              open, so a manager needs to be told they are in there. */}
          {open ? 'Hide notes' : canRecord ? 'Notes & recording' : 'Notes & follow-ups'}
          <ChevronDown
            className={cn(
              'transition-transform duration-150 motion-reduce:transition-none',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </Button>
        {open && canRecord && !recording && !finalizing ? (
          <>
            <Button variant="outline" size="sm" type="button" onClick={() => startRecording('mic')}>
              <Mic /> Record mic
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => startRecording('screen+mic')}
            >
              <MonitorSpeaker /> Record screen + mic
            </Button>
            {/* Screen without the room. The case this exists for: replaying a
                recorded call, or capturing a remote speaker while the local
                room is talking about something else. */}
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => startRecording('screen')}
            >
              <MonitorSpeaker /> Record screen only
            </Button>
            {/* Only offered when there is actually a write-up to throw away.
                Sits with the record controls because clearing is what you do
                right before recording again — the two serve one intention. */}
            {intel?.notes ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="ghost" size="sm" type="button" className="text-muted-foreground">
                      <Trash2 aria-hidden /> Clear notes
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear this meeting&apos;s notes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Deletes the summary, every note, and the follow-up questions this meeting
                      raised — including notes typed by hand and any answers already written
                      against those follow-ups. This cannot be undone.
                      <br />
                      <br />
                      The recording transcript is kept, so the notes can be written up again
                      without recording the meeting a second time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel render={<Button variant="outline" />}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      render={<Button variant="destructive" />}
                      onClick={handleClearNotes}
                    >
                      Clear notes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            {liveSupported ? (
              <Select value={language} onValueChange={(v) => v && setLanguage(v as LanguagePreference)}>
                <SelectTrigger className="h-8 w-32" aria-label="Live transcript language">
                  <Languages className="size-3.5 text-muted-foreground" aria-hidden />
                  {/* Base UI's Value renders the raw value ("si-LK") unless
                      given the label — same items-less pitfall fixed on the
                      Lead select in app-form-dialog.tsx. */}
                  <SelectValue>
                    {(value: LanguagePreference) =>
                      LANGUAGE_OPTIONS.find((opt) => opt.value === value)?.label ?? value
                    }
                  </SelectValue>
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
              <span className="font-mono">
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
              </span>
            </Button>
            {/* Offered only when shared audio is also being captured. On a
                mic-only recording, turning the mic off would leave the recorder
                writing silence — a stop button wearing a mute button's label,
                which is worse than not offering it at all. */}
            {captureMode !== 'mic' ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={toggleMic}
                aria-pressed={micOn}
              >
                {micOn ? <Mic /> : <MicOff />}
                {micOn ? 'Mic on' : 'Mic off'}
              </Button>
            ) : null}
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
            {/* Segment progress as chips rather than a run-on sentence of
                mono numbers: this reads as instrumentation either way, so it
                may as well be legible instrumentation. Failed segments are
                --warning, not --destructive: their audio is parked on this
                device and retryable (see the recovery panel below), so
                nothing has actually been lost. `tabular-nums` is dropped
                throughout — globals.css already applies it to .font-mono. */}
            <span className="flex flex-wrap items-center gap-1.5">
              <MetaChip>
                <span className="font-mono">{Math.floor(seconds / 60)}</span> min captured
              </MetaChip>
              {segments.length > 0 ? (
                <>
                  <MetaChip tone="success">
                    <span className="font-mono">{doneSegmentCount}</span> transcribed
                  </MetaChip>
                  {uploadingSegmentCount > 0 ? (
                    <MetaChip>
                      <span className="font-mono">{uploadingSegmentCount}</span> uploading
                    </MetaChip>
                  ) : null}
                  {failedSegments.length > 0 ? (
                    <MetaChip tone="warning">
                      <span className="font-mono">{failedSegments.length}</span> to retry
                    </MetaChip>
                  ) : null}
                </>
              ) : null}
            </span>
            {showLiveText && liveEngine === 'webspeech' ? (
              // Subtle, not a status announcement — which engine is currently
              // winning is a nicety to confirm bilingual mode is doing
              // something sensible, not worth interrupting a screen reader
              // for on every utterance. Web Speech only: the Gemini Live rung
              // transcribes both languages in one engine, and its own status
              // badge (in the live card) already says so.
              <span className="text-xs text-muted-foreground">
                {language === 'bilingual'
                  ? `Bilingual${currentLeadLang ? ` · ${ACTIVE_LANGUAGE_LABEL[currentLeadLang]}` : ''}`
                  : ACTIVE_LANGUAGE_LABEL[language]}
              </span>
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
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            Audio is processed by Google Gemini using your API key. Make sure attendees consent to
            recording.
          </p>
          {/* Now that live streaming is the default rung, its metered cost has
              to be disclosed BEFORE someone commits to a long recording —
              this notice was written for exactly that and had no call site
              while the feature was still opt-in. */}
          {isLiveTranscriptionEnabled() ? <LiveTranscriptionCostNotice /> : null}
        </div>
      ) : null}

      {/* The REASON survives even when there is nothing left to fall back to.
          "Live text stopped" alone says something broke but not whether it is
          worth acting on — a busy model is worth retrying, a key with no Live
          access never will be. Previously the reason was set and then hidden
          by the very branch that fired with it. */}
      {recording && liveUnavailable ? (
        <p className="text-xs text-muted-foreground">
          {fallbackNotice ?? 'Live text stopped'} — recording continues normally.
        </p>
      ) : null}
      {recording && !liveUnavailable && fallbackNotice ? (
        <p className="text-xs text-muted-foreground">{fallbackNotice}</p>
      ) : null}
      {recording && liveEngine === 'none' && !liveUnavailable ? (
        <p className="text-xs text-muted-foreground">
          No live transcript for this capture — recording still works; the write-up comes from the
          transcribed segments.
        </p>
      ) : null}

      {/* The live transcript is a first-class surface, not console output: its
          own titled card, so the difference between "committed text" and
          "the engine's provisional guess" is stated once in the header
          instead of being left for the reader to infer from italics. */}
      {showLiveText ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-b border-border bg-muted/40 px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <AudioLines className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              Live transcript
            </span>
            <span className="text-2xs text-muted-foreground">
              Click the text to fix a word — corrections feed the AI
            </span>
          </div>
          {liveEngine === 'gemini' ? (
            /* Honest engine status for the Live rung — 'Connected' vs
               'Live · Sinhala + English' is the distinction that keeps a
               connected-but-silent socket from masquerading as working
               transcription. The fallback notice renders above the card
               (shared with the Web Speech path), so it is not repeated here. */
            <div className="border-b border-border px-3 py-1.5">
              <LiveTranscriptionStatus
                status={geminiLive.status}
                notice={null}
                elapsedMs={seconds * 1000}
              />
            </div>
          ) : null}
          {/* The committed transcript is a TEXTAREA, not a read-only <p>:
              the words the engines heard are visible the moment they land,
              and a mis-heard name or Sinhala/English mix-up can be corrected
              right there, mid-meeting, by typing. Corrections matter twice —
              this text is the spelling hint each audio segment carries to
              Gemini (hintTail), and when no Gemini key exists it IS the
              meeting's saved transcript (the finalize fallback) — so a fix
              made here propagates everywhere downstream. New utterances
              APPEND to whatever the user has typed (acceptUtterance reads
              finalTranscriptRef, which onChange keeps in sync), and an
              append never moves the caret: the browser keeps a controlled
              textarea's selection stable when text is inserted after it. */}
          <textarea
            ref={transcriptPanelRef}
            onScroll={handleTranscriptScroll}
            value={finalText}
            onChange={(event) => {
              finalTranscriptRef.current = event.target.value
              setFinalText(event.target.value)
            }}
            placeholder="Listening…"
            aria-label="Live transcript — editable; corrections improve the AI notes"
            spellCheck={false}
            className={cn(
              bilingualText,
              'max-h-56 min-h-20 w-full resize-none whitespace-pre-wrap bg-transparent px-3 py-2.5 text-sm outline-none placeholder:italic placeholder:text-muted-foreground focus-visible:bg-muted/30',
            )}
          />
          {interimText ? (
            /* Provisional words stay OUTSIDE the editable text — they may
               still be revised or discarded by the engine, so letting them
               into the textarea would put words in the user's mouth that
               were never committed (and make edits race the recognizer).
               aria-live="off": this updates on every partial result, far too
               chatty for a screen reader; the committed text above is the
               readable record. */
            <p
              aria-live="off"
              className={cn(
                bilingualText,
                'border-t border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground italic',
              )}
            >
              {interimText}
            </p>
          ) : null}
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
          className="flex flex-col gap-2.5 overflow-hidden rounded-lg border border-warning/40 bg-warning/8"
          role="status"
        >
          {/* Was raw Tailwind amber — the one panel in the whole feature that
              was styled outside the token set, and the most consequential
              state in it ("audio recorded, not yet transcribed"). --warning
              exists for exactly this: attention, not failure. Nothing is lost
              here, which is why it is not --destructive. */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning/8 px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-warning">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
              {failedSegments.length > 0
                ? `${failedSegments.length} recording ${failedSegments.length === 1 ? 'segment' : 'segments'} still to transcribe`
                : 'Analysis needs another run'}
            </span>
            {!finalizing ? (
              <Button variant="outline" size="sm" type="button" onClick={runFinalize}>
                <Sparkles aria-hidden /> {finalizeError ? 'Retry analysis' : 'Analyze again'}
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" aria-hidden /> Writing up the minutes…
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 px-3 pb-3">
            {finalizeError ? (
              <p className="text-sm">
                {finalizeError} Your transcribed segments are saved — nothing was lost. Try again
                when you&rsquo;re ready.
              </p>
            ) : null}

            {failedSegments.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {failedSegments.map((segment) => (
                  <li
                    key={segment.index}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/25 bg-card px-2.5 py-2"
                  >
                    <span className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {/* No fixed "after N tries" claim: a permanent failure
                            (no Gemini key, oversized segment) stops after ONE
                            attempt by design — isRetriableSegmentError — so a
                            hardcoded count would simply be false there. */}
                        Segment <span className="font-mono">{segment.index + 1}</span> didn&rsquo;t
                        transcribe
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {segment.error ? `${segment.error}. ` : ''}Its audio (
                        <span className="font-mono">{formatBytes(segment.blob.size)}</span>) is saved
                        on this device
                        {segment.recovered ? ', recovered from an earlier session' : ''} and survives
                        a reload.
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
          </div>
        </div>
      ) : null}

      {open ? (
        <div
          id={panelId}
          className="flex flex-col gap-6 rounded-lg border border-border bg-muted/25 p-3 sm:p-4"
        >
          {loading ? (
            <IntelSkeleton />
          ) : loadError ? (
            /* Same shape as NoteTimeline's load failure — an inline message
               that says what went wrong, and a control that tries again. The
               old behaviour (a toast, then falling through to "No AI notes
               yet") reported a load failure as an empty meeting. */
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden /> {loadError}
              </p>
              <Button variant="outline" size="sm" type="button" onClick={loadIntelVisibly}>
                <RotateCcw aria-hidden /> Retry
              </Button>
            </div>
          ) : (
            <MeetingPanelsProvider people={attendees} currentUserId={currentUserId}>
              <PanelsLayout nav={<PanelNav items={panelNavItems} />}>
                <FilterBar kindTotals={kindTotals} />

                {/* The write-up leads: it is what someone opening a past meeting
                    came for. The full record (transcript, typed notes, the
                    composer) sits underneath it. */}
                {notes ? (
                  <MeetingAiNotes
                    notes={notes}
                    meetingId={meetingId}
                    meetingTitle={meetingTitle}
                    canManage={canRecord}
                    attendees={attendees}
                    appId={appId}
                    mentionUsers={mentionUsers}
                    suggestions={intel?.suggestions ?? []}
                    untrackedActions={intel?.untrackedActions ?? []}
                    onSuggestionsChanged={() => loadIntel('refresh')}
                  />
                ) : (
                  <MeetingNotesEmpty canRecord={canRecord}>
                    <p className="text-xs text-muted-foreground">
                      Gemini keys live in{' '}
                      <Link href="/profile#gemini" className="underline hover:text-foreground">
                        Profile → Gemini API keys
                      </Link>
                      .
                    </p>
                  </MeetingNotesEmpty>
                )}

                {/* One meeting covers every project its people work on — the
                    per-attendee walk-through (their apps, sprint counts, and
                    check-ins) loads its own board-derived data independently of
                    the transcript-bearing intel above (see meeting-prep.tsx). */}
                <AroundTheTablePanel meetingId={meetingId} currentUserId={currentUserId} />

                {unattributed.length > 0 ? (
                  <Panel id="needs-attribution" title="Needs attribution" icon={UserPlus} count={unattributed.length}>
                    <p className="text-xs text-muted-foreground">
                      Heard from someone the notes couldn&rsquo;t match to a person — pick who it&rsquo;s
                      for and it carries forward normally from here.
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {unattributed.map((item) => (
                        <UnattributedRow
                          key={item.id}
                          item={item}
                          people={attributionPeople}
                          canWrite={canRecord}
                          busy={busyAttributeId === item.id && attributePending}
                          onAttribute={(userId) => handleAttribute(item.id, userId)}
                        />
                      ))}
                    </ul>
                  </Panel>
                ) : null}

                <Panel
                  id="carried-forward"
                  title="Carried forward"
                  icon={KIND_META['carried-forward'].icon}
                  count={openCount > 0 ? openCount : undefined}
                  headerExtra={
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
                  }
                >
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
                    <ul className="flex flex-col gap-3">
                      {prep.map((group) => (
                        <li key={group.userId} className="flex flex-col gap-1.5">
                          <h5 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {group.person}
                          </h5>
                          <ul className="flex flex-col gap-1.5">
                            {group.items.map((item) => {
                              const openField =
                                composer?.id === item.id ? composer.field : null
                              return (
                                <FollowupRow
                                  key={item.id}
                                  item={item}
                                  person={group.person}
                                  now={now}
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
                                  onCloseStale={() => handleCloseStale(item.id)}
                                />
                              )
                            })}
                          </ul>
                          {group.overflowCount > 0 ? (
                            <p className="pl-1 text-2xs text-muted-foreground">
                              +<span className="font-mono tabular-nums">{group.overflowCount}</span>{' '}
                              more, oldest shown first
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {openCount === 0 ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CircleCheck className="size-3.5 shrink-0 text-success" aria-hidden />
                      Nothing open is carried in for this meeting&rsquo;s attendees.
                    </p>
                  ) : null}
                </Panel>

                {/* The full record last: the transcript, the typed notes and the
                    composer are the raw material the write-up above was made
                    from, so they read as the appendix rather than the headline —
                    collapsed by default for exactly that reason (see the spec). The
                    AI summary is passed down so the timeline does not repeat it —
                    it is already rendered above at full size. */}
                <Panel
                  id="record"
                  title="Record"
                  icon={NotebookPen}
                  headerExtra={
                    // Manual-override layer (a): only the meeting's
                    // creator/admin can even see this, same tier as the
                    // record controls above — setMeetingAutoAssignTasks
                    // re-checks it server-side regardless.
                    canRecord ? (
                      <label className="flex min-h-11 items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Sparkles className="size-3.5 shrink-0" aria-hidden />
                        Auto-assign tasks
                        <Switch
                          size="sm"
                          checked={autoAssignTasks}
                          disabled={autoAssignPending || !intel}
                          aria-label="Auto-assign tasks identified in this meeting"
                          onCheckedChange={handleToggleAutoAssign}
                        />
                      </label>
                    ) : undefined
                  }
                >
                  {canRecord ? (
                    <p className="text-2xs text-muted-foreground">
                      {autoAssignTasks
                        ? 'Confident, clearly-owned action items become real tasks automatically — everything else still needs a click.'
                        : 'Off — every identified task stays a suggestion card for you to review.'}
                    </p>
                  ) : null}
                  <NoteTimeline
                    meetingId={meetingId}
                    meetingTitle={meetingTitle}
                    canManage={canRecord}
                    attendees={attendees}
                    appId={appId}
                    mentionUsers={mentionUsers}
                    shownElsewhere={notes?.summary ?? null}
                    autoAssignCappedCount={notes?.autoAssignCappedCount ?? 0}
                    deadlines={notes?.deadlines ?? []}
                  />
                  {/* Only once there is a record to ask about — an assistant
                      offered over an empty meeting can only answer "that
                      wasn't discussed", which reads as broken. */}
                  {notes || (intel?.suggestions.length ?? 0) > 0 ? (
                    <MeetingAssistant meetingId={meetingId} />
                  ) : null}
                </Panel>
              </PanelsLayout>
            </MeetingPanelsProvider>
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The panel's loading state. A skeleton rather than the old one-line
 * "Fetching notes…" spinner because this surface has a known shape — a
 * heading, a paragraph of summary, a list of action rows — and a spinner in a
 * container that is about to be 400px tall tells the reader nothing about
 * what is coming or how long to wait for it.
 */
function IntelSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading notes">
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-3.5 w-full" />
        <SkeletonBlock className="h-3.5 w-11/12" />
        <SkeletonBlock className="h-3.5 w-3/5" />
      </div>
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-4 w-28" />
        <div className="flex flex-col divide-y divide-border rounded-lg border">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <SkeletonBlock className="h-3.5 w-1/2" />
              <SkeletonBlock className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const LINKED_TASK_STATUS_LABEL: Record<LinkedTaskView['status'], string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}
const LINKED_TASK_STATUS_TONE: Record<LinkedTaskView['status'], 'neutral' | 'active' | 'success'> = {
  todo: 'neutral',
  in_progress: 'active',
  done: 'success',
}

/**
 * What replaces the bare Resolve button once a follow-up is linked to a
 * task (see linkFollowupToTask / task-actions.ts's follow-up sync) — the
 * task and its live status, so it's visible that finishing the task is what
 * clears this row, not a click here.
 */
function LinkedTaskChip({ task }: { task: LinkedTaskView }) {
  const label = (
    <>
      <ListTodo className="size-3.5 shrink-0" aria-hidden />
      {task.title}
    </>
  )
  return (
    <span className="flex min-h-9 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {task.appSlug ? (
        <Link
          href={`/apps/${task.appSlug}`}
          className="flex items-center gap-1 underline decoration-border underline-offset-2 hover:text-foreground hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {label}
        </Link>
      ) : (
        <span className="flex items-center gap-1">{label}</span>
      )}
      <MetaChip tone={LINKED_TASK_STATUS_TONE[task.status]}>{LINKED_TASK_STATUS_LABEL[task.status]}</MetaChip>
    </span>
  )
}

/**
 * One unattributed item: the model heard a person and a commitment but
 * couldn't resolve the name to a user. A tiny, self-contained picker + one
 * button — the same "who it's for" Select the add-follow-up form uses, just
 * scoped to one row instead of a whole form, since attributing is the only
 * thing this control does.
 */
function UnattributedRow({
  item,
  people,
  canWrite,
  busy,
  onAttribute,
}: {
  item: UnattributedFollowupView
  people: FollowupPersonOption[]
  canWrite: boolean
  busy: boolean
  onAttribute: (userId: string) => void
}) {
  const [personId, setPersonId] = useState('')

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-warning/35 bg-warning/5 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex min-w-0 flex-1 items-start gap-2 text-sm">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <span className="min-w-0">
          <span className={bilingualText}>{item.text}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Heard as &ldquo;{item.personName}&rdquo;
          </span>
        </span>
      </span>
      {canWrite ? (
        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Select value={personId} onValueChange={(value) => setPersonId((value as string | null) ?? '')}>
            <SelectTrigger className="h-9 w-44" aria-label={`Who “${item.text}” is for`}>
              <SelectValue>
                {(value: string) => people.find((option) => option.id === value)?.name ?? 'Pick a person'}
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
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={busy || !personId}
            onClick={() => onAttribute(personId)}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            Attribute
          </Button>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Only the organizer or an admin can attribute this.</span>
      )}
    </li>
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
  now,
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
  onCloseStale,
}: {
  item: CarriedForwardItem
  person: string
  now: Date
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
  onCloseStale: () => void
}) {
  const isResolved = item.status === 'resolved'
  const stillOpenAndKept = keptOpen && !isResolved
  const fieldId = openField ? `followup-${openField}-${item.id}` : undefined
  const composerCopy = openField ? COMPOSER_COPY[openField] : null
  // How long this has been rolling forward. An item raised at yesterday's
  // meeting and one that has survived six weeks of meetings are not the same
  // situation, and the row used to render them identically.
  const age = followupAge(item.fromDate, now)
  const stale = !isResolved && age.tone === 'stale'

  return (
    <li
      className={cn(
        // Open vs resolved used to be bg-muted/20 against bg-muted/40 — a 20%
        // alpha step on the same fill, which is invisible in both themes.
        // Now the two states differ in border colour, fill, the leading icon
        // and a word.
        'flex flex-col gap-2 rounded-lg border px-2.5 py-2',
        isResolved && 'border-success/30 bg-success/5',
        !isResolved && !stale && 'border-warning/35 bg-warning/5',
        stale && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex min-w-0 flex-1 basis-56 items-start gap-2 text-sm">
          {isResolved ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          ) : (
            <Clock
              className={cn('mt-0.5 size-4 shrink-0', stale ? 'text-destructive' : 'text-warning')}
              aria-hidden
            />
          )}
          <span className="min-w-0">
            <span className={cn(bilingualText, isResolved && 'text-muted-foreground')}>
              {item.text}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              {isResolved ? (
                <MetaChip tone="success">Resolved</MetaChip>
              ) : (
                <>
                  {stale ? <MetaChip tone="danger">Stale</MetaChip> : null}
                  <MetaChip tone={stale ? 'danger' : 'warning'}>
                    {age.days === 0 ? (
                      'Raised today'
                    ) : (
                      <>
                        Open <span className="font-mono tabular-nums">{age.days}</span>{' '}
                        {age.days === 1 ? 'day' : 'days'}
                      </>
                    )}
                  </MetaChip>
                </>
              )}
              <span>
                from “{item.fromTitle}” ({format(item.fromDate, 'MMM d')})
                {/* Provenance worth knowing: a hand-added item is someone's
                    deliberate ask, not something the model heard. */}
                {item.createdBy ? ' · added by hand' : null}
              </span>
            </span>
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
                {item.linkedTask ? (
                  // The point of linking is that FINISHING the task clears
                  // this item — a bare Resolve button here would invite
                  // double bookkeeping (or worse, resolving by hand while
                  // the task stays open, un-linked from what actually
                  // happened). See task-actions.ts's follow-up sync.
                  <LinkedTaskChip task={item.linkedTask} />
                ) : (
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
                )}
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
                {stale ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={busy}
                    onClick={onCloseStale}
                  >
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : <TriangleAlert aria-hidden />}
                    Close as stale
                  </Button>
                ) : null}
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
          <p className={cn(bilingualText, 'min-w-0 flex-1 basis-56')}>
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
        <p className={cn(bilingualText, 'border-l-2 border-dashed border-border pl-2')}>
          <span className="text-muted-foreground">Why not yet: </span>
          {item.deferReason}
        </p>
      ) : null}

      {isResolved && item.resolutionNote ? (
        <p className={cn(bilingualText, 'border-l-2 border-success/50 pl-2')}>
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
