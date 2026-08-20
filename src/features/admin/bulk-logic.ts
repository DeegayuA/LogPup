/**
 * Selection maths, CSV serialisation and partial-result summarising for the
 * admin batch bars. Pure and DOM-free on purpose: the tables that use it are
 * client components, but none of this needs a browser to be right, and the
 * honesty rules below (nothing succeeded ≠ everything succeeded) are the part
 * most worth pinning with a test.
 */

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * Selection is a plain array rather than a Set because it crosses a React
 * state boundary on every keystroke: a new array is a new identity, which is
 * what makes memoised children re-render when — and only when — it changes.
 */
export type Selection = readonly string[]

export function isSelected(selected: Selection, id: string): boolean {
  return selected.includes(id)
}

export function toggleSelected(selected: Selection, id: string): string[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
}

/**
 * Shift-click: everything between the anchor and the clicked row joins the
 * selection. Additive, never subtractive — a range drag that silently
 * deselected rows outside it would lose work the operator had already picked,
 * and there is no undo for a selection.
 *
 * An id missing from `ordered` (the list re-rendered between the two clicks)
 * degrades to selecting the clicked row alone rather than throwing.
 */
export function selectRange(
  selected: Selection,
  ordered: Selection,
  anchorId: string,
  targetId: string,
): string[] {
  const from = ordered.indexOf(anchorId)
  const to = ordered.indexOf(targetId)
  if (from === -1 || to === -1) return toggleSelected(selected, targetId)
  const [lo, hi] = from <= to ? [from, to] : [to, from]
  const range = ordered.slice(lo, hi + 1)
  const next = [...selected]
  for (const id of range) if (!next.includes(id)) next.push(id)
  return next
}

/**
 * The header checkbox acts on what is ON SCREEN, not on everything that
 * exists. If a filter is hiding rows, "select all" that reached them would be
 * a batch nobody could see before running it.
 */
export function toggleAllSelected(selected: Selection, visibleIds: Selection): string[] {
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id))
  if (allVisibleSelected) return selected.filter((id) => !visibleIds.includes(id))
  const next = [...selected]
  for (const id of visibleIds) if (!next.includes(id)) next.push(id)
  return next
}

export type HeaderState = 'none' | 'partial' | 'all'

export function headerSelectionState(selected: Selection, visibleIds: Selection): HeaderState {
  if (visibleIds.length === 0) return 'none'
  const hits = visibleIds.filter((id) => selected.includes(id)).length
  if (hits === 0) return 'none'
  return hits === visibleIds.length ? 'all' : 'partial'
}

/**
 * Drops ids that no longer exist. A bulk action revalidates the page, so rows
 * disappear under the selection (an app is deleted, someone is filtered out);
 * without this the count in the bar keeps claiming rows that are gone, and the
 * next action would be sent ids the server can only refuse.
 */
export function pruneSelection(selected: Selection, availableIds: Selection): string[] {
  return selected.filter((id) => availableIds.includes(id))
}

// ---------------------------------------------------------------------------
// Partial results
// ---------------------------------------------------------------------------

export type BulkOutcome =
  | { id: string; ok: true }
  | { id: string; ok: false; reason: string }

export type BulkSkip = { id: string; reason: string }

export type BulkReport = {
  attempted: number
  succeeded: string[]
  skipped: BulkSkip[]
}

export function summarizeOutcomes(outcomes: readonly BulkOutcome[]): BulkReport {
  const succeeded: string[] = []
  const skipped: BulkSkip[] = []
  for (const outcome of outcomes) {
    if (outcome.ok) succeeded.push(outcome.id)
    else skipped.push({ id: outcome.id, reason: outcome.reason })
  }
  return { attempted: outcomes.length, succeeded, skipped }
}

/**
 * Skips collapsed by reason, commonest first. Ten rows refused for the same
 * reason are one fact, not ten — but the ids stay attached so a caller can
 * still point at exactly which rows they were.
 */
export function groupSkipReasons(skipped: readonly BulkSkip[]): { reason: string; ids: string[] }[] {
  const byReason = new Map<string, string[]>()
  for (const skip of skipped) {
    const ids = byReason.get(skip.reason)
    if (ids) ids.push(skip.id)
    else byReason.set(skip.reason, [skip.id])
  }
  return [...byReason.entries()]
    .map(([reason, ids]) => ({ reason, ids }))
    .sort((a, b) => b.ids.length - a.ids.length || a.reason.localeCompare(b.reason))
}

export type BulkNouns = { one: string; many: string }

/**
 * The sentence a batch is allowed to say about itself.
 *
 * A bulk action that refused half its rows is the NORMAL case here — the
 * last-superadmin guard and the self-target guard both refuse silently at row
 * level — so "N archived" is only ever said when N is genuinely all of them.
 * Anything else names the skips in the same breath.
 */
export function describeBulkResult(
  report: BulkReport,
  doneVerb: string,
  nouns: BulkNouns,
): string {
  const noun = (count: number) => (count === 1 ? nouns.one : nouns.many)
  const done = report.succeeded.length
  const skipped = report.skipped.length
  if (done === 0) return `Nothing ${doneVerb} — ${skipped} ${noun(skipped)} skipped`
  if (skipped === 0) return `${done} ${noun(done)} ${doneVerb}`
  return `${done} ${noun(done)} ${doneVerb}, ${skipped} skipped`
}

/** Whether the batch's own toast should read as a success or a warning. */
export function bulkResultTone(report: BulkReport): 'success' | 'warning' | 'error' {
  if (report.succeeded.length === 0) return 'error'
  return report.skipped.length === 0 ? 'success' : 'warning'
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export type CsvValue = string | number | boolean | null | undefined

/**
 * RFC 4180 quoting, plus a formula guard.
 *
 * The guard is the non-obvious half: a spreadsheet treats a cell opening with
 * `= + - @` as a formula, so an org tag somebody typed as `=HYPERLINK(...)`
 * executes when this export is opened. Prefixing an apostrophe is the standard
 * defusing, and it only ever applies to STRING cells — a numeric -3 is a
 * number, not an attack, and must not grow a quote.
 */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

/** CRLF line endings, because that is what RFC 4180 says and Excel agrees. */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string {
  return [headers.map(csvCell), ...rows.map((row) => row.map(csvCell))]
    .map((cells) => cells.join(','))
    .join('\r\n')
}

/** `apps-2026-08-20.csv` — sortable, and no colons for Windows to reject. */
export function csvFilename(prefix: string, at: Date): string {
  const iso = at.toISOString().slice(0, 10)
  return `${prefix}-${iso}.csv`
}
