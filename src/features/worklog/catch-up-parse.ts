import {
  ABSENCE_KIND_LABELS,
  SELF_DECLARABLE_KINDS,
  type AbsenceKind,
} from '@/features/worklog/absence-kinds'
import {
  ENTRY_CATEGORIES,
  ENTRY_MINUTES_MAX,
  ENTRY_MINUTES_MIN,
  ENTRY_NOTE_MAX,
  validateEntry,
  type EntryCategory,
} from '@/features/worklog/entries'
import { grammarForPrompt } from '@/features/worklog/entry-language'
import { appPromptLine, type AliasedApp } from '@/features/apps/app-aliases'

/**
 * SEVERAL DAYS OF WORK, WRITTEN THE WAY PEOPLE ACTUALLY WRITE THEM.
 *
 * Somebody who has not logged for a week does not fill in five forms. They
 * write one paragraph:
 *
 *   sep 3 - attendance app fixes (chamari, multi tenet) 4h, ML model for SGX 2h,
 *   bug fixes in Solar app 2h, sep 2 - fixes in attendace app 4h, monthly
 *   meeting 2h, documenting 2h, sep 1 and aug 30 - pr merge and fixes and
 *   development of attedance app
 *
 * That one paragraph carries four days, eight pieces of work, three projects
 * under nicknames with two of them misspelled, a day-range written as "and",
 * and hours on some pieces and not others. `entry-language.ts` reads ONE line
 * against a regex vocabulary and cannot do any of it — which is why the
 * catch-up ledger asked people to pick a day chip and fill a form, five times
 * over, and why five days went unlogged in the first place.
 *
 * PURE. NO DATABASE, NO MODEL, NO CLOCK. This module builds the prompt and
 * judges the reply; `catch-up-actions.ts` does the calling and the person's own
 * hands do the writing. Every guarantee below is a line of code here rather
 * than a line of the prompt, so a test pins it:
 *
 *   - A DAY IT WAS NOT OFFERED IS DROPPED. The candidate days are listed in the
 *     prompt and checked again here, so no reply can file work against a future
 *     day, a day before somebody joined, or a day outside the window the caller
 *     loaded facts for.
 *   - A PROJECT IT WAS NOT SHOWN IS DROPPED. Ids only, checked against the list.
 *     Fuzzy matching is the whole point — "attendace app" must reach Attendance
 *     Web App — but the fuzziness is the model's and the id fence is ours, so a
 *     confident mismatch lands on nothing rather than on somebody else's project.
 *   - IT NEVER INVENTS A DURATION. Hours come back only where the text said
 *     them. "pr merge and fixes" with no number becomes the day's NOTE, not two
 *     invented hours — hours are what an invoice is built from.
 *   - IT NEVER INVENTS A SCORE. `percent` is a self-scored judgement about
 *     somebody's own day; the reader returns one only where the person's own
 *     words carried it, and the review step is where they say it themselves.
 *   - NOTHING IS SAVED HERE. There is deliberately no write path in this module
 *     and no "accept all" for a caller to reach for.
 */

/**
 * A project the reply may name, by id.
 *
 * `aliases` is what makes "ML model for SGX" reach Syntax Genie's project: the
 * model is shown every name a project answers to, derived acronyms included
 * (app-aliases.ts), and still has to answer with an id the fence recognises.
 */
export type CatchUpApp = AliasedApp

/** One day the reply may file against, with what the studio already knows about it. */
export type CatchUpCandidateDay = {
  day: string
  /** "Wed 3 Sep" — rendered by the caller, which owns the timezone. */
  label: string
  /** 1 for a full day, 0.5 for a half Saturday, 0 for a day nobody owed work on. */
  fraction: number
  /** Whether a score is already on file, so the reply can correct rather than duplicate. */
  logged: boolean
  /** A public holiday or a company closure, named. */
  closedFor?: string | null
}

/** One proposed hours row. Shaped for `createWorklogEntry`, minus the day. */
export type CatchUpEntry = {
  minutes: number
  category: EntryCategory
  appId: string | null
  note: string | null
}

/** One proposed leave filing. Shaped for `createAbsence`. */
export type CatchUpAbsence = {
  kind: AbsenceKind
  reason: string | null
}

/** Everything the reply says about one day. */
export type CatchUpDay = {
  day: string
  /** The day's note, in the person's own words. Null when the day is only hours. */
  note: string | null
  /**
   * A self-score the person's own words carried ("finished everything", "80%").
   * NULL IS THE COMMON CASE and the UI must ask rather than assume — see the
   * module comment.
   */
  percent: number | null
  entries: CatchUpEntry[]
  absence: CatchUpAbsence | null
}

