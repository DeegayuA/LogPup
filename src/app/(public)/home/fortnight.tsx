'use client'

import { useState, useMemo } from 'react'
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday as isDateToday,
} from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sparkles,
  Moon,
  Clock,
  Flame,
  CheckCircle2,
  TrendingUp,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getLkHoliday,
  isLkSunday,
  toIsoDateInTimeZone,
  LK_TIMEZONE,
} from '@/lib/lk-holidays'
import { workingDayFraction } from '@/lib/working-days'

type ViewMode = 'calendar' | 'fortnight'

export interface SampleLog {
  task: string
  hours: number
  score: number
  app: string
}

const STUDIO_TASKS_POOL = [
  { task: 'Sprint backlog refinement & OAuth PKCE token exchange audit', hours: 7.5, score: 5, app: 'Kestrel' },
  { task: 'Implemented rate limiter token bucket algorithm in Neon Postgres', hours: 8.0, score: 5, app: 'Kestrel' },
  { task: 'Client architecture review meetings & technical handover documentation', hours: 7.0, score: 4, app: 'Apollo' },
  { task: 'Drizzle ORM schema v0.45 zero-downtime migration test', hours: 8.5, score: 5, app: 'Kestrel' },
  { task: 'Bilingual Sinhala Gemini 3.7 Flash audio transcript prompt tuning', hours: 7.5, score: 5, app: 'Kestrel' },
  { task: 'Meeting audio live-stream WebSocket buffer implementation', hours: 8.0, score: 5, app: 'Kestrel' },
  { task: 'Role permission gate policy checks & security testing', hours: 7.5, score: 5, app: 'Apollo' },
  { task: 'Morning sprint check-in & UI responsive layout audit', hours: 8.0, score: 5, app: 'Kestrel' },
  { task: 'Optimistic state sync between Notion exporter & Kanban board', hours: 7.5, score: 5, app: 'Kestrel' },
  { task: 'End-of-week release build & database benchmark profiling', hours: 8.0, score: 5, app: 'Tessera' },
  { task: 'Burnout capacity radar threshold alerts integration', hours: 8.0, score: 5, app: 'Kestrel' },
  { task: 'Bug tracker CSV export and webhook error notifications', hours: 7.5, score: 5, app: 'Apollo' },
  { task: 'Full test suite optimization & vitest parallelization', hours: 8.0, score: 5, app: 'Tessera' },
  { task: 'Gemini live caption streaming & token cost tracker', hours: 8.0, score: 5, app: 'Kestrel' },
  { task: 'Cross-browser glassmorphism styling & dark mode contrast audit', hours: 7.5, score: 5, app: 'Tessera' },
  { task: 'PostgreSQL connection pool tuning & query execution profiling', hours: 8.5, score: 5, app: 'Apollo' },
  { task: 'Mobile PWA offline service worker cache strategy upgrade', hours: 7.0, score: 4, app: 'Kestrel' },
  { task: 'Design token export automation & Figma spec alignment', hours: 7.5, score: 5, app: 'Tessera' },
  { task: 'Database replication health checks & transaction log pruning', hours: 8.0, score: 5, app: 'Apollo' },
  { task: 'Multi-tenant tenant isolation policies & security audit', hours: 7.5, score: 5, app: 'Kestrel' },
]

const SATURDAY_TASKS_POOL = [
  { task: 'Saturday half-day code review, deployment checklist & sprint triage', hours: 4.0, score: 5, app: 'Kestrel' },
  { task: 'Saturday half-day dependency audit & security advisory fixes', hours: 4.0, score: 5, app: 'Tessera' },
  { task: 'Saturday half-day sprint retrospective notes & engineering documentation', hours: 4.0, score: 5, app: 'Apollo' },
  { task: 'Saturday half-day team documentation updates & architecture diagrams', hours: 4.0, score: 5, app: 'Kestrel' },
]

