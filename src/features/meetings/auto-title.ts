import { LK_TIMEZONE } from '@/lib/lk-holidays'

/**
 * Suggested meeting title: the project it belongs to plus when it happens.
 *
 * Deliberately PURE and clock-free — the date is always injected — so the
 * output is reproducible and unit-testable, and so the form can regenerate a
 * title as the user changes the app or the start time without any clock skew
 * between render and submit.
 *
 * The shape is `<project> · <date> <time>` because that is the pair a person
 * scanning a meeting list actually needs: which product, and when. A running
 * number ("Vela #7") was the alternative; it was rejected because it needs a
 * count query per keystroke and two people scheduling at once would race for
 * the same number.
 *
 * Note for anyone touching series inference: `seriesKey()` strips dates, times
 * and ordinals, so every meeting auto-titled this way collapses to the same
 * series key for its app. That is the intended behaviour — a weekly Vela sync
 * titled by date should still be recognised as one series.
 */
export function autoMeetingTitle(input: {
  /** App display name. Empty or whitespace-only means "no app chosen yet". */
  appName: string | null | undefined
  startsAt: Date
  /** Injected so tests never depend on the machine's zone. */
  timeZone?: string
}): string {
  const app = input.appName?.trim()
  if (!app) return ''
  if (Number.isNaN(input.startsAt.getTime())) return app

  // Intl rather than a date library: `date-fns-tz` is not a dependency here,
  // and Intl is the only zone-correct formatter available without adding one.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: input.timeZone ?? LK_TIMEZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(input.startsAt)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''

  return `${app} · ${get('day')} ${get('month')} ${get('hour')}:${get('minute')}`
}

/**
 * True when `title` is one this module produced, and so may be replaced as the
 * user keeps editing the app or the start time.
 *
 * The form needs this because "has the user typed their own title?" cannot be
 * answered by a touched-flag alone: opening the edit dialog for an existing
 * meeting hydrates a title nobody touched in this session, and overwriting a
 * human's title would be worse than never suggesting one.
 */
export function isAutoMeetingTitle(title: string): boolean {
  return AUTO_TITLE_RE.test(title.trim())
}

/** `<anything> · <d MMM HH:mm>` — the separator is the distinguishing part. */
const AUTO_TITLE_RE = /\s·\s\d{1,2} [A-Z][a-z]{2} \d{2}:\d{2}$/
