import { redirect } from 'next/navigation'
import { Clock, ShieldX } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { getSession } from '@/lib/session'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { BrandMark } from '@/components/shell/brand-mark'
import { OnboardingForm } from '@/features/onboarding/components/onboarding-form'
import { getOwnPhone } from '@/features/auth/queries'
import { orgForEmail } from '@/lib/org-from-domain'

export const metadata = { title: 'Pending approval' }

// Lives outside the (app) route group on purpose: an unapproved user has no
// business rendering the full sidebar/header shell (Sidebar/Header assume an
// approved teammate — apps, people, sprints), and src/proxy.ts pins every
// non-approved session here for every other path anyway (see the
// pending-approval gate there), so this needs to work as its own minimal
// page rather than a child of that shell.
export default async function PendingPage() {
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')

  // Belt-and-suspenders: the proxy gate is what normally keeps an approved
  // user from ever landing here, but a stale tab or a direct navigation
  // right after approval shouldn't show a stale "pending" card.
  if (session.user.status === 'approved') redirect('/')

  const email = session.user.email

  if (session.user.status === 'rejected') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 py-10">
        <BrandMark />
        <div className="flex w-full max-w-md flex-col gap-4">
          {/* The page's identity is a real h1 (this page shipped with no
              heading at all): screen readers land on "Access denied", not on
              an anonymous card. */}
          <PageHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldX aria-hidden className="size-5 shrink-0 text-destructive" />
                Access denied
              </span>
            }
            description={
              <>
                An admin reviewed{' '}
                <span className="font-mono text-xs text-foreground">{email}</span> and
                declined this account.
              </>
            }
          />
          <Card className="ring-destructive/30">
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                There&apos;s nothing more to do here — if you think that&apos;s a mistake,
                reach out to your workspace admin directly.
              </p>
              <form
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/sign-in' })
                }}
              >
                <Button type="submit" variant="outline">
                  Sign out
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  // status === 'pending'
  const derivedOrg = orgForEmail(email)
  const phone = await getOwnPhone(session.user.id)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 py-10">
      <BrandMark />
      <div className="flex w-full max-w-md flex-col gap-4">
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <Clock aria-hidden className="size-5 shrink-0 text-primary" />
              Awaiting approval
            </span>
          }
          description={
            <>
              You&apos;re signed in as{' '}
              <span className="font-mono text-xs text-foreground">{email}</span>. An admin
              needs to approve your account before you can use LogPup — add a few details
              below so they have what they need.
            </>
          }
        />
        <Card className="ring-primary/30">
          <CardContent className="flex flex-col gap-4">
            <OnboardingForm initialPhone={phone} derivedOrg={derivedOrg} />
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              If you have a company email address, sign in with that instead — it links you
              to your organization automatically.
            </p>
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/sign-in' })
              }}
              className="self-start"
            >
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
