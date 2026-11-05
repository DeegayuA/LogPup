// Typed edges between work items (the work_links table). Pure: imported by
// the server actions AND the client panel, so nothing here may touch the db.
//
// One row stores ONE direction. "A blocks B" and "B is blocked by A" are the
// same row read from either end, which is why every label exists twice and
// why describeLink needs to know which end is doing the looking. Storing both
// directions instead would make every write two inserts — and neon-http has
// no interactive transaction to keep the pair together.

/** v1 offers these four; the CHECK also admits 'implements' and 'documents' for docs later. */
export const LINK_KINDS = ['blocks', 'relates', 'duplicates', 'fixes'] as const
export type LinkKind = (typeof LINK_KINDS)[number]

/** v1 ends. The CHECK also admits 'doc' and 'meeting'; their resolvers do not exist yet. */
export const LINK_END_TYPES = ['task', 'bug'] as const
export type LinkEndType = (typeof LINK_END_TYPES)[number]

export type LinkDirection = 'outgoing' | 'incoming'

export const LINK_KIND_LABEL: Record<LinkKind, Record<LinkDirection, string>> = {
  blocks: { outgoing: 'blocks', incoming: 'is blocked by' },
  // Symmetric: the row still has a direction, but nobody reading it cares.
  relates: { outgoing: 'relates to', incoming: 'relates to' },
  duplicates: { outgoing: 'duplicates', incoming: 'is duplicated by' },
  fixes: { outgoing: 'fixes', incoming: 'is fixed by' },
}

export function isLinkKind(value: unknown): value is LinkKind {
  return typeof value === 'string' && (LINK_KINDS as readonly string[]).includes(value)
}

export function isLinkEndType(value: unknown): value is LinkEndType {
  return typeof value === 'string' && (LINK_END_TYPES as readonly string[]).includes(value)
}

/**
 * What the "+ Add link" select offers, in display order. Both directions are
 * choices because "this task is blocked by LOG-12" is how people say it, and
 * making them go to LOG-12 to say "blocks" instead is the detour that stops
 * links being recorded at all. 'relates' appears once — its two labels match.
 */
export const LINK_CHOICES: readonly { value: string; kind: LinkKind; direction: LinkDirection; label: string }[] =
  LINK_KINDS.flatMap((kind) => {
    const out = { value: `${kind}:outgoing`, kind, direction: 'outgoing' as const, label: LINK_KIND_LABEL[kind].outgoing }
    if (kind === 'relates') return [out]
    return [out, { value: `${kind}:incoming`, kind, direction: 'incoming' as const, label: LINK_KIND_LABEL[kind].incoming }]
  })

/** Group order on the panel: the labels that change what can be worked on first. */
export const LINK_LABEL_ORDER: readonly string[] = LINK_CHOICES.map((c) => c.label)

export type LinkEnd = { type: string; id: string }
export type LinkRow = {
  id: string
  fromType: string
  fromId: string
  toType: string
  toId: string
  kind: string
}

export function sameEnd(a: LinkEnd, b: LinkEnd): boolean {
  return a.type === b.type && a.id === b.id
}

/**
 * A stored row as seen from `viewing`. Null when the row does not touch
 * `viewing`, or carries a kind/end type this version cannot render (a doc
 * link written by a later version must drop out, not crash the panel).
 */
export function describeLink(
  link: LinkRow,
  viewing: LinkEnd,
): { direction: LinkDirection; label: string; other: { type: LinkEndType; id: string } } | null {
  if (!isLinkKind(link.kind)) return null
  const from = { type: link.fromType, id: link.fromId }
  const to = { type: link.toType, id: link.toId }
  let direction: LinkDirection
  let other: LinkEnd
  if (sameEnd(from, viewing)) {
    direction = 'outgoing'
    other = to
  } else if (sameEnd(to, viewing)) {
    direction = 'incoming'
    other = from
  } else {
    return null
  }
  if (!isLinkEndType(other.type)) return null
  return { direction, label: LINK_KIND_LABEL[link.kind][direction], other: { type: other.type, id: other.id } }
}

/** The row to store for "`self` <choice> `other`". */
export function edgeFor(
  self: LinkEnd,
  other: LinkEnd,
  kind: LinkKind,
  direction: LinkDirection,
): Omit<LinkRow, 'id'> {
  const [from, to] = direction === 'outgoing' ? [self, other] : [other, self]
  return { fromType: from.type, fromId: from.id, toType: to.type, toId: to.id, kind }
}

/**
 * Why `candidate` must not be written, given the edges already between the
 * same two ends; null when it may. The unique index only catches the exact
 * row — it happily stores "A relates B" next to "B relates A", or "A blocks
 * B" next to "B blocks A", which are a repeat and a deadlock respectively.
 */
export function linkConflict(candidate: Omit<LinkRow, 'id'>, existing: readonly LinkRow[]): string | null {
  const from = { type: candidate.fromType, id: candidate.fromId }
  const to = { type: candidate.toType, id: candidate.toId }
  if (sameEnd(from, to)) return 'An item cannot be linked to itself'
  for (const row of existing) {
    if (row.kind !== candidate.kind) continue
    const rowFrom = { type: row.fromType, id: row.fromId }
    const rowTo = { type: row.toType, id: row.toId }
    if (sameEnd(rowFrom, from) && sameEnd(rowTo, to)) return 'Those are already linked'
    if (sameEnd(rowFrom, to) && sameEnd(rowTo, from)) {
      if (candidate.kind === 'relates') return 'Those are already linked'
      if (candidate.kind === 'blocks') return 'That item already blocks this one — two items cannot block each other'
      if (candidate.kind === 'duplicates') return 'Those are already marked as duplicates'
      // 'fixes' both ways is odd but not contradictory (a task and a bug can
      // each resolve part of the other), so it is left to the people involved.
    }
  }
  return null
}

/** Escape LIKE/ILIKE wildcards so a typed "50%" matches the text "50%", not everything. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/**
 * Tasks and bugs into one capped list: exact key hits first, then the two
 * kinds alternated. Concatenating instead would let a busy board's tasks push
 * every bug off a ten-row list.
 */
export function mergeTargets<T extends { type: LinkEndType; exact?: boolean }>(
  tasks: readonly T[],
  bugs: readonly T[],
  limit = 10,
): T[] {
  const exact = [...tasks, ...bugs].filter((t) => t.exact)
  const restTasks = tasks.filter((t) => !t.exact)
  const restBugs = bugs.filter((t) => !t.exact)
  const out = [...exact]
  for (let i = 0; out.length < limit && (i < restTasks.length || i < restBugs.length); i += 1) {
    if (i < restTasks.length) out.push(restTasks[i])
    if (out.length < limit && i < restBugs.length) out.push(restBugs[i])
  }
  return out.slice(0, limit)
}

/** Group resolved links by label, in LINK_LABEL_ORDER; empty groups are omitted. */
export function groupLinksByLabel<T extends { label: string }>(links: readonly T[]): { label: string; items: T[] }[] {
  return LINK_LABEL_ORDER
    .map((label) => ({ label, items: links.filter((l) => l.label === label) }))
    .filter((g) => g.items.length > 0)
}
