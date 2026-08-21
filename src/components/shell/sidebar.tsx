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
import { adminNavItems, navItems, progressNavItem } from '@/components/shell/nav-items'
import { settingsNavItem } from '@/features/settings/nav'

// Exported so MobileNav (the mobile nav sheet) can render the exact same
// link markup for the exact same nav-items.ts data
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
        'group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none',
        active
          ? 'bg-primary/15 text-primary font-semibold shadow-xs ring-1 ring-primary/30'
          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-1 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-primary transition-[opacity,transform] duration-200 motion-reduce:transition-none',
          active ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
        )}
      />
      <Icon className={cn('size-4 shrink-0 transition-colors', active ? 'text-primary' : 'text-sidebar-foreground/70 group-hover:text-sidebar-foreground')} />
      <span className="truncate">{label}</span>
      {hint ? (
        <Kbd className="ml-auto hidden border-sidebar-border bg-sidebar-accent/80 text-sidebar-foreground/80 group-hover:inline-flex group-focus-visible:inline-flex">
          G {hint}
        </Kbd>
      ) : null}
    </Link>
  )
}

/* The ⌘K hint, matching CommandCenterTrigger's chip. Server-rendered as the
   Mac form and corrected after hydration, so the markup is stable either way —
   which is what the eslint-disable below is buying, and the only reason it is
   allowed to stay. */
function CommandHint() {
  const [isMac, setIsMac] = useState(true)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe platform detection
    setIsMac(/Mac|iPhone|iPad/.test(window.navigator.userAgent))
  }, [])

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-2xs text-sidebar-foreground/60">
      <Kbd className="border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground/80">
        {isMac ? '⌘K' : 'Ctrl K'}
      </Kbd>
      <span className="truncate">Search</span>
    </span>
  )
}

export function Sidebar({
  isAdmin,
  canSeeProgress,
  account,
}: {
  isAdmin: boolean
  /* Whether this seat may read somebody else's work log — see
     progressNavItem in nav-items.ts for why /progress is gated on that
     rather than on isAdmin. Resolved once in the (app) layout. */
  canSeeProgress: boolean
  account?: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col self-start overflow-y-auto border-r border-sidebar-border/80 bg-sidebar/95 text-sidebar-foreground backdrop-blur-md md:flex"
    >
      {/* Branding row. LogPup owns the left edge; the Alta Vision mark — the
          company that builds and operates it — sits at the right edge of the
          same row, small enough to read as attribution rather than as a second
          brand of equal weight. The two are SIBLINGS in a flex row, not
          nested: one is an internal Link and one is an external anchor, and an
          <a> inside an <a> is invalid markup. Both are `shrink-0` because the
          sidebar is a fixed w-60 — neither mark may squash the other. */}
      <div className="flex items-center justify-between border-b border-sidebar-border/60 px-4 py-3.5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-90">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <PawPrint className="size-4.5" aria-hidden />
          </span>
          <div className="flex flex-col">
            <span className="font-heading text-sm font-bold tracking-tight">LogPup</span>
            <span className="font-mono text-2xs text-sidebar-foreground/60 leading-none">LogPup 🐾 Ops</span>
          </div>
        </Link>
        <a
          href="https://altavision.lk"
          target="_blank"
          rel="noreferrer"
          aria-label="Alta Vision — opens altavision.lk in a new tab"
          className="inline-flex shrink-0 rounded-md opacity-75 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <AltaVisionLogo className="h-3 w-auto" />
        </a>
      </div>

      {/* Main Navigation Items */}
      <div className="flex flex-col gap-1 px-3 pt-4">
        <div className="px-2 pb-1 font-mono text-2xs font-bold uppercase tracking-widest text-sidebar-foreground/60">
          Workspace
        </div>
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
        {/* Gated on the seat, not on isAdmin — a PM is the reader this page
            was built for, and a member is redirected off it. */}
        {canSeeProgress ? (
          <NavLink
            href={progressNavItem.href}
            label={progressNavItem.label}
            icon={progressNavItem.icon}
            hint={progressNavItem.key}
            active={pathname.startsWith(progressNavItem.href)}
          />
        ) : null}

        {/* Settings sits after the workspace destinations rather than inside
            navItems, because navItems is shared data about the WORKSPACE and
            this is the one row that is about you. It is still a single
            declaration (features/settings/nav.ts) rendered by both nav
            surfaces through the same NavLink, so the desktop sidebar and the
            mobile sheet cannot drift. mobile-nav.tsx points here for this
            reason — keep the two in step. */}
        <NavLink
          href={settingsNavItem.href}
          label={settingsNavItem.label}
          icon={settingsNavItem.icon}
          active={pathname.startsWith(settingsNavItem.href)}
        />
      </div>

      {/* Admin Section */}
      {isAdmin ? (
        <div className="mt-5 flex flex-col gap-1 px-3 pt-3 border-t border-sidebar-border/50">
          <div className="px-2 pb-1 font-mono text-2xs font-bold uppercase tracking-widest text-primary">
            Manage
          </div>
          {adminNavItems.map(({ href, label, icon }) => (
            <NavLink key={href} href={href} label={label} icon={icon} active={pathname.startsWith(href)} />
          ))}
        </div>
      ) : null}

      {/* Workspace footer */}
      <div className="mt-auto flex flex-col gap-2 border-t border-sidebar-border/80 bg-sidebar-accent/20 px-3 py-3">
        <div className="flex items-center gap-1.5">
          {account}
          <InstallButton surface="sidebar" />
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <CommandHint />
          <VersionBadge />
        </div>
      </div>
    </nav>
  )
}
