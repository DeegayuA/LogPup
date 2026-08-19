import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bot, Info, LogOut, PawPrint, SquareArrowOutUpRight, UserRound } from 'lucide-react'
import { getSession } from '@/lib/session'
import { listPasskeys } from '@/features/auth/webauthn-actions'
import { PasskeysCard } from '@/features/auth/components/passkeys-card'
import { signOut } from '@/lib/auth'
import { CURRENT_VERSION, VERSION_HISTORY } from '@/lib/changelog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getOwnAvatarUrl, getOwnTitle } from '@/features/auth/queries'
import { listGeminiKeys, listPoolKeyHealth } from '@/features/gemini/queries'
import { assessRecordingReadiness } from '@/features/gemini/readiness'
import { AiFeaturesCard } from '@/features/gemini/components/ai-features-card'
import { isLiveTranscriptionEnabled } from '@/features/transcription/flag'
import { AppearanceCard } from '@/features/settings/components/appearance-card'
import { describeAiStatus, findRelease } from '@/features/settings/overview'
import { isAdminRole, roleLabel } from '@/features/auth/capabilities'
import { LK_TIMEZONE } from '@/lib/lk-holidays'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Your theme, your AI keys, your account, and which build of LogPup you are on.',
}

/**
 * Everything that is true of YOU rather than of the workspace, on one page.
 *
 * Deliberately not a second Profile. /profile owns the fields you EDIT about
 * yourself (avatar, phone, password, Gemini keys); this owns the things that
 * decide how the app behaves for you and the facts you occasionally need to
 * read off it — the theme choice the header toggle can't fully express, an
 * honest answer to "is my AI set up", and the version, which until now was
 * only ever rendered in the desktop sidebar footer and so was invisible on a
 * phone.
 *
 * Where a control already exists elsewhere this page LINKS to it instead of
 * growing a second copy: two forms writing one column is how they drift, and
 * the Gemini actions revalidate `/profile` specifically, so a duplicate form
 * here would show stale rows straight after a write.
 */
/**
 * "20 Aug 2026, 14:32" in Asia/Colombo.
 *
 * Explicit timeZone, never the server's: this renders on Vercel in UTC, where
 * a build shipped at 00:36 Colombo would otherwise be reported as the previous
 * evening — and this card exists so a person can tell an admin exactly which
 * build they saw.
 */
function formatBuildStamp(at: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LK_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(at))
}

