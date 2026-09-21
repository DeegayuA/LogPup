'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  AI_FEATURES_EVENT,
  AI_FEATURES_STORAGE_KEY,
  aiFeaturesToggleLabel,
  formatAiFeaturesSummaryBadge,
  resolveAiFeaturesOpen,
} from '@/features/gemini/ai-features-collapse-model'

let memoryState: boolean | null = null

function readIsOpen(): boolean {
  if (typeof window === 'undefined') return false
  if (memoryState !== null) return memoryState
  try {
    const raw = window.localStorage.getItem(AI_FEATURES_STORAGE_KEY)
    return resolveAiFeaturesOpen(raw, window.location.hash)
  } catch {
    return resolveAiFeaturesOpen(null, window.location.hash)
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  window.addEventListener(AI_FEATURES_EVENT, callback)
  window.addEventListener('hashchange', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(AI_FEATURES_EVENT, callback)
    window.removeEventListener('hashchange', callback)
  }
}

function getSnapshot(): boolean {
  return readIsOpen()
}

function getServerSnapshot(): boolean {
  return false
}

function setOpenPreference(next: boolean): void {
  memoryState = next
  try {
    window.localStorage.setItem(AI_FEATURES_STORAGE_KEY, String(next))
  } catch {
    // storage unavailable or restricted
  }
  window.dispatchEvent(new CustomEvent(AI_FEATURES_EVENT))
}

interface AiFeaturesCardShellProps {
  /** Total calls logged across all features in the 30-day usage window. */
  totalCalls: number
  /** How many AI features are currently toggled on. */
  enabledCount: number
  /** Total count of registered AI features. */
  totalFeatures: number
  children: ReactNode
}

/**
 * Client shell for the AI features card on /settings.
 *
 * Allows collapsing the full card contents (usage grid, fine-print footnotes,
 * and the 8+ feature switch/model rows) into a compact header with a quick
 * usage badge. Remembers the user's preference in localStorage and automatically
 * expands if navigated to via the #ai-features fragment (e.g. from the command
 * palette).
 */
export function AiFeaturesCardShell({
  totalCalls,
  enabledCount,
  totalFeatures,
  children,
}: AiFeaturesCardShellProps) {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 font-heading">
          <Sparkles className="size-4 text-primary" aria-hidden /> AI features
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          {!open ? (
            <Badge
              variant="secondary"
              className="font-mono text-xs font-normal tabular-nums text-muted-foreground"
            >
              {formatAiFeaturesSummaryBadge(totalCalls, enabledCount, totalFeatures)}
            </Badge>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setOpenPreference(!open)}
            aria-expanded={open}
            aria-controls="ai-features-body"
            className="h-8 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                'size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
                open && 'rotate-180',
              )}
              aria-hidden
            />
            <span>{aiFeaturesToggleLabel(open)}</span>
          </Button>
        </CardAction>
        <CardDescription>
          Everything AI does here runs on your Gemini keys. Each switch covers one feature only —
          turning off drafting leaves dictation and read-aloud on. Dollar figures are indicative —
          what the tokens would cost on Google&rsquo;s paid tier. Free keys are charged $0, and only
          your own paid keys can charge you: work that falls through to a teammate&rsquo;s shared key
          lands on their bill, not yours.
        </CardDescription>
      </CardHeader>
      <div
        id="ai-features-body"
        className={cn(
          'flex flex-col gap-4',
          !open && 'hidden',
        )}
      >
        {children}
      </div>
    </Card>
  )
}
