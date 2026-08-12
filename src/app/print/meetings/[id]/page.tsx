import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { LK_TIMEZONE } from '@/lib/lk-holidays'
import { MarkdownLite } from '@/components/markdown-lite'
import { getMeetingById } from '@/features/meetings/queries'
import {
  canReadMeetingIntel,
  getMeetingIntel,
  getMeetingNoteTimeline,
  type NoteSegmentView,
  type TaskSuggestionView,
} from '@/features/meetings/ai-actions'
import { splitBilingualSummary } from '@/features/meetings/components/meeting-panels-model'
import type { ActionRow } from '@/features/meetings/components/meeting-notes-model'
import { PrintToolbar } from './print-toolbar'
import { RecordTimeline, type RecordRow } from './record-timeline'
import { PrintSpeakerNames } from './print-speaker-names'

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

function segmentWho(segment: NoteSegmentView): string {
  if (segment.source === 'typed') return segment.createdByName ?? 'Typed note'
  if (segment.source === 'ai') return 'AI write-up'
  return segment.speakerName ?? segment.speakerLabel ?? 'Voice'
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
function SectionHeading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="doc-heading mb-2.5 flex items-baseline gap-2 border-b border-zinc-300 pb-1">
      <span className="font-heading text-[11pt] font-bold tabular-nums text-zinc-900">{n}</span>
      <span className="text-[9pt] font-semibold uppercase tracking-[0.1em] text-zinc-500">
        {children}
      </span>
    </h2>
  )
}

function suggestionStatus(s: TaskSuggestionView): string {
  return s.status === 'accepted' ? 'Tracked' : 'Proposed'
}

