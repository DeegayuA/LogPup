import Link from 'next/link'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar'
import {
  completionPct,
  parseCalendarDate,
  sprintDayProgress,
  HEALTH_LABEL,
  type AppStatus,
  type HealthLevel,
} from '@/features/apps/app-health'
import { HealthDot } from '@/features/apps/components/health-dot'
import { TaskSplitBar } from '@/features/apps/components/task-split-bar'
import { eventDotClasses } from '@/features/meetings/event-color'
import { MINE_LABEL, mineKind } from '@/features/apps/mine'
import type { AppPortfolioEntry } from '@/features/apps/queries'

const STATUS_LABEL: Record<AppStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

/**
 * Left-edge accent keyed to HEALTH, not to status. Status is already stated in
 * words on the card; what you cannot read from six feet away is which of
 * twelve cards needs a human today, and that is the only thing worth spending
 * colour on. `on-track` gets no accent at all — a grid where every card is
 * coloured says nothing.
 */
const HEALTH_ACCENT: Record<HealthLevel, string> = {
  'at-risk': 'border-l-destructive',
  // --warning, not --chart-1: see health-dot.tsx. The split bar below IS a
  // chart and keeps the ramp; this stripe is a status signal and must not.
  watch: 'border-l-warning',
  'on-track': 'border-l-transparent',
  dormant: 'border-l-transparent',
}

const MAX_TAGS = 3
const MAX_AVATARS = 4

/**
 * FIVE BANDS, 187px: header 24 · urgency 16 · bar 26 · context 16 · people 33,
 * plus 4 × gap-2.5 and p-4. The card this replaced ran ~320px and, worse, its
 * height moved with its content — a wrapping Badge row and a sprint block that
 * collapsed from three lines to one meant the tallest card in a row set the
 * height of every card beside it, so the same fact sat at a different y on
 * every card in the grid. Two rules keep that from coming back:
 *
 *   1. A new fact goes INSIDE a band, never on a new line of its own.
 *   2. Every band is one row that cannot wrap: each text child is either
 *      `min-w-0 truncate` or `shrink-0`, and the bands that can empty out
 *      carry a `min-h-*` floor so an app with no tags, no sprint and nobody
 *      assigned is exactly as tall as one with all three. `min-h` rather than
 *      `h` so 200% text-only zoom grows the band instead of clipping it.
 *
 * The narrowest column the grid ever renders is ~206px of content (2 columns
 * at the md sidebar breakpoint, 3 at lg, 4 at xl — see apps-browser.tsx), so
 * every band is designed to degrade by truncating, not by wrapping.
 *
 * TITLE ATTRIBUTES CARRY NO SECRETS. `title` on this card only ever restates
 * text that is already rendered, as a pointer-recovery affordance for a
 * clipped string — the full value stays in the DOM for screen readers and
 * find-in-page either way. Anything that is not visible is either an sr-only
 * span or genuinely deleted; a hover-only fact is invisible to keyboard and
 * touch users, which is most of the ways this page is read.
 */
