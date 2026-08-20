'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Flame,
  Globe2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const STUDIO_GEMINI_MODELS = [
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    tag: 'Primary Pinned Default',
    role: 'Live WebSocket & Transcription',
    context: '1M Tokens',
    speed: '~180 t/s',
    highlight: 'Real-time WebSocket audio streaming & work log backfill',
    badgeColor: 'bg-primary/20 text-primary border-primary/30',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    tag: 'Flagship Speed',
    role: 'Sub-second Intent & Analysis',
    context: '1M Tokens',
    speed: '~220 t/s',
    highlight: 'High-velocity reasoning & multi-speaker separation',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    tag: 'Deep Synthesis Tier',
    role: 'Meeting Minutes & Screen OCR',
    context: '2M Tokens',
    speed: '~65 t/s',
    highlight: '24 FPS keyframes, action item extraction & architecture logic',
    badgeColor: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    tag: 'Ultra-Fast Mechanical',
    role: 'Repo READMEs & Quick Drafts',
    context: '1M Tokens',
    speed: '~260 t/s',
    highlight: 'Zero-latency titles, summaries & lightweight mechanical text',
    badgeColor: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  },
  {
    id: 'gemini-3.1-flash-tts-preview',
    name: 'Gemini 3.1 TTS',
    tag: 'Voice Synthesis',
    role: '24kHz Studio Speech',
    context: 'Audio Modality',
    speed: 'Live Voice',
    highlight: 'Native spoken responses with fixed studio voice (Kore)',
    badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    tag: 'Bilingual Engine',
    role: 'Sinhala + English OCR',
    context: '2M Tokens',
    speed: '~60 t/s',
    highlight: 'Dual-language English & Sinhala (සිංහල) extraction with zero audio storage',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
] as const

export function OpsMetricsStrip() {
  const [selectedModelIdx, setSelectedModelIdx] = useState(0)
  const [isAutoCycling, setIsAutoCycling] = useState(true)

  useEffect(() => {
    if (!isAutoCycling) return
    const interval = setInterval(() => {
      setSelectedModelIdx((prev) => (prev + 1) % STUDIO_GEMINI_MODELS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [isAutoCycling])

  const activeModel = STUDIO_GEMINI_MODELS[selectedModelIdx]

  return (
    <section className="mt-14 flex flex-col gap-3">
      {/* 4 Interactive Glassmorphic Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Sri Lanka Calendar Engine */}
        <div className="group relative flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:bg-card hover:shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Globe2 className="size-3.5 text-primary" />
              LK Gazette Engine
            </span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
              2026 Sync
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-3.5xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              100%
            </span>
            <span className="font-heading text-xs font-bold text-foreground">
              Sri Lanka Calendar Aware
            </span>
            <p className="text-2xs text-muted-foreground leading-relaxed">
              Full Moon Poya days &amp; Mercantile holidays count as 0% rest. Saturdays are standard 50% half-days.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5">
            <span className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[9px] font-medium text-muted-foreground">
              Poya 0%
            </span>
            <span className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[9px] font-medium text-muted-foreground">
              Sat 50% (4h)
            </span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary">
              Shop &amp; Office Law
            </span>
          </div>
        </div>

        {/* 2. Gemini Multi-Model Intelligence (Interactive) */}
        <div
          onMouseEnter={() => setIsAutoCycling(false)}
          onMouseLeave={() => setIsAutoCycling(true)}
          className="group relative flex flex-col justify-between gap-3 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card/70 to-card/50 p-5 shadow-xs backdrop-blur-md transition-all duration-300 hover:border-primary hover:shadow-primary/10 hover:shadow-xl sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              Gemini Studio AI
            </span>
            {/* Quick model pagination dots */}
            <div className="flex items-center gap-1">
              {STUDIO_GEMINI_MODELS.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedModelIdx(idx)
                    setIsAutoCycling(false)
                  }}
                  className={cn(
                    'size-2 rounded-full transition-all cursor-pointer',
                    idx === selectedModelIdx ? 'bg-primary ring-2 ring-primary/40 w-3.5' : 'bg-muted-foreground/30 hover:bg-muted-foreground/60',
                  )}
                  title={`Switch to ${m.name} (${m.tag})`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
                {activeModel.name}
              </span>
              <span className={cn('rounded border px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase', activeModel.badgeColor)}>
                {activeModel.tag}
              </span>
            </div>
            <span className="font-heading text-xs font-bold text-foreground">
              Bilingual Audio &amp; Screen Intel
            </span>
            <p className="text-2xs text-muted-foreground leading-relaxed line-clamp-2">
              {activeModel.highlight}.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-2xs">
            <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="size-3 text-primary" />
              {activeModel.role}
            </span>
            <span className="font-mono text-[10px] font-semibold text-primary">
              {activeModel.speed}
            </span>
          </div>
        </div>

        {/* 3. Burnout Threshold Radar */}
        <div className="group relative flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-md transition-all duration-300 hover:border-chart-1/50 hover:bg-card hover:shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-chart-1 flex items-center gap-1.5">
              <Flame className="size-3.5 text-chart-1" />
              Capacity Radar
            </span>
            <span className="rounded-full border border-chart-1/30 bg-chart-1/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-chart-1">
              Live Alert
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-3.5xl font-extrabold tracking-tight text-chart-1 sm:text-4xl">
              80% &rarr; 100%
            </span>
            <span className="font-heading text-xs font-bold text-foreground">
              Burnout Threshold Radar
            </span>
            <p className="text-2xs text-muted-foreground leading-relaxed">
              Turns amber at 80% allocation and isolates red overflow at &gt;100% across all studio projects.
            </p>
          </div>

          {/* Micro Capacity Visual */}
          <div className="flex flex-col gap-1 border-t border-border/50 pt-2.5">
            <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary rounded-full" style={{ width: '65%' }} />
              <div className="h-full bg-chart-1 rounded-full" style={{ width: '20%' }} />
              <div className="h-full bg-destructive rounded-full" style={{ width: '15%' }} />
            </div>
            <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
              <span>Safe 0-79%</span>
              <span className="text-chart-1 font-semibold">Amber 80%</span>
              <span className="text-destructive font-semibold">Over 100%</span>
            </div>
          </div>
        </div>

        {/* 4. Zero Micromanagement */}
        <div className="group relative flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:bg-card hover:shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-primary" />
              Engineers First
            </span>
            <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              Zero Spyware
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-3.5xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              0
            </span>
            <span className="font-heading text-xs font-bold text-foreground">
              Micromanagement &amp; Timesheets
            </span>
            <p className="text-2xs text-muted-foreground leading-relaxed">
              No keystroke logging, time tracking, or fabricated hourly billing. Pure self-scored daily outcome logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5">
            <span className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary">
              <CheckCircle2 className="size-2.5" /> Self-Scored
            </span>
            <span className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] font-medium text-muted-foreground">
              <CheckCircle2 className="size-2.5" /> Private Notes
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
