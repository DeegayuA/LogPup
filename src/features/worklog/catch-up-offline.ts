// `matchApp` is not imported directly: parseEntryLine already runs the whole
// alias ladder (stored alias, derived acronym, unique prefix, typo) for each
// item, so calling it again here would be a second opinion about the same
// sentence — and the two could disagree.
import type { AliasedApp } from '@/features/apps/app-aliases'
import { ABSENCE_KIND_PHRASES, type AbsenceKind } from '@/features/worklog/absence-kinds'
import { ENTRY_MINUTES_MAX, ENTRY_NOTE_MAX, validateEntry } from '@/features/worklog/entries'
import { parseEntryLine } from '@/features/worklog/entry-language'
import {
  MAX_ENTRIES_PER_DAY,
  type CatchUpCandidateDay,
  type CatchUpDay,
  type CatchUpEntry,
  type CatchUpReading,
} from '@/features/worklog/catch-up-parse'

/**
 * THE SAME PARAGRAPH, READ WITHOUT A MODEL.
 *
 * WHY THIS EXISTS. The catch-up reader is the fastest way to log a week and it
 * was reachable only with a working Gemini key. Everyone else — a workspace
 * that has not set one up, somebody on the free tier who has spent their quota,
 * anybody at all during an outage — met a box that said "Read my days" and did
 * nothing. A feature that is the fast path when it works and a dead end when it
 * does not is worse than no fast path, because people stop trying it.
 *
 * So the box reads the paste itself. Same input, same output shape
 * (`CatchUpReading`), same review panel, same fences — the person cannot tell
 * which reader ran except that this one is instant and free.
 *
 * WHAT IT DOES WELL, and it is most of the job: it resolves the dates people
 * write ("sep 3", "sep 1 and aug 30", "yesterday", "monday") against the days
 * actually in play, splits a day into its pieces, reads every duration spelling
 * entry-language.ts knows, and fuzzy-matches project names through the whole
 * app-aliases.ts ladder — stored alias, derived acronym, unique prefix, typo.
 * "ML model for SGX 2h" and "fixes in attendace app 4h" both land.
 *
 * WHAT THE MODEL STILL DOES BETTER, said plainly rather than pretended away:
 * prose that names no time and no date, sentences whose structure is unusual,
 * and Sinhala. This reader is deliberately literal — it would rather return
 * fewer entries and a longer note than guess at a sentence it did not parse,
 * because every item it cannot read stays visible in the note instead of
 * vanishing.
 *
 * PURE. No database, no clock, no model. Everything arrives as data, so the
 * whole thing is testable against the real paste that motivated it.
 *
 * IT NEVER INVENTS A DURATION OR A SCORE, which is the same promise the model
 * path makes and the same reason: hours are what an invoice is built from, and
 * the score is a judgement about somebody's own day.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
}

/**
 * One date somebody wrote, wherever it appears in the text.
 *
 * Every shape here is one people actually type. `2026-09-03` is included
 * because the gap chips insert a date and a person may paste one back.
 */
const DATE_TOKEN =
  /(\d{4}-\d{2}-\d{2})|(?:(\d{1,2})\s*(?:st|nd|rd|th)?\s+([a-z]{3,9})\b)|(?:([a-z]{3,9})\.?\s+(\d{1,2})(?:\s*(?:st|nd|rd|th))?\b)|\b(yesterday|today)\b|\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday)?\b/gi

type Marker = { start: number; end: number; iso: string }

/** The weekday of an ISO day, without a Date-object timezone trap. */
function weekdayOf(iso: string): number {
  // Midday UTC, the anchor this repo uses everywhere for day arithmetic: at
  // ±05:30 no other hour survives a step across a date boundary intact.
  return new Date(`${iso}T12:00:00Z`).getUTCDay()
}

/**
 * Turn one written date into an ISO day FROM THE CANDIDATE LIST, or null.
 *
 * THE LIST IS THE WHOLE VOCABULARY, exactly as it is for the model. "sep 3"
 * says nothing about the year, and resolving it by arithmetic is how work gets
 * filed twelve months out. Every branch below picks an existing candidate or
 * gives up, so a date this cannot place becomes an unresolved phrase the person
 * sees rather than a day nobody meant.
 *
 * NEWEST FIRST on ties: "monday" means the monday just gone, not one in March.
 */
