'use client'

import { useState, useEffect, useId, type DragEvent, useMemo } from 'react'
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Kanban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Languages,
  ShieldCheck,
  FileSpreadsheet,
  GripVertical,
  ChevronDown,
  RotateCcw,
  Play,
  Pause,
  Plus,
  Activity,
  History,
  Radio,
  Volume2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { priceForModel } from '@/features/gemini/pricing'
import { CapacityBar } from '@/features/people/components/capacity-bar'
import { Badge } from '@/components/ui/badge'
import { useSpeech } from '@/features/speech/components/use-speech'

type TabKey = 'briefing' | 'worklog' | 'capacity' | 'kanban' | 'roadmap' | 'intel' | 'activity'
type ColumnId = 'todo' | 'in_flight' | 'shipped'

interface KanbanTask {
  id: string
  title: string
  points: number
  tag: string
  column: ColumnId
}

interface EngineerCapacity {
  id: string
  name: string
  role: string
  initials: string
  pct: number
  apps: { name: string; pct: number }[]
}

interface MeetingIntelItem {
  id: string
  title: string
  time: string
  duration: string
  actionItemEn: string
  actionItemSi: string
  assignee: string
  dueDate: string
  questionEn: string
  questionSi: string
}

/**
 * WHAT THIS PAGE MAY ASSERT ABOUT A MODEL, and what it must derive.
 *
 * The identity and the pitch are marketing's to write: the label, the version
 * badge, the one-line tag, the latency and throughput figures, and what the
 * model is good for. Those are positioning.
 *
 * The RATES are not. They are a claim about what Google charges, they are
 * already stated once in src/features/gemini/pricing.ts — the table the usage
 * ledger bills against — and a second hand-written copy of a number is a copy
 * that goes stale silently. Two of the models below are on promotional rows
 * that expire (`until: '2027-01-01'`, after which 3.6/3.7-flash double to
 * $1.50/$7.50). Hardcoded, this page would have gone on advertising the promo
 * price into 2027 with nothing connecting it to the change. That is the same
 * defect advertised-models.test.ts was written for — copy outrunning its
 * mechanism — one field to the left of what that test checks, since it asserts
 * an advertised id is PRICEABLE, not that an advertised RATE is CORRECT.
 *
 * So the rate fields are derived from priceForModel and the specs below carry
 * none. pricing.ts is a pure module — no db, no server-only import — so a
 * client component may call it.
 *
 * KNOWN LIMIT, stated rather than papered over: /home is statically
 * prerendered, so the instant these rates are resolved against is fixed at
 * build time and a promotional rollover lands on the next deploy rather than
 * at midnight on the day. That is a deploy-cadence question, not a correctness
 * one — the page cannot disagree with pricing.ts as of the build that produced
 * it, and no code change is needed when a promo ends.
 *
 * (This paragraph named a `PRICED_AT` constant that no longer exists, which is
 * the documentation form of the hardcoded rate below it: true when written,
 * with nothing connecting it to the code. The next reader would have grepped
 * for the symbol, found nothing, and had to work out which half of the file to
 * trust. See the prop note further down for how the instant actually arrives.)
 */
export interface GeminiModelSpec {
  id: string
  label: string
  version: string
  tag: string
  speedLatency: string
  throughput: string
  bestFor: string
  tier: 'GA' | 'Preview' | 'Alias'
}

/** A spec with its rates resolved — what the sandbox actually renders. */
export interface GeminiModel extends GeminiModelSpec {
  inRate: string
  outRate: string
  inputCostPer1M: number
  outputCostPer1M: number
}

const MODEL_SPECS: GeminiModelSpec[] = [
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    version: 'v3.6',
    tag: 'Primary Pinned Default',
    speedLatency: '38ms',
    throughput: '240 tok/s',
    bestFor: 'High-frequency audio chunk parsing & meeting note synthesis',
    tier: 'GA',
  },
  {
    id: 'gemini-3.7-flash',
    label: 'Gemini 3.7 Flash',
    version: 'v3.7',
    tag: 'Flagship Speed & Reasoning',
    speedLatency: '42ms',
    throughput: '220 tok/s',
    bestFor: 'State-of-the-art hybrid reasoning & meeting audio',
    tier: 'GA',
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    version: 'v3.1',
    tag: 'Deep Synthesis Tier',
    speedLatency: '85ms',
    throughput: '65 tok/s',
    bestFor: 'Complex multi-speaker reconciliation & screen OCR',
    tier: 'Preview',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    version: 'v3.5',
    tag: 'Ultra-Fast Mechanical',
    speedLatency: '24ms',
    throughput: '260 tok/s',
    bestFor: 'Low-latency daily work log backfill & titles',
    tier: 'GA',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    version: 'v2.5',
    tag: 'Bilingual Engine',
    speedLatency: '78ms',
    throughput: '60 tok/s',
    bestFor: 'Dual-language English & Sinhala (\u0dc3\u0dd2\u0d82\u0dc4\u0dbd) extraction',
    tier: 'GA',
  },
]

