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
      <InstallButton />
      <NotificationBell />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <Avatar size="sm">
                {user.image ? <AvatarImage src={user.image} alt={user.name ?? ''} /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          }
        />
        <DropdownMenuContent align="end">
          {/* Plain div: Base UI's GroupLabel primitive now requires a Menu.Group parent. */}
          <div className="px-2 py-1.5 text-sm font-medium">{user.name ?? 'Account'}</div>
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
              render={<button type="submit" className="w-full" />}
            >
              <LogOut /> Sign out
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
