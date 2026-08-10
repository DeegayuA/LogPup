import { signIn } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Card className="w-80">
        <CardHeader><CardTitle>LogPup</CardTitle></CardHeader>
        <CardContent>
          <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }) }}>
            <Button type="submit" className="w-full">Continue with Google</Button>
          </form>
          {process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN_EMAIL && (
            <form
              action={async () => {
                'use server'
                await signIn('credentials', {
                  email: process.env.DEV_LOGIN_EMAIL,
                  redirectTo: '/',
                })
              }}
              className="mt-4 border-t pt-4"
            >
              <Button type="submit" variant="outline" className="w-full">
                Dev login ({process.env.DEV_LOGIN_EMAIL})
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
