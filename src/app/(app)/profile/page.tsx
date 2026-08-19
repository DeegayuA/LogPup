import Link from 'next/link'
import { Briefcase, PawPrint } from 'lucide-react'
import { getSession } from '@/lib/session'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SetPasswordForm } from '@/features/auth/components/set-password-form'
import { GeminiKeysCard } from '@/features/gemini/components/gemini-keys-card'
import { PhoneField } from '@/features/auth/components/phone-field'
import { getOwnPhone, getOwnAvatarUrl, getOwnTitle } from '@/features/auth/queries'
import { AvatarUpload } from '@/features/auth/components/avatar-upload'
import { listGeminiKeys, sharedKeyUsageByCaller } from '@/features/gemini/queries'
import { isAdminRole, roleLabel } from '@/features/auth/capabilities'

export default async function ProfilePage(props: {
  searchParams: Promise<{ firstLogin?: string }>
}) {
  const [session, { firstLogin }] = await Promise.all([getSession(), props.searchParams])
  const user = session?.user
  const role = user?.role ?? 'member'
  const [geminiKeys, usedBy, phone, avatarUrl, title] = user?.id
    ? await Promise.all([
        listGeminiKeys(user.id),
        sharedKeyUsageByCaller(user.id, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
        getOwnPhone(user.id),
        getOwnAvatarUrl(user.id),
        getOwnTitle(user.id),
      ])
    : [[], [], null, null, null]
  const showFirstLoginBanner = firstLogin === '1' || user?.mustChangePassword === true

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Profile</h1>

        {showFirstLoginBanner ? (
          <Card className="ring-primary/40">
            <CardHeader>
              <CardTitle>Welcome to LogPup 🐾</CardTitle>
              <CardDescription>
                Set your own password to continue. Your starter password is temporary.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-lg leading-tight font-semibold">
                  {user?.name ?? '—'}
                </span>
                <Badge
                  variant={isAdminRole(role) ? 'default' : 'secondary'}
                >
                  {roleLabel(role)}
                </Badge>
              </div>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {user?.email ?? '—'}
              </span>
            </div>
            <AvatarUpload name={user?.name ?? '?'} avatarUrl={avatarUrl} />
          </CardContent>
        </Card>

        {/* Read-only on purpose: users.title is set by admins (setUserTitle in
            features/admin/actions.ts), so there is no control here — not a
            disabled one either, which would only invite a pointless click. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
              <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <PawPrint className="size-5 text-muted-foreground/60" aria-hidden />
                <p className="text-sm font-medium">No job role yet.</p>
                <p className="text-xs text-muted-foreground">
                  An admin adds it from Admin → Users. Until then, teammates just see your
                  name and email.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <PhoneField phone={phone} />

        <SetPasswordForm />

        <GeminiKeysCard keys={geminiKeys} usedBy={usedBy} />

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
          holds your theme, your passkeys, whether your Gemini keys are working, per-feature
          AI on/off switches with cost and usage, the version you are on, and sign out.
        </p>
      </div>
    </div>
  )
}
