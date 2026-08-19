import { cache } from 'react'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
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
}

// Unlike listActiveUsers (people/queries.ts), this includes inactive users —
// the admin panel is where an admin reactivates a deactivated account, so it
// must be able to see and select it in the first place. It's scoped to
// status='approved' though: a self-signed-up user awaiting review lives in
// the "Pending approvals" card (see listPendingUsers below) instead of being
// mixed silently into this table, and a rejected account has nothing an
// admin can still do to it here.
export async function listAllUsers(): Promise<AdminUser[]> {
  return db
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
    .where(eq(users.status, 'approved'))
    .orderBy(asc(users.name))
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
