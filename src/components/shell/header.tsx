import Link from 'next/link'
import {
  AppWindow,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  PawPrint,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'
import { signOut } from '@/lib/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { CommandCenterTrigger } from '@/features/search/components/command-center'
import { InstallButton } from '@/features/pwa/pwa'
import { NotificationBell } from '@/features/notifications/components/notification-bell'

type HeaderUser = {
  name?: string | null
  image?: string | null
}

export function Header({ user, isAdmin }: { user: HeaderUser; isAdmin: boolean }) {
  const initials = (user.name ?? '?').slice(0, 1).toUpperCase()

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
      {/* On phones the sidebar is hidden, so the brand mark doubles as the nav menu. */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
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
      {/* Desktop brand (sidebar carries it on mobile). */}
      <Link href="/" className="hidden items-center gap-2 md:flex">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <PawPrint className="size-4" aria-hidden />
        </span>
        <span className="font-heading text-lg font-semibold tracking-tight">LogPup</span>
      </Link>
      <div className="flex flex-1 justify-center">
        <CommandCenterTrigger />
      </div>
      {/* One control cluster: the install prompt, then icon actions, then a
          hairline divider, then the account avatar — evenly spaced so the row
          reads as a single group rather than four loose buttons. */}
      <div className="flex items-center gap-0.5">
        <InstallButton />
        <NotificationBell />
        <ThemeToggle />
        <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                aria-label="Account menu"
                className="flex items-center rounded-full outline-none ring-offset-2 ring-offset-background transition-[box-shadow] hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Avatar size="sm">
                  {user.image ? <AvatarImage src={user.image} alt={user.name ?? ''} /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-60">
            {/* Identity header — avatar, name, and role so the menu confirms
                who you're signed in as before any destructive action. */}
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <Avatar size="sm">
                {user.image ? <AvatarImage src={user.image} alt={user.name ?? ''} /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name ?? 'Account'}</p>
                <p className="text-xs text-muted-foreground">{isAdmin ? 'Admin' : 'Member'}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>
              <User /> Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/sign-in' })
              }}
            >
              <DropdownMenuItem
                nativeButton
                closeOnClick={false}
                variant="destructive"
                render={<button type="submit" className="w-full" />}
              >
                <LogOut /> Sign out
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
