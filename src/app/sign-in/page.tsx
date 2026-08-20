import Link from 'next/link'
import {
  AppWindow,
  CalendarDays,
  ChevronDown,
  PawPrint,
  ShieldCheck,
  SquareKanban,
  Users,
  Wrench,
} from 'lucide-react'
import { signIn } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { AltaVisionLogo } from '@/components/brand/alta-vision-logo'
import { GoogleOneTap } from '@/features/auth/components/google-one-tap'
import { PasskeyLoginButton } from '@/features/auth/components/passkey-login-button'
import { PasswordAuth } from '@/features/auth/components/password-auth'
import { SignInMethods } from '@/features/auth/components/sign-in-methods'
import { SignInBackdrop } from '@/features/auth/components/sign-in-backdrop'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { ClearCachedShell } from '@/features/pwa/clear-cached-shell'

export const metadata = { title: 'Sign in' }

const CAPABILITIES = [
  { icon: AppWindow, title: 'Apps', detail: 'Every product, its team, and its status in one list.' },
  { icon: Users, title: 'People', detail: 'Who is on what, and how much room they have left.' },
  { icon: SquareKanban, title: 'Sprints', detail: 'Boards, backlog, and a roadmap per app.' },
  { icon: CalendarDays, title: 'Meetings', detail: 'Scheduled, transcribed, and turned into notes.' },
] as const

const notionConfigured = !!process.env.NOTION_OAUTH_CLIENT_ID && !!process.env.NOTION_OAUTH_CLIENT_SECRET
// An OAuth client id is public by design — it ships in every authorization URL
// — so it is handed to the client component as a prop rather than duplicated
// into a NEXT_PUBLIC_ variable that could drift from AUTH_GOOGLE_ID.
const googleClientId = process.env.AUTH_GOOGLE_ID
const devLoginEmail =
  process.env.NODE_ENV !== 'production' ? process.env.DEV_LOGIN_EMAIL : undefined

