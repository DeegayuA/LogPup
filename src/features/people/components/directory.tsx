'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { CapacityBar } from '@/features/people/components/capacity-bar'
import type { UserCapacity } from '@/features/people/queries'

type SortKey = 'name' | 'load-desc' | 'load-asc'

const SORT_LABEL: Record<SortKey, string> = {
  name: 'Name A–Z',
  'load-desc': 'Most loaded first',
  'load-asc': 'Least loaded first',
}

/** Sortable, org-filterable directory rows for the People page. */
export function PeopleDirectory({ people }: { people: UserCapacity[] }) {
  const [sort, setSort] = useState<SortKey>('name')
  const [org, setOrg] = useState<string | null>(null)

  const orgs = useMemo(
    () => [...new Set(people.flatMap((p) => p.user.orgTags))].sort((a, b) => a.localeCompare(b)),
    [people],
  )

  const rows = useMemo(() => {
    const filtered = org ? people.filter((p) => p.user.orgTags.includes(org)) : people
    return [...filtered].sort((a, b) => {
      if (sort === 'load-desc') return b.totalPct - a.totalPct
      if (sort === 'load-asc') return a.totalPct - b.totalPct
      return a.user.name.localeCompare(b.user.name)
    })
  }, [people, org, sort])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {orgs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by organization">
            <button
              type="button"
              aria-pressed={org === null}
              onClick={() => setOrg(null)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                org === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:border-ring/40 hover:text-foreground',
              )}
            >
              All
            </button>
            {orgs.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={org === tag}
                onClick={() => setOrg(org === tag ? null : tag)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  org === tag
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:border-ring/40 hover:text-foreground',
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ml-auto">
          <Select value={sort} onValueChange={(value: string | null) => setSort((value as SortKey) ?? 'name')}>
            <SelectTrigger size="sm" className="h-8 w-44" aria-label="Sort people">
              <SelectValue>{(value: string) => SORT_LABEL[value as SortKey]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          No one in {org} yet — clear the filter to see everyone.
        </p>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
          {rows.map(({ user, totalPct, breakdown }) => (
            <li key={user.id}>
              <Link
                href={`/people/${user.id}`}
                className={cn(
                  'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3',
                  'transition-colors duration-150 hover:bg-accent/50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50',
                )}
              >
                <Avatar>
                  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                  <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 basis-48 flex-col">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {user.name}
                    {user.role === 'admin' ? (
                      <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-label="Admin" />
                    ) : null}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.title ?? 'No title yet'}
                  </span>
                </div>
                {user.orgTags.length > 0 ? (
                  <div className="hidden items-center gap-1 md:flex">
                    {user.orgTags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="font-normal text-muted-foreground">
                        {tag}
                      </Badge>
                    ))}
                    {user.orgTags.length > 2 ? (
                      <span className="font-mono text-2xs text-muted-foreground">
                        +{user.orgTags.length - 2}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <span className="hidden max-w-56 truncate text-xs text-muted-foreground lg:block">
                  {breakdown.length > 0
                    ? breakdown
                        .slice(0, 2)
                        .map((b) => `${b.appName} ${b.allocationPct}%`)
                        .join(' · ') + (breakdown.length > 2 ? ` +${breakdown.length - 2}` : '')
                    : 'Unassigned'}
                </span>
                <div className="w-40 shrink-0">
                  <CapacityBar totalPct={totalPct} />
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
