'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  AppWindow,
  CalendarDays,
  ShieldCheck,
  PawPrint,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, key: 'D' },
  { href: '/apps', label: 'Apps', icon: AppWindow, key: 'A' },
  { href: '/people', label: 'People', icon: Users, key: 'P' },
  { href: '/meetings', label: 'Meetings', icon: CalendarDays, key: 'M' },
] as const

function NavLink({
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
        <kbd className="ml-auto hidden font-mono text-[10px] text-sidebar-foreground/40 group-hover:inline">
          G {hint}
        </kbd>
      ) : null}
    </Link>
  )
}

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="hidden h-auto w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
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
          <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/45">
            Manage
          </div>
          <NavLink
            href="/admin"
            label="Admin"
            icon={ShieldCheck}
            active={pathname.startsWith('/admin')}
          />
        </div>
      ) : null}

      <div className="mt-auto border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-foreground/45">
        Press <kbd className="rounded border border-sidebar-border bg-sidebar-accent/50 px-1 font-mono">⌘K</kbd> to
        fetch anything
      </div>
    </nav>
  )
}
