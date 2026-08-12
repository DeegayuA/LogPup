// Pure logic behind the meeting write-up's panelled view — see
// docs/superpowers/specs/2026-08-12-meeting-writeup-panels-design.md for the
// design this implements. No React, no DOM, no storage access: every
// persisted value (localStorage strings) is read by the caller and handed in
// here as a plain value, so this module stays a plain function library a test
// can call directly.

/** Which taxonomy a piece of write-up content belongs to — see the spec's
 *  "Colour + tag system" section for why this is a separate axis from
 *  ChipTone (state) and why carried-forward carries no separate kind hue. */
export type ContentKind = 'action' | 'question' | 'discussion' | 'term' | 'carried-forward'

export const CONTENT_KINDS: ContentKind[] = ['action', 'question', 'discussion', 'term', 'carried-forward']

/** Kinds a person filter actually applies to. Glossary terms belong to the
 *  meeting, not to any one attendee, so a "show only mine" filter must never
 *  hide them — see matchesFilters. */
const PERSON_SCOPED_KINDS = new Set<ContentKind>(['action', 'question', 'discussion', 'carried-forward'])

export type FilterableItem = {
  kind: ContentKind
  /** Free-text name(s) this item is attributed to (an owner, a speaker, a
   *  follow-up's person) — never an attendee id, because the model/notes
   *  only ever give us the name as written. Empty for content nobody owns
   *  (an unassigned action item, or any glossary term). */
  personNames: string[]
}

export type PersonFilterOption = { id: string; name: string }

export type ActiveFilters = {
  /** Attendee id to restrict to, or null for everyone. */
  personId: string | null
  /** Kinds to include, or null for every kind (no filter applied). Callers
   *  should never construct an empty non-null Set — see toggleKind, which
   *  canonicalizes "every kind selected" back to null. */
  kinds: Set<ContentKind> | null
}

export const NO_FILTERS: ActiveFilters = { personId: null, kinds: null }

export function hasActiveFilters(filters: ActiveFilters): boolean {
  return filters.personId !== null || filters.kinds !== null
}

export function clearFilters(): ActiveFilters {
  return { personId: null, kinds: null }
}

/** Lowercased, whitespace-collapsed — the same normalization
 *  meeting-notes-model.ts's `normalize` applies to owner text. */
export function normalizePersonName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Whether a free-text name the model wrote ("Nadeesha") plausibly names the
 * same person as a full attendee name ("Nadeesha Perera"). Mirrors
 * meeting-notes-model.ts's `sameOwner` exactly (exact match, or one is a
 * word-boundary-safe prefix of the other) reimplemented here rather than
 * imported, so this module never has to pull in anything from a file that
 * sits one hop from server actions.
 */
export function personNamesMatch(free: string, attendee: string): boolean {
  const a = normalizePersonName(free)
  const b = normalizePersonName(attendee)
  if (!a || !b) return false
  if (a === b) return true
  return a.startsWith(`${b} `) || b.startsWith(`${a} `)
}

function matchesPerson(
  item: FilterableItem,
  personId: string | null,
  people: PersonFilterOption[],
): boolean {
  if (!personId) return true
  if (!PERSON_SCOPED_KINDS.has(item.kind)) return true
  const attendee = people.find((p) => p.id === personId)
  // An unresolvable filter id (e.g. stale state after attendees changed)
  // matches everything rather than silently hiding every item.
  if (!attendee) return true
  return item.personNames.some((name) => personNamesMatch(name, attendee.name))
}

/** The combined filter predicate: kind first (cheap, no lookup), then
 *  person. Both must pass. */
export function matchesFilters(
  item: FilterableItem,
  filters: ActiveFilters,
  people: PersonFilterOption[],
): boolean {
  if (filters.kinds && !filters.kinds.has(item.kind)) return false
  return matchesPerson(item, filters.personId, people)
}

export function filterItems<T extends FilterableItem>(
  items: T[],
  filters: ActiveFilters,
  people: PersonFilterOption[],
): T[] {
  return items.filter((item) => matchesFilters(item, filters, people))
}

/**
 * Toggles one kind in/out of the active kind filter. `current === null`
 * means "every kind" (no filter), so the first toggle-off starts an explicit
 * set of every kind except the one just excluded. If a toggle brings every
 * kind back in, the result canonicalizes to `null` rather than an
 * indistinguishable-from-"all" Set — one representation of "no filter",
 * always.
 */
