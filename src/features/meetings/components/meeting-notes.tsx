'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { format } from 'date-fns'
import {
  AlertTriangle,
  BookOpen,
  CircleCheck,
  ListChecks,
  Loader2Icon,
  MessageCircleQuestion,
  PlusCircle,
  Sparkles,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MarkdownLite } from '@/components/markdown-lite'
import { cn } from '@/lib/utils'
import {
  bilingualLead,
  bilingualText,
  MetaChip,
  SectionHeading,
} from '@/features/meetings/components/meeting-chips'
import type { ActionRow } from '@/features/meetings/components/meeting-notes-model'
import { SpeakButton } from '@/features/speech/components/speak-button'
import {
  EmptyFilterState,
  Panel,
  SummaryLanguageControl,
  useFilteredRows,
  usePanels,
  useSummaryLanguage,
} from '@/features/meetings/components/meeting-panels'
import { splitBilingualSummary, type SummaryLanguage } from '@/features/meetings/components/meeting-panels-model'
import {
  ActionItemSuggestionsList,
  buildAssigneePool,
  useActionItemActions,
} from '@/features/meetings/components/action-item-board'
import { trackActionItem, type MeetingAiNotesView, type TaskSuggestionView } from '@/features/meetings/ai-actions'
import type { MentionUser } from '@/components/mention-textarea'

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
  meetingId,
  meetingTitle,
  canManage,
  attendees,
  appId,
  mentionUsers,
  suggestions,
  untrackedActions,
  onSuggestionsChanged,
}: {
  notes: MeetingAiNotesView
  meetingId: string
  meetingTitle: string
  /** Same admin-or-creator tier the rest of the meeting's manage actions use. */
  canManage: boolean
  attendees: { id: string; name: string }[]
  appId: string | null
  /** Wider mention pool for the assignee picker (falls back to attendees). */
  mentionUsers?: MentionUser[]
  /**
   * Open + auto-accepted meeting_task_suggestions rows — the single source
   * of truth for this panel's "Action items" content. Editable here with
   * exactly the same controls the Record timeline uses (see
   * action-item-board.tsx) because this literally is the same list, fetched
   * once as part of getMeetingIntel.
   */
  suggestions: TaskSuggestionView[]
  /**
   * JSONB action items (deadlines[]/perPerson[].actionItems[]) with no
   * matching suggestion of any status — see reconcileActionItems in
   * meeting-notes-model.ts and getMeetingIntel. Rendered in a "Not tracked"
   * group with a one-click "track this" (trackActionItem) rather than
   * silently dropped now that this panel no longer renders the raw JSONB
   * list directly.
   */
  untrackedActions: ActionRow[]
  /** Reloads the parent's getMeetingIntel fetch — called after any write
   *  here (accept/dismiss/undo/edit/track) so `suggestions`/`untrackedActions`
   *  catch up with what the server actually stored. */
  onSuggestionsChanged: () => Promise<void>
}) {
  const { filters, people, clearAllFilters, density } = usePanels()
  const kindIncluded = (kind: 'action' | 'discussion' | 'question' | 'term') =>
    !filters.kinds || filters.kinds.has(kind)
  const filteredPersonName = filters.personId
    ? (people.find((p) => p.id === filters.personId)?.name ?? null)
    : null

  // A local override lets an inline edit (assignee/due date/title) show up
  // immediately without waiting on the parent's full intel reload. Cleared
  // the moment a fresh `suggestions` prop actually lands (a real reload —
  // `intel` state only gets a new array reference from a genuine
  // getMeetingIntel refetch, never from an unrelated re-render), via React's
  // documented "adjust state during render" pattern (comparing against the
  // last-seen prop in state) rather than an effect, which would paint one
  // stale frame with the old override before clearing it a tick later.
  const [prevSuggestionsProp, setPrevSuggestionsProp] = useState(suggestions)
  const [suggestionsOverride, setSuggestionsOverride] = useState<TaskSuggestionView[] | null>(null)
  if (suggestions !== prevSuggestionsProp) {
    setPrevSuggestionsProp(suggestions)
    setSuggestionsOverride(null)
  }
  const liveSuggestions = suggestionsOverride ?? suggestions
  const assigneePool = buildAssigneePool(attendees, mentionUsers)
  const actionItemActions = useActionItemActions(
    liveSuggestions,
    (updater) => setSuggestionsOverride(updater(liveSuggestions)),
    async () => {
      setSuggestionsOverride(null)
      await onSuggestionsChanged()
    },
    assigneePool,
  )

  const { visible: visibleSuggestions } = useFilteredRows(liveSuggestions, (s) => ({
    kind: 'action' as const,
    personNames: s.suggestedUserName ? [s.suggestedUserName] : [],
  }))

  const [trackedKeys, setTrackedKeys] = useState<Set<string>>(new Set())
  const [trackingKey, setTrackingKey] = useState<string | null>(null)
  const [trackPending, startTrackPending] = useTransition()
  const liveUntracked = untrackedActions.filter((row) => !trackedKeys.has(row.key))
  const { visible: visibleUntracked } = useFilteredRows(liveUntracked, (row) => ({
    kind: 'action' as const,
    personNames: row.owner ? [row.owner] : [],
  }))

  function handleTrack(row: ActionRow) {
    setTrackingKey(row.key)
    startTrackPending(async () => {
      try {
        const res = await trackActionItem({ meetingId, text: row.text, owner: row.owner, due: row.due })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setTrackedKeys((prev) => new Set(prev).add(row.key))
        toast.success('Tracked — now editable below')
        await onSuggestionsChanged()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setTrackingKey(null)
      }
    })
  }

  const totalActionCount = liveSuggestions.length + liveUntracked.length
  const visibleActionCount = visibleSuggestions.length + visibleUntracked.length

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
        <Panel
          id="summary"
          title="Summary"
          icon={Sparkles}
          // Reads exactly what is on screen — the language control below
          // decides which blocks those are, so switching to Sinhala and
          // pressing play speaks Sinhala rather than the English original.
          headerExtra={
            <SpeakButton getText={() => summaryBlocks.map((block) => block.content).join('\n\n')} />
          }
        >
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

      {totalActionCount > 0 && kindIncluded('action') ? (
        <Panel id="action-items" title="Action items" icon={ListChecks} kind="action" count={visibleActionCount}>
          {visibleActionCount > 0 ? (
            <div className="flex flex-col gap-3">
              <ActionItemSuggestionsList
                suggestions={visibleSuggestions}
                attendees={attendees}
                mentionUsers={mentionUsers}
                appId={appId}
                meetingTitle={meetingTitle}
                deadlines={notes.deadlines}
                canManage={canManage}
                compact={compact}
                autoAssignCappedCount={notes.autoAssignCappedCount}
                actions={actionItemActions}
              />
              {visibleUntracked.length > 0 ? (
                <section className="flex flex-col gap-2">
                  <SectionHeading
                    as="h5"
                    icon={AlertTriangle}
                    title="Not tracked"
                    count={visibleUntracked.length}
                  />
                  <p className="text-2xs text-muted-foreground">
                    The write-up mentions these, but they never became a suggestion card — track one to
                    make it editable and acceptable like the rest.
                  </p>
                  <ul className={cn('flex flex-col divide-y divide-border rounded-lg border', compact && 'text-sm')}>
                    {visibleUntracked.map((row) => (
                      <UntrackedActionRow
                        key={row.key}
                        action={row}
                        compact={compact}
                        canManage={canManage}
                        pending={trackingKey === row.key && trackPending}
                        onTrack={() => handleTrack(row)}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
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
 * One JSONB-only commitment the suggestion pipeline never saw (see
 * reconcileActionItems) — what it is, who owes it, and when it is due, same
 * read-only layout the merged Action-items list used before this panel
 * switched to rendering identity-bearing suggestion rows, plus a "Track
 * this" button that turns it into one (trackActionItem). No inline editing
 * here — there is no row to edit until it is tracked.
 *
 * Only a date that has actually passed gets the danger colour; a due date the
 * model wrote as a phrase ("next Friday") is shown as those words with no
 * colour at all, because we refused to guess which Friday (see
 * parseSpokenDueDate).
 */
function UntrackedActionRow({
  action,
  compact,
  canManage,
  pending,
  onTrack,
}: {
  action: ActionRow
  compact?: boolean
  canManage: boolean
  pending: boolean
  onTrack: () => void
}) {
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
        {canManage ? (
          <Button variant="outline" size="sm" type="button" disabled={pending} onClick={onTrack}>
            {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <PlusCircle aria-hidden />}
            Track this
          </Button>
        ) : null}
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
