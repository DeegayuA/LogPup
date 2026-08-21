'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, MessageCircle, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { getPersonCard, type PersonCard } from '@/features/people/card-actions'
import { telHref, waHref } from '@/lib/phone'
import { cn } from '@/lib/utils'

/**
 * A person's name, with who they are and how to reach them one hover away.
 *
 * THE CLOSE DELAY IS THE FEATURE, not a polish detail. This card holds
 * BUTTONS — Call and WhatsApp — so the pointer has to travel from the name
 * into the card to use them. A tooltip that dismisses the moment the pointer
 * leaves its trigger makes that journey impossible, and the buttons may as
 * well not be there. 600ms is long enough to cross the gap deliberately and
 * short enough that a card brushed past does not follow you around.
 *
 * Popover rather than Tooltip for the same reason: tooltip content is not
 * meant to be interactive or focusable, and a tel: link a keyboard user cannot
 * reach excludes exactly the people most likely to be navigating by keyboard.
 *
 * The card FETCHES ON OPEN. A meeting names a dozen people and the directory
 * names all of them; fetching every card up front would be a dozen queries for
 * something nobody asked to see.
 */
export function PersonHoverCard({
  userId,
  children,
  className,
}: {
  userId: string
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [card, setCard] = React.useState<PersonCard | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Fetched once per person and kept. Deliberately NOT invalidated on close:
    // an allocation does not change between two hovers a second apart, and a
    // skeleton on every re-hover reads as the card being broken.
    if (!open || card !== null || error !== null) return
    let cancelled = false
    void getPersonCard({ userId }).then((res) => {
      if (cancelled) return
      if (res.ok) setCard(res.data)
      else setError(res.error)
    })
    return () => {
      cancelled = true
    }
  }, [open, card, error, userId])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        // The hover props live on the Trigger in Base UI, not the Root.
        openOnHover
        delay={220}
        closeDelay={600}
        render={
          <Link
            href={`/people/${userId}`}
            className={cn(
              'rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50',
              className,
            )}
          />
        }
      >
        {children}
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={6} className="w-72 p-0">
        {error !== null ? (
          <p className="p-3 text-2xs text-muted-foreground">{error}</p>
        ) : card === null ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : (
          <PersonCardBody card={card} />
        )}
      </PopoverContent>
    </Popover>
  )
}

function PersonCardBody({ card }: { card: PersonCard }) {
  const over = card.totalPct > 100
  const near = card.totalPct >= 80 && card.totalPct <= 100

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-0.5 p-3 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium">{card.name}</span>
          {card.apps.length > 0 ? (
            <span
              className={cn(
                'shrink-0 font-mono text-2xs tabular-nums',
                over ? 'text-destructive' : near ? 'text-chart-1' : 'text-muted-foreground',
              )}
              title="Total allocation across their projects"
            >
              {card.totalPct}%
            </span>
          ) : null}
        </div>
        {card.title ? <span className="text-2xs text-muted-foreground">{card.title}</span> : null}
      </div>

      {/* What they are actually on — the question a name on a meeting page
          raises and the page itself never answers. */}
      <div className="flex flex-col gap-1 border-t border-border/60 px-3 py-2">
        {card.apps.length === 0 ? (
          <span className="text-2xs text-muted-foreground">On no project right now</span>
        ) : (
          card.apps.slice(0, 4).map((app) => (
            <div key={app.slug} className="flex items-baseline justify-between gap-2 text-2xs">
              <Link
                href={`/apps/${app.slug}`}
                className="min-w-0 truncate rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {app.name}
              </Link>
              <span className="flex shrink-0 items-baseline gap-1.5 text-muted-foreground">
                {app.role ? <span className="truncate">{app.role}</span> : null}
                <span className="font-mono tabular-nums">{app.allocationPct}%</span>
              </span>
            </div>
          ))
        )}
        {card.apps.length > 4 ? (
          <span className="text-2xs text-muted-foreground">+{card.apps.length - 4} more</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 p-2">
        {/* Only when a number exists. A Call button that dials nothing is worse
            than no button: it costs a click to learn the number is missing. */}
        {card.phone ? (
          <>
            <Button size="xs" variant="outline" render={<a href={telHref(card.phone)} />}>
              <Phone aria-hidden className="size-3" />
              Call
            </Button>
            <Button
              size="xs"
              variant="outline"
              render={<a href={waHref(card.phone)} target="_blank" rel="noreferrer" />}
            >
              <MessageCircle aria-hidden className="size-3" />
              WhatsApp
            </Button>
          </>
        ) : (
          <span className="px-1 py-0.5 text-2xs text-muted-foreground">No phone number</span>
        )}
        <Button
          size="xs"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          render={<Link href={`/people/${card.id}`} />}
        >
          Profile
          <ArrowUpRight aria-hidden className="size-3" />
        </Button>
      </div>
    </div>
  )
}
