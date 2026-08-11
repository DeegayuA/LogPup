'use client'

import { AlertTriangle, Loader2, Radio, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { type LiveStatus } from '../live-client'
import {
  MAX_SESSION_MS,
  estimateCostUsd,
  formatCostEstimate,
  formatDuration,
} from '../session-budget'

/**
 * Honest, one-glance status for the Gemini Live path.
 *
 * The wording is the point. Each state says exactly what is true — in
 * particular `listening` says "connected, nothing heard yet" rather than
 * claiming bilingual transcription is running, because a connected-but-silent
 * engine looking identical to a working one is what let the previous
 * dual-recognizer bug go unnoticed.
 */
const STATUS_COPY: Record<LiveStatus, { label: string; detail: string } | null> = {
  idle: null,
  stopped: null,
  connecting: { label: 'Connecting', detail: 'Opening the Gemini Live connection…' },
  listening: {
    label: 'Connected',
    detail: 'Connected — nothing transcribed yet. Speak to check it is hearing you.',
  },
  live: { label: 'Live · Sinhala + English', detail: 'Transcribing as you speak.' },
  reconnecting: {
    label: 'Reconnecting',
    detail: 'Live transcription dropped and is reconnecting. Recording is unaffected.',
  },
  failed: {
    label: 'Not running',
    detail: 'Live transcription is not running. Recording is unaffected.',
  },
}

export function LiveTranscriptionStatus({
  status,
  notice,
  elapsedMs,
}: {
  status: LiveStatus
  /** Degradation message from the hook. Always rendered when present. */
  notice: string | null
  elapsedMs: number
}) {
  const copy = STATUS_COPY[status]
  if (!copy && !notice) return null

  const isDegraded = status === 'failed' || status === 'reconnecting'

  return (
    <div className="flex flex-col gap-1.5">
      {copy ? (
        <div className="flex items-center gap-2">
          <Badge variant={isDegraded ? 'outline' : 'secondary'} className="gap-1.5">
            <StatusIcon status={status} />
            {copy.label}
          </Badge>
          {status === 'live' ? (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatDuration(elapsedMs)}
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">{copy.detail}</span>
        </div>
      ) : null}

      {notice ? (
        // Persistent, not a toast: a silently-degraded transcript is exactly the
        // failure mode this feature exists to avoid, so the explanation has to
        // stay on screen for as long as the condition holds.
        <p
          role="status"
          className="flex items-start gap-1.5 text-xs text-muted-foreground"
        >
          {/* Ember (chart-1) is the design system's reserved attention colour. */}
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-chart-1" />
          <span>{notice}</span>
        </p>
      ) : null}
    </div>
  )
}

function StatusIcon({ status }: { status: LiveStatus }) {
  if (status === 'connecting' || status === 'reconnecting') {
    return <Loader2 aria-hidden className="size-3 animate-spin" />
  }
  if (status === 'failed') return <WifiOff aria-hidden className="size-3" />
  return <Radio aria-hidden className="size-3" />
}

/**
 * Pre-recording cost disclosure.
 *
 * Shown before the user commits to a long recording, per the requirement that
 * metered usage be surfaced honestly up front. It deliberately leads with quota
 * rather than dollars: these are free-tier keys, so the thing the user actually
 * risks spending is their daily Gemini allowance — which every other AI feature
 * in LogPup shares.
 */
export function LiveTranscriptionCostNotice({ className }: { className?: string }) {
  const hourEstimate = formatCostEstimate(estimateCostUsd(3600))

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">
        Live bilingual transcription streams your microphone to Gemini for the whole
        recording. It uses your own Gemini key&apos;s quota continuously — about{' '}
        <span className="font-mono tabular-nums">90,000</span> audio tokens per hour
        (roughly {hourEstimate}/hour if the key were on a paid plan). It stops
        automatically after {formatDuration(MAX_SESSION_MS)} or 5 minutes of silence, so
        a forgotten tab can&apos;t keep streaming.
      </p>
    </div>
  )
}
