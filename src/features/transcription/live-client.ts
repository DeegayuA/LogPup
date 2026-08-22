// Browser-side Gemini Live transcription session.
//
// Framework-agnostic on purpose: no React in here, so the socket/audio state
// machine can be reasoned about (and driven from a test harness) without a
// render tree. The React binding lives in components/use-live-transcription.ts.

import { backoffDelayMs } from '@/features/gemini/retry'
import { AUDIO_MIME_TYPE, encodeAudioChunk } from './pcm'
import {
  type LiveServerEvent,
  buildAudioMessage,
  buildSetupMessage,
  liveSocketUrl,
  parseServerEvent,
} from './live-protocol'
import {
  EMPTY_TRANSCRIPT,
  type TranscriptState,
  appendFragment,
  commitTurn,
} from './transcript-buffer'
import { type AutoStopReason, autoStopReason } from './session-budget'

/**
 * Session status, deliberately distinguishing "connected" from "actually
 * producing transcription".
 *
 * `listening` means the socket is up but no transcript has ever arrived. The UI
 * must not claim live bilingual transcription in that state — silently showing
 * a connected-but-dead engine is precisely the failure that hid the previous
 * dual-recognizer bug for so long.
 */
export type LiveStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'live'
  | 'reconnecting'
  | 'failed'
  | 'stopped'

export type LiveCallbacks = {
  onTranscript?: (state: TranscriptState) => void
  onStatusChange?: (status: LiveStatus) => void
  /** Terminal failure — caller should fall back and tell the user. */
  onFailure?: (message: string) => void
  onAutoStop?: (reason: AutoStopReason) => void
}

export type LiveSessionOptions = {
  /**
   * An already-open microphone stream. The session deliberately does NOT call
   * getUserMedia itself: the recorder already holds a mic stream, and opening a
   * second one would show a second permission prompt and, on some browsers,
   * fail outright.
   */
  stream: MediaStream
  /**
   * Mints a fresh single-use token. Called once per connection attempt, with
   * the resumption handle this connection will present (null on first connect)
   * so the token's pinned setup matches the setup frame exactly.
   */
  requestToken: (resumptionHandle: string | null) => Promise<{ token: string; model: string }>
  callbacks?: LiveCallbacks
  /** Samples per audio callback. 4096 ≈ 85ms at 48kHz — a good latency/CPU balance. */
  bufferSize?: number
  maxReconnectAttempts?: number
  now?: () => number
}

/** Give up after this many consecutive failed connection attempts. */
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 4

export class LiveTranscriptionSession {
  private readonly opts: LiveSessionOptions
  private readonly now: () => number

  private socket: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processorNode: ScriptProcessorNode | null = null

  private transcript: TranscriptState = EMPTY_TRANSCRIPT
  private statusValue: LiveStatus = 'idle'
  private resumptionHandle: string | null = null

  private startedAt = 0
  private lastTranscriptAt = 0
  private reconnectAttempts = 0
  private watchdog: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  /** Set once stop() is called, so late async callbacks can't resurrect the session. */
  private stopped = false

  constructor(opts: LiveSessionOptions) {
    this.opts = opts
    this.now = opts.now ?? Date.now
  }

  get status(): LiveStatus {
    return this.statusValue
  }

  get transcriptState(): TranscriptState {
    return this.transcript
  }

  /** Whether any transcription has actually been produced on this session. */
  get hasTranscribed(): boolean {
    return this.transcript.committed.length > 0 || this.transcript.interim.length > 0
  }

  async start(): Promise<void> {
    if (this.stopped) return
    this.startedAt = this.now()
    this.lastTranscriptAt = this.now()
    this.startWatchdog()
    await this.connect()
  }

  /**
   * Tears everything down. Safe to call repeatedly and from any state — it is
   * wired to component unmount, an explicit stop button, and the auto-stop
   * paths, all of which can race.
   */
  stop(reasonStatus: LiveStatus = 'stopped'): void {
    this.stopped = true
    // Commit whatever the last turn had in flight BEFORE tearing down: the
    // consumer's durable transcript is built from committed text, so the
    // final sentence of a meeting would otherwise be dropped at the exact
    // moment someone presses Stop.
    if (this.transcript.interim.trim().length > 0) {
      this.transcript = commitTurn(this.transcript)
      this.opts.callbacks?.onTranscript?.(this.transcript)
    }
    this.clearTimers()
    this.teardownAudio()
    this.teardownSocket()
    this.setStatus(reasonStatus)
  }

