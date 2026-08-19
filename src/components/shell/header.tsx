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
}: {
  user: AccountUser
  // Both, and not one derived from the other: MobileNav gates on the admin
  // family, while AccountMenu names the actual seat.
  role: UserRole
  isAdmin: boolean
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
      {/* On phones the sidebar is hidden, so the brand mark doubles as the nav
          trigger — see MobileNav for the slide-over panel it opens. Above
          `md` the sidebar carries the brand, so the header does not repeat
          it. */}
      <div className="md:hidden">
        <MobileNav isAdmin={isAdmin} />
      </div>
      <div className="flex flex-1 justify-center">
        <CommandCenterTrigger />
      </div>
      {/* Account and install live in the sidebar footer on desktop. Below `md`
          there is no sidebar, so this row carries them instead — one visible
          instance at any width, never both. */}
      <div className="flex items-center gap-0.5">
        <InstallButton className="md:hidden" />
        <NotificationBell />
        <ThemeToggle />
        <span aria-hidden className="mx-1.5 h-5 w-px bg-border md:hidden" />
        <AccountMenu user={user} role={role} variant="compact" className="md:hidden" />
      </div>
    </header>
  )
}
