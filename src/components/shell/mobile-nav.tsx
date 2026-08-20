'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { PawPrint, XIcon } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { NavLink } from '@/components/shell/sidebar'
import { AltaVisionLogo } from '@/components/brand/alta-vision-logo'
import { VersionBadge } from '@/components/shell/version-badge'
import { adminNavItems, navItems } from '@/components/shell/nav-items'
import { settingsNavItem } from '@/features/settings/nav'

/**
 * Mobile navigation. Below `md` the persistent Sidebar is hidden entirely
 * (`hidden md:flex` in sidebar.tsx), so without a replacement the app would
 * have no `<nav>` landmark reachable on phones at all. This is that
 * replacement: the LogPup brand icon in the header doubles as its trigger —
 * tapping it opens the same nav list as the desktop sidebar in a slide-over
 * panel.
 *
 * Built on the existing Dialog primitive (there is no dedicated Sheet/Drawer
 * primitive in components/ui yet) rather than hand-rolled, so focus-trap,
 * `aria-modal`, Escape-to-close, and focus return to the trigger on close
 * all come from Base UI's Dialog for free. Renders the exact same
 * `navItems`/`adminNavItems` (nav-items.ts) and the same `NavLink` row
 * (sidebar.tsx) as the desktop Sidebar — one nav list, one row renderer,
 * two surfaces.
 */
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()

  // Closing on navigation: the onClick handler on the nav below closes the
  // instant a link is activated (mouse or keyboard — Enter on a link also
  // fires a click), so this is the belt-and-suspenders fallback for a route
  // change that doesn't originate from a click inside the panel (e.g.
  // browser back/forward while the panel happens to be open). Adjusting
  // state while rendering rather than in an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // — avoids the extra commit a `useEffect` here would cost on every route
  // change, mobile-sheet-open or not.
  const [lastPathname, setLastPathname] = React.useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    if (open) setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
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
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="mobile-nav-content"
          className="fixed inset-y-0 left-0 z-50 flex h-svh w-72 max-w-[85vw] flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground outline-none duration-150 ease-out motion-reduce:transition-none data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-left data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-left"
        >
          {/* Same branding row as the desktop sidebar: LogPup left, the Alta
              Vision mark pushed right. The close button still owns the far
              right edge — it is the one control a thumb reaches for, so the
              attribution mark yields to it rather than the other way round. */}
          <div className="flex items-center gap-2">
            <DialogTitle className="flex shrink-0 items-center gap-2.5 text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <PawPrint className="size-4" aria-hidden />
              </span>
              LogPup
            </DialogTitle>
            <a
              href="https://altavision.lk"
              target="_blank"
              rel="noreferrer"
              aria-label="Alta Vision — opens altavision.lk in a new tab"
              className="ml-auto inline-flex shrink-0 rounded-md opacity-80 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none motion-reduce:transition-none"
            >
              <AltaVisionLogo className="h-3 w-auto" />
            </a>
            <DialogClose
              render={<Button variant="ghost" size="icon-sm" aria-label="Close navigation" />}
            >
              <XIcon aria-hidden />
            </DialogClose>
          </div>

          <nav
            aria-label="Primary"
            className="-mx-1 flex flex-1 flex-col gap-0.5 overflow-y-auto"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('a')) setOpen(false)
            }}
          >
            {navItems.map(({ href, label, icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={href === '/' ? pathname === '/' : pathname.startsWith(href)}
              />
            ))}
            {/* Same single declaration the desktop sidebar renders — see the
                comment there for why it isn't in navItems. */}
            <NavLink
              href={settingsNavItem.href}
              label={settingsNavItem.label}
              icon={settingsNavItem.icon}
              active={pathname.startsWith(settingsNavItem.href)}
            />

            {isAdmin ? (
              <div className="mt-6 flex flex-col gap-0.5">
                <div className="px-2.5 pb-1 text-2xs font-medium uppercase tracking-wider text-sidebar-foreground/70">
                  Manage
                </div>
                {adminNavItems.map(({ href, label, icon }) => (
                  <NavLink
                    key={href}
                    href={href}
                    label={label}
                    icon={icon}
                    active={pathname.startsWith(href)}
                  />
                ))}
              </div>
            ) : null}
          </nav>

          {/* The version had exactly one home before this: the desktop sidebar
              footer, which is `hidden md:flex`. On a phone there was therefore
              NO way to answer "which build am I on?", which is the first
              question any bug report needs. This is the same VersionBadge the
              desktop footer renders (one component, one CURRENT_VERSION), so
              the changelog comes along with it; if the nested popup ever
              misbehaves inside this sheet the version string itself is still on
              screen, because it is the trigger's own label.

              The Alta Vision mark used to sit beside it here; it now rides in
              the branding row above, next to the paw it belongs with, and is
              deliberately not repeated in a sheet this short.

              min-h-11: the trigger inside is a real <button>, so the
              coarse-pointer hit-slop in globals.css already guarantees a
              44px hit area — this row just gives that invisible target room
              to live in, instead of cramming a sub-24px chip against the
              sheet's bottom edge. */}
          <div className="flex min-h-11 items-center border-t border-sidebar-border pt-3">
            <VersionBadge />
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
