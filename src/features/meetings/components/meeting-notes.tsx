'use client'

import { useId, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  AlertTriangle,
  BookOpen,
  CheckIcon,
  CircleCheck,
  FileDown,
  ListChecks,
  Loader2Icon,
  PencilIcon,
  MessageCircleQuestion,
  ScrollText,
  Sparkles,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownLite } from '@/components/markdown-lite'
import { cn } from '@/lib/utils'
import {
  bilingualLead,
  bilingualText,
  MetaChip,
  SectionHeading,
} from '@/features/meetings/components/meeting-chips'
import {
  createActionItemPromoter,
  resolveUntrackedDue,
  type ActionItemPromoter,
  type ActionRow,
} from '@/features/meetings/components/meeting-notes-model'
import {
  buildSuggestionUpdatePayload,
  type ActionItemEditPatch,
} from '@/features/meetings/components/note-timeline-model'
import { SpeakButton } from '@/features/speech/components/speak-button'
import { updateMeetingSummary } from '@/features/meetings/followup-move-actions'
import { SelectionCorrector } from '@/features/meetings/components/correct-selection'
import { ReplaceReviewDialog } from '@/features/meetings/components/replace-review-dialog'
import type { MeetingReplaceMatches } from '@/features/meetings/text-replace-actions'
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
  ActionItemAssignee,
  ActionItemDueDate,
  ActionItemSuggestionsList,
  ActionItemTitle,
  buildAssigneePool,
  useActionItemActions,
} from '@/features/meetings/components/action-item-board'
import {
  acceptTaskSuggestion,
  trackActionItem,
  updateTaskSuggestion,
  type MeetingAiNotesView,
  type TaskSuggestionView,
} from '@/features/meetings/ai-actions'
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
  appIds,
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
  /** The meeting's projects — a set, none primary; `[]` is the app-less meeting. */
  appIds: string[]
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

  // Rows this panel has turned into a real task. The server stops returning
  // them as untracked on its next pass too (the accepted suggestion now
  // matches the JSONB item — see reconcileActionItems), but that pass is a
  // round trip away and the row must not flash back in the meantime.
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())
  // Rows an inline edit has already promoted into a suggestion but which
  // nobody has added as a task yet.
  const [promotedKeys, setPromotedKeys] = useState<Set<string>>(new Set())
  // …and this set is applied ONLY when a genuinely new `untrackedActions`
  // lands, never at the moment a key joins it. Promotion happens DURING an
  // edit, so dropping the row from the list right then would unmount the
  // control under the hands of the person using it. By the time fresh data
  // arrives the server has usually stopped returning the row anyway, which
  // leaves this to catch one leftover: a title edited far enough that
  // reconcileActionItems' similarity match no longer holds, where the row
  // would otherwise come back as a duplicate of the suggestion it became.
  // Same "adjust state during render" pattern as the suggestions override
  // above, for the same reason an effect is wrong here.
  const [prevUntrackedProp, setPrevUntrackedProp] = useState(untrackedActions)
  const [untrackedRows, setUntrackedRows] = useState(untrackedActions)
  if (untrackedActions !== prevUntrackedProp) {
    setPrevUntrackedProp(untrackedActions)
    setUntrackedRows(untrackedActions.filter((row) => !promotedKeys.has(row.key)))
  }
  const liveUntracked = untrackedRows.filter((row) => !addedKeys.has(row.key))
  const { visible: visibleUntracked } = useFilteredRows(liveUntracked, (row) => ({
    kind: 'action' as const,
    personNames: row.owner ? [row.owner] : [],
  }))

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

  /**
   * INLINE WRITE-UP EDITING.
   *
   * The summary used to be regenerate-or-live-with-it. A write-up is a record
   * people circulate, and the model gets a name or a number subtly wrong
   * often enough that "fix that one line" has to be possible without throwing
   * away the whole pass.
   *
   * The draft is the RAW stored text, not the language slice on screen: a
   * bilingual write-up keeps English and Sinhala in one column
   * (splitBilingualSummary reads them apart at render time), so saving back
   * the English view would write over both and destroy the Sinhala half.
   */
  const router = useRouter()

  // The write-up is the half of this page a mis-heard name does the most damage
  // in: it is what gets circulated, and its Sinhala half is generated from the
  // same transcript as its English one, so a name the model heard wrong is
  // wrong twice over in the one document people quote. Highlighting it here
  // reaches the same correction flow as the note timeline's.
  const summaryRef = useRef<HTMLDivElement>(null)
  const [summaryReplace, setSummaryReplace] = useState<{
    term: string
    replacement: string
    matches: MeetingReplaceMatches
  } | null>(null)

  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [summarySaving, startSummarySave] = useTransition()

  function openSummaryEditor() {
    setSummaryDraft(notes.summary ?? '')
    setEditingSummary(true)
  }

  function saveSummary() {
    startSummarySave(async () => {
      try {
        const res = await updateMeetingSummary({ meetingId, summary: summaryDraft })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Write-up updated')
        setEditingSummary(false)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <div
      className={cn(
        // A column, not a grid. The summary and the AI byline are full-width
        // siblings; the panels between them do their own two-column flow
        // below, which a grid on this element would fight.
        'flex flex-col gap-3',
      )}
    >
      {notes.summary ? (
        <Panel
          id="summary"
          // Full width even in two-column mode. The summary is prose somebody
          // reads start to finish; prose in a half-width column beside a list
          // of action items is harder to read, not denser. It sits OUTSIDE
          // the column flow below, so it needs no span of its own.
          title="Summary"
          icon={Sparkles}
          // Reads exactly what is on screen — the language control below
          // decides which blocks those are, so switching to Sinhala and
          // pressing play speaks Sinhala rather than the English original.
          headerExtra={
            <span className="flex items-center gap-1">
              {canManage && !editingSummary ? (
                <Button variant="ghost" size="sm" type="button" onClick={openSummaryEditor}>
                  <PencilIcon aria-hidden />
                  Edit
                </Button>
              ) : null}
              <SpeakButton
                getText={() => summaryBlocks.map((block) => block.content).join('\n\n')}
              />
              {/* Both open the print-clean A4 view (browser's Save as PDF is
                  the export path — see src/app/print/meetings/[id]/page.tsx).
                  "Full record" is the every-small-thing version: complete
                  transcript and the whole note timeline, straight from the
                  record with no AI pass. */}
              <Button
                variant="outline"
                size="sm"
                render={<a href={`/print/meetings/${meetingId}`} target="_blank" rel="noreferrer" />}
              >
                <FileDown aria-hidden />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                render={
                  <a href={`/print/meetings/${meetingId}?full=1`} target="_blank" rel="noreferrer" />
                }
              >
                <ScrollText aria-hidden />
                Full record
              </Button>
            </span>
          }
        >
          {editingSummary ? (
            <div className="flex flex-col gap-2">
              <Textarea
                value={summaryDraft}
                onChange={(event) => setSummaryDraft(event.target.value)}
                rows={16}
                maxLength={20000}
                aria-label="Meeting write-up"
                className="font-mono text-xs leading-relaxed"
              />
              <p className="text-2xs text-muted-foreground">
                {hasSinhala
                  ? 'This is the raw write-up — both languages in one text. Editing only the English half here would delete the Sinhala one.'
                  : 'Markdown: ### for a heading, - for a bullet, **bold**.'}{' '}
                Clearing it entirely removes the write-up.
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" type="button" disabled={summarySaving} onClick={saveSummary}>
                  {summarySaving ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
                  {summarySaving ? 'Saving…' : 'Save write-up'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={summarySaving}
                  onClick={() => setEditingSummary(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
          {!editingSummary && hasSinhala ? (
            <SummaryLanguageControl value={summaryLang} onChange={setSummaryLang} hasSinhala={hasSinhala} />
          ) : null}
          <div ref={summaryRef} className={cn('flex flex-col gap-3', editingSummary && 'hidden')}>
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

          {/* Off while the raw editor is open: the textarea has the whole
              write-up in it, corrections there are ordinary typing, and a
              floating button over somebody's cursor is in the way. */}
          <SelectionCorrector
            meetingId={meetingId}
            containerRef={summaryRef}
            enabled={canManage && !editingSummary}
            onFound={setSummaryReplace}
          />

          {summaryReplace ? (
            <ReplaceReviewDialog
              meetingId={meetingId}
              term={summaryReplace.term}
              replacement={summaryReplace.replacement}
              matches={summaryReplace.matches}
              origin="selection"
              open
              onOpenChange={(next) => {
                if (!next) setSummaryReplace(null)
              }}
              // The write-up arrives as a prop from a server component, so the
              // corrected text only appears on a refetch — same path the inline
              // write-up editor takes after a save.
              onApplied={() => router.refresh()}
            />
          ) : null}
        </Panel>
      ) : null}

      {/* THIS is what Compact buys on a wide screen: two panels per row
          instead of one column of full-width cards with metres of empty gutter
          beside them.

          Multi-column FLOW rather than a two-column grid, because a grid lays
          out in rows: a short panel beside a tall one leaves everything on the
          next row stranded below the taller of the two. With seven action
          items that dead zone under Discussion ran to hundreds of pixels and
          grew with every item added. Columns balance by height instead, so a
          short panel is followed immediately by the next one.

          `break-inside-avoid` is what keeps a panel whole — without it a card
          splits across the column boundary mid-list. `mb-3` rather than a gap,
          since margins are what multi-column honours between siblings. DOM
          order is untouched, so the reading order a screen reader and the tab
          sequence follow is exactly what it was. */}
      <div
        className={cn(
          compact && 'lg:columns-2 lg:gap-3',
          '[&>*]:mb-3 [&>*]:break-inside-avoid lg:[&>*:last-child]:mb-0',
        )}
      >
      {totalActionCount > 0 && kindIncluded('action') ? (
        <Panel id="action-items" title="Action items" icon={ListChecks} kind="action" count={visibleActionCount}>
          {visibleActionCount > 0 ? (
            <div className="flex flex-col gap-3">
              <ActionItemSuggestionsList
                suggestions={visibleSuggestions}
                attendees={attendees}
                mentionUsers={mentionUsers}
                appIds={appIds}
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
                    The write-up mentions these, but the suggestion pass never picked them up. They edit
                    exactly like the cards above — the first edit is what saves one for good.
                  </p>
                  <ul className={cn('flex flex-col divide-y divide-border rounded-lg border', compact && 'text-sm')}>
                    {visibleUntracked.map((row) => (
                      <UntrackedActionRow
                        key={row.key}
                        action={row}
                        meetingId={meetingId}
                        compact={compact}
                        canManage={canManage}
                        attendees={attendees}
                        assigneePool={assigneePool}
                        appIds={appIds}
                        onPromoted={() => setPromotedKeys((prev) => new Set(prev).add(row.key))}
                        onAdded={async () => {
                          setAddedKeys((prev) => new Set(prev).add(row.key))
                          await onSuggestionsChanged()
                        }}
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

      </div>

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
 * reconcileActionItems), rendered with the SAME controls a suggestion card
 * has — editable title, the shared attendee-first assignee picker, an
 * editable due date, and one "Add task" button that files it.
 *
 * It used to be plain text plus a "Track this" button, on the reasoning that
 * there is no row to edit until it is tracked. That is true of the database
 * and irrelevant to the person reading it: the panel offered a control that
 * did the housekeeping and then made them find the row again somewhere else
 * to do the thing they actually wanted. The two-step is gone —
 * createActionItemPromoter (meeting-notes-model.ts) does the promotion on the
 * first edit, once, in order, and its doc comment carries the full reasoning
 * for promoting on edit rather than holding a draft.
 *
 * Preserved from the read-only version: only a date that has actually passed
 * gets the danger colour, and a due date the model wrote as a phrase ("next
 * Friday") is shown as those words with no colour at all, because we refused
 * to guess which Friday (see parseSpokenDueDate / resolveUntrackedDue).
 */
function UntrackedActionRow({
  action,
  meetingId,
  compact,
  canManage,
  attendees,
  assigneePool,
  appIds,
  onPromoted,
  onAdded,
}: {
  action: ActionRow
  meetingId: string
  compact?: boolean
  canManage: boolean
  attendees: { id: string; name: string }[]
  /** Attendees first, then the rest of the workspace — NOT a filter: the AI
   *  routinely names somebody who was not in the room. */
  assigneePool: MentionUser[]
  /** The meeting's projects — `[]` is the app-less meeting, the one state
   *  where the server has nowhere to file an unrouted item (see
   *  acceptTaskSuggestion) and "Add task" would fail after promoting. */
  appIds: string[]
  /** Called the first time an edit turns this row into a real suggestion. */
  onPromoted: () => void
  /** Called once "Add task" has created the task — reloads the parent's intel. */
  onAdded: () => Promise<void>
}) {
  // `action.key` is normalized write-up text (spaces, punctuation) and is not
  // safe as a DOM id; the due editor needs one for its label association.
  const rowId = useId()

  const [title, setTitle] = useState(action.text)
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [assigneeName, setAssigneeName] = useState<string | null>(null)
  // `undefined` = nobody has touched the date, so the write-up's own words
  // still stand; `null` = explicitly cleared. See resolveUntrackedDue.
  const [dueEdit, setDueEdit] = useState<string | null | undefined>(undefined)
  const [promoted, setPromoted] = useState(false)

  const [saving, startSaving] = useTransition()
  const [adding, startAdding] = useTransition()
  const addingRef = useRef(false)
  const promotedRef = useRef(false)

  const promoter = useRef<ActionItemPromoter | null>(null)
  if (promoter.current === null) {
    promoter.current = createActionItemPromoter(async () => {
      // Promoted with what the WRITE-UP said, never the current draft: that
      // original wording is what reconcileActionItems matches this JSONB item
      // against on the next load, and any edit is applied to the row that
      // comes back moments later anyway (the promoter runs queued writes in
      // submission order). Assignee is deliberately not sent — trackActionItem
      // refuses to record a first-name guess as a confirmed attribution.
      const res = await trackActionItem({
        meetingId,
        text: action.text,
        owner: action.owner,
        due: action.due,
      })
      return res.ok ? { ok: true, id: res.data.id } : { ok: false, error: res.error }
    })
  }

  function notePromotion() {
    if (promotedRef.current || !promoter.current?.id) return
    promotedRef.current = true
    setPromoted(true)
    onPromoted()
  }

  /**
   * One inline edit, promoting the row first if it is still JSONB-only.
   * Optimistic, with the same discipline as the suggestion cards': the
   * control shows the new value immediately and `revert` puts the old one
   * back if the write did not land.
   */
  function saveEdit(patch: ActionItemEditPatch, revert: () => void) {
    startSaving(async () => {
      try {
        const res = await promoter.current!.run((suggestionId) =>
          updateTaskSuggestion(suggestionId, buildSuggestionUpdatePayload(patch)),
        )
        notePromotion()
        if (!res.ok) {
          toast.error(res.error)
          revert()
        }
      } catch {
        toast.error('Something went wrong — try again')
        revert()
      }
    })
  }

  function handleAdd() {
    // The button is disabled while this runs, but a double click can land
    // both presses inside one frame — and two accepts means one real task
    // plus one "already handled" error, so the guard is a ref, not a render.
    if (addingRef.current) return
    addingRef.current = true
    startAdding(async () => {
      try {
        // Queued behind any edit still in flight — notably the title commit
        // that this very click caused by blurring the input. Accepting first
        // would file the task under the old wording.
        const res = await promoter.current!.run((suggestionId) => acceptTaskSuggestion(suggestionId))
        notePromotion()
        if (!res.ok) {
          toast.error(res.error)
          addingRef.current = false
          return
        }
        toast.success('Task created')
        // Left latched: the row is about to be dropped from the list, and a
        // click during the reload has nothing left to accept.
        await onAdded()
      } catch {
        toast.error('Something went wrong — try again')
        addingRef.current = false
      }
    })
  }

  const rowDisabled = saving || adding
  // One clock read per render; only the day matters to dueStatus.
  const due = resolveUntrackedDue(action, dueEdit, new Date())
  const noApp = appIds.length === 0

  return (
    <li
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-3 py-2',
        compact && 'px-2.5 py-1.5',
        due.status === 'overdue' && 'bg-destructive/5',
      )}
    >
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        {canManage ? (
          <ActionItemTitle
            value={title}
            disabled={rowDisabled}
            onSave={(next) => {
              const previous = title
              setTitle(next)
              saveEdit({ title: next }, () => setTitle(previous))
            }}
            ariaLabel={`Edit title: ${title}`}
          />
        ) : (
          <p className={cn(bilingualText, 'text-foreground')}>{title}</p>
        )}
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {/* Says the thing the section heading above cannot: this row now HAS
              a suggestion row, so the edit just made survives a reload. */}
          {promoted ? <MetaChip>Now tracked</MetaChip> : null}
          {canManage ? (
            <>
              {/* The write-up's own attribution — free text ("Nadeesha"), never
                  a resolved user id, which is exactly why it cannot be the
                  picker's value. Kept beside the picker so the choice is made
                  WITH what was said, and dropped once somebody has chosen. */}
              {action.owner && !assigneeId ? <MetaChip>Write-up: {action.owner}</MetaChip> : null}
              <ActionItemAssignee
                attendees={attendees}
                currentId={assigneeId}
                currentName={assigneeName}
                people={assigneePool}
                disabled={rowDisabled}
                onChange={(id) => {
                  const previousId = assigneeId
                  const previousName = assigneeName
                  setAssigneeId(id)
                  setAssigneeName(id ? (assigneePool.find((p) => p.id === id)?.name ?? null) : null)
                  saveEdit({ assigneeId: id }, () => {
                    setAssigneeId(previousId)
                    setAssigneeName(previousName)
                  })
                }}
                label={`Assignee for "${title}"`}
              />
              <ActionItemDueDate
                id={rowId}
                currentIso={due.currentIso}
                // No hint lookup: for an untracked row the write-up's phrase
                // IS this row's due date, and it goes through `unresolvedDue`
                // (quoted, no tone) rather than the warning-toned hint chip.
                hint={null}
                unresolvedDue={due.unresolvedDue}
                disabled={rowDisabled}
                onSave={(iso) => {
                  const previous = dueEdit
                  setDueEdit(iso)
                  saveEdit({ dueDate: iso }, () => setDueEdit(previous))
                }}
                label={`Due date for "${title}"`}
              />
            </>
          ) : (
            <>
              {action.owner ? (
                <span className="font-medium">{action.owner}</span>
              ) : (
                <span className="italic">Unassigned</span>
              )}
              <DueChip action={action} />
            </>
          )}
        </p>
      </div>
      {canManage ? (
        <Button
          size="sm"
          type="button"
          className="shrink-0"
          // Same gate the suggestion cards use, and it matters more here: an
          // accept that fails for want of an app would leave behind the
          // suggestion the click had just created.
          disabled={adding || noApp}
          title={noApp ? 'Link this meeting to an app first' : undefined}
          onClick={handleAdd}
        >
          {adding ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
          Add task
        </Button>
      ) : null}
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