  // ---------------------------------------------------------------- socket

  private async connect(): Promise<void> {
    if (this.stopped) return
    this.setStatus(this.reconnectAttempts === 0 ? 'connecting' : 'reconnecting')

    let minted: { token: string; model: string }
    try {
      minted = await this.opts.requestToken(this.resumptionHandle)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not get a Live token'
      // Fail STRAIGHT to the caller's fallback rather than through the
      // reconnect schedule. Minting already retries server-side (mintLiveToken
      // walks every key and every model, with the project's own backoff), so
      // an error arriving here has survived that — retrying it four more times
      // out here just spends a minute of the meeting on dead air before the
      // Web Speech fallback is allowed to start. Socket-level failures still
      // reconnect; those are the expected ~10-minute lifetime drops.
      this.fail(message)
      return
    }
    if (this.stopped) return

    let socket: WebSocket
    try {
      socket = new WebSocket(liveSocketUrl(minted.token))
    } catch {
      this.handleConnectionFailure('Could not open the Gemini Live connection')
      return
    }
    this.socket = socket

    socket.onopen = () => {
      socket.send(
        JSON.stringify(
          buildSetupMessage({
            model: minted.model,
            resumptionHandle: this.resumptionHandle,
          }),
        ),
      )
    }

    socket.onmessage = (event) => {
      void this.handleRawMessage(event.data)
    }

    socket.onerror = () => {
      // A WebSocket 'error' is always followed by 'close'; reconnect logic lives
      // there so a single failure isn't counted twice.
    }

    socket.onclose = () => {
      if (this.stopped) return
      this.teardownAudio()
      // An unexpected close mid-recording is normal — Live caps a connection at
      // ~10 minutes. Reconnecting with the resumption handle is the designed
      // path, not error recovery.
      this.scheduleReconnect()
    }
  }

  /**
   * Server frames arrive as strings in most browsers, but as Blob in some
   * (and ArrayBuffer under a few polyfills), so normalise before parsing.
   */
  private async handleRawMessage(data: unknown): Promise<void> {
    let text: string
    if (typeof data === 'string') {
      text = data
    } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
      text = await data.text()
    } else if (data instanceof ArrayBuffer) {
      text = new TextDecoder().decode(data)
    } else {
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return // a frame we can't read is not worth killing a recording over
    }

