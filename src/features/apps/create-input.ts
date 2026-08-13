import { z } from 'zod'

/**
 * Validates a full app-creation payload. Split out of actions.ts — a
 * `'use server'` file, where every export must be an async function — so the
 * schema itself, and the "PM is required" rule in particular, can be unit
 * tested without a database. Mirrors `appUpdateInput` in update-input.ts,
 * which is the same shape minus the `.partial()`.
 */
export const appCreateInput = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  repoUrl: z.union([z.url(), z.literal('')]).optional(),
  techTags: z.array(z.string().min(1)).max(10).default([]),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
  leadId: z.uuid().optional(),
  // Required — every app must have a PM from the moment it is created,
  // unlike leadId above. A field that is only required in the browser is not
  // required: app-form-dialog.tsx's PM select never offers a "no PM" option,
  // and this is the server-side half of that same rule.
  pmId: z.uuid(),
})
