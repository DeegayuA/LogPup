'use client'

/**
 * "When are we doing this again?" — the last thing said in most meetings, and
 * until now the one thing the write-up did not record.
 *
 * It earns the top of the write-up because it is the only field on this page
 * whose value changes other rows: an action item agreed here is, from the
 * moment this date exists, due by the next meeting unless somebody says
 * otherwise (notes.ts, MeetingTaskContext.defaultDueDate). Without it every
 * commitment a meeting produces is born with "No due date", which is what a
 * ten-item write-up looked like before.
 *
 * TWO THINGS THIS IS NOT, both of which the copy has to keep saying out loud:
 *
 *  - NOT a scheduled meeting. `meetings.next_meeting_at` references nothing and
 *    creates nothing; the meeting it names usually does not exist yet. Nobody
 *    is invited and nothing is in a calendar. "Schedule it" is the separate,
 *    deliberate act that changes that, and it opens the ordinary meeting form
 *    rather than saving anything itself.
 *  - NOT "the next meeting each person attends". `moveFollowupsToNextMeeting`
 *    already answers that, per person, from real attendee rows, and the
 *    follow-up panels below say so in those words. The two are allowed to
 *    disagree — a room can agree Thursday while one member's next meeting with
 *    the group is a fortnight out — so the body states the distinction rather
 *    than letting a reader assume one date governs both.
 */
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CalendarClock, CalendarPlus, Loader2, PencilIcon, Sparkles, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateTimeWheelField, roundUpToStep } from '@/components/ui/datetime-wheel'
import {
  setMeetingNextMeeting,
  suggestNextMeeting,
  type NextMeetingSuggestion,
} from '@/features/meetings/ai-actions'
import { describeNextMeeting } from '@/features/meetings/next-meeting'
import { bilingualText, MetaChip } from '@/features/meetings/components/meeting-chips'
import { cn } from '@/lib/utils'
import { MeetingForm, type MeetingPrefill } from '@/features/meetings/components/meeting-form'
import type { ActiveUser } from '@/features/people/queries'
import { Panel } from '@/features/meetings/components/meeting-panels'

