// Shared vocabulary for the activity trail. Plain string unions, not pgEnums —
// the column is text (see activity_log in db/schema.ts), so adding a value
// here is a code change only, never a migration.

export const ACTIVITY_ENTITY_TYPES = [
  'app',
  // A bug report. Its own entity type rather than a flavour of 'task':
  // bug_reports is its own table (see the header on it in db/schema.ts), so
  // an entityId here is a bug id and would resolve to nothing as a task.
  'bug',
  'task',
  'sprint',
  'meeting',
  'user',
  'assignment',
  'comment',
  'followup',
  'suggestion',
  // The daily work-done log. entityId is the AUTHOR's user id rather than the
  // row's, because a work log is answered once per person per day and the
  // thing a reader wants to click through to is that person's log, not one
  // day's row in isolation.
  'worklog',
  // Approval-gated edits and the non-daily-logging entities. This union is
  // CLOSED (no `(string & {})` escape hatch, unlike ActivityVerb below), so a
  // new entity type must be named here or every logActivity call for it is a
  // type error. The column is text, so this stays a code change.
  'change_request',
  'absence',
  'work_schedule',
  'org_holiday',
  'app_grant',
  'handover',
  // Money: a role rate, a person rate override, and what a project is worth.
  // Added in the same change that writes the first logActivity call for each
  // — see src/features/finance/rate-actions.ts.
  'rate_card',
  'person_rate',
  'project_value',
  // A planned maintenance window. entityId is the singleton row id ('current')
  // rather than a per-window id: there is only ever one window, and the trail
  // is answering "who closed the workspace, and when" rather than "which of
  // several windows was this".
  'maintenance_window',
] as const

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number]

// The common verbs, named so call sites stay consistent ("deleted", not one
// site's "removed" and another's "erased"). The type stays open (string) at
// the logActivity boundary — an unusual one-off verb is fine — but exporting
// the list keeps the usual ones uniform and gives /activity a filter list.
export const ACTIVITY_VERBS = [
  'created',
  'updated',
  'deleted',
  // Soft deletes: the admin Trash card's two lifecycle moves. Both are logged
  // by every action in src/features/admin/trash-actions.ts, so /activity's
  // filter list would silently omit them without these two entries.
  'restored',
  'purged',
  'moved',
  'completed',
  'reopened',
  'assigned',
  'unassigned',
  'rsvp',
  'resolved',
  'approved',
  'rejected',
  'commented',
] as const

export type ActivityVerb = (typeof ACTIVITY_VERBS)[number] | (string & {})

/** What a call site provides. actorId comes from the action's session. */
export type ActivityInput = {
  actorId: string
  verb: ActivityVerb
  entityType: ActivityEntityType
  entityId: string
  /** The entity's name as it reads right now — survives the entity's deletion. */
  entityLabel: string
  appId?: string | null
  appName?: string | null
  /** Page the change belongs to, e.g. `/apps/logpup` — the row's click-through. */
  pagePath?: string | null
  /** Human fragment completing "actor verb label …": "to In progress". */
  detail?: string | null
  /** Machine-readable before/after for the backtrack. */
  metadata?: Record<string, unknown> | null
}

/** What the feed renders — a log row joined with its actor. */
export type ActivityRow = {
  id: string
  actorId: string
  actorName: string
  actorAvatarUrl: string | null
  verb: string
  entityType: string
  entityId: string
  entityLabel: string
  appId: string | null
  appName: string | null
  pagePath: string | null
  detail: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export type ActivityFilters = {
  actorId?: string
  entityType?: ActivityEntityType
  appId?: string
  /** Inclusive day bounds. */
  from?: Date
  to?: Date
  /**
   * Free-text search. Whitespace-tokenised, every token required (AND), each
   * token matched against entityLabel/detail/verb/entityType (OR) — see
   * activitySearchCondition. SQL-exact only; typo tolerance is a separate,
   * pure-TS layer (features/activity/search.ts) applied over the results.
   */
  q?: string
}
