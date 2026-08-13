import { z } from 'zod'
import type { AppStatus } from '@/features/apps/app-health'

// Deliberately no `.default()` on any field: unlike the create schema, a
// missing key here must stay missing after parsing so a partial update only
// touches the fields the caller actually sent. See `buildAppUpdate`.
const appUpdateInput = z
  .object({
    name: z.string().min(2).max(80),
    description: z.string().max(500),
    repoUrl: z.union([z.url(), z.literal('')]),
    techTags: z.array(z.string().min(1)).max(10),
    status: z.enum(['active', 'paused', 'archived']),
    leadId: z.uuid().nullable(),
    // No `.nullable()`, unlike leadId: the PM is required, so there is no
    // sentinel for "clear it" — when the key is present it must be a real
    // uuid. Omitting the key entirely (a partial update that doesn't touch
    // the PM) is still allowed, same as every other field here.
    pmId: z.uuid(),
  })
  .partial()

export type AppUpdateResult =
  | { ok: true; set: Record<string, unknown> }
  | { ok: false; error: string }

/**
 * Validates a partial app-update payload and produces a Drizzle `.set()`
 * object containing only the keys present in the input. Prevents omitted
 * fields (e.g. techTags, status) from being reset to their zod defaults.
 */
export function buildAppUpdate(input: unknown): AppUpdateResult {
  const parsed = appUpdateInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const set: Record<string, unknown> = {}
  for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
    if (key === 'repoUrl') {
      set.repoUrl = parsed.data.repoUrl || null
    } else if (key === 'description') {
      set.description = parsed.data.description || null
    } else {
      set[key] = parsed.data[key]
    }
  }

  if (Object.keys(set).length === 0) return { ok: false, error: 'Nothing to update' }
  return { ok: true, set }
}

// ---- Change summary for the activity trail ----

export type AppBeforeState = {
  status: AppStatus
  leadId: string | null
  pmId: string
}

export type AppChangeNames = {
  /** Resolved display name for the incoming pmId, when `set.pmId` differs
   *  from `before.pmId`. Callers should only pay for this lookup when that
   *  is actually the case — see updateApp in actions.ts. */
  pmName?: string | null
  /** Same, for a changed leadId. Irrelevant (and left undefined) when the
   *  new leadId is null — "no lead" needs no name lookup. */
  leadName?: string | null
}

export type AppChangeSummary = {
  detail: string | null
  metadata: Record<string, unknown> | null
}

/**
 * Turns the fields updateApp actually changed into the single detail/metadata
 * pair its one logActivity call carries — the generalization of the
 * statusChanged check this file used to do inline for status alone, now also
 * covering the PM and lead. This is the append-only AUDIT half of PM/lead
 * history: it answers "who changed the PM/lead, to whom, and when" for a
 * human reading /activity. The as-of half — "who was PM on 12 June" from one
 * indexed query — is app_role_history (src/db/schema.ts), which updateApp
 * writes to alongside this, in the same db.batch as the update itself. See
 * features/apps/role-history.ts for that table's pure read/write logic.
 *
 * Compares `set` (buildAppUpdate's output — only the keys the caller actually
 * sent) against `before` (the row's state immediately prior to the write), so
 * a no-op edit — the settings form always resubmits name/status/pmId whether
 * or not the admin touched them — produces neither a detail fragment nor a
 * metadata key. That is what keeps a same-value save from polluting the
 * trail.
 *
 * `detail` uses names, not ids — an id means nothing to a human reading
 * /activity. `metadata` keeps the raw ids (and the prior value) for anyone
 * who needs to trace a change back to the exact user record.
 */
export function summarizeAppChanges(
  before: AppBeforeState,
  set: Record<string, unknown>,
  names: AppChangeNames = {},
): AppChangeSummary {
  const fragments: string[] = []
  const metadata: Record<string, unknown> = {}

  if (typeof set.status === 'string' && set.status !== before.status) {
    fragments.push(`status to ${set.status}`)
    metadata.status = { from: before.status, to: set.status }
  }

  if (typeof set.pmId === 'string' && set.pmId !== before.pmId) {
    fragments.push(`PM to ${names.pmName ?? 'an unknown member'}`)
    metadata.pmId = { from: before.pmId, to: set.pmId }
  }

  if ('leadId' in set && set.leadId !== before.leadId) {
    const leadId = set.leadId as string | null
    fragments.push(`lead to ${leadId === null ? 'no lead' : (names.leadName ?? 'an unknown member')}`)
    metadata.leadId = { from: before.leadId, to: leadId }
  }

  if (fragments.length === 0) return { detail: null, metadata: null }
  return { detail: fragments.join(', '), metadata }
}
