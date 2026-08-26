'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardCheck,
  PanelLeftClose,
  PanelLeftOpen,
  PawPrint,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'
import { VersionBadge } from '@/components/shell/version-badge'
import { AltaVisionLogo } from '@/components/brand/alta-vision-logo'
import { InstallButton } from '@/features/pwa/pwa'
import { ADMIN_SECTION_ICONS, navItems, progressNavItem } from '@/components/shell/nav-items'
import { SIDEBAR_NAV_ID, sidebarToggleLabel, type SidebarState } from '@/components/shell/sidebar-model'
import { toggleSidebar, useSidebarState } from '@/components/shell/sidebar-store'
import {
  NO_APPROVALS,
  approvalBadgeLabel,
  approvalBadgeText,
  showApprovals,
  type ApprovalCounts,
} from '@/features/admin/approval-badge'
import { settingsNavItem } from '@/features/settings/nav'

// Exported so MobileNav (the mobile nav sheet) can render the exact same
// link markup for the exact same nav-items.ts data
export function NavLink({
  href,
  label,
  icon: Icon,
  active,
  hint,
  badge,
  badgeLabel,
  tone,
  collapsed = false,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  hint?: string
  /** A count worth interrupting for. Absent or '0' renders nothing. */
  badge?: string
  /** What a screen reader hears instead of the bare digit. */
  badgeLabel?: string
  /** 'danger' for the one row that leads somewhere irreversible. */
  tone?: 'danger'
  /**
   * Icon-rail form: the words go `sr-only` rather than away, so the row keeps
   * its accessible name while it stops taking 200px to say it.
   *
   * DEFAULTS TO FALSE so the mobile sheet (mobile-nav.tsx), which renders this
   * same component from the same nav-items.ts data, is untouched by the desktop
   * collapse — it is a full-width panel and has no rail form.
   */
  collapsed?: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      /* Hover tooltip for the rail, and a BONUS only: the label below stays in
         the accessibility tree as sr-only either way, so a screen reader never
         depends on this and a `title` that some browser declines to show costs
         nobody the row's name. */
      title={collapsed ? label : undefined}
      className={cn(
        'group relative flex items-center rounded-xl py-2 text-xs font-medium transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none',
        collapsed ? 'justify-center px-2' : 'gap-2.5 px-3',
        active
          ? 'bg-primary/15 text-primary font-semibold shadow-xs ring-1 ring-primary/30'
          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-primary transition-[opacity,transform] duration-200 motion-reduce:transition-none',
          collapsed ? 'left-0.5' : 'left-1',
          active ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
        )}
      />
      <Icon
        className={cn(
          'size-4 shrink-0 transition-colors',
          tone === 'danger'
            ? 'text-destructive'
            : active
              ? 'text-primary'
              : 'text-sidebar-foreground/70 group-hover:text-sidebar-foreground',
        )}
      />
      {/* sr-only, never `hidden`: an icon rail whose rows have no accessible
          name is a list of unlabelled links. This is the row's name in both
          forms — the rail just stops painting it. */}
      <span
        className={cn(
          collapsed ? 'sr-only' : 'truncate',
          tone === 'danger' && !active && 'text-destructive',
        )}
      >
        {label}
      </span>
      {/* The count wins the right edge when there is one. A badge and a keyboard
          hint competing for the same slot is why the hint yields: the hint is a
          thing you learn once, the count is a thing that changed. */}
      {badge && badge !== '0' ? (
        collapsed ? (
          /* No room for the digit at rail width, and no reason to drop the
             signal with it: a dot says "something is waiting" and the sr-only
             text still says how much of what. Ringed in the sidebar's own
             colour so it reads as a marker on the icon rather than a glyph. */
          <>
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-sidebar"
            />
            <span className="sr-only">{badgeLabel ?? `${badge} waiting`}</span>
          </>
        ) : (
          <span className="ml-auto flex shrink-0 items-center">
            <span
              aria-hidden
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 font-mono text-2xs font-semibold tabular-nums text-primary-foreground"
            >
              {badge}
            </span>
            {/* The digit alone says a number without saying what it counts, and
                position is context a screen reader does not get. */}
            <span className="sr-only">{badgeLabel ?? `${badge} waiting`}</span>
          </span>
        )
      ) : hint && !collapsed ? (
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

/**
 * The collapse switch.
 *
 * A real `<button>`, so Enter and Space work and it is a tab stop without
 * anything being taught to it. It carries the state TWICE on purpose:
 * `aria-expanded` for anything that reports widget state, and an accessible
 * name that changes with it ("Collapse sidebar" / "Expand sidebar") for
 * everything that just reads the name — neither alone survives every
 * combination of browser and screen reader.
 *
 * `aria-controls` points at the `<nav>` this sits inside rather than a sibling
 * region: the rail IS the nav, narrower.
 */
function SidebarToggle({ state }: { state: SidebarState }) {
  const collapsed = state === 'rail'
  const label = sidebarToggleLabel(state)
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-expanded={!collapsed}
      aria-controls={SIDEBAR_NAV_ID}
      aria-label={label}
      title={label}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/60 outline-none transition-colors duration-150 motion-reduce:transition-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/60"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}

export function Sidebar({
  isAdmin,
  canSeeProgress,
  account,
  accountCompact,
  adminSections = [],
  approvals = NO_APPROVALS,
}: {
  isAdmin: boolean
  /* Whether this seat may read somebody else's work log — see
     progressNavItem in nav-items.ts for why /progress is gated on that
     rather than on isAdmin. Resolved once in the (app) layout. */
  canSeeProgress: boolean
  account?: React.ReactNode
  /**
   * The same account control in its avatar-only form, for the rail.
   *
   * A second slot rather than a prop on the first, because AccountMenu is a
   * server component (its sign-out is an inline server action) — this client
   * component cannot re-render it into another variant, it can only choose
   * between two the layout already built. Exactly one is mounted at a time.
   *
   * It must not be dropped on the rail: on desktop the sidebar footer holds
   * the ONLY account menu in the app (the header's copy is `md:hidden`), so a
   * rail without it is a rail you cannot sign out from.
   */
  accountCompact?: React.ReactNode
  /**
   * The admin sections this seat may actually open, already filtered by
   * `visibleSections(actor)` on the server.
   *
   * Passed as data rather than filtered here, because the filter is a
   * capability check and a capability check belongs on the server — a client
   * that decided its own admin nav would be deciding it from whatever the
   * browser was told. Icons join by href (ADMIN_SECTION_ICONS): a React
   * component cannot cross that boundary on the section itself.
   */
  adminSections?: readonly { href: string; label: string; danger?: boolean }[]
  /** How much is waiting on this person, for the Approvals badge. */
  approvals?: ApprovalCounts
}) {
  const pathname = usePathname()
  /* This browser's remembered choice, read through useSyncExternalStore — see
     sidebar-store.ts for why not useState, and for the one-frame trade that
     buys the absence of a hydration mismatch. */
  const sidebarState = useSidebarState()
  const collapsed = sidebarState === 'rail'

  return (
    <nav
      id={SIDEBAR_NAV_ID}
      data-slot="app-sidebar"
      data-state={sidebarState}
      aria-label="Primary"
      className={cn(
        'sticky top-0 hidden h-svh shrink-0 flex-col self-start overflow-y-auto overflow-x-hidden border-r border-sidebar-border/80 bg-sidebar/95 text-sidebar-foreground backdrop-blur-md md:flex',
        /* Width only — never `transition-all`, which would also animate the
           colours the theme switch is already animating. Respecting
           prefers-reduced-motion here is not decoration: this transition moves
           the entire page's left edge. */
        'transition-[width] duration-200 ease-out motion-reduce:transition-none',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Branding row. LogPup owns the left edge; the Alta Vision mark — the
          company that builds and operates it — sits at the right edge of the
          same row, small enough to read as attribution rather than as a second
          brand of equal weight. The two are SIBLINGS in a flex row, not
          nested: one is an internal Link and one is an external anchor, and an
          <a> inside an <a> is invalid markup. Both are `shrink-0` because the
          sidebar is a fixed w-60 — neither mark may squash the other.

          On the rail there is room for exactly one mark, and it is the app's:
          attribution is the thing that yields when a 64px column has to choose. */}
      <div
        className={cn(
          'flex items-center border-b border-sidebar-border/60 py-3.5',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        <Link
          href="/"
          title={collapsed ? 'LogPup' : undefined}
          className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <PawPrint className="size-4.5" aria-hidden />
          </span>
          {/* sr-only on the rail, so the home link keeps a name rather than
              becoming an unlabelled paw. */}
          <div className={cn('flex flex-col', collapsed && 'sr-only')}>
            <span className="font-heading text-sm font-bold tracking-tight">LogPup</span>
            {/* The DESCRIPTOR, not the name. It sits directly under the
                wordmark and beside the paw badge, so repeating either here
                renders the brand three times in a 60px column. */}
            <span className="font-mono text-2xs text-sidebar-foreground/60 leading-none">Ops</span>
          </div>
        </Link>
        {collapsed ? null : (
          <a
            href="https://altavision.lk"
            target="_blank"
            rel="noreferrer"
            aria-label="Alta Vision — opens altavision.lk in a new tab"
            className="inline-flex shrink-0 rounded-md opacity-75 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <AltaVisionLogo className="h-3 w-auto" />
          </a>
        )}
      </div>

      {/* Main Navigation Items */}
      <div className={cn('flex flex-col gap-1 pt-4', collapsed ? 'px-2' : 'px-3')}>
        {/* The section heading shares its row with the collapse switch: at the
            top of the list, where somebody looking for it looks, and without
            spending a row of its own on a control pressed twice a week. The
            heading goes sr-only on the rail and the switch centres in the row
            it leaves behind. */}
        <div
          className={cn(
            'flex items-center px-2 pb-1',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <span
            className={cn(
              'font-mono text-2xs font-bold uppercase tracking-widest text-sidebar-foreground/60',
              collapsed && 'sr-only',
            )}
          >
            Workspace
          </span>
          <SidebarToggle state={sidebarState} />
        </div>
        {navItems.map(({ href, label, icon, key }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            hint={key}
            collapsed={collapsed}
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
            collapsed={collapsed}
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
          collapsed={collapsed}
          active={pathname.startsWith(settingsNavItem.href)}
        />
      </div>

      {/* Approvals for a seat that is NOT an admin.
          A manager can hold `request.review` without holding the admin seat, so
          they never see the Manage block below — and this was the one thing
          they were being asked to act on with nowhere in the nav to act from.
          Shown only when something is actually waiting: a permanent
          "Approvals 0" is how somebody learns to stop reading this column. */}
      {!isAdmin && showApprovals(approvals) ? (
        <div className={cn('flex flex-col gap-1 pt-1', collapsed ? 'px-2' : 'px-3')}>
          <NavLink
            href="/admin/approvals"
            label="Approvals"
            icon={ClipboardCheck}
            collapsed={collapsed}
            active={pathname.startsWith('/admin/approvals')}
            badge={approvalBadgeText(approvals)}
            badgeLabel={approvalBadgeLabel(approvals)}
          />
        </div>
      ) : null}

      {/* Manage — every admin section, not a single "Admin" door.
          The sections used to live in a second sidebar that only appeared once
          you were already inside /admin, which meant every jump between them
          began by going somewhere else first. They are destinations like any
          other, so they are listed like any other. `adminSections` is already
          capability-filtered, so a seat that cannot open Holidays is not
          offered it. */}
      {isAdmin && adminSections.length > 0 ? (
        <div
          className={cn(
            'mt-5 flex flex-col gap-1 pt-3 border-t border-sidebar-border/50',
            collapsed ? 'px-2' : 'px-3',
          )}
        >
          {/* sr-only rather than dropped: the rail still has two groups of
              links in it, and a screen reader is the one reader who cannot see
              the rule that separates them. */}
          <div
            className={cn(
              'px-2 pb-1 font-mono text-2xs font-bold uppercase tracking-widest text-primary',
              collapsed && 'sr-only',
            )}
          >
            Manage
          </div>
          {adminSections
            .filter((section) => !section.danger)
            .map((section) => (
              <NavLink
                key={section.href}
                href={section.href}
                label={section.label}
                icon={ADMIN_SECTION_ICONS[section.href] ?? ShieldCheck}
                collapsed={collapsed}
                // Exact match for the index: `startsWith('/admin')` is true of
                // every section below it, which would light the whole list up.
                active={
                  section.href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(section.href)
                }
                badge={
                  section.href === '/admin/approvals'
                    ? approvalBadgeText(approvals)
                    : undefined
                }
                badgeLabel={
                  section.href === '/admin/approvals'
                    ? approvalBadgeLabel(approvals)
                    : undefined
                }
              />
            ))}

          {/* Below a rule and in the destructive tone, the same separation the
              old admin nav gave it. A row that empties the database must not
              sit flush against the row that lists holidays. */}
          {adminSections
            .filter((section) => section.danger)
            .map((section) => (
              <div key={section.href} className="mt-1 border-t border-sidebar-border/50 pt-1">
                <NavLink
                  href={section.href}
                  label={section.label}
                  icon={ADMIN_SECTION_ICONS[section.href] ?? TriangleAlert}
                  collapsed={collapsed}
                  active={pathname.startsWith(section.href)}
                  tone="danger"
                />
              </div>
            ))}
        </div>
      ) : null}

      {/* Workspace footer */}
      <div
        className={cn(
          'mt-auto flex flex-col gap-2 border-t border-sidebar-border/80 bg-sidebar-accent/20 py-3',
          collapsed ? 'items-center px-2' : 'px-3',
        )}
      >
        <div className={cn('flex items-center gap-1.5', collapsed && 'flex-col')}>
          {collapsed ? (accountCompact ?? account) : account}
          <InstallButton surface="sidebar" />
        </div>
        {/* Both of these are legible-width things — a ⌘K chip with the word
            "Search" beside it, and a version string. Neither survives 64px, and
            neither is load-bearing enough to redesign for the rail: expanding
            brings them back, and the palette they advertise is still one
            keystroke away with nothing on screen at all. */}
        {collapsed ? null : (
          <div className="flex items-center justify-between gap-2 px-1">
            <CommandHint />
            <VersionBadge />
          </div>
        )}
      </div>
    </nav>
  )
}
