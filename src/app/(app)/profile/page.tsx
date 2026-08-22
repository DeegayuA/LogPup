import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Briefcase, KeyRound, PawPrint } from 'lucide-react'
import { getSession } from '@/lib/session'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SetPasswordForm } from '@/features/auth/components/set-password-form'
import { PasskeysCard } from '@/features/auth/components/passkeys-card'
import { GithubLoginField } from '@/features/auth/components/github-login-field'
import { PhoneField } from '@/features/auth/components/phone-field'
import { getOwnPhone, getOwnAvatarUrl, getOwnGithubLogin, getOwnTitle } from '@/features/auth/queries'
import { listPasskeys } from '@/features/auth/webauthn-actions'
import { AvatarUpload } from '@/features/auth/components/avatar-upload'
import { isAdminRole, roleLabel } from '@/features/auth/capabilities'

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your avatar, phone number, password and passkeys.',
}

/**
 * The fields you EDIT about yourself: avatar, phone, password, passkeys.
 * Gemini keys used to end this page; they now live on /settings beside the
 * readiness verdict and the per-feature switches they unlock — one AI setup
 * loop, one page. The #gemini stub below keeps old deep links landing
 * somewhere true (meeting-intel still emits /profile#gemini).
 */
export default async function ProfilePage(props: {
  searchParams: Promise<{ firstLogin?: string }>
}) {
  const [session, { firstLogin }] = await Promise.all([getSession(), props.searchParams])
  const user = session?.user
  // The (app) layout and the proxy both gate this already; this narrows the
  // types honestly rather than scattering `?.` through the render.
  if (!user?.id) redirect('/sign-in')

  const [passkeysRes, phone, avatarUrl, title, githubLogin] = await Promise.all([
    listPasskeys(),
    getOwnPhone(user.id),
    getOwnAvatarUrl(user.id),
    getOwnTitle(user.id),
    getOwnGithubLogin(user.id),
  ])
  const passkeys = passkeysRes.ok ? passkeysRes.data : []
  const showFirstLoginBanner = firstLogin === '1' || user.mustChangePassword === true

  return (
    <div className="relative flex flex-1 flex-col p-4 sm:p-6 md:p-8 overflow-hidden">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-[450px] w-[600px] rounded-full bg-primary/8 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 -left-40 -z-10 h-[400px] w-[500px] rounded-full bg-chart-1/5 blur-3xl"
        aria-hidden
      />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageHeader
          title="User Profile"
          description="Your name and photo as teammates see them, and the credentials you sign in with."
        />

        {showFirstLoginBanner ? (
          <Card className="ring-primary/40">
            <CardHeader>
              <CardTitle as="h2">Welcome to LogPup 🐾</CardTitle>
              <CardDescription>
                Set your own password to continue. Your starter password is temporary.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* The one must-do first-run task, one click away instead of
                  four cards of scrolling — the target card carries the id
                  (and a scroll margin for the sticky header). */}
              <Button size="sm" render={<a href="#password" />}>
                Set your password
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle as="h2">Identity</CardTitle>
            <CardDescription>
              What teammates see next to your work. Name, email and job role are managed by
              admins; the photo is yours.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-lg leading-tight font-semibold">
                  {user.name ?? '—'}
                </span>
                <Badge variant={isAdminRole(user.role) ? 'default' : 'secondary'}>
                  {roleLabel(user.role)}
                </Badge>
              </div>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            <AvatarUpload name={user.name ?? '?'} avatarUrl={avatarUrl} />
          </CardContent>
        </Card>

        {/* Read-only on purpose: users.title is set by admins (setUserTitle in
            features/admin/actions.ts), so there is no control here — not a
            disabled one either, which would only invite a pointless click. */}
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <Briefcase className="size-4" aria-hidden /> Job role
            </CardTitle>
            <CardDescription>
              Shown to teammates on People and in your account menu. Admins keep this one
              up to date, so ask yours if it changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {title ? (
              <p className="text-sm font-medium">{title}</p>
            ) : (
              // No action slot: the next step belongs to an admin, not this
              // user — the description names who to ask, which is the most a
              // permission wall can honestly offer.
              <EmptyState
                icon={PawPrint}
                title="No job role yet."
                description="An admin adds it from Admin → Users. Until then, teammates just see your name and email."
                className="rounded-xl border border-dashed border-border"
              />
            )}
          </CardContent>
        </Card>

        <PhoneField phone={phone} />
        <GithubLoginField githubLogin={githubLogin} />

        <SetPasswordForm />

        <PasskeysCard initial={passkeys} />

        {/* Pointer stub, not a dead anchor: meeting-intel (frozen this wave)
            still deep-links to /profile#gemini, so that link has to land on
            something that says where the keys went. */}
        <Card id="gemini" className="scroll-mt-20">
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <KeyRound className="size-4" aria-hidden /> Gemini API keys
            </CardTitle>
            <CardDescription>
              Moved to Settings, where they sit beside the AI readiness verdict and the
              per-feature switches they unlock.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" render={<Link href="/settings#gemini" />}>
              <KeyRound /> Manage keys in Settings
            </Button>
          </CardContent>
        </Card>

        {/* The mirror of the footnote at the foot of /settings. The two pages
            split along edit-here / read-there, which is only guessable if each
            one names the other — saying it on one page left half the split
            invisible to anyone who landed here first. No external-link icon:
            this stays inside the app. */}
        <p className="text-xs text-muted-foreground">
          Looking for something else?{' '}
          <Link
            href="/settings"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Settings
          </Link>{' '}
          holds your theme, your Gemini keys and whether they are working, per-feature AI
          on/off switches with cost and usage, the version you are on, and sign out.
        </p>
      </div>
    </div>
  )
}
