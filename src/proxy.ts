import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL('/sign-in', req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|sign-in).*)'],
}
