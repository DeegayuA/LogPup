'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, AppWindow, CalendarDays, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/people', label: 'People', icon: Users },
  { href: '/apps', label: 'Apps', icon: AppWindow },
  { href: '/meetings', label: 'Meetings', icon: CalendarDays },
] as const

const adminItem = { href: '/admin', label: 'Admin', icon: ShieldCheck } as const

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const items = isAdmin ? [...navItems, adminItem] : navItems

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 border-r border-border bg-sidebar p-3 text-sidebar-foreground">
      <div className="px-2 py-2 text-lg font-semibold">LogPup</div>
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
