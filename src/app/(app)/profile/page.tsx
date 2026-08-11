import { auth } from '@/lib/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { SetPasswordForm } from '@/features/auth/components/set-password-form'
import { GeminiKeysCard } from '@/features/gemini/components/gemini-keys-card'
import { listGeminiKeys } from '@/features/gemini/queries'

export default async function ProfilePage() {
  const session = await auth()
  const user = session?.user
  const role = user?.role ?? 'member'
  const initials = (user?.name ?? '?').slice(0, 1).toUpperCase()
  const geminiKeys = user?.id ? await listGeminiKeys(user.id) : []

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Profile</h1>

        <Card>
          <CardContent className="flex items-center gap-4">
            <Avatar size="lg" className="size-14!">
              {user?.image ? <AvatarImage src={user.image} alt={user.name ?? ''} /> : null}
              <AvatarFallback className="font-heading text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
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
          </CardContent>
        </Card>

        <SetPasswordForm />

        <GeminiKeysCard keys={geminiKeys} />
      </div>
    </div>
  )
}