export default async function MeetingPrintPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams])
  if (!UUID_RE.test(id)) notFound()
  const full = search.full === '1'

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
  // Editing rights mirror editNoteSegment's own gate (canManageMeeting):
  // admin or the meeting's creator. Attendees can read this page but not
  // rewrite the record.
  const canEdit = session.user.role === 'admin' || meeting.createdBy === session.user.id

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

  // Sections are conditional, so a meeting with no glossary must still print
  // "1, 2, 3" and not "1, 2, 3, 5". Numbers are therefore assigned BEFORE
  // rendering, from the list of sections that will actually appear, in the
  // order they appear — rather than by a counter incremented as JSX
  // evaluates, which mutates during render (React forbids it, and it would
  // silently double-count under Strict Mode's double invocation).
  const presentSections = [
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
  ].filter((id): id is string => id !== null)
  const sectionNo = (id: string) => presentSections.indexOf(id) + 1

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
    <div className="doc-root min-h-screen bg-zinc-100 text-zinc-900 print:bg-white">
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
          --background: oklch(1 0 0);
          --foreground: oklch(0.21 0.006 285);
          --card: oklch(1 0 0);
          --card-foreground: oklch(0.21 0.006 285);
          --muted: oklch(0.967 0.001 286);
          --muted-foreground: oklch(0.45 0.006 286);
          --primary: oklch(0.21 0.006 285);
          --border: oklch(0.92 0.004 286);
        }

        @page { size: A4; margin: 22mm 16mm 20mm; }
        @media print {
          html, body { background: #fff !important; }
          .doc-sheet { margin: 0 !important; max-width: none !important; box-shadow: none !important; padding: 0 !important; border-radius: 0 !important; }
          .doc-block { break-inside: avoid; }
          .doc-heading { break-after: avoid; }
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

      <PrintToolbar meetingId={id} full={full} />

      {/* Naming the voices is an EXPORT-TIME job: nobody stops mid-meeting to
          do it, and this is the moment somebody is about to hand the document
          to other people. Only offered on the full record, which is the level
          that prints the transcript the labels appear in. */}
      {full && speakerLabels.length > 0 ? (
        <div className="px-4 pt-4">
          <PrintSpeakerNames
            meetingId={id}
            labels={speakerLabels}
            speakers={timeline?.ok ? timeline.data.speakers : []}
            people={namablePeople}
          />
        </div>
      ) : null}

      <main className="doc-sheet mx-auto my-8 w-[210mm] max-w-full bg-white px-[18mm] py-[16mm] text-[10.5pt] leading-[1.55] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.08)] print:my-0 print:w-auto print:shadow-none">
        {/* The whole document is ONE table so the browser can repeat a header
            and footer on every printed page. thead/tfoot are the only
            mechanism that both repeats AND reserves its own space; the
            fixed-position version this replaces printed straight through the
            content on page 2. On screen the two groups are hidden and this is
            an ordinary block. */}
        <table className="w-full border-collapse">
          <thead className="doc-running hidden">
            <tr>
              <td className="pb-3">
                <div className="flex items-baseline justify-between gap-4 border-b border-zinc-200 pb-1 text-[7.5pt] text-zinc-500">
                  <span className="truncate font-medium text-zinc-700">{meeting.title}</span>
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
                <div className="flex items-baseline justify-between gap-4 border-t border-zinc-200 pt-1 text-[7.5pt] text-zinc-400">
                  <span className="truncate">
                    LogPup · {full ? 'Full record' : 'Summary'}
                    {meeting.appName ? ` · ${meeting.appName}` : ''}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {notes ? `Written up by ${notes.model} · ` : ''}
                    Exported {stampFmt.format(exportedAt)}
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td>
        {/* ---- Masthead ----
            A document, not a web page: a ruled brand line, then the document
            TYPE, then what it is about. The old header opened with a grey
            eyebrow and the title and left the reader to work out what they
            were holding. */}
        <header className="doc-block mb-7">
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-zinc-900 pb-1.5">
            <p className="font-heading text-[11pt] font-bold tracking-tight">LogPup</p>
            <p className="text-[8pt] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Meeting minutes · {full ? 'Full record' : 'Summary'}
            </p>
          </div>

          <h1 className="mt-4 font-heading text-[21pt] font-bold leading-[1.15] tracking-tight">
            {meeting.title}
          </h1>
          <p className="mt-1 text-[10pt] text-zinc-600">
            {dateFmt.format(meeting.startsAt)} · {timeFmt.format(meeting.startsAt)}–
            {timeFmt.format(meeting.endsAt)}
            <span className="text-zinc-400">
              {' '}
              ({durationLabel(meeting.startsAt, meeting.endsAt)})
            </span>
          </p>

          {/* Everything a reader needs to place this document, in a bordered
              block that reads as a form rather than prose — including the
              provenance, which used to be buried in 8pt grey on the last
              page. Who wrote this up (a model, not a person) belongs where
              somebody deciding whether to trust it will actually see it. */}
          <dl className="mt-4 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-[9.5pt]">
            {meeting.appName ? (
              <>
                <dt className="font-medium text-zinc-500">Project</dt>
                <dd className="text-zinc-800">{meeting.appName}</dd>
              </>
            ) : null}
            {meeting.attendees.length > 0 ? (
              <>
                <dt className="font-medium text-zinc-500">
                  Attendees{' '}
                  <span className="tabular-nums text-zinc-400">({meeting.attendees.length})</span>
                </dt>
                <dd className="text-zinc-800">
                  {meeting.attendees.map((a) => a.name).join(', ')}
                </dd>
              </>
            ) : null}
            {meeting.agenda ? (
              <>
                <dt className="font-medium text-zinc-500">Agenda</dt>
                <dd className="text-zinc-800">{meeting.agenda}</dd>
              </>
            ) : null}
            <dt className="font-medium text-zinc-500">Written up by</dt>
            <dd className="text-zinc-800">
              {notes ? (
                <>
                  {notes.model}
                  <span className="text-zinc-500"> · {stampFmt.format(notes.createdAt)}</span>
                </>
              ) : (
                <span className="text-zinc-500">Not analyzed yet</span>
              )}
            </dd>
            <dt className="font-medium text-zinc-500">Exported</dt>
            <dd className="text-zinc-800">{stampFmt.format(exportedAt)}</dd>
          </dl>
        </header>

        {/* ---- Summary ---- */}
        <section className="mb-6">
          <SectionHeading n={sectionNo('summary')}>Summary</SectionHeading>
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
            <p className="text-zinc-500">
              No AI write-up yet — record or analyze this meeting first, then export again.
            </p>
          )}
        </section>

        {/* ---- Action items ---- */}
        {suggestions.length + untracked.length > 0 ? (
          <section className="mb-6">
            <SectionHeading n={sectionNo('actions')}>
              Action items ({suggestions.length + untracked.length})
            </SectionHeading>
            {/* A table, not a bullet list. Owner and due date are the two
                things anyone re-reads minutes FOR, and as trailing grey prose
                after the task text they could not be scanned down a column —
                which is the entire advantage paper has. */}
            <table className="w-full border-collapse text-left align-baseline">
              <thead>
                <tr className="border-b border-zinc-300 text-[8pt] uppercase tracking-[0.08em] text-zinc-500">
                  <th scope="col" className="w-[8mm] py-1 font-medium">
                    #
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    Action
                  </th>
                  <th scope="col" className="w-[34mm] py-1 font-medium">
                    Owner
                  </th>
                  <th scope="col" className="w-[24mm] py-1 font-medium">
                    Due
                  </th>
                  <th scope="col" className="w-[22mm] py-1 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s, index) => (
                  <tr key={s.id} className="doc-block border-b border-zinc-100 align-baseline">
                    <td className="py-1.5 tabular-nums text-zinc-400">{index + 1}</td>
                    <td className="py-1.5 pr-3">
                      {s.text}
                      {s.suggestedAppName ? (
                        <span className="text-[9pt] text-zinc-500"> · {s.suggestedAppName}</span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3 text-[9.5pt]">
                      {s.suggestedUserName ?? <span className="text-zinc-400">Unassigned</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-[9.5pt] tabular-nums">
                      {s.suggestedDueDate ?? <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="py-1.5 text-[9pt] text-zinc-600">{suggestionStatus(s)}</td>
                  </tr>
                ))}
                {untracked.map((row, index) => (
                  <tr key={row.key} className="doc-block border-b border-zinc-100 align-baseline">
                    <td className="py-1.5 tabular-nums text-zinc-400">
                      {suggestions.length + index + 1}
                    </td>
                    <td className="py-1.5 pr-3">{row.text}</td>
                    <td className="py-1.5 pr-3 text-[9.5pt]">
                      {row.owner ?? <span className="text-zinc-400">Unassigned</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-[9.5pt] tabular-nums">
                      {row.due ?? <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="py-1.5 text-[9pt] text-zinc-600">Not tracked</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {/* ---- Discussion highlights ---- */}
        {discussionPeople.length > 0 ? (
          <section className="mb-6">
            <SectionHeading n={sectionNo('discussion')}>Discussion highlights</SectionHeading>
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
          </section>
        ) : null}

        {/* ---- Open questions ---- */}
        {questions.length > 0 ? (
          <section className="mb-6">
            <SectionHeading n={sectionNo('questions')}>Questions for next time</SectionHeading>
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
          </section>
        ) : null}

        {/* ---- Glossary ---- */}
        {terms.length > 0 ? (
          <section className="mb-6">
            <SectionHeading n={sectionNo('glossary')}>Glossary</SectionHeading>
            <dl className="flex flex-col gap-1.5">
              {terms.map((term) => (
                <div key={term.term} className="doc-block">
                  <dt className="inline font-semibold">{term.term}</dt>{' '}
                  <dd className="inline text-zinc-700">
                    {term.explanation}
                    {term.sinhala ? (
                      <span lang="si" className="text-zinc-500">
                        {' '}
                        — {term.sinhala}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {/* ---- Full record: every stored note, verbatim, no AI pass ---- */}
        {full ? (
          <>
            {/* ---- Shared screens ---- */}
            {screenshots.length > 0 ? (
              <section className="mb-6">
                <SectionHeading n={sectionNo('screens')}>
                  Shared screens ({screenshots.length})
                </SectionHeading>
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
                        className="w-full rounded border border-zinc-200"
                      />
                      <figcaption className="mt-1 text-[8pt] tabular-nums text-zinc-500">
                        {msToClock(shot.capturedAtMs)} into the recording
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ) : null}

            {segments.length > 0 ? (
              <section className="mb-6">
                <SectionHeading n={sectionNo('timeline')}>Record timeline ({segments.length} entries)</SectionHeading>
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
                      who: segmentWho(segment),
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
              </section>
            ) : null}

            {notes?.transcript ? (
              <section className="mb-6">
                <SectionHeading n={sectionNo('transcript')}>Full transcript</SectionHeading>
                <p className="whitespace-pre-wrap text-[9pt] leading-[1.65] text-zinc-800">
                  {notes.transcript}
                </p>
              </section>
            ) : null}
          </>
        ) : null}

        {/* ---- Provenance footer ---- */}
        <footer className="mt-8 border-t border-zinc-200 pt-2 text-[8pt] text-zinc-400">
          {notes ? <>Write-up generated {stampFmt.format(notes.createdAt)} by {notes.model}. </> : null}
          Exported from LogPup {stampFmt.format(exportedAt)} · {meeting.title}
        </footer>
              </td>
            </tr>
          </tbody>
        </table>
      </main>
    </div>
  )
}
