import Link from 'next/link'
import { LogOut, PawPrint, User } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { CommandCenterTrigger } from '@/features/search/components/command-center'

type HeaderUser = {
  name?: string | null
  image?: string | null
}

export function Header({ user }: { user: HeaderUser }) {
  const initials = (user.name ?? '?').slice(0, 1).toUpperCase()

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 md:hidden" aria-label="LogPup home">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <PawPrint className="size-3.5" aria-hidden />
        </span>
      </Link>
      <div className="flex flex-1 justify-center">
        <CommandCenterTrigger />
      </div>
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
          <DropdownMenuLabel>{user.name ?? 'Account'}</DropdownMenuLabel>
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
