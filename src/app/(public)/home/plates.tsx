import type { ReactNode } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { CapacityBar, capacityBand } from '@/features/people/components/capacity-bar'
import { bilingualText } from '@/features/meetings/components/meeting-chips'
import { cn } from '@/lib/utils'

/**
 * The three "plates" on the public home page — book plates, not hero shots.
 *
 * Every one of them is a DOM reconstruction assembled from the app's own
 * primitives (CapacityBar, Avatar, Badge, the --event-* and --tag-* rules)
 * rather than a screenshot. A real screenshot of LogPup would put real staff
 * names, real allocation percentages and real meeting content on a page that
 * is served with no session — a privacy leak wearing a marketing costume.
 * Reconstructions also come out theme-aware for free, stay sharp at any DPR,
 * are real selectable text for a screen reader, and add no network assets at
 * all, which matters on the one route that must render for a reviewer with
 * JavaScript and images off.
 *
 * The cast below is shared across all three plates on purpose. Inconsistent
 * mock data between panels is the thing that makes a reconstruction read as
 * fabricated; the same six people on the same three apps in the same week
 * reads as one system. The allocation arithmetic genuinely adds up — every
 * row's chips sum to its bar — for the same reason.
 */

/** Sample week the three plates all describe. Fixed strings, never `new
 *  Date()`: a date that drifts with the clock would make the plates disagree
 *  with each other the moment the page is cached. */
const AS_OF = '12 Aug 2026'

/**
 * Per-app identity classes, written out as complete literals rather than
 * built by interpolation. Tailwind v4 scans source text for class names, so
 * `border-l-event-${n}` would compile to nothing and the rules would vanish.
 */
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

/* --- shared plate chrome ------------------------------------------------ */

/**
 * Where the caption sits relative to the frame at desktop. The three plates
 * alternate (indented-left, hanging-right, full-bleed) so the spread has a
 * rhythm instead of three identical slabs; below `lg` all three collapse to
 * label / frame / caption in reading order, which is why the caption is
 * placed by grid coordinates rather than by DOM position.
 */
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
        <span className="font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </span>
        {/* No browser chrome, no traffic lights, no bezel, no tilt, and no
            shadow: a plate in a book sits on the page, it does not float above
            it. In light theme --card is only about a 2% luminance step off
            --background, so this hairline is doing the entire job of framing
            the plate on its own — it is deliberately a real border rather than
            a ring so it reads at the same weight as every other rule here. */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-none md:p-6 lg:p-8">
          {children}
        </div>
      </div>
      <figcaption className={cn('text-2xs text-muted-foreground', CAPTION_PLACEMENT[captionSide])}>
        {caption}
      </figcaption>
    </figure>
  )
}

/** The band word, in the house treatment from capacity-card.tsx — outline +
 *  full-strength --chart-1 border + --foreground ink, because --chart-1 as
 *  text is under 3:1 on --card in light theme. Colour is never the only
 *  signal: the word is here, and CapacityBar's aria-label names the band. */
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

/* --- Plate I: the briefing ---------------------------------------------- */

/** The real four, in the real order, with the real meta strings — see
 *  buildMyDayStats in src/features/dashboard/my-day-stats.ts. Inventing
 *  plausible-sounding stats here would have put a claim on the page that the
 *  product does not make. */
const BRIEFING_STATS = [
  { label: 'Due soon', value: 4, meta: 'today & this week', alert: false },
  { label: 'Overdue', value: 1, meta: 'oldest 2 days late', alert: true },
  { label: 'I owe', value: 2, meta: 'follow-ups open', alert: false },
  { label: 'Meetings today', value: 3, meta: 'on the calendar', alert: false },
] as const

const BRIEFING_CAPACITY = [
  { name: 'Nuwan Perera', pct: 112 },
  { name: 'Ishara Fernando', pct: 86 },
  { name: 'Dilini Jayasuriya', pct: 65 },
  { name: 'Kasun Silva', pct: 40 },
] as const

