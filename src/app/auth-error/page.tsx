import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/shell/brand-mark'

export const metadata = { title: 'Sign-in error' }

// Auth.js's own codes for next-auth@beta — see
// https://authjs.dev/reference/core/types#autherror. Anything not listed
// here (including no code at all) falls through to the generic message.
const ERROR_COPY: Record<string, { title: string; detail: string }> = {
  AccessDenied: {
    title: 'Access denied',
    // Deliberately no longer mentions deactivation: a deactivated account
    // signs in and lands on /deactivated now (see the jwt callback in
    // src/lib/auth.ts), so listing it here would send someone hunting for the
    // wrong explanation.
    detail:
      "That sign-in was rejected. Most often this means an admin declined the account, or the email Google returned isn't verified. If you were expecting access, check with your workspace admin.",
  },
  Verification: {
    title: 'Link expired',
    detail: 'That sign-in link is no longer valid — it may have expired or already been used. Try signing in again.',
  },
  Configuration: {
    title: "Something's misconfigured",
    detail: "Sign-in isn't set up correctly on our end right now. Try again shortly, or let your workspace admin know.",
  },
  CredentialsSignin: {
    title: "That didn't work",
    detail: 'Double-check your email and password and try again.',
  },
  // Not one of Auth.js's own codes — the signIn callback in src/lib/auth.ts
  // hands back this page's URL directly for a removed account, because an
  // OAuth redirect has nowhere else to carry a message and `false` would
  // land it on the AccessDenied copy above, which lists three other causes
  // and would send the person looking for the wrong problem.
  AccountRemoved: {
    title: 'This account is no longer active',
    detail:
      "You've been removed from this workspace, so there's nothing to sign in to. Everything you worked on is still there and still credited to you. If this is a mistake, ask a workspace admin — they can put the account back.",
  },
}

const DEFAULT_COPY = {
  title: 'Sign-in failed',
  detail: 'Something went wrong while signing you in. Try again — if it keeps happening, let your workspace admin know.',
}

// Replaces Auth.js's stock white "Access Denied" page (see the `pages.error`
// wiring in src/lib/auth.ts) with something that matches the rest of the
// app — same dark tokens, same card chrome as /pending, and copy that
// actually explains what happened instead of a bare phrase on a blank page.
export default async function AuthErrorPage(props: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await props.searchParams
  const copy = (error && ERROR_COPY[error]) || DEFAULT_COPY

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 py-10">
      <BrandMark />
      <Card className="w-full max-w-md ring-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert aria-hidden className="size-4 text-destructive" />
            {copy.title}
          </CardTitle>
          <CardDescription>{copy.detail}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/sign-in" />}>Back to sign in</Button>
        </CardContent>
      </Card>
    </main>
  )
}
