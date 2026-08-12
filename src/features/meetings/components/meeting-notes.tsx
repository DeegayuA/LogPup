'use client'

import type { ReactNode } from 'react'
import { format } from 'date-fns'
import {
  BookOpen,
  CircleCheck,
  ListChecks,
  MessageCircleQuestion,
  Sparkles,
  Users,
} from 'lucide-react'
import { MarkdownLite } from '@/components/markdown-lite'
import { cn } from '@/lib/utils'
import { bilingualLead, bilingualText, MetaChip } from '@/features/meetings/components/meeting-chips'
import { buildActionList, type ActionRow } from '@/features/meetings/components/meeting-notes-model'
import {
  EmptyFilterState,
  Panel,
  SummaryLanguageControl,
  useFilteredRows,
  usePanels,
  useSummaryLanguage,
} from '@/features/meetings/components/meeting-panels'
import { splitBilingualSummary, type SummaryLanguage } from '@/features/meetings/components/meeting-panels-model'
import type { MeetingAiNotesView } from '@/features/meetings/ai-actions'

/**
 * What the meeting produced, as independently-collapsible, filterable,
 * kind-tagged panels instead of one undifferentiated scroll — see
 * docs/superpowers/specs/2026-08-12-meeting-writeup-panels-design.md.
 *
 * Must render inside a MeetingPanelsProvider (meeting-intel.tsx mounts one
 * around the whole write-up + record area) — that is what supplies the
 * active person/kind filters, the persisted collapse state each Panel reads,
 * and the attendee list the person filter matches against.
 *
 * Reading order is by usefulness, not transcript order: the summary is what
 * someone who missed the meeting reads, the merged action list is what
 * someone who attended it needs, and discussion/questions/glossary are the
 * record you go back to. A panel is omitted entirely when the meeting
 * produced nothing for it OR the active kind filter excludes it — that is
 * ordinary filtering, not an empty result. A panel that has content the
 * meeting produced but the PERSON filter narrows to nothing instead renders
 * a designed empty state with a way to clear that filter — the two "nothing
 * to show" cases are deliberately never the same UI.
 */
