import { z } from 'zod'

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
    set[key] = key === 'repoUrl' ? parsed.data.repoUrl || null : parsed.data[key]
  }

  if (Object.keys(set).length === 0) return { ok: false, error: 'Nothing to update' }
  return { ok: true, set }
}
