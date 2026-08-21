import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bot, Info, LogOut, Sparkles, SquareArrowOutUpRight, UserRound } from 'lucide-react'
import { getSession } from '@/lib/session'
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
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { getOwnAvatarUrl, getOwnTitle } from '@/features/auth/queries'
import {
  listGeminiKeys,
  listPoolKeyHealth,
  sharedKeyUsageByCaller,
} from '@/features/gemini/queries'
import { assessRecordingReadiness } from '@/features/gemini/readiness'
import { AiFeaturesCard } from '@/features/gemini/components/ai-features-card'
import { GeminiKeysCard } from '@/features/gemini/components/gemini-keys-card'
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
 * The AI setup loop lives here WHOLE: the readiness verdict, the keys that
 * fix a "Not ready" verdict, and the per-feature switches, top to bottom.
 * It used to be split — verdict and switches here, keys at the foot of
 * /profile — which turned "paste one key" into nav → read verdict → follow a
 * link → land under the sticky header → scroll. /profile keeps what you EDIT
 * about your identity (avatar, phone, password, passkeys) and a pointer stub
 * at /profile#gemini for old deep links.
 *
 * The Gemini key actions still revalidate /profile (their historical home,
 * frozen elsewhere), so GeminiKeysCard refreshes the router itself after
 * every successful write — see the note in that component.
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

const USAGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export default async function SettingsPage() {
  const session = await getSession()
  const user = session?.user
  // The (app) layout and the proxy both gate this already; this narrows the
  // types honestly rather than scattering `?.` through the render.
  if (!user?.id) redirect('/sign-in')

  const now = new Date()
  const [geminiKeys, poolKeys, avatarUrl, title, usedBy] = await Promise.all([
    listGeminiKeys(user.id),
    listPoolKeyHealth(user.id),
    getOwnAvatarUrl(user.id),
    getOwnTitle(user.id),
    sharedKeyUsageByCaller(user.id, new Date(now.getTime() - USAGE_WINDOW_MS)),
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
  // readiness.ts (frozen) still words its blocked-state advice for the era
  // when the key form lived on /profile. The form is now the very next card,
  // so the destination is re-pointed at render time; if the upstream sentence
  // ever changes, the original text shows unmodified rather than mangled.
  const advice =
    readiness.advice?.replace('Add a key in Profile → Gemini API keys.', 'Add a key below.') ??
    null
  const liveEnabled = isLiveTranscriptionEnabled()
  const release = findRelease(CURRENT_VERSION, VERSION_HISTORY)
  const roleName = roleLabel(user.role)
  const initials = (user.name ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="relative flex flex-1 flex-col p-4 sm:p-6 md:p-8 overflow-hidden">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-[450px] w-[600px] rounded-full bg-primary/8 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 -left-40 -z-10 h-[400px] w-[500px] rounded-full bg-chart-1/5 blur-3xl"
        aria-hidden
      />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageHeader
          title="Account &amp; LogPup 🐾 Settings"
          description="How LogPup behaves for you. Nothing here changes anything for your teammates."
        />

        {/* 1. Who you are. Read-only on purpose: every one of these fields
            already has exactly one editor (Profile for the avatar, Admin →
            Users for name, email, and job role), and a second one here would
            be a second thing to keep in step. */}
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <UserRound className="size-4 shrink-0" aria-hidden />
              You
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

        {/* 2. Appearance. Client component: the choice lives in
            localStorage, not the database. */}
        <AppearanceCard />

        {/* 3. AI, whole: verdict → the keys that change the verdict → the
            per-feature switches those keys unlock. Top to bottom, one page. */}
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <Bot className="size-4 shrink-0" aria-hidden />
              AI &amp; voice
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
                    never appears in the readiness pool's wording. */}
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {geminiKeys.length} key{geminiKeys.length === 1 ? '' : 's'} of your own
                </span>
              </div>
              <p className="text-sm">{readiness.headline}</p>
              {advice ? <p className="text-sm text-muted-foreground">{advice}</p> : null}
              {/* Running on a teammate's shared key is a data-custody fact,
                  not a detail: their Google project processes this user's
                  recordings and pays for any paid usage. Said here because
                  the verdict above can read "Ready" while every key serving
                  it belongs to someone else. */}
              {geminiKeys.length === 0 && readiness.level !== 'blocked' ? (
                <p className="text-sm text-muted-foreground">
                  Your AI is running on a teammate&rsquo;s org-shared key, so their Google
                  project processes your recordings and pays for any paid usage. Add your own
                  key below to stop drawing on theirs.
                </p>
              ) : null}
            </div>

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
          </CardContent>
        </Card>

        {/* 3b. The keys themselves — the control that changes the verdict
            above, directly under it instead of at the end of another page.
            `id` is a link target, not decoration: the palette's "Manage Gemini
            keys" row lands on /settings#gemini, and most of that row's value is
            arriving AT the card rather than at the top of a long page.
            scroll-mt clears the sticky header, which would otherwise cover the
            thing the fragment just scrolled to. */}
        <div id="gemini" className="scroll-mt-20">
          <GeminiKeysCard keys={geminiKeys} usedBy={usedBy} />
        </div>

        {/* 3c. AI features hub: per-feature costs, 30-day measured usage, and
            the on/off switch for each. Suspense-split: it runs its own three
            reads, and the rest of the page shouldn't wait on them. */}
        {/* The id lives on the wrapper rather than inside the Suspense child,
            so the fragment resolves during the fallback too — an anchor that
            only exists after the data lands is an anchor that misses on a cold
            navigation, which is exactly when someone follows a palette row. */}
        <div id="ai-features" className="scroll-mt-20">
          <Suspense fallback={<AiFeaturesCardSkeleton />}>
            <AiFeaturesCard userId={user.id} />
          </Suspense>
        </div>

        {/* 4. About. The version had exactly one home — the desktop sidebar
            footer, which is `hidden md:flex` — so on a phone there was no way
            to answer "which build am I on?" at all. It now appears in the
            mobile nav sheet too; this is the roomy version, with the date and
            what actually changed. */}
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <Info className="size-4 shrink-0" aria-hidden />
              About LogPup
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
            <CardTitle as="h2" className="flex items-center gap-2">
              <LogOut className="size-4 shrink-0" aria-hidden />
              Account
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
          holds your avatar, phone number, password and passkeys.
        </p>
      </div>
    </div>
  )
}

/** Shape-matched fallback for the AI features card while its three reads run:
 *  same Card, same title, summary-grid and row silhouettes — no jump on swap. */
function AiFeaturesCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 font-heading">
          <Sparkles className="size-4" aria-hidden /> AI features
        </CardTitle>
        <CardDescription>
          <span className="sr-only" role="status">
            Loading your AI feature usage…
          </span>
          <Skeleton aria-hidden className="h-4 w-64 max-w-full" />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4" aria-hidden>
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 py-1">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-8 w-full sm:w-56" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