function resolveDate(
  raw: RegExpExecArray,
  candidates: readonly CatchUpCandidateDay[],
  today: string,
): string | null {
  const days = [...candidates].sort((a, b) => (a.day < b.day ? 1 : -1))

  const [, iso, dayFirst, dayFirstMonth, monthFirst, monthFirstDay, relative, weekday] = raw

  if (iso) return days.some((d) => d.day === iso) ? iso : null

  if (relative) {
    const word = relative.toLowerCase()
    if (word === 'today') return days.some((d) => d.day === today) ? today : null
    // "yesterday" is the most recent candidate BEFORE today — not today minus
    // one, which on a Monday is a Sunday nobody owed work on and which may not
    // be in the list at all.
    return days.find((d) => d.day < today)?.day ?? null
  }

  if (weekday) {
    const target = WEEKDAYS[weekday.toLowerCase()]
    if (target === undefined) return null
    return days.find((d) => d.day <= today && weekdayOf(d.day) === target)?.day ?? null
  }

  const monthWord = (dayFirstMonth ?? monthFirst ?? '').toLowerCase().slice(0, 4)
  const month = MONTHS[monthWord] ?? MONTHS[monthWord.slice(0, 3)]
  const dayNumber = Number(dayFirst ?? monthFirstDay)
  if (!month || !Number.isFinite(dayNumber) || dayNumber < 1 || dayNumber > 31) return null

  const mm = String(month).padStart(2, '0')
  const dd = String(dayNumber).padStart(2, '0')
  return days.find((d) => d.day.slice(5) === `${mm}-${dd}`)?.day ?? null
}

/** Every date in the text, in the order written, with where it sat. */
function findMarkers(
  text: string,
  candidates: readonly CatchUpCandidateDay[],
  today: string,
): { markers: Marker[]; unresolved: string[] } {
  const markers: Marker[] = []
  const unresolved: string[] = []
  DATE_TOKEN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = DATE_TOKEN.exec(text)) !== null) {
    const iso = resolveDate(match, candidates, today)
    if (iso) markers.push({ start: match.index, end: match.index + match[0].length, iso })
    // A date-shaped phrase outside the window is REPORTED, never silently
    // dropped: "aug 12" when the window starts in September is somebody
    // logging further back than the box reaches, and they need telling.
    else if (match[1] || match[3] || match[4]) unresolved.push(match[0].trim())
  }

  return { markers, unresolved }
}

/**
 * Group markers that describe ONE segment of text.
 *
 * "sep 1 and aug 30 - pr merge" is two days sharing one description, and the
 * only thing separating those markers is a conjunction. Anything with real
 * words between them starts a new segment instead.
 */
const JOINER = /^[\s,/&-]*(?:and|to|until|through|&)?[\s,/&-]*$/i

type MarkerGroup = { isos: string[]; start: number; end: number }

function groupMarkers(markers: Marker[], text: string): MarkerGroup[] {
  const groups: MarkerGroup[] = []
  for (const marker of markers) {
    const previous = groups[groups.length - 1]
    if (previous && JOINER.test(text.slice(previous.end, marker.start))) {
      previous.isos.push(marker.iso)
      previous.end = marker.end
      continue
    }
    /* `start` is recorded HERE rather than looked up later. Finding the next
       group's start by searching the marker list for its first ISO breaks the
       moment a day is named twice — the search matches the EARLIER marker, so
       the first segment ends before it begins and that day's work disappears.
       "sep 3 - 2h morning, sep 3 - 3h afternoon" lost the morning. */
    groups.push({ isos: [marker.iso], start: marker.start, end: marker.end })
  }
  return groups
}

/**
 * Split one day's description into the things that happened.
 *
 * PAREN-AWARE, and that is not a detail: "attendance app fixes (chamari, multi
 * tenet) 4h" contains a comma inside brackets, and a plain `split(',')` turns
 * one four-hour entry into two fragments — the first with no duration and the
 * second reading "multi tenet) 4h". The names in the brackets are who somebody
 * worked with, so this case is the common one, not the edge.
 */
function splitItems(segment: string): string[] {
  const items: string[] = []
  let depth = 0
  let current = ''
  for (const char of segment) {
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1)
    if (depth === 0 && (char === ',' || char === ';' || char === '\n')) {
      items.push(current)
      current = ''
      continue
    }
    current += char
  }
  items.push(current)
  return items.map((item) => item.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '')).filter(Boolean)
}

