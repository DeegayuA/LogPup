import Link from 'next/link'
import { ArrowUpRight, MapPin, Mail } from 'lucide-react'
import { BrandMark } from '@/components/shell/brand-mark'
import { ThemeToggle } from '@/components/shell/theme-toggle'
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
      {/* Sticky frosted glass header */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md transition-all">
        <div className="mx-auto flex w-full max-w-[76rem] items-center justify-between gap-4 px-6 py-3.5 md:px-10">
          <Link href="/home" aria-label="LogPup home" className="transition-opacity hover:opacity-90">
            <BrandMark />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 text-sm font-medium">
            <Link
              href="/privacy"
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50 text-xs sm:text-sm"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50 text-xs sm:text-sm"
            >
              Terms
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-md bg-primary/10 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in
            </Link>
            <div className="ml-1 pl-1 border-l border-border/60">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Unified Single Footer */}
      <footer className="border-t border-border/70 bg-card/30">
        <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-6 px-6 py-8 md:px-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2.5">
              {/* `self-start` is load-bearing, not spacing. This sits in a
                  `flex flex-col`, whose default `align-items: stretch`
                  overrides `w-auto` and pulls the image to the column's full
                  width while `h-4` holds the height — so the wordmark rendered
                  horizontally stretched. Sizing the item to its content
                  restores the 3774x607 aspect. */}
              <AltaVisionLogo className="h-4 w-auto self-start" />
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                LogPup is an internal engineering operations system built and operated by{' '}
                <strong className="font-medium text-foreground">Alta Vision (Pvt) Ltd</strong>, Colombo, Sri Lanka.
                Not licensed or offered as a public SaaS.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:items-end">
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" />
                <span>Colombo, Sri Lanka</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-primary" />
                <a href="mailto:deeghayus@altavision.lk" className="text-foreground hover:underline">
                  deeghayus@altavision.lk
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start justify-between gap-4 border-t border-border/50 pt-5 sm:flex-row sm:items-center">
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <Link
                href="/privacy"
                className="rounded-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="rounded-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Terms of Service
              </Link>
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="rounded-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Google Permissions ↗
              </a>
            </nav>

            <a
              href="https://deeghayu.netlify.app/"
              target="_blank"
              rel="noreferrer"
              aria-label="Built by Deeghayu — opens deeghayu.netlify.app in a new tab"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground transition-all duration-150 hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Built by Deeghayu
              <ArrowUpRight className="size-3 shrink-0" aria-hidden />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
