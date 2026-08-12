import { z } from 'zod'

// One cap for the column, shared by the schema below and the maxLength on
// every input that writes it. Same reasoning as JOB_ROLE_MAX_LENGTH: three
// independent caps on one column is how a dialog comes to accept strings the
// table rejects.
export const PERSONAL_EMAIL_MAX_LENGTH = 120

// The one validator for users.personal_email, for every write path
// (createUser and setUserPersonalEmail — both admin-only, both in
// features/admin/actions.ts). Lives in its own module because a 'use server'
// file may only export async functions, so a plain zod schema can't sit
// beside its callers and still be unit-testable.
//
// An empty string is valid and means "clear it". The actions map that to
// null, so "no personal email" has exactly one representation in the column.
//
// NOT domain-gated on purpose. emailAllowed() guards sign-in; this address
// never signs anyone in, and gating it would reject the gmail addresses that
// are the whole reason the column exists.
export const personalEmailInput = z
  .string()
  .trim()
  .toLowerCase()
  .max(
    PERSONAL_EMAIL_MAX_LENGTH,
    `Personal email must be ${PERSONAL_EMAIL_MAX_LENGTH} characters or fewer`,
  )
  .refine((value) => value === '' || z.email().safeParse(value).success, {
    message: 'That does not look like an email address',
  })