export type CatchUpReading = {
  days: CatchUpDay[]
  /**
   * Things the reader heard and could not place — a project nickname that
   * matched nothing, a date it could not resolve.
   *
   * SHOWN, NEVER SWALLOWED. The single largest risk in reading somebody's own
   * paragraph back to them is that a piece of it quietly vanishes and they only
   * notice a month later, in a total they cannot explain.
   */
  unresolved: string[]
}

/**
 * How many days one paste may carry. A month of catching up is a real thing
 * that happens after long leave; a reply naming more than this has
 * misunderstood the text rather than found more days in it.
 */
export const MAX_CATCH_UP_DAYS = 31

/** Enough rows to describe a day honestly — the same ceiling the hours drafter uses. */
export const MAX_ENTRIES_PER_DAY = 12

/** A paste beyond this is a document, not a work log, and costs tokens to prove it. */
export const MAX_PASTE_CHARS = 4_000

/**
 * The categories the reply may choose from — EVERY ONE EXCEPT `task`.
 *
 * `task` requires a real task id (entries.ts enforces it, and the save path
 * derives the project from the task), and this reader is deliberately not shown
 * task ids: a paste spans many days, and the in-progress task list is a
 * vocabulary about now rather than evidence about last Tuesday. A row naming a
 * task would either be dropped by validateEntry or, worse, attach somebody's
 * hours to a task that was not what they meant. Work on a project is attributed
 * by `appId`, which is what the one-line parser does for the same sentence.
 */
export const CATCH_UP_CATEGORIES: readonly EntryCategory[] = ENTRY_CATEGORIES.filter(
  (category) => category !== 'task',
)

function dayLine(day: CatchUpCandidateDay): string {
  const shape =
    day.fraction === 0 ? 'not a working day' : day.fraction === 0.5 ? 'half day' : 'full day'
  const closed = day.closedFor ? `, closed for ${day.closedFor}` : ''
  const state = day.logged ? 'ALREADY SCORED — mention it only if the text corrects it' : 'not logged'
  return `- ${day.day} (${day.label}, ${shape}${closed}) — ${state}`
}

/**
 * The prompt behind "read what I wrote".
 *
 * THE CANDIDATE DAYS ARE THE WHOLE DATE VOCABULARY. "sep 3" is ambiguous about
 * the year, and about which September, in exactly the way that files a day of
 * work twelve months out. Rather than teach a model calendar arithmetic, it is
 * given the days that are actually in play — already resolved, already labelled
 * with their weekday — and told to pick from them. `readCatchUpReply` checks the
 * pick again, so a model that ignores the list changes nothing.
 */
export function buildCatchUpPrompt(input: {
  name: string
  /** Today, so relative words ("yesterday", "last Friday") have an anchor. */
  today: string
  /** Every day the reply may file against, oldest first. */
  candidateDays: readonly CatchUpCandidateDay[]
  /** Projects, by id. The reply may name these and nothing else. */
  apps: readonly CatchUpApp[]
  /** What the person actually wrote. */
  text: string
}): string {
  const days = input.candidateDays.map(dayLine).join('\n')
  // Every name a project answers to, not just the one it was registered under.
  // The line is built by app-aliases.ts so the model is shown exactly the
  // vocabulary the instant one-line parser matches on — two readers of the same
  // sentence disagreeing about which project it names is worse than either
  // being wrong on its own.
  const apps = input.apps.length > 0
    ? input.apps.map(appPromptLine).join('\n')
    : '(no projects on record — every entry must have appId null)'
  const leave = SELF_DECLARABLE_KINDS
    .map((kind) => `${kind} (${ABSENCE_KIND_LABELS[kind]})`)
    .join(', ')

  return `${input.name} has not logged for a while and has written out several days at once, from memory, in their own shorthand. Read it back into days. These are suggestions they will check and correct before anything is saved.

Today is ${input.today}.

WHAT THEY WROTE, verbatim between the markers:
<<<
${input.text}
>>>

The only days you may file against — pick from these by their exact ISO date:
${days}

The only projects you may name — use the id, never the name:
${apps}

Rules:
- FUZZY MATCH THE PROJECTS. They write nicknames, abbreviations and typos: "attendace app", "attendance app" and "the attendance one" are all the project whose name contains Attendance. Match on meaning, not on spelling. The "also called" terms above are as good as the name itself — an abbreviation like SGX or CC IS the project. A word that is the front of a project's name is that project too ("Solar app" is Solarsim). If a phrase matches NO project on the list, leave appId null and put the phrase in "unresolved" — never pick a different project because it was the closest one on the list, and never guess between two that fit equally.
- A DATE THEY WROTE ONCE CAN COVER SEVERAL DAYS. "sep 1 and aug 30" is two days; "sep 1 to sep 3" is three. Give each its own object. If the same work is described for several days, repeat it per day rather than dropping it on one.
- NEVER INVENT A DURATION. minutes goes in ONLY where they wrote a time. Work described with no time at all belongs in that day's "note" and in no entry. A day of five things where they timed two has two entries and a note.
- NEVER INVENT A SCORE. "percent" is their own judgement of how much of what they planned they got through. Return a number ONLY if their own words carry one ("80%", "finished everything", "barely got anything done"). Otherwise null — they will score it themselves.
- Every entry is {"minutes": whole minutes, "category": one of ${CATCH_UP_CATEGORIES.join(' | ')}, "appId": one of the ids above or null, "note": one short line or null}.
- LEAVE AND EXCUSES ARE NOT WORK. If they say a day was leave — ${leave} — put it in that day's "absence" and give that day no entries. "half_day" and "short_leave" mean they worked the rest of the day, so those days may ALSO carry entries and a note.
- Keep their own words in the notes. Do not rewrite their shorthand into corporate phrasing, do not add detail they did not write, and keep project, person and product names exactly as they wrote them.
- This is a Sri Lankan team that code-switches between Sinhala and English. Read both. Write notes in the language they used.
- Notes are at most ${ENTRY_NOTE_MAX} characters. At most ${MAX_ENTRIES_PER_DAY} entries per day, and never more than ${ENTRY_MINUTES_MAX} minutes in one day.
- Anything you heard and could not place — a name matching no project, a date you could not resolve — goes in "unresolved" as one short phrase each. Do not silently drop it.
- Choose the category the way this person's own typing is read elsewhere, so a pasted line and a typed one never come back as different kinds of the same work:
${grammarForPrompt()}

Respond as JSON, exactly this shape:
{"days": [{"day": "YYYY-MM-DD", "note": string | null, "percent": number | null, "absence": {"kind": string, "reason": string | null} | null, "entries": [{"minutes": number, "category": string, "appId": string | null, "note": string | null}]}], "unresolved": [string]}`
}

