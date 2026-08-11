'use client'

import type { ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type QuickMenuItem =
  | {
      type: 'item'
      key: string
      label: ReactNode
      icon?: ReactNode
      onSelect: () => void
      destructive?: boolean
    }
  | { type: 'separator'; key: string }

/**
 * A card's per-item action menu — built on the existing
 * `src/components/ui/dropdown-menu.tsx` (Base UI `Menu`) so it matches every
 * other menu in the product. Opens from a hover/focus-revealed `⋯` button
 * baked in here, AND on right-click anywhere on the card — but the
 * right-click listener has to live on the card's own outer element (this
 * component is rendered nested inside it, and a `contextmenu` fired on some
 * other part of the card wouldn't reach a listener placed only here), so the
 * open state is controlled by the caller: attach
 * `onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true) }}` on the
 * card and pass `open`/`onOpenChange` through. See `TaskCard` for the
 * pattern.
 *
 * `items` are expected to already be permission-filtered by the caller
 * (hide what the user cannot do at all) — this component has no idea about
 * roles or ownership.
 */
export function CardQuickMenu({
  items,
  open,
  onOpenChange,
  label,
  className,
}: {
  items: QuickMenuItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  className?: string
}) {
  if (items.length === 0) return null

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            aria-label={label}
            // Stops both the click (which would otherwise bubble to the
            // card's own onClick and open it) and the pointerdown (which
            // would otherwise reach dnd-kit's drag listeners on the card's
            // outer element) before either fires.
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              'absolute top-1 right-1 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 data-popup-open:opacity-100',
              className,
            )}
          />
        }
      >
        <MoreVertical />
        <span className="sr-only">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item) =>
          item.type === 'separator' ? (
            <DropdownMenuSeparator key={item.key} />
          ) : (
            <DropdownMenuItem
              key={item.key}
              variant={item.destructive ? 'destructive' : 'default'}
              onClick={() => item.onSelect()}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
