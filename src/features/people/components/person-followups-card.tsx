import { CircleCheck, HelpCircle, ListChecks } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionEmpty } from '@/features/people/components/section-empty'
import { formatBusinessDayMonth } from '@/features/people/format-instant'
import {
  FOLLOWUP_STALE_DAYS,
  type PersonFollowupItem,
  type PersonFollowups,
} from '@/features/people/followup-split'
import { cn } from '@/lib/utils'

/**
 * Meeting follow-ups, in both directions — the capability this page was
 * missing entirely. Every open question or action item the meeting AI
 * attributes to a person already carries its source meeting and its age, and
 * until now it was visible only inside one meeting's Intelligence panel: the
 * product could not answer "what does this person still owe, and since when".
 *
 * The two directions are SEPARATE SECTIONS, never one merged list. "You owe
 * three answers" and "you are waiting on three answers" demand opposite actions
 * from the reader, and a merged list with a direction chip per row makes them
 * do the sorting themselves.
 *
 * Age is the loudest thing on each row after the text, because a follow-up's
 * whole problem is duration. Anything older than a fortnight is flagged in the
 * danger token AND says "31d" — the number is the signal, the colour only
 * amplifies it.
 */
const VISIBLE_PER_LIST = 5

/**
 * The first name, or the whole name when there is no space in it. `split(' ')`
 * alone returns '' for an empty or space-led name, which rendered a heading
 * that read simply " owes".
 */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim() || 'This person'
}

export function PersonFollowupsCard({
  followups,
  personName,
}: {
  followups: PersonFollowups
  personName: string
}) {
  const { owed, awaiting } = followups
  const total = owed.length + awaiting.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Follow-ups</CardTitle>
        <CardAction>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {owed.length} owed · {awaiting.length} awaited
          </span>
        </CardAction>
      </CardHeader>

      {total === 0 ? (
        <SectionEmpty
          icon={CircleCheck}
          title="Nothing outstanding."
          hint="Questions and action items raised in meetings show up here until they're resolved."
        />
      ) : (
        <CardContent className="flex flex-col gap-4">
          <FollowupList
            heading={`${firstName(personName)} owes`}
            emptyLine="Nothing outstanding on their side."
            items={owed}
            showOwner={false}
          />
          <FollowupList
            heading="Waiting on others"
            emptyLine="They aren't waiting on anyone."
            items={awaiting}
            showOwner
          />
        </CardContent>
      )}
    </Card>
  )
}

function FollowupList({
  heading,
  emptyLine,
  items,
  showOwner,
}: {
  heading: string
  emptyLine: string
  items: PersonFollowupItem[]
  showOwner: boolean
}) {
  const visible = items.slice(0, VISIBLE_PER_LIST)
  const hidden = items.slice(VISIBLE_PER_LIST)

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {heading}
        </h3>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLine}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {visible.map((item) => (
              <FollowupRow key={item.id} item={item} showOwner={showOwner} />
            ))}
          </ul>
          {hidden.length > 0 ? (
            <details className="group/more">
              <summary className="w-fit cursor-pointer list-none rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="group-open/more:hidden">Show {hidden.length} more</span>
                <span className="hidden group-open/more:inline">Show fewer</span>
              </summary>
              <ul className="mt-1.5 flex flex-col divide-y divide-border rounded-lg border border-border">
                {hidden.map((item) => (
                  <FollowupRow key={item.id} item={item} showOwner={showOwner} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  )
}

function FollowupRow({ item, showOwner }: { item: PersonFollowupItem; showOwner: boolean }) {
  const stale = item.ageDays >= FOLLOWUP_STALE_DAYS
  const Icon = item.kind === 'question' ? HelpCircle : ListChecks

  return (
    <li className="flex flex-col gap-1 px-3 py-2">
      <div className="flex items-start gap-2">
        {/* role="img" is load-bearing, not decoration: `aria-label` on a bare
            <svg> is ignored by several screen readers because an <svg> has no
            implicit role to name. Without it the only thing distinguishing a
            question from an action item was the glyph. */}
        <Icon
          role="img"
          aria-label={item.kind === 'question' ? 'Open question' : 'Action item'}
          className={cn(
            'mt-0.5 size-3.5 shrink-0',
            stale ? 'text-destructive' : 'text-muted-foreground',
          )}
        />
        <span className="min-w-0 flex-1 text-sm">{item.text}</span>
        {/* The age is announced in full — "open 31 days" — because "31d" is
            read out as "thirty-one d", and this number is the whole point of
            the row. */}
        <span
          className={cn(
            'shrink-0 font-mono text-2xs tabular-nums',
            stale ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          <span aria-hidden>{item.ageDays}d</span>
          <span className="sr-only">
            open {item.ageDays} {item.ageDays === 1 ? 'day' : 'days'}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-5.5 text-2xs text-muted-foreground">
        {showOwner ? (
          <Badge variant="outline" className="text-2xs font-normal text-muted-foreground">
            {item.ownerName}
          </Badge>
        ) : null}
        <span className="truncate">{item.meetingTitle}</span>
        <span aria-hidden>·</span>
        {/* Business timezone, so the printed date and the age above it come
            from the same calendar. `ageDays` is measured in Colombo days
            (followup-split.ts); date-fns would have printed the server's day,
            so a meeting at 20:00 UTC showed "Aug 11 · 0d" — a date and an age
            that contradict each other. */}
        <time dateTime={item.meetingStartsAt.toISOString()} className="font-mono tabular-nums">
          {formatBusinessDayMonth(item.meetingStartsAt)}
        </time>
      </div>
      {/* What they've SAID about it while it is still open, and why it isn't
          done — both are open-only fields that exist precisely so an item can
          carry forward with context instead of just getting older. */}
      {item.responseNote ? (
        <p className="pl-5.5 text-2xs text-muted-foreground">
          <span className="font-medium">Said:</span> {item.responseNote}
        </p>
      ) : null}
      {item.deferReason ? (
        <p className="pl-5.5 text-2xs text-muted-foreground">
          <span className="font-medium">Not yet:</span> {item.deferReason}
        </p>
      ) : null}
    </li>
  )
}
