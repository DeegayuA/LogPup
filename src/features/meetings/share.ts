import {
  formatBusinessTime,
  formatBusinessWeekdayDayMonth,
} from '@/features/people/format-instant'

/**
 * The one invitation message, shared by every channel that carries it — the
 * WhatsApp prefill, the mailto: body and the copy button all read this, so an
 * attendee gets the same words whichever way it reaches them.
 *
 * Business timezone on purpose: the message is handed off to apps this
 * codebase does not render, so unlike the UI it can never be re-formatted for
 * the reader. Colombo time with the day spelled out is the one form every
 * recipient here reads correctly.
 */
export function buildMeetingShareMessage(meeting: {
  title: string
  startsAt: Date
  meetingUrl: string | null
}): string {
  const lines = [
    `You're invited: ${meeting.title}`,
    `${formatBusinessWeekdayDayMonth(meeting.startsAt)} · ${formatBusinessTime(meeting.startsAt)}`,
  ]
  if (meeting.meetingUrl) lines.push(`Join: ${meeting.meetingUrl}`)
  return lines.join('\n')
}

/**
 * mailto: for the whole invite list at once. Addresses go in `to` rather than
 * bcc — the recipients are a meeting's attendees, already visible to each
 * other on the invite, so hiding the list would be privacy theatre that also
 * breaks reply-all coordination.
 *
 * encodeURIComponent, not URLSearchParams: the latter encodes spaces as '+',
 * which mail clients render literally in subjects and bodies.
 */
export function mailtoHref(emails: string[], subject: string, body: string): string {
  return `mailto:${emails.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
