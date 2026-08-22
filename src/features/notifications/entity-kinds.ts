/**
 * What the workspace points at, named once.
 *
 * Three tables carry a "what kind of thing is this" string — `activity_log.
 * entity_type`, `notifications.entity_type`, and now `mentions.source_type` —
 * and three tables inventing three vocabularies is how a per-entity join
 * silently returns nothing. Not an empty result anybody can see: a join on
 * `'app_comment' = 'comment'` matches no rows and reads as "nobody has
 * mentioned you", forever.
 *
 * PURE. Strings and a lookup, no db, so the mapping below is testable by value.
 *
 * ONE DEVIATION FROM THE DESIGN, deliberate. It asks for a single const union
 * shared by all three columns. The values it lists for each are not the same
 * granularity, and cannot be: `activity_log` records that a THING changed
 * (`task`, `app`, `meeting`), while a mention records which BODY OF TEXT
 * somebody was named in (`app_comment`, `note_segment`, `meeting_notes`).
 * Collapsing them would either lose "which text" from mentions or invent
 * activity-log entity types that nothing writes.
 *
 * So: one module, two lists, and a total mapping from the second to the first —
 * enforced by `entityKindForSource` being exhaustive and by the test beside it.
 * A new mention source cannot be added without saying which entity it is about,
 * which is the drift the design was actually guarding against.
 */

/**
 * The things a notification or an activity row can be ABOUT.
 *
 * Matches the vocabulary `activity_log.entity_type` already writes — see the
 * comment on that column. Adding one here is free; removing one orphans rows
 * that already name it, which is why nothing is ever removed.
 */
export const ENTITY_KINDS = [
  'app',
  'task',
  'sprint',
  'meeting',
  'user',
  'assignment',
  'comment',
  'followup',
  'worklog',
] as const

export type EntityKind = (typeof ENTITY_KINDS)[number]

/**
 * Where a mention can be written.
 *
 * Narrower and more specific than EntityKind on purpose: "you were named in a
 * comment on Atlas" and "you were named in the notes of Monday's standup" are
 * different sentences, and the reader needs to know which before deciding
 * whether to click.
 */
export const MENTION_SOURCES = [
  'app_comment',
  'note_segment',
  'meeting_notes',
  'task',
  'worklog',
  'followup',
] as const

export type MentionSource = (typeof MENTION_SOURCES)[number]

/**
 * Which entity a mention source is about.
 *
 * TOTAL, and exhaustively so — a `MentionSource` added without a case here is a
 * compile error rather than a row whose click-through resolves to nothing. That
 * is the whole reason this file exists.
 */
export function entityKindForSource(source: MentionSource): EntityKind {
  switch (source) {
    case 'app_comment':
      return 'comment'
    case 'note_segment':
    case 'meeting_notes':
      return 'meeting'
    case 'task':
      return 'task'
    case 'worklog':
      return 'worklog'
    case 'followup':
      return 'followup'
  }
}

/** Whether a string read back out of the database is still a source we know. */
export function isMentionSource(value: string): value is MentionSource {
  return (MENTION_SOURCES as readonly string[]).includes(value)
}
