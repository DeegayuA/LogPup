/**
 * A sprint goal, in the shape somebody actually typed.
 *
 * The roadmap card rendered `goal` in a bare `<p>`, and HTML collapses
 * newlines — so a goal entered as
 *
 *     - Link LogPup with the attendance app
 *     - Multi-tenant system finished
 *     - Fix bugs in SLH attendance system
 *
 * came out as one run-on sentence with hyphens loose in the middle of it. The
 * structure was never missing from the database; it was discarded at render.
 * This module recovers it.
 *
 * Pure and free of React so the parsing is testable on its own — the card is
 * then only deciding which tag to draw.
 */

export type SprintGoal =
  | { kind: 'list'; items: string[] }
  | { kind: 'prose'; text: string }
  | { kind: 'empty' }

/**
 * Leading list markers in the forms people actually type: "- ", "* ", "• ",
 * and the numbered variants "1. " / "1) ".
 *
 * The trailing whitespace is REQUIRED, which is what stops a goal like
 * "-15% latency" or "Phase 2. Rollout" being mistaken for a bullet: a marker
 * is only a marker when something separates it from the text.
 */
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/

/**
 * Split a goal into lines and decide whether it is a list or prose.
 *
 * It counts as a list only when EVERY non-blank line carries a marker, and
 * only when there is more than one — a single "- ship it" is a sentence
 * somebody put a dash in front of, not a one-item list.
 *
 * A mixed block — a line of context followed by three bullets — stays prose
 * with its line breaks preserved. Promoting the opening line to a bullet would
 * assert a structure the author did not type, and this module exists precisely
 * because of the opposite mistake.
 */
export function parseSprintGoal(goal: string | null | undefined): SprintGoal {
  const lines = (goal ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return { kind: 'empty' }

  if (lines.length > 1 && lines.every((line) => BULLET.test(line))) {
    const items = lines
      .map((line) => line.replace(BULLET, '').trim())
      .filter((item) => item.length > 0)
    // A block of bare markers with no text behind them is not a list worth
    // drawing; fall through to prose so nothing renders as empty <li>s.
    if (items.length > 0) return { kind: 'list', items }
  }

  // Rejoined with blank lines dropped but the breaks kept, for
  // `whitespace-pre-line`. A single line comes back unchanged — the common
  // case, which must render exactly as it does today.
  return { kind: 'prose', text: lines.join('\n') }
}
