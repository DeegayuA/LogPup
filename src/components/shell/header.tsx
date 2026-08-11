import Link from 'next/link'
import {
  AppWindow,
  CalendarDays,
  LayoutDashboard,
  PawPrint,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { AccountMenu, type AccountUser } from '@/components/shell/account-menu'
import { CommandCenterTrigger } from '@/features/search/components/command-center'
import { InstallButton } from '@/features/pwa/pwa'
import { NotificationBell } from '@/features/notifications/components/notification-bell'

export function Header({ user, isAdmin }: { user: AccountUser; isAdmin: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
      {/* On phones the sidebar is hidden, so the brand mark doubles as the nav
          menu. Above `md` the sidebar carries the brand, so the header does
          not repeat it. */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Open navigation"
                className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <PawPrint className="size-4" aria-hidden />
              </button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem render={<Link href="/" />}>
              <LayoutDashboard /> Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/apps" />}>
              <AppWindow /> Apps
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/people" />}>
              <Users /> People
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/meetings" />}>
              <CalendarDays /> Meetings
            </DropdownMenuItem>
            {isAdmin ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/admin" />}>
                  <ShieldCheck /> Admin
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
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
        <AccountMenu user={user} isAdmin={isAdmin} variant="compact" className="md:hidden" />
      </div>
    </header>
  )
}
