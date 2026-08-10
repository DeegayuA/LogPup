import { auth } from '@/lib/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SetPasswordForm } from '@/features/auth/components/set-password-form'

export default async function ProfilePage() {
  const session = await auth()
  const user = session?.user
  const initials = (user?.name ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="font-heading text-xl font-medium">Profile</h1>

      <Card size="sm">
        <CardHeader><CardTitle className="text-sm">Account</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar>
            {user?.image ? <AvatarImage src={user.image} alt={user.name ?? ''} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <span className="font-medium">{user?.name ?? '—'}</span>
            <span className="text-sm text-muted-foreground">{user?.email ?? '—'}</span>
            <Badge className="w-fit capitalize">{user?.role ?? 'member'}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="lg:max-w-sm">
        <SetPasswordForm />
      </div>
    </div>
  )
}