/** Leave written in the day's own words, longest phrase first so "casual leave" beats "casual". */
function findAbsence(segment: string): AbsenceKind | null {
  const haystack = ` ${segment.toLowerCase()} `
  let best: { kind: AbsenceKind; length: number } | null = null
  for (const [kind, phrases] of Object.entries(ABSENCE_KIND_PHRASES)) {
    for (const phrase of phrases) {
      /* The word-boundary regex is the WHOLE test. A substring pre-check sat
         here and rejected every multi-word phrase before the regex ever ran:
         "short leave," is not " short leave " and is not "short leave " either,
         so `half day` and `short leave` — the two kinds most likely to be
         written mid-sentence — could never be found. */
      const boundary = new RegExp(
        `(?:^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z]|$)`,
        'i',
      )
      if (!boundary.test(haystack)) continue
      if (best && best.length >= phrase.length) continue
      best = { kind: kind as AbsenceKind, length: phrase.length }
    }
  }
  return best?.kind ?? null
}

export function readCatchUpTextOffline(input: {
  text: string
  today: string
  candidateDays: readonly CatchUpCandidateDay[]
  apps: readonly AliasedApp[]
}): CatchUpReading {
  const text = input.text.trim()
  if (!text) return { days: [], unresolved: [] }

  const { markers, unresolved } = findMarkers(text, input.candidateDays, input.today)
  const groups = groupMarkers(markers, text)

  /* NO DATE AT ALL is not a failure — it is somebody writing about today, or
     about the day they have open. The whole text becomes one segment against
     the most recent candidate, which is what a person means when they type
     without a date. */
  const segments: { isos: string[]; body: string }[] = []
  if (groups.length === 0) {
    const fallback = [...input.candidateDays].sort((a, b) => (a.day < b.day ? 1 : -1))[0]
    if (!fallback) return { days: [], unresolved }
    segments.push({ isos: [fallback.day], body: text })
  } else {
    groups.forEach((group, index) => {
      const stop = index + 1 < groups.length ? groups[index + 1].start : text.length
      segments.push({ isos: group.isos, body: text.slice(group.end, stop) })
    })
  }

  const byDay = new Map<string, CatchUpDay>()

  for (const segment of segments) {
    const absence = findAbsence(segment.body)
    const items = splitItems(segment.body)

    const entries: CatchUpEntry[] = []
    const noteParts: string[] = []
    let percent: number | null = null

    for (const item of items) {
      const parsed = parseEntryLine(item, { apps: input.apps })
      if (percent === null && parsed.percent !== null) percent = parsed.percent

      if (parsed.minutes === null) {
        // NO TIME WRITTEN, SO NO ENTRY. The words are kept as the day's note
        // rather than dropped — "pr merge and fixes" is a real description of a
        // day and inventing two hours for it would be a fiction with somebody's
        // name on it.
        if (parsed.note) noteParts.push(parsed.note)
        continue
      }

      if (entries.length >= MAX_ENTRIES_PER_DAY) {
        if (parsed.note) noteParts.push(parsed.note)
        continue
      }

      const candidate: CatchUpEntry = {
        minutes: parsed.minutes,
        // The offline reader never proposes a task entry, for the same reason
        // the model is not shown task ids: a paste spans days, and the
        // in-progress task list is a vocabulary about now.
        category: parsed.category === 'task' ? 'other' : parsed.category,
        appId: parsed.appId,
        note: parsed.note ? parsed.note.slice(0, ENTRY_NOTE_MAX) : null,
      }
      const total = entries.reduce((sum, entry) => sum + entry.minutes, 0)
      if (!validateEntry(candidate).ok || total + candidate.minutes > ENTRY_MINUTES_MAX) {
        if (parsed.note) noteParts.push(parsed.note)
        continue
      }
      entries.push(candidate)
    }

    const note = noteParts.join(', ').slice(0, ENTRY_NOTE_MAX) || null
    if (!note && entries.length === 0 && absence === null && percent === null) continue

    for (const iso of segment.isos) {
      // A day named twice MERGES rather than overwriting: "sep 3 … " early in
      // the paste and "also sep 3 …" later are one day's worth of work, and
      // keeping only one of them would silently lose hours.
      const existing = byDay.get(iso)
      if (!existing) {
        byDay.set(iso, {
          day: iso,
          note,
          percent,
          entries: [...entries],
          absence: absence ? { kind: absence, reason: null } : null,
        })
        continue
      }
      existing.entries.push(...entries.slice(0, MAX_ENTRIES_PER_DAY - existing.entries.length))
      existing.note = [existing.note, note].filter(Boolean).join(', ').slice(0, ENTRY_NOTE_MAX) || null
      existing.percent = existing.percent ?? percent
      existing.absence = existing.absence ?? (absence ? { kind: absence, reason: null } : null)
    }
  }

  const days = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1))
  return { days, unresolved }
}