const SELF_DECLARABLE = new Set<string>(SELF_DECLARABLE_KINDS)

function readText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max).trim() : trimmed
}

/** Snap to the score control's own steps — nobody means the difference between 62% and 65%. */
function snapPercent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 0 || value > 100) return null
  return Math.round(value / 5) * 5
}

function readAbsence(raw: unknown): CatchUpAbsence | null {
  if (typeof raw !== 'object' || raw === null) return null
  const row = raw as Record<string, unknown>
  const kind = typeof row.kind === 'string' ? row.kind : null
  // The same fence the picker and the server action stand behind: a reply
  // naming 'no_work_assigned' would file somebody's grievance about the studio
  // as though they had chosen it about themselves.
  if (!kind || !SELF_DECLARABLE.has(kind)) return null
  return { kind: kind as AbsenceKind, reason: readText(row.reason, 500) }
}

function readEntries(raw: unknown, allowedAppIds: ReadonlySet<string>): CatchUpEntry[] {
  if (!Array.isArray(raw)) return []
  const out: CatchUpEntry[] = []
  let total = 0

  for (const item of raw) {
    if (out.length >= MAX_ENTRIES_PER_DAY) break
    if (typeof item !== 'object' || item === null) continue
    const row = item as Record<string, unknown>

    if (typeof row.minutes !== 'number' || !Number.isFinite(row.minutes)) continue
    // Round before validating: a model that answered 92.5 meant 93 minutes, and
    // validateEntry rejects a non-integer outright.
    const minutes = Math.round(row.minutes)
    if (minutes < ENTRY_MINUTES_MIN) continue

    const category = typeof row.category === 'string' ? row.category : ''
    // `task` is excluded from what the reader may choose (see
    // CATCH_UP_CATEGORIES) and dropped here rather than rewritten: a task row
    // without a task id would claim the same hours against nothing.
    if (!(CATCH_UP_CATEGORIES as readonly string[]).includes(category)) continue

    // THE ID FENCE. A hallucinated uuid would otherwise break the foreign key
    // at save time or, far worse, attribute somebody's hours to a real project
    // they never touched.
    const rawAppId = typeof row.appId === 'string' && row.appId !== '' ? row.appId : null
    const appId = rawAppId !== null && allowedAppIds.has(rawAppId) ? rawAppId : null

    const candidate: CatchUpEntry = {
      minutes,
      category: category as EntryCategory,
      appId,
      note: readText(row.note, ENTRY_NOTE_MAX),
    }
    if (!validateEntry(candidate).ok) continue
    // A day adding up to more than a day has been misread; the rows past the
    // ceiling are the ones to lose, not the ones before them.
    if (total + minutes > ENTRY_MINUTES_MAX) continue

    total += minutes
    out.push(candidate)
  }

  return out
}