export function NextMeetingPanel({
  meetingId,
  nextMeetingAt,
  now,
  canManage,
  undatedCount,
  hasRecord,
  prefill,
  apps,
  activeUsers,
  onSaved,
}: {
  meetingId: string
  /** `meetings.next_meeting_at`, or null when the room never named one. */
  nextMeetingAt: Date | null
  /** The single `now` this whole write-up renders against, so this panel and
   *  the due-date chips below can never disagree about what "today" is. */
  now: Date
  /** canManageMeeting: admin, the meeting's creator, or a PM of its projects.
   *  Strictly narrower than who may READ this page, so the rest of the room
   *  gets the fact and no controls. */
  canManage: boolean
  /**
   * How many action items on this page have no date of their own — exactly the
   * rows this date governs. Drives the consequence sentence, which is the
   * difference between showing a date and explaining a decision.
   */
  undatedCount: number
  /**
   * Whether this meeting has a transcript or write-up to read a date out of.
   * Without one the "read it from the meeting" button would be an offer that
   * can only fail, so it is not rendered at all.
   */
  hasRecord: boolean
  /** Starting values for the real meeting, if somebody schedules it. */
  prefill: MeetingPrefill
  apps: { id: string; name: string }[]
  activeUsers: ActiveUser[]
  /** Re-read the intel: every due-date chip below changes when this saves. */
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<Date>(nextMeetingAt ?? roundUpToStep(now))
  const [saving, startSaving] = useTransition()
  const [scheduling, setScheduling] = useState(false)
  const [suggesting, startSuggesting] = useTransition()
  /** null = never asked. A result with `at: null` is an ANSWER ("nothing was
   *  agreed") and has to be distinguishable from not having asked. */
  const [suggestion, setSuggestion] = useState<NextMeetingSuggestion | null>(null)

  const described = nextMeetingAt ? describeNextMeeting(nextMeetingAt, now) : null
  const suggested = suggestion?.at ? describeNextMeeting(new Date(suggestion.at), now) : null

  function askForSuggestion() {
    startSuggesting(async () => {
      const result = await suggestNextMeeting(meetingId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSuggestion(result.data)
    })
  }

  function save(value: Date | null) {
    startSaving(async () => {
      const result = await setMeetingNextMeeting(meetingId, value ? value.toISOString() : null)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setEditing(false)
      // Name the RESULT, not the verb. The point of saving this is what it does
      // to every row below it, and a bare "Saved" would hide exactly that.
      toast.success(
        value
          ? 'Next meeting set — new action items from this meeting default to that date'
          : 'Next meeting cleared — new action items go back to having no deadline',
      )
      onSaved()
    })
  }

  function openEditor() {
    setPending(nextMeetingAt ?? roundUpToStep(now))
    setEditing(true)
  }

  return (
    <Panel
      id="next-meeting"
      title="Next meeting"
      icon={CalendarClock}
      headerExtra={
        described ? (
          // Repeated in the header so collapsing the panel cannot hide the one
          // fact it exists to carry.
          <MetaChip tone={described.past ? 'warning' : 'neutral'}>
            <span className="font-mono tabular-nums">{described.day}</span>
          </MetaChip>
        ) : canManage ? (
          <Button size="sm" variant="outline" type="button" onClick={openEditor}>
            Set a date
          </Button>
        ) : null
      }
    >
      {described ? (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <span className="font-mono text-base tabular-nums text-foreground">
            {described.day} · {described.time}
          </span>
          <span className="text-muted-foreground">{described.relative}</span>
          {described.past ? <MetaChip tone="warning">That date has passed</MetaChip> : null}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Nobody said when this group meets again.</p>
      )}

      {/* The consequence, always — the sentence that makes this field worth
          filling in, and it has to be true at zero as well as at ten. */}
      <p className="text-sm text-muted-foreground">
        {!described ? (
          <>Until somebody sets one, every action item from this meeting starts with no deadline.</>
        ) : undatedCount > 0 ? (
          <>
            {undatedCount} action {undatedCount === 1 ? 'item' : 'items'} from this meeting{' '}
            {undatedCount === 1 ? 'has' : 'have'} no date of{' '}
            {undatedCount === 1 ? 'its' : 'their'} own, so {undatedCount === 1 ? 'it is' : 'they are'}{' '}
            due by this one. Change any of them and the change sticks.
          </>
        ) : (
          <>New action items from this meeting are due by this date unless somebody sets another.</>
        )}
      </p>

      {editing ? (
        <div className="flex flex-wrap items-end gap-2">
          <DateTimeWheelField
            id={`next-meeting-${meetingId}`}
            label="Next meeting"
            value={pending}
            onChange={setPending}
            className="w-64"
          />
          <Button type="button" size="sm" disabled={saving} onClick={() => save(pending)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      ) : canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          {described ? (
            <>
              <Button size="sm" variant="outline" type="button" onClick={openEditor}>
                <PencilIcon aria-hidden />
                Change
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                disabled={saving}
                onClick={() => save(null)}
              >
                <XIcon aria-hidden />
                Clear
              </Button>
              <Button
                size="sm"
                variant="secondary"
                type="button"
                onClick={() => setScheduling(true)}
              >
                <CalendarPlus aria-hidden />
                Schedule it
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" type="button" onClick={openEditor}>
                Set a date
              </Button>
              {hasRecord ? (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={suggesting}
                  onClick={askForSuggestion}
                >
                  {suggesting ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                  {suggesting ? 'Reading the record…' : 'Read it from the meeting'}
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          The meeting&rsquo;s organiser or an admin sets this.
        </p>
      )}

      {/* WHAT THE MODEL FOUND — offered, never applied. "Use this" opens the
          editor seeded with the date rather than saving it, so the value that
          lands in the database is always one a person looked at and confirmed.
          The quote is what makes that judgeable: "same day or Monday" is
          visibly a choice somebody made, not a fact the transcript stated. */}
      {suggestion && !described ? (
        suggested ? (
          <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <Sparkles className="size-3.5 shrink-0 self-center text-primary" aria-hidden />
              <span className="font-mono tabular-nums text-foreground">
                {suggested.day} · {suggested.time}
              </span>
              <span className="text-muted-foreground">{suggested.relative}</span>
            </p>
            {suggestion.heardAs ? (
              <p className={cn(bilingualText, 'text-muted-foreground')}>
                Heard as &ldquo;{suggestion.heardAs}&rdquo;
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                type="button"
                onClick={() => {
                  setPending(new Date(suggestion.at as string))
                  setEditing(true)
                  setSuggestion(null)
                }}
              >
                Use this
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setSuggestion(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : (
          // An answer, not a failure — and by far the commonest one. Said
          // plainly so nobody presses the button twice expecting more.
          <p className="text-sm text-muted-foreground">
            Nothing in the record says when you meet again. Set the date by hand.
          </p>
        )
      ) : null}

      {/* Two boundaries a reader would otherwise draw wrongly, stated where the
          date is rather than in a help page — this is where the assumption
          forms. */}
      <p className="text-xs text-muted-foreground">
        {described
          ? 'This is what the room agreed — nothing is in anyone’s calendar until you schedule it. '
          : ''}
        Follow-ups that stay open still travel to whichever meeting each person is next on, which
        can be a different day.
      </p>

      {/* Mounted only once somebody asks to schedule, and prefilled from this
          meeting — same people, same projects, the open items as the agenda. It
          saves nothing by itself: the ordinary meeting form is what creates the
          meeting and sends the invitations. */}
      {scheduling ? (
        <MeetingForm
          key={nextMeetingAt?.toISOString() ?? 'unset'}
          apps={apps}
          activeUsers={activeUsers}
          defaultStart={nextMeetingAt ?? roundUpToStep(now)}
          prefill={prefill}
          defaultOpen
          onOpenChange={(open) => {
            if (!open) setScheduling(false)
          }}
          trigger={<span className="hidden" />}
        />
      ) : null}
    </Panel>
  )
}
