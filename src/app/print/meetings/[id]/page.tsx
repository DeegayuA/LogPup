import { isAdminRole } from '@/features/auth/capabilities'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PawPrint } from 'lucide-react'
import { getSession } from '@/lib/session'
import { LK_TIMEZONE } from '@/lib/lk-holidays'
import { MarkdownLite } from '@/components/markdown-lite'
import { AltaVisionLogo } from '@/components/brand/alta-vision-logo'
import { getMeetingById } from '@/features/meetings/queries'
import {
  canReadMeetingIntel,
  getMeetingIntel,
  getMeetingNoteTimeline,
  type NoteSegmentView,
  type SpeakerRow,
  type TaskSuggestionView,
} from '@/features/meetings/ai-actions'
import { resolveSpeakerName } from '@/features/meetings/notes'
import { splitBilingualSummary } from '@/features/meetings/components/meeting-panels-model'
import type { ActionRow } from '@/features/meetings/components/meeting-notes-model'
import { listActiveUsers } from '@/features/people/queries'
import { PrintToolbar } from './print-toolbar'
import { RecordTimeline, type RecordRow } from './record-timeline'
import { PrintSpeakerNames } from './print-speaker-names'
import {
  EditableAgenda,
  EditableAttendees,
  EditableTitle,
  type MeetingEditBase,
} from './print-masthead-edit'

/**
 * Print-clean A4 export of a meeting's write-up — the "PDF" feature.
 *
 * Deliberately a browser-printed page rather than a PDF library: the team's
 * notes code-switch into Sinhala mid-sentence, and browser text shaping is
 * the only PDF renderer that gets complex scripts right (fontkit-based
 * libraries garble them). `@page { size: A4 }` makes the output real A4 and
 * the browser paginates naturally — one page for a stand-up, many for a
 * workshop.
 *
 * Two levels, chosen by the toolbar (`?full=1`): Summary is the AI write-up;
 * Full record appends every stored detail — the complete transcript and the
 * whole note timeline — straight from the database, with no AI pass.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The saved PDF's FILENAME.
 *
 * Every browser derives the default filename in its print dialog from
 * `document.title`, so a static title meant every export — every meeting,
 * summary or full record — landed in Downloads as the same
 * "Meeting minutes — LogPup.pdf", overwriting or numbering the last one. The
 * title is therefore built per meeting, and says which of the two levels it
 * is, because those are two different documents about the same meeting.
 *
 * Characters that browsers and filesystems mangle (`/ \ : * ? " < > |`) are
 * replaced rather than stripped: a meeting called "Design / QA sync" would
 * otherwise put a path separator in the download name.
 */
export async function generateMetadata(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams])
  if (!UUID_RE.test(id)) return { title: 'Meeting minutes — LogPup' }

  const meeting = await getMeetingById(id)
  if (!meeting) return { title: 'Meeting minutes — LogPup' }

  const day = fileDateFmt.format(meeting.startsAt) // 2026-08-12
  const level = search.full === '1' ? 'full record' : 'summary'
  return { title: `${day} ${safeForFilename(meeting.title)} — ${level}` }
}

/** Replaces the characters a download filename cannot carry. */
function safeForFilename(text: string): string {
  return text.replace(/[/\\:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
}

const dateFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: LK_TIMEZONE,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: LK_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})
/** yyyy-mm-dd, so saved files sort chronologically in a folder listing. */
const fileDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: LK_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const stampFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: LK_TIMEZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