const BRIEFING_MEETINGS = [
  { time: '09:30', app: 'kestrel', title: 'Sprint 14 check-in' },
  { time: '11:00', app: 'apollo', title: 'Client review' },
  { time: '15:30', app: 'tessera', title: 'Design walkthrough' },
] as const satisfies readonly { time: string; app: AppKey; title: string }[]

function PanelLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium text-foreground">{children}</span>
}

export function PlateBriefing() {
  return (
    <Plate
      label="Plate I"
      captionSide="start"
      caption="— Plate I. Interface reconstruction, sample data."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BRIEFING_STATS.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-0.5 rounded-md border border-border bg-muted p-3"
          >
            <span
              className={cn(
                'font-mono text-xl font-semibold',
                stat.alert ? 'text-destructive' : 'text-foreground',
              )}
            >
              {stat.value}
            </span>
            <span className="text-xs text-foreground">{stat.label}</span>
            {/* Held back below sm so a 140px tile stays two lines rather than
                three — the label is the load-bearing half of the pair. */}
            <span className="hidden text-2xs text-muted-foreground sm:block">{stat.meta}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <PanelLabel>Team capacity</PanelLabel>
          <div className="flex flex-col gap-3">
            {BRIEFING_CAPACITY.map((row) => (
              <div key={row.name} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="text-sm text-foreground sm:w-32 sm:shrink-0 sm:truncate">
                  {row.name}
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <CapacityBar totalPct={row.pct} />
                  <BandBadge pct={row.pct} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <PanelLabel>Today</PanelLabel>
          <div className="flex flex-col gap-2">
            {BRIEFING_MEETINGS.map((meeting) => (
              <div
                key={meeting.time}
                className={cn('border-l-2 py-0.5 pl-3', APP_RULE[meeting.app])}
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-xs text-muted-foreground">{meeting.time}</span>
                  {/* The app is named in words as well as tinted, so the hue
                      is reinforcement and never the only thing carrying it. */}
                  <span className={cn('text-sm font-medium', APP_INK[meeting.app])}>
                    {APP_LABEL[meeting.app]}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">{meeting.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Plate>
  )
}

/* --- Plate II: capacity -------------------------------------------------- */

const ALLOCATIONS = [
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
  { name: 'Kasun Silva', title: 'Engineer', chips: [{ app: 'apollo', pct: 40 }] },
  {
    name: 'Amaya Wickrama',
    title: 'QA engineer',
    chips: [
      { app: 'kestrel', pct: 30 },
      { app: 'apollo', pct: 25 },
    ],
  },
  { name: 'Ruwan Bandara', title: 'Engineer', chips: [{ app: 'tessera', pct: 75 }] },
] as const satisfies readonly {
  name: string
  title: string
  chips: readonly { app: AppKey; pct: number }[]
}[]

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function PlateCapacity() {
  return (
    <Plate
      label="Plate II"
      captionSide="end"
      caption="— Plate II. Interface reconstruction, sample data."
    >
      {/* Inert on purpose: nothing in a plate is reachable without a session,
          so it is rendered as a label rather than as a control that would lie
          about being clickable. */}
      <div className="hidden font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase lg:block">
        As of · {AS_OF}
      </div>

      <div className="flex flex-col divide-y divide-border lg:mt-4">
        {ALLOCATIONS.map((row) => {
          const total = row.chips.reduce((sum, chip) => sum + chip.pct, 0)
          return (
            <div
              key={row.name}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 items-center gap-2 sm:w-52 sm:shrink-0">
                <Avatar size="sm">
                  <AvatarFallback>{initials(row.name)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
                  {/* Progressive disclosure rather than a squeezed six-column
                      row: at 375px the frame has about 295px inside it, and
                      the title and chip stack are the two parts a phone can
                      lose without the row stopping making sense. */}
                  <span className="hidden truncate text-xs text-muted-foreground sm:block">
                    {row.title}
                  </span>
                </div>
              </div>

              <div className="hidden shrink-0 flex-wrap gap-1.5 lg:flex lg:w-56">
                {row.chips.map((chip) => (
                  <span
                    key={chip.app}
                    className={cn(
                      'rounded-sm border-l-2 bg-muted py-0.5 pr-1.5 pl-2 font-mono text-2xs text-muted-foreground uppercase',
                      APP_RULE[chip.app],
                    )}
                  >
                    {APP_LABEL[chip.app]} {chip.pct}%
                  </span>
                ))}
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-3">
                {/* CapacityBar prints its own percentage in font-mono at the
                    right of the track, so the badge beside it carries the band
                    as a WORD only — repeating the number would just put the
                    same fact on the row twice. */}
                <CapacityBar totalPct={total} />
                <BandBadge pct={total} />
              </div>
            </div>
          )
        })}
      </div>
    </Plate>
  )
}

/* --- Plate III: the write-up --------------------------------------------- */

const WRITEUP_BLOCKS = [
  {
    kind: 'Action',
    accent: 'border-l-tag-action',
    ink: 'text-tag-action',
    line: 'Nuwan to unblock the migration journal before Thursday standup.',
    chip: 'Due 14 Aug',
    note: null,
  },
  {
    kind: 'Discussion',
    accent: 'border-l-tag-discussion',
    ink: 'text-tag-discussion',
    line: 'Whether the Notion export stays one-way. Agreed: one-way, sprint-scoped only.',
    chip: null,
    note: null,
  },
  {
    kind: 'Question',
    accent: 'border-l-tag-question',
    ink: 'text-tag-question',
    line: 'Who owns the backup restore drill?',
    chip: null,
    note: 'Unanswered — resurfaces as prep before the next Kestrel meeting.',
  },
  {
    kind: 'Term',
    accent: 'border-l-tag-term',
    ink: 'text-tag-term',
    line: 'soft delete — a row marked removed but kept, so it can be restored.',
    chip: null,
    note: null,
  },
] as const

const WRITEUP_HEADER = ['Kestrel', 'Sprint 14 check-in', '12 Aug', '41 min'] as const

export function PlateWriteup() {
  return (
    <Plate
      label="Plate III"
      captionSide="below"
      caption="— Plate III. Interface reconstruction, sample data. Transcription runs on a Google Gemini API key each user supplies themselves."
    >
      {/* Four discrete spans in a wrapping row, not one glued string with
          separators baked in: at 375px this header is wider than the frame,
          and a wrapped list of labels reads as editorial while a wrapped
          string with an orphaned "·" reads as broken. */}
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 pl-3', APP_RULE.kestrel)}>
        {WRITEUP_HEADER.map((cell, index) => (
          <span key={cell} className="flex items-center gap-3">
            {index > 0 ? (
              <span aria-hidden className="hidden text-muted-foreground sm:inline">
                ·
              </span>
            ) : null}
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

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {WRITEUP_BLOCKS.map((block) => (
          <div key={block.kind} className={cn('flex flex-col gap-1.5 border-l-2 pl-3', block.accent)}>
            <span className={cn('font-mono text-2xs tracking-[0.18em] uppercase', block.ink)}>
              {block.kind}
            </span>
            <p className="text-sm text-foreground">{block.line}</p>
            {block.chip ? (
              <span className="w-fit rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                {block.chip}
              </span>
            ) : null}
            {block.note ? <p className="text-2xs text-muted-foreground">{block.note}</p> : null}
          </div>
        ))}

        <div className="flex flex-col gap-1.5 border-l-2 border-l-border pl-3 lg:col-span-2">
          <span className="font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">
            Sinhala output
          </span>
          {/* `bilingualText` rather than a locally chosen leading: Sinhala
              glyphs need more room than Latin, and Tailwind's utilities layer
              outranks anything set in @layer base, so the leading has to
              travel with the class. The English gloss beneath means the
              Sinhala is never the only thing carrying the meaning. */}
          <p className={cn(bilingualText, 'text-foreground')} lang="si">
            ඊළඟ sprint එකට කලින් migration journal එක හදන්න ඕන.
          </p>
          <p className="text-sm text-muted-foreground">
            The migration journal needs fixing before the next sprint.
          </p>
        </div>
      </div>
    </Plate>
  )
}
