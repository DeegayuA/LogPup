'use client'

import { useState, type ReactNode } from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  Globe,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { CapacityBar, capacityBand } from '@/features/people/components/capacity-bar'
import { bilingualText } from '@/features/meetings/components/meeting-chips'
import { cn } from '@/lib/utils'

const AS_OF = '12 Aug 2026'

const APP_RULE = {
  kestrel: 'border-l-event-1',
  apollo: 'border-l-event-3',
  tessera: 'border-l-event-5',
} as const

const APP_INK = {
  kestrel: 'text-event-1',
  apollo: 'text-event-3',
  tessera: 'text-event-5',
} as const

type AppKey = keyof typeof APP_RULE

const APP_LABEL: Record<AppKey, string> = {
  kestrel: 'Kestrel',
  apollo: 'Apollo',
  tessera: 'Tessera',
}

type CaptionSide = 'start' | 'end' | 'below'

const BODY_PLACEMENT: Record<CaptionSide, string> = {
  start: 'lg:col-span-10 lg:col-start-3 lg:row-start-1',
  end: 'lg:col-span-10 lg:col-start-1 lg:row-start-1',
  below: 'lg:col-span-12 lg:col-start-1 lg:row-start-1',
}

const CAPTION_PLACEMENT: Record<CaptionSide, string> = {
  start: 'mt-3 lg:mt-0 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:pt-7',
  end: 'mt-3 lg:mt-0 lg:col-span-2 lg:col-start-11 lg:row-start-1 lg:pt-7',
  below: 'mt-3 lg:col-span-12 lg:col-start-1 lg:row-start-2',
}

