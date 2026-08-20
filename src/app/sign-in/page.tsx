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
  Sparkles,
  Lock,
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

/* `absolute`, because the root layout sets template: "%s · LogPup"
   (src/app/layout.tsx) and a bare string opts into it — this title already
   ends in the product name, so the tab read "Sign in — LogPup · LogPup".
   The same doubling /home guards against, for the same reason: Google's brand
   verification compares the title against the name on the consent screen, and
   this is the page that consent flow actually lands on. */
export const metadata = { title: { absolute: 'Sign in — LogPup' } }

const CAPABILITIES = [
  { icon: AppWindow, title: 'App Portfolio', detail: 'Technical specs, repo links, sprint health, and team assignments.' },
  { icon: Users, title: 'People & Capacity', detail: 'Real-time allocation radar with automatic 80% and 100% overload protection.' },
  { icon: SquareKanban, title: 'Sprint Kanban', detail: 'Role-guarded kanban boards, roadmap timelines, and 1-way Notion sync.' },
  { icon: CalendarDays, title: 'Meeting Intelligence', detail: 'Google Calendar sync, bilingual Gemini 2.5 transcripts, and action items.' },
] as const

const notionConfigured = !!process.env.NOTION_OAUTH_CLIENT_ID && !!process.env.NOTION_OAUTH_CLIENT_SECRET
const googleClientId = process.env.AUTH_GOOGLE_ID
const devLoginEmail =
  process.env.NODE_ENV !== 'production' ? process.env.DEV_LOGIN_EMAIL : undefined

