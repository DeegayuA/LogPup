/**
 * Rows one provider may return.
 *
 * Six, unchanged from the single LIMIT the five inline queries shared before
 * the registry. It is a per-group cap, not a total: the list is meant to be
 * scanned, and CommandList's viewport (components/ui/command.tsx) shows about
 * that many rows before scrolling.
 */
export const PALETTE_RESULT_LIMIT = 6

/** Shorter than this and the palette does not ask the server at all. */
export const MIN_QUERY_LENGTH = 2

/**
 * Escapes LIKE metacharacters so "50%" matches literally rather than as a
 * wildcard. Relies on Postgres's default backslash escape character, which is
 * why no explicit ESCAPE clause is emitted.
 */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, '\\$&')}%`
}