/**
 * WHY THIS IS A PROP AND NOT `new Date()` AT MODULE SCOPE.
 *
 * This file is 'use client', and the page is statically prerendered — so a
 * module-scope `new Date()` evaluates TWICE at different moments: once on the
 * server at build time, once in the browser at load. Today both land in the
 * same pricing window, so the numbers agree and nothing is visible. They stop
 * agreeing the moment a promotional rate rolls over: a build from before the
 * rollover ships HTML quoting the old price while the client computes the new
 * one, which is a hydration mismatch and a visible flip of a number the page
 * presents as fact.
 *
 * Resolving on the server and passing the instant down means both sides use
 * the SAME moment, so the page is merely stale until the next deploy — which
 * is the behaviour the copy can honestly claim.
 */
function geminiModels(pricedAt: Date): GeminiModel[] {
  return MODEL_SPECS.flatMap((spec) => resolveSpec(spec, pricedAt))
}

/**
 * Specs with rates resolved. A model pricing.ts cannot price is DROPPED, not
 * shown at a guessed rate — advertised-models.test.ts already forbids naming
 * an unpriceable model on a public page, so this branch should be unreachable;
 * dropping is simply the honest thing to do if it ever is reached.
 */
function resolveSpec(spec: (typeof MODEL_SPECS)[number], pricedAt: Date): GeminiModel[] {
  const price = priceForModel(spec.id, pricedAt)
  if (!price) return []
  return [
    {
      ...spec,
      inRate: `$${price.inputPer1M.toFixed(2)}/1M in`,
      outRate: `$${price.outputPer1M.toFixed(2)}/1M out`,
      inputCostPer1M: price.inputPer1M,
      outputCostPer1M: price.outputPer1M,
    },
  ]
}

const TABS = [
  { id: 'briefing' as TabKey, label: 'Briefing', icon: LayoutDashboard },
  { id: 'worklog' as TabKey, label: 'Work log', icon: FileSpreadsheet },
  { id: 'capacity' as TabKey, label: 'Capacity', icon: Users },
  { id: 'kanban' as TabKey, label: 'Kanban', icon: Kanban },
  { id: 'roadmap' as TabKey, label: 'Roadmap', icon: Radio },
  { id: 'intel' as TabKey, label: 'Gemini AI', icon: Sparkles },
  { id: 'activity' as TabKey, label: 'Activity', icon: History },
]

const INITIAL_PEOPLE: EngineerCapacity[] = [
  {
    id: 'p1',
    name: 'Nuwan Perera',
    role: 'Lead Engineer',
    initials: 'NP',
    pct: 112,
    apps: [
      { name: 'Kestrel', pct: 60 },
      { name: 'Apollo', pct: 35 },
      { name: 'Tessera', pct: 17 },
    ],
  },
  {
    id: 'p2',
    name: 'Ishara Fernando',
    role: 'Senior Engineer',
    initials: 'IF',
    pct: 86,
    apps: [
      { name: 'Apollo', pct: 50 },
      { name: 'Kestrel', pct: 36 },
    ],
  },
  {
    id: 'p3',
    name: 'Dilini Jayasuriya',
    role: 'Product Designer',
    initials: 'DJ',
    pct: 70,
    apps: [
      { name: 'Tessera', pct: 45 },
      { name: 'Apollo', pct: 25 },
    ],
  },
  {
    id: 'p4',
    name: 'Kusal Mendis',
    role: 'Backend Engineer',
    initials: 'KM',
    pct: 45,
    apps: [{ name: 'Kestrel', pct: 45 }],
  },
]

const MEETINGS_DATA: MeetingIntelItem[] = [
  {
    id: 'm1',
    title: 'Sprint 14 Architecture Sync',
    time: '09:30 AM',
    duration: '41 min',
    actionItemEn: 'Unblock the database migration journal before sprint kickoff.',
    actionItemSi: 'Sprint kickoff එකට කලින් migration journal එක unblock කරන්න.',
    assignee: '@Nuwan',
    dueDate: 'Due 13 Aug',
    questionEn: 'Will read replica lagging affect the live SSE feed?',
    questionSi: 'Read replica lagging නිසා live SSE feed එකට බලපෑමක් වේද?',
  },
  {
    id: 'm2',
    title: 'Apollo Client Review',
    time: '11:00 AM',
    duration: '28 min',
    actionItemEn: 'Confirm webhook retry budget and backoff curves with client infra.',
    actionItemSi: 'Client infra සමඟ webhook retry budget එක තහවුරු කරන්න.',
    assignee: '@Ishara',
    dueDate: 'Due 14 Aug',
    questionEn: 'Are client rate limits enforced per tenant or IP?',
    questionSi: 'Client rate limits ක්‍රියාත්මක වන්නේ tenant හෝ IP අනුවද?',
  },
  {
    id: 'm3',
    title: 'Tessera Design Walkthrough',
    time: '03:30 PM',
    duration: '35 min',
    actionItemEn: 'Add dark mode contrast adjustments to header hierarchy.',
    actionItemSi: 'Header hierarchy සඳහා dark mode contrast adjustments එකතු කරන්න.',
    assignee: '@Dilini',
    dueDate: 'Due 15 Aug',
    questionEn: 'Should dark mode contrast ratio be raised to 7:1 for headers?',
    questionSi: 'Dark mode සඳහා headers contrast අනුපාතය 7:1 දක්වා වැඩි කළ යුතුද?',
  },
]

