import { z } from 'zod'
import { normalizePhone } from '@/lib/phone'

// Kept in its own module (not inline in actions.ts) for two reasons: a
// 'use server' file may only export async functions — a zod schema can't
// live there — and this way the pure validation logic is directly unit
// testable (see schema.test.ts) without touching the DB or a session.
export const onboardingInput = z.object({
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .max(30, 'Phone number is too long')
    .refine((value) => normalizePhone(value) !== null, {
      message: 'That does not look like a phone number',
    }),
  // Only actually used when the caller's email domain doesn't map to a known
  // company (src/lib/org-from-domain.ts) — submitOnboarding re-derives the
  // organization from the caller's own session email and that always wins
  // when present, regardless of what's submitted here. Still validated the
  // same way either way, since a derivable org skips rendering this input at
  // all (see the onboarding form) rather than sending it disabled.
  organization: z
    .string()
    .trim()
    .min(1, 'Company / organization is required')
    .max(30, 'Keep it under 30 characters'),
})

export type OnboardingInput = z.infer<typeof onboardingInput>
