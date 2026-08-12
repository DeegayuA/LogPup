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
import {
  bilingualLead,
  bilingualText,
  MetaChip,
  SectionHeading,
} from '@/features/meetings/components/meeting-chips'
import { buildActionList, type ActionRow } from '@/features/meetings/components/meeting-notes-model'
import type { MeetingAiNotesView } from '@/features/meetings/ai-actions'

/**
 * What the meeting produced, as five sections with real hierarchy instead of
 * one undifferentiated wall of h4s.
 *
 * Reading order is by usefulness, not by the order the model happens to emit:
 * the summary is what someone who missed the meeting reads, the merged action
 * list is what someone who attended it needs, and the discussion points,
 * open questions and glossary are the record you go back to. Each section is
 * its own <section> with its own heading so the whole thing is navigable by
 * heading, and every section is skipped entirely when it is empty rather than
 * rendering a heading over nothing.
 *
 * Server-component-safe by construction (no hooks, no directive): the AI
 * notes are read-only, so nothing here needs to ship as interactive client
 * code beyond the panel that already had to.
 */
export function MeetingAiNotes({
  notes,
  now,
  headingId,
}: {
  notes: MeetingAiNotesView
  /** Passed in so the "overdue" decision is testable and render-pure. */
  now: Date
  headingId?: string
}) {
  const actions = buildActionList(notes, now)
  const discussion = notes.perPerson.filter((person) => person.points.length > 0)

  return (
    <div className="flex flex-col gap-5">
      {notes.summary ? (
        <section className="flex flex-col gap-2" aria-labelledby={headingId}>
          <SectionHeading id={headingId} icon={Sparkles} title="Summary" />
          {/* The one piece of prose on the page that is allowed to be bigger
              than body text. `bilingualLead` buys the extra leading Sinhala
              needs — see meeting-chips.tsx. */}
          <MarkdownLite
            content={notes.summary}
            className={cn(bilingualLead, 'text-foreground')}
          />
        </section>
      ) : null}

      {actions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading icon={ListChecks} title="Action items" count={actions.length} />
          <ul className="flex flex-col divide-y divide-border rounded-lg border">
            {actions.map((action) => (
              <ActionItemRow key={action.key} action={action} />
            ))}
          </ul>
        </section>
      ) : null}

      {discussion.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading icon={Users} title="Discussion" count={discussion.length} />
          <ul className="flex flex-col gap-3">
            {discussion.map((person) => (
              <li key={person.name} className="flex flex-col gap-1">
                <h5 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {person.name}
                </h5>
                <ul className="flex flex-col gap-1">
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
        </section>
      ) : null}

      {notes.questions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading
            icon={MessageCircleQuestion}
            title="For next meeting"
            count={notes.questions.reduce((total, entry) => total + entry.questions.length, 0)}
          />
          <ul className="flex flex-col gap-3">
            {notes.questions.map((entry) => (
              <li key={entry.person} className="flex flex-col gap-1">
                <h5 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {entry.person}
                </h5>
                <ul className="flex flex-col gap-1">
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
        </section>
      ) : null}

      {notes.terms.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading icon={BookOpen} title="Glossary" count={notes.terms.length} />
          {/* A description list, because that is what this is: the term is the
              thing being defined and the explanation is its definition. */}
          <dl className="flex flex-col gap-2">
            {notes.terms.map((term) => (
              <div key={term.term} className="flex flex-col gap-0.5">
                <dt className="text-sm font-medium">
                  {term.term}
                  {term.sinhala ? (
                    <span className="ml-2 font-normal text-muted-foreground">
                      {term.sinhala}
                    </span>
                  ) : null}
                </dt>
                <dd className={cn(bilingualText, 'text-muted-foreground')}>{term.explanation}</dd>
              </div>
            ))}
          </dl>
        </section>
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
 * One commitment: what it is, who owes it, and when it is due — the three
 * things a reader is scanning for, in that order, on one line at every width
 * that fits and wrapped in the same order when it does not.
 *
 * Only a date that has actually passed gets the danger colour; a due date the
 * model wrote as a phrase ("next Friday") is shown as those words with no
 * colour at all, because we refused to guess which Friday (see
 * parseSpokenDueDate).
 */
function ActionItemRow({ action }: { action: ActionRow }) {
  const overdue = action.status === 'overdue'
  return (
    <li className={cn('flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2', overdue && 'bg-destructive/5')}>
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