export default function SignInPage() {
  return (
    <main className="relative grid min-h-screen lg:grid-cols-2 overflow-hidden bg-background">
      {/* Drop any stale cache from previous sessions */}
      <ClearCachedShell />

      {/* Google One-Tap floating prompt when client ID is available */}
      {googleClientId ? <GoogleOneTap clientId={googleClientId} /> : null}

      {/* Ambient background glow effects */}
      <div
        className="pointer-events-none absolute -top-40 left-1/4 -z-10 h-[500px] w-[600px] rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-10 -z-10 h-[400px] w-[500px] rounded-full bg-chart-1/10 blur-3xl"
        aria-hidden
      />

      {/* ========================================================================= */}
      {/* LEFT SIDEBAR: Brand, Capabilities & Security Proof                        */}
      {/* ========================================================================= */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-sidebar-border bg-sidebar/60 p-10 text-sidebar-foreground backdrop-blur-xl lg:flex">
        <SignInBackdrop />

        {/* Top: LogPup Brand Header */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-500">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <PawPrint className="size-5" aria-hidden />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-xl font-bold tracking-tight text-sidebar-foreground">LogPup</span>
              <span className="font-mono text-2xs text-sidebar-foreground/60">v0.0.330</span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar-accent/50 px-3 py-1 font-mono text-2xs font-medium text-primary">
            <Sparkles className="size-3 text-primary" /> Internal Studio Engine
          </span>
        </div>

        {/* Middle: Headline & 4 Feature Tiles */}
        <div className="relative my-auto flex max-w-lg flex-col gap-8 py-8">
          <div className="flex flex-col gap-3.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500">
            <span className="font-mono text-2xs tracking-widest text-primary uppercase font-bold">
              Alta Vision Operations
            </span>
            <h2 className="font-heading text-3xl font-extrabold tracking-tight leading-[1.1] sm:text-4xl text-sidebar-foreground">
              The watchdog for your team&apos;s{' '}
              <span className="bg-gradient-to-r from-primary via-emerald-400 to-chart-1 bg-clip-text text-transparent">
                apps, people, and sprints.
              </span>
            </h2>
            <p className="text-sm leading-relaxed text-sidebar-foreground/70">
              A unified ledger tracking who builds what, sprint velocity, daily capacity, and AI-transcribed meeting decisions.
            </p>
          </div>

          <div className="grid gap-2.5">
            {CAPABILITIES.map(({ icon: Icon, title, detail }, index) => (
              <div
                key={title}
                style={{ animationDelay: `${150 + index * 60}ms` }}
                className="flex items-start gap-3 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/30 p-3 backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-sidebar-accent/50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-fill-mode:backwards]"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-sidebar-foreground">{title}</span>
                  <span className="text-2xs text-sidebar-foreground/60 leading-relaxed">{detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Internal Tool Shield & Operator Wordmark */}
        <div className="relative flex flex-col gap-4 border-t border-sidebar-border/70 pt-6">
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/60 px-3 py-1 text-2xs font-medium text-sidebar-accent-foreground">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden />
              <span>Restricted to authorized <strong className="text-sidebar-foreground">@altavision.lk</strong> accounts</span>
            </p>
          </div>

          <div className="flex items-center justify-between">
            <a
              href="https://altavision.lk"
              target="_blank"
              rel="noreferrer"
              aria-label="Alta Vision — opens altavision.lk in a new tab"
              className="inline-flex rounded-md opacity-90 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <AltaVisionLogo className="h-4.5 w-auto" />
            </a>
            <span className="font-mono text-2xs text-sidebar-foreground/50">Colombo, Sri Lanka</span>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* RIGHT AUTH PANEL: Glassmorphism Card & Login Methods                      */}
      {/* ========================================================================= */}
      <div className="relative flex flex-col items-center justify-center gap-6 p-6 py-12 lg:p-12">
        {/* Top Right Theme Toggle */}
        <div className="absolute top-4 right-4 lg:top-6 lg:right-6">
          <ThemeToggle />
        </div>

        {/* Mobile Header Logo */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <PawPrint className="size-4.5" aria-hidden />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight text-foreground">LogPup</span>
        </div>

        {/* Auth Glassmorphism Card */}
        <Card className="w-full max-w-md rounded-2xl border border-border/80 bg-card/75 p-2 shadow-2xl backdrop-blur-xl dark:border-border/60 dark:bg-card/50 dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500">
          <CardHeader className="gap-2.5 pb-4 pt-4 px-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xs font-bold tracking-widest text-primary uppercase">
                Alta Vision &bull; Access
              </span>
              <Lock className="size-3.5 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome back
            </h1>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Sign in with your approved Google Workspace account to access your studio workspace.
            </p>
          </CardHeader>

          <CardContent className="flex flex-col gap-5 px-6 pb-6">
            {/* Development Environment Alert */}
            <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-primary mt-0.5" />
              <span>
                Personal accounts require admin activation. If you see Google&apos;s unverified app screen during development, click <strong>Advanced &rarr; Proceed</strong>.
              </span>
            </div>

            {/* Authentication Methods Component */}
            <SignInMethods
              google={
                <div className="flex flex-col gap-2.5">
                  <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }) }}>
                    <Button
                      type="submit"
                      size="lg"
                      className="group w-full h-11 text-sm font-semibold shadow-md transition-all duration-200 hover:shadow-primary/25 hover:shadow-lg cursor-pointer"
                    >
                      Continue with Google Workspace
                    </Button>
                  </form>

                  {notionConfigured && (
                    <form action={async () => { 'use server'; await signIn('notion', { redirectTo: '/' }) }}>
                      <Button
                        type="submit"
                        size="lg"
                        variant="outline"
                        className="w-full h-11 text-sm font-medium border-border/80 hover:bg-muted/60 cursor-pointer"
                      >
                        Continue with Notion
                      </Button>
                    </form>
                  )}
                </div>
              }
              passkey={<PasskeyLoginButton />}
              password={
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <span>Use email and password credentials</span>
                    <ChevronDown
                      aria-hidden
                      className="size-3.5 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                    />
                  </summary>
                  <div className="pt-3">
                    <PasswordAuth />
                  </div>
                </details>
              }
            />

            {/* Local Dev Login Quick-Bypass */}
            {devLoginEmail && (
              <form
                className="border-t border-border/60 pt-3"
                action={async () => { 'use server'; await signIn('credentials', { email: devLoginEmail, redirectTo: '/' }) }}
              >
                <Button type="submit" variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
                  <Wrench className="size-3.5 mr-1" aria-hidden /> Dev login &bull; {devLoginEmail}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Footer Navigation & Legal Links */}
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Link href="/home" className="hover:text-foreground transition-colors">
            Home Overview
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
        </nav>
      </div>
    </main>
  )
}
