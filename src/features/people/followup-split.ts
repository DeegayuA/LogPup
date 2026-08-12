import { isoDayDiff, isoDayOf } from '@/features/people/iso-day'

/**
 * Splits a person's open meeting follow-ups into the two directions that
 * actually matter to a reader: what THEY owe, and what they are waiting on from
 * someone else.
 *
 * Why this is on the person page at all: every open question or action item the
 * meeting AI attributes to someone already carries a userId, its source meeting
 * and how long it has been open — and until now it was only visible inside one
 * meeting's Intelligence panel. So the product knew "Nuwan still owes an answer
 * from the March 3rd standup" and had no surface that could say it. This is the
 * "what do they owe" half of the page's whole question.
 *
 * TWO RULES WORTH STATING, because both were bugs in the obvious version:
 *
 *  - a self-raised item (createdBy === userId AND userId === the same person)
 *    is DEBT, not something they are waiting on. It appears in `owed` only.
 *    The naive two-filter version listed it in both columns, so a person who
 *    wrote down their own action item read as both owing and being owed it.
 *  - an item with no assignee (userId null — the AI could not match the spoken
 *    name to exactly one attendee, see matchPersonToAttendee) is never anyone's
 *    debt. It can still appear in `awaiting` for the person who raised it,
 *    labelled with the raw spoken name, because "you asked for this and nobody
 *    is on the hook" is exactly what they need to see.
 *
 * Age is measured from the SOURCE MEETING, not from `createdAt`: the row is
 * written when the recording is analysed, which can be days later, and "open
 * since the meeting it came from" is the sentence a reader is actually trying
 * to build. Days are resolved in the business timezone (see iso-day.ts).
 */

export type FollowupKind = 'question' | 'action'

export type PersonFollowupRow = {
  id: string
  text: string
  kind: FollowupKind
  /** Resolved attendee, or null when the spoken name matched nobody. */
  ownerUserId: string | null
  /** Resolved user's name when there is one, else the raw as-spoken name. */
  ownerName: string
  /** Who typed it in by hand; null for the AI-derived rows. */
  createdById: string | null
  createdByName: string | null
  meetingId: string
  meetingTitle: string
  meetingStartsAt: Date
  /** What they've SAID about it while it is still open. */
  responseNote: string | null
  /** Why it isn't done yet. */
  deferReason: string | null
}

export type PersonFollowupItem = PersonFollowupRow & {
  /** Whole days since the meeting it came from; never negative. */
  ageDays: number
}

export type PersonFollowups = {
  /** Open items this person is on the hook for, oldest debt first. */
  owed: PersonFollowupItem[]
  /** Open items they raised that someone else owes, oldest first. */
  awaiting: PersonFollowupItem[]
  /** Age of the oldest owed item, or null when they owe nothing. */
  oldestOwedDays: number | null
}

/**
 * When an open follow-up stops being "recent" and starts being a problem.
 *
 * It lives HERE rather than in the card that draws the red text because the
 * stat strip has to agree with it. The first version put the threshold in
 * person-followups-card.tsx and gave the "Owes" tile an alert tone the moment
 * the count went above zero — so a follow-up raised in this morning's standup
 * lit the tile red while the row underneath it rendered in calm grey. Two
 * definitions of "urgent" on one screen is exactly what the stat row was built
 * to prevent, so there is now one, and it is exported.
 */
export const FOLLOWUP_STALE_DAYS = 14

function withAge(row: PersonFollowupRow, todayIso: string): PersonFollowupItem {
  // A meeting scheduled in the future can carry a manually-added follow-up, so
  // clamp at 0 rather than rendering "open for -3 days".
  return { ...row, ageDays: Math.max(0, isoDayDiff(todayIso, isoDayOf(row.meetingStartsAt))) }
}

function oldestFirst(a: PersonFollowupItem, b: PersonFollowupItem): number {
  const byAge = b.ageDays - a.ageDays
  return byAge !== 0 ? byAge : a.id.localeCompare(b.id)
}

export function splitPersonFollowups(
  rows: PersonFollowupRow[],
  userId: string,
  todayIso: string,
): PersonFollowups {
  const items = rows.map((row) => withAge(row, todayIso))
  const owed = items.filter((item) => item.ownerUserId === userId).sort(oldestFirst)
  return {
    owed,
    awaiting: items
      .filter((item) => item.createdById === userId && item.ownerUserId !== userId)
      .sort(oldestFirst),
    // `owed` is already sorted oldest-first, so the head IS the worst offender.
    // Reading it off the sorted list rather than recomputing a max keeps the
    // summary and the first rendered row provably the same item.
    oldestOwedDays: owed[0]?.ageDays ?? null,
  }
}
