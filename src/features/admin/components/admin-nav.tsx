'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { AdminSection } from '@/features/admin/sections'
import { cn } from '@/lib/utils'

/**
 * Section nav for the admin area.
 *
 * Renders only what it is handed — `visibleSections(actor)` decides, so the
 * nav cannot offer a section the route guard refuses. Nothing here is an
 * enforcement point; every section re-checks on the server.
 */
export function AdminNav({ sections }: { sections: AdminSection[] }) {
  const pathname = usePathname()
  const safe = sections.filter((s) => !s.danger)
  const danger = sections.filter((s) => s.danger)

  return (
    <nav aria-label="Admin sections" className="w-full lg:w-56 lg:shrink-0">
      {/* Horizontal scroller on small screens rather than a hidden sidebar:
          a nav with no replacement is worse than one that scrolls. */}
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {safe.map((section) => (
          <NavItem key={section.href} section={section} pathname={pathname} />
        ))}
      </ul>

      {danger.length > 0 && (
        <>
          <hr className="my-3 border-border" aria-hidden />
          <ul className="flex gap-1 lg:flex-col">
            {danger.map((section) => (
              <NavItem key={section.href} section={section} pathname={pathname} danger />
            ))}
          </ul>
        </>
      )}
    </nav>
  )
}

function NavItem({
  section,
  pathname,
  danger,
}: {
  section: AdminSection
  pathname: string
  danger?: boolean
}) {
  // Exact match for the overview, prefix for the rest, so /admin does not
  // light up on every child route.
  const active = section.href === '/admin' ? pathname === '/admin' : pathname.startsWith(section.href)

  return (
    <li>
      <Link
        href={section.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'block whitespace-nowrap rounded-md border-l-2 px-3 py-2 text-sm transition-colors duration-150 ease-out',
          'hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          // Weight and a left rule carry the active state, not colour alone.
          active
            ? 'border-l-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
            : 'border-l-transparent text-muted-foreground',
          danger && 'text-destructive hover:bg-destructive/10',
        )}
      >
        {section.label}
      </Link>
    </li>
  )
}
