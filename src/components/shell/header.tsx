import { LogOut } from 'lucide-react'
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

type HeaderUser = {
  name?: string | null
  image?: string | null
}

export function Header({ user }: { user: HeaderUser }) {
  const initials = (user.name ?? '?').slice(0, 1).toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border px-4">
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
