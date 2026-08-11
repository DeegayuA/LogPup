import { auth } from '@/lib/auth'
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
import { getOwnPhone, getOwnAvatarUrl } from '@/features/auth/queries'
import { AvatarUpload } from '@/features/auth/components/avatar-upload'
import { listGeminiKeys } from '@/features/gemini/queries'

export default async function ProfilePage(props: {
  searchParams: Promise<{ firstLogin?: string }>
}) {
  const [session, { firstLogin }] = await Promise.all([auth(), props.searchParams])
  const user = session?.user
  const role = user?.role ?? 'member'
  const [geminiKeys, phone, avatarUrl] = user?.id
    ? await Promise.all([
        listGeminiKeys(user.id),
        getOwnPhone(user.id),
        getOwnAvatarUrl(user.id),
      ])
    : [[], null, null]
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
                  variant={role === 'admin' ? 'default' : 'secondary'}
                  className="capitalize"
                >
                  {role}
                </Badge>
              </div>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {user?.email ?? '—'}
              </span>
            </div>
            <AvatarUpload name={user?.name ?? '?'} avatarUrl={avatarUrl} />
          </CardContent>
        </Card>

        <PhoneField phone={phone} />

        <SetPasswordForm />

        <GeminiKeysCard keys={geminiKeys} />
      </div>
    </div>
  )
}
