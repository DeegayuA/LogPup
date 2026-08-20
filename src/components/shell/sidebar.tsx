'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PawPrint } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'
import { VersionBadge } from '@/components/shell/version-badge'
import { AltaVisionLogo } from '@/components/brand/alta-vision-logo'
import { InstallButton } from '@/features/pwa/pwa'
import { adminNavItems, navItems } from '@/components/shell/nav-items'
import { settingsNavItem } from '@/features/settings/nav'

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
        <Kbd className="ml-auto hidden border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground/80 group-hover:inline-flex group-focus-visible:inline-flex">
          G {hint}
        </Kbd>
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
      <Kbd className="border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground/80">
        {isMac ? '⌘K' : 'Ctrl K'}
      </Kbd>
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
    <nav
      aria-label="Primary"
      className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col self-start overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
    >
      {/* Branding row. LogPup owns the left edge; the Alta Vision mark — the
          company that builds and operates it — sits at the right edge of the
          same row, small enough to read as attribution rather than as a second
          brand of equal weight. The two are siblings in a flex row, not nested:
          one is an internal Link and one is an external anchor, and an <a>
          inside an <a> is invalid markup. Both are `shrink-0` because the
          sidebar is a fixed w-56 — neither mark may squash the other. */}
      <div className="flex items-center gap-2 px-4 pb-6 pt-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PawPrint className="size-4" aria-hidden />
          </span>
          <span className="font-heading text-base font-bold tracking-tight">LogPup</span>
        </Link>
        <a
          href="https://altavision.lk"
          target="_blank"
          rel="noreferrer"
          aria-label="Alta Vision — opens altavision.lk in a new tab"
          className="ml-auto inline-flex shrink-0 rounded-md opacity-80 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring motion-reduce:transition-none"
        >
          <AltaVisionLogo className="h-3 w-auto" />
        </a>
      </div>

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
        {/* Settings sits after the workspace destinations rather than inside
            navItems, because navItems is shared data about the WORKSPACE and
            this is the one row that is about you. It is still a single
            declaration (features/settings/nav.ts) rendered by both nav
            surfaces through the same NavLink, so the desktop sidebar and the
            mobile sheet cannot drift. */}
        <NavLink
          href={settingsNavItem.href}
          label={settingsNavItem.label}
          icon={settingsNavItem.icon}
          active={pathname.startsWith(settingsNavItem.href)}
        />
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