export default function SignInPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Landing here means there is no session — drop any Cache Storage the
          previous user's install may still be holding. */}
      <ClearCachedShell />
      {/* Renders no markup — it opens Google's own floating prompt. Skipped
          entirely when no client id is configured, so local setups without
          Google credentials don't ship a script that can only fail. */}
      {googleClientId ? <GoogleOneTap clientId={googleClientId} /> : null}
      <aside className="relative hidden flex-col overflow-hidden border-r border-sidebar-border bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <SignInBackdrop />
        {/* One orchestrated page-load sequence: the brand resolves top-down,
            then the card arrives. Opacity + transform only, and every step is
            dropped under prefers-reduced-motion. */}
        <div className="relative flex items-center gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-500 motion-safe:ease-out">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PawPrint className="size-5" aria-hidden />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight">LogPup</span>
        </div>

        {/* The panel earns its width by saying what the product actually does,
            rather than stranding a tagline at the bottom of empty space. */}
        <div className="relative my-auto flex max-w-md flex-col gap-8 py-10">
          {/* Same eyebrow-then-headline order as every section of /home, at
              the same tracking. It is the cheapest way to make two pages read
              as one voice, and it gives the sentence something to sit under
              instead of floating in the panel. */}
          <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:ease-out motion-safe:[animation-delay:120ms] motion-safe:[animation-fill-mode:backwards]">
            <span className="font-mono text-2xs tracking-[0.18em] text-sidebar-foreground/60 uppercase">
              Engineering operations
            </span>
            <p className="font-heading text-[2rem] leading-[1.05] font-bold tracking-[-0.03em]">
              The watchdog for your team&apos;s apps, people, and sprints.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-sidebar-border">
            {CAPABILITIES.map(({ icon: Icon, title, detail }, index) => (
              <li
                key={title}
                // Staggered off the row index so the list reads top-down
                // rather than all four landing at once.
                style={{ animationDelay: `${220 + index * 70}ms` }}
                className="flex items-start gap-3 py-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-out motion-safe:[animation-fill-mode:backwards]"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{title}</span>
                  <span className="text-sm text-sidebar-foreground/60">{detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Called out as a chip rather than a faint line: it is the one
            instruction on this panel, and at /60 alpha it also sat under the
            AA contrast floor. */}
        <div className="relative flex flex-col gap-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-out motion-safe:[animation-delay:520ms] motion-safe:[animation-fill-mode:backwards]">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1.5 text-xs font-medium text-sidebar-accent-foreground">
            <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
            Internal tool · sign in with your work account
          </p>
          {/* Whose tool this is, on the one screen every user passes through
              and the one Google's reviewer reaches from the consent flow.
              No "by" label: a 11px lowercase word set against a wordmark
              fights it for the baseline and reads as debris at this size. A
              rule and the mark alone say the same thing and sit still. */}
          <div className="border-t border-sidebar-border pt-5">
            <a
              href="https://altavision.lk"
              target="_blank"
              rel="noreferrer"
              aria-label="Alta Vision — opens altavision.lk in a new tab"
              className="inline-flex rounded-md opacity-90 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring motion-reduce:transition-none"
            >
              <AltaVisionLogo className="h-5 w-auto" />
            </a>
          </div>
        </div>
      </aside>

      <div className="relative flex flex-col items-center justify-center gap-6 p-4 py-10 lg:p-10">
        {/* On the form column, not over the brand panel: that panel is
            `hidden lg:flex`, so a control placed there would disappear on
            exactly the phones where someone is most likely to want the dark
            theme. Absolutely positioned so it does not join the centred stack
            and push the card off vertical centre. */}
        <div className="absolute top-3 right-3 lg:top-6 lg:right-6">
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PawPrint className="size-4" aria-hidden />
          </div>
          <span className="font-heading text-lg font-bold tracking-tight">LogPup</span>
        </div>

        <Card className="w-full max-w-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500 motion-safe:ease-out motion-safe:[animation-delay:100ms] motion-safe:[animation-fill-mode:backwards]">
          {/* Set in the same editorial language as /home rather than as a
              generic card header: a mono eyebrow at the tracking the public
              page uses, a heading with the same negative tracking, and a rule
              beneath. The two pages are one product and a person crosses from
              one to the other in a single click — they should not look like
              they were designed by different hands. */}
          <CardHeader className="gap-3">
            <span className="font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">
              Alta Vision · Internal tool
            </span>
            <h1 className="font-heading text-[1.75rem] leading-[1.05] font-bold tracking-[-0.03em]">
              Welcome back
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sign in to pick up where your team left off.
            </p>
            {/* The same left-anchored draw the public page opens with. A
                keyframe with fill-mode `both`, so it settles drawn without any
                JavaScript and needs no observer on a page that has none. */}
            <span
              aria-hidden
              className="rule-draw mt-1 block h-px w-full origin-left bg-border"
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* The caveat comes before the button it is about. Sitting under
                the button it read as an afterthought about something the user
                had already clicked — and this one has to land first, because
                it is the difference between meeting the browser's "unsafe"
                warning prepared or bouncing off it. Set against the page
                rather than in a filled box: a grey panel inside a card is a
                third surface, and at this size the border alone separates it. */}
            <p className="border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground">
              Personal accounts need admin approval. App is still in development, so please click
              unsafe and proceed if you see a warning.
            </p>

            {/* The three methods are rendered HERE, on the server — Google's
                button submits a server action and the password panel is a
                native <details> with no JS behind it — and handed to
                SignInMethods as slots. That component only reorders them, so
                whichever one you used last comes first, wearing a "Last used"
                tag and the filled treatment. With scripting off, or on a first
                visit, this canonical order is exactly what stays on screen. */}
            <SignInMethods
              google={
                <div className="flex flex-col gap-2">
                  <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }) }}>
                    <Button type="submit" size="lg" className="w-full">Continue with Google</Button>
                  </form>

                  {notionConfigured && (
                    <form action={async () => { 'use server'; await signIn('notion', { redirectTo: '/' }) }}>
                      <Button type="submit" size="lg" variant="outline" className="w-full">
                        Continue with Notion
                      </Button>
                    </form>
                  )}
                </div>
              }
              /* One tap for anyone who added a passkey in settings — the fast
                 door after the first sign-in. */
              passkey={<PasskeyLoginButton />}
              password={
                /* Email + password is the fallback, so it starts collapsed
                   rather than filling the card with fields nobody uses first.
                   Native <details> keeps this server-rendered — no JS to
                   hydrate, which is also why it is passed as a slot rather
                   than rebuilt inside the client component. */
                <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 rounded-md py-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                Use email and password
                <ChevronDown
                  aria-hidden
                  className="size-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
                  <div className="pt-3">
                    <PasswordAuth />
                  </div>
                </details>
              }
            />

            {devLoginEmail && (
              <form
                className="border-t pt-3"
                action={async () => { 'use server'; await signIn('credentials', { email: devLoginEmail, redirectTo: '/' }) }}
              >
                <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground">
                  <Wrench aria-hidden /> Dev login · {devLoginEmail}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Google's OAuth review looks for the privacy policy to be reachable
            from wherever consent starts, not only from the marketing page —
            and a signed-out visitor who lands here directly gets the same
            route out to what LogPup is and what it does with their data. */}
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <Link href="/home" className="hover:text-foreground">
            About LogPup
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
        </nav>
      </div>
    </main>
  )
}
