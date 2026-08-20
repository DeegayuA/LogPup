import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
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
            {/* Last in the row, after the destinations: this is a preference,
                not a place to go. Lives in the shared header rather than on
                /home so /privacy and /terms — the two other pages a signed-out
                reader can reach — get it from the same declaration. */}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* The border-t stays. /home closes on its own colophon rule and does
          not need it, but this same footer also terminates /privacy and
          /terms, which have no colophon — dropping it would leave those two
          pages ending on nothing. */}
      <footer className="border-t border-border">
        {/* `items-end`, not `items-center`: the left column is a mark over a
            sentence and the right is a row of links, so centring aligns a text
            baseline against the middle of a stacked block and neither edge
            lines up with anything. Ending both columns on the same line gives
            the footer one baseline to sit on. */}
        <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-6 px-6 py-8 sm:flex-row sm:items-end sm:justify-between md:px-10">
          <div className="flex flex-col gap-2.5">
            {/* h-4 rather than h-5. At the footer's 12px body size a 20px mark
                is the loudest thing on the closing line, which puts the
                operator's logo above the operator's sentence in emphasis. */}
            {/* `self-start` is load-bearing, not spacing. This sits in a
                `flex flex-col`, whose default `align-items: stretch` overrides
                `w-auto` and pulls the image to the column's full width while
                `h-4` holds the height — so the wordmark rendered horizontally
                stretched. Sizing the item to its content restores the 3774x607
                aspect. */}
            <AltaVisionLogo className="h-4 w-auto self-start" />
            <p className="max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
              LogPup is built and operated by Alta Vision (Pvt) Ltd, Sri Lanka.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <Link
                href="/privacy"
                className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Terms of Service
              </Link>
            </nav>

            {/* Separated from the three links rather than becoming a fourth:
                those are obligations of the operator — two of them are exactly
                what Google's review fetches — and a personal site is a
                different kind of thing. An anchor styled as a button, never a
                <button>, because this navigates; same reasoning as the home
                page's CTAs. `rel="noreferrer"` matches the existing external
                link on the sign-in panel, and the label says where it goes and
                that it leaves this tab. */}
            <a
              href="https://deeghayu.netlify.app/"
              target="_blank"
              rel="noreferrer"
              aria-label="Built by Deeghayu — opens deeghayu.netlify.app in a new tab"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:border-ring/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
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