export function MeetingAiNotes({
  notes,
  now,
}: {
  notes: MeetingAiNotesView
  /** Passed in so the "overdue" decision is testable and render-pure. */
  now: Date
}) {
  const { filters, people, clearAllFilters, density } = usePanels()
  const kindIncluded = (kind: 'action' | 'discussion' | 'question' | 'term') =>
    !filters.kinds || filters.kinds.has(kind)
  const filteredPersonName = filters.personId
    ? (people.find((p) => p.id === filters.personId)?.name ?? null)
    : null

  const actions = buildActionList(notes, now)
  const { visible: visibleActions } = useFilteredRows(actions, (row) => ({
    kind: 'action' as const,
    personNames: row.owner ? [row.owner] : [],
  }))

  const discussionPeople = notes.perPerson.filter((person) => person.points.length > 0)
  const { visible: visibleDiscussion } = useFilteredRows(discussionPeople, (person) => ({
    kind: 'discussion' as const,
    personNames: [person.name],
  }))
  const visibleDiscussionPoints = visibleDiscussion.reduce((total, p) => total + p.points.length, 0)

  const { visible: visibleQuestionEntries } = useFilteredRows(notes.questions, (entry) => ({
    kind: 'question' as const,
    personNames: [entry.person],
  }))
  const visibleQuestionCount = visibleQuestionEntries.reduce((total, e) => total + e.questions.length, 0)

  const [summaryLang, setSummaryLang] = useSummaryLanguage()
  const { en, si } = splitBilingualSummary(notes.summary)
  const hasSinhala = si.trim().length > 0
  const summaryBlocks = resolveSummaryBlocks(summaryLang, en, si, notes.summary ?? '')

  const compact = density === 'compact'

  return (
    <div className="flex flex-col gap-3">
      {notes.summary ? (
        <Panel id="summary" title="Summary" icon={Sparkles}>
          {hasSinhala ? (
            <SummaryLanguageControl value={summaryLang} onChange={setSummaryLang} hasSinhala={hasSinhala} />
          ) : null}
          <div className="flex flex-col gap-3">
            {summaryBlocks.map((block) => (
              // The one piece of prose on the page allowed to be bigger than
              // body text. `bilingualLead` buys the extra leading Sinhala
              // needs — see meeting-chips.tsx. `lang` is set on every block,
              // in every mode (including "Both"), so a screen reader switches
              // pronunciation at the language boundary, not just at the top.
              <div key={block.lang} lang={block.lang}>
                <MarkdownLite content={block.content} className={cn(bilingualLead, 'text-foreground')} />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {actions.length > 0 && kindIncluded('action') ? (
        <Panel id="action-items" title="Action items" icon={ListChecks} kind="action" count={visibleActions.length}>
          {visibleActions.length > 0 ? (
            <ul className={cn('flex flex-col divide-y divide-border rounded-lg border', compact && 'text-sm')}>
              {visibleActions.map((action) => (
                <ActionItemRow key={action.key} action={action} compact={compact} />
              ))}
            </ul>
          ) : (
            <EmptyFilterState
              label={`No action items for ${filteredPersonName ?? 'this filter'} — clear filter`}
              onClear={clearAllFilters}
            />
          )}
        </Panel>
      ) : null}

      {discussionPeople.length > 0 && kindIncluded('discussion') ? (
        <Panel id="discussion" title="Discussion" icon={Users} kind="discussion" count={visibleDiscussionPoints}>
          {visibleDiscussion.length > 0 ? (
            <ul className={cn('flex flex-col gap-3', compact && 'gap-2')}>
              {visibleDiscussion.map((person) => (
                <li key={person.name} className="flex flex-col gap-1">
                  <h5 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {person.name}
                  </h5>
                  <ul className={cn('flex flex-col gap-1', compact && 'gap-0.5')}>
                    {person.points.map((point) => (
                      <li key={point} className={cn(bilingualText, 'flex gap-2')}>
                        <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                        <span className="min-w-0">{point}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyFilterState
              label={`No discussion points for ${filteredPersonName ?? 'this filter'} — clear filter`}
              onClear={clearAllFilters}
            />
          )}
        </Panel>
      ) : null}

      {notes.questions.length > 0 && kindIncluded('question') ? (
        <Panel
          id="for-next-meeting"
          title="For next meeting"
          icon={MessageCircleQuestion}
          kind="question"
          count={visibleQuestionCount}
        >
          {visibleQuestionEntries.length > 0 ? (
            <ul className={cn('flex flex-col gap-3', compact && 'gap-2')}>
              {visibleQuestionEntries.map((entry) => (
                <li key={entry.person} className="flex flex-col gap-1">
                  <h5 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {entry.person}
                  </h5>
                  <ul className={cn('flex flex-col gap-1', compact && 'gap-0.5')}>
                    {entry.questions.map((question) => (
                      <li key={question} className={cn(bilingualText, 'flex gap-2')}>
                        <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                        <span className="min-w-0">{question}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyFilterState
              label={`No questions for ${filteredPersonName ?? 'this filter'} for next meeting — clear filter`}
              onClear={clearAllFilters}
            />
          )}
        </Panel>
      ) : null}

      {notes.terms.length > 0 && kindIncluded('term') ? (
        // Glossary terms belong to the meeting, not to any one attendee, so
        // the person filter never narrows this list (see PERSON_SCOPED_KINDS
        // in meeting-panels-model.ts) — no empty-filter state needed here.
        <Panel id="glossary" title="Glossary" icon={BookOpen} kind="term" count={notes.terms.length}>
          {/* A description list, because that is what this is: the term is
              the thing being defined and the explanation is its definition. */}
          <dl className="flex flex-col gap-2">
            {notes.terms.map((term) => (
              <div key={term.term} className="flex flex-col gap-0.5">
                <dt className="text-sm font-medium">
                  {term.term}
                  {term.sinhala ? (
                    <span lang="si" className="ml-2 font-normal text-muted-foreground">
                      {term.sinhala}
                    </span>
                  ) : null}
                </dt>
                <dd className={cn(bilingualText, 'text-muted-foreground')}>{term.explanation}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}

      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <Sparkles className="size-3 shrink-0" aria-hidden />
        Written up by AI on{' '}
        <span className="font-mono">{format(notes.createdAt, 'MMM d, h:mm a')}</span>
        <span aria-hidden>·</span>
        <span className="font-mono">{notes.model}</span>
      </p>
    </div>
  )
}

/**
 * Which language block(s) to render for the given mode. Never returns an
 * empty result and never returns a block whose content is blank: if the
 * requested single-language bucket turned out empty (the model wrote the
 * whole summary in the other language despite the split predicting
 * otherwise), this falls back to whichever bucket actually has content
 * rather than showing a panel with nothing in it.
 */
function resolveSummaryBlocks(
  mode: SummaryLanguage,
  en: string,
  si: string,
  raw: string,
): { lang: 'en' | 'si'; content: string }[] {
  const hasEn = en.trim().length > 0
  const hasSi = si.trim().length > 0
  if (!hasSi) return [{ lang: 'en', content: raw }]
  if (mode === 'both') {
    const blocks: { lang: 'en' | 'si'; content: string }[] = []
    if (hasEn) blocks.push({ lang: 'en', content: en })
    blocks.push({ lang: 'si', content: si })
    return blocks
  }
  if (mode === 'si') return [{ lang: 'si', content: si }]
  return hasEn ? [{ lang: 'en', content: en }] : [{ lang: 'si', content: si }]
}

/**
 * One commitment: what it is, who owes it, and when it is due — the three
 * things a reader is scanning for, in that order, on one line at every width
 * that fits and wrapped in the same order when it does not.
 *
 * Only a date that has actually passed gets the danger colour; a due date the
 * model wrote as a phrase ("next Friday") is shown as those words with no
 * colour at all, because we refused to guess which Friday (see
 * parseSpokenDueDate).
 */
function ActionItemRow({ action, compact }: { action: ActionRow; compact?: boolean }) {
  const overdue = action.status === 'overdue'
  return (
    <li
      className={cn(
        'flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2',
        compact && 'px-2.5 py-1.5',
        overdue && 'bg-destructive/5',
      )}
    >
      <span className={cn(bilingualText, 'min-w-0 flex-1 basis-48')}>{action.text}</span>
      <span className="flex shrink-0 flex-wrap items-center gap-1.5">
        {action.owner ? (
          <span className="text-xs font-medium text-muted-foreground">{action.owner}</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">Unassigned</span>
        )}
        <DueChip action={action} />
      </span>
    </li>
  )
}

function DueChip({ action }: { action: ActionRow }) {
  if (action.status === 'unscheduled') return null
  if (action.status === 'unparsed') {
    // The model's own words. No date maths was possible, so no urgency is
    // claimed — this is a quote, not a deadline we verified.
    return <MetaChip>Due {action.due}</MetaChip>
  }

  const day = action.dueDate ? format(action.dueDate, 'MMM d') : (action.due ?? '')
  if (action.status === 'overdue') {
    return (
      <MetaChip tone="danger">
        Overdue · <span className="font-mono">{day}</span>
      </MetaChip>
    )
  }
  if (action.status === 'today') return <MetaChip tone="warning">Due today</MetaChip>
  if (action.status === 'soon') {
    return (
      <MetaChip tone="warning">
        Due <span className="font-mono">{day}</span>
      </MetaChip>
    )
  }
  return (
    <MetaChip>
      Due <span className="font-mono">{day}</span>
    </MetaChip>
  )
}

/**
 * Shown in place of the sections above when a meeting has never been
 * analyzed. Kept here, next to what it stands in for, and deliberately
 * distinct from "we tried to load the notes and failed" — which is an error
 * with a Retry button, not this.
 */
export function MeetingNotesEmpty({ canRecord, children }: { canRecord: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-lg border border-dashed px-4 py-6">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <CircleCheck className="size-4 text-muted-foreground" aria-hidden />
        No AI write-up for this meeting yet
      </p>
      <p className="text-sm text-muted-foreground">
        {canRecord
          ? 'Record it (mic, or screen + mic for a call) and LogPup transcribes, summarizes and pulls out the action items — English and Sinhala both work.'
          : 'The meeting host can record and analyze it.'}
      </p>
      {children}
    </div>
  )
}
