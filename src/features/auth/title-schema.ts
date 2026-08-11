import { z } from 'zod'

// Self-service cap for setOwnTitle (features/auth/actions.ts) — deliberately
// tighter than the admin-set title cap in features/admin/actions.ts (80).
// Pulled into its own module (rather than inlined in actions.ts) because a
// 'use server' file may only export async functions — a plain zod schema
// can't live there and still be unit-testable.
export const ownTitleInput = z
  .string()
  .trim()
  .max(60, 'Job role must be 60 characters or fewer')
