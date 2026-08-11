import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'admin' | 'member'
      // Open-signup admin-approval gate (see src/db/schema.ts `user_status`
      // and src/proxy.ts). A 'rejected' user never reaches here — the jwt
      // callback returns null for them — so in practice this is 'pending' or
      // 'approved', but the type stays honest about the full column domain.
      status: 'pending' | 'approved' | 'rejected'
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
    role?: 'admin' | 'member'
    status?: 'pending' | 'approved' | 'rejected'
    mustChangePassword?: boolean
  }
}