export default async function SettingsPage() {
  const session = await getSession()
  const user = session?.user
  // The (app) layout and the proxy both gate this already; this narrows the
  // types honestly rather than scattering `?.` through the render.
  if (!user?.id) redirect('/sign-in')

  // Server-fetched so the card opens populated — no client waterfall.
  const passkeysRes = await listPasskeys()
  const passkeys = passkeysRes.ok ? passkeysRes.data : []

  const [geminiKeys, poolKeys, avatarUrl, title] = await Promise.all([
    listGeminiKeys(user.id),
    listPoolKeyHealth(user.id),
    getOwnAvatarUrl(user.id),
    getOwnTitle(user.id),
  ])

  // Two row sets, two different questions, deliberately not interchangeable.
  // `poolKeys` answers "can my AI run?" and must be the POOL — own keys plus
  // teammates' active shared ones — because that is what a call actually draws
  // on; assessing readiness over own keys alone told a user on a teammate's
  // shared key "no key is active" while the recording panel, one click away,
  // said "one key, working" and was right. `geminiKeys` stays own-keys-only:
  // it is the count of keys this person can actually manage.
  const readiness = assessRecordingReadiness(poolKeys)
  const status = describeAiStatus(readiness.level)
  const liveEnabled = isLiveTranscriptionEnabled()
  const release = findRelease(CURRENT_VERSION, VERSION_HISTORY)
  const roleName = roleLabel(user.role)
  const initials = (user.name ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            How LogPup behaves for you. Nothing here changes anything for your teammates.
          </p>
        </div>

        {/* 1. Who you are. Read-only on purpose: every one of these fields
            already has exactly one editor (Profile for the avatar, Admin →
            Users for name, email, and job role), and a second one here would
            be a second thing to keep in step. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4 shrink-0" aria-hidden />
              <h2>You</h2>
            </CardTitle>
            <CardDescription>
              What teammates see next to your name across the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-base leading-tight font-semibold">
                    {user.name ?? '—'}
                  </span>
                  <Badge variant={isAdminRole(user.role) ? 'default' : 'secondary'}>
                    {roleName}
                  </Badge>
                </div>
                {/* An address is a data value: mono so the dots and dashes
                    stay legible, and truncated rather than wrapped so a long
                    one can't push the card sideways at 360px. */}
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {user.email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {title ?? 'No job role set — an admin adds it from Admin → Users.'}
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="self-start" render={<Link href="/profile" />}>
              <UserRound /> Edit profile
            </Button>
          </CardContent>
        </Card>

        {/* 2. Appearance — the only control on this page that is actually new
            rather than gathered. Client component: the choice lives in
            localStorage, not the database. */}
        <AppearanceCard />

        {/* Passkeys: the faster door in after the first sign-in. */}
        <PasskeysCard initial={passkeys} />

        {/* 3. AI & voice. A read-out, not a form — the keys themselves are
            managed on Profile (see the note in this file's doc comment). */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 shrink-0" aria-hidden />
              <h2>AI &amp; voice</h2>
            </CardTitle>
            <CardDescription>
              Transcription, meeting notes and read-aloud run on your own Gemini keys first,
              then on any key a teammate has shared with the org.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* The word carries the state; the badge colour only
                    reinforces it (WCAG 1.4.1). */}
                <Badge variant={status.variant}>{status.word}</Badge>
                {/* "of your own" because the verdict beside it can be carried
                    by a teammate's shared key that is not in this count and
                    never appears on this page. */}
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {geminiKeys.length} key{geminiKeys.length === 1 ? '' : 's'} of your own
                </span>
              </div>
              <p className="text-sm">{readiness.headline}</p>
              {readiness.advice ? (
                <p className="text-sm text-muted-foreground">{readiness.advice}</p>
              ) : null}
            </div>

            {/* Own-keys empty state, but it has to agree with the pool-aware
                verdict above it: someone running on a teammate's shared key
                has no key here and yet nothing is waiting for them, so the
                "only the transcript waits" line would be simply untrue. */}
            {geminiKeys.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <PawPrint className="size-5 text-muted-foreground/60" aria-hidden />
                <p className="text-sm font-medium">
                  {readiness.level === 'blocked' ? 'No Gemini key yet.' : 'No key of your own yet.'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {readiness.level === 'blocked'
                    ? 'Create a free one in Google AI Studio, then paste it into Profile → Gemini API keys. Recording works without it; only the transcript waits.'
                    : 'Your AI is running on a teammate’s org-shared key, so their Google project processes your recordings and pays for any paid usage. Add your own in Profile → Gemini API keys to stop drawing on theirs.'}
                </p>
              </div>
            ) : null}

            <dl className="flex flex-col gap-2 border-t border-border pt-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Live transcription</dt>
                {/* Build-level, not per-user: NEXT_PUBLIC_GEMINI_LIVE_TRANSCRIPTION
                    is baked in at build time, so this is a fact to report
                    rather than a switch to offer. Saying so beats a disabled
                    toggle nobody can explain. */}
                <dd className="font-medium">
                  {liveEnabled ? 'On for this build' : 'Off for this build'}
                </dd>
              </div>
            </dl>

            <Button variant="outline" size="sm" className="self-start" render={<Link href="/profile#gemini" />}>
              Manage Gemini keys
            </Button>
          </CardContent>
        </Card>

        {/* 3b. AI features hub. Complements the AI & voice card above: that
            one is a readiness read-out, this is the per-feature registry —
            costs, 30-day measured usage, and the on/off switch for each. */}
        <AiFeaturesCard userId={user.id} />

        {/* 4. About. The version had exactly one home — the desktop sidebar
            footer, which is `hidden md:flex` — so on a phone there was no way
            to answer "which build am I on?" at all. It now appears in the
            mobile nav sheet too; this is the roomy version, with the date and
            what actually changed. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-4 shrink-0" aria-hidden />
              <h2>About LogPup</h2>
            </CardTitle>
            <CardDescription>
              Handy when you report something — an admin can tell which build you saw it on.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Version</dt>
                <dd className="font-mono tabular-nums">{CURRENT_VERSION}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Released</dt>
                {/* Date AND time, in Asia/Colombo like every other instant
                    here. Several builds ship on one day, so a bare date does
                    not identify the one somebody is looking at — which is the
                    entire purpose of this card. */}
                <dd className="font-mono tabular-nums">
                  {release ? formatBuildStamp(release.at) : 'Unknown'}
                </dd>
              </div>
              {release ? (
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">Commit</dt>
                  <dd className="font-mono text-xs">{release.hash}</dd>
                </div>
              ) : null}
              {release ? (
                <div className="flex flex-col gap-1 border-t border-border pt-2">
                  <dt className="text-muted-foreground">What changed</dt>
                  {/* A commit subject can be arbitrarily long and has no
                      spaces to break on in the worst case — its own scroller,
                      so it can never widen the page at 360px. */}
                  <dd className="overflow-x-auto text-sm">
                    <span className="whitespace-nowrap">{release.change}</span>
                  </dd>
                </div>
              ) : (
                <div className="flex flex-col gap-1 border-t border-border pt-2">
                  <dt className="text-muted-foreground">What changed</dt>
                  <dd className="text-xs text-muted-foreground">
                    The changelog for this build wasn&apos;t generated, so there is no
                    release note to show. The version above is still correct.
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* 5. Account. Last, because it is the destructive one. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogOut className="size-4 shrink-0" aria-hidden />
              <h2>Account</h2>
            </CardTitle>
            <CardDescription>
              Signing out ends this session on this device only. Nothing you have recorded
              or written is removed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Signed in as{' '}
              <span className="font-mono text-xs text-foreground">{user.email}</span>
            </p>
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/sign-in' })
              }}
            >
              <Button type="submit" variant="destructive" size="sm">
                <LogOut /> Sign out
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Looking for something else?{' '}
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
          >
            Profile <SquareArrowOutUpRight className="size-3" aria-hidden />
          </Link>{' '}
          holds your avatar, phone number, password and Gemini keys.
        </p>
      </div>
    </div>
  )
}
