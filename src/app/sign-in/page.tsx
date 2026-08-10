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
        </CardContent>
      </Card>
    </main>
  )
}
