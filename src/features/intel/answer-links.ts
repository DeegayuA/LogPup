// The answer text carries routes INLINE — "Pasindu Prabhashwara (110 percent)
// [/people/09844444-…]" — and they were rendering as literal bracketed UUIDs
// mid-sentence. A reader gets a wall of hex where a name should be, and the
// person the answer is about is one click away with no click available.
//
// parsePriority (prompt.ts) already solves the ONE-route-per-line case for
// briefing priorities. This is the other shape: many routes, mid-sentence,
// interleaved with prose. Same security posture, deliberately duplicated in
// spirit rather than shared in code, because the two differ in what they do
// with the text around the link.
//
// isInAppRoute IS THE POINT, not a detail. The answer is written by a model
// reading a grounding pack built from user-authored task titles, meeting
// titles and follow-up text, and this renders the result as real links. A
// planted title is enough to steer it, so a route that fails the allowlist
// renders as PLAIN TEXT with its brackets stripped — losing a link costs a
// click; honouring a hostile one costs the reader.

import { isInAppRoute } from '@/features/intel/prompt'
import type { AskCitation } from '@/features/intel/actions'

export type AnswerSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; label: string; href: string }

/** `[/anything-without-brackets-or-spaces]`, anywhere in the sentence. */
const INLINE_ROUTE = /\[([^\][\s]+)\]/g

/**
 * Split an answer into prose and links.
 *
 * The label comes from the citation list wherever one matches the href, which
 * is what turns `/people/09844444-…` into "Pasindu Prabhashwara". Without a
 * match it falls back to a readable path — NEVER the raw UUID, which is the
 * thing being fixed.
 */
export function splitAnswerLinks(
  answer: string,
  citations: readonly AskCitation[],
): AnswerSegment[] {
  const labelByHref = new Map(citations.map((c) => [c.href, c.label]))
  const segments: AnswerSegment[] = []
  let cursor = 0

  for (const match of answer.matchAll(INLINE_ROUTE)) {
    const [whole, href] = match
    const at = match.index ?? 0

    const before = answer.slice(cursor, at)
    cursor = at + whole.length

    if (!isInAppRoute(href)) {
      // Rejected: keep the words, drop the markup. The brackets were the
      // model's syntax, not the author's punctuation.
      pushText(segments, before + href)
      continue
    }

    pushText(segments, before)
    segments.push({ kind: 'link', label: labelByHref.get(href) ?? readableLabel(href), href })
  }

  pushText(segments, answer.slice(cursor))
  return segments.filter((s) => s.kind !== 'text' || s.text !== '')
}

/** Merge adjacent prose so the renderer never emits a run of empty spans. */
function pushText(segments: AnswerSegment[], text: string): void {
  if (text === '') return
  const last = segments[segments.length - 1]
  if (last?.kind === 'text') last.text += text
  else segments.push({ kind: 'text', text })
}

/**
 * A last-resort label for a route no citation claims. "/people/09844444-19a1-…"
 * becomes "View person" rather than the hex — a reader can act on the first and
 * cannot read the second.
 *
 * A bare section and a detail route need DIFFERENT words, which is what the two
 * maps are for: "/worklog" is "Work log", but "/people/<id>" is "View person"
 * and NOT "People", because the label stands where a name should be and a plural
 * section name reads as the wrong destination.
 */
const DETAIL_LABEL: Record<string, string> = {
  people: 'View person',
  apps: 'View project',
  meetings: 'View meeting',
  sprints: 'View sprint',
}

const SECTION_LABEL: Record<string, string> = {
  people: 'People',
  apps: 'Projects',
  meetings: 'Meetings',
  sprints: 'Sprints',
  worklog: 'Work log',
  progress: 'Progress',
  activity: 'Activity',
  settings: 'Settings',
}

function readableLabel(href: string): string {
  const path = href.split('?')[0].replace(/^\/+|\/+$/g, '')
  const [section, rest] = path.split('/')
  if (rest) return DETAIL_LABEL[section] ?? SECTION_LABEL[section] ?? titleCase(section)
  return SECTION_LABEL[section] ?? titleCase(section || 'link')
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
