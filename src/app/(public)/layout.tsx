import Link from 'next/link'
import { BrandMark } from '@/components/shell/brand-mark'
import { AltaVisionLogo } from '@/components/brand/alta-vision-logo'

/**
 * Shell for the pages that must stay reachable without a session: the public
 * home page, the privacy policy, and the terms of service.
 *
 * These three exist for Google OAuth verification. `calendar.events` is a
 * sensitive scope, so the review team fetches the homepage, privacy policy,
 * and terms URLs directly and rejects the app if any of them redirects to a
 * login screen. That is why `home|privacy|terms` are excluded from the auth
 * matcher in src/proxy.ts — dropping that exclusion silently breaks
 * verification without breaking anything a signed-in user would notice.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 76rem, matching /home's own container. The header and footer used to
          be pinned at max-w-3xl, which left the chrome visibly narrower than
          the page it framed — on a layout whose entire discipline is
          alignment, that reads as an error rather than as a choice. /privacy
          and /terms hold their prose at max-w-3xl inside their own 76rem
          wrapper so they align to the same left edge; a wide masthead over a
          narrow text column is the magazine convention anyway. */}
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[76rem] items-center justify-between gap-4 px-6 py-4 md:px-10">
          <Link href="/home" aria-label="LogPup home">
            <BrandMark />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms
            </Link>
            <Link href="/sign-in" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* The border-t stays. /home closes on its own colophon rule and does
          not need it, but this same footer also terminates /privacy and
          /terms, which have no colophon — dropping it would leave those two
          pages ending on nothing. */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <div className="flex flex-col gap-2">
            <AltaVisionLogo className="h-5 w-auto" />
            <p className="text-xs text-muted-foreground">
              LogPup is built and operated by Alta Vision (Pvt) Ltd, Sri Lanka.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <a href="mailto:deeghayus@altavision.lk" className="hover:text-foreground">
              deeghayus@altavision.lk
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
