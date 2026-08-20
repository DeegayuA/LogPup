import 'next-auth'
// Imported from the capability module, not from db/schema: capabilities.ts is
// pure and client-safe, so this declaration does not drag Drizzle into every
// file that reads a session. A test asserts the union there matches the pg
// enum, so the two cannot drift.
import type { UserRole } from '@/features/auth/capabilities'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      // Open-signup admin-approval gate (see src/db/schema.ts `user_status`
      // and src/proxy.ts). A 'rejected' user never reaches here — the jwt
      // callback returns null for them — so in practice this is 'pending' or
      // 'approved', but the type stays honest about the full column domain.
      status: 'pending' | 'approved' | 'rejected'
      // users.active. A deactivated person holds a real session on purpose —
      // it is the only way to show them why they cannot use the app and let
      // them sign out (see the jwt callback in src/lib/auth.ts). Non-optional
      // because the session callback normalizes it, so every reader can just
      // ask.
      active: boolean
      mustChangePassword: boolean
      email: string
      name?: string | null
      image?: string | null
    }
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    role?: UserRole
    status?: 'pending' | 'approved' | 'rejected'
    active?: boolean
    mustChangePassword?: boolean
  }
}