    this.handleEvent(parseServerEvent(parsed))
  }

  private handleEvent(event: LiveServerEvent): void {
    switch (event.type) {
      case 'setupComplete':
        this.reconnectAttempts = 0
        this.startAudio()
        // Not 'live' yet — nothing has been transcribed, so saying "live" here
        // would be a claim we haven't earned.
        this.setStatus('listening')
        break

      case 'transcript':
        this.lastTranscriptAt = this.now()
        this.transcript = appendFragment(this.transcript, event.text)
        // A frame that both delivers text and closes the turn must do both,
        // or the turn stays in flight forever and nothing is ever committed.
        if (event.endsTurn) this.transcript = commitTurn(this.transcript)
        this.opts.callbacks?.onTranscript?.(this.transcript)
        this.setStatus('live')
        break

      case 'turnComplete':
        this.transcript = commitTurn(this.transcript)
        this.opts.callbacks?.onTranscript?.(this.transcript)
        break

      case 'resumption':
        if (event.handle) this.resumptionHandle = event.handle
        break

      case 'goAway':
        // The server is about to close. Reconnect proactively so there is no
        // silent gap in the transcript; onclose would otherwise handle it, but
        // later and with audio still being fed to a dying socket.
        this.teardownSocket()
        this.scheduleReconnect()
        break

      case 'unknown':
        break
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return

    this.reconnectAttempts += 1
    const max = this.opts.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS
    if (this.reconnectAttempts > max) {
      this.fail('Live transcription kept dropping — falling back. Recording continues.')
      return
    }

    this.setStatus('reconnecting')
    // Reuses the project's shared backoff policy (jittered exponential) rather
    // than inventing a second schedule.
    const delay = backoffDelayMs(this.reconnectAttempts, null)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, delay)
  }

  private handleConnectionFailure(message: string): void {
    const max = this.opts.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS
    if (this.reconnectAttempts >= max) {
      this.fail(message)
      return
    }
    this.scheduleReconnect()
  }

  private fail(message: string): void {
    this.stop('failed')
    this.opts.callbacks?.onFailure?.(message)
  }

  private teardownSocket(): void {
    const socket = this.socket
    this.socket = null
    if (!socket) return
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      try {
        socket.close()
      } catch {
        // already closing — nothing to do
      }
    }
  }

  // ----------------------------------------------------------------- audio

  /**
   * Starts pumping microphone audio to the socket.
   *
   * Uses ScriptProcessorNode rather than AudioWorklet deliberately. AudioWorklet
   * is the modern API, but it requires loading a separate module file, which
   * means either a public asset or a blob: URL — and a blob: worklet is exactly
   * the kind of thing a strict CSP blocks. ScriptProcessorNode is deprecated but
   * universally supported including iOS Safari, needs no extra file, and the
   * workload here (mono, downmixed to 16kHz) is far too small for main-thread
   * cost to matter. Revisit if a worklet asset becomes cheap to ship.
   */
  private startAudio(): void {
    if (this.audioContext || this.stopped) return

    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) {
      this.fail('This browser has no Web Audio support — live transcription is unavailable.')
      return
    }

    const context = new AudioContextCtor()
    this.audioContext = context
    // Safari starts contexts suspended unless resumed inside a user gesture; the
    // recording button is the gesture, but resume() is idempotent and cheap.
    void context.resume().catch(() => undefined)

    const source = context.createMediaStreamSource(this.opts.stream)
    const processor = context.createScriptProcessor(this.opts.bufferSize ?? 4096, 1, 1)
    this.sourceNode = source
    this.processorNode = processor

    processor.onaudioprocess = (event) => {
      const socket = this.socket
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      const input = event.inputBuffer.getChannelData(0)
      const encoded = encodeAudioChunk(input, context.sampleRate)
      try {
        socket.send(JSON.stringify(buildAudioMessage(encoded, AUDIO_MIME_TYPE)))
      } catch {
        // Socket died between the readyState check and send — onclose will
        // handle reconnection; dropping this chunk is correct.
      }
    }

    source.connect(processor)
    // A ScriptProcessorNode only fires onaudioprocess while connected to the
    // graph's destination. Routing it straight to the speakers would echo the
    // meeting back into the room, so it terminates at a muted gain node.
    const mute = context.createGain()
    mute.gain.value = 0
    processor.connect(mute)
    mute.connect(context.destination)
  }

  private teardownAudio(): void {
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null
      try {
        this.processorNode.disconnect()
      } catch {
        /* already disconnected */
      }
      this.processorNode = null
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect()
      } catch {
        /* already disconnected */
      }
      this.sourceNode = null
    }
    if (this.audioContext) {
      // Note: the MediaStream itself is owned by the caller and deliberately
      // left running — the recorder is still using it.
      void this.audioContext.close().catch(() => undefined)
      this.audioContext = null
    }
  }

  // -------------------------------------------------------------- watchdog

  /**
   * Enforces the runaway-session guards once a second: the hard duration cap and
   * the silence timeout that catches a meeting nobody stopped.
   */
  private startWatchdog(): void {
    if (this.watchdog) return
    this.watchdog = setInterval(() => {
      if (this.stopped) return
      const reason = autoStopReason({
        elapsedMs: this.now() - this.startedAt,
        msSinceLastTranscript: this.now() - this.lastTranscriptAt,
      })
      if (reason) {
        this.stop('stopped')
        this.opts.callbacks?.onAutoStop?.(reason)
      }
    }, 1000)
  }

  private clearTimers(): void {
    if (this.watchdog) {
      clearInterval(this.watchdog)
      this.watchdog = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setStatus(next: LiveStatus): void {
    if (this.statusValue === next) return
    this.statusValue = next
    this.opts.callbacks?.onStatusChange?.(next)
  }
}
