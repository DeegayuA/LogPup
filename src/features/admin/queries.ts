import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

export type AdminUser = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: 'admin' | 'member'
  active: boolean
  orgTags: string[]
  mustChangePassword: boolean
}

// Unlike listActiveUsers (people/queries.ts), this includes inactive users —
// the admin panel is where an admin reactivates a deactivated account, so it
// must be able to see and select it in the first place.
export async function listAllUsers(): Promise<AdminUser[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: users.role,
      active: users.active,
      orgTags: users.orgTags,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .orderBy(asc(users.name))
}
