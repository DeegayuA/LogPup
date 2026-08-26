import { formatHours } from '@/features/worklog/entries'
import { truncateAtWordBoundary } from '@/lib/prompt-truncate'

/**
 * A logged day, said in one line.
 *
 * WHY THIS EXISTS. The day panel puts one field in front — type a sentence,
 * done — and keeps the eleven-control stack behind a disclosure so the fast
 * path is what a person meets. But the disclosure opened itself the moment a
 * day had ANY content, which is every day you ever come back to. Returning to
 * yesterday meant meeting a slider, four preset pills, a chip row, a textarea,
 * a duration box and two selects, none of which you came for.
 *
 * Collapsing it unconditionally is not the fix either: a person looking at a
 * day they already logged has to see WHAT they logged, or the page reads as
 * though the save never happened. So the disclosure's own label carries the
 * facts — score, hours, and the first real line of the note — and the controls
 * stay folded until somebody actually wants to correct something.
 */

/** How much of the note the summary line carries before cutting. */
export const SNIPPET_CHARS = 90

export type DayGlance = {
  /** The self-score, or null when the day has not been scored. */
  percent: number | null
  /**
   * Hours as a bare phrase — "6" or "6 of 8". No unit: the caller appends "h"
   * so a figure and its denominator read as one phrase, the same rule
   * formatHours itself follows.
   */
  hours: string | null
  entryCount: number
  /** The first line of the note with something in it, cut safely. */
  snippet: string | null
  /** Nothing has been recorded for this day at all. */
  empty: boolean
}

/**
 * The first line of a note that says something.
 *
 * Tagging a project writes a bare `[Project]` marker, and "tag every unfilled
 * project" writes several on lines of their own. Those lines are real note
 * content but they are not what the day was ABOUT, so a summary that led with
 * one would show "[Unilever Project]" as the description of somebody's
 * Tuesday. Prefer the first line with prose in it; fall back to the first line
 * at all, because a note of nothing but tags still beats showing nothing.
 */
function firstMeaningfulLine(note: string): string | null {
  const lines = note
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return null
  const withProse = lines.find((line) => line.replace(/\[[^\]]*\]/g, '').trim().length > 0)
  return withProse ?? lines[0]
}

export function glanceAtDay(input: {
  percent: number | null
  note: string | null
  /** Total minutes actually logged against this day. */
  loggedMinutes: number
  /** The day's scheduled minutes, when the person has a schedule. */
  scheduledMinutes: number | null
  entryCount: number
}): DayGlance {
  const { percent, note, loggedMinutes, scheduledMinutes, entryCount } = input

  const line = note ? firstMeaningfulLine(note) : null
  // truncateAtWordBoundary lives under a prompt-shaped name because prompts
  // were its first caller, but the thing it actually knows is where a Sinhala
  // grapheme cluster may be cut. A raw slice here would stranded a bare
  // consonant in the summary of any Sinhala note — the same bug, one layer up.
  const snippet = line ? truncateAtWordBoundary(line, SNIPPET_CHARS) : null

  const hours =
    loggedMinutes > 0
      ? scheduledMinutes && scheduledMinutes > 0
        ? `${formatHours(loggedMinutes)} of ${formatHours(scheduledMinutes)}`
        : formatHours(loggedMinutes)
      : null

  return {
    percent,
    hours,
    entryCount,
    snippet,
    // Scheduled hours are NOT content: a schedule is something the workspace
    // set, not something this person recorded, and a day nobody has touched
    // must still read as untouched.
    empty: percent === null && snippet === null && entryCount === 0,
  }
}
