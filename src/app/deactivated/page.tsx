import { redirect } from 'next/navigation'
import { PowerOff } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { getSession } from '@/lib/session'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/shell/brand-mark'

export const metadata = { title: 'Account deactivated' }

// The whole of what a deactivated account can see.
//
// Lives outside the (app) route group for the same reason /pending does: the
// sidebar, header and command palette all assume somebody who may act, and
// this person may not. src/proxy.ts pins every other path here, and the (app)
// layout redirects before any page query runs, so nothing else is reachable
// to fall back on — this page has to stand alone.
//
// It reads NOTHING from the database. Everything on it comes from the
// session, which is deliberate: the one thing a deactivated account must not
// do is load workspace data on its way to being told it cannot.
//
// TONE. Deactivation is an administrative state, not a verdict, and this
// screen is read by someone who has just been locked out of their own work
// and is frightened it is gone. So: say what happened, say the work is
// intact, say who can change it. No apology, no accusation, and no support
// form — there is no ticket queue behind this product, and offering one that
// silently goes nowhere is worse than naming the person who can actually
// help.
export default async function DeactivatedPage() {
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')

  // Reactivation takes effect on the next request (the jwt callback re-reads
  // users.active every time), so a tab left open on this page must not keep
  // showing it after an admin switches the account back on.
  if (session.user.active) redirect('/')

  const email = session.user.email

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 py-10">
      <BrandMark />
      {/* Same editorial header language as the sign-in card — mono eyebrow,
          heading at the same negative tracking, a rule drawn from the left —
          because this is the other end of the same journey and a person
          arrives here seconds after leaving that page. Default card ring, not
          the destructive one /pending uses for a rejected account: a red
          border says "you did something", and nobody deactivated did. */}
      <Card className="w-full max-w-md">
        <CardHeader className="gap-3">
          <span className="flex items-center gap-2 font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">
            <PowerOff aria-hidden className="size-3.5" />
            Account status
          </span>
          <h1 className="font-heading text-[1.75rem] leading-[1.05] font-bold tracking-[-0.03em]">
            This account is deactivated
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You&apos;re signed in as{' '}
            <span className="font-mono text-xs text-foreground">{email}</span>, but an
            admin has switched this account off, so LogPup is closed to you for now.
          </p>
          <span
            aria-hidden
            className="rule-draw mt-1 block h-px w-full origin-left bg-border"
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Set against the page behind a rule rather than in a filled box,
              matching the caveat on the sign-in card: a grey panel inside a
              card is a third surface, and the border alone separates it. */}
          <div className="flex flex-col gap-3 border-l-2 border-border pl-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Nothing of yours has been deleted. Your worklog, meetings, notes and tasks
              are exactly where you left them, and they come back untouched if the
              account is switched on again.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Only an admin can switch it back on. If you think this is a mistake, or you
              need access again, ask your workspace admin directly — there&apos;s nothing
              to submit from this page.
            </p>
          </div>

          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/sign-in' })
            }}
          >
            <Button type="submit" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