const INITIAL_TASKS: KanbanTask[] = [
  { id: 't1', title: 'OAuth 2.0 PKCE Audit', points: 3, tag: 'Security', column: 'todo' },
  { id: 't2', title: 'Drizzle v0.45 Migration', points: 5, tag: 'Backend', column: 'todo' },
  { id: 't3', title: 'Gemini Bilingual Audio Parser', points: 8, tag: 'AI', column: 'in_flight' },
  { id: 't4', title: 'Rate Limiter Redesign', points: 2, tag: 'Infra', column: 'shipped' },
]

type DetailTone = 'default' | 'alert' | 'primary'

interface BriefingDetailRow {
  primary: string
  secondary: string
  trailing: string
  tone?: DetailTone
}

interface BriefingStat {
  id: string
  value: string
  label: string
  meta: string
  icon: React.ComponentType<{ className?: string }>
  alert?: boolean
  detailTitle: string
  rows: BriefingDetailRow[]
}

const BRIEFING_STATS: BriefingStat[] = [
  {
    id: 'due',
    value: '4',
    label: 'Due soon',
    meta: '2 today · 2 this week',
    icon: Clock,
    detailTitle: 'Due in the next 7 days',
    rows: [
      { primary: 'Wire ephemeral Live token refresh', secondary: 'Kestrel · 5 pts · Nuwan Perera', trailing: 'Today 17:00', tone: 'primary' },
      { primary: 'Backfill work log for 12–14 Aug', secondary: 'Self-reported · 3 days open', trailing: 'Today 18:00', tone: 'primary' },
      { primary: 'Apollo webhook retry budget', secondary: 'Apollo · 3 pts · Ishara Fernando', trailing: 'Thu 14 Aug' },
      { primary: 'Sinhala glossary review pass', secondary: 'Tessera · 2 pts · Dilini Jayasuriya', trailing: 'Fri 15 Aug' },
    ],
  },
  {
    id: 'overdue',
    value: '1',
    label: 'Overdue',
    meta: '2 days late · Kestrel',
    icon: AlertTriangle,
    alert: true,
    detailTitle: 'Past its due date',
    rows: [
      { primary: 'Repair migration journal 0043 → 0046', secondary: 'Kestrel · 8 pts · Nuwan Perera', trailing: '2 days late', tone: 'alert' },
    ],
  },
  {
    id: 'owe',
    value: '2',
    label: 'Action items',
    meta: 'Extracted from meetings',
    icon: CheckCircle2,
    detailTitle: 'Gemini pulled these out of your meetings',
    rows: [
      { primary: 'Unblock the database migration journal', secondary: 'Sprint 14 Sync · 09:30', trailing: 'Due 13 Aug', tone: 'primary' },
      { primary: 'Confirm webhook retries with client infra', secondary: 'Apollo Review · 11:00', trailing: 'Due 14 Aug' },
    ],
  },
  {
    id: 'meetings',
    value: '3',
    label: 'Meetings today',
    meta: '1h 44m · Google synced',
    icon: Calendar,
    detailTitle: 'On the calendar today',
    rows: [
      { primary: 'Sprint 14 Architecture Sync', secondary: '4 attendees · recorded · 41 min', trailing: '09:30', tone: 'primary' },
      { primary: 'Apollo Client Review', secondary: '6 attendees · external · 28 min', trailing: '11:00' },
      { primary: 'Tessera Design Walkthrough', secondary: '3 attendees · recorded · 35 min', trailing: '15:30' },
    ],
  },
]

const BRIEFING_COMPILE = {
  at: '06:40',
  model: 'gemini-3.6-flash',
  inputTokens: 14200,
  outputTokens: 4940,
  rate: '$0.75 / $3.75',
}

const WORKLOG_WEEK = [
  { day: 'Mon 11 Aug', state: 'logged', hours: '100%', note: '[Kestrel] PKCE auth and token rotation' },
  { day: 'Tue 12 Aug', state: 'logged', hours: '100%', note: '[Apollo] Webhook dispatcher unit tests' },
  { day: 'Wed 13 Aug', state: 'logged', hours: '80%', note: '[Kestrel] Migration journal rollback review' },
  { day: 'Thu 14 Aug', state: 'logged', hours: '100%', note: '[Tessera] Design review and token fixes' },
  { day: 'Fri 15 Aug', state: 'logged', hours: '100%', note: '[Kestrel] Sprint 14 demo preparation' },
  { day: 'Sat 16 Aug', state: 'half', hours: '50%', note: 'Saturday half day · 4 hours' },
]

const ROADMAP_LANES = [
  { app: 'Kestrel', sprint: 'Sprint 14', start: 10, width: 45, detail: 'In flight · 34/41 pts', tone: 'primary' },
  { app: 'Apollo', sprint: 'Sprint 6', start: 30, width: 50, detail: 'Review pending · 18/34 pts', tone: 'warning' },
  { app: 'Tessera', sprint: 'Sprint 8', start: 60, width: 35, detail: 'Kickoff · 8/26 pts', tone: 'muted' },
]

