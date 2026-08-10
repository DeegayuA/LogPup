import { signIn } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordAuth } from '@/features/auth/components/password-auth'

const notionConfigured = !!process.env.NOTION_OAUTH_CLIENT_ID && !!process.env.NOTION_OAUTH_CLIENT_SECRET
const devLoginEmail =
  process.env.NODE_ENV !== 'production' ? process.env.DEV_LOGIN_EMAIL : undefined

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Sign in to LogPup</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <PasswordAuth />

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }) }}>
            <Button type="submit" variant="outline" className="w-full">Continue with Google</Button>
          </form>

          {notionConfigured && (
            <form action={async () => { 'use server'; await signIn('notion', { redirectTo: '/' }) }}>
              <Button type="submit" variant="outline" className="w-full">Continue with Notion</Button>
            </form>
          )}

          {devLoginEmail && (
            <form
              action={async () => { 'use server'; await signIn('credentials', { email: devLoginEmail, redirectTo: '/' }) }}
              className="border-t pt-4"
            >
              <Button type="submit" variant="ghost" className="w-full text-muted-foreground">
                Dev login ({devLoginEmail})
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
