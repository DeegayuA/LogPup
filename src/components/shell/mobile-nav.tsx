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
import { adminNavItems, navItems } from '@/components/shell/nav-items'

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
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <PawPrint className="size-4" aria-hidden />
              </span>
              LogPup
            </DialogTitle>
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

          {/* Same quiet parent-company sign-off as the desktop sidebar, so the
              two shells say the same thing about who makes LogPup. */}
          <div className="border-t border-sidebar-border pt-3">
            <a
              href="https://altavision.lk"
              target="_blank"
              rel="noreferrer"
              aria-label="Alta Vision — opens altavision.lk in a new tab"
              className="inline-flex rounded-md opacity-80 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none motion-reduce:transition-none"
            >
              <AltaVisionLogo className="h-4 w-auto" />
            </a>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