function getDeterministicLog(
  iso: string,
  fraction: number,
  isHoliday: boolean,
  isSunday: boolean,
  isTodayDate: boolean,
): SampleLog | null {
  if (isHoliday || isSunday) return null

  if (isTodayDate) {
    return {
      task: 'Today: In progress — Studio calendar synchronization & daily work log entry',
      hours: 4.5,
      score: 5,
      app: 'Kestrel',
    }
  }

  let hash = 0
  for (let i = 0; i < iso.length; i++) {
    hash = (hash * 31 + iso.charCodeAt(i)) & 0xffffff
  }

  if (fraction === 0.5) {
    const idx = Math.abs(hash) % SATURDAY_TASKS_POOL.length
    return SATURDAY_TASKS_POOL[idx]
  }

  const idx = Math.abs(hash) % STUDIO_TASKS_POOL.length
  return STUDIO_TASKS_POOL[idx]
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Fortnight() {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2026, 7, 20)) // Aug 2026 default
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 7, 20))
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [autofillEnabled, setAutofillEnabled] = useState<boolean>(true)
  const [generationSeed, setGenerationSeed] = useState<number>(0)

  // When changing month, automatically set selected date to the 1st of that month if not currently in that month
  const handleMonthChange = (newMonth: Date) => {
    setCurrentMonth(newMonth)
    if (!isSameMonth(selectedDate, newMonth)) {
      setSelectedDate(startOfMonth(newMonth))
    }
  }

  // Calendar Grid Days for Month View
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  // Dynamic log lookup function
  const getLogForDate = (date: Date): SampleLog | null => {
    if (!autofillEnabled) return null
    const iso = toIsoDateInTimeZone(date, LK_TIMEZONE)
    const holiday = getLkHoliday(date, LK_TIMEZONE)
    const isSunday = isLkSunday(date, LK_TIMEZONE)
    const fraction = workingDayFraction(iso)
    const isDayToday = isSameDay(date, new Date(2026, 7, 20))
    return getDeterministicLog(
      `${iso}-${generationSeed}`,
      fraction,
      Boolean(holiday),
      isSunday,
      isDayToday,
    )
  }

  // Selected Day Information
  const selectedIso = toIsoDateInTimeZone(selectedDate, LK_TIMEZONE)
  const selectedHoliday = getLkHoliday(selectedDate, LK_TIMEZONE)
  const isSelectedSunday = isLkSunday(selectedDate, LK_TIMEZONE)
  const selectedFraction = workingDayFraction(selectedIso)
  const selectedLog = getLogForDate(selectedDate)
  const isSelectedToday = isDateToday(selectedDate) || selectedIso === '2026-08-20'

  // Month Statistics
  const monthStats = useMemo(() => {
    const daysInCurrentMonth = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    })

    let workingDays = 0
    let halfDays = 0
    let holidays = 0
    let sundays = 0
    let totalHoursLogged = 0

    daysInCurrentMonth.forEach((d) => {
      const iso = toIsoDateInTimeZone(d, LK_TIMEZONE)
      const hol = getLkHoliday(d, LK_TIMEZONE)
      const sun = isLkSunday(d, LK_TIMEZONE)
      const fraction = workingDayFraction(iso)

      if (hol) {
        holidays++
      } else if (sun) {
        sundays++
      } else if (fraction === 0.5) {
        halfDays++
        totalHoursLogged += 4.0
      } else if (fraction === 1) {
        workingDays++
        totalHoursLogged += 8.0
      }
    })

    return { workingDays, halfDays, holidays, sundays, totalHoursLogged }
  }, [currentMonth])

  // 15-Day Fortnight Days Array
  const fortnightDays = useMemo(() => {
    return Array.from({ length: 15 }).map((_, idx) => {
      const offset = 14 - idx
      const d = new Date(2026, 7, 20)
      d.setDate(d.getDate() - offset)
      const iso = toIsoDateInTimeZone(d, LK_TIMEZONE)
      const holiday = getLkHoliday(d, LK_TIMEZONE)
      const isSunday = isLkSunday(d, LK_TIMEZONE)
      const isSaturday = d.getDay() === 6
      const isToday = offset === 0
      const isSelected = isSameDay(d, selectedDate)
      const fraction = workingDayFraction(iso)
      const log = getDeterministicLog(
        `${iso}-${generationSeed}`,
        fraction,
        Boolean(holiday),
        isSunday,
        isToday,
      )

      let state: 'logged' | 'half' | 'off' | 'open' = 'logged'
      if (holiday || isSunday) state = 'off'
      else if (isToday) state = 'open'
      else if (isSaturday || fraction === 0.5) state = 'half'

      return {
        date: d,
        iso,
        holiday,
        isSunday,
        isSaturday,
        isToday,
        isSelected,
        fraction,
        log,
        state,
      }
    })
  }, [selectedDate, generationSeed])

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Top Controls: Month Navigation, Today, Autofill, View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleMonthChange(subMonths(currentMonth, 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => handleMonthChange(addMonths(currentMonth, 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <h4 className="font-heading text-base font-bold tracking-tight text-foreground sm:text-lg">
            {format(currentMonth, 'MMMM yyyy')}
          </h4>

          <button
            type="button"
            onClick={() => {
              const today = new Date(2026, 7, 20)
              setCurrentMonth(today)
              setSelectedDate(today)
            }}
            className="rounded-md border border-border/60 bg-card px-2.5 py-1 font-mono text-2xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors cursor-pointer"
          >
            Today
          </button>

          {/* Autofill Month Action Button */}
          <button
            type="button"
            onClick={() => {
              setAutofillEnabled(true)
              setGenerationSeed((s) => s + 1)
            }}
            className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-2xs font-semibold text-primary hover:bg-primary/20 transition-all cursor-pointer shadow-xs"
            title="Autofill and regenerate realistic daily work logs for this month"
          >
            <Wand2 className="size-3 text-primary animate-pulse" />
            <span>Autofill Month</span>
          </button>
        </div>

        {/* View Mode Toggle & Sri Lanka Time Badge */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-2xs text-primary font-medium">
            <Moon className="size-3" /> Asia/Colombo (UTC+05:30)
          </span>

          <div className="flex items-center rounded-lg bg-muted/60 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={cn(
                'rounded-md px-2.5 py-1 text-2xs font-medium transition-all cursor-pointer',
                viewMode === 'calendar'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Full Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('fortnight')}
              className={cn(
                'rounded-md px-2.5 py-1 text-2xs font-medium transition-all cursor-pointer',
                viewMode === 'fortnight'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Fortnight Strip
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout (Consistently balanced in both modes) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Full Calendar Grid OR Fortnight Strip Visualizer (7 Cols)     */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {viewMode === 'calendar' ? (
            <div className="flex flex-col gap-2">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 text-center font-mono text-2xs font-semibold text-muted-foreground">
                {WEEKDAYS.map((w, idx) => (
                  <div
                    key={w}
                    className={cn(
                      'py-1',
                      idx === 5 ? 'text-primary/80' : idx === 6 ? 'text-chart-1/80' : '',
                    )}
                  >
                    {w}
                  </div>
                ))}
              </div>

              {/* Calendar Days Matrix */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {calendarDays.map((date) => {
                  const isCurrentMonth = isSameMonth(date, currentMonth)
                  const isSelected = isSameDay(date, selectedDate)
                  const isDayToday = isSameDay(date, new Date(2026, 7, 20))
                  const iso = toIsoDateInTimeZone(date, LK_TIMEZONE)
                  const holiday = getLkHoliday(date, LK_TIMEZONE)
                  const isSunday = isLkSunday(date, LK_TIMEZONE)
                  const fraction = workingDayFraction(iso)
                  const log = getLogForDate(date)
                  const hasLog = Boolean(log)

                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={cn(
                        'group relative flex min-h-[60px] sm:min-h-[66px] flex-col justify-between rounded-xl border p-1.5 text-left transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        isSelected
                          ? 'border-primary bg-primary/15 ring-2 ring-primary shadow-md'
                          : isCurrentMonth
                          ? 'border-border/60 bg-card/60 hover:border-primary/40 hover:bg-card'
                          : 'border-border/20 bg-muted/10 opacity-35 hover:opacity-70',
                      )}
                    >
                      {/* Top Row: Date Number & Badges */}
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'font-mono text-xs font-semibold tabular-nums',
                            isDayToday
                              ? 'flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold'
                              : isSelected
                              ? 'text-primary font-bold'
                              : isSunday
                              ? 'text-muted-foreground/60'
                              : 'text-foreground',
                          )}
                        >
                          {format(date, 'd')}
                        </span>

                        {holiday ? (
                          <span
                            className="size-2 rounded-full bg-chart-1 ring-2 ring-chart-1/30"
                            title={holiday.name}
                          />
                        ) : fraction === 0.5 ? (
                          <span
                            className="font-mono text-[9px] text-primary/80 font-medium"
                            title="Saturday half-day (50%)"
                          >
                            ½d
                          </span>
                        ) : hasLog ? (
                          <span
                            className="size-1.5 rounded-full bg-primary"
                            title={log ? log.app : 'Logged entry'}
                          />
                        ) : null}
                      </div>

                      {/* Bottom Indicator / Label */}
                      <div className="mt-1 truncate">
                        {holiday ? (
                          <span className="block truncate font-mono text-[9px] font-medium text-chart-1">
                            {holiday.name.split(' ')[0]}
                          </span>
                        ) : isSunday ? (
                          <span className="block font-mono text-[9px] text-muted-foreground/50">
                            Off
                          </span>
                        ) : fraction === 0.5 ? (
                          <span className="block font-mono text-[9px] text-muted-foreground">
                            Sat 50%
                          </span>
                        ) : hasLog ? (
                          <span className="block font-mono text-[9px] text-primary font-medium">
                            ✓ {log?.app ?? 'Logged'}
                          </span>
                        ) : (
                          <span className="block font-mono text-[9px] text-muted-foreground/40">
                            &bull;
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Fortnight Visualizer Mode */
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" />
                    <span className="font-heading text-xs font-bold text-foreground">
                      Trailing 15-Day Work Velocity Strip
                    </span>
                  </div>
                  <span className="font-mono text-2xs text-muted-foreground">
                    Aug 6 &ndash; Aug 20
                  </span>
                </div>

                {/* 15 Bar Columns (Evenly Distributed) */}
                <div
                  className="grid gap-1 sm:gap-1.5 pt-4 pb-2 items-end"
                  style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
                >
                  {fortnightDays.map((f) => (
                    <button
                      key={f.iso}
                      type="button"
                      onClick={() => setSelectedDate(f.date)}
                      className={cn(
                        'group flex flex-col items-center gap-1.5 rounded-lg p-1 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        f.isSelected
                          ? 'bg-primary/20 ring-2 ring-primary shadow-sm'
                          : 'hover:bg-muted/60',
                      )}
                    >
                      {/* Bar Pillar */}
                      <div className="flex h-16 w-full items-end justify-center">
                        {f.state === 'off' ? (
                          <div
                            className="h-2 w-full rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50 transition-colors"
                            title={f.holiday ? f.holiday.name : 'Sunday Off'}
                          />
                        ) : f.state === 'half' ? (
                          <div
                            className="h-8 w-full rounded-sm bg-primary/75 group-hover:bg-primary transition-colors"
                            title="Saturday Half-Day (4 hrs)"
                          />
                        ) : f.state === 'open' ? (
                          <div
                            className="h-16 w-full rounded-sm border-2 border-dashed border-primary bg-primary/15 flex items-center justify-center relative overflow-hidden"
                            title="Today: In Progress"
                          >
                            <span className="h-full w-1 bg-primary animate-pulse" />
                          </div>
                        ) : (
                          <div
                            className="h-16 w-full rounded-sm bg-primary group-hover:bg-primary/90 transition-colors shadow-xs"
                            title={`Logged: ${f.log?.hours ?? 8}h`}
                          />
                        )}
                      </div>

                      {/* Day Label & Date */}
                      <div className="flex flex-col items-center leading-tight">
                        <span className="font-mono text-[10px] font-semibold text-foreground">
                          {format(f.date, 'd')}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {format(f.date, 'EEEEE')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fortnight Key Performance Indicators */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/70 bg-card/60 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                    <Flame className="size-3.5 text-chart-1" />
                    <span>Streak</span>
                  </div>
                  <span className="font-mono text-lg font-bold text-foreground">14 Days</span>
                  <span className="text-2xs text-muted-foreground">Consecutive days logged</span>
                </div>

                <div className="rounded-xl border border-border/70 bg-card/60 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                    <Clock className="size-3.5 text-primary" />
                    <span>Hours Logged</span>
                  </div>
                  <span className="font-mono text-lg font-bold text-primary">78.5 hrs</span>
                  <span className="text-2xs text-muted-foreground">Across 3 active apps</span>
                </div>

                <div className="rounded-xl border border-border/70 bg-card/60 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-primary" />
                    <span>Compliance</span>
                  </div>
                  <span className="font-mono text-lg font-bold text-foreground">100%</span>
                  <span className="text-2xs text-muted-foreground">Studio schedule adhered</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="flex items-center justify-between text-2xs text-muted-foreground border-t border-border/40 pt-2">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              {viewMode === 'calendar'
                ? `Viewing full month matrix for ${format(currentMonth, 'MMMM yyyy')} (${monthStats.totalHoursLogged} hrs calculated).`
                : `Viewing trailing 15 days ending ${format(new Date(2026, 7, 20), 'd MMMM yyyy')}.`}
            </span>
            <span className="font-mono text-primary font-medium">Sri Lanka Gazetted Holiday Engine</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Selected Date Inspector & Month Breakdown (5 Cols)          */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          {/* Selected Date Inspector Card */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-sm font-bold text-foreground sm:text-base">
                    {format(selectedDate, 'EEEE, d MMMM yyyy')}
                  </span>
                  {isSelectedToday && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.2 font-mono text-2xs font-bold text-primary">
                      Today
                    </span>
                  )}
                </div>
                <span className="font-mono text-2xs text-muted-foreground">
                  ISO: {selectedIso}
                </span>
              </div>
              <CalendarIcon className="size-4 text-primary" />
            </div>

            {/* Legal Status in Sri Lanka */}
            <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-3">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sri Lankan Calendar Status
              </span>
              {selectedHoliday ? (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-chart-1 text-xs">
                    🌕 {selectedHoliday.name}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    Gazetted Public &amp; Mercantile Holiday &bull; No work expected
                  </span>
                </div>
              ) : isSelectedSunday ? (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-muted-foreground text-xs">
                    Sunday &bull; Weekend
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    Standard studio day off
                  </span>
                </div>
              ) : selectedFraction === 0.5 ? (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-primary text-xs">
                    Saturday Half-Working Day (50%)
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    Shop &amp; Office standard &bull; 4 hours baseline expectation
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-foreground text-xs">
                    Full Working Day (100%)
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    Regular engineering sprint day &bull; Daily log expected
                  </span>
                </div>
              )}
            </div>

            {/* Work Log Ledger Record for this date */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Studio Work Log Record
                </span>
                {selectedLog ? (
                  <span className="rounded bg-primary/10 px-1.5 py-0.2 font-mono text-2xs font-semibold text-primary">
                    {selectedLog.app}
                  </span>
                ) : null}
              </div>

              {selectedLog ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-foreground leading-relaxed">
                    &ldquo;{selectedLog.task}&rdquo;
                  </p>
                  <div className="flex items-center justify-between border-t border-border/40 pt-1.5 text-2xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="size-3 text-primary" /> {selectedLog.hours} hrs logged
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      Plan Progress: <strong className="text-primary">{selectedLog.score}/5</strong>
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-1">
                  {selectedHoliday || isSelectedSunday
                    ? 'No work log entry required for scheduled studio off-days.'
                    : isSelectedToday
                    ? 'Today is currently in progress. Work log closes at midnight.'
                    : 'No entry logged for this historical date.'}
                </p>
              )}
            </div>
          </div>

          {/* Monthly Working Days & Holiday Metrics */}
          <div className="grid grid-cols-4 gap-2 rounded-xl border border-border/60 bg-card/60 p-3 text-center text-2xs">
            <div className="rounded-lg bg-muted/30 p-2">
              <span className="font-mono font-bold text-foreground text-sm block">
                {monthStats.workingDays}
              </span>
              <span className="text-muted-foreground">Full Days</span>
            </div>
            <div className="rounded-lg bg-muted/30 p-2">
              <span className="font-mono font-bold text-primary text-sm block">
                {monthStats.halfDays}
              </span>
              <span className="text-muted-foreground">Sat (½d)</span>
            </div>
            <div className="rounded-lg bg-muted/30 p-2">
              <span className="font-mono font-bold text-chart-1 text-sm block">
                {monthStats.holidays}
              </span>
              <span className="text-muted-foreground">Holidays</span>
            </div>
            <div className="rounded-lg bg-muted/30 p-2">
              <span className="font-mono font-bold text-muted-foreground text-sm block">
                {monthStats.sundays}
              </span>
              <span className="text-muted-foreground">Sundays</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
