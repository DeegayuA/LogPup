/**
 * The `(createdAt, id)` keyset cursor codec, shared by any newest-first list
 * that pages.
 *
 * `${iso}|${uuid}` — an ISO timestamp contains no `|`, so the first one splits
 * it unambiguously. Malformed input returns null rather than throwing: a
 * hand-edited or truncated URL must degrade to page one, never to a crash
 * screen.
 *
 * BOTH halves are validated, and the id half as a UUID rather than merely as
 * "non-empty". These ids are Postgres `uuid` columns, so a cursor id of
 * "garbage" is not a comparison that returns no rows — it is error 22P02
 * raised at bind time, thrown out of the page's Promise.all and rendered as
 * the framework's crash screen. Validating here is what keeps that promise.
 *
 * src/features/activity/filters.ts has its own copy of this pair, written
 * first and left alone deliberately: it is another surface's file and its
 * version is load-bearing today. This module is where the next caller goes,
 * and where that one should move when somebody is in there anyway.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type KeysetCursor = { createdAt: Date; id: string }

export function encodeKeysetCursor(row: KeysetCursor): string {
  return `${row.createdAt.toISOString()}|${row.id}`
}

export function decodeKeysetCursor(raw: string | undefined): KeysetCursor | null {
  if (!raw) return null
  const split = raw.indexOf('|')
  if (split === -1) return null
  const createdAt = new Date(raw.slice(0, split))
  const id = raw.slice(split + 1)
  if (Number.isNaN(createdAt.getTime()) || !UUID.test(id)) return null
  return { createdAt, id }
}
