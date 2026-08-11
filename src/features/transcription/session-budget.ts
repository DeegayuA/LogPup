// Cost/quota estimation and the automatic stop rules for a live session.
//
// Live transcription bills continuously for as long as the socket is open, so a
// forgotten browser tab is a real way to burn a user's quota (or, on a paid key,
// their money) with nobody in the room. Everything here is pure so the stop
// rules can be tested without waiting in real time.

/**
 * Audio input token rate, from Google's published pricing: "25 tokens per
 * second of audio". This is the one number the whole cost estimate rests on.
 */
export const AUDIO_TOKENS_PER_SECOND = 25

/**
 * Indicative paid-tier price per 1M audio input tokens for the Live model
 * (published as $3.00, equivalently ~$0.005/min).
 *
 * Only ever used to show an order-of-magnitude estimate. Users here are on
 * free-tier keys where the real constraint is quota, not dollars — so the UI
 * must present this as "if this key were billed", never as an invoice.
 */
export const LIVE_AUDIO_USD_PER_MILLION_TOKENS = 3.0

/** Hard ceiling on a single recording. Reached = stop, unconditionally. */
export const MAX_SESSION_MS = 60 * 60 * 1000

/**
 * Stop after this much continuous silence. This is the forgotten-tab guard: a
 * meeting that ended without anyone pressing stop produces no transcription
 * frames, so silence is the signal that nobody is there.
 */
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000

/** Warn the user this long before the hard cap, so a stop isn't a surprise. */
export const APPROACHING_CAP_MS = 5 * 60 * 1000

export type AutoStopReason = 'max-duration' | 'idle'

export type AutoStopInput = {
  elapsedMs: number
  /** Time since the last transcription fragment arrived. */
  msSinceLastTranscript: number
  maxSessionMs?: number
  idleTimeoutMs?: number
}

/**
 * Whether the session should stop on its own, and why. `null` means keep going.
 *
 * Duration is checked before idleness so a session that trips both reports the
 * ceiling — the more accurate explanation for the user.
 */
export function autoStopReason({
  elapsedMs,
  msSinceLastTranscript,
  maxSessionMs = MAX_SESSION_MS,
  idleTimeoutMs = IDLE_TIMEOUT_MS,
}: AutoStopInput): AutoStopReason | null {
  if (elapsedMs >= maxSessionMs) return 'max-duration'
  if (msSinceLastTranscript >= idleTimeoutMs) return 'idle'
  return null
}

/** Whether to surface the "approaching the cap" warning. */
export function isApproachingCap(elapsedMs: number, maxSessionMs: number = MAX_SESSION_MS): boolean {
  return elapsedMs >= maxSessionMs - APPROACHING_CAP_MS && elapsedMs < maxSessionMs
}

/** Audio input tokens for a given number of seconds of audio. */
export function estimateAudioTokens(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.round(seconds * AUDIO_TOKENS_PER_SECOND)
}

/** Indicative paid-tier cost in USD for a given number of seconds of audio. */
export function estimateCostUsd(
  seconds: number,
  usdPerMillionTokens: number = LIVE_AUDIO_USD_PER_MILLION_TOKENS,
): number {
  return (estimateAudioTokens(seconds) / 1_000_000) * usdPerMillionTokens
}

/**
 * Formats an indicative cost for display.
 *
 * Sub-cent amounts render as "<$0.01" rather than "$0.00": a rounded-to-zero
 * price reads as "this is free", which would be a dishonest thing to tell
 * someone about to start a metered recording.
 */
export function formatCostEstimate(usd: number): string {
  if (usd <= 0) return '$0.00'
  if (usd < 0.01) return '<$0.01'
  return `$${usd.toFixed(2)}`
}

/** `mm:ss`, or `h:mm:ss` past an hour. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
