import { PawPrint } from 'lucide-react'
import { signIn } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PasswordAuth } from '@/features/auth/components/password-auth'
import { ClearCachedShell } from '@/features/pwa/clear-cached-shell'

export const metadata = { title: 'Sign in' }

const notionConfigured = !!process.env.NOTION_OAUTH_CLIENT_ID && !!process.env.NOTION_OAUTH_CLIENT_SECRET
const devLoginEmail =
  process.env.NODE_ENV !== 'production' ? process.env.DEV_LOGIN_EMAIL : undefined

export default function SignInPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Landing here means there is no session — drop any Cache Storage the
          previous user's install may still be holding. */}
      <ClearCachedShell />
      <aside className="hidden flex-col justify-between border-r border-sidebar-border bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PawPrint className="size-5" aria-hidden />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight">LogPup</span>
        </div>
        <div className="space-y-6">
          <p className="max-w-md font-heading text-2xl leading-snug font-bold tracking-tight">
            The watchdog for your team&apos;s apps, people, and sprints.
          </p>
          <div className="flex items-center gap-2 text-sm text-sidebar-foreground/60">
            <span>Apps</span>
            <span aria-hidden>·</span>
            <span>People</span>
            <span aria-hidden>·</span>
            <span>Sprints</span>
          </div>
        </div>
      </aside>

      <div className="flex flex-col items-center justify-center gap-6 p-4 py-10 lg:p-10">
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PawPrint className="size-4" aria-hidden />
          </div>
          <span className="font-heading text-lg font-bold tracking-tight">LogPup</span>
        </div>

        <Card className="w-full max-w-sm">
          <CardHeader>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Sign in</h1>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }) }}>
              <Button type="submit" size="lg" className="w-full">Continue with Google</Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <PasswordAuth />

            {notionConfigured && (
              <form action={async () => { 'use server'; await signIn('notion', { redirectTo: '/' }) }}>
                <Button type="submit" variant="outline" size="lg" className="w-full text-muted-foreground">
                  Continue with Notion
                </Button>
              </form>
            )}

            {devLoginEmail && (
              <div className="rounded-lg border border-dashed p-3">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Development
                </p>
                <form
                  action={async () => { 'use server'; await signIn('credentials', { email: devLoginEmail, redirectTo: '/' }) }}
                >
                  <Button type="submit" variant="ghost" className="w-full text-muted-foreground">
                    Dev login ({devLoginEmail})
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
