import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'admin' | 'member'
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
    mustChangePassword?: boolean
  }
}