/**
 * The reply, reduced to what is actually proposable.
 *
 * A BAD DAY IS DROPPED, NOT FATAL. Four sensible days and one malformed one
 * should still save somebody four days of typing, and each survivor is
 * individually valid so losing the fifth cannot corrupt the rest.
 *
 * A DAY WITH NOTHING IN IT IS DROPPED TOO. A day object carrying no note, no
 * entries, no score and no absence is the model acknowledging a date it found
 * nothing to say about, and rendering it would ask somebody to check an empty
 * card.
 */
export function readCatchUpReply(
  raw: string,
  fences: { allowedDays: ReadonlySet<string>; allowedAppIds: ReadonlySet<string> },
): CatchUpReading {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { days: [], unresolved: [] }
  }
  if (typeof parsed !== 'object' || parsed === null) return { days: [], unresolved: [] }
  const body = parsed as { days?: unknown; unresolved?: unknown }

  const days: CatchUpDay[] = []
  const seen = new Set<string>()

  if (Array.isArray(body.days)) {
    for (const item of body.days) {
      if (days.length >= MAX_CATCH_UP_DAYS) break
      if (typeof item !== 'object' || item === null) continue
      const row = item as Record<string, unknown>

      const day = typeof row.day === 'string' ? row.day : ''
      // THE DAY FENCE. Without it a misread "sep 3" files work against a day
      // twelve months out, or one before the person joined, or one the caller
      // loaded no facts for and therefore cannot render.
      if (!fences.allowedDays.has(day)) continue
      // One object per day. A reply that split a day in two would render as two
      // review cards writing over each other's score.
      if (seen.has(day)) continue

      const entries = readEntries(row.entries, fences.allowedAppIds)
      const absence = readAbsence(row.absence)
      const note = readText(row.note, ENTRY_NOTE_MAX)
      const percent = snapPercent(row.percent)

      if (!note && entries.length === 0 && absence === null && percent === null) continue

      seen.add(day)
      days.push({ day, note, percent, entries, absence })
    }
  }

  const unresolved: string[] = []
  if (Array.isArray(body.unresolved)) {
    for (const item of body.unresolved) {
      if (unresolved.length >= 10) break
      const phrase = readText(item, 120)
      if (phrase && !unresolved.includes(phrase)) unresolved.push(phrase)
    }
  }

  // Oldest first, whatever order the reply arrived in: somebody checking four
  // days reads them the way they lived them.
  days.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))

  return { days, unresolved }
}

/**
 * Month names in the spellings people actually type, plus the day words that
 * carry a date on their own. Used ONLY to decide which of the two readers the
 * box should offer — never to resolve a date, which is the model's job against
 * the candidate list.
 */
const DATE_WORDS =
  /(?:^|[^a-z])(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*\d{1,2}|(?:^|[^a-z])\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)|(?:^|[^a-z])(?:yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:[^a-z]|$)|\d{4}-\d{2}-\d{2}/gi

/**
 * Whether this text is somebody catching up on several days, or one line about
 * one day.
 *
 * IT DECIDES WHICH BUTTON LEADS, AND NOTHING ELSE. The one-line path is
 * instant, free and offline (`entry-language.ts`); the catch-up path costs a
 * model call. Sending "80% 2h fixed the feeder model" to a model would be
 * paying for a regex, and typing a week into a box that reads one line would
 * silently keep only the last thing written. Both readers stay reachable
 * whatever this returns — a person who disagrees just presses the other button.
 *
 * A DATE IS THE STRONGEST SIGNAL, because writing one is exactly what somebody
 * does when the day is not today. A line break is next: nobody breaks a line
 * mid-thought in a single-line field.
 */
export function looksLikeSeveralDays(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (trimmed.includes('\n')) return true
  const dates = trimmed.match(DATE_WORDS)
  if (dates && dates.length > 0) return true
  // No date and no break: only length says anything, and it has to say it
  // loudly. A long single sentence about today is still one day.
  return trimmed.length > 180
}

/** What one reading adds up to, for the review panel's summary line. */
export function summarizeReading(reading: CatchUpReading): {
  days: number
  minutes: number
  entries: number
  absences: number
  scored: number
} {
  let minutes = 0
  let entries = 0
  let absences = 0
  let scored = 0
  for (const day of reading.days) {
    for (const entry of day.entries) minutes += entry.minutes
    entries += day.entries.length
    if (day.absence) absences += 1
    if (day.percent !== null) scored += 1
  }
  return { days: reading.days.length, minutes, entries, absences, scored }
}
