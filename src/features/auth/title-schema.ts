import { z } from 'zod'
import { JOB_ROLE_MAX_LENGTH } from '@/lib/job-roles'

// The one validator for a job role (users.title), for every write path.
// Job roles are ADMIN-ONLY: nobody sets their own — setUserTitle and
// createUser in features/admin/actions.ts are the only callers, and both sit
// behind requireAdmin(). Pulled into its own module (rather than inlined in
// actions.ts) because a 'use server' file may only export async functions —
// a plain zod schema can't live there and still be unit-testable.
// An empty string is valid and means "clear the job role".
export const jobRoleInput = z
  .string()
  .trim()
  .max(JOB_ROLE_MAX_LENGTH, `Job role must be ${JOB_ROLE_MAX_LENGTH} characters or fewer`)
