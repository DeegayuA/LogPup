import Link from 'next/link'
import { ChevronsUpDown, LogOut, User } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type AccountUser = {
  name?: string | null
  image?: string | null
  // Job role (users.title) — distinct from the admin/member permission role
  // shown alongside it. Threaded in from the (app) layout's own DB read
  // (see getOwnTitle) rather than the session/JWT, which doesn't carry it.
  title?: string | null
}

/**
 * The one account control in the shell. It lives in the sidebar footer on
 * desktop (`variant="sidebar"` — a named row, since there is room for a name)
 * and in the header on phones (`variant="compact"` — avatar only, because the
 * sidebar is hidden below `md`). Exactly one instance is visible at any width;
 * the menu itself is identical in both.
 *
 * A server component so `signOut` can stay an inline server action — which is
 * why the client Sidebar takes it as a prop rather than importing it.
 */
export function AccountMenu({
  user,
  isAdmin,
  variant = 'compact',
  className,
}: {
  user: AccountUser
  isAdmin: boolean
  variant?: 'compact' | 'sidebar'
  className?: string
}) {
  const initials = (user.name ?? '?').slice(0, 1).toUpperCase()
  const displayName = user.name ?? 'Account'
  const roleLabel = isAdmin ? 'Admin' : 'Member'

  const avatarNode = (
    <Avatar size="sm">
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          variant === 'sidebar' ? (
            <button
              type="button"
              aria-label={`Account menu for ${displayName}`}
              className={cn(
                'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none',
                'transition-colors duration-150 motion-reduce:transition-none',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                'focus-visible:ring-2 focus-visible:ring-sidebar-ring/60',
                'data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground',
                className,
              )}
            >
              {avatarNode}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight">
                  {displayName}
                </span>
                {/* Permission role only — it is the short, load-bearing half of
                    the identity. The job title would truncate at this width, so
                    it lives in the menu instead. */}
                <span className="block truncate text-2xs leading-tight text-sidebar-foreground/70">
                  {roleLabel}
                </span>
              </span>
              <ChevronsUpDown
                aria-hidden
                className="size-3.5 shrink-0 text-sidebar-foreground/60"
              />
            </button>
          ) : (
            <button
              type="button"
              aria-label={`Account menu for ${displayName}`}
              className={cn(
                'flex items-center rounded-full outline-none ring-offset-2 ring-offset-background',
                'transition-[box-shadow] duration-150 motion-reduce:transition-none',
                'hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-ring/50',
                className,
              )}
            >
              {avatarNode}
            </button>
          )
        }
      />
      <DropdownMenuContent
        align={variant === 'sidebar' ? 'start' : 'end'}
        side={variant === 'sidebar' ? 'top' : 'bottom'}
        className="w-60"
      >
        {/* Identity header — avatar, name, and role so the menu confirms
            who you're signed in as before any destructive action. */}
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          {avatarNode}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
            {user.title ? (
              <p className="truncate text-xs text-muted-foreground">{user.title}</p>
            ) : null}
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
  )
}