function durationLabel(startsAt: Date, endsAt: Date): string {
  const minutes = Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** "12:34" offset into the recording, for voice segments that carry one. */
function msToClock(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * The one name a segment prints under.
 *
 * A voice can be named WITHOUT having an account — "not a listed attendee",
 * named by hand on the export page — and that name lives on the speaker
 * mapping row, not on the segment, because a name with no account has no users
 * row for the segment query to join against. Reading `segment.speakerName`
 * alone therefore left a typed name invisible and the transcript still saying
 * "Speaker 1", with the name stored and doing nothing. The precedence comes
 * from the shared resolveSpeakerName rather than a copy of it, so this
 * document and the meeting's own timeline can never call one voice two things.
 */
function segmentWho(segment: NoteSegmentView, speakers: SpeakerRow[]): string {
  if (segment.source === 'typed') return segment.createdByName ?? 'Typed note'
  if (segment.source === 'ai') return 'AI write-up'
  const mapping = speakers.find((row) => row.label === segment.speakerLabel)
  return (
    resolveSpeakerName({
      userName: segment.speakerName ?? mapping?.userName,
      displayName: mapping?.displayName,
      label: segment.speakerLabel,
    }) ?? 'Voice'
  )
}

const SOURCE_LABEL: Record<string, string> = {
  voice: 'Voice',
  typed: 'Typed',
  ai: 'AI',
}

/**
 * A numbered section rule.
 *
 * Numbering is what makes a printed document referenceable — "see section 3"
 * is how people talk about minutes in a thread, and an unnumbered stack of
 * grey all-caps labels gives them nothing to point at. The number is carried
 * by the caller rather than a counter in here, because sections are
 * conditional and only the render site knows which ones actually appear.
 */
function SectionHeading({
  n,
  control,
  children,
}: {
  n: number
  /** Screen-only composition control; never reaches paper. */
  control?: React.ReactNode
  children: React.ReactNode
}) {
  // The rule and the row live on the wrapper, not the h2, so the control can
  // sit on the same line WITHOUT being inside the heading — a link nested in
  // an h2 joins its accessible name, and screen-reader heading navigation
  // would announce "3 Glossary Hide" for every section on the page.
  return (
    <div className="doc-heading mb-2.5 flex items-baseline gap-2.5 border-b border-[color:var(--doc-rule)] pb-1">
      <h2 className="flex flex-1 items-baseline gap-2.5">
        <span className="font-heading text-[11pt] font-bold tabular-nums text-[var(--doc-brand)]">
          {n}
        </span>
        <span className="text-[8.5pt] font-semibold uppercase tracking-[0.12em] text-[var(--doc-ink-soft)]">
          {children}
        </span>
      </h2>
      {control ? <span className="shrink-0 print:hidden">{control}</span> : null}
    </div>
  )
}

/** How a section is named to a person composing the document. */
const SECTION_LABEL: Record<string, string> = {
  summary: 'Summary',
  actions: 'Action items',
  discussion: 'Discussion highlights',
  questions: 'Questions for next time',
  glossary: 'Glossary',
  screens: 'Shared screens',
  timeline: 'Record timeline',
  transcript: 'Full transcript',
}

/**
 * One section of the document, and its screen-only composition controls.
 *
 * Hiding is not "display: none in the print stylesheet" — the section is not
 * rendered at all, because a hidden section must also surrender its number so
 * the printed document reads 1, 2, 3 rather than 1, 2, 4. What remains on
 * screen while editing is a stub, so somebody can put the section back; it
 * carries `print:hidden` like every other control here, since paper gets the
 * document and never the mechanism that shaped it.
 */
function DocSection({
  sectionKey,
  n,
  heading,
  editing,
  hidden,
  hideHref,
  showHref,
  children,
}: {
  sectionKey: string
  n: number
  heading: React.ReactNode
  editing: boolean
  hidden: boolean
  hideHref: string
  showHref: string
  children: React.ReactNode
}) {
  if (hidden) {
    if (!editing) return null
    return (
      <div className="doc-stub mb-3 flex items-center justify-between gap-3 print:hidden">
        <span className="text-[9pt] text-[var(--doc-ink-soft)]">
          <span className="font-semibold">{SECTION_LABEL[sectionKey] ?? sectionKey}</span> — hidden,
          and left out of the printed document
        </span>
        <Link href={showHref} className="doc-chip" scroll={false}>
          Show
        </Link>
      </div>
    )
  }

  return (
    <section className="mb-6">
      <SectionHeading
        n={n}
        control={
          editing ? (
            <Link
              href={hideHref}
              scroll={false}
              className="doc-chip"
              aria-label={`Hide ${SECTION_LABEL[sectionKey] ?? sectionKey} from this document`}
            >
              Hide
            </Link>
          ) : null
        }
      >
        {heading}
      </SectionHeading>
      {children}
    </section>
  )
}

/** A query parameter's values, whether Next handed over one or several. */
function readParam(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * The three fates of an action item, as a pill.
 *
 * The state is spelled out in words inside every pill, and the three border
 * TREATMENTS differ (solid accent / dashed / solid neutral) rather than only
 * the fill colour — a document this size gets photocopied and faxed, and both
 * flatten all three tints to the same pale grey. Colour is the fastest read
 * for whoever holds the colour original; it is never the only read.
 */
function StatusPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return <span className={`doc-pill doc-pill-${tone}`}>{children}</span>
}

type PillTone = 'tracked' | 'proposed' | 'untracked'

function suggestionStatus(s: TaskSuggestionView): { tone: PillTone; label: string } {
  return s.status === 'accepted'
    ? { tone: 'tracked', label: 'Tracked' }
    : { tone: 'proposed', label: 'Proposed' }
}

export default async function MeetingPrintPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams])
  if (!UUID_RE.test(id)) notFound()
  const full = search.full === '1'
  // Composing the document is a mode you enter, not the resting state: the
  // page's job on arrival is to BE the document, so the hide controls stay
  // out of the way until somebody asks for them.
  const editing = search.edit === '1'

  const session = await getSession()
  if (!session?.user) notFound()

  const meeting = await getMeetingById(id)
  if (!meeting) notFound()
  if (!(await canReadMeetingIntel(session.user, meeting))) notFound()

  const intel = await getMeetingIntel(id)
  const notes = intel.ok ? intel.data.notes : null
  const suggestions = intel.ok
    ? intel.data.suggestions.filter((s) => s.status !== 'dismissed')
    : []
  const untracked: ActionRow[] = intel.ok ? intel.data.untrackedActions : []
  // Already fetched by getMeetingIntel; the export simply never rendered them,
  // so a screen-share meeting printed without the slides it was about.
  const screenshots = intel.ok ? intel.data.screenshots : []

  // The full record is only fetched when asked for — a long meeting's
  // complete timeline and transcript can be hundreds of KB.
  const timeline = full ? await getMeetingNoteTimeline(id) : null
  const segments: NoteSegmentView[] = timeline?.ok ? timeline.data.segments : []
  // Label -> person, however that person was identified: a mapped account, or
  // a name typed for somebody who has none. Both the naming control and the
  // printed transcript read from this one list.
  const speakerRows: SpeakerRow[] = timeline?.ok ? timeline.data.speakers : []
  // Editing rights mirror editNoteSegment's own gate (canManageMeeting):
  // admin or the meeting's creator. Attendees can read this page but not
  // rewrite the record.
  const canEdit = isAdminRole(session.user.role) || meeting.createdBy === session.user.id

  const { en, si } = splitBilingualSummary(notes?.summary)
  const summaryBlocks: { lang: 'en' | 'si'; content: string }[] = []
  if (notes?.summary) {
    if (si.trim()) {
      if (en.trim()) summaryBlocks.push({ lang: 'en', content: en })
      summaryBlocks.push({ lang: 'si', content: si })
    } else {
      summaryBlocks.push({ lang: 'en', content: notes.summary })
    }
  }

  const discussionPeople = (notes?.perPerson ?? []).filter((p) => p.points.length > 0)
  const questions = notes?.questions ?? []
  const terms = notes?.terms ?? []
  const exportedAt = new Date()
  // A handle somebody can quote in an email or a filing system — "the export
  // ref LP-3F2A9C" — that also leads straight back to the meeting row. The
  // UUID's first block is unique across any realistic number of meetings and
  // short enough to read down a phone.
  const docRef = `LP-${id.slice(0, 8).toUpperCase()}`

  // Sections this meeting actually HAS, in document order. A meeting with no
  // glossary has no glossary — which is a different thing from somebody
  // choosing to leave the glossary out, and the two must never be confused:
  // only what is on this list can be hidden, offered as hideable, or counted
  // in the "n sections hidden" tally.
  const availableSections = [
    'summary',
    suggestions.length + untracked.length > 0 ? 'actions' : null,
    discussionPeople.length > 0 ? 'discussion' : null,
    questions.length > 0 ? 'questions' : null,
    terms.length > 0 ? 'glossary' : null,
    full && screenshots.length > 0 ? 'screens' : null,
    full && segments.length > 0 ? 'timeline' : null,
    // The raw transcript ONLY when the timeline cannot stand in for it.
    // Voice segments ARE that transcript, split by speaker turn and carrying
    // attribution and offsets the flat string does not — printing both put
    // the same words on paper twice, once worse. It still prints when there
    // are no segments at all (an older analysis, or a meeting transcribed
    // before the timeline existed), so nothing is ever lost.
    full && notes?.transcript && segments.length === 0 ? 'transcript' : null,
  ].filter((key): key is string => key !== null)

  // Anything in ?hide= that this meeting does not have is dropped rather than
  // trusted: a stale bookmark, or a link forwarded between two meetings, must
  // not make the page count sections that were never there.
  const hiddenSections = new Set(
    readParam(search.hide)
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter((value) => availableSections.includes(value)),
  )

  // Numbers are assigned BEFORE rendering, from the sections that will
  // actually appear, in the order they appear — rather than by a counter
  // incremented as JSX evaluates, which mutates during render (React forbids
  // it, and it would silently double-count under Strict Mode's double
  // invocation). Hidden sections drop out HERE, which is what keeps the
  // printed numbering contiguous: hide 3 and the old 4 and 5 become 3 and 4.
  const presentSections = availableSections.filter((key) => !hiddenSections.has(key))
  const sectionNo = (key: string) => presentSections.indexOf(key) + 1
  const isShown = (key: string) => !hiddenSections.has(key)

  /**
   * This same page with the composition changed — every other query parameter
   * carried over untouched, so toggling a section never silently drops
   * `full`, and no future parameter has to be remembered here.
   */
  const docHref = (next: { hide?: string[]; editing?: boolean; full?: boolean }): string => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(search)) {
      if (value === undefined || key === 'hide' || key === 'edit' || key === 'full') continue
      for (const one of Array.isArray(value) ? value : [value]) params.append(key, one)
    }
    if (next.full ?? full) params.set('full', '1')
    // Document order, not click order: the URL is meant to be readable.
    const hide = (next.hide ?? [...hiddenSections]).filter((key) =>
      availableSections.includes(key),
    )
    const ordered = availableSections.filter((key) => hide.includes(key))
    if (ordered.length > 0) params.set('hide', ordered.join(','))
    if (next.editing ?? editing) params.set('edit', '1')
    const query = params.toString()
    return query ? `/print/meetings/${id}?${query}` : `/print/meetings/${id}`
  }

  const hideHref = (key: string) => docHref({ hide: [...hiddenSections, key] })
  const showHref = (key: string) =>
    docHref({ hide: [...hiddenSections].filter((other) => other !== key) })

  // updateMeeting validates and rewrites the whole meeting, so the fields the
  // masthead does NOT edit still have to travel with the one it does.
  const editBase: MeetingEditBase = {
    meetingId: id,
    appId: meeting.appId,
    title: meeting.title,
    startsAt: meeting.startsAt.toISOString(),
    endsAt: meeting.endsAt.toISOString(),
    agenda: meeting.agenda ?? '',
    // Omitted rather than nulled: meetingUrlSchema is a string schema.
    meetingUrl: meeting.meetingUrl ?? undefined,
    attendeeIds: meeting.attendees.map((a) => a.id),
  }
  // The roster is only needed to ADD an attendee, so it is only fetched by
  // somebody who is composing and allowed to write — an export is the common
  // case and should not pay a query for a control it will never render.
  const canEditMasthead = editing && canEdit
  const roster = canEditMasthead ? await listActiveUsers() : []

  // Voices still wearing a machine label ("Speaker 1"), and everyone they
  // could be. Attendees first — they are the likely answer — then every other
  // approved user, because the person behind a voice is regularly somebody
  // who joined without being on the invite.
  const speakerLabels = Array.from(
    new Set(
      segments
        .filter((segment) => segment.source === 'voice' && segment.speakerLabel)
        .map((segment) => segment.speakerLabel as string),
    ),
  )
  const attendeeIds = new Set(meeting.attendees.map((a) => a.id))
  const namablePeople = [
    ...meeting.attendees.map((a) => ({ id: a.id, name: a.name })),
    ...(timeline?.ok ? timeline.data.approvedUsers : []).filter((u) => !attendeeIds.has(u.id)),
  ]

  return (
    <div className="doc-root min-h-screen bg-zinc-100 text-[var(--doc-ink)] print:min-h-0 print:bg-white">
      {/* A4 geometry + print behaviour. Scoped globals: this route renders no
          app chrome, so the selectors below can't leak anywhere else. */}
      <style>{`
        /* Top/bottom margins reserve the band the running header and footer
           are painted into. A fixed-position element inside @media print is
           repeated by the browser on EVERY page, which is the only way to get
           a running header without a paged-media engine. */
        /* The sheet is ALWAYS white — it is paper, and paper has no dark
           mode. But the components rendered onto it (MarkdownLite, chiefly)
           are styled with the app's theme tokens, so under a dark theme
           "text-foreground" resolved to near-white and the summary's own
           sub-headings became invisible on the page. Pinning the tokens to
           their light values for this route fixes every such component at
           once, rather than hunting class by class through anything the
           document might ever render. (No backticks in here: this whole
           block is a template literal, and one would end it.) */
        .doc-root {
          color-scheme: light;
          /* Browsers strip backgrounds and fills out of printed output unless
             told otherwise, and here the tinted fact block and the status
             pills would arrive as bare text. The property inherits, so one
             declaration on the root covers everything drawn below it. */
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
          --background: oklch(1 0 0);
          --foreground: oklch(0.21 0.006 285);
          --card: oklch(1 0 0);
          --card-foreground: oklch(0.21 0.006 285);
          --muted: oklch(0.967 0.001 286);
          --muted-foreground: oklch(0.45 0.006 286);
          --primary: oklch(0.21 0.006 285);
          --border: oklch(0.92 0.004 286);

          /* DOCUMENT PALETTE — every colour on the sheet, named once.
             Two rules held it to this size. First, greyscale: a printer or a
             photocopier throws the hue away and keeps only the lightness, so
             the accent sits at L 0.44 where it lands as a clear mid grey,
             separable from both the near-black text (L 0.22) and the paper —
             a lighter, prettier teal would have gone to mud. Second, ink:
             this is the house green LogPup already runs on (--primary in
             globals.css) and the same family as the Alta Vision mark in the
             masthead, so the document looks like it came from the company
             rather than from a template.
             Text tones are all at or above 4.5:1 on white: ink 17:1,
             ink-soft 7.8:1, ink-faint 4.6:1, brand 7.8:1. */
          --doc-ink: oklch(0.22 0.012 155);
          --doc-ink-soft: oklch(0.44 0.01 155);
          --doc-ink-faint: oklch(0.56 0.008 155);
          --doc-rule: oklch(0.88 0.004 155);
          --doc-rule-strong: oklch(0.62 0.008 155);
          --doc-wash: oklch(0.975 0.003 155);
          --doc-brand: oklch(0.44 0.09 165);
          --doc-brand-deep: oklch(0.32 0.07 165);
          --doc-brand-wash: oklch(0.96 0.02 165);
        }

        /* The Alta Vision mark ships one flat artwork drawn for light
           backgrounds and lifts its own brightness under the app's dark
           theme. That lift follows it onto this route whenever the reader
           happens to be in dark mode — and on white paper it only washes the
           mark out, so it is cancelled here rather than in the shared
           component, which is right for every other surface. */
        .doc-avmark { filter: none !important; }

        .doc-pill {
          display: inline-block;
          border: 1px solid;
          border-radius: 999px;
          padding: 0.02rem 0.4rem;
          font-size: 8pt;
          font-weight: 600;
          line-height: 1.5;
          white-space: nowrap;
        }
        .doc-pill-tracked {
          background: var(--doc-brand-wash);
          border-color: var(--doc-brand);
          color: var(--doc-brand-deep);
        }
        .doc-pill-proposed {
          background: #fff;
          border-color: var(--doc-rule-strong);
          border-style: dashed;
          color: var(--doc-ink-soft);
        }
        .doc-pill-untracked {
          background: var(--doc-wash);
          border-color: var(--doc-rule-strong);
          color: var(--doc-ink-soft);
        }

        /* Composition controls. These are screen chrome that happens to live
           inside the sheet, so they borrow the app's control language (a
           rounded outline that fills on hover) rather than the document's
           typographic one — the reader should never mistake one for something
           that will print. */
        .doc-chip {
          display: inline-block;
          border: 1px solid var(--doc-rule-strong);
          border-radius: 4px;
          padding: 0.1rem 0.5rem;
          font-size: 8pt;
          font-weight: 600;
          line-height: 1.6;
          color: var(--doc-ink-soft);
          background: #fff;
        }
        .doc-chip:hover { background: var(--doc-wash); color: var(--doc-ink); }
        .doc-chip:focus-visible {
          outline: 2px solid var(--doc-brand);
          outline-offset: 2px;
        }
        .doc-chip:disabled { opacity: 0.55; }
        /* The one chip that commits a write, filled so it does not read as
           the peer of the Cancel beside it. */
        .doc-chip-go {
          background: var(--doc-brand);
          border-color: var(--doc-brand);
          color: #fff;
        }
        .doc-chip-go:hover { background: var(--doc-brand-deep); color: #fff; }

        .doc-input {
          border: 1px solid var(--doc-rule-strong);
          border-radius: 4px;
          background: #fff;
          padding: 0.2rem 0.45rem;
          font: inherit;
          font-size: 9.5pt;
          color: var(--doc-ink);
        }
        .doc-input:focus-visible {
          outline: 2px solid var(--doc-brand);
          outline-offset: 1px;
        }
        .doc-input:disabled { opacity: 0.6; }

        /* One attendee, with the control that removes them. */
        .doc-token {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          border: 1px solid var(--doc-rule-strong);
          border-radius: 999px;
          background: #fff;
          padding: 0.05rem 0.2rem 0.05rem 0.5rem;
          font-size: 9pt;
          color: var(--doc-ink);
        }
        .doc-token-x {
          border-radius: 999px;
          width: 1.05rem;
          height: 1.05rem;
          line-height: 1;
          color: var(--doc-ink-soft);
        }
        .doc-token-x:hover { background: var(--doc-wash); color: var(--doc-ink); }
        .doc-token-x:focus-visible {
          outline: 2px solid var(--doc-brand);
          outline-offset: 1px;
        }
        .doc-token-x:disabled { opacity: 0.5; }
        /* Dashed, because the stub marks an ABSENCE — the same cue the
           Proposed pill uses for a thing that is not settled. */
        .doc-stub {
          border: 1px dashed var(--doc-rule-strong);
          border-radius: 4px;
          background: var(--doc-wash);
          padding: 0.4rem 0.55rem 0.4rem 0.75rem;
        }

        /* The fact block reads as a form, so it gets a form's flat fill and a
           hairline — no accent, because nothing in it is a state. */
        .doc-factbox {
          background: var(--doc-wash);
          border: 1px solid var(--doc-rule);
          border-radius: 2px;
        }

        @page { size: A4; margin: 22mm 16mm 20mm; }
        @media print {
          html, body { background: #fff !important; }
          /* A LEADING BLANK SHEET is what these three prevent, and each has
             produced one on its own: a viewport-height minimum on the root
             (100vh reserves a whole page nothing fills), stray margin above
             the sheet collapsing into a page of its own, and any inherited
             break-before on the first block. The document starts on page 1. */
          html, body { min-height: 0 !important; margin: 0 !important; padding: 0 !important; }
          .doc-root { min-height: 0 !important; margin: 0 !important; padding: 0 !important; }
          .doc-sheet { break-before: auto !important; }
          .doc-sheet { margin: 0 !important; max-width: none !important; box-shadow: none !important; padding: 0 !important; border-radius: 0 !important; }
          .doc-block { break-inside: avoid; }
          .doc-heading { break-inside: avoid; break-after: avoid; }
          /* A heading is not the last thing on a page, a bullet does not get
             separated from the line it belongs to, and no paragraph strands
             one line on its own across the fold — the three page-break faults
             that make a printed web page look printed from a web page. */
          h3, figure, img, tr { break-inside: avoid; }
          h3 { break-after: avoid; }
          p, li, dd, dt { orphans: 3; widows: 3; }
          /* The action table's own head repeats when the table outgrows the
             page; a second page of unlabelled Owner/Due columns is unreadable.
             (Distinct from the document-level running header below.) */
          .doc-table thead { display: table-header-group; }
          /* RUNNING HEADER/FOOTER — via table header/footer groups.
             The obvious approach — position:fixed with negative offsets to
             sit in the page margin — is what shipped first, and it printed the
             header straight through the middle of the table on page 2: a
             fixed box takes NO space in the flow, so content runs underneath
             it, and Chrome silently ignores @page margins whenever the print
             dialog's own "Margins" setting is anything but None — which is
             the default.
             thead/tfoot are the one mechanism that both repeats on every page
             AND reserves its own space, because the browser lays the content
             out as table rows between them. */
          .doc-running { display: table-header-group !important; }
          .doc-running-foot { display: table-footer-group !important; }
          /* Page numbers are the one thing the document cannot know about
             itself; they are left to the browser's own print header/footer.
             Everything else here is ours and prints on every page. */
        }
      `}</style>

      {/* Every link is built by docHref, so switching detail level or entering
          edit mode carries the composition (and any other parameter) with it
          instead of silently resetting the document somebody just shaped. */}
      <PrintToolbar
        summaryHref={docHref({ full: false })}
        fullHref={docHref({ full: true })}
        full={full}
        editing={editing}
        editHref={docHref({ editing: !editing })}
        hiddenCount={hiddenSections.size}
        showAllHref={docHref({ hide: [] })}
      />

      {/* Naming the voices is an EXPORT-TIME job: nobody stops mid-meeting to
          do it, and this is the moment somebody is about to hand the document
          to other people. Only offered on the full record, which is the level
          that prints the transcript the labels appear in. */}
      {full && speakerLabels.length > 0 ? (
        <div className="px-4 pt-4 print:hidden">
          <PrintSpeakerNames
            meetingId={id}
            labels={speakerLabels}
            speakers={speakerRows}
            people={namablePeople}
          />
        </div>
      ) : null}

      <main className="doc-sheet mx-auto my-8 w-[210mm] max-w-full bg-white px-[18mm] py-[16mm] text-[10pt] leading-[1.5] text-[var(--doc-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.08)] print:my-0 print:w-auto print:shadow-none">
        {/* The whole document is ONE table so the browser can repeat a header
            and footer on every printed page. thead/tfoot are the only
            mechanism that both repeats AND reserves its own space; the
            fixed-position version this replaces printed straight through the
            content on page 2. On screen the two groups are hidden and this is
            an ordinary block. */}
        <table className="w-full border-collapse">
          {/* The accent hairline is the one piece of brand that repeats on
              every sheet — enough that page 6 on its own is still recognisably
              part of this document, without spending colour on a rule the
              reader looks at twelve times. */}
          <thead className="doc-running hidden">
            <tr>
              <td className="pb-3">
                <div className="flex items-baseline justify-between gap-4 border-b border-[color:var(--doc-brand)] pb-1 text-[7.5pt] text-[var(--doc-ink-faint)]">
                  <span className="truncate font-semibold text-[var(--doc-ink-soft)]">
                    {meeting.title}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {dateFmt.format(meeting.startsAt)} · {timeFmt.format(meeting.startsAt)}–
                    {timeFmt.format(meeting.endsAt)}
                  </span>
                </div>
              </td>
            </tr>
          </thead>
          <tfoot className="doc-running-foot hidden">
            <tr>
              <td className="pt-3">
                <div className="flex items-baseline justify-between gap-4 border-t border-[color:var(--doc-rule)] pt-1 text-[7.5pt] text-[var(--doc-ink-faint)]">
                  <span className="truncate">
                    LogPup by Alta Vision · {full ? 'Full record' : 'Summary'}
                    {meeting.appName ? ` · ${meeting.appName}` : ''}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    Ref {docRef} · Exported {stampFmt.format(exportedAt)}
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td>
        {/* ---- Masthead ----
            A document, not a web page: who issued it, what kind of document
            it is, then what it is about. The lockup carries both marks because
            they answer different questions — the paw says which product wrote
            this, the Alta Vision mark says which company stands behind it, and
            somebody handed this PDF in an email thread needs both without
            asking. The shared brand component is used rather than a redrawn
            copy so the mark on paper is the mark on the site. */}
        <header className="doc-block mb-7">
          <div className="flex items-end justify-between gap-6 border-b-2 border-[color:var(--doc-brand)] pb-2">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-[6px] bg-[var(--doc-brand)] text-white"
              >
                <PawPrint className="size-[17px]" />
              </span>
              <div>
                <p className="font-heading text-[13pt] font-bold leading-none tracking-tight text-[var(--doc-ink)]">
                  LogPup
                </p>
                <p className="mt-[3px] flex items-center gap-1.5 text-[6.5pt] font-medium uppercase tracking-[0.14em] text-[var(--doc-ink-faint)]">
                  A product of
                  <AltaVisionLogo className="doc-avmark h-[11px] w-auto" />
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-heading text-[9.5pt] font-bold uppercase tracking-[0.18em] text-[var(--doc-brand)]">
                Meeting minutes
              </p>
              <p className="text-[7.5pt] font-medium uppercase tracking-[0.14em] text-[var(--doc-ink-faint)]">
                {full ? 'Full record' : 'Summary'} · Ref {docRef}
              </p>
            </div>
          </div>

          <EditableTitle base={editBase} canEdit={canEditMasthead} />
          <p className="mt-1 text-[10pt] text-[var(--doc-ink-soft)]">
            {dateFmt.format(meeting.startsAt)} · {timeFmt.format(meeting.startsAt)}–
            {timeFmt.format(meeting.endsAt)}
            <span className="text-[var(--doc-ink-faint)]">
              {' '}
              ({durationLabel(meeting.startsAt, meeting.endsAt)})
            </span>
          </p>

          {/* Everything a reader needs to place this document, in a bordered
              block that reads as a form rather than prose — including the
              provenance, which used to be buried in 8pt grey on the last
              page. Who wrote this up (a model, not a person) belongs where
              somebody deciding whether to trust it will actually see it. */}
          <dl className="doc-factbox mt-4 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-[9.5pt]">
            {meeting.appName ? (
              <>
                <dt className="font-medium text-[var(--doc-ink-faint)]">Project</dt>
                <dd className="text-[var(--doc-ink)]">{meeting.appName}</dd>
              </>
            ) : null}
            {/* The two CONTENT rows print only when they have something to
                say, but appear while composing even when empty — otherwise
                the one state you cannot fix from here is the one that needs
                fixing: an agenda nobody filled in. */}
            {meeting.attendees.length > 0 || canEditMasthead ? (
              <>
                <dt className="font-medium text-[var(--doc-ink-faint)]">
                  Attendees{' '}
                  <span className="tabular-nums">({meeting.attendees.length})</span>
                </dt>
                <dd className="text-[var(--doc-ink)]">
                  <EditableAttendees
                    base={editBase}
                    canEdit={canEditMasthead}
                    attendees={meeting.attendees.map((a) => ({ id: a.id, name: a.name }))}
                    people={roster}
                  />
                </dd>
              </>
            ) : null}
            {meeting.agenda || canEditMasthead ? (
              <>
                <dt className="font-medium text-[var(--doc-ink-faint)]">Agenda</dt>
                <dd className="text-[var(--doc-ink)]">
                  <EditableAgenda base={editBase} canEdit={canEditMasthead} />
                </dd>
              </>
            ) : null}
            {/* PROVENANCE, AND DELIBERATELY NOT EDITABLE — see the refusal
                documented in print-masthead-edit.tsx. These three facts are
                how the document discloses that a machine drafted it, when,
                and which export this copy is. An editable attribution stops
                the document disclosing anything, and a hand-set export stamp
                and reference is a forged reference. Do not "finish the job"
                by adding controls here. */}
            <dt
              className="font-medium text-[var(--doc-ink-faint)]"
              title="Provenance — this is the document's record of who drafted it, so it cannot be edited"
            >
              Written up by
            </dt>
            <dd className="text-[var(--doc-ink)]">
              {notes ? (
                <>
                  {notes.model}
                  <span className="text-[var(--doc-ink-soft)]">
                    {' '}
                    · {stampFmt.format(notes.createdAt)}
                  </span>
                </>
              ) : (
                <span className="text-[var(--doc-ink-soft)]">Not analyzed yet</span>
              )}
            </dd>
            <dt
              className="font-medium text-[var(--doc-ink-faint)]"
              title="Provenance — the export stamp and reference are set by the system, so they cannot be edited"
            >
              Exported
            </dt>
            <dd className="text-[var(--doc-ink)]">
              {stampFmt.format(exportedAt)}
              <span className="text-[var(--doc-ink-soft)]"> · Ref {docRef}</span>
            </dd>
          </dl>
        </header>

        {/* Each section below is wrapped by its OWN availability guard — the
            same condition that put it in availableSections — and DocSection
            then decides whether it prints, or shows a put-it-back stub. The
            two questions stay separate on purpose: "this meeting has no
            glossary" and "somebody left the glossary out" are different
            facts, and only the second is undoable. */}

        {/* ---- Summary ---- */}
        <DocSection
          sectionKey="summary"
          n={sectionNo('summary')}
          heading="Summary"
          editing={editing}
          hidden={!isShown('summary')}
          hideHref={hideHref('summary')}
          showHref={showHref('summary')}
        >
          {summaryBlocks.length > 0 ? (
            <div className="flex flex-col gap-3">
              {summaryBlocks.map((block) => (
                <div
                  key={block.lang}
                  lang={block.lang}
                  className={block.lang === 'si' ? 'leading-[1.8]' : undefined}
                >
                  <MarkdownLite content={block.content} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--doc-ink-soft)]">
              No AI write-up yet — record or analyze this meeting first, then export again.
            </p>
          )}
        </DocSection>

        {/* ---- Action items ---- */}
        {suggestions.length + untracked.length > 0 ? (
          <DocSection
            sectionKey="actions"
            n={sectionNo('actions')}
            heading={`Action items (${suggestions.length + untracked.length})`}
            editing={editing}
            hidden={!isShown('actions')}
            hideHref={hideHref('actions')}
            showHref={showHref('actions')}
          >
            {/* A table, not a bullet list. Owner and due date are the two
                things anyone re-reads minutes FOR, and as trailing grey prose
                after the task text they could not be scanned down a column —
                which is the entire advantage paper has. */}
            <table className="doc-table w-full border-collapse text-left align-baseline">
              <thead>
                <tr className="border-b border-[color:var(--doc-rule-strong)] text-[8pt] uppercase tracking-[0.08em] text-[var(--doc-ink-soft)]">
                  <th scope="col" className="w-[8mm] py-1 font-semibold">
                    #
                  </th>
                  <th scope="col" className="py-1 font-semibold">
                    Action
                  </th>
                  <th scope="col" className="w-[34mm] py-1 font-semibold">
                    Owner
                  </th>
                  <th scope="col" className="w-[24mm] py-1 font-semibold">
                    Due
                  </th>
                  <th scope="col" className="w-[22mm] py-1 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s, index) => {
                  const status = suggestionStatus(s)
                  return (
                    <tr
                      key={s.id}
                      className="doc-block border-b border-[color:var(--doc-rule)] align-baseline"
                    >
                      <td className="py-1.5 tabular-nums text-[var(--doc-ink-faint)]">
                        {index + 1}
                      </td>
                      <td className="py-1.5 pr-3">
                        {s.text}
                        {s.suggestedAppName ? (
                          <span className="text-[9pt] text-[var(--doc-ink-soft)]">
                            {' '}
                            · {s.suggestedAppName}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-3 text-[9.5pt]">
                        {s.suggestedUserName ?? (
                          <span className="text-[var(--doc-ink-faint)]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-[9.5pt] tabular-nums">
                        {s.suggestedDueDate ?? (
                          <span className="text-[var(--doc-ink-faint)]">—</span>
                        )}
                      </td>
                      <td className="py-1.5">
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </td>
                    </tr>
                  )
                })}
                {untracked.map((row, index) => (
                  <tr
                    key={row.key}
                    className="doc-block border-b border-[color:var(--doc-rule)] align-baseline"
                  >
                    <td className="py-1.5 tabular-nums text-[var(--doc-ink-faint)]">
                      {suggestions.length + index + 1}
                    </td>
                    <td className="py-1.5 pr-3">{row.text}</td>
                    <td className="py-1.5 pr-3 text-[9.5pt]">
                      {row.owner ?? <span className="text-[var(--doc-ink-faint)]">Unassigned</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-[9.5pt] tabular-nums">
                      {row.due ?? <span className="text-[var(--doc-ink-faint)]">—</span>}
                    </td>
                    <td className="py-1.5">
                      <StatusPill tone="untracked">Not tracked</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DocSection>
        ) : null}

        {/* ---- Discussion highlights ---- */}
        {discussionPeople.length > 0 ? (
          <DocSection
            sectionKey="discussion"
            n={sectionNo('discussion')}
            heading="Discussion highlights"
            editing={editing}
            hidden={!isShown('discussion')}
            hideHref={hideHref('discussion')}
            showHref={showHref('discussion')}
          >
            <div className="flex flex-col gap-3">
              {discussionPeople.map((person) => (
                <div key={person.name} className="doc-block">
                  <h3 className="text-[10.5pt] font-semibold">{person.name}</h3>
                  <ul className="mt-0.5 flex list-disc flex-col gap-0.5 pl-5">
                    {person.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </DocSection>
        ) : null}

        {/* ---- Open questions ---- */}
        {questions.length > 0 ? (
          <DocSection
            sectionKey="questions"
            n={sectionNo('questions')}
            heading="Questions for next time"
            editing={editing}
            hidden={!isShown('questions')}
            hideHref={hideHref('questions')}
            showHref={showHref('questions')}
          >
            <div className="flex flex-col gap-2">
              {questions.map((entry) => (
                <div key={entry.person} className="doc-block">
                  <h3 className="text-[10.5pt] font-semibold">{entry.person}</h3>
                  <ul className="mt-0.5 flex list-disc flex-col gap-0.5 pl-5">
                    {entry.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </DocSection>
        ) : null}

        {/* ---- Glossary ---- */}
        {terms.length > 0 ? (
          <DocSection
            sectionKey="glossary"
            n={sectionNo('glossary')}
            heading="Glossary"
            editing={editing}
            hidden={!isShown('glossary')}
            hideHref={hideHref('glossary')}
            showHref={showHref('glossary')}
          >
            <dl className="flex flex-col gap-1.5">
              {terms.map((term) => (
                <div key={term.term} className="doc-block">
                  <dt className="inline font-semibold">{term.term}</dt>{' '}
                  <dd className="inline text-[var(--doc-ink-soft)]">
                    {term.explanation}
                    {term.sinhala ? (
                      <span lang="si" className="text-[var(--doc-ink-faint)]">
                        {' '}
                        — {term.sinhala}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </DocSection>
        ) : null}

        {/* ---- Full record: every stored note, verbatim, no AI pass ---- */}
        {full ? (
          <>
            {/* ---- Shared screens ---- */}
            {screenshots.length > 0 ? (
              <DocSection
                sectionKey="screens"
                n={sectionNo('screens')}
                heading={`Shared screens (${screenshots.length})`}
                editing={editing}
                hidden={!isShown('screens')}
                hideHref={hideHref('screens')}
                showHref={showHref('screens')}
              >
                {/* Two up. A slide at half the text column is still legible on
                    A4 and keeps a screen-share meeting from running to twenty
                    pages. `break-inside: avoid` (doc-block) keeps a caption
                    with its image across a page boundary. */}
                <div className="grid grid-cols-2 gap-3">
                  {screenshots.map((shot) => (
                    <figure key={shot.id} className="doc-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shot.url}
                        alt={`Shared screen at ${msToClock(shot.capturedAtMs)} into the recording`}
                        className="w-full rounded-sm border border-[color:var(--doc-rule)]"
                      />
                      <figcaption className="mt-1 text-[8pt] tabular-nums text-[var(--doc-ink-faint)]">
                        {msToClock(shot.capturedAtMs)} into the recording
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </DocSection>
            ) : null}

            {segments.length > 0 ? (
              <DocSection
                sectionKey="timeline"
                n={sectionNo('timeline')}
                heading={`Record timeline (${segments.length} entries)`}
                editing={editing}
                hidden={!isShown('timeline')}
                hideHref={hideHref('timeline')}
                showHref={showHref('timeline')}
              >
                {/* Client component: entries are editable in place (inline, or
                    all at once) for the admin/creator, through the same
                    editNoteSegment action the meeting page uses. Display
                    strings are resolved HERE so the client stays a dumb
                    editor over {id, who, meta, content}. */}
                <RecordTimeline
                  canEdit={canEdit}
                  rows={segments.map(
                    (segment): RecordRow => ({
                      id: segment.id,
                      who: segmentWho(segment, speakerRows),
                      meta: `${SOURCE_LABEL[segment.source] ?? segment.source}${
                        segment.startedAtMs !== null
                          ? ` · ${msToClock(segment.startedAtMs)} into the recording`
                          : ` · ${stampFmt.format(segment.createdAt)}`
                      }`,
                      content: segment.content,
                      editable: segment.source !== 'voice' && !segment.isLegacy,
                    }),
                  )}
                />
              </DocSection>
            ) : null}

            {/* The guard has to be the one availableSections uses, not just
                "there is a transcript". It was the looser test, so a full
                record holding BOTH voice segments and the flat transcript
                printed the transcript section under the heading number 0 —
                sectionNo could not find an id that had never been counted. */}
            {notes?.transcript && segments.length === 0 ? (
              <DocSection
                sectionKey="transcript"
                n={sectionNo('transcript')}
                heading="Full transcript"
                editing={editing}
                hidden={!isShown('transcript')}
                hideHref={hideHref('transcript')}
                showHref={showHref('transcript')}
              >
                <p className="whitespace-pre-wrap text-[9pt] leading-[1.6] text-[var(--doc-ink-soft)]">
                  {notes.transcript}
                </p>
              </DocSection>
            ) : null}
          </>
        ) : null}

        {/* ---- Provenance footer ----
            Says on paper that the document was composed, when it was: a reader
            handed an abridged export should not have to infer it from a gap in
            the numbering. */}
        <footer className="mt-8 border-t border-[color:var(--doc-rule)] pt-2 text-[8pt] text-[var(--doc-ink-faint)]">
          {notes ? (
            <>
              Write-up generated {stampFmt.format(notes.createdAt)} by {notes.model}.{' '}
            </>
          ) : null}
          {hiddenSections.size > 0 ? (
            <>
              {hiddenSections.size === 1 ? '1 section' : `${hiddenSections.size} sections`} of the
              record omitted from this export.{' '}
            </>
          ) : null}
          Exported from LogPup by Alta Vision {stampFmt.format(exportedAt)} · Ref {docRef} ·{' '}
          {meeting.title}
        </footer>
              </td>
            </tr>
          </tbody>
        </table>
      </main>
    </div>
  )
}
