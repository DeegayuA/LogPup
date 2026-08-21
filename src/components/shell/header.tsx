import { ThemeToggle } from '@/components/shell/theme-toggle'
import { AccountMenu, type AccountUser } from '@/components/shell/account-menu'
import { MobileNav } from '@/components/shell/mobile-nav'
import { CommandCenterTrigger } from '@/features/search/components/command-center'
import { InstallButton } from '@/features/pwa/pwa'
import { NotificationBell } from '@/features/notifications/components/notification-bell'
import type { UserRole } from '@/features/auth/capabilities'

export function Header({
  user,
  role,
  isAdmin,
  canSeeProgress,
}: {
  user: AccountUser
  // Both, and not one derived from the other: MobileNav gates on the admin
  // family, while AccountMenu names the actual seat. Collapsing them would
  // show a superadmin their own badge as "Admin" — a demotion in the one
  // place that confirms who you are signed in as.
  role: UserRole
  isAdmin: boolean
  // Passed straight through to MobileNav: below `md` the sheet is the only
  // nav, so a row the sidebar offers and it doesn't is a row that vanishes
  // on a phone.
  canSeeProgress: boolean
}) {
  return (
    <header className="sticky top-[var(--maintenance-banner-h,0px)] z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md">
      {/* Mobile nav drawer button */}
      <div className="md:hidden">
        <MobileNav isAdmin={isAdmin} canSeeProgress={canSeeProgress} />
      </div>

      {/* Centered Command Center Search Trigger */}
      <div className="flex flex-1 justify-center max-w-lg mx-auto">
        <CommandCenterTrigger className="h-9 rounded-xl border-border/80 bg-card/80 shadow-xs hover:border-primary/50 hover:bg-card focus-visible:ring-primary/40" />
      </div>

      {/* Account and install live in the sidebar footer on desktop. Below `md`
          there is no sidebar, so this row carries them instead — one visible
          instance at any width, never both. That is what every `md:hidden`
          here is for; removing one duplicates a control rather than revealing
          it. */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        <InstallButton className="md:hidden" />
        <NotificationBell />
        <ThemeToggle />
        <span aria-hidden className="mx-1 h-5 w-px bg-border/60 md:hidden" />
        <AccountMenu user={user} role={role} variant="compact" className="md:hidden" />
      </div>
    </header>
  )
}
