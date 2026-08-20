import { cache } from 'react'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { notRemoved, openRemovals } from '@/features/people/removal-queries'
import type { EmploymentType, UserRole } from '@/features/auth/capabilities'

export type AdminUser = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: UserRole
  employmentType: EmploymentType
  supervisorId: string | null
  active: boolean
  orgTags: string[]
  title: string | null
  phone: string | null
  personalEmail: string | null
  mustChangePassword: boolean
  /**
   * When this account was removed from the workspace, or null while they are
   * still part of it. Only ever non-null on a listAllUsers({ includeRemoved:
   * true }) read — the default view has no removed rows to describe.
   */
  removedAt: Date | null
}

// Unlike listActiveUsers (people/queries.ts), this includes inactive users —
// the admin panel is where an admin reactivates a deactivated account, so it
// must be able to see and select it in the first place. It's scoped to
// status='approved' though: a self-signed-up user awaiting review lives in
// the "Pending approvals" card (see listPendingUsers below) instead of being
// mixed silently into this table, and a rejected account has nothing an
// admin can still do to it here.
//
// REMOVED people are the one exception to "the admin table shows everything",
// and deliberately so rather than for symmetry with the directory: a removed
// account is not reactivated from this table at all. It comes back through
// admin Trash (restorePerson), the same place every other reversible delete
// is undone, so leaving them in the default view would offer a row of
// controls — role, employment type, deactivate — that all act on somebody who
// cannot sign in, with no control here that changes that. `includeRemoved`
// exists for a caller that wants the full roster anyway; it costs one extra
// query and annotates each row with removedAt so removed people can be told
// apart from present ones.
export async function listAllUsers(
  options?: { includeRemoved?: boolean },
): Promise<AdminUser[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: users.role,
      employmentType: users.employmentType,
      supervisorId: users.supervisorId,
      active: users.active,
      orgTags: users.orgTags,
      title: users.title,
      phone: users.phone,
      personalEmail: users.personalEmail,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(
      and(
        eq(users.status, 'approved'),
        options?.includeRemoved ? undefined : notRemoved(users.id),
      ),
    )
    .orderBy(asc(users.name))

  if (!options?.includeRemoved) {
    return rows.map((row) => ({ ...row, removedAt: null }))
  }
  // One batched read for the whole table rather than isRemoved() per row.
  const removals = await openRemovals()
  return rows.map((row) => ({ ...row, removedAt: removals.get(row.id)?.removedAt ?? null }))
}

export type PendingUser = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  phone: string | null
  orgTags: string[]
  createdAt: Date
}

// Self-signed-up Google accounts (see src/lib/auth.ts signIn callback)
// waiting on an admin's role choice + approve/reject decision. Oldest first —
// whoever has been waiting longest surfaces at the top of the card.
export const listPendingUsers = cache(async function listPendingUsers(): Promise<PendingUser[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      phone: users.phone,
      orgTags: users.orgTags,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.status, 'pending'))
    .orderBy(asc(users.createdAt))
})
