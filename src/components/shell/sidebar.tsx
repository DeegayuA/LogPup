'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PawPrint } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VersionBadge } from '@/components/shell/version-badge'
import { InstallButton } from '@/features/pwa/pwa'
import { adminNavItems, navItems } from '@/components/shell/nav-items'

// Exported so MobileNav (the mobile nav sheet) can render the exact same
// link markup for the exact same nav-items.ts data — one implementation of
// "what a nav row looks like," not a copy that can drift.
export function NavLink({
  href,
  label,
  icon: Icon,
  active,
  hint,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  hint?: string
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm',
        'transition-colors duration-150',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full transition-opacity duration-150',
          active ? 'bg-primary opacity-100' : 'opacity-0',
        )}
      />
      <Icon className="size-4 shrink-0" />
      {label}
      {hint ? (
        <kbd className="ml-auto hidden font-mono text-2xs text-sidebar-foreground/70 group-hover:inline group-focus-visible:inline">
          G {hint}
        </kbd>
      ) : null}
    </Link>
  )
}

/* The ⌘K hint, matching CommandCenterTrigger's chip. Server-rendered as the
   Mac form and corrected after hydration, so the markup is stable either way. */
function CommandHint() {
  const [isMac, setIsMac] = useState(true)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe platform detection
    setIsMac(/Mac|iPhone|iPad/.test(window.navigator.userAgent))
  }, [])

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-2xs text-sidebar-foreground/70">
      <kbd className="rounded border border-sidebar-border bg-sidebar-accent/60 px-1 py-0.5 font-mono leading-none">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
      <span className="truncate">Fetch anything</span>
    </span>
  )
}

export function Sidebar({
  isAdmin,
  account,
}: {
  isAdmin: boolean
  /* Rendered by the (app) layout so the account menu can stay a server
     component (its sign-out is an inline server action). */
  account?: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col self-start overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-4 pb-6 pt-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <PawPrint className="size-4" aria-hidden />
        </span>
        <span className="font-heading text-base font-bold tracking-tight">LogPup</span>
      </Link>

      <div className="flex flex-col gap-0.5 px-2">
        {navItems.map(({ href, label, icon, key }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            hint={key}
            active={href === '/' ? pathname === '/' : pathname.startsWith(href)}
          />
        ))}
      </div>

      {isAdmin ? (
        <div className="mt-6 flex flex-col gap-0.5 px-2">
          <div className="px-2.5 pb-1 text-2xs font-medium uppercase tracking-wider text-sidebar-foreground/70">
            Manage
          </div>
          {adminNavItems.map(({ href, label, icon }) => (
            <NavLink key={href} href={href} label={label} icon={icon} active={pathname.startsWith(href)} />
          ))}
        </div>
      ) : null}

      {/* Workspace footer: who you are (primary), install (secondary, and only
          when the browser actually offers it), then a single quiet meta line
          for the ⌘K hint and the version. */}
      <div className="mt-auto flex flex-col gap-1 border-t border-sidebar-border px-2 pt-2 pb-2.5">
        <div className="flex items-center gap-1">
          {account}
          <InstallButton surface="sidebar" />
        </div>
        <div className="flex items-center justify-between gap-2 pl-2">
          <CommandHint />
          <VersionBadge />
        </div>
      </div>
    </nav>
  )
}