function Plate({
  label,
  caption,
  captionSide,
  children,
}: {
  label: string
  caption: ReactNode
  captionSide: CaptionSide
  children: ReactNode
}) {
  return (
    <figure data-reveal className="lg:grid lg:grid-cols-12 lg:gap-x-6">
      <div className={cn('flex flex-col gap-3', BODY_PLACEMENT[captionSide])}>
        <div className="flex items-center justify-between">
          <span className="font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">
            {label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-medium text-primary">
            <Sparkles className="size-2.5" /> Interactive Sandbox
          </span>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm md:p-6 lg:p-8">
          {children}
        </div>
      </div>
      <figcaption className={cn('text-2xs text-muted-foreground', CAPTION_PLACEMENT[captionSide])}>
        {caption}
      </figcaption>
    </figure>
  )
}

function BandBadge({ pct }: { pct: number }) {
  const band = capacityBand(pct)
  if (band === 'over') return <Badge variant="destructive">Over capacity</Badge>
  if (band === 'near') {
    return (
      <Badge variant="outline" className="border-chart-1 text-foreground">
        Near capacity
      </Badge>
    )
  }
  return null
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/* ========================================================================= */
/* --- PLATE I: THE INTERACTIVE BRIEFING                                     */
/* ========================================================================= */

interface BriefingStatItem {
  id: string
  label: string
  value: number
  meta: string
  alert: boolean
  detail: string
}

const INITIAL_BRIEFING_STATS: BriefingStatItem[] = [
  { id: 'due', label: 'Due soon', value: 4, meta: 'today & this week', alert: false, detail: '4 tasks due before Friday sprint review across Kestrel & Apollo.' },
  { id: 'overdue', label: 'Overdue', value: 1, meta: 'oldest 2 days late', alert: true, detail: 'Drizzle ORM zero-downtime rollback test on Kestrel is 2 days overdue.' },
  { id: 'i-owe', label: 'I owe', value: 2, meta: 'follow-ups open', alert: false, detail: '2 action items assigned to you from yesterday’s Apollo client review.' },
  { id: 'meetings', label: 'Meetings today', value: 3, meta: 'on the calendar', alert: false, detail: '3 Google Calendar meetings synced with Gemini 2.5 transcript buffer.' },
]

export function PlateBriefing() {
  const [selectedStat, setSelectedStat] = useState<string>('overdue')
  const [meetingRsvps, setMeetingRsvps] = useState<Record<string, 'yes' | 'no'>>({
    '09:30': 'yes',
    '11:00': 'yes',
    '15:30': 'yes',
  })
  const [selectedEngineer, setSelectedEngineer] = useState<string | null>('Nuwan Perera')

  const teamCapacities = [
    { name: 'Nuwan Perera', pct: 112, role: 'Lead Architect', apps: 'Kestrel (70%), Apollo (42%)' },
    { name: 'Ishara Fernando', pct: 86, role: 'Senior Engineer', apps: 'Kestrel (46%), Tessera (40%)' },
    { name: 'Dilini Jayasuriya', pct: 65, role: 'Product Designer', apps: 'Tessera (65%)' },
    { name: 'Kasun Silva', pct: 40, role: 'Backend Engineer', apps: 'Apollo (40%)' },
  ]

  const meetings = [
    { time: '09:30', app: 'kestrel' as AppKey, title: 'Sprint 14 check-in', duration: '30 min', attendees: '4 engineers' },
    { time: '11:00', app: 'apollo' as AppKey, title: 'Client architecture review', duration: '45 min', attendees: '6 participants' },
    { time: '15:30', app: 'tessera' as AppKey, title: 'Design system walkthrough', duration: '30 min', attendees: 'Dilini & Nuwan' },
  ]

  const activeStat = INITIAL_BRIEFING_STATS.find((s) => s.id === selectedStat)

  return (
    <Plate
      label="Plate I"
      captionSide="start"
      caption="— Plate I. Interactive morning briefing surface. Click stat tiles, teammate rows, or RSVP to live calendar meetings."
    >
      {/* 4 Interactive Stat Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {INITIAL_BRIEFING_STATS.map((stat) => {
          const isSelected = selectedStat === stat.id
          return (
            <button
              key={stat.id}
              type="button"
              onClick={() => setSelectedStat(stat.id)}
              className={cn(
                'flex flex-col gap-0.5 rounded-xl border p-3.5 text-left transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isSelected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary shadow-sm'
                  : 'border-border/70 bg-card/60 hover:border-primary/40 hover:bg-card',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'font-mono text-xl font-bold tabular-nums',
                    stat.alert ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {stat.value}
                </span>
                {isSelected && (
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              <span className="text-xs font-semibold text-foreground">{stat.label}</span>
              <span className="text-2xs text-muted-foreground">{stat.meta}</span>
            </button>
          )
        })}
      </div>

      {/* Dynamic Detail Alert Bar */}
      {activeStat && (
        <div className="mt-3.5 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xs font-bold text-primary uppercase">
              {activeStat.label}:
            </span>
            <span className="text-muted-foreground">{activeStat.detail}</span>
          </div>
          <span className="font-mono text-2xs text-primary font-medium">Click to inspect &rarr;</span>
        </div>
      )}

      {/* 2 Bottom Panels: Team Capacity & Today's Calendar */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Team Capacity List */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Team Capacity Baselines
            </span>
            <span className="font-mono text-2xs text-muted-foreground">4 Active Engineers</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {teamCapacities.map((row) => {
              const isSelected = selectedEngineer === row.name
              return (
                <div
                  key={row.name}
                  onClick={() => setSelectedEngineer(isSelected ? null : row.name)}
                  className={cn(
                    'flex flex-col gap-1.5 rounded-lg border p-2.5 transition-all cursor-pointer',
                    isSelected
                      ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border/40 bg-card/40 hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{row.name}</span>
                      <span className="text-2xs text-muted-foreground">({row.role})</span>
                    </div>
                    <BandBadge pct={row.pct} />
                  </div>
                  <div className="flex items-center gap-2">
                    <CapacityBar totalPct={row.pct} />
                  </div>
                  {isSelected && (
                    <div className="mt-1 flex items-center justify-between border-t border-border/40 pt-1.5 text-2xs text-muted-foreground">
                      <span>Allocations: <strong className="text-foreground">{row.apps}</strong></span>
                      <span className="font-mono text-primary">Active</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Today's Meetings List */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Today&apos;s Meeting Calendar
            </span>
            <span className="font-mono text-2xs text-primary">Google Calendar Synced</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {meetings.map((meeting) => {
              const rsvp = meetingRsvps[meeting.time]
              return (
                <div
                  key={meeting.time}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border-l-3 bg-card/50 p-3 transition-all',
                    APP_RULE[meeting.app],
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">{meeting.time}</span>
                      <span className={cn('text-xs font-semibold uppercase', APP_INK[meeting.app])}>
                        {APP_LABEL[meeting.app]}
                      </span>
                    </div>
                    {/* RSVP Toggle Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setMeetingRsvps((prev) => ({
                          ...prev,
                          [meeting.time]: prev[meeting.time] === 'yes' ? 'no' : 'yes',
                        }))
                      }
                      className={cn(
                        'rounded-full px-2.5 py-0.5 font-mono text-2xs font-semibold transition-all cursor-pointer',
                        rsvp === 'yes'
                          ? 'border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                          : 'border border-border bg-muted text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {rsvp === 'yes' ? 'Attending ✓' : 'Declined ✕'}
                    </button>
                  </div>
                  <span className="text-xs font-medium text-foreground">{meeting.title}</span>
                  <div className="flex items-center justify-between text-2xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3 text-primary" /> {meeting.duration}
                    </span>
                    <span>{meeting.attendees}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Plate>
  )
}

/* ========================================================================= */
/* --- PLATE II: INTERACTIVE CAPACITY & OVERLOAD ADJUSTMENT                 */
/* ========================================================================= */

interface EngineerAllocation {
  name: string
  title: string
  chips: { app: AppKey; pct: number }[]
}

const INITIAL_ALLOCATIONS: EngineerAllocation[] = [
  {
    name: 'Nuwan Perera',
    title: 'Engineering lead',
    chips: [
      { app: 'kestrel', pct: 70 },
      { app: 'apollo', pct: 42 },
    ],
  },
  {
    name: 'Ishara Fernando',
    title: 'Senior engineer',
    chips: [
      { app: 'kestrel', pct: 46 },
      { app: 'tessera', pct: 40 },
    ],
  },
  {
    name: 'Dilini Jayasuriya',
    title: 'Product designer',
    chips: [{ app: 'tessera', pct: 65 }],
  },
  {
    name: 'Kasun Silva',
    title: 'Engineer',
    chips: [{ app: 'apollo', pct: 40 }],
  },
  {
    name: 'Amaya Wickrama',
    title: 'QA engineer',
    chips: [
      { app: 'kestrel', pct: 30 },
      { app: 'apollo', pct: 25 },
    ],
  },
  {
    name: 'Ruwan Bandara',
    title: 'Engineer',
    chips: [{ app: 'tessera', pct: 75 }],
  },
]

export function PlateCapacity() {
  const [allocations, setAllocations] = useState<EngineerAllocation[]>(INITIAL_ALLOCATIONS)
  const [selectedAppFilter, setSelectedAppFilter] = useState<string | null>(null)

  const adjustCapacity = (name: string, delta: number) => {
    setAllocations((prev) =>
      prev.map((engineer) => {
        if (engineer.name !== name) return engineer
        const newChips = engineer.chips.map((chip, idx) => {
          if (idx === 0) {
            return { ...chip, pct: Math.max(10, Math.min(100, chip.pct + delta)) }
          }
          return chip
        })
        return { ...engineer, chips: newChips }
      }),
    )
  }

  const resetAllocations = () => {
    setAllocations(INITIAL_ALLOCATIONS)
    setSelectedAppFilter(null)
  }

  const balanceTeam = () => {
    setAllocations((prev) =>
      prev.map((eng) => ({
        ...eng,
        chips: eng.chips.map((c) => ({ ...c, pct: Math.min(45, c.pct) })),
      })),
    )
  }

  return (
    <Plate
      label="Plate II"
      captionSide="end"
      caption="— Plate II. Interactive capacity & burnout radar. Click + / - to live-test overload thresholds (>80% amber, >100% red)."
    >
      {/* Top Filter & Reset Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs text-muted-foreground uppercase mr-1">
            As of {AS_OF} &bull; Filter:
          </span>
          {(['kestrel', 'apollo', 'tessera'] as AppKey[]).map((appKey) => {
            const isSelected = selectedAppFilter === appKey
            return (
              <button
                key={appKey}
                type="button"
                onClick={() => setSelectedAppFilter(isSelected ? null : appKey)}
                className={cn(
                  'rounded-md px-2 py-0.5 font-mono text-2xs font-semibold uppercase transition-all cursor-pointer',
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground',
                )}
              >
                {APP_LABEL[appKey]}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={balanceTeam}
            className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-2xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
          >
            <Sparkles className="size-3" /> Auto-Balance Team
          </button>
          <button
            type="button"
            onClick={resetAllocations}
            className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 font-mono text-2xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3" /> Reset
          </button>
        </div>
      </div>

      {/* Engineer Allocation List */}
      <div className="flex flex-col divide-y divide-border/60 pt-2">
        {allocations
          .filter((row) =>
            selectedAppFilter ? row.chips.some((c) => c.app === selectedAppFilter) : true,
          )
          .map((row) => {
            const total = row.chips.reduce((sum, chip) => sum + chip.pct, 0)
            return (
              <div
                key={row.name}
                className="flex flex-col gap-2.5 py-3.5 sm:flex-row sm:items-center sm:gap-4 transition-colors hover:bg-muted/20 px-2 rounded-xl"
              >
                {/* Person Profile */}
                <div className="flex min-w-0 items-center gap-2.5 sm:w-52 sm:shrink-0">
                  <Avatar size="sm" className="ring-1 ring-border">
                    <AvatarFallback>{initials(row.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-semibold text-foreground">{row.name}</span>
                    <span className="hidden truncate text-2xs text-muted-foreground sm:block">
                      {row.title}
                    </span>
                  </div>
                </div>

                {/* Project Chips */}
                <div className="hidden shrink-0 flex-wrap gap-1.5 lg:flex lg:w-56">
                  {row.chips.map((chip) => (
                    <span
                      key={chip.app}
                      className={cn(
                        'rounded-sm border-l-2 bg-muted/60 py-0.5 pr-1.5 pl-2 font-mono text-2xs text-muted-foreground uppercase',
                        APP_RULE[chip.app],
                      )}
                    >
                      {APP_LABEL[chip.app]} {chip.pct}%
                    </span>
                  ))}
                </div>

                {/* Live Capacity Bar & Steppers */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CapacityBar totalPct={total} />
                  <BandBadge pct={total} />

                  {/* +/- Steppers */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustCapacity(row.name, -5)}
                      className="flex size-6 items-center justify-center rounded-md border border-border/80 bg-muted/40 text-muted-foreground hover:border-primary hover:text-foreground transition-colors cursor-pointer"
                      title="Decrease allocation (-5%)"
                    >
                      <Minus className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustCapacity(row.name, +5)}
                      className="flex size-6 items-center justify-center rounded-md border border-border/80 bg-muted/40 text-muted-foreground hover:border-primary hover:text-foreground transition-colors cursor-pointer"
                      title="Increase allocation (+5%)"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </Plate>
  )
}

/* ========================================================================= */
/* --- PLATE III: GEMINI AI TRANSCRIPT & DECISIONS ENGINE                   */
/* ========================================================================= */

export function PlateWriteup() {
  const [actionDone, setActionDone] = useState(false)
  const [questionResolved, setQuestionResolved] = useState(false)
  const [discussionAgreed, setDiscussionAgreed] = useState(5)
  const [isAgreed, setIsAgreed] = useState(false)
  const [activeLang, setActiveLang] = useState<'both' | 'en' | 'si'>('both')
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  return (
    <Plate
      label="Plate III"
      captionSide="below"
      caption="— Plate III. Interactive Gemini 2.5 AI writeup engine. Toggle action item completion, resolve questions, or test Sinhala / English bilingual transcription."
    >
      {/* Header Metadata with Interactive Audio Test Player */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-primary pl-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {['Kestrel', 'Sprint 14 check-in', '12 Aug', '41 min'].map((cell, index) => (
            <span key={cell} className="flex items-center gap-3">
              {index > 0 && <span className="hidden text-muted-foreground sm:inline">&bull;</span>}
              <span
                className={cn(
                  'font-mono text-2xs tracking-[0.18em] uppercase',
                  index === 0 ? APP_INK.kestrel : 'text-muted-foreground',
                )}
              >
                {cell}
              </span>
            </span>
          ))}
        </div>

        {/* Audio Player Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlayingAudio((prev) => !prev)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-2xs font-semibold transition-all cursor-pointer',
              isPlayingAudio
                ? 'bg-primary text-primary-foreground shadow-md animate-pulse'
                : 'border border-border/80 bg-muted/40 text-foreground hover:bg-muted',
            )}
          >
            {isPlayingAudio ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            <span>{isPlayingAudio ? 'Audio Playing (26.4s)' : 'Test Audio Playback'}</span>
          </button>
        </div>
      </div>

      {/* 4 Interactive Blocks Grid */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Block 1: Action Item (Clickable Completion) */}
        <div
          onClick={() => setActionDone((prev) => !prev)}
          className={cn(
            'flex flex-col gap-2 rounded-xl border-l-3 bg-muted/20 p-4 transition-all cursor-pointer hover:bg-muted/40',
            actionDone ? 'border-l-primary bg-primary/5' : 'border-l-tag-action',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-tag-action">
              Action Item
            </span>
            <div className="flex items-center gap-1.5 font-mono text-2xs">
              {actionDone ? (
                <span className="flex items-center gap-1 text-primary font-bold">
                  <CheckCircle2 className="size-3.5" /> Completed
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Circle className="size-3.5" /> Mark Done
                </span>
              )}
            </div>
          </div>
          <p className={cn('text-xs leading-relaxed text-foreground transition-all', actionDone && 'line-through text-muted-foreground')}>
            Nuwan to unblock the migration journal before Thursday standup.
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-2xs font-medium text-muted-foreground">
              Due 13 Aug
            </span>
            <span className="text-2xs text-muted-foreground">Assignee: Nuwan Perera</span>
          </div>
        </div>

        {/* Block 2: Discussion Agreement (Interactive Endorsements) */}
        <div className="flex flex-col gap-2 rounded-xl border-l-3 border-l-tag-discussion bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-tag-discussion">
              Key Decision
            </span>
            <button
              type="button"
              onClick={() => {
                if (!isAgreed) {
                  setDiscussionAgreed((c) => c + 1)
                  setIsAgreed(true)
                } else {
                  setDiscussionAgreed((c) => c - 1)
                  setIsAgreed(false)
                }
              }}
              className={cn(
                'rounded-full px-2 py-0.5 font-mono text-2xs font-semibold transition-all cursor-pointer',
                isAgreed
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border/80 bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              👍 {discussionAgreed} Endorsed
            </button>
          </div>
          <p className="text-xs leading-relaxed text-foreground">
            Whether the Notion export stays one-way. Agreed: one-way, sprint-scoped only.
          </p>
          <span className="text-2xs text-muted-foreground">
            Decision outcome finalized with unanimous approval.
          </span>
        </div>

        {/* Block 3: Follow-up Question (Clickable Resolution) */}
        <div
          onClick={() => setQuestionResolved((prev) => !prev)}
          className={cn(
            'flex flex-col gap-2 rounded-xl border-l-3 bg-muted/20 p-4 transition-all cursor-pointer hover:bg-muted/40',
            questionResolved ? 'border-l-primary bg-primary/5' : 'border-l-tag-question',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-tag-question">
              Prep Question
            </span>
            <span className="font-mono text-2xs font-semibold">
              {questionResolved ? (
                <span className="text-primary">Resolved ✓</span>
              ) : (
                <span className="text-chart-1">Pending Standup ?</span>
              )}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-foreground font-medium">
            Who owns the backup restore drill?
          </p>
          <p className="text-2xs text-muted-foreground leading-relaxed">
            {questionResolved
              ? 'Resolved: Assigned to Ruwan Bandara & DevOps team for next Tuesday drill.'
              : 'Unanswered — resurfaces as prep item before the next Kestrel sprint check-in.'}
          </p>
        </div>

        {/* Block 4: Term Definition */}
        <div className="flex flex-col gap-2 rounded-xl border-l-3 border-l-tag-term bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-tag-term">
              Domain Term
            </span>
            <span className="font-mono text-2xs text-muted-foreground">Glossary Added</span>
          </div>
          <p className="text-xs leading-relaxed text-foreground">
            <strong>soft delete</strong> &mdash; a database record marked with a deleted timestamp rather than hard erased, allowing instant undo.
          </p>
          <span className="text-2xs text-muted-foreground">Tagged on schema PR #142</span>
        </div>

        {/* Block 5: Bilingual Sinhala + English Engine Section */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              <span className="font-heading text-xs font-bold text-foreground">
                Bilingual Gemini Transcription Engine
              </span>
            </div>

            {/* Language Filter */}
            <div className="flex items-center rounded-lg bg-card p-0.5 border border-border/60">
              <button
                type="button"
                onClick={() => setActiveLang('both')}
                className={cn(
                  'rounded px-2 py-0.5 text-2xs font-medium transition-all cursor-pointer',
                  activeLang === 'both' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground',
                )}
              >
                Side-by-Side
              </button>
              <button
                type="button"
                onClick={() => setActiveLang('si')}
                className={cn(
                  'rounded px-2 py-0.5 text-2xs font-medium transition-all cursor-pointer',
                  activeLang === 'si' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground',
                )}
              >
                Sinhala (සිංහල)
              </button>
              <button
                type="button"
                onClick={() => setActiveLang('en')}
                className={cn(
                  'rounded px-2 py-0.5 text-2xs font-medium transition-all cursor-pointer',
                  activeLang === 'en' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground',
                )}
              >
                English
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(activeLang === 'both' || activeLang === 'si') && (
              <div className="rounded-xl border border-border/60 bg-card/60 p-3.5">
                <span className="font-mono text-2xs font-bold text-primary uppercase">
                  Sinhala AI Output
                </span>
                <p className={cn(bilingualText, 'mt-1.5 text-sm font-medium text-foreground')} lang="si">
                  ඊළඟ sprint එකට කලින් migration journal එක හදන්න ඕන.
                </p>
              </div>
            )}

            {(activeLang === 'both' || activeLang === 'en') && (
              <div className="rounded-xl border border-border/60 bg-card/60 p-3.5">
                <span className="font-mono text-2xs font-bold text-muted-foreground uppercase">
                  English Gloss
                </span>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  The migration journal needs fixing before the next sprint kickoff.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Plate>
  )
}