const ACTIVITY_ROWS = [
  { who: 'NP', what: 'Shipped task: OAuth 2.0 PKCE Audit', where: 'Kestrel', when: '12m ago' },
  { who: 'IF', what: 'Logged daily work: [Apollo] Webhook retries (100%)', where: 'Daily Log', when: '44m ago' },
  { who: 'DJ', what: 'Exported sprint board to Notion workspace', where: 'Tessera', when: '2h ago' },
  { who: 'AI', what: 'Gemini synthesized 3 action items from Sprint Sync', where: 'Meetings', when: '4h ago' },
]

export function HeroShowcase({ pricedAt }: { pricedAt: string }) {
  /* One moment for every rate on the page, so no two disagree mid-render —
     and it comes from the server, so the client cannot compute a different
     one. See geminiModels above. */
  const GEMINI_MODELS = useMemo(() => geminiModels(new Date(pricedAt)), [pricedAt])
  const [activeTab, setActiveTab] = useState<TabKey>('briefing')
  const [selectedStat, setSelectedStat] = useState<string | null>('due')
  const [people, setPeople] = useState<EngineerCapacity[]>(INITIAL_PEOPLE)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<KanbanTask[]>(INITIAL_TASKS)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null)

  // Intel / Gemini AI state
  const [selectedModelIdx, setSelectedModelIdx] = useState(0)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [autoCycle, setAutoCycle] = useState(true)
  const [sinhalaMode, setSinhalaMode] = useState(false)
  const [currentMeetingIdx, setCurrentMeetingIdx] = useState(0)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [audioProgress, setAudioProgress] = useState(38)
  const [completedAction, setCompletedAction] = useState(false)
  const [resolvedQuestion, setResolvedQuestion] = useState(false)
  const soundwaveId = useId()

  const currentModel = GEMINI_MODELS[selectedModelIdx]
  const activeMeeting = MEETINGS_DATA[currentMeetingIdx]
  const activeBriefingStat = BRIEFING_STATS.find((s) => s.id === selectedStat)
  const speech = useSpeech()

  const textToSpeak = sinhalaMode
    ? `${activeMeeting.title}. ${activeMeeting.actionItemSi}`
    : `${activeMeeting.title}. ${activeMeeting.actionItemEn}`

  const handleToggleAudio = () => {
    if (isPlayingAudio) {
      speech.stop()
      setIsPlayingAudio(false)
    } else {
      setIsPlayingAudio(true)
      if (audioProgress >= 98) setAudioProgress(0)
      speech.speak(textToSpeak).catch(() => {})
    }
  }

  // Live Audio Progress animation interval
  useEffect(() => {
    if (!isPlayingAudio) return

    const interval = setInterval(() => {
      setAudioProgress((prev) => {
        if (prev >= 100) {
          setIsPlayingAudio(false)
          speech.stop()
          return 0
        }
        return prev + 1.8
      })
    }, 120)

    return () => clearInterval(interval)
  }, [isPlayingAudio, speech])

  const handleSelectTab = (tabId: TabKey) => {
    if (tabId !== 'intel' && isPlayingAudio) {
      speech.stop()
      setIsPlayingAudio(false)
    }
    setActiveTab(tabId)
  }

  const handleToggleLanguage = () => {
    const nextMode = !sinhalaMode
    setSinhalaMode(nextMode)
    if (isPlayingAudio) {
      speech.stop()
      const nextText = nextMode
        ? `${activeMeeting.title}. ${activeMeeting.actionItemSi}`
        : `${activeMeeting.title}. ${activeMeeting.actionItemEn}`
      speech.speak(nextText).catch(() => {})
      setAudioProgress(0)
    }
  }

  const handleSwitchMeeting = () => {
    const nextIdx = (currentMeetingIdx + 1) % MEETINGS_DATA.length
    setCurrentMeetingIdx(nextIdx)
    if (isPlayingAudio) {
      speech.stop()
      const nextMeeting = MEETINGS_DATA[nextIdx]
      const nextText = sinhalaMode
        ? `${nextMeeting.title}. ${nextMeeting.actionItemSi}`
        : `${nextMeeting.title}. ${nextMeeting.actionItemEn}`
      speech.speak(nextText).catch(() => {})
      setAudioProgress(0)
    }
  }

  // Auto-cycle models in Intel tab
  useEffect(() => {
    if (!autoCycle || activeTab !== 'intel') return
    const interval = setInterval(() => {
      setSelectedModelIdx((prev) => (prev + 1) % GEMINI_MODELS.length)
    }, 3800)
    return () => clearInterval(interval)
  }, [autoCycle, activeTab])

  // Capacity adjusters
  const adjustCapacity = (personId: string, delta: number) => {
    setPeople((prev) =>
      prev.map((p) => {
        if (p.id !== personId) return p
        const nextPct = Math.max(0, Math.min(160, p.pct + delta))
        return { ...p, pct: nextPct }
      }),
    )
  }

  const rebalanceTeam = () => setPeople(INITIAL_PEOPLE)

  // Kanban drag and drop
  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    setDraggedTaskId(id)
    e.dataTransfer.setData('text/plain', id)
  }
  const handleDragOver = (e: DragEvent<HTMLDivElement>, col: ColumnId) => {
    e.preventDefault()
    setDragOverColumn(col)
  }
  const handleDragLeave = () => setDragOverColumn(null)
  const handleDrop = (e: DragEvent<HTMLDivElement>, col: ColumnId) => {
    e.preventDefault()
    setDragOverColumn(null)
    if (!draggedTaskId) return
    setTasks((prev) => prev.map((t) => (t.id === draggedTaskId ? { ...t, column: col } : t)))
    setDraggedTaskId(null)
  }
  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverColumn(null)
  }
  const resetKanban = () => setTasks(INITIAL_TASKS)
  const addNewTask = () => {
    const newId = `t${Date.now()}`
    setTasks((prev) => [
      ...prev,
      { id: newId, title: 'AI Note Categorizer', points: 5, tag: 'Feature', column: 'todo' },
    ])
  }

  const briefingCost =
    (BRIEFING_COMPILE.inputTokens / 1_000_000) * 0.75 +
    (BRIEFING_COMPILE.outputTokens / 1_000_000) * 3.75

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/25 via-chart-1/15 to-primary/25 opacity-60 blur-xl transition-all" />

      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-3.5 sm:p-4.5 shadow-xl backdrop-blur-xl">
        {/* Header Bar */}
        <div className="mb-2.5 flex items-center justify-between border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-foreground">
              Live Studio Console
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium text-primary">
              7 Modules
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>Interactive Sandbox</span>
          </div>
        </div>

        {/* Dedicated 1-Line Segmented Tab Strip */}
        <div className="no-scrollbar mb-3.5 flex items-center gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 border border-border/50">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-2xs font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap',
                  isActive
                    ? 'bg-card text-foreground shadow-xs ring-1 ring-border/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                )}
              >
                <Icon className={cn('size-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: BRIEFING VIEW                                                      */}
        {/* ========================================================================= */}
        {activeTab === 'briefing' && (
          <div className="animate-in fade-in duration-200 flex flex-col gap-2.5">
            {/* Meta compiler banner */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-border/60 bg-muted/25 px-2.5 py-1.5 font-mono text-2xs text-muted-foreground">
              <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="size-3 text-primary" />
                Briefing {BRIEFING_COMPILE.at} · Asia/Colombo
              </span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{BRIEFING_COMPILE.model}</span>
                <span>{(BRIEFING_COMPILE.inputTokens + BRIEFING_COMPILE.outputTokens).toLocaleString('en-US')} tok</span>
                <span className="font-bold text-primary">≈${briefingCost.toFixed(4)}</span>
              </div>
            </div>

            {/* 4 Stat Tiles */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BRIEFING_STATS.map((stat) => {
                const Icon = stat.icon
                const isSelected = selectedStat === stat.id
                return (
                  <button
                    key={stat.id}
                    type="button"
                    onClick={() => setSelectedStat(isSelected ? null : stat.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex flex-col justify-between gap-1 rounded-xl border p-2.5 text-left transition-all cursor-pointer',
                      isSelected
                        ? stat.alert
                          ? 'border-destructive bg-destructive/10 ring-1 ring-destructive'
                          : 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border/60 bg-muted/30 hover:bg-muted/60',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('font-mono text-lg font-bold', stat.alert ? 'text-destructive' : 'text-foreground')}>
                        {stat.value}
                      </span>
                      <Icon className={cn('size-3.5', stat.alert ? 'text-destructive' : 'text-primary')} />
                    </div>
                    <div>
                      <div className={cn('text-2xs font-semibold', stat.alert ? 'text-destructive' : 'text-foreground')}>
                        {stat.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{stat.meta}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Selected tile rows */}
            {activeBriefingStat ? (
              <div className="rounded-xl border border-border/60 bg-card/50 p-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                  <span className="font-heading text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                    {activeBriefingStat.detailTitle}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {activeBriefingStat.rows.length} {activeBriefingStat.rows.length === 1 ? 'row' : 'rows'}
                  </span>
                </div>
                <ul className="flex flex-col divide-y divide-border/40">
                  {activeBriefingStat.rows.slice(0, 3).map((row) => (
                    <li key={row.primary} className="flex items-center justify-between gap-2 py-1.5 first:pt-1 last:pb-0">
                      <div className="min-w-0">
                        <div className="text-2xs font-medium text-foreground truncate">{row.primary}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{row.secondary}</div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.2 font-mono text-[10px] font-medium',
                          row.tone === 'alert'
                            ? 'bg-destructive/10 text-destructive'
                            : row.tone === 'primary'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {row.trailing}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Work log footer */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-border/60 bg-muted/25 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet className="size-3 text-primary" />
                Work log · <strong className="text-foreground">6 of 7</strong> days logged this week
              </span>
              <span className="flex items-center gap-1 text-primary">
                <ShieldCheck className="size-3 text-primary" />
                Nikini Poya excluded &bull; Sat 50%
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WORK LOG                                                           */}
        {/* ========================================================================= */}
        {activeTab === 'worklog' && (
          <div className="animate-in fade-in duration-200 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-heading text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                This week · Daily Studio Ledger
              </span>
              <Badge variant="outline" className="text-[10px]">5 of 6 owed days logged</Badge>
            </div>
            <div className="flex flex-col divide-y divide-border/50 rounded-xl border border-border/60 bg-card/50">
              {WORKLOG_WEEK.map((d) => (
                <div key={d.day} className="flex items-center gap-2.5 px-3 py-1.5">
                  <span className="w-16 shrink-0 font-mono text-2xs text-muted-foreground">{d.day}</span>
                  <span
                    aria-hidden
                    className={cn(
                      'h-3.5 w-1 shrink-0 rounded-full',
                      d.state === 'logged' && 'bg-primary',
                      d.state === 'half' && 'h-2 bg-primary',
                      d.state === 'open' && 'border border-dashed border-primary bg-transparent',
                      (d.state === 'off' || d.state === 'holiday') && 'bg-border',
                    )}
                  />
                  <span className="w-10 shrink-0 font-mono text-2xs font-bold text-foreground">{d.hours}</span>
                  <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">{d.note}</span>
                </div>
              ))}
            </div>
            <p className="rounded-lg border border-border/60 bg-muted/25 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
              Saturday counts as half a day (50%). Poya days and Sundays are studio-off.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CAPACITY & BURNOUT SIMULATOR                                       */}
        {/* ========================================================================= */}
        {activeTab === 'capacity' && (
          <div className="animate-in fade-in duration-200 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-heading text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                Team Bandwidth &amp; Real-Time Capacity Simulator
              </span>
              <button
                type="button"
                onClick={rebalanceTeam}
                className="flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <RotateCcw className="size-3" /> Reset Team
              </button>
            </div>

            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/60 bg-card/50">
              {people.map((person) => {
                const isSelected = selectedPersonId === person.id
                const isOver = person.pct > 100
                const isNear = person.pct >= 80 && person.pct <= 100

                return (
                  <div key={person.id} className="flex flex-col gap-1.5 p-2.5 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div
                        onClick={() => setSelectedPersonId(isSelected ? null : person.id)}
                        className="flex items-center gap-2 cursor-pointer min-w-36"
                      >
                        <div className="flex size-6 items-center justify-center rounded-full bg-primary/20 font-mono text-[10px] font-bold text-primary">
                          {person.initials}
                        </div>
                        <div>
                          <div className="text-2xs font-bold text-foreground">{person.name}</div>
                          <div className="text-[10px] text-muted-foreground">{person.role}</div>
                        </div>
                      </div>

                      <div className="flex min-w-[180px] flex-1 items-center gap-2.5">
                        <div className="flex-1">
                          <CapacityBar totalPct={person.pct} />
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => adjustCapacity(person.id, -10)}
                            className="flex size-4.5 items-center justify-center rounded bg-card border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary cursor-pointer"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustCapacity(person.id, 10)}
                            className="flex size-4.5 items-center justify-center rounded bg-card border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        {isOver ? (
                          <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0">
                            {person.pct}% Over
                          </Badge>
                        ) : isNear ? (
                          <Badge variant="outline" className="shrink-0 border-chart-1 text-chart-1 text-[10px] px-1.5 py-0">
                            {person.pct}% Near
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                            {person.pct}% Safe
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SPRINT KANBAN                                                      */}
        {/* ========================================================================= */}
        {activeTab === 'kanban' && (
          <div className="animate-in fade-in duration-200 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-heading text-2xs font-bold text-foreground">Kestrel &bull; Sprint 14 Board</span>
                <span className="font-mono text-[10px] text-muted-foreground">3 days left</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={addNewTask}
                  className="flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-[10px] text-primary hover:bg-primary hover:text-primary-foreground font-medium cursor-pointer"
                >
                  <Plus className="size-3" /> Add Task
                </button>
                <button
                  type="button"
                  onClick={resetKanban}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  <RotateCcw className="size-3" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['todo', 'in_flight', 'shipped'] as const).map((colId) => {
                const columnTasks = tasks.filter((t) => t.column === colId)
                const isOver = dragOverColumn === colId
                const colTitle = colId === 'todo' ? 'To Do' : colId === 'in_flight' ? 'In Flight' : 'Shipped'
                const isPrimary = colId === 'in_flight'

                return (
                  <div
                    key={colId}
                    onDragOver={(e) => handleDragOver(e, colId)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, colId)}
                    className={cn(
                      'flex flex-col gap-1.5 rounded-xl p-2 transition-all min-h-[140px]',
                      isOver
                        ? 'border-2 border-dashed border-primary bg-primary/10'
                        : 'border border-border/50 bg-muted/30',
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider px-1">
                      <span className={isPrimary ? 'text-primary' : 'text-muted-foreground'}>{colTitle}</span>
                      <span className="font-mono rounded-full bg-muted/80 px-1 py-0.2 text-muted-foreground text-[9px]">
                        {columnTasks.length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1">
                      {columnTasks.map((task) => {
                        const isDraggingThis = draggedTaskId === task.id
                        const isShipped = colId === 'shipped'

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              'group/task relative flex flex-col gap-1 rounded-lg border p-2 text-2xs shadow-2xs transition-all cursor-grab active:cursor-grabbing select-none',
                              isDraggingThis ? 'opacity-40 scale-95 border-dashed border-primary' : '',
                              isShipped
                                ? 'border-border/60 bg-card/70 opacity-80'
                                : isPrimary
                                ? 'border-primary/40 bg-card hover:border-primary'
                                : 'border-border/60 bg-card hover:border-border',
                            )}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className={cn('font-medium leading-snug text-2xs', isShipped ? 'line-through text-muted-foreground' : 'text-foreground')}>
                                {task.title}
                              </span>
                              <GripVertical className="size-3 shrink-0 text-muted-foreground/40 group-hover/task:text-foreground" />
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className={cn('font-mono font-bold', isPrimary ? 'text-primary' : '')}>
                                {task.points} pts
                              </span>

                              <div className="flex items-center gap-1">
                                <span className={cn('rounded px-1 py-0.2 font-mono text-[9px]', isPrimary ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                                  {task.tag}
                                </span>
                                {isShipped ? <CheckCircle2 className="size-3 text-primary" /> : null}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: ROADMAP TIMELINE                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'roadmap' && (
          <div className="animate-in fade-in duration-200 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-heading text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                Every Product on One Timeline
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">Aug — Sep 2026</span>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/50 p-2.5">
              {ROADMAP_LANES.map((lane) => (
                <div key={lane.app} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-2xs">
                    <span className="font-semibold text-foreground">
                      {lane.app} <span className="font-mono text-[10px] text-muted-foreground">({lane.sprint})</span>
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">{lane.detail}</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50">
                    <div
                      className={cn(
                        'absolute inset-y-0 rounded-full',
                        lane.tone === 'primary' && 'bg-primary',
                        lane.tone === 'warning' && 'bg-chart-1',
                        lane.tone === 'muted' && 'bg-muted-foreground/40',
                      )}
                      style={{ left: `${lane.start}%`, width: `${lane.width}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="relative mt-1 h-3">
                <div className="absolute inset-x-0 top-0 h-px bg-border" />
                <span className="absolute -top-0.5 left-[34%] h-2 w-px bg-primary" aria-hidden />
                <span className="absolute top-1 left-[34%] -translate-x-1/2 font-mono text-[9px] text-primary">
                  today
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: GEMINI AI ENGINE (Bilingual Notes & Multimodal Audio)              */}
        {/* ========================================================================= */}
        {activeTab === 'intel' && (
          <div className="animate-in fade-in duration-200 flex flex-col gap-2.5">
            {/* Top Bar: Model Selector + Language Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 p-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 rounded-lg border border-primary/40 bg-card px-2.5 py-1 text-left text-2xs font-semibold hover:border-primary cursor-pointer shadow-2xs"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  <span className="text-foreground font-bold">{currentModel.label}</span>
                  <span className="rounded bg-primary/10 px-1 py-0.2 font-mono text-[9px] text-primary">
                    {currentModel.tag}
                  </span>
                  <ChevronDown className={cn('size-3 text-muted-foreground transition-transform', isDropdownOpen && 'rotate-180')} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl divide-y divide-border/50 max-h-60 overflow-y-auto">
                    {GEMINI_MODELS.map((model, idx) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setSelectedModelIdx(idx)
                          setIsDropdownOpen(false)
                        }}
                        className={cn(
                          'flex w-full flex-col gap-0.5 rounded-lg p-1.5 text-left transition-colors cursor-pointer text-2xs',
                          selectedModelIdx === idx ? 'bg-primary/15' : 'hover:bg-muted/60',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{model.label}</span>
                          <span className="font-mono text-[9px] text-primary">{model.speedLatency}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{model.inRate} / {model.outRate}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAutoCycle(!autoCycle)}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] font-semibold transition-all cursor-pointer',
                    autoCycle ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Activity className="size-3" />
                  <span>{autoCycle ? 'Cycling (3.8s)' : 'Pause'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleLanguage}
                  className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium hover:border-primary cursor-pointer"
                >
                  <Languages className="size-3 text-primary" />
                  <span>{sinhalaMode ? 'English' : 'සිංහල'}</span>
                </button>
              </div>
            </div>

            {/* Audio Waveform Scrubber with Playback */}
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-2">
              <button
                type="button"
                onClick={handleToggleAudio}
                aria-label={isPlayingAudio ? 'Pause audio note' : 'Play audio note'}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg transition-all cursor-pointer shadow-xs',
                  isPlayingAudio ? 'bg-primary text-primary-foreground animate-pulse' : 'bg-primary/15 text-primary hover:bg-primary/25',
                )}
              >
                {isPlayingAudio ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
              </button>

              {/* Live Waveform Track with Click-to-Seek */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const clickX = e.clientX - rect.left
                  const newPct = Math.max(0, Math.min(100, (clickX / rect.width) * 100))
                  setAudioProgress(newPct)
                }}
                className="group relative flex items-center gap-0.75 h-8 px-2 bg-muted/40 rounded-lg cursor-pointer hover:bg-muted/70 flex-1 overflow-hidden"
              >
                {[35, 60, 20, 80, 95, 40, 70, 50, 85, 30, 90, 65, 45, 75, 100, 55, 30, 65, 80, 45, 90, 70, 50, 85, 40, 60, 45, 75, 90, 60, 30, 80].map((h, i) => {
                  const isActive = (i / 32) * 100 <= audioProgress
                  const animatedHeight = isPlayingAudio
                    ? Math.max(20, Math.min(100, h + ((i % 3) - 1) * 20 * (isActive ? 1 : 0.5)))
                    : h

                  return (
                    <div
                      key={`${soundwaveId}-wave-${i}`}
                      className={cn(
                        'flex-1 rounded-full transition-all duration-150',
                        isActive ? 'bg-primary shadow-xs' : 'bg-muted-foreground/30',
                      )}
                      style={{ height: `${animatedHeight}%` }}
                    />
                  )
                })}

                {/* Progress highlight indicator */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-primary/5 pointer-events-none transition-all"
                  style={{ width: `${audioProgress}%` }}
                />
              </div>

              {/* Time counter & Engine badge */}
              <div className="hidden sm:flex flex-col items-end shrink-0 font-mono text-[10px] text-muted-foreground pr-1">
                <span className="font-semibold text-foreground">
                  00:{String(Math.floor((audioProgress / 100) * 8)).padStart(2, '0')} / 00:08
                </span>
                <span className="text-[9px] text-primary flex items-center gap-0.5">
                  <Volume2 className="size-2.5" />
                  {speech.engine === 'gemini' ? 'Gemini 3.1 TTS' : 'Audio Out'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSwitchMeeting}
                className="flex items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-1.5 text-[10px] text-foreground hover:border-primary cursor-pointer shrink-0"
              >
                <span>{activeMeeting.title.split(' ')[0]}</span>
                <RotateCcw className="size-2.5 text-primary" />
              </button>
            </div>

            {/* AI Action Item Card */}
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setCompletedAction(!completedAction)}
                className={cn(
                  'rounded-xl border p-2.5 text-left transition-all cursor-pointer flex flex-col justify-between',
                  completedAction ? 'border-primary/80 bg-primary/10' : 'border-border/60 bg-muted/20 hover:border-primary/40',
                )}
              >
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] font-bold text-primary uppercase">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Action Item ({activeMeeting.dueDate})
                    </span>
                    <span className="text-[9px] underline">
                      {completedAction ? 'Done ✓' : 'Click to complete'}
                    </span>
                  </div>
                  <p className={cn('mt-1 text-2xs leading-snug', completedAction ? 'line-through text-muted-foreground' : 'text-foreground')}>
                    {sinhalaMode ? activeMeeting.actionItemSi : activeMeeting.actionItemEn}
                  </p>
                </div>
                <span className="mt-1.5 inline-block w-fit rounded bg-primary/10 px-1 py-0.2 font-mono text-[9px] text-primary font-bold">
                  {activeMeeting.assignee}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setResolvedQuestion(!resolvedQuestion)}
                className={cn(
                  'rounded-xl border p-2.5 text-left transition-all cursor-pointer flex flex-col justify-between',
                  resolvedQuestion ? 'border-chart-1/80 bg-chart-1/10' : 'border-border/60 bg-muted/20 hover:border-chart-1/40',
                )}
              >
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] font-bold text-chart-1 uppercase">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="size-3" /> Prep Question
                    </span>
                    <span className="text-[9px] underline">
                      {resolvedQuestion ? 'Resolved ✓' : 'Click to resolve'}
                    </span>
                  </div>
                  <p className={cn('mt-1 text-2xs leading-snug', resolvedQuestion ? 'line-through text-muted-foreground' : 'text-foreground')}>
                    {sinhalaMode ? activeMeeting.questionSi : activeMeeting.questionEn}
                  </p>
                </div>
                <span className="mt-1.5 inline-block w-fit rounded bg-chart-1/10 px-1 py-0.2 font-mono text-[9px] text-chart-1 font-bold">
                  Next Sync
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: ACTIVITY AUDIT FEED                                                */}
        {/* ========================================================================= */}
        {activeTab === 'activity' && (
          <div className="animate-in fade-in duration-200 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-heading text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                Live Studio Audit Stream
              </span>
              <Badge variant="outline" className="text-[10px]">{ACTIVITY_ROWS.length} recent</Badge>
            </div>
            <div className="flex flex-col divide-y divide-border/50 rounded-xl border border-border/60 bg-card/50">
              {ACTIVITY_ROWS.map((row, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-1.5">
                  <span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-muted/60 font-mono text-[10px] font-bold text-foreground">
                    {row.who}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-2xs font-medium text-foreground">{row.what}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {row.where} · {row.when}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Status Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3 text-primary" />
            <span>Role-gated server actions &bull; AES-256 encrypted</span>
          </div>
          <span className="font-mono text-[10px]">Alta Vision Internal Studio Engine</span>
        </div>
      </div>
    </div>
  )
}
