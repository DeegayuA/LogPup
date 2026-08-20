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
  role: UserRole
  isAdmin: boolean
  // Passed straight through to MobileNav: below `md` the sheet is the only
  // nav, so a row the sidebar offers and it doesn't is a row that vanishes
  // on a phone.
  canSeeProgress: boolean
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md transition-all">
      {/* Mobile nav drawer button */}
      <div className="md:hidden">
        <MobileNav isAdmin={isAdmin} canSeeProgress={canSeeProgress} />
      </div>

      {/* Centered Command Center Search Trigger */}
      <div className="flex flex-1 justify-center max-w-lg mx-auto">
        <CommandCenterTrigger className="h-9 rounded-xl border-border/80 bg-card/80 shadow-xs hover:border-primary/50 hover:bg-card focus-visible:ring-primary/40" />
      </div>

      {/* Right Action Icons: Notification, Theme, Profile */}
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