export function toggleKind(current: Set<ContentKind> | null, kind: ContentKind): Set<ContentKind> | null {
  const base = current ?? new Set(CONTENT_KINDS)
  const next = new Set(base)
  if (next.has(kind)) next.delete(kind)
  else next.add(kind)
  return next.size === CONTENT_KINDS.length ? null : next
}

/** Groups items by kind — the shape both the panel count badges and the
 *  kind-filter chip counts are built from. Every kind is present in the
 *  result, even with zero items, so a caller never has to guard a missing key. */
export function groupByKind<T extends FilterableItem>(items: T[]): Record<ContentKind, T[]> {
  const groups: Record<ContentKind, T[]> = {
    action: [],
    question: [],
    discussion: [],
    term: [],
    'carried-forward': [],
  }
  for (const item of items) groups[item.kind].push(item)
  return groups
}

export function countByKind<T extends FilterableItem>(items: T[]): Record<ContentKind, number> {
  const groups = groupByKind(items)
  return {
    action: groups.action.length,
    question: groups.question.length,
    discussion: groups.discussion.length,
    term: groups.term.length,
    'carried-forward': groups['carried-forward'].length,
  }
}

/* --- density -------------------------------------------------------- */

export type Density = 'comfortable' | 'compact'
export const DEFAULT_DENSITY: Density = 'comfortable'
export const DENSITY_STORAGE_KEY = 'logpup:writeup-density'

export function resolveDensity(stored: string | null): Density {
  return stored === 'compact' ? 'compact' : DEFAULT_DENSITY
}

/* --- per-panel persisted open/closed -------------------------------- */

export const PANEL_STORAGE_PREFIX = 'logpup:writeup-panel:'

/** '1'/'0' round-trip a boolean through localStorage; anything else (never
 *  stored, or a stale/garbage value) falls back to the panel's own default —
 *  never to a fixed global default, since panels intentionally disagree on
 *  whether they start open (see the spec's panel table). */
export function resolvePanelOpen(stored: string | null, defaultOpen: boolean): boolean {
  if (stored === '1') return true
  if (stored === '0') return false
  return defaultOpen
}

/* --- summary language ------------------------------------------------- */

export type SummaryLanguage = 'en' | 'si' | 'both'
/** English by default: the one choice that actually halves the length on
 *  first load, per the spec's "Bilingual summary control" section. */
export const DEFAULT_SUMMARY_LANGUAGE: SummaryLanguage = 'en'
export const SUMMARY_LANGUAGE_STORAGE_KEY = 'logpup:summary-language'

export function resolveSummaryLanguage(stored: string | null): SummaryLanguage {
  if (stored === 'en' || stored === 'si' || stored === 'both') return stored
  return DEFAULT_SUMMARY_LANGUAGE
}

/* --- bilingual summary splitting --------------------------------------- */

// U+0D80–U+0DFF is the full Sinhala Unicode block. Written as an explicit
// \u escape range (rather than literal characters) so the intent survives
// regardless of how this file's encoding gets handled downstream.
const SINHALA_CHAR = new RegExp('[\\u0D80-\\u0DFF]', 'g')
const LATIN_CHAR = /[A-Za-z]/g

function isSinhalaBlock(text: string): boolean {
  const sinhalaCount = (text.match(SINHALA_CHAR) ?? []).length
  if (sinhalaCount === 0) return false
  const latinCount = (text.match(LATIN_CHAR) ?? []).length
  return sinhalaCount > latinCount
}

/**
 * Splits the model's one Markdown summary string into an English bucket and
 * a Sinhala bucket by classifying each blank-line-delimited block by script
 * dominance — see the spec for why marker-matching (a fixed heading string)
 * isn't reliable here: the prompt gives the model no fixed marker to split
 * on. A block with more Sinhala-script than Latin characters is Sinhala;
 * everything else (including genuinely mixed, Latin-majority code-switched
 * lines) is English. Either bucket may come back empty — the caller decides
 * what an empty bucket means (typically: hide that language's toggle option).
 */
export function splitBilingualSummary(markdown: string | null | undefined): { en: string; si: string } {
  if (!markdown || !markdown.trim()) return { en: '', si: '' }
  const blocks = markdown.split(/\n{2,}/)
  const en: string[] = []
  const si: string[] = []
  for (const block of blocks) {
    if (!block.trim()) continue
    ;(isSinhalaBlock(block) ? si : en).push(block)
  }
  return { en: en.join('\n\n'), si: si.join('\n\n') }
}