export function AppCard({
  app,
  today,
  viewerId = null,
}: {
  app: AppPortfolioEntry
  today: string
  /** Signed-in person, or null for a deactivated account with no Actor. */
  viewerId?: string | null
}) {
  // How this viewer is attached to the project, if at all. Read off the row
  // the page already has — see features/apps/mine.ts for why this is
  // membership rather than the permission scope.
  const mine = mineKind(app, viewerId)
  // The app's identity hue, the SAME one its meetings are painted with
  // (features/meetings/event-color.ts assigns it deterministically from the
  // id). A dot rather than the left rule: that edge already carries HEALTH,
  // and the comment on HEALTH_ACCENT is right that a grid where every card is
  // coloured says nothing. Identity answers "which project", health answers
  // "which one needs me today" — two questions, two channels.
  const identityDot = eventDotClasses(app.id)
  const { tasks, currentSprint, nextSprint, lastActivityAt } = app.stats
  const openTasks = tasks.todo + tasks.in_progress
  const donePct = completionPct(tasks)

  const visibleTags = app.techTags.slice(0, MAX_TAGS)
  const extraTags = app.techTags.length - visibleTags.length

  // Lead first in the avatar stack when they're also assigned to the app.
  const members = app.leadId
    ? [...app.members].sort((a, b) =>
        a.userId === app.leadId ? -1 : b.userId === app.leadId ? 1 : 0,
      )
    : app.members
  const visibleMembers = members.slice(0, MAX_AVATARS)
  const extraMembers = members.length - visibleMembers.length

  const progress = currentSprint
    ? sprintDayProgress(currentSprint.startDate, currentSprint.endDate, today)
    : null
  const overrun = progress?.phase === 'ended'

  // One person holding both roles is the COMMON case — every app was
  // backfilled with pm = lead — and it is the one case a single line cannot
  // survive by concatenation: "PM · Jane · Lead · Jane" reads as two different
  // people, which is why this used to be two stacked lines. Branching on the
  // ids and naming the pair once buys the second line back without the
  // run-on. `leadId` is nullable and `pmId` is not, so a null lead is never
  // equal and correctly falls through to "PM Jane · No lead".
  const oneHolder = app.pmId === app.leadId && app.pmName !== null
  // The same sentence the JSX below renders, minus the weight distinction —
  // it is the recovery tooltip for when two long names truncate. Keep the two
  // in step; a title that disagrees with the text under it is worse than none.
  const ownerLine = oneHolder
    ? `PM & Lead ${app.pmName}`
    : `${app.pmName ? `PM ${app.pmName}` : 'No PM'} · ${
        app.leadName ? `Lead ${app.leadName}` : 'No lead'
      }`

  return (
    <Link
      href={`/apps/${app.slug}`}
      // A whole-card link would otherwise announce every fragment on the card
      // — each tag, each avatar, "3d left" — as one run-on name. The full
      // detail stays readable in browse mode; this is the tab-through summary.
      //
      // Deliberately held byte-for-byte constant through the density work:
      // `openTasks` and `donePct` stay computed after they stopped being
      // printed as figures, because someone arrowing down a grid of twelve
      // links should not have to enter each card to find out which one has the
      // overdue work, and "0 overdue" has no visual form on this card by
      // design. Shrinking the card must never shrink what a link-list user
      // hears — if a future band goes, this string still does not.
      aria-label={
        `${app.name} — ${HEALTH_LABEL[app.health.level]}. ` +
        (mine ? `${MINE_LABEL[mine]}. ` : '') +
        `${openTasks} open, ${tasks.overdue} overdue, ${donePct}% done.`
      }
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article
        className={cn(
          'flex h-full flex-col gap-2.5 rounded-xl border-l-2 bg-card p-4 ring-1 ring-foreground/10',
          'transition-[transform,box-shadow] duration-150 ease-out',
          'group-hover:-translate-y-0.5 group-hover:ring-ring/40',
          'motion-reduce:transition-none motion-reduce:group-hover:translate-y-0',
          HEALTH_ACCENT[app.health.level],
          app.status === 'archived' && 'opacity-70',
        )}
      >
        {/* The name is the only thing on this card set in the heading face at
            full foreground contrast, and it is now the largest text on it. The
            first pass down a grid is "which app is this"; the old card
            answered that in text-base while shouting three unrelated figures
            at text-xl, so the eye landed on a number it had no question for
            yet. `title` is the name itself — the row is shared with the pill,
            so the name truncates sooner than it used to and a clipped name is
            the one string on the card worth a pointer to recover. */}
        <header className="flex min-h-6 items-center gap-2">
          {identityDot ? (
            <span
              aria-hidden
              className={cn('size-2 shrink-0 rounded-full', identityDot)}
            />
          ) : null}
          <h3
            title={app.name}
            className="min-w-0 flex-1 truncate font-heading text-base font-semibold tracking-tight"
          >
            {app.name}
          </h3>
          {/* Your relationship to the project, in WORDS. The dot beside the
              name is identity, not ownership — two apps you are on have two
              different hues — so the fact that one is yours has to be said
              rather than tinted (WCAG 1.4.1). */}
          {mine ? (
            <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 font-mono text-2xs font-medium text-primary">
              {MINE_LABEL[mine]}
            </span>
          ) : null}
          {/* Silent for `active`, and silent for archived because the health
              pill's own word for `dormant` is already "Archived" — printing it
              twice on one 24px row is the duplicated emphasis this card was
              rebuilt to remove. Paused is the case that survives: it changes
              how every figure below should be read and nothing else says it. */}
          {app.status !== 'active' && app.health.level !== 'dormant' ? (
            <span className="shrink-0 rounded-sm bg-muted px-1.5 font-mono text-2xs text-muted-foreground">
              {STATUS_LABEL[app.status]}
            </span>
          ) : null}
          {/* Full pill, unchanged. The old card had it competing with three
              bordered tag Badges per card; the tags are plain text now, so the
              pill is the only bordered shape left and reads as loud as it
              should without stripping its chrome on the on-track cards —
              which would have made the same component render two different
              silhouettes on two surfaces for a 0px saving. */}
          <HealthDot health={app.health} />
        </header>

        {/* URGENCY — the deadline you are running against and the work that
            already blew past one, on a single line because they answer one
            question and are the only two things on this card allowed to go
            text-destructive. Red scattered across three separate bands is what
            made a card in trouble scan the same as a merely busy one. All
            three sprint states render exactly one line, so "no sprint running"
            no longer collapses a three-line block and shifts every card beside
            it by 28px. */}
        <div className="flex min-h-4 items-center justify-between gap-2 text-2xs">
          {currentSprint && progress ? (
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-muted-foreground">{currentSprint.name}</span>
              <span
                className={cn(
                  'shrink-0 font-mono tabular-nums',
                  overrun || progress.remainingDays <= 2
                    ? 'font-medium text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {overrun
                  ? `${-progress.remainingDays}d over`
                  : `${progress.remainingDays}d left`}
              </span>
            </span>
          ) : nextSprint ? (
            <span className="min-w-0 truncate text-muted-foreground">
              Next sprint {nextSprint.name} starts{' '}
              <span className="font-mono tabular-nums">
                {format(parseCalendarDate(nextSprint.startDate), 'MMM d')}
              </span>
            </span>
          ) : (
            <span className="min-w-0 truncate text-muted-foreground">No sprint running</span>
          )}

          {/* Nothing at all when the count is zero. The old card printed
              "Overdue 0" at text-xl on every card, so the one figure on the
              grid that earns a colour was drowned by eleven copies of itself
              saying nothing — absence IS the zero here, and the link's
              aria-label still states it in words for a reader who cannot see
              an absence. The explicit {' '} is load-bearing: JSX drops a
              whitespace run that contains a newline, and without it the
              accessible name can flatten to "3overdue". */}
          {tasks.overdue > 0 ? (
            <span className="flex shrink-0 items-center gap-1 font-medium text-destructive">
              <TriangleAlert aria-hidden className="size-3.5" />
              <span className="font-mono tabular-nums">{tasks.overdue}</span>{' '}
              overdue
            </span>
          ) : null}
        </div>

        {/* Work done, with the sprint's time-elapsed drawn across it as a tick
            (see task-split-bar.tsx). The burn gap — the rule that scores an app
            at 25 points of daylight between time spent and work done — was
            previously two figures ~90px apart that the reader had to subtract;
            it is now the distance between the tick and the end of the done
            segment. That is why the sprint's own progress bar is gone rather
            than stacked here: a second bar 6px away would have had to be told
            apart from this one by fill alone, and every fill available for it
            sits within 0.06 lightness of --primary or --chart-1 in one theme or
            the other. */}
        <TaskSplitBar tasks={tasks} elapsedPct={progress ? progress.pct : null} />

        {/* Tech tags as plain text rather than Badges, and no lifetime
            sprint/meeting/comment counters. Three bordered pills per card put
            thirty-six pieces of chrome on the grid competing with the one pill
            that means something, and the Badge row was the card's biggest
            height variance — at three columns it silently became two rows and
            pushed +26px onto every card in that row. The counters were
            cumulative history, not state: nothing you do today changes because
            an app has held 17 meetings, and "is anything happening here" is
            answered by the activity stamp beside them, which keeps its visible
            "Active" label rather than hiding it in a tooltip. */}
        <div className="mt-auto flex min-h-4 items-baseline justify-between gap-2 text-2xs text-muted-foreground">
          <span className="min-w-0 truncate font-mono">
            {visibleTags.length > 0 ? (
              <>
                {/* Without this the row announces "react · postgres · redis
                    Active 3 days ago" and the first three words belong to
                    nothing. The stamp beside it names itself in visible text;
                    the tags cannot, because the visible label would cost the
                    width the tags are already short of. */}
                <span className="sr-only">Tech tags: </span>
                {visibleTags.join(' · ')}
                {extraTags > 0 ? ` +${extraTags}` : null}
              </>
            ) : null}
          </span>
          <span className="shrink-0 tabular-nums">
            {lastActivityAt
              ? `Active ${formatDistanceToNowStrict(lastActivityAt, { addSuffix: true })}`
              : 'No activity yet'}
          </span>
        </div>

        <div className="flex min-h-6 items-center justify-between gap-2 border-t border-border pt-2">
          {visibleMembers.length > 0 ? (
            <AvatarGroup className="*:data-[slot=avatar]:ring-card">
              {visibleMembers.map((member) => (
                <Avatar key={member.userId} size="sm" title={`${member.name} · ${member.role}`}>
                  {member.avatarUrl ? (
                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                  ) : null}
                  <AvatarFallback>{member.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  {member.userId === app.leadId ? (
                    <AvatarBadge title="Lead">
                      <span className="sr-only">Lead</span>
                    </AvatarBadge>
                  ) : null}
                </Avatar>
              ))}
              {extraMembers > 0 ? (
                <AvatarGroupCount className="font-mono text-xs ring-card group-has-data-[size=sm]/avatar-group:size-6">
                  +{extraMembers}
                </AvatarGroupCount>
              ) : null}
            </AvatarGroup>
          ) : (
            // truncate, not a bare span: at two columns this sits beside the
            // owner line and would otherwise wrap to a second row, making the
            // unassigned apps — the ones this branch exists to surface — the
            // tallest cards in their row.
            <span className="min-w-0 truncate text-2xs text-muted-foreground">
              Nobody assigned
            </span>
          )}
          {/* One line, but never by concatenation — see `oneHolder` above for
              why the equal-ids case gets its own branch. Where the two really
              are different people the role words stay muted and the names take
              foreground, so the eye separates them by weight rather than by
              counting separators. Do not re-flatten this into a single
              template string. */}
          <p title={ownerLine} className="min-w-0 truncate text-2xs text-muted-foreground">
            {oneHolder ? (
              <>
                PM &amp; Lead <span className="font-medium text-foreground">{app.pmName}</span>
              </>
            ) : (
              <>
                {app.pmName ? (
                  <>
                    PM <span className="font-medium text-foreground">{app.pmName}</span>
                  </>
                ) : (
                  'No PM'
                )}
                {' · '}
                {app.leadName ? (
                  <>
                    Lead <span className="font-medium text-foreground">{app.leadName}</span>
                  </>
                ) : (
                  'No lead'
                )}
              </>
            )}
          </p>
        </div>
      </article>
    </Link>
  )
}
