/**
 * The short read on a person — two layers, same facts.
 *
 * The DERIVED summary is pure rules over the numbers the person page already
 * renders, so the card works for an account with AI switched off and no
 * Gemini key at all. The AI layer rewrites the same fact sheet into better
 * prose when it's available — it never sees raw rows, only the counts and
 * names below, which is both the token budget and the privacy line: the
 * model is told what the page already shows, nothing more.
 *
 * Mirrors the briefing split in src/features/intel: rules are the product,
 * prose is the assist.
 */

export type PersonSummaryFacts = {
  name: string
  /** Job title as entered, or null. */
  title: string | null
  /** Project names, leads first — the same order the page lists them. */
  apps: { name: string; isLead: boolean }[]
  /** Allocation total across assignments, in percent. */
  totalPct: number
  activeTaskCount: number
  doneTaskCount: number
  overdueTaskCount: number
  meetingsAttended: number
  meetingsWindowDays: number
  followupsOwed: number
  /** Age in days of the oldest open follow-up they owe, or null. */
  followupsOldestOwedDays: number | null
}

export type PersonSummary = {
  text: string
  source: 'ai' | 'derived'
  /** Which model wrote it — null exactly when source is 'derived'. */
  model: string | null
  generatedAtIso: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Prose from rules alone. Short, factual, and honest about quiet: a person
 * with nothing assigned reads as unassigned, not as a failure to summarise.
 */
export function derivePersonSummary(facts: PersonSummaryFacts): string {
  const sentences: string[] = []

  const leads = facts.apps.filter((a) => a.isLead).map((a) => a.name)
  const works = facts.apps.filter((a) => !a.isLead).map((a) => a.name)
  if (facts.apps.length === 0) {
    sentences.push(`${facts.name} has no project assignments right now.`)
  } else {
    const parts: string[] = []
    if (leads.length > 0) parts.push(`leads ${leads.join(', ')}`)
    if (works.length > 0) parts.push(`works on ${works.join(', ')}`)
    sentences.push(`${facts.name} ${parts.join(' and ')}, at ${facts.totalPct}% allocation.`)
  }

  if (facts.activeTaskCount > 0 || facts.doneTaskCount > 0) {
    const load = `${plural(facts.activeTaskCount, 'open task', 'open tasks')}, ${facts.doneTaskCount} done`
    sentences.push(
      facts.overdueTaskCount > 0
        ? `Carrying ${load} — ${plural(facts.overdueTaskCount, 'is overdue', 'are overdue')}.`
        : `Carrying ${load}.`,
    )
  }

  if (facts.followupsOwed > 0) {
    const age =
      facts.followupsOldestOwedDays !== null && facts.followupsOldestOwedDays > 0
        ? `, the oldest ${plural(facts.followupsOldestOwedDays, 'day', 'days')} old`
        : ''
    sentences.push(`Owes ${plural(facts.followupsOwed, 'follow-up', 'follow-ups')}${age}.`)
  }

  if (facts.meetingsAttended > 0) {
    sentences.push(
      `Attended ${plural(facts.meetingsAttended, 'meeting', 'meetings')} in the last ${facts.meetingsWindowDays} days.`,
    )
  }

  return sentences.join(' ')
}

/**
 * The prompt is the fact sheet plus rules of restraint. Every instruction
 * here exists to stop a specific failure: inventing history the sheet does
 * not contain, praising or judging (this page is read by the person's
 * colleagues), or restating every number when the job is the shape of them.
 */
export function buildPersonSummaryPrompt(facts: PersonSummaryFacts): string {
  const lines = [
    `Name: ${facts.name}`,
    facts.title ? `Title: ${facts.title}` : null,
    `Projects: ${
      facts.apps.length === 0
        ? 'none'
        : facts.apps.map((a) => (a.isLead ? `${a.name} (lead)` : a.name)).join('; ')
    }`,
    `Allocation: ${facts.totalPct}%`,
    `Tasks: ${facts.activeTaskCount} open, ${facts.doneTaskCount} done, ${facts.overdueTaskCount} overdue`,
    `Follow-ups owed: ${facts.followupsOwed}${
      facts.followupsOldestOwedDays !== null ? ` (oldest ${facts.followupsOldestOwedDays} days)` : ''
    }`,
    `Meetings attended, last ${facts.meetingsWindowDays} days: ${facts.meetingsAttended}`,
  ].filter((line): line is string => line !== null)

  return [
    'Write a two-to-three sentence summary of this person’s current work, for a colleague opening their profile.',
    'Use ONLY the facts below. Do not invent projects, history, opinions or personality.',
    'Neutral and factual — no praise, no judgement, no advice. Their teammates read this.',
    'Name the projects; summarise the numbers rather than reciting each one.',
    'Plain prose only: no headings, no lists, no markdown.',
    '',
    ...lines,
  ].join('\n')
}
